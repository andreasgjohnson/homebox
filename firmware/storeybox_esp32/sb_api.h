#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>
#include <FS.h>

struct SbApiResult {
  bool ok = false;
  int status = 0;
  String body;
  String error;
};

struct SbPairingCode {
  String code;
  String uri;
  String expiresAt;
};

struct SbUploadLease {
  String bucket;
  String path;
  String signedUrl;
  String contentType;
  String sha256;
};

struct SbRecordingStartResult {
  String sessionId;
};

struct SbRecordingCompleteResult {
  String sessionId;
  String storeyId;
  SbUploadLease upload;
};

struct SbUploadCompleteResult {
  bool safeToDeleteLocal = false;
};

bool sbApiPost(const String &routePath, JsonDocument &doc, SbApiResult &result);

bool sbApiHello(bool &paired);
bool sbApiIssuePairingCode(SbPairingCode &pairingCode);
bool sbApiHeartbeat(const String &state, const String &activeSessionId, size_t freeBytes, size_t queuedRecordings, bool &paired);
bool sbApiRecordingStart(const String &clientRecordingId, const String &startedAt, SbRecordingStartResult &out);
bool sbApiRecordingComplete(
  const String &clientRecordingId,
  const String &sessionId,
  const String &endedAt,
  uint32_t durationMs,
  size_t fileSizeBytes,
  const String &sha256,
  bool interrupted,
  SbRecordingCompleteResult &out
);
bool sbApiRefreshUploadUrl(const String &sessionId, const String &sha256, SbUploadLease &upload);
bool sbApiUploadFile(const SbUploadLease &upload, File &file, size_t fileSizeBytes);
bool sbApiUploadComplete(const String &sessionId, const SbUploadLease &upload, size_t fileSizeBytes, const String &sha256, SbUploadCompleteResult &out);
bool sbApiSyncComplete(const String &sessionId, bool localCopyDeleted);
bool sbApiReportError(const String &severity, const String &message, const String &recordingSessionId = "");
