# Storeybox Hardware API Contract

Last updated: 2026-07-07

This document defines the contract between the physical Storeybox device, the Supabase backend, and the Storeybox iPhone app.

The product rule is firm: the physical Box captures audio. The iPhone app does not record audio, request microphone access, call `MediaRecorder`, call `getUserMedia`, or show hold-to-record capture UI. The app reflects Box state, shows Storeys after the Box syncs, and plays back audio that the Box uploaded.

## Current App Baseline

The current app uses:

- `public.memories` as the current Storey table.
- `memory-audio` as the private Supabase Storage bucket.
- `memories.audio_url` as a storage object path, not necessarily a public URL.
- Authenticated Supabase RLS so users can read only their own `memories`.
- Mock Box state in `lib/box.ts` and `components/BoxHardware.tsx`.
- Product copy/provenance such as `KEPT AT HOME · Captured by Bedside Box`.

The backend contract below keeps the current schema usable while proposing the columns and tables needed for hardware identity, pairing, status, upload, processing, and provenance.

## Vocabulary

- Box: the physical Storeybox hardware.
- User: the authenticated app user who owns or can access a Box.
- Storey: the user-facing saved memory. The current database table is `memories`; future migrations may rename or view it as `storeys`.
- Recording session: one capture attempt on the Box, from button press to local file completion.
- Audio object: the uploaded audio file in Supabase Storage.
- Processing job: backend transcription, summary, people/theme extraction, and provenance finalization.

## Security Principles

- Never place a Supabase service role key on hardware.
- Hardware authenticates with per-device credentials, preferably an asymmetric keypair generated at manufacturing or first secure provisioning.
- The backend stores only public keys, key ids, key status, and hashes of pairing codes. Private device keys stay on the Box, ideally in a secure element.
- Hardware writes go through Supabase Edge Functions that validate Box identity before writing database rows or issuing upload URLs.
- The Edge Functions may use service role credentials server-side. Those credentials are never returned to the Box or the app.
- Audio upload uses short-lived, path-scoped signed upload URLs or signed upload tokens.
- App reads remain authenticated user reads protected by RLS.
- Every hardware event is idempotent using `request_id` and/or `Idempotency-Key`.
- Every signed request includes a timestamp, nonce, and body digest to prevent replay.

Recommended hardware auth header:

```http
Authorization: Storeybox-Signature box_id="box_01J...", key_id="key_2026_01", ts="2026-07-07T18:42:12Z", nonce="d1b0...", sig="base64url-ed25519-signature"
Digest: SHA-256=base64-body-sha256
Idempotency-Key: req_01J...
```

The signature should cover:

```text
METHOD + "\n" + PATH + "\n" + ts + "\n" + nonce + "\n" + digest
```

The Edge Function rejects requests with stale timestamps, reused nonces, unknown key ids, revoked credentials, invalid body digests, or a `box_id` that does not match the active credential.

## Proposed Supabase Shape

### Existing Tables and Bucket

`public.memories` currently stores Storeys:

- `id`
- `user_id`
- `title`
- `summary`
- `transcript`
- `emotional_tone`
- `tags`
- `memorable_quotes`
- `audio_url`
- `recorded_at`
- `created_at`

`storage.buckets.memory-audio` is private and currently allows user-scoped paths like:

```text
{user_id}/{storey_id}/audio.m4a
```

Keep this path prefix because existing RLS checks the first folder name against `auth.uid()`.

### New Tables

Recommended additions:

```sql
public.boxes (
  id uuid primary key,
  public_device_id text unique not null,
  serial_number text unique,
  name text not null,
  location text,
  lifecycle_status text not null, -- provisioned, unpaired, paired, revoked
  cloud_state text not null, -- idle, recording, syncing, needs_attention
  last_heartbeat_at timestamptz,
  firmware_version text,
  battery_percent int,
  wifi_rssi int,
  ip_address inet,
  needs_attention_reason text,
  provisioned_at timestamptz not null default now(),
  paired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
```

```sql
public.box_memberships (
  box_id uuid not null references public.boxes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null, -- owner, member
  paired_at timestamptz not null default now(),
  primary key (box_id, user_id)
)
```

```sql
public.box_credentials (
  id uuid primary key,
  box_id uuid not null references public.boxes(id) on delete cascade,
  key_id text unique not null,
  credential_type text not null, -- ed25519, ecdsa_p256, hmac_v1
  public_key text,
  secret_hash text,
  status text not null, -- active, rotated, revoked
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  revoked_at timestamptz
)
```

```sql
public.box_pairing_codes (
  id uuid primary key,
  box_id uuid not null references public.boxes(id) on delete cascade,
  code_hash text not null,
  pairing_nonce_hash text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
)
```

```sql
public.recording_sessions (
  id uuid primary key,
  box_id uuid not null references public.boxes(id),
  user_id uuid references auth.users(id),
  storey_id uuid references public.memories(id),
  client_recording_id text not null,
  state text not null, -- recording, recorded, uploading, uploaded, processing, ready, failed
  trigger text not null, -- button, scheduled_test, support
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_ms int,
  codec text,
  container text,
  sample_rate_hz int,
  channel_count int,
  file_size_bytes bigint,
  sha256 text,
  audio_bucket text,
  audio_path text,
  upload_started_at timestamptz,
  uploaded_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (box_id, client_recording_id)
)
```

```sql
public.box_events (
  id uuid primary key,
  box_id uuid not null references public.boxes(id),
  recording_session_id uuid references public.recording_sessions(id),
  request_id text not null unique,
  event_type text not null,
  observed_at timestamptz not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
)
```

```sql
public.storey_processing_jobs (
  id uuid primary key,
  storey_id uuid not null references public.memories(id) on delete cascade,
  recording_session_id uuid references public.recording_sessions(id),
  status text not null, -- queued, transcribing, summarizing, ready, failed
  attempts int not null default 0,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
```

Recommended additions to `public.memories`:

```sql
alter table public.memories
  add column box_id uuid references public.boxes(id),
  add column recording_session_id uuid references public.recording_sessions(id),
  add column source text not null default 'box',
  add column processing_status text not null default 'queued',
  add column captured_by_box_name text,
  add column captured_at_location text,
  add column provenance_label text;
```

`captured_by_box_name`, `captured_at_location`, and `provenance_label` are snapshots. They keep detail screens stable if the user later renames or relocates the Box.

### RLS Model

Recommended policies:

- `memories`: authenticated app users can select, insert, update, and delete rows only where `auth.uid() = user_id`. Hardware does not use these direct table policies.
- `boxes`: users can select Boxes where a matching `box_memberships` row exists. Users can update friendly fields such as `name` and `location` for Boxes they own. Hardware direct table access is denied.
- `box_memberships`: users can select their own memberships. Creation happens only through pairing Edge Functions.
- `recording_sessions`, `box_events`, `box_credentials`, `box_pairing_codes`, `storey_processing_jobs`: no direct app or hardware writes. Edge Functions write these tables after validating either user auth or Box auth.
- `storage.objects`: app users can read audio paths under their user id. Hardware uploads only through a short-lived signed upload URL scoped to one object path.

## Edge Functions / API Endpoints

Use one routed Edge Function such as:

```text
/functions/v1/box-api/v1/...
```

or separate functions with the same payloads. The examples below use the routed form.

### Manufacturing Provisioning

Provisioning is a server/admin operation, not an app or normal hardware operation.

1. Generate or register `box_id`, `public_device_id`, serial number, and initial public key.
2. Insert `boxes` with `lifecycle_status = 'provisioned'` or `unpaired`.
3. Insert `box_credentials` with `status = 'active'`.
4. Ship the Box with only its private key, public id, and API base URL.

The Box may call `POST /v1/hello` after first boot to confirm that its credential is active.

### User Pairing

The app user is authenticated with Supabase. The Box is authenticated with device signing.

1. Box requests a pairing code.
2. App scans a QR code or the user enters the short code.
3. App calls the pairing claim endpoint with the user's Supabase JWT.
4. Backend validates the code, creates `box_memberships`, sets Box status to `paired`, and returns the Box metadata to the app.
5. The Box learns it is paired on the next heartbeat response.

Box request:

```http
POST /functions/v1/box-api/v1/pairing-codes
```

```json
{
  "request_id": "req_01JZ8VJ4Q6GN8E8KJ96W2C3H7M",
  "box_id": "box_01JZ8V5H3EF6Y92Z7AW6P6ZWX6",
  "sent_at": "2026-07-07T18:42:12Z",
  "display_code_format": "numeric_6",
  "expires_in_seconds": 600
}
```

Response:

```json
{
  "pairing_code": "482913",
  "pairing_uri": "storeybox://pair?box_id=box_01JZ8V5H3EF6Y92Z7AW6P6ZWX6&nonce=pn_01JZ8VK1",
  "expires_at": "2026-07-07T18:52:12Z",
  "box_state": "unpaired"
}
```

App claim request:

```http
POST /functions/v1/box-api/v1/pairings/claim
Authorization: Bearer <supabase-user-jwt>
```

```json
{
  "pairing_code": "482913",
  "pairing_nonce": "pn_01JZ8VK1",
  "box_name": "Bedside Box",
  "location": "Bedside"
}
```

Response:

```json
{
  "box": {
    "id": "9df9f1a0-65d8-4d92-92d4-3e6b3f1b69d1",
    "public_device_id": "box_01JZ8V5H3EF6Y92Z7AW6P6ZWX6",
    "name": "Bedside Box",
    "location": "Bedside",
    "cloud_state": "idle",
    "paired_at": "2026-07-07T18:43:02Z"
  }
}
```

### Heartbeat / Status

The Box sends heartbeats while online. The app does not call the Box directly; it reads the cloud row updated by this endpoint.

```http
POST /functions/v1/box-api/v1/heartbeat
```

```json
{
  "request_id": "req_01JZ8W2HX6DEJ4G1N34AK9F4AR",
  "box_id": "box_01JZ8V5H3EF6Y92Z7AW6P6ZWX6",
  "sent_at": "2026-07-07T18:44:00Z",
  "observed_at": "2026-07-07T18:43:58Z",
  "state": "idle",
  "firmware_version": "1.0.3",
  "battery_percent": 84,
  "power": "usb",
  "network": {
    "type": "wifi",
    "ssid_hash": "sha256:9b4d...",
    "rssi": -58
  },
  "storage": {
    "free_bytes": 481251328,
    "queued_recordings": 0
  },
  "active_recording_session_id": null,
  "error": null
}
```

Response:

```json
{
  "accepted_at": "2026-07-07T18:44:01Z",
  "server_time": "2026-07-07T18:44:01Z",
  "paired": true,
  "box": {
    "name": "Bedside Box",
    "location": "Bedside",
    "cloud_state": "idle"
  },
  "config": {
    "heartbeat_interval_seconds": 60,
    "offline_after_seconds": 180,
    "preferred_audio": {
      "container": "m4a",
      "codec": "aac",
      "sample_rate_hz": 48000,
      "channel_count": 1
    }
  },
  "commands": []
}
```

If `last_heartbeat_at` is older than `offline_after_seconds`, the app should display the Box as `offline` even if the last reported state was `idle`.

### Recording Started

The Box calls this when physical capture starts. This is the only event that should drive amber live recording UI, aside from explicit AI/hardware moment pin events.

```http
POST /functions/v1/box-api/v1/recordings/start
```

```json
{
  "request_id": "req_01JZ8W5A5R78HW29MZ3WQZCYXE",
  "box_id": "box_01JZ8V5H3EF6Y92Z7AW6P6ZWX6",
  "sent_at": "2026-07-07T18:45:11Z",
  "client_recording_id": "rec_local_20260707_184511_0001",
  "started_at": "2026-07-07T18:45:10Z",
  "trigger": "button",
  "audio": {
    "container": "m4a",
    "codec": "aac",
    "sample_rate_hz": 48000,
    "channel_count": 1
  }
}
```

Response:

```json
{
  "recording_session_id": "74d1876c-2a74-45f0-8d7d-f53647db620b",
  "box_state": "recording",
  "app_box_state": "recording",
  "accepted_at": "2026-07-07T18:45:11Z"
}
```

Optional moment pin event:

```http
POST /functions/v1/box-api/v1/recordings/74d1876c-2a74-45f0-8d7d-f53647db620b/pins
```

```json
{
  "request_id": "req_01JZ8W6D6X8N8H1TDJ74WT2N1R",
  "box_id": "box_01JZ8V5H3EF6Y92Z7AW6P6ZWX6",
  "sent_at": "2026-07-07T18:45:34Z",
  "pin": {
    "source": "ai_moment",
    "offset_ms": 23000,
    "confidence": 0.82
  }
}
```

### Recording Completed

The Box calls this after local recording closes and the file hash is known. The backend creates or updates the `recording_sessions` row, allocates a `memories.id`, creates a Storey placeholder, and returns a signed upload URL for one exact storage object.

```http
POST /functions/v1/box-api/v1/recordings/complete
```

```json
{
  "request_id": "req_01JZ8W9Z63XFCAR5ECQJ23P7VW",
  "box_id": "box_01JZ8V5H3EF6Y92Z7AW6P6ZWX6",
  "sent_at": "2026-07-07T18:48:02Z",
  "client_recording_id": "rec_local_20260707_184511_0001",
  "recording_session_id": "74d1876c-2a74-45f0-8d7d-f53647db620b",
  "ended_at": "2026-07-07T18:47:59Z",
  "duration_ms": 169000,
  "file_size_bytes": 2150448,
  "sha256": "73488e3f5d4d8e8a2e2f6b861a8d2a75f1bdb9a4f0a06c9db8b2b3cbb1a7a128",
  "interrupted": false
}
```

Response:

```json
{
  "recording_session_id": "74d1876c-2a74-45f0-8d7d-f53647db620b",
  "storey_id": "2de2bb2b-9b56-41e1-94d7-234b5e78d7f2",
  "box_state": "syncing",
  "app_box_state": "syncing",
  "storey": {
    "user_id": "64d39b8a-0fd2-4e0c-9d65-0f41df0e9f31",
    "recorded_at": "2026-07-07T18:45:10Z",
    "processing_status": "awaiting_upload",
    "provenance_label": "KEPT AT HOME · Captured by Bedside Box"
  },
  "upload": {
    "bucket": "memory-audio",
    "path": "64d39b8a-0fd2-4e0c-9d65-0f41df0e9f31/2de2bb2b-9b56-41e1-94d7-234b5e78d7f2/audio.m4a",
    "method": "PUT",
    "signed_url": "https://PROJECT.supabase.co/storage/v1/object/sign/memory-audio/...",
    "expires_at": "2026-07-07T18:58:02Z",
    "headers": {
      "content-type": "audio/mp4",
      "x-storeybox-sha256": "73488e3f5d4d8e8a2e2f6b861a8d2a75f1bdb9a4f0a06c9db8b2b3cbb1a7a128"
    }
  }
}
```

The storage path is under the paired user's id so existing storage RLS and app playback helpers continue to work.

### Audio Upload

The Box uploads the exact bytes to the signed URL returned by `recordings/complete`.

```http
PUT <upload.signed_url>
content-type: audio/mp4
x-storeybox-sha256: 73488e3f5d4d8e8a2e2f6b861a8d2a75f1bdb9a4f0a06c9db8b2b3cbb1a7a128

<binary audio>
```

Rules:

- The signed URL expires quickly, typically in 10 minutes.
- The URL allows writing only the allocated bucket and path.
- The Box must keep the local file until `upload-complete` returns `safe_to_delete_local: true`.
- If upload fails, the Box retries with exponential backoff. If the URL expires, it asks for a fresh upload lease.

Fresh upload lease request:

```http
POST /functions/v1/box-api/v1/recordings/74d1876c-2a74-45f0-8d7d-f53647db620b/upload-url
```

```json
{
  "request_id": "req_01JZ8X27KT0WRDMBN1XXW6KZFK",
  "box_id": "box_01JZ8V5H3EF6Y92Z7AW6P6ZWX6",
  "sent_at": "2026-07-07T18:55:00Z",
  "sha256": "73488e3f5d4d8e8a2e2f6b861a8d2a75f1bdb9a4f0a06c9db8b2b3cbb1a7a128"
}
```

### Upload Complete

After storage upload succeeds, the Box notifies the backend. The backend verifies object existence, size, path, and hash if available; marks the recording uploaded; and queues processing.

```http
POST /functions/v1/box-api/v1/recordings/74d1876c-2a74-45f0-8d7d-f53647db620b/upload-complete
```

```json
{
  "request_id": "req_01JZ8X7SE3R36JN9W9WQM0Q0WD",
  "box_id": "box_01JZ8V5H3EF6Y92Z7AW6P6ZWX6",
  "sent_at": "2026-07-07T18:56:16Z",
  "upload": {
    "bucket": "memory-audio",
    "path": "64d39b8a-0fd2-4e0c-9d65-0f41df0e9f31/2de2bb2b-9b56-41e1-94d7-234b5e78d7f2/audio.m4a",
    "content_type": "audio/mp4",
    "file_size_bytes": 2150448,
    "sha256": "73488e3f5d4d8e8a2e2f6b861a8d2a75f1bdb9a4f0a06c9db8b2b3cbb1a7a128"
  }
}
```

Response:

```json
{
  "recording_session_id": "74d1876c-2a74-45f0-8d7d-f53647db620b",
  "storey_id": "2de2bb2b-9b56-41e1-94d7-234b5e78d7f2",
  "box_state": "idle",
  "app_box_state": "syncing",
  "processing_job": {
    "id": "f9e65f0c-d3b0-4d0f-9e4a-df71b48b2626",
    "status": "queued"
  },
  "safe_to_delete_local": true
}
```

`box_state` returns to `idle` because the hardware has finished its work. `app_box_state` may remain `syncing` or `processing` while cloud transcription and summary are running.

### Processing / Transcription

Processing is a server-side workflow. The Box does not call OpenAI or hold app user credentials.

1. `upload-complete` queues `storey_processing_jobs`.
2. A server-side Edge Function downloads the audio from `memory-audio`.
3. The function transcribes audio.
4. The function writes:
   - `memories.transcript`
   - `memories.summary`
   - `memories.title`
   - `memories.emotional_tone`
   - `memories.tags`
   - `memories.memorable_quotes`
   - `memories.processing_status = 'ready'`
5. The app sees the updated Storey through refetch, focus refresh, polling, or realtime.

The existing `process-memory` function is user-JWT driven. For hardware Storeys, prefer a server-triggered processing path that starts from verified `recording_sessions` and `storey_processing_jobs` rows instead of requiring the hardware to invoke processing.

### Sync Complete

Sync is complete when:

- Audio exists in `memory-audio`.
- `recording_sessions.state` is `uploaded`, `processing`, or `ready`.
- The backend has returned `safe_to_delete_local: true`.
- The Box has returned to `idle`.

Optional Box acknowledgement:

```http
POST /functions/v1/box-api/v1/recordings/74d1876c-2a74-45f0-8d7d-f53647db620b/sync-complete
```

```json
{
  "request_id": "req_01JZ8XAM39QH53Q4APYJY1YH0C",
  "box_id": "box_01JZ8V5H3EF6Y92Z7AW6P6ZWX6",
  "sent_at": "2026-07-07T18:56:30Z",
  "local_copy_deleted": true
}
```

Response:

```json
{
  "accepted_at": "2026-07-07T18:56:30Z",
  "box_state": "idle"
}
```

### Error and Offline Handling

The Box should queue events locally when offline. Queued events keep their original `observed_at` and `client_recording_id`, then are sent in order when connectivity returns.

Error report:

```http
POST /functions/v1/box-api/v1/errors
```

```json
{
  "request_id": "req_01JZ8XBMMQ8E72KQQRW3HGK36J",
  "box_id": "box_01JZ8V5H3EF6Y92Z7AW6P6ZWX6",
  "sent_at": "2026-07-07T19:02:00Z",
  "observed_at": "2026-07-07T19:01:54Z",
  "severity": "warning",
  "code": "upload_retrying",
  "message": "Upload failed with a network timeout. Will retry.",
  "recording_session_id": "74d1876c-2a74-45f0-8d7d-f53647db620b",
  "retry_count": 2
}
```

Response:

```json
{
  "accepted_at": "2026-07-07T19:02:01Z",
  "box_state": "syncing",
  "needs_attention": false
}
```

Use `needs_attention` for conditions that require user action or support intervention:

- Storage full and no room for a new recording.
- Device credential revoked or rotated but not updated.
- Repeated upload failure past retry limit.
- Firmware version blocked by backend policy.
- Clock skew too large for signed requests.
- Paired user or Box membership missing.

## Hardware-To-Cloud Lifecycle

1. Provisioning
   - Backend registers Box identity and public key.
   - Box ships without Supabase service role credentials.

2. Pairing
   - Box requests a short-lived pairing code.
   - Authenticated app user claims the code.
   - Backend creates the user-to-Box membership.

3. Heartbeat/status
   - Box sends online state, battery, firmware, network, queue depth, and active recording id.
   - Backend updates `boxes`.
   - App reads `boxes` or a user-scoped view.

4. Recording started
   - Button press starts hardware capture.
   - Box sends `recordings/start`.
   - Backend sets active session and Box state to `recording`.
   - App may show amber live UI only from this cloud state.

5. Recording completed
   - Box closes local audio file and sends duration, size, and hash.
   - Backend allocates `recording_sessions`, `memories`, and storage path.
   - Backend returns signed upload URL.

6. Audio upload
   - Box uploads directly to private Supabase Storage using the signed URL.
   - No app or service role credential is involved on hardware.

7. Upload complete
   - Box notifies backend.
   - Backend verifies the object and queues processing.
   - Box may delete local audio only after backend says it is safe.

8. Processing/transcription
   - Server-side job transcribes and summarizes audio.
   - Storey fields and provenance are written to `memories`.

9. Storey creation
   - Storey is linked by `memories.user_id`, `memories.box_id`, and `memories.recording_session_id`.
   - `memories.audio_url` stores the private storage path.
   - App displays provenance from the snapshot fields.

10. Sync complete
   - Box returns to `idle`.
   - App may continue to show Storey-level processing until transcript and summary are ready.

11. Error/offline
   - Stale heartbeat maps to `offline`.
   - Queued Box events replay idempotently.
   - Repeated or actionable failures map to `needs_attention`.

## Box State Machine

Canonical app-facing Box states:

- `idle`: online, paired, no active capture or upload. Current UI copy may call this "ready".
- `recording`: hardware capture is active. Amber recording UI is allowed.
- `syncing`: hardware has one or more completed recordings uploading or awaiting upload acknowledgement.
- `offline`: heartbeat is stale or backend knows the Box has no cloud connectivity.
- `needs_attention`: user or support action is required.

Cloud processing is not a hardware capture state. It can appear as Storey-level `processing` after the Box has returned to `idle`.

Allowed transitions:

```text
unpaired -> idle
idle -> recording
recording -> syncing
syncing -> idle
idle -> offline
recording -> offline
syncing -> offline
offline -> idle
offline -> syncing
idle -> needs_attention
recording -> needs_attention
syncing -> needs_attention
offline -> needs_attention
needs_attention -> idle
```

Backend-to-current-app mapping:

| Backend condition | Canonical app state | Current `lib/box.ts` visual state |
| --- | --- | --- |
| Fresh heartbeat, no active recording/upload | `idle` | `ready` |
| `recording_sessions.state = 'recording'` | `recording` | `recording` |
| Upload waiting or in progress | `syncing` | `syncing` |
| Storey processing only, no Box upload active | `idle` plus Storey `processing` | `processing` if the current screen wants a global preparing state |
| Stale heartbeat | `offline` | `offline` |
| Actionable device problem | `needs_attention` | `offline` until a dedicated UI state is added |

## How Audio Reaches Supabase Storage

1. The Box never receives Supabase service role credentials.
2. The Box signs `recordings/complete`.
3. The Edge Function validates the Box and confirms the paired `user_id`.
4. The Edge Function creates a Storey placeholder and an exact bucket-relative storage path:

```text
{user_id}/{storey_id}/audio.m4a
```

5. The Edge Function returns bucket `memory-audio` plus a short-lived signed upload URL for that path.
6. The Box uploads bytes directly to Storage.
7. The Box calls `upload-complete`.
8. The Edge Function verifies the object, updates `memories.audio_url`, and queues processing.
9. The app creates signed playback URLs as an authenticated user when the user opens a Storey.

## How Storeys Link to Boxes and Users

The paired user comes from `box_memberships`, not from a user id supplied by the Box.

When a recording completes, the backend resolves:

```text
box_id -> box_memberships.owner user_id -> memories.user_id
```

Then it writes:

- `memories.user_id`: the paired owner/member user id.
- `memories.box_id`: the physical Box row.
- `memories.recording_session_id`: the source recording session.
- `memories.audio_url`: private storage path.
- `memories.recorded_at`: Box `started_at`, adjusted only if clock skew policy requires it.
- `memories.source`: `box`.
- `memories.captured_by_box_name`: Box name at capture time.
- `memories.captured_at_location`: Box location at capture time.
- `memories.provenance_label`: `KEPT AT HOME · Captured by {BoxName}`.

The iPhone app should prefer the snapshot provenance on the Storey detail and list screens. If missing, it can fall back to joining the current Box name.

## How the iPhone App Reads Box State and Storeys

The app uses the user's Supabase session and anon key as it does today.

Box state:

- Query a user-scoped view such as `user_boxes` or `boxes` joined through `box_memberships`.
- Derive `offline` if `last_heartbeat_at` is older than the backend `offline_after_seconds`.
- Subscribe to realtime changes on `boxes` and active `recording_sessions`, or refetch on focus as the app currently does for `memories`.
- Render amber/live recording only when the cloud reports active hardware recording or explicit moment pins.

Storeys:

- Query `memories` where `user_id = auth.uid()`, ordered by `recorded_at desc`.
- Include rows with `processing_status in ('awaiting_upload', 'processing', 'ready')` if the UI wants "preparing" placeholders.
- For archive lists, the current app can continue using `title`, `summary`, `emotional_tone`, `tags`, `recorded_at`, and `created_at`.
- For detail, use `audio_url` to request an authenticated signed playback URL from Storage.
- Display transcript, people/themes, memorable quotes, and provenance after processing fields are populated.

Recommended `user_boxes` view shape for the app:

```sql
select
  b.id,
  b.public_device_id,
  b.name,
  b.location,
  b.cloud_state,
  b.last_heartbeat_at,
  b.firmware_version,
  b.battery_percent,
  b.needs_attention_reason,
  bm.role,
  bm.user_id
from public.boxes b
join public.box_memberships bm on bm.box_id = b.id;
```

RLS on the underlying tables should ensure users only see rows where `bm.user_id = auth.uid()`.

## Open Decisions Requiring Hardware Details

- Secure element availability and supported signing algorithms: Ed25519, ECDSA P-256, or HMAC fallback.
- Whether keys are generated during manufacturing or first boot.
- Pairing UX: QR code, numeric code, BLE assist, Wi-Fi captive portal, or some combination.
- Whether the Box has a display, LED-only pairing, speaker prompts, or app-assisted setup.
- Audio format, sample rate, channel count, maximum duration, and expected file size.
- Whether upload needs resumable multipart/TUS support or single signed-object upload is enough.
- Local storage capacity and retention policy after upload.
- Offline queue limits and what happens when local storage fills.
- Clock source accuracy and acceptable signed-request skew.
- Firmware update command model and whether the backend can require an update before recording.
- Whether a Box can have multiple users, household members, or transfer of ownership.
- Whether moment pins come from a hardware button, on-device AI, backend AI, or all three.
- Whether deletion from the app should also send a future purge command to the Box if local retention remains.
