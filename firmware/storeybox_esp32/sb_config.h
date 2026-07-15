#pragma once

#if __has_include("config.h")
#include "config.h"
#else
#error "Missing firmware/storeybox_esp32/config.h. Copy config.example.h to config.h and fill in Wi-Fi/Supabase settings."
#endif

// Wi-Fi credentials are never compiled in. They arrive over BLE
// provisioning and live in NVS.

#ifndef SB_SUPABASE_HOST
#error "SB_SUPABASE_HOST must be set in config.h."
#endif

#ifndef SB_BOX_API_FUNCTION_PATH
#define SB_BOX_API_FUNCTION_PATH "/functions/v1/box-api"
#endif

#ifndef SB_FIRMWARE_VERSION
#define SB_FIRMWARE_VERSION "storeybox-esp32-0.1.0"
#endif

#ifndef SB_TLS_INSECURE
#define SB_TLS_INSECURE 1
#endif

#ifndef SB_CA_CERT
#define SB_CA_CERT ""
#endif

#ifndef SB_ENABLE_LED_RING
#define SB_ENABLE_LED_RING 1
#endif

#ifndef SB_ENABLE_SPEAKER
#define SB_ENABLE_SPEAKER 1
#endif

#ifndef SB_PIN_MIC_SCK
#define SB_PIN_MIC_SCK 26
#endif

#ifndef SB_PIN_MIC_WS
#define SB_PIN_MIC_WS 25
#endif

#ifndef SB_PIN_MIC_SD
#define SB_PIN_MIC_SD 33
#endif

#ifndef SB_MIC_SLOT_MASK
#define SB_MIC_SLOT_MASK I2S_STD_SLOT_LEFT
#endif

#ifndef SB_PIN_SPK_BCLK
#define SB_PIN_SPK_BCLK 27
#endif

#ifndef SB_PIN_SPK_LRC
#define SB_PIN_SPK_LRC 14
#endif

#ifndef SB_PIN_SPK_DIN
#define SB_PIN_SPK_DIN 13
#endif

#ifndef SB_PIN_LED_RING
#define SB_PIN_LED_RING 4
#endif

#ifndef SB_LED_RING_COUNT
#define SB_LED_RING_COUNT 16
#endif

#ifndef SB_LED_RING_BRIGHTNESS
#define SB_LED_RING_BRIGHTNESS 48
#endif

#ifndef SB_PIN_FALLBACK_LED
#define SB_PIN_FALLBACK_LED 2
#endif

#ifndef SB_PIN_BUTTON
#define SB_PIN_BUTTON 32
#endif

#ifndef SB_BUTTON_ACTIVE_LOW
#define SB_BUTTON_ACTIVE_LOW 1
#endif

#ifndef SB_PIN_BUTTON_LED
#define SB_PIN_BUTTON_LED 21
#endif

#ifndef SB_BUTTON_LED_ACTIVE_LOW
#define SB_BUTTON_LED_ACTIVE_LOW 1
#endif

#ifndef SB_AUDIO_SAMPLE_RATE
#define SB_AUDIO_SAMPLE_RATE 16000
#endif

#ifndef SB_AUDIO_BITS_PER_SAMPLE
#define SB_AUDIO_BITS_PER_SAMPLE 16
#endif

#ifndef SB_AUDIO_CHANNELS
#define SB_AUDIO_CHANNELS 1
#endif

#ifndef SB_MIC_SHIFT
#define SB_MIC_SHIFT 14
#endif

#ifndef SB_MIC_GAIN
#define SB_MIC_GAIN 1
#endif

#ifndef SB_MAX_RECORD_SECONDS
#define SB_MAX_RECORD_SECONDS 180
#endif

#ifndef SB_MIN_RECORD_MS
#define SB_MIN_RECORD_MS 300
#endif

// Epochs below this (2023-11-14) mean the RTC has not been NTP-synced yet.
#ifndef SB_MIN_VALID_EPOCH
#define SB_MIN_VALID_EPOCH 1700000000
#endif

#ifndef SB_STORAGE_LOW_WATER_BYTES
#define SB_STORAGE_LOW_WATER_BYTES 98304
#endif

#ifndef SB_REC_RING_BYTES_INTERNAL
#define SB_REC_RING_BYTES_INTERNAL 49152
#endif

#ifndef SB_REC_RING_BYTES_PSRAM
#define SB_REC_RING_BYTES_PSRAM 262144
#endif

#ifndef SB_WIFI_CONNECT_TIMEOUT_MS
#define SB_WIFI_CONNECT_TIMEOUT_MS 20000
#endif

// Proof of possession for BLE provisioning (security1). Shared dev value;
// production units should carry a per-device PoP printed on the box.
#ifndef SB_PROV_POP
#define SB_PROV_POP "storeybox"
#endif

// The app scans for BLE devices with this name prefix during setup.
#ifndef SB_PROV_SERVICE_PREFIX
#define SB_PROV_SERVICE_PREFIX "STOREYBOX-"
#endif

// Custom protocomm endpoint that hands the pairing code to the app over the
// provisioning session once Wi-Fi is up. Mirrored in lib/boxSetup.ts.
#ifndef SB_PROV_PAIR_ENDPOINT
#define SB_PROV_PAIR_ENDPOINT "sb-pair"
#endif

// How long the provisioning session stays open after Wi-Fi setup succeeds,
// waiting for the app to collect the pairing code over BLE. When it lapses
// the session closes and the serial pairing-code path still applies.
#ifndef SB_PROV_PAIR_LINGER_MS
#define SB_PROV_PAIR_LINGER_MS 120000
#endif

// Delay between serving the pairing payload on the sb-pair endpoint and
// closing the provisioning session, so the response reaches the phone.
#ifndef SB_PROV_STOP_DELAY_MS
#define SB_PROV_STOP_DELAY_MS 2000
#endif

// Holding the button this long clears Wi-Fi credentials and reboots into
// setup mode. Must stay longer than the 5s pairing-code hold.
#ifndef SB_WIFI_RESET_HOLD_MS
#define SB_WIFI_RESET_HOLD_MS 10000
#endif

#ifndef SB_HTTP_TIMEOUT_MS
#define SB_HTTP_TIMEOUT_MS 20000
#endif

#ifndef SB_HEARTBEAT_SECONDS
#define SB_HEARTBEAT_SECONDS 60
#endif

#ifndef SB_PAIRING_CODE_TTL_SECONDS
#define SB_PAIRING_CODE_TTL_SECONDS 600
#endif

#ifndef SB_SYNC_INITIAL_BACKOFF_MS
#define SB_SYNC_INITIAL_BACKOFF_MS 15000
#endif

#ifndef SB_SYNC_MAX_BACKOFF_MS
#define SB_SYNC_MAX_BACKOFF_MS 300000
#endif

#ifndef SB_ERROR_REPORT_AFTER_FAILURES
#define SB_ERROR_REPORT_AFTER_FAILURES 5
#endif

#ifndef SB_NET_TASK_STACK_WORDS
#define SB_NET_TASK_STACK_WORDS 16384
#endif

#ifndef SB_NET_TASK_CORE
#define SB_NET_TASK_CORE 0
#endif
