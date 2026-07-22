#pragma once

#include <Arduino.h>

#include "sb_api.h"

// BLE unified provisioning for first-time Wi-Fi setup. The app connects over
// BLE (security1 + proof of possession), sends the home network credentials,
// and gets join success/failure back over the same channel. Credentials are
// persisted by the esp-wifi stack in NVS; they never appear in the firmware
// image or serial logs.
//
// The session stays open after Wi-Fi succeeds so the SB_PROV_PAIR_ENDPOINT
// protocomm endpoint can hand the app a pairing code: the network task
// fetches one from box-api once online and the app polls the endpoint,
// getting {"status":"pending"} until the payload is ready.

// Starts BLE provisioning and begins advertising. Call once at boot, only
// when no Wi-Fi credentials are stored.
void sbProvisionBegin();

// True from sbProvisionBegin() until the provisioning session ends. While
// active, the provisioning manager owns the Wi-Fi driver.
bool sbProvisionActive();

// BLE service name the box advertises during setup, e.g. "STOREYBOX-1A2B".
const String &sbProvisionServiceName();

// True once provisioned Wi-Fi is up and the sb-pair endpoint still needs a
// pairing code. The network task polls this and answers with one of the two
// calls below; it stays true until answered, so failed fetches retry.
bool sbProvisionPairCodeNeeded();

// Publishes the fetched pairing code on the sb-pair endpoint.
void sbProvisionPairCodeReady(const SbPairingCode &pairingCode);

// Reports the fetch as failed; the endpoint tells the app to fall back to
// manual code entry.
void sbProvisionPairCodeFailed();

// Call from loop(). Closes the provisioning session once the pairing payload
// has been delivered, or after SB_PROV_PAIR_LINGER_MS if the app never asks.
void sbProvisionUpdate();

// Erases the stored Wi-Fi credentials and reboots into setup mode. Device
// identity and pairing are untouched.
void sbProvisionResetAndReboot();
