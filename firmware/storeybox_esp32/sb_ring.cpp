#include "sb_ring.h"

#include "sb_config.h"

#include <math.h>

#if SB_ENABLE_LED_RING
#include "sb_ws2812.h"
#endif

namespace {

SbRingMode currentMode = SB_RING_IDLE;
uint32_t errorUntil = 0;

#if SB_ENABLE_LED_RING
void fill(uint8_t r, uint8_t g, uint8_t b) {
  for (uint16_t i = 0; i < SB_LED_RING_COUNT; i++) {
    sbWs2812SetPixel(i, r, g, b);
  }
  sbWs2812Show();
}
#endif

}  // namespace

void sbRingBegin() {
#if SB_ENABLE_LED_RING
  sbWs2812Begin(SB_PIN_LED_RING, SB_LED_RING_COUNT, SB_LED_RING_BRIGHTNESS);
  fill(0, 0, 0);
#else
  pinMode(SB_PIN_FALLBACK_LED, OUTPUT);
  digitalWrite(SB_PIN_FALLBACK_LED, LOW);
#endif
}

void sbRingSetMode(SbRingMode mode) {
  currentMode = mode;
}

SbRingMode sbRingMode() {
  return currentMode;
}

void sbRingFlashError() {
  errorUntil = millis() + 1600;
  currentMode = SB_RING_ERROR;
}

void sbRingUpdate() {
  uint32_t now = millis();
  SbRingMode mode = currentMode;
  if (mode == SB_RING_ERROR && now > errorUntil) {
    mode = SB_RING_IDLE;
    currentMode = SB_RING_IDLE;
  }

#if SB_ENABLE_LED_RING
  if (mode == SB_RING_IDLE) {
    fill(0, 0, 0);
    return;
  }

  if (mode == SB_RING_RECORDING) {
    fill(255, 116, 44);
    return;
  }

  if (mode == SB_RING_UNPAIRED) {
    float phase = (now % 2200) / 2200.0f;
    float wave = 0.5f + 0.5f * sinf(phase * TWO_PI);
    uint8_t amber = static_cast<uint8_t>(18 + wave * 74);
    fill(amber, amber / 2, 2);
    return;
  }

  if (mode == SB_RING_SYNCING) {
    sbWs2812Clear();
    uint16_t head = (now / 90) % SB_LED_RING_COUNT;
    for (uint16_t i = 0; i < SB_LED_RING_COUNT; i++) {
      uint16_t distance = (head + SB_LED_RING_COUNT - i) % SB_LED_RING_COUNT;
      if (distance < 4) {
        uint8_t level = 72 - distance * 18;
        sbWs2812SetPixel(i, 8, level, 76);
      }
    }
    sbWs2812Show();
    return;
  }

  if (mode == SB_RING_ERROR) {
    bool on = ((now / 140) % 2) == 0;
    if (on) {
      fill(180, 0, 0);
    } else {
      fill(0, 0, 0);
    }
    return;
  }
#else
  bool on = false;
  if (mode == SB_RING_RECORDING) {
    on = true;
  } else if (mode == SB_RING_UNPAIRED) {
    on = ((now / 700) % 2) == 0;
  } else if (mode == SB_RING_SYNCING) {
    on = ((now / 180) % 2) == 0;
  } else if (mode == SB_RING_ERROR) {
    on = ((now / 120) % 2) == 0;
  }
  digitalWrite(SB_PIN_FALLBACK_LED, on ? HIGH : LOW);
#endif
}
