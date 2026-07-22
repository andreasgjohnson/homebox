#pragma once

#include <Arduino.h>

enum SbRingMode {
  SB_RING_IDLE,
  SB_RING_SETUP,
  SB_RING_UNPAIRED,
  SB_RING_RECORDING,
  SB_RING_SYNCING,
  SB_RING_ERROR
};

void sbRingBegin();
void sbRingSetMode(SbRingMode mode);
SbRingMode sbRingMode();
void sbRingFlashError();
void sbRingUpdate();
