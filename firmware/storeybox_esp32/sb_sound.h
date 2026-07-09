#pragma once

#include <Arduino.h>

enum SbChime {
  SB_CHIME_START,
  SB_CHIME_STOP,
  SB_CHIME_PAIRED,
  SB_CHIME_ERROR
};

void sbSoundBegin();
void sbSoundPlay(SbChime chime);

