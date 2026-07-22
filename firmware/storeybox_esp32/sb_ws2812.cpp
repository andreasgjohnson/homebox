#include "sb_ws2812.h"

#include <soc/gpio_struct.h>

namespace {

constexpr uint16_t kMaxPixels = 64;

uint8_t gPin = 255;
uint16_t gCount = 0;
uint8_t gBrightness = 255;
uint8_t gFrame[kMaxPixels * 3];  // GRB order
uint32_t gLastShowUs = 0;
portMUX_TYPE gShowMux = portMUX_INITIALIZER_UNLOCKED;

// WS2812 bit timing at 800 kHz: a bit is 1.25 us; "0" holds the line high
// ~0.4 us, "1" ~0.8 us. Tolerances are ±150 ns, so the frame runs from IRAM
// (no flash-cache stalls) with interrupts disabled on this core.
void IRAM_ATTR sendFrame(const uint8_t *data, size_t bytes, uint32_t pinMask) {
  const uint32_t t0h = F_CPU / 2500000;
  const uint32_t t1h = F_CPU / 1250000;
  const uint32_t period = F_CPU / 800000;

  for (size_t i = 0; i < bytes; i++) {
    uint8_t value = data[i];
    for (int bit = 7; bit >= 0; bit--) {
      uint32_t high = (value & (1 << bit)) ? t1h : t0h;
      uint32_t start = xthal_get_ccount();
      GPIO.out_w1ts = pinMask;
      while (xthal_get_ccount() - start < high) {
      }
      GPIO.out_w1tc = pinMask;
      while (xthal_get_ccount() - start < period) {
      }
    }
  }
}

}  // namespace

void sbWs2812Begin(uint8_t pin, uint16_t pixelCount, uint8_t brightness) {
  gPin = pin;
  gCount = pixelCount > kMaxPixels ? kMaxPixels : pixelCount;
  gBrightness = brightness;
  memset(gFrame, 0, sizeof(gFrame));

  pinMode(pin, OUTPUT);
  digitalWrite(pin, LOW);
}

void sbWs2812SetPixel(uint16_t index, uint8_t r, uint8_t g, uint8_t b) {
  if (index >= gCount) {
    return;
  }

  uint16_t scale = gBrightness + 1;
  uint8_t *slot = &gFrame[index * 3];
  slot[0] = (g * scale) >> 8;
  slot[1] = (r * scale) >> 8;
  slot[2] = (b * scale) >> 8;
}

void sbWs2812Clear() {
  memset(gFrame, 0, gCount * 3);
}

void sbWs2812Show() {
  if (gPin > 31 || gCount == 0) {
    return;
  }

  // WS2812 latches on >50 us of idle line (280 us on some clones).
  while (micros() - gLastShowUs < 300) {
  }

  portENTER_CRITICAL(&gShowMux);
  sendFrame(gFrame, gCount * 3, 1UL << gPin);
  portEXIT_CRITICAL(&gShowMux);
  gLastShowUs = micros();
}
