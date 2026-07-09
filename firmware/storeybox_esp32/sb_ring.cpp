#include "sb_ring.h"

#include "sb_config.h"

#include <math.h>

#if SB_ENABLE_LED_RING
#include <Adafruit_NeoPixel.h>
Adafruit_NeoPixel pixels(SB_LED_RING_COUNT, SB_PIN_LED_RING, NEO_GRB + NEO_KHZ800);
#endif

namespace {

SbRingMode currentMode = SB_RING_IDLE;
uint32_t errorUntil = 0;

#if SB_ENABLE_LED_RING
uint32_t color(uint8_t r, uint8_t g, uint8_t b) {
  return pixels.Color(r, g, b);
}

void fill(uint32_t c) {
  for (uint16_t i = 0; i < SB_LED_RING_COUNT; i++) {
    pixels.setPixelColor(i, c);
  }
  pixels.show();
}
#endif

}  // namespace

void sbRingBegin() {
#if SB_ENABLE_LED_RING
  pixels.begin();
  pixels.setBrightness(SB_LED_RING_BRIGHTNESS);
  fill(0);
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
    fill(0);
    return;
  }

  if (mode == SB_RING_RECORDING) {
    fill(color(255, 116, 44));
    return;
  }

  if (mode == SB_RING_UNPAIRED) {
    float phase = (now % 2200) / 2200.0f;
    float wave = 0.5f + 0.5f * sinf(phase * TWO_PI);
    uint8_t amber = static_cast<uint8_t>(18 + wave * 74);
    fill(color(amber, amber / 2, 2));
    return;
  }

  if (mode == SB_RING_SYNCING) {
    pixels.clear();
    uint16_t head = (now / 90) % SB_LED_RING_COUNT;
    for (uint16_t i = 0; i < SB_LED_RING_COUNT; i++) {
      uint16_t distance = (head + SB_LED_RING_COUNT - i) % SB_LED_RING_COUNT;
      if (distance < 4) {
        uint8_t level = 72 - distance * 18;
        pixels.setPixelColor(i, color(8, level, 76));
      }
    }
    pixels.show();
    return;
  }

  if (mode == SB_RING_ERROR) {
    bool on = ((now / 140) % 2) == 0;
    fill(on ? color(180, 0, 0) : 0);
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
