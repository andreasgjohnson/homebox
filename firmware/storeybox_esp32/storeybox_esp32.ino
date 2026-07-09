#include <Arduino.h>
#include <LittleFS.h>
#include <WiFi.h>
#include <time.h>

#include "sb_api.h"
#include "sb_config.h"
#include "sb_identity.h"
#include "sb_recorder.h"
#include "sb_ring.h"
#include "sb_sound.h"

enum NetJobType : uint8_t {
  NET_JOB_HELLO,
  NET_JOB_PAIRING_CODE,
  NET_JOB_HEARTBEAT,
  NET_JOB_SYNC,
  NET_JOB_RECORDING_STARTED
};

struct NetJob {
  NetJobType type;
  char clientRecordingId[56];
  char startedAt[28];
};

QueueHandle_t netQueue = nullptr;
volatile bool gSyncActive = false;
volatile bool gPairedChimePending = false;
portMUX_TYPE gSessionMux = portMUX_INITIALIZER_UNLOCKED;
char gActiveSessionId[40] = {0};

bool buttonStablePressed = false;
bool buttonLastRawPressed = false;
uint32_t buttonLastChangeMs = 0;
uint32_t buttonPressedAtMs = 0;
bool buttonLongHandled = false;

void setActiveSessionId(const String &sessionId) {
  portENTER_CRITICAL(&gSessionMux);
  memset(gActiveSessionId, 0, sizeof(gActiveSessionId));
  sessionId.toCharArray(gActiveSessionId, sizeof(gActiveSessionId));
  portEXIT_CRITICAL(&gSessionMux);
}

String activeSessionId() {
  char copy[sizeof(gActiveSessionId)];
  portENTER_CRITICAL(&gSessionMux);
  memcpy(copy, gActiveSessionId, sizeof(copy));
  portEXIT_CRITICAL(&gSessionMux);
  copy[sizeof(copy) - 1] = '\0';
  return String(copy);
}

void enqueueJob(NetJobType type, const String &clientRecordingId = "", const String &startedAt = "") {
  if (!netQueue) {
    return;
  }

  NetJob job = {};
  job.type = type;
  clientRecordingId.toCharArray(job.clientRecordingId, sizeof(job.clientRecordingId));
  startedAt.toCharArray(job.startedAt, sizeof(job.startedAt));
  xQueueSend(netQueue, &job, 0);
}

bool buttonRawPressed() {
  bool level = digitalRead(SB_PIN_BUTTON);
#if SB_BUTTON_ACTIVE_LOW
  return level == LOW;
#else
  return level == HIGH;
#endif
}

void writeButtonLed(bool on) {
#if SB_BUTTON_LED_ACTIVE_LOW
  digitalWrite(SB_PIN_BUTTON_LED, on ? LOW : HIGH);
#else
  digitalWrite(SB_PIN_BUTTON_LED, on ? HIGH : LOW);
#endif
}

void startStoreyRecording() {
  if (!sbIdentityIsPaired()) {
    Serial.println("Box is not paired yet; requesting a fresh pairing code.");
    enqueueJob(NET_JOB_PAIRING_CODE);
    sbRingFlashError();
    sbSoundPlay(SB_CHIME_ERROR);
    return;
  }

  time_t now = time(nullptr);
  String startedAt = sbIdentityIsoNow(now);
  String clientId = sbRecorderNewClientId();

  sbSoundPlay(SB_CHIME_START);
  if (!sbRecorderStart(clientId, startedAt, now)) {
    sbRingFlashError();
    sbSoundPlay(SB_CHIME_ERROR);
    return;
  }

  Serial.printf("Recording started: %s\n", clientId.c_str());
  enqueueJob(NET_JOB_RECORDING_STARTED, clientId, startedAt);
}

void stopStoreyRecording() {
  if (!sbRecorderIsRecording()) {
    return;
  }

  sbRecorderRequestStop(false);
  sbSoundPlay(SB_CHIME_STOP);
  Serial.println("Recording stop requested.");
}

void toggleStoreyRecording() {
  if (sbRecorderIsRecording()) {
    stopStoreyRecording();
  } else {
    startStoreyRecording();
  }
}

void handleButton() {
  bool rawPressed = buttonRawPressed();
  uint32_t now = millis();

  if (rawPressed != buttonLastRawPressed) {
    buttonLastRawPressed = rawPressed;
    buttonLastChangeMs = now;
  }

  if ((now - buttonLastChangeMs) < 35 || rawPressed == buttonStablePressed) {
    if (buttonStablePressed && !buttonLongHandled && (now - buttonPressedAtMs) > 5000 && !sbRecorderIsRecording()) {
      buttonLongHandled = true;
      Serial.println("Long press: requesting a fresh pairing code.");
      enqueueJob(NET_JOB_PAIRING_CODE);
    }
    return;
  }

  buttonStablePressed = rawPressed;
  if (buttonStablePressed) {
    buttonPressedAtMs = now;
    buttonLongHandled = false;
  } else {
    if (!buttonLongHandled) {
      toggleStoreyRecording();
    }
    buttonLongHandled = false;
  }
}

void updateButtonLed() {
  if (sbRecorderIsRecording()) {
    writeButtonLed(true);
    return;
  }

  if (!sbIdentityIsPaired()) {
    writeButtonLed(((millis() / 700) % 2) == 0);
    return;
  }

  writeButtonLed(false);
}

void updateRingMode() {
  if (sbRecorderIsRecording()) {
    sbRingSetMode(SB_RING_RECORDING);
  } else if (gSyncActive || sbRecorderQueuedCount() > 0) {
    sbRingSetMode(SB_RING_SYNCING);
  } else if (!sbIdentityIsPaired()) {
    sbRingSetMode(SB_RING_UNPAIRED);
  } else if (sbRingMode() != SB_RING_ERROR) {
    sbRingSetMode(SB_RING_IDLE);
  }
}

bool ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  Serial.printf("Connecting to Wi-Fi SSID \"%s\"...\n", SB_WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(SB_WIFI_SSID, SB_WIFI_PASSWORD);

  uint32_t started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < SB_WIFI_CONNECT_TIMEOUT_MS) {
    vTaskDelay(pdMS_TO_TICKS(250));
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi connection failed; will retry.");
    return false;
  }

  Serial.print("Wi-Fi connected: ");
  Serial.println(WiFi.localIP());
  return true;
}

bool ensureClock() {
  static bool configured = false;
  if (sbIdentityClockReady()) {
    return true;
  }

  if (!configured) {
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    configured = true;
  }

  uint32_t started = millis();
  while (!sbIdentityClockReady() && millis() - started < 15000) {
    vTaskDelay(pdMS_TO_TICKS(250));
  }

  if (!sbIdentityClockReady()) {
    Serial.println("NTP sync failed; signed requests will wait.");
    return false;
  }

  Serial.print("Clock synced: ");
  Serial.println(sbIdentityIsoNow());
  return true;
}

bool ensureNetworkReady() {
  return ensureWiFi() && ensureClock();
}

void printPairingCode(const SbPairingCode &pairingCode) {
  Serial.println();
  Serial.println("----- Pair this Box -----");
  Serial.print("Code: ");
  Serial.println(pairingCode.code);
  Serial.print("Expires: ");
  Serial.println(pairingCode.expiresAt);
  Serial.print("URI: ");
  Serial.println(pairingCode.uri);
  Serial.println("-------------------------");
  Serial.println();
}

uint32_t retryDelayForFailures(uint32_t failures) {
  uint32_t delayMs = SB_SYNC_INITIAL_BACKOFF_MS;
  for (uint32_t i = 1; i < failures; i++) {
    if (delayMs >= SB_SYNC_MAX_BACKOFF_MS / 2) {
      return SB_SYNC_MAX_BACKOFF_MS;
    }
    delayMs *= 2;
  }
  return delayMs > SB_SYNC_MAX_BACKOFF_MS ? SB_SYNC_MAX_BACKOFF_MS : delayMs;
}

bool syncOneRecording(const SbRecordingMeta &meta) {
  File file = LittleFS.open(meta.wavPath, FILE_READ);
  if (!file) {
    Serial.printf("Missing WAV for %s; deleting stale metadata.\n", meta.clientRecordingId.c_str());
    LittleFS.remove(meta.metaPath);
    return true;
  }
  file.close();

  SbRecordingStartResult started;
  if (!sbApiRecordingStart(meta.clientRecordingId, meta.startedAt, started)) {
    return false;
  }
  setActiveSessionId(started.sessionId);

  SbRecordingCompleteResult completed;
  if (!sbApiRecordingComplete(
        meta.clientRecordingId,
        started.sessionId,
        meta.endedAt,
        meta.durationMs,
        meta.fileSizeBytes,
        meta.sha256,
        meta.interrupted,
        completed)) {
    setActiveSessionId("");
    return false;
  }

  file = LittleFS.open(meta.wavPath, FILE_READ);
  if (!file) {
    setActiveSessionId("");
    return false;
  }

  bool uploaded = sbApiUploadFile(completed.upload, file, meta.fileSizeBytes);
  file.close();

  if (!uploaded) {
    SbUploadLease refreshed;
    if (sbApiRefreshUploadUrl(started.sessionId, meta.sha256, refreshed)) {
      file = LittleFS.open(meta.wavPath, FILE_READ);
      if (file) {
        uploaded = sbApiUploadFile(refreshed, file, meta.fileSizeBytes);
        file.close();
        if (uploaded) {
          completed.upload = refreshed;
        }
      }
    }
  }

  if (!uploaded) {
    setActiveSessionId("");
    return false;
  }

  SbUploadCompleteResult uploadComplete;
  if (!sbApiUploadComplete(started.sessionId, completed.upload, meta.fileSizeBytes, meta.sha256, uploadComplete)) {
    setActiveSessionId("");
    return false;
  }

  bool deleted = false;
  if (uploadComplete.safeToDeleteLocal) {
    deleted = sbRecorderDeleteLocal(meta);
  }

  sbApiSyncComplete(started.sessionId, deleted);
  setActiveSessionId("");
  Serial.printf("Synced recording: %s\n", meta.clientRecordingId.c_str());
  return uploadComplete.safeToDeleteLocal && deleted;
}

void syncReadyRecordings() {
  if (!sbIdentityIsPaired() || sbRecorderIsRecording()) {
    return;
  }

  gSyncActive = true;

  SbRecordingMeta meta;
  while (sbRecorderFindReadyMeta(meta, time(nullptr))) {
    Serial.printf("Syncing recording: %s\n", meta.clientRecordingId.c_str());
    if (syncOneRecording(meta)) {
      continue;
    }

    uint32_t failures = meta.consecutiveFailures + 1;
    uint32_t delayMs = retryDelayForFailures(failures);
    time_t retryAt = time(nullptr) + (delayMs / 1000);
    sbRecorderUpdateRetry(meta, failures, retryAt);
    Serial.printf("Sync failed for %s; retry %lu in %lu seconds.\n",
                  meta.clientRecordingId.c_str(),
                  static_cast<unsigned long>(failures),
                  static_cast<unsigned long>(delayMs / 1000));

    if (failures == SB_ERROR_REPORT_AFTER_FAILURES) {
      sbApiReportError("warning", "Recording sync has failed repeatedly.");
    }
    break;
  }

  gSyncActive = false;
}

void sendHeartbeat() {
  bool paired = sbIdentityIsPaired();
  String state = "idle";
  if (sbRecorderIsRecording()) {
    state = "recording";
  } else if (gSyncActive || sbRecorderQueuedCount() > 0) {
    state = "syncing";
  }

  if (sbApiHeartbeat(state, activeSessionId(), sbRecorderFreeBytes(), sbRecorderQueuedCount(), paired)) {
    bool wasPaired = sbIdentityIsPaired();
    sbIdentitySetPaired(paired);
    if (paired && !wasPaired) {
      gPairedChimePending = true;
    }
  }
}

void handleNetJob(const NetJob &job) {
  if (!ensureNetworkReady()) {
    return;
  }

  switch (job.type) {
    case NET_JOB_HELLO: {
      bool paired = sbIdentityIsPaired();
      if (sbApiHello(paired)) {
        bool wasPaired = sbIdentityIsPaired();
        sbIdentitySetPaired(paired);
        if (paired && !wasPaired) {
          gPairedChimePending = true;
        }
      }
      break;
    }
    case NET_JOB_PAIRING_CODE: {
      SbPairingCode pairingCode;
      if (sbApiIssuePairingCode(pairingCode)) {
        printPairingCode(pairingCode);
      }
      break;
    }
    case NET_JOB_HEARTBEAT:
      sendHeartbeat();
      break;
    case NET_JOB_RECORDING_STARTED: {
      SbRecordingStartResult started;
      if (sbApiRecordingStart(String(job.clientRecordingId), String(job.startedAt), started)) {
        setActiveSessionId(started.sessionId);
      }
      break;
    }
    case NET_JOB_SYNC:
      syncReadyRecordings();
      break;
  }
}

void netTask(void *) {
  uint32_t lastHeartbeatMs = 0;
  uint32_t lastSyncScanMs = 0;
  bool bootPairCodeRequested = false;

  enqueueJob(NET_JOB_HELLO);

  for (;;) {
    NetJob job = {};
    if (xQueueReceive(netQueue, &job, pdMS_TO_TICKS(1000)) == pdTRUE) {
      handleNetJob(job);
    }

    uint32_t now = millis();

    if (!bootPairCodeRequested && !sbIdentityIsPaired() && ensureNetworkReady()) {
      bootPairCodeRequested = true;
      NetJob pairJob = {};
      pairJob.type = NET_JOB_PAIRING_CODE;
      handleNetJob(pairJob);
    }

    if (now - lastHeartbeatMs > SB_HEARTBEAT_SECONDS * 1000UL) {
      lastHeartbeatMs = now;
      if (ensureNetworkReady()) {
        sendHeartbeat();
      }
    }

    if (now - lastSyncScanMs > 15000UL && sbRecorderQueuedCount() > 0 && ensureNetworkReady()) {
      lastSyncScanMs = now;
      syncReadyRecordings();
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println();
  Serial.println("Storeybox ESP32 firmware booting...");

  pinMode(SB_PIN_BUTTON, INPUT_PULLUP);
  pinMode(SB_PIN_BUTTON_LED, OUTPUT);
  writeButtonLed(false);

  sbRingBegin();
  sbSoundBegin();

  if (!LittleFS.begin(true)) {
    Serial.println("LittleFS mount failed.");
    sbRingFlashError();
    return;
  }

  if (!sbIdentityBegin()) {
    sbRingFlashError();
    return;
  }

  sbIdentityPrintProvisioningSql(Serial);

  if (!sbRecorderBegin()) {
    sbRingFlashError();
    return;
  }
  sbRecorderSalvageQueue();

  netQueue = xQueueCreate(12, sizeof(NetJob));
  if (!netQueue) {
    Serial.println("Could not create network queue.");
    sbRingFlashError();
    return;
  }

  BaseType_t ok = xTaskCreatePinnedToCore(netTask, "sb_net", SB_NET_TASK_STACK_WORDS, nullptr, 1, nullptr, SB_NET_TASK_CORE);
  if (ok != pdPASS) {
    Serial.println("Could not start network task.");
    sbRingFlashError();
    return;
  }

  enqueueJob(NET_JOB_SYNC);
}

void loop() {
  handleButton();
  sbRecorderPump();

  SbRecordingMeta finished;
  if (sbRecorderPopFinished(finished)) {
    enqueueJob(NET_JOB_SYNC);
  }

  if (gPairedChimePending) {
    gPairedChimePending = false;
    sbSoundPlay(SB_CHIME_PAIRED);
  }

  updateRingMode();
  sbRingUpdate();
  updateButtonLed();

  delay(5);
}

