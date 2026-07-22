#pragma once

#include <Arduino.h>

// Minimal WS2812 driver, bit-banged with the cycle counter instead of the
// RMT peripheral. The RMT driver costs ~1.9 KB of IRAM, which the image
// cannot spare once BLE provisioning joins Wi-Fi + BT; see the IRAM note in
// the firmware README. Only supports GPIO 0-31.

void sbWs2812Begin(uint8_t pin, uint16_t pixelCount, uint8_t brightness);
void sbWs2812SetPixel(uint16_t index, uint8_t r, uint8_t g, uint8_t b);
void sbWs2812Clear();
void sbWs2812Show();
