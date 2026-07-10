#pragma once

#include <Arduino.h>
#include <FS.h>

struct SbRecordingMeta {
  String clientRecordingId;
  String wavPath;
  String metaPath;
  String startedAt;
  String endedAt;
  time_t startedEpoch = 0;
  time_t endedEpoch = 0;
  uint32_t durationMs = 0;
  size_t fileSizeBytes = 0;
  String sha256;
  bool interrupted = false;
  uint32_t consecutiveFailures = 0;
  time_t retryNotBefore = 0;
};

bool sbRecorderBegin();
String sbRecorderNewClientId();

bool sbRecorderStart(const String &clientRecordingId, const String &startedAt, time_t startedEpoch);
void sbRecorderRequestStop(bool interrupted = false);
bool sbRecorderPump();
bool sbRecorderIsRecording();
bool sbRecorderFinishedAvailable();
bool sbRecorderPopFinished(SbRecordingMeta &meta);

void sbRecorderSalvageQueue();
size_t sbRecorderQueuedCount();
size_t sbRecorderFreeBytes();
bool sbRecorderFindReadyMeta(SbRecordingMeta &meta, time_t now);
bool sbRecorderReadMeta(const String &metaPath, SbRecordingMeta &meta);
bool sbRecorderWriteMeta(const SbRecordingMeta &meta);
bool sbRecorderRestampStale(SbRecordingMeta &meta, time_t now);
bool sbRecorderUpdateRetry(const SbRecordingMeta &meta, uint32_t failures, time_t retryNotBefore);
bool sbRecorderDeleteLocal(const SbRecordingMeta &meta);

String sbRecorderLastError();
size_t sbRecorderDroppedBytes();
