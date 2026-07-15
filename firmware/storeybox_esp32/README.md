# Storeybox ESP32 Firmware

Arduino firmware for a classic ESP32-WROOM DevKit Storeybox. It gets its
Wi-Fi credentials from the Storeybox app over BLE, pairs through the
`box-api` Edge Function, records PCM WAV from an INMP441 microphone, uploads
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
2. Install ESP32 Arduino core 3.3.10 and select `esp32:esp32:esp32`. The
   core version is effectively pinned: the image leaves under 1 KB of IRAM
   headroom (see the IRAM note below), so verify any core upgrade with a
   compile before adopting it.
3. Install Library Manager dependencies:

```sh
arduino-cli lib install ArduinoJson
```

4. Copy `config.example.h` to `config.h` and fill in:

```cpp
#define SB_SUPABASE_HOST "your-project.supabase.co"
```

Wi-Fi credentials are never compiled in; they arrive over BLE during Wi-Fi
setup and persist in NVS across reflashes.

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

## Wi-Fi Setup

With no Wi-Fi credentials in NVS, the Box boots into setup mode: the ring
breathes a soft blue and the Box advertises over BLE as
`STOREYBOX-<last 4 of box id>` using ESP unified provisioning (security1;
the proof of possession is `SB_PROV_POP`, default `storeybox`). The
Storeybox app's "Set up your Box" flow sends the home network credentials
over the encrypted session; wrong-password and network-not-found failures
are reported back to the app and the Box keeps advertising so the app can
retry without a reboot. On the bench, Espressif's free "ESP BLE Prov" app
works too.

After Wi-Fi succeeds the session stays open (auto-stop is disabled) so the
custom `sb-pair` protocomm endpoint can hand over pairing: the Box requests
a pairing code from `box-api` once online and the app polls `sb-pair`,
reading `{"status":"pending"}` until the payload with `box_id`,
`pairing_code`, `pairing_uri`, and `expires_at` is ready (`error` means the
fetch failed and the app falls back to manual entry). The session closes a
couple of seconds after the payload is served, or after two minutes if
nobody asks. The same code is still printed on the serial monitor.

Credentials persist in NVS, so reflashing the sketch does not repeat setup.
Holding the button for ten seconds erases them and reboots into setup mode
(device identity and pairing are kept).

## Pairing and Recording

1. Flash the firmware and open the serial monitor at 115200 baud.
2. Paste the provisioning SQL into Supabase.
3. Complete Wi-Fi setup from the app if the ring is breathing blue. The app
   picks the 6-digit pairing code up over the same Bluetooth session and
   pre-fills it.
4. The Box syncs NTP and prints the same 6-digit pairing code on serial.
5. In the app, confirm the pre-filled code — or open Your Box and enter it
   by hand.
6. Press the record button once to start a Storey, speak, then press again to
   stop.
7. Watch serial logs for `recordings/complete`, `PUT`, `upload-complete`, and
   `Synced recording`.

Short press toggles recording. Holding the button for five seconds while idle
requests a fresh pairing code; ten seconds resets Wi-Fi. The cached paired
flag lets an already-paired Box record after reboot even when Wi-Fi is
temporarily unavailable.

## Status Lights

| State | WS2812 ring | Button LED |
|---|---|---|
| Wi-Fi setup | Blue breathing | Slow blink |
| Unpaired/pairing | Amber breathing | Slow blink |
| Recording | Solid warm | Solid on |
| Syncing | Rotating teal comet | Off |
| Idle | Off | Off |
| Error | Red flash | State dependent |

If `SB_ENABLE_LED_RING` is set to `0`, GPIO 2 is used as a simple fallback LED.

## IRAM Budget

BLE provisioning, Wi-Fi, TLS, I2S, and LittleFS together nearly fill the
ESP32's 128 KB IRAM segment; everything in IRAM comes from precompiled core
libraries, so the only lever is linking fewer of them. That is why the
WS2812 ring is bit-banged in `sb_ws2812.cpp` instead of using the RMT
driver, and why the core version is pinned. If a core upgrade overflows
IRAM again, the durable fix is building the core libraries with a leaner
sdkconfig (BLE-only controller, Wi-Fi IRAM optimizations off) via
esp32-arduino-lib-builder or an ESP-IDF component build.

## Troubleshooting

- Ring breathes blue but the app cannot find the Box: check that the phone
  has Bluetooth on and is within a few meters. The Box advertises only
  while it has no stored Wi-Fi credentials; hold the button ten seconds to
  re-enter setup mode.
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
