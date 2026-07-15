#pragma once

#include <Arduino.h>

// BLE unified provisioning for first-time Wi-Fi setup. The app connects over
// BLE (security1 + proof of possession), sends the home network credentials,
// and gets join success/failure back over the same channel. Credentials are
// persisted by the esp-wifi stack in NVS; they never appear in the firmware
// image or serial logs.

// Starts BLE provisioning and begins advertising. Call once at boot, only
// when no Wi-Fi credentials are stored.
void sbProvisionBegin();

// True from sbProvisionBegin() until the provisioning session ends. While
// active, the provisioning manager owns the Wi-Fi driver.
bool sbProvisionActive();

// BLE service name the box advertises during setup, e.g. "STOREYBOX-1A2B".
const String &sbProvisionServiceName();

// Erases the stored Wi-Fi credentials and reboots into setup mode. Device
// identity and pairing are untouched.
void sbProvisionResetAndReboot();
