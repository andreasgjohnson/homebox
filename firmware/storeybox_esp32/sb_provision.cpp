#include "sb_provision.h"

#include "sb_config.h"
#include "sb_identity.h"
#include "sb_ring.h"

#include <WiFi.h>
#include <WiFiProv.h>
#include <network_provisioning/manager.h>

namespace {

volatile bool gProvisioningActive = false;
String gServiceName;

// Pairing-code delivery over the still-open provisioning session. The BLE
// stack task serves the endpoint while the network task writes the payload,
// so the state and buffer are shared under a spinlock.
enum PairDeliveryState : uint8_t {
  PAIR_IDLE,      // Wi-Fi credentials not accepted yet
  PAIR_FETCHING,  // Wi-Fi is up; waiting on box-api for a code
  PAIR_READY,     // gPairPayload holds the code
  PAIR_FAILED,    // fetch failed; the app falls back to manual entry
};

portMUX_TYPE gPairMux = portMUX_INITIALIZER_UNLOCKED;
PairDeliveryState gPairState = PAIR_IDLE;
char gPairPayload[384];
volatile uint32_t gWifiAcceptedAtMs = 0;   // 0 = not yet; else millis()|1
volatile uint32_t gPairDeliveredAtMs = 0;  // 0 = not yet; else millis()|1

// Served from the BLE stack task, so it must not block: it only snapshots
// the prepared payload. protocomm frees outbuf with free().
esp_err_t onPairEndpointRequest(uint32_t, const uint8_t *, ssize_t, uint8_t **outbuf,
                                ssize_t *outlen, void *) {
  char payload[sizeof(gPairPayload)];

  portENTER_CRITICAL(&gPairMux);
  PairDeliveryState state = gPairState;
  memcpy(payload, gPairPayload, sizeof(payload));
  portEXIT_CRITICAL(&gPairMux);

  const char *response = "{\"status\":\"pending\"}";
  if (state == PAIR_READY) {
    response = payload;
  } else if (state == PAIR_FAILED) {
    response = "{\"status\":\"error\"}";
  }

  *outbuf = reinterpret_cast<uint8_t *>(strdup(response));
  if (*outbuf == nullptr) {
    return ESP_ERR_NO_MEM;
  }
  *outlen = strlen(response);

  if (state == PAIR_READY || state == PAIR_FAILED) {
    gPairDeliveredAtMs = millis() | 1;
  }
  return ESP_OK;
}

// Runs on the Arduino event task, not the loop task.
void onProvisionEvent(arduino_event_t *event) {
  switch (event->event_id) {
    case ARDUINO_EVENT_PROV_START:
      Serial.println();
      Serial.println("----- Wi-Fi setup mode -----");
      Serial.printf("Advertising over BLE as \"%s\".\n", gServiceName.c_str());
      Serial.println("Use the Storeybox app to send Wi-Fi credentials.");
      Serial.println("----------------------------");
      break;
    case ARDUINO_EVENT_PROV_CRED_RECV:
      Serial.printf("Received Wi-Fi credentials for SSID \"%s\".\n",
                    reinterpret_cast<const char *>(event->event_info.prov_cred_recv.ssid));
      break;
    case ARDUINO_EVENT_PROV_CRED_FAIL: {
      bool authError = event->event_info.prov_fail_reason == NETWORK_PROV_WIFI_STA_AUTH_ERROR;
      Serial.printf("Wi-Fi join failed: %s. Waiting for the app to retry.\n",
                    authError ? "wrong password" : "network not found");
      // Returns the provisioning state machine to idle so the app can send
      // new credentials in the same session, without rebooting the box.
      network_prov_mgr_reset_wifi_sm_state_on_failure();
      sbRingFlashError();
      break;
    }
    case ARDUINO_EVENT_PROV_CRED_SUCCESS:
      Serial.println("Wi-Fi credentials accepted and stored.");
      portENTER_CRITICAL(&gPairMux);
      if (gPairState == PAIR_IDLE) {
        gPairState = PAIR_FETCHING;
      }
      portEXIT_CRITICAL(&gPairMux);
      gWifiAcceptedAtMs = millis() | 1;
      break;
    case ARDUINO_EVENT_PROV_END:
      gProvisioningActive = false;
      Serial.println("Wi-Fi setup finished.");
      break;
    default:
      break;
  }
}

}  // namespace

void sbProvisionBegin() {
  const String &boxId = sbIdentityBoxId();
  String suffix = boxId.length() >= 4 ? boxId.substring(boxId.length() - 4) : boxId;
  suffix.toUpperCase();
  gServiceName = String(SB_PROV_SERVICE_PREFIX) + suffix;

  WiFi.onEvent(onProvisionEvent);
  gProvisioningActive = true;

  // FREE_BTDM releases both classic BT and BLE memory once provisioning
  // ends; BLE cannot be restarted afterwards without a reboot, which is fine
  // because setup mode is only ever entered from boot.
  //
  // Init and start are split so the sb-pair endpoint can be declared in
  // between: the manager requires endpoint_create before provisioning starts
  // and endpoint_register after. Auto-stop is disabled for the same reason —
  // the session must outlive Wi-Fi success until the pairing code is
  // delivered; sbProvisionUpdate() owns stopping it.
  WiFiProv.initProvision(NETWORK_PROV_SCHEME_BLE, NETWORK_PROV_SCHEME_HANDLER_FREE_BTDM, false);
  WiFiProv.disableAutoStop(1000);
  network_prov_mgr_endpoint_create(SB_PROV_PAIR_ENDPOINT);
  WiFiProv.beginProvision(NETWORK_PROV_SCHEME_BLE, NETWORK_PROV_SCHEME_HANDLER_FREE_BTDM,
                          NETWORK_PROV_SECURITY_1, SB_PROV_POP, gServiceName.c_str(),
                          nullptr, nullptr, false);
  network_prov_mgr_endpoint_register(SB_PROV_PAIR_ENDPOINT, onPairEndpointRequest, nullptr);
}

bool sbProvisionActive() {
  return gProvisioningActive;
}

const String &sbProvisionServiceName() {
  return gServiceName;
}

bool sbProvisionPairCodeNeeded() {
  portENTER_CRITICAL(&gPairMux);
  bool needed = gPairState == PAIR_FETCHING;
  portEXIT_CRITICAL(&gPairMux);
  return needed && gProvisioningActive;
}

void sbProvisionPairCodeReady(const SbPairingCode &pairingCode) {
  JsonDocument doc;
  doc["status"] = "ready";
  doc["box_id"] = sbIdentityBoxId();
  doc["pairing_code"] = pairingCode.code;
  doc["pairing_uri"] = pairingCode.uri;
  doc["expires_at"] = pairingCode.expiresAt;

  String payload;
  serializeJson(doc, payload);
  if (payload.length() >= sizeof(gPairPayload)) {
    // Oversized payloads would truncate into invalid JSON; the app treats
    // that as an error and falls back to manual entry, so fail cleanly.
    Serial.println("Pairing payload too large for the sb-pair endpoint.");
    sbProvisionPairCodeFailed();
    return;
  }

  portENTER_CRITICAL(&gPairMux);
  strlcpy(gPairPayload, payload.c_str(), sizeof(gPairPayload));
  gPairState = PAIR_READY;
  portEXIT_CRITICAL(&gPairMux);
  Serial.println("Pairing code ready for the app over Bluetooth.");
}

void sbProvisionPairCodeFailed() {
  portENTER_CRITICAL(&gPairMux);
  gPairState = PAIR_FAILED;
  portEXIT_CRITICAL(&gPairMux);
}

void sbProvisionUpdate() {
  static bool stopIssued = false;
  if (!gProvisioningActive || stopIssued) {
    return;
  }

  uint32_t now = millis();
  bool delivered = gPairDeliveredAtMs != 0 && now - gPairDeliveredAtMs > SB_PROV_STOP_DELAY_MS;
  bool lingered = gWifiAcceptedAtMs != 0 && now - gWifiAcceptedAtMs > SB_PROV_PAIR_LINGER_MS;

  if (delivered || lingered) {
    stopIssued = true;
    Serial.println("Closing the Wi-Fi setup session.");
    network_prov_mgr_stop_provisioning();
  }
}

void sbProvisionResetAndReboot() {
  Serial.println("Clearing stored Wi-Fi credentials; rebooting into setup mode.");
  WiFi.disconnect(true /* wifi off */, true /* erase stored credentials */);
  delay(400);
  ESP.restart();
}
