#pragma once

#include <Arduino.h>
#include <FS.h>

bool sbIdentityBegin();

const String &sbIdentityBoxId();
const String &sbIdentityKeyId();
const String &sbIdentityPublicKeySpki();

bool sbIdentityIsPaired();
void sbIdentitySetPaired(bool paired);

bool sbIdentityClockReady();
String sbIdentityIsoNow(time_t epoch = 0);
String sbIdentityRequestId(const char *prefix = "req");
String sbIdentityNonce();
String sbIdentityRandomHex(size_t byteCount);

bool sbIdentitySign(const String &signingString, String &signatureBase64Url);

String sbSha256Hex(const uint8_t *data, size_t len);
String sbSha256Base64(const uint8_t *data, size_t len);
String sbSha256HexFile(File &file);

String sbBase64Encode(const uint8_t *data, size_t len);
String sbBase64UrlEncode(const uint8_t *data, size_t len);

void sbIdentityPrintProvisioningSql(Stream &out);

