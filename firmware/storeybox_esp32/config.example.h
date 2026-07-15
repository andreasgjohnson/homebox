#pragma once

// Copy this file to config.h and fill in your Supabase project.

// Wi-Fi credentials are provisioned from the Storeybox app over BLE and
// stored in NVS. The defines below are an OPTIONAL bench convenience: when
// present they seed NVS once, only if no credentials are stored yet.
// Leave them commented out for anything that ships.
// #define SB_WIFI_SSID "your-wifi-name"
// #define SB_WIFI_PASSWORD "your-wifi-password"

// Use just the host, not the full function URL.
// Example: "abcdefghijklmno.supabase.co"
#define SB_SUPABASE_HOST "your-project.supabase.co"

// Development default. Set to 0 and provide SB_CA_CERT for production.
#define SB_TLS_INSECURE 1
// #define SB_CA_CERT "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----\n"

// Classic ESP32 DevKit wiring from the firmware README.
#define SB_PIN_MIC_SCK 26
#define SB_PIN_MIC_WS 25
#define SB_PIN_MIC_SD 33

#define SB_PIN_SPK_BCLK 27
#define SB_PIN_SPK_LRC 14
#define SB_PIN_SPK_DIN 13

#define SB_PIN_LED_RING 4
#define SB_LED_RING_COUNT 16

#define SB_PIN_BUTTON 32
#define SB_BUTTON_ACTIVE_LOW 1

// APIELE 16mm momentary button LED. See README for the low-side wiring note.
#define SB_PIN_BUTTON_LED 21
#define SB_BUTTON_LED_ACTIVE_LOW 1

// Built-in DevKit LED fallback when SB_ENABLE_LED_RING is 0.
#define SB_PIN_FALLBACK_LED 2
