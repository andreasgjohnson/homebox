#include "sb_recorder.h"

#include "sb_config.h"
#include "sb_identity.h"

#include <ArduinoJson.h>
#include <ESP_I2S.h>
#include <LittleFS.h>
#include <esp_heap_caps.h>

namespace {

constexpr const char *kRecDir = "/rec";
constexpr size_t kWavHeaderBytes = 44;
constexpr size_t kCaptureSamples = 256;
constexpr size_t kPumpChunkBytes = 2048;

I2SClass micI2S(I2S_NUM_0);
TaskHandle_t captureTaskHandle = nullptr;
uint8_t *ring = nullptr;
size_t ringSize = 0;
volatile size_t ringHead = 0;
volatile size_t ringTail = 0;
volatile bool captureEnabled = false;
volatile bool stopRequested = false;
volatile bool stopInterrupted = false;
volatile size_t droppedBytes = 0;

File wavFile;
SbRecordingMeta activeMeta;
SbRecordingMeta finishedMeta;
uint32_t recordStartMillis = 0;
bool fileOpen = false;
bool finishedReady = false;
size_t dataBytesWritten = 0;
String lastError;

void setError(const String &message) {
  lastError = message;
  Serial.println(message);
}

void writeLe16(uint8_t *buffer, size_t offset, uint16_t value) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >> 8) & 0xff;
}

void writeLe32(uint8_t *buffer, size_t offset, uint32_t value) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >> 8) & 0xff;
  buffer[offset + 2] = (value >> 16) & 0xff;
  buffer[offset + 3] = (value >> 24) & 0xff;
}

void buildWavHeader(uint8_t *header, uint32_t dataBytes) {
  memset(header, 0, kWavHeaderBytes);
  memcpy(header, "RIFF", 4);
  writeLe32(header, 4, 36 + dataBytes);
  memcpy(header + 8, "WAVE", 4);
  memcpy(header + 12, "fmt ", 4);
  writeLe32(header, 16, 16);
  writeLe16(header, 20, 1);
  writeLe16(header, 22, SB_AUDIO_CHANNELS);
  writeLe32(header, 24, SB_AUDIO_SAMPLE_RATE);
  writeLe32(header, 28, SB_AUDIO_SAMPLE_RATE * SB_AUDIO_CHANNELS * (SB_AUDIO_BITS_PER_SAMPLE / 8));
  writeLe16(header, 32, SB_AUDIO_CHANNELS * (SB_AUDIO_BITS_PER_SAMPLE / 8));
  writeLe16(header, 34, SB_AUDIO_BITS_PER_SAMPLE);
  memcpy(header + 36, "data", 4);
  writeLe32(header, 40, dataBytes);
}

bool writePlaceholderHeader(File &file) {
  uint8_t header[kWavHeaderBytes];
  buildWavHeader(header, 0);
  return file.write(header, sizeof(header)) == sizeof(header);
}

bool patchWavHeader(const String &path, size_t dataBytes) {
  File file = LittleFS.open(path, "r+");
  if (!file) {
    return false;
  }
  uint8_t header[kWavHeaderBytes];
  buildWavHeader(header, static_cast<uint32_t>(dataBytes));
  file.seek(0);
  bool ok = file.write(header, sizeof(header)) == sizeof(header);
  file.close();
  return ok;
}

size_t ringAvailable() {
  size_t head = ringHead;
  size_t tail = ringTail;
  if (head >= tail) {
    return head - tail;
  }
  return ringSize - tail + head;
}

size_t ringFree() {
  return ringSize - ringAvailable() - 1;
}

bool ringPushBytes(const uint8_t *data, size_t len) {
  if (!ring || len > ringFree()) {
    droppedBytes += len;
    return false;
  }

  for (size_t i = 0; i < len; i++) {
    ring[ringHead] = data[i];
    ringHead = (ringHead + 1) % ringSize;
  }
  return true;
}

size_t ringPopBytes(uint8_t *out, size_t maxLen) {
  size_t count = 0;
  while (count < maxLen && ringTail != ringHead) {
    out[count++] = ring[ringTail];
    ringTail = (ringTail + 1) % ringSize;
  }
  return count;
}

int16_t convertSample(int32_t raw) {
  int32_t sample = raw >> SB_MIC_SHIFT;
  sample *= SB_MIC_GAIN;
  if (sample > INT16_MAX) {
    return INT16_MAX;
  }
  if (sample < INT16_MIN) {
    return INT16_MIN;
  }
  return static_cast<int16_t>(sample);
}

void captureTask(void *) {
  int32_t raw[kCaptureSamples];
  int16_t pcm[kCaptureSamples];

  for (;;) {
    if (!captureEnabled) {
      vTaskDelay(pdMS_TO_TICKS(10));
      continue;
    }

    size_t bytesRead = micI2S.readBytes(reinterpret_cast<char *>(raw), sizeof(raw));
    if (bytesRead == 0) {
      vTaskDelay(pdMS_TO_TICKS(2));
      continue;
    }

    size_t samples = bytesRead / sizeof(int32_t);
    for (size_t i = 0; i < samples; i++) {
      pcm[i] = convertSample(raw[i]);
    }
    ringPushBytes(reinterpret_cast<uint8_t *>(pcm), samples * sizeof(int16_t));
  }
}

String wavPathFor(const String &clientRecordingId) {
  return String(kRecDir) + "/" + clientRecordingId + ".wav";
}

String metaPathFor(const String &clientRecordingId) {
  return String(kRecDir) + "/" + clientRecordingId + ".json";
}

uint32_t durationFromDataBytes(size_t dataBytes) {
  const uint32_t bytesPerSecond = SB_AUDIO_SAMPLE_RATE * SB_AUDIO_CHANNELS * (SB_AUDIO_BITS_PER_SAMPLE / 8);
  if (bytesPerSecond == 0) {
    return 0;
  }
  return static_cast<uint32_t>((static_cast<uint64_t>(dataBytes) * 1000ULL) / bytesPerSecond);
}

size_t wavDataBytesForFile(File &file) {
  size_t size = file.size();
  return size > kWavHeaderBytes ? size - kWavHeaderBytes : 0;
}

bool finalizeActiveRecording() {
  captureEnabled = false;
  stopRequested = false;

  while (ringAvailable() > 0) {
    uint8_t buffer[kPumpChunkBytes];
    size_t count = ringPopBytes(buffer, sizeof(buffer));
    if (count > 0 && wavFile) {
      wavFile.write(buffer, count);
      dataBytesWritten += count;
    }
  }

  if (wavFile) {
    wavFile.flush();
    wavFile.close();
  }
  fileOpen = false;

  if (!patchWavHeader(activeMeta.wavPath, dataBytesWritten)) {
    setError("Failed to patch WAV header.");
    return false;
  }

  File file = LittleFS.open(activeMeta.wavPath, FILE_READ);
  if (!file) {
    setError("Failed to reopen WAV for hashing.");
    return false;
  }

  activeMeta.fileSizeBytes = file.size();
  activeMeta.durationMs = durationFromDataBytes(activeMeta.fileSizeBytes > kWavHeaderBytes ? activeMeta.fileSizeBytes - kWavHeaderBytes : 0);
  activeMeta.sha256 = sbSha256HexFile(file);
  file.close();

  activeMeta.endedEpoch = time(nullptr);
  activeMeta.endedAt = sbIdentityIsoNow(activeMeta.endedEpoch);
  if (activeMeta.startedEpoch < SB_MIN_VALID_EPOCH && activeMeta.endedEpoch >= SB_MIN_VALID_EPOCH) {
    // The clock synced mid-recording; the recorded start still predates it.
    activeMeta.startedEpoch = activeMeta.endedEpoch - activeMeta.durationMs / 1000;
    activeMeta.startedAt = sbIdentityIsoNow(activeMeta.startedEpoch);
  }
  activeMeta.interrupted = stopInterrupted;
  activeMeta.consecutiveFailures = 0;
  activeMeta.retryNotBefore = 0;

  if (activeMeta.durationMs < SB_MIN_RECORD_MS) {
    LittleFS.remove(activeMeta.wavPath);
    LittleFS.remove(activeMeta.metaPath);
    setError("Discarded very short recording.");
    return false;
  }

  if (!sbRecorderWriteMeta(activeMeta)) {
    setError("Failed to write recording metadata.");
    return false;
  }

  finishedMeta = activeMeta;
  finishedReady = true;
  Serial.printf("Recording saved: %s (%lu ms, %u bytes)\n",
                activeMeta.clientRecordingId.c_str(),
                static_cast<unsigned long>(activeMeta.durationMs),
                static_cast<unsigned>(activeMeta.fileSizeBytes));
  return true;
}

bool shouldAutoStop() {
  if (!fileOpen) {
    return false;
  }
  // Wall-clock time can jump decades forward when NTP syncs mid-recording,
  // so the max-duration check must use the monotonic millis() clock.
  if (millis() - recordStartMillis > SB_MAX_RECORD_SECONDS * 1000UL) {
    return true;
  }
  if (sbRecorderFreeBytes() < SB_STORAGE_LOW_WATER_BYTES) {
    return true;
  }
  return false;
}

bool fileNameEndsWith(const String &name, const char *suffix) {
  return name.endsWith(suffix);
}

String fileNameOnly(const String &path) {
  int slash = path.lastIndexOf('/');
  return slash >= 0 ? path.substring(slash + 1) : path;
}

String clientIdFromWavName(const String &name) {
  String file = fileNameOnly(name);
  if (!file.endsWith(".wav")) {
    return "";
  }
  file.remove(file.length() - 4);
  return file;
}

}  // namespace

bool sbRecorderBegin() {
  if (!LittleFS.exists(kRecDir)) {
    LittleFS.mkdir(kRecDir);
  }

  ringSize = psramFound() ? SB_REC_RING_BYTES_PSRAM : SB_REC_RING_BYTES_INTERNAL;
  ring = static_cast<uint8_t *>(heap_caps_malloc(ringSize, MALLOC_CAP_8BIT | (psramFound() ? MALLOC_CAP_SPIRAM : MALLOC_CAP_INTERNAL)));
  if (!ring) {
    ringSize = SB_REC_RING_BYTES_INTERNAL;
    ring = static_cast<uint8_t *>(heap_caps_malloc(ringSize, MALLOC_CAP_8BIT | MALLOC_CAP_INTERNAL));
  }
  if (!ring) {
    setError("Could not allocate recording ring buffer.");
    return false;
  }

  micI2S.setPins(SB_PIN_MIC_SCK, SB_PIN_MIC_WS, -1, SB_PIN_MIC_SD);
  if (!micI2S.begin(I2S_MODE_STD, SB_AUDIO_SAMPLE_RATE, I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_MONO, SB_MIC_SLOT_MASK)) {
    setError("Failed to initialize microphone I2S.");
    return false;
  }

  BaseType_t ok = xTaskCreatePinnedToCore(captureTask, "sb_i2s_rx", 4096, nullptr, 2, &captureTaskHandle, 1);
  if (ok != pdPASS) {
    setError("Could not start microphone capture task.");
    return false;
  }

  Serial.printf("Recorder ready. Ring buffer: %u bytes.\n", static_cast<unsigned>(ringSize));
  return true;
}

String sbRecorderNewClientId() {
  time_t now = time(nullptr);
  struct tm utc;
  gmtime_r(&now, &utc);
  char stamp[24];
  strftime(stamp, sizeof(stamp), "%Y%m%d_%H%M%S", &utc);
  return String("rec_local_") + stamp + "_" + sbIdentityRandomHex(3);
}

bool sbRecorderStart(const String &clientRecordingId, const String &startedAt, time_t startedEpoch) {
  if (fileOpen || captureEnabled) {
    setError("Recorder is already active.");
    return false;
  }

  activeMeta = SbRecordingMeta{};
  activeMeta.clientRecordingId = clientRecordingId;
  activeMeta.wavPath = wavPathFor(clientRecordingId);
  activeMeta.metaPath = metaPathFor(clientRecordingId);
  activeMeta.startedAt = startedAt;
  activeMeta.startedEpoch = startedEpoch;
  activeMeta.endedAt = startedAt;
  activeMeta.endedEpoch = startedEpoch;

  LittleFS.remove(activeMeta.wavPath);
  LittleFS.remove(activeMeta.metaPath);

  wavFile = LittleFS.open(activeMeta.wavPath, FILE_WRITE);
  if (!wavFile) {
    setError("Failed to open WAV file for writing.");
    return false;
  }
  if (!writePlaceholderHeader(wavFile)) {
    wavFile.close();
    setError("Failed to write WAV header.");
    return false;
  }

  ringHead = 0;
  ringTail = 0;
  droppedBytes = 0;
  dataBytesWritten = 0;
  recordStartMillis = millis();
  stopRequested = false;
  stopInterrupted = false;
  finishedReady = false;
  fileOpen = true;
  captureEnabled = true;
  return true;
}

void sbRecorderRequestStop(bool interrupted) {
  if (!fileOpen) {
    return;
  }
  stopInterrupted = interrupted;
  captureEnabled = false;
  stopRequested = true;
}

bool sbRecorderPump() {
  if (!fileOpen) {
    return false;
  }

  if (shouldAutoStop()) {
    stopInterrupted = false;
    captureEnabled = false;
    stopRequested = true;
  }

  uint8_t buffer[kPumpChunkBytes];
  size_t count = ringPopBytes(buffer, sizeof(buffer));
  if (count > 0) {
    size_t written = wavFile.write(buffer, count);
    dataBytesWritten += written;
    if (written != count) {
      setError("Short write while recording.");
      sbRecorderRequestStop(true);
    }
    return true;
  }

  if (stopRequested && ringAvailable() == 0) {
    finalizeActiveRecording();
    return true;
  }

  return false;
}

bool sbRecorderIsRecording() {
  return fileOpen && !stopRequested;
}

bool sbRecorderFinishedAvailable() {
  return finishedReady;
}

bool sbRecorderPopFinished(SbRecordingMeta &meta) {
  if (!finishedReady) {
    return false;
  }
  meta = finishedMeta;
  finishedReady = false;
  return true;
}

void sbRecorderSalvageQueue() {
  if (!LittleFS.exists(kRecDir)) {
    LittleFS.mkdir(kRecDir);
    return;
  }

  File root = LittleFS.open(kRecDir);
  if (!root || !root.isDirectory()) {
    return;
  }

  File entry = root.openNextFile();
  while (entry) {
    String path = entry.path();
    size_t size = entry.size();
    bool isWav = fileNameEndsWith(path, ".wav");
    entry.close();

    if (isWav) {
      String clientId = clientIdFromWavName(path);
      String metaPath = metaPathFor(clientId);
      size_t dataBytes = size > kWavHeaderBytes ? size - kWavHeaderBytes : 0;
      uint32_t durationMs = durationFromDataBytes(dataBytes);

      if (durationMs < SB_MIN_RECORD_MS) {
        LittleFS.remove(path);
        LittleFS.remove(metaPath);
      } else if (!LittleFS.exists(metaPath)) {
        patchWavHeader(path, dataBytes);
        File file = LittleFS.open(path, FILE_READ);
        SbRecordingMeta meta;
        meta.clientRecordingId = clientId;
        meta.wavPath = path;
        meta.metaPath = metaPath;
        meta.fileSizeBytes = size;
        meta.durationMs = durationMs;
        meta.sha256 = file ? sbSha256HexFile(file) : "";
        if (file) {
          file.close();
        }
        meta.startedEpoch = time(nullptr);
        meta.endedEpoch = meta.startedEpoch;
        meta.startedAt = sbIdentityIsoNow(meta.startedEpoch);
        meta.endedAt = meta.startedAt;
        meta.interrupted = true;
        sbRecorderWriteMeta(meta);
        Serial.printf("Salvaged interrupted recording: %s\n", clientId.c_str());
      }
    }

    entry = root.openNextFile();
  }
  root.close();
}

size_t sbRecorderQueuedCount() {
  size_t count = 0;
  File root = LittleFS.open(kRecDir);
  if (!root || !root.isDirectory()) {
    return 0;
  }

  File entry = root.openNextFile();
  while (entry) {
    String path = entry.path();
    if (fileNameEndsWith(path, ".json")) {
      count++;
    }
    entry.close();
    entry = root.openNextFile();
  }
  root.close();
  return count;
}

size_t sbRecorderFreeBytes() {
  return LittleFS.totalBytes() > LittleFS.usedBytes() ? LittleFS.totalBytes() - LittleFS.usedBytes() : 0;
}

bool sbRecorderFindReadyMeta(SbRecordingMeta &meta, time_t now) {
  File root = LittleFS.open(kRecDir);
  if (!root || !root.isDirectory()) {
    return false;
  }

  File entry = root.openNextFile();
  while (entry) {
    String path = entry.path();
    entry.close();

    if (fileNameEndsWith(path, ".json")) {
      SbRecordingMeta candidate;
      if (sbRecorderReadMeta(path, candidate) && (candidate.retryNotBefore == 0 || candidate.retryNotBefore <= now)) {
        meta = candidate;
        root.close();
        return true;
      }
    }
    entry = root.openNextFile();
  }
  root.close();
  return false;
}

bool sbRecorderReadMeta(const String &metaPath, SbRecordingMeta &meta) {
  File file = LittleFS.open(metaPath, FILE_READ);
  if (!file) {
    return false;
  }

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, file);
  file.close();
  if (err) {
    Serial.printf("Could not parse %s: %s\n", metaPath.c_str(), err.c_str());
    return false;
  }

  meta = SbRecordingMeta{};
  meta.clientRecordingId = doc["client_recording_id"].as<String>();
  meta.wavPath = doc["wav_path"].as<String>();
  meta.metaPath = metaPath;
  meta.startedAt = doc["started_at"].as<String>();
  meta.endedAt = doc["ended_at"].as<String>();
  meta.startedEpoch = doc["started_epoch"] | 0;
  meta.endedEpoch = doc["ended_epoch"] | 0;
  meta.durationMs = doc["duration_ms"] | 0;
  meta.fileSizeBytes = doc["file_size_bytes"] | 0;
  meta.sha256 = doc["sha256"].as<String>();
  meta.interrupted = doc["interrupted"] | false;
  meta.consecutiveFailures = doc["consecutive_failures"] | 0;
  meta.retryNotBefore = doc["retry_not_before_epoch"] | 0;

  if (meta.wavPath.length() == 0 && meta.clientRecordingId.length() > 0) {
    meta.wavPath = wavPathFor(meta.clientRecordingId);
  }

  return meta.clientRecordingId.length() > 0 && meta.wavPath.length() > 0;
}

bool sbRecorderWriteMeta(const SbRecordingMeta &meta) {
  File file = LittleFS.open(meta.metaPath, FILE_WRITE);
  if (!file) {
    return false;
  }

  JsonDocument doc;
  doc["client_recording_id"] = meta.clientRecordingId;
  doc["wav_path"] = meta.wavPath;
  doc["started_at"] = meta.startedAt;
  doc["ended_at"] = meta.endedAt;
  doc["started_epoch"] = static_cast<int64_t>(meta.startedEpoch);
  doc["ended_epoch"] = static_cast<int64_t>(meta.endedEpoch);
  doc["duration_ms"] = meta.durationMs;
  doc["file_size_bytes"] = static_cast<uint64_t>(meta.fileSizeBytes);
  doc["sha256"] = meta.sha256;
  doc["interrupted"] = meta.interrupted;
  doc["consecutive_failures"] = meta.consecutiveFailures;
  doc["retry_not_before_epoch"] = static_cast<int64_t>(meta.retryNotBefore);

  bool ok = serializeJson(doc, file) > 0;
  file.close();
  return ok;
}

bool sbRecorderRestampStale(SbRecordingMeta &meta, time_t now) {
  if (meta.startedEpoch >= SB_MIN_VALID_EPOCH || now < SB_MIN_VALID_EPOCH) {
    return false;
  }
  meta.endedEpoch = now;
  meta.startedEpoch = now - meta.durationMs / 1000;
  meta.startedAt = sbIdentityIsoNow(meta.startedEpoch);
  meta.endedAt = sbIdentityIsoNow(meta.endedEpoch);
  return sbRecorderWriteMeta(meta);
}

bool sbRecorderUpdateRetry(const SbRecordingMeta &meta, uint32_t failures, time_t retryNotBefore) {
  SbRecordingMeta updated = meta;
  updated.consecutiveFailures = failures;
  updated.retryNotBefore = retryNotBefore;
  return sbRecorderWriteMeta(updated);
}

bool sbRecorderDeleteLocal(const SbRecordingMeta &meta) {
  bool wavOk = !LittleFS.exists(meta.wavPath) || LittleFS.remove(meta.wavPath);
  bool metaOk = !LittleFS.exists(meta.metaPath) || LittleFS.remove(meta.metaPath);
  return wavOk && metaOk;
}

String sbRecorderLastError() {
  return lastError;
}

size_t sbRecorderDroppedBytes() {
  return droppedBytes;
}
