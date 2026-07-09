# box-api

The routed Edge Function for Storeybox hardware, implementing `docs/HARDWARE_API_CONTRACT.md`.

## Routes

All routes are `POST` under `/functions/v1/box-api`:

| Route | Auth | Purpose |
| --- | --- | --- |
| `/v1/hello` | Box signature | Credential/liveness check after boot |
| `/v1/pairing-codes` | Box signature | Issue a short-lived hashed pairing code |
| `/v1/pairings/claim` | Supabase user JWT | App claims a pairing code, creates the membership |
| `/v1/heartbeat` | Box signature | Status/telemetry; returns config + pairing state |
| `/v1/recordings/start` | Box signature | Open a recording session, set cloud state to `recording` |
| `/v1/recordings/complete` | Box signature | Close the session, create the Storey placeholder, return a signed upload URL |
| `/v1/recordings/{id}/upload-url` | Box signature | Fresh upload lease after expiry |
| `/v1/recordings/{id}/upload-complete` | Box signature | Verify the object, queue processing, `safe_to_delete_local` |
| `/v1/recordings/{id}/sync-complete` | Box signature | Acknowledge sync, return Box to `idle` |
| `/v1/recordings/{id}/pins` | Box signature | Append a moment pin to the Storey |
| `/v1/errors` | Box signature | Error report; `fatal` maps to `needs_attention` |

## Hardware authentication

Boxes sign every request:

```http
Authorization: Storeybox-Signature box_id="...", key_id="...", ts="<ISO8601>", nonce="...", sig="<base64url>"
Digest: SHA-256=<base64 body sha256>
```

The signature covers `METHOD\nPATH\nts\nnonce\nDIGEST_HEADER`, where `PATH` starts at `/v1`
(gateway prefixes stripped) and `DIGEST_HEADER` is the full `SHA-256=...` value. Supported
credential types: `ed25519` (public key = base64 raw 32 bytes) and `ecdsa_p256` (public key =
base64 SPKI, signature = raw r||s). Timestamps outside ±5 minutes are rejected. The
`request_id` in each body is unique per attempt and recorded in `box_events`; a replayed
`request_id` returns the stored response, which makes every endpoint idempotent. Replay with a
altered `request_id` fails because the body digest and signature no longer match.

## Deploying

Hardware requests carry a device signature instead of a Supabase JWT, so deploy with JWT
verification disabled — this function does its own authentication on every route:

```sh
supabase functions deploy box-api --no-verify-jwt
```

Required secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY`
(all provided automatically on hosted Supabase).

## Provisioning a Box (admin/server only)

```sql
insert into public.boxes (public_device_id, serial_number, lifecycle_status)
values ('box_01...', 'SN-...', 'unpaired');

insert into public.box_credentials (box_id, key_id, credential_type, public_key, status)
values ('<box uuid>', 'key_2026_01', 'ed25519', '<base64 raw public key>', 'active');
```

The Box ships with only its private key, `public_device_id`, `key_id`, and the API base URL.
Never give hardware the service role key.

## Tests

```sh
deno test supabase/functions/box-api/crypto_test.ts
deno check supabase/functions/box-api/index.ts
```
