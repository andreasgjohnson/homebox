#include "sb_identity.h"

#include <Preferences.h>
#include <esp_random.h>
#include <mbedtls/base64.h>
#include <mbedtls/ecdsa.h>
#include <mbedtls/ecp.h>
#include <mbedtls/sha256.h>
#include <time.h>

namespace {

constexpr uint8_t kP256SpkiPrefix[] = {
  0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
  0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00
};

Preferences prefs;
String gBoxId;
String gKeyId;
String gPublicKeySpki;
bool gPaired = false;
bool gReady = false;
mbedtls_ecp_keypair gKey;

int espRng(void *, unsigned char *output, size_t len) {
  esp_fill_random(output, len);
  return 0;
}

String hexFromBytes(const uint8_t *data, size_t len) {
  static constexpr char kHex[] = "0123456789abcdef";
  String out;
  out.reserve(len * 2);
  for (size_t i = 0; i < len; i++) {
    out += kHex[data[i] >> 4];
    out += kHex[data[i] & 0x0f];
  }
  return out;
}

String randomToken(const char *prefix, size_t bytes) {
  return String(prefix) + sbIdentityRandomHex(bytes);
}

bool generateAndStoreKey() {
  mbedtls_ecp_keypair fresh;
  mbedtls_ecp_keypair_init(&fresh);

  int rc = mbedtls_ecp_gen_key(MBEDTLS_ECP_DP_SECP256R1, &fresh, espRng, nullptr);
  if (rc != 0) {
    Serial.printf("P-256 key generation failed: -0x%04x\n", -rc);
    mbedtls_ecp_keypair_free(&fresh);
    return false;
  }

  uint8_t privateKey[32] = {0};
  size_t privateLen = 0;
  rc = mbedtls_ecp_write_key_ext(&fresh, &privateLen, privateKey, sizeof(privateKey));
  if (rc != 0 || privateLen != sizeof(privateKey)) {
    Serial.printf("P-256 private key export failed: -0x%04x\n", -rc);
    mbedtls_ecp_keypair_free(&fresh);
    return false;
  }

  uint8_t publicPoint[65] = {0};
  size_t publicLen = 0;
  rc = mbedtls_ecp_write_public_key(&fresh, MBEDTLS_ECP_PF_UNCOMPRESSED, &publicLen, publicPoint, sizeof(publicPoint));
  if (rc != 0 || publicLen != sizeof(publicPoint)) {
    Serial.printf("P-256 public key export failed: -0x%04x\n", -rc);
    mbedtls_ecp_keypair_free(&fresh);
    return false;
  }

  prefs.putBytes("p256_d", privateKey, sizeof(privateKey));
  prefs.putBytes("p256_q", publicPoint, sizeof(publicPoint));
  prefs.putString("box_id", randomToken("box_", 10));
  prefs.putString("key_id", randomToken("key_", 10));
  prefs.putBool("paired", false);

  mbedtls_ecp_keypair_free(&fresh);
  return true;
}

bool loadKeyFromPrefs() {
  uint8_t privateKey[32] = {0};
  uint8_t publicPoint[65] = {0};

  if (prefs.getBytesLength("p256_d") != sizeof(privateKey) ||
      prefs.getBytesLength("p256_q") != sizeof(publicPoint)) {
    return false;
  }

  prefs.getBytes("p256_d", privateKey, sizeof(privateKey));
  prefs.getBytes("p256_q", publicPoint, sizeof(publicPoint));

  mbedtls_ecp_keypair_free(&gKey);
  mbedtls_ecp_keypair_init(&gKey);

  int rc = mbedtls_ecp_read_key(MBEDTLS_ECP_DP_SECP256R1, &gKey, privateKey, sizeof(privateKey));
  if (rc != 0) {
    Serial.printf("P-256 private key load failed: -0x%04x\n", -rc);
    return false;
  }

  mbedtls_ecp_point q;
  mbedtls_ecp_point_init(&q);
  rc = mbedtls_ecp_point_read_binary(&gKey.MBEDTLS_PRIVATE(grp), &q, publicPoint, sizeof(publicPoint));
  if (rc == 0) {
    rc = mbedtls_ecp_set_public_key(MBEDTLS_ECP_DP_SECP256R1, &gKey, &q);
  }
  mbedtls_ecp_point_free(&q);

  if (rc != 0) {
    Serial.printf("P-256 public key load failed: -0x%04x\n", -rc);
    return false;
  }

  uint8_t spki[sizeof(kP256SpkiPrefix) + sizeof(publicPoint)] = {0};
  memcpy(spki, kP256SpkiPrefix, sizeof(kP256SpkiPrefix));
  memcpy(spki + sizeof(kP256SpkiPrefix), publicPoint, sizeof(publicPoint));
  gPublicKeySpki = sbBase64Encode(spki, sizeof(spki));

  return gPublicKeySpki.length() > 0;
}

String sqlQuote(const String &value) {
  String quoted = "'";
  for (size_t i = 0; i < value.length(); i++) {
    char c = value[i];
    if (c == '\'') {
      quoted += "''";
    } else {
      quoted += c;
    }
  }
  quoted += "'";
  return quoted;
}

}  // namespace

bool sbIdentityBegin() {
  mbedtls_ecp_keypair_init(&gKey);

  if (!prefs.begin("storeybox", false)) {
    Serial.println("Could not open Storeybox NVS namespace.");
    return false;
  }

  if (!loadKeyFromPrefs()) {
    Serial.println("No device identity found; generating a new P-256 identity.");
    if (!generateAndStoreKey() || !loadKeyFromPrefs()) {
      return false;
    }
  }

  gBoxId = prefs.getString("box_id", "");
  gKeyId = prefs.getString("key_id", "");
  gPaired = prefs.getBool("paired", false);
  gReady = gBoxId.length() > 0 && gKeyId.length() > 0 && gPublicKeySpki.length() > 0;

  if (!gReady) {
    Serial.println("Device identity is incomplete.");
  }

  return gReady;
}

const String &sbIdentityBoxId() {
  return gBoxId;
}

const String &sbIdentityKeyId() {
  return gKeyId;
}

const String &sbIdentityPublicKeySpki() {
  return gPublicKeySpki;
}

bool sbIdentityIsPaired() {
  return gPaired;
}

void sbIdentitySetPaired(bool paired) {
  gPaired = paired;
  prefs.putBool("paired", paired);
}

bool sbIdentityClockReady() {
  time_t now = time(nullptr);
  return now > 1700000000;
}

String sbIdentityIsoNow(time_t epoch) {
  time_t now = epoch > 0 ? epoch : time(nullptr);
  struct tm utc;
  gmtime_r(&now, &utc);
  char out[25];
  strftime(out, sizeof(out), "%Y-%m-%dT%H:%M:%SZ", &utc);
  return String(out);
}

String sbIdentityRequestId(const char *prefix) {
  return String(prefix) + "_" + sbIdentityRandomHex(12);
}

String sbIdentityNonce() {
  return sbIdentityRandomHex(16);
}

String sbIdentityRandomHex(size_t byteCount) {
  uint8_t bytes[32];
  String out;
  out.reserve(byteCount * 2);

  while (byteCount > 0) {
    size_t chunk = byteCount > sizeof(bytes) ? sizeof(bytes) : byteCount;
    esp_fill_random(bytes, chunk);
    out += hexFromBytes(bytes, chunk);
    byteCount -= chunk;
  }

  return out;
}

bool sbIdentitySign(const String &signingString, String &signatureBase64Url) {
  if (!gReady) {
    return false;
  }

  uint8_t hash[32] = {0};
  mbedtls_sha256(reinterpret_cast<const unsigned char *>(signingString.c_str()), signingString.length(), hash, 0);

  mbedtls_mpi r;
  mbedtls_mpi s;
  mbedtls_mpi_init(&r);
  mbedtls_mpi_init(&s);

  int rc = mbedtls_ecdsa_sign(&gKey.MBEDTLS_PRIVATE(grp), &r, &s, &gKey.MBEDTLS_PRIVATE(d), hash, sizeof(hash), espRng, nullptr);
  if (rc != 0) {
    Serial.printf("ECDSA signing failed: -0x%04x\n", -rc);
    mbedtls_mpi_free(&r);
    mbedtls_mpi_free(&s);
    return false;
  }

  uint8_t raw[64] = {0};
  rc = mbedtls_mpi_write_binary(&r, raw, 32);
  if (rc == 0) {
    rc = mbedtls_mpi_write_binary(&s, raw + 32, 32);
  }

  mbedtls_mpi_free(&r);
  mbedtls_mpi_free(&s);

  if (rc != 0) {
    Serial.printf("ECDSA raw signature export failed: -0x%04x\n", -rc);
    return false;
  }

  signatureBase64Url = sbBase64UrlEncode(raw, sizeof(raw));
  return signatureBase64Url.length() > 0;
}

String sbSha256Hex(const uint8_t *data, size_t len) {
  uint8_t digest[32] = {0};
  mbedtls_sha256(data, len, digest, 0);
  return hexFromBytes(digest, sizeof(digest));
}

String sbSha256Base64(const uint8_t *data, size_t len) {
  uint8_t digest[32] = {0};
  mbedtls_sha256(data, len, digest, 0);
  return sbBase64Encode(digest, sizeof(digest));
}

String sbSha256HexFile(File &file) {
  if (!file) {
    return "";
  }

  mbedtls_sha256_context ctx;
  mbedtls_sha256_init(&ctx);
  mbedtls_sha256_starts(&ctx, 0);

  uint8_t buffer[1024];
  file.seek(0);
  while (file.available()) {
    size_t count = file.read(buffer, sizeof(buffer));
    if (count == 0) {
      break;
    }
    mbedtls_sha256_update(&ctx, buffer, count);
  }

  uint8_t digest[32] = {0};
  mbedtls_sha256_finish(&ctx, digest);
  mbedtls_sha256_free(&ctx);
  file.seek(0);

  return hexFromBytes(digest, sizeof(digest));
}

String sbBase64Encode(const uint8_t *data, size_t len) {
  size_t outLen = 0;
  mbedtls_base64_encode(nullptr, 0, &outLen, data, len);

  String out;
  char *buffer = static_cast<char *>(malloc(outLen + 1));
  if (!buffer) {
    return out;
  }

  if (mbedtls_base64_encode(reinterpret_cast<unsigned char *>(buffer), outLen, &outLen, data, len) == 0) {
    buffer[outLen] = '\0';
    out = buffer;
  }

  free(buffer);
  return out;
}

String sbBase64UrlEncode(const uint8_t *data, size_t len) {
  String out = sbBase64Encode(data, len);
  out.replace("+", "-");
  out.replace("/", "_");
  while (out.endsWith("=")) {
    out.remove(out.length() - 1);
  }
  return out;
}

void sbIdentityPrintProvisioningSql(Stream &out) {
  out.println();
  out.println("----- Storeybox provisioning SQL -----");
  out.println("begin;");
  out.print("insert into public.boxes (public_device_id, name, lifecycle_status, cloud_state) values (");
  out.print(sqlQuote(gBoxId));
  out.println(", 'Storeybox', 'unpaired', 'idle') on conflict (public_device_id) do nothing;");
  out.print("insert into public.box_credentials (box_id, key_id, credential_type, public_key, status) ");
  out.print("select id, ");
  out.print(sqlQuote(gKeyId));
  out.print(", 'ecdsa_p256', ");
  out.print(sqlQuote(gPublicKeySpki));
  out.print(", 'active' from public.boxes where public_device_id = ");
  out.print(sqlQuote(gBoxId));
  out.print(" on conflict (key_id) do update set credential_type = excluded.credential_type, public_key = excluded.public_key, status = 'active';");
  out.println();
  out.println("commit;");
  out.println("----- End provisioning SQL -----");
  out.println();
}

