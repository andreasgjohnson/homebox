#include "sb_api.h"

#include "sb_config.h"
#include "sb_identity.h"

#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

namespace {

String apiBaseUrl() {
  String host = String(SB_SUPABASE_HOST);
  host.trim();
  while (host.endsWith("/")) {
    host.remove(host.length() - 1);
  }

  String base;
  if (host.startsWith("http://") || host.startsWith("https://")) {
    base = host;
  } else {
    base = "https://" + host;
  }

  String functionPath = String(SB_BOX_API_FUNCTION_PATH);
  if (!functionPath.startsWith("/")) {
    functionPath = "/" + functionPath;
  }
  while (functionPath.endsWith("/")) {
    functionPath.remove(functionPath.length() - 1);
  }

  return base + functionPath;
}

String apiUrl(const String &routePath) {
  return apiBaseUrl() + routePath;
}

void configureTls(WiFiClientSecure &client) {
#if SB_TLS_INSECURE
  client.setInsecure();
#else
  client.setCACert(SB_CA_CERT);
#endif
}

void addBaseFields(JsonDocument &doc) {
  const String requestId = sbIdentityRequestId();
  const String sentAt = sbIdentityIsoNow();
  doc["request_id"] = requestId;
  doc["box_id"] = sbIdentityBoxId();
  doc["sent_at"] = sentAt;
}

bool parseResponse(SbApiResult &api, JsonDocument &json) {
  DeserializationError err = deserializeJson(json, api.body);
  if (err) {
    api.error = String("JSON parse failed: ") + err.c_str();
    return false;
  }
  return true;
}

String jsonError(const JsonDocument &doc) {
  if (doc["error"].is<const char *>()) {
    return doc["error"].as<String>();
  }
  return "";
}

SbUploadLease readUpload(JsonVariantConst variant) {
  SbUploadLease upload;
  upload.bucket = variant["bucket"].as<String>();
  upload.path = variant["path"].as<String>();
  upload.signedUrl = variant["signed_url"].as<String>();
  upload.contentType = variant["headers"]["content-type"].as<String>();
  upload.sha256 = variant["headers"]["x-storeybox-sha256"].as<String>();
  return upload;
}

}  // namespace

bool sbApiPost(const String &routePath, JsonDocument &doc, SbApiResult &result) {
  result = SbApiResult{};

  if (!sbIdentityClockReady()) {
    result.error = "Clock is not synced; refusing to send signed request.";
    return false;
  }

  addBaseFields(doc);

  String body;
  serializeJson(doc, body);

  const String sentAt = doc["sent_at"].as<String>();
  const String nonce = sbIdentityNonce();
  const String digestHeader = "SHA-256=" + sbSha256Base64(reinterpret_cast<const uint8_t *>(body.c_str()), body.length());
  const String signingString = "POST\n" + routePath + "\n" + sentAt + "\n" + nonce + "\n" + digestHeader;

  String signature;
  if (!sbIdentitySign(signingString, signature)) {
    result.error = "Could not sign request.";
    return false;
  }

  WiFiClientSecure client;
  configureTls(client);

  HTTPClient http;
  http.setTimeout(SB_HTTP_TIMEOUT_MS);

  const String url = apiUrl(routePath);
  if (!http.begin(client, url)) {
    result.error = "HTTP begin failed.";
    return false;
  }

  const String authorization =
    "Storeybox-Signature box_id=\"" + sbIdentityBoxId() +
    "\", key_id=\"" + sbIdentityKeyId() +
    "\", ts=\"" + sentAt +
    "\", nonce=\"" + nonce +
    "\", sig=\"" + signature + "\"";

  http.addHeader("Content-Type", "application/json");
  http.addHeader("Digest", digestHeader);
  http.addHeader("Authorization", authorization);
  http.addHeader("Idempotency-Key", doc["request_id"].as<String>());

  result.status = http.POST(body);
  result.body = http.getString();
  result.ok = result.status >= 200 && result.status < 300;
  if (!result.ok) {
    JsonDocument errorDoc;
    if (deserializeJson(errorDoc, result.body) == DeserializationError::Ok) {
      result.error = jsonError(errorDoc);
    }
    if (result.error.isEmpty()) {
      result.error = "HTTP " + String(result.status);
    }
  }

  http.end();
  return result.ok;
}

bool sbApiHello(bool &paired) {
  JsonDocument doc;
  SbApiResult api;
  if (!sbApiPost("/v1/hello", doc, api)) {
    Serial.printf("hello failed: %s\n", api.error.c_str());
    return false;
  }

  JsonDocument response;
  if (!parseResponse(api, response)) {
    Serial.println(api.error);
    return false;
  }
  paired = response["paired"] | false;
  return true;
}

bool sbApiIssuePairingCode(SbPairingCode &pairingCode) {
  JsonDocument doc;
  doc["display_code_format"] = "numeric_6";
  doc["expires_in_seconds"] = SB_PAIRING_CODE_TTL_SECONDS;

  SbApiResult api;
  if (!sbApiPost("/v1/pairing-codes", doc, api)) {
    Serial.printf("pairing-code failed: %s\n", api.error.c_str());
    return false;
  }

  JsonDocument response;
  if (!parseResponse(api, response)) {
    Serial.println(api.error);
    return false;
  }

  pairingCode.code = response["pairing_code"].as<String>();
  pairingCode.uri = response["pairing_uri"].as<String>();
  pairingCode.expiresAt = response["expires_at"].as<String>();
  return pairingCode.code.length() > 0;
}

bool sbApiHeartbeat(const String &state, const String &activeSessionId, size_t freeBytes, size_t queuedRecordings, bool &paired) {
  JsonDocument doc;
  doc["observed_at"] = sbIdentityIsoNow();
  doc["state"] = state;
  doc["firmware_version"] = SB_FIRMWARE_VERSION;
  doc["power"] = "usb";
  if (activeSessionId.length() > 0) {
    doc["active_recording_session_id"] = activeSessionId;
  } else {
    doc["active_recording_session_id"] = nullptr;
  }

  JsonObject network = doc["network"].to<JsonObject>();
  network["type"] = "wifi";
  network["rssi"] = WiFi.RSSI();

  JsonObject storage = doc["storage"].to<JsonObject>();
  storage["free_bytes"] = static_cast<uint64_t>(freeBytes);
  storage["queued_recordings"] = static_cast<uint32_t>(queuedRecordings);

  SbApiResult api;
  if (!sbApiPost("/v1/heartbeat", doc, api)) {
    Serial.printf("heartbeat failed: %s\n", api.error.c_str());
    return false;
  }

  JsonDocument response;
  if (!parseResponse(api, response)) {
    Serial.println(api.error);
    return false;
  }

  paired = response["paired"] | false;
  return true;
}

bool sbApiRecordingStart(const String &clientRecordingId, const String &startedAt, SbRecordingStartResult &out) {
  JsonDocument doc;
  doc["client_recording_id"] = clientRecordingId;
  doc["started_at"] = startedAt;
  doc["trigger"] = "button";

  JsonObject audio = doc["audio"].to<JsonObject>();
  audio["container"] = "wav";
  audio["codec"] = "pcm_s16le";
  audio["sample_rate_hz"] = SB_AUDIO_SAMPLE_RATE;
  audio["channel_count"] = SB_AUDIO_CHANNELS;

  SbApiResult api;
  if (!sbApiPost("/v1/recordings/start", doc, api)) {
    Serial.printf("recordings/start failed: %s\n", api.error.c_str());
    return false;
  }

  JsonDocument response;
  if (!parseResponse(api, response)) {
    Serial.println(api.error);
    return false;
  }
  out.sessionId = response["recording_session_id"].as<String>();
  return out.sessionId.length() > 0;
}

bool sbApiRecordingComplete(
  const String &clientRecordingId,
  const String &sessionId,
  const String &endedAt,
  uint32_t durationMs,
  size_t fileSizeBytes,
  const String &sha256,
  bool interrupted,
  SbRecordingCompleteResult &out
) {
  JsonDocument doc;
  doc["client_recording_id"] = clientRecordingId;
  doc["recording_session_id"] = sessionId;
  doc["ended_at"] = endedAt;
  doc["duration_ms"] = durationMs;
  doc["file_size_bytes"] = static_cast<uint64_t>(fileSizeBytes);
  doc["sha256"] = sha256;
  doc["interrupted"] = interrupted;

  SbApiResult api;
  if (!sbApiPost("/v1/recordings/complete", doc, api)) {
    Serial.printf("recordings/complete failed: %s\n", api.error.c_str());
    return false;
  }

  JsonDocument response;
  if (!parseResponse(api, response)) {
    Serial.println(api.error);
    return false;
  }

  out.sessionId = response["recording_session_id"].as<String>();
  out.storeyId = response["storey_id"].as<String>();
  out.upload = readUpload(response["upload"]);
  return out.sessionId.length() > 0 && out.upload.signedUrl.length() > 0;
}

bool sbApiRefreshUploadUrl(const String &sessionId, const String &sha256, SbUploadLease &upload) {
  JsonDocument doc;
  doc["sha256"] = sha256;

  SbApiResult api;
  if (!sbApiPost("/v1/recordings/" + sessionId + "/upload-url", doc, api)) {
    Serial.printf("upload-url failed: %s\n", api.error.c_str());
    return false;
  }

  JsonDocument response;
  if (!parseResponse(api, response)) {
    Serial.println(api.error);
    return false;
  }

  upload = readUpload(response["upload"]);
  return upload.signedUrl.length() > 0;
}

bool sbApiUploadFile(const SbUploadLease &upload, File &file, size_t fileSizeBytes) {
  if (!file || upload.signedUrl.isEmpty()) {
    return false;
  }

  file.seek(0);

  WiFiClientSecure client;
  configureTls(client);

  HTTPClient http;
  http.setTimeout(SB_HTTP_TIMEOUT_MS);
  if (!http.begin(client, upload.signedUrl)) {
    Serial.println("upload HTTP begin failed.");
    return false;
  }

  if (upload.contentType.length() > 0) {
    http.addHeader("content-type", upload.contentType);
  } else {
    http.addHeader("content-type", "audio/wav");
  }
  if (upload.sha256.length() > 0) {
    http.addHeader("x-storeybox-sha256", upload.sha256);
  }

  int status = http.sendRequest("PUT", &file, fileSizeBytes);
  String body = http.getString();
  bool ok = status >= 200 && status < 300;
  if (!ok) {
    Serial.printf("upload PUT failed: HTTP %d %s\n", status, body.c_str());
  }
  http.end();
  file.seek(0);
  return ok;
}

bool sbApiUploadComplete(const String &sessionId, const SbUploadLease &upload, size_t fileSizeBytes, const String &sha256, SbUploadCompleteResult &out) {
  JsonDocument doc;
  JsonObject uploadJson = doc["upload"].to<JsonObject>();
  uploadJson["bucket"] = upload.bucket;
  uploadJson["path"] = upload.path;
  uploadJson["content_type"] = upload.contentType.length() > 0 ? upload.contentType : "audio/wav";
  uploadJson["file_size_bytes"] = static_cast<uint64_t>(fileSizeBytes);
  uploadJson["sha256"] = sha256;

  SbApiResult api;
  if (!sbApiPost("/v1/recordings/" + sessionId + "/upload-complete", doc, api)) {
    Serial.printf("upload-complete failed: %s\n", api.error.c_str());
    return false;
  }

  JsonDocument response;
  if (!parseResponse(api, response)) {
    Serial.println(api.error);
    return false;
  }
  out.safeToDeleteLocal = response["safe_to_delete_local"] | false;
  return true;
}

bool sbApiSyncComplete(const String &sessionId, bool localCopyDeleted) {
  JsonDocument doc;
  doc["local_copy_deleted"] = localCopyDeleted;

  SbApiResult api;
  if (!sbApiPost("/v1/recordings/" + sessionId + "/sync-complete", doc, api)) {
    Serial.printf("sync-complete failed: %s\n", api.error.c_str());
    return false;
  }
  return true;
}

bool sbApiReportError(const String &severity, const String &message, const String &recordingSessionId) {
  JsonDocument doc;
  doc["severity"] = severity;
  doc["message"] = message;
  if (recordingSessionId.length() > 0) {
    doc["recording_session_id"] = recordingSessionId;
  }

  SbApiResult api;
  if (!sbApiPost("/v1/errors", doc, api)) {
    Serial.printf("error report failed: %s\n", api.error.c_str());
    return false;
  }
  return true;
}
