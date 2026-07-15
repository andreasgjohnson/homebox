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
  WiFiProv.beginProvision(NETWORK_PROV_SCHEME_BLE, NETWORK_PROV_SCHEME_HANDLER_FREE_BTDM,
                          NETWORK_PROV_SECURITY_1, SB_PROV_POP, gServiceName.c_str(),
                          nullptr, nullptr, false);
}

bool sbProvisionActive() {
  return gProvisioningActive;
}

const String &sbProvisionServiceName() {
  return gServiceName;
}

void sbProvisionResetAndReboot() {
  Serial.println("Clearing stored Wi-Fi credentials; rebooting into setup mode.");
  WiFi.disconnect(true /* wifi off */, true /* erase stored credentials */);
  delay(400);
  ESP.restart();
}
