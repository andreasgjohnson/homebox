# Storeybox ESP32 Firmware

Arduino firmware for a classic ESP32-WROOM DevKit Storeybox. It pairs through
the `box-api` Edge Function, records PCM WAV from an INMP441 microphone, uploads
through Supabase signed storage URLs, and keeps local recordings on LittleFS
until the backend says they are safe to delete.

## Hardware

| Part | ESP32 pin | Notes |
|---|---:|---|
| INMP441 SCK | GPIO 26 | I2S microphone bit clock |
| INMP441 WS/LRCL | GPIO 25 | I2S word select |
| INMP441 SD | GPIO 33 | I2S microphone data |
| INMP441 VDD/GND | 3V3/GND | Do not power from 5V |
| MAX98357A BCLK | GPIO 27 | I2S speaker bit clock |
| MAX98357A LRC | GPIO 14 | I2S word select |
| MAX98357A DIN | GPIO 13 | I2S speaker data |
| MAX98357A VIN/GND | 5V/GND | Drives the 2 inch speaker |
| WS2812 ring DIN | GPIO 4 | 16 LEDs by default |
| WS2812 ring 5V/GND | 5V/GND | Keep grounds common |
| Momentary switch | GPIO 32 + GND | `INPUT_PULLUP`, active low |
| Button LED + | 5V | APIELE angel-eye LED |
| Button LED - | GPIO 21 | GPIO sinks current, active low |

The APIELE LED is rated for 12V, but works as an indicator from the DevKit 5V
pin with the button's internal resistor. If your button module differs, verify
its LED current before wiring it to a GPIO sink.

All pins can be overridden in `config.h`.

## Arduino Setup

1. Install Arduino CLI or Arduino IDE.
2. Install ESP32 Arduino core 3.x and select `esp32:esp32:esp32`.
3. Install Library Manager dependencies:

```sh
arduino-cli lib install ArduinoJson
arduino-cli lib install "Adafruit NeoPixel"
```

4. Copy `config.example.h` to `config.h` and fill in:

```cpp
#define SB_WIFI_SSID "..."
#define SB_WIFI_PASSWORD "..."
#define SB_SUPABASE_HOST "your-project.supabase.co"
```

For development, `SB_TLS_INSECURE` defaults to `1`. For production, set it to
`0` and provide `SB_CA_CERT`.

## Flash Partition Scheme

WAV audio is about 32 KB per second at 16 kHz, 16-bit mono. Use a partition
scheme with a large LittleFS/SPIFFS area. In Arduino IDE, choose a "No OTA"
scheme such as `2MB APP / 2MB SPIFFS` when available. With a 2 MB filesystem,
expect roughly one minute of retained audio after filesystem overhead.

## Provisioning

On first boot, the ESP32 generates a P-256 keypair in NVS and prints ready-to-run
SQL on the serial monitor. Paste that SQL into the Supabase SQL editor for the
project whose host is in `config.h`.

The SQL inserts:

- `public.boxes.public_device_id`
- `public.box_credentials.key_id`
- `credential_type = 'ecdsa_p256'`
- the base64 SPKI public key

The private key never leaves the ESP32.

## Pairing and Recording

1. Flash the firmware and open the serial monitor at 115200 baud.
2. Paste the provisioning SQL into Supabase.
3. Reboot the ESP32. It connects to Wi-Fi, syncs NTP, and prints a 6-digit
   pairing code.
4. In the app, open Your Box and claim the code.
5. Press the record button once to start a Storey, speak, then press again to
   stop.
6. Watch serial logs for `recordings/complete`, `PUT`, `upload-complete`, and
   `Synced recording`.

Short press toggles recording. Holding the button for five seconds while idle
requests a fresh pairing code. The cached paired flag lets an already-paired Box
record after reboot even when Wi-Fi is temporarily unavailable.

## Status Lights

| State | WS2812 ring | Button LED |
|---|---|---|
| Unpaired/pairing | Amber breathing | Slow blink |
| Recording | Solid warm | Solid on |
| Syncing | Rotating teal comet | Off |
| Idle | Off | Off |
| Error | Red flash | State dependent |

If `SB_ENABLE_LED_RING` is set to `0`, GPIO 2 is used as a simple fallback LED.

## Troubleshooting

- `Signature timestamp is outside the allowed clock skew`: NTP did not sync.
  Check Wi-Fi and DNS.
- `Unknown or inactive device credential`: the provisioning SQL was not run for
  this device, or the wrong Supabase host is configured.
- Pairing code appears but the app cannot claim it: verify the deployed
  `box-api` function and Supabase Auth session in the app.
- WAV is silent or noisy: confirm INMP441 L/R slot wiring. Try overriding
  `SB_MIC_SLOT_MASK` to `I2S_STD_SLOT_RIGHT`, and tune `SB_MIC_SHIFT` /
  `SB_MIC_GAIN`.
- Upload fails after recording: the Box keeps the WAV and retries with
  exponential backoff. After repeated failures it reports a warning to
  `/v1/errors`.

## Compile

```sh
arduino-cli compile --fqbn esp32:esp32:esp32 firmware/storeybox_esp32
```

