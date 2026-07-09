# Supabase Hardware Schema Foundation

Last updated: 2026-07-08

This document describes the first backend schema foundation for the hardware-first Storeybox app.

The product rule remains unchanged: the physical Box captures audio. The iPhone app reads Box status, Archive, Storey details, playback, profile, and auth. The app does not record audio and must not receive service-role keys, hardware secrets, device credentials, or direct hardware write capability.

## Migration

The schema is implemented in:

```text
supabase/migrations/20260708000000_hardware_first_storeybox_schema.sql
```

It adds:

- `public.boxes`: physical Box identity, lifecycle, heartbeat/status fields, and app-facing cloud state.
- `public.box_memberships`: owner/member relationship between authenticated users and Boxes.
- `public.box_credentials`: server-side device credential metadata for signed hardware requests. This table stores public keys or secret hashes only.
- `public.box_pairing_codes`: short-lived hashed pairing codes for Box-to-user pairing.
- `public.box_pairing_claims`: audit trail for accepted and rejected pairing attempts.
- `public.recording_sessions`: one physical hardware capture attempt from start through upload/processing.
- `public.box_events`: idempotent hardware event log keyed by `request_id`.
- `public.storey_processing_jobs`: server-side transcription/summarization queue for hardware-created Storeys.
- `public.user_boxes`: a security-invoker view for app reads of a user's Boxes.

It also extends `public.memories`, which remains the compatibility Storey table, with:

- `box_id`
- `recording_session_id`
- `source`
- `processing_status`
- `captured_by_box_name`
- `captured_at_location`
- `provenance_label`
- `moment_pins`
- `updated_at`

Existing `memories` rows are preserved. They are backfilled with `source = 'legacy'` and `processing_status = 'ready'`. New rows default to `source = 'box'` and `processing_status = 'queued'` unless the server-side hardware workflow sets a more precise status such as `awaiting_upload`, `processing`, or `ready`.

## Security Model

Authenticated app users can select only rows tied to their own Box memberships or their own Storeys.

The one direct app write path is Box friendly fields: users with an `owner` membership can update `boxes.name` and `boxes.location`, and nothing else. A column-level `grant update (name, location)` keeps lifecycle, cloud state, heartbeat, and session columns out of reach even for owners, while the RLS policy limits the update to owned Boxes.

Beyond that, the migration intentionally does not add direct app write policies for hardware lifecycle tables. Pairing, hardware heartbeat, recording session creation, event ingest, signed upload URL generation, and processing job creation should be handled by Edge Functions after validating either:

- a signed-in app user's Supabase JWT for user actions, or
- a Storeybox hardware signature for Box-originated actions.

The hardware should not use the Supabase anon key as its only credential, and it should never receive a service-role key. Hardware uploads should use short-lived signed upload URLs scoped to one exact `memory-audio` object path.

## Applying

For a linked Supabase project:

```sh
supabase db push
```

For local development:

```sh
supabase start
supabase db reset
```

`supabase db reset` rebuilds the local database from migrations, so use it only for disposable local data.

## Testing

After applying locally or to a staging project:

1. Confirm the migration applies without SQL errors.
2. Confirm existing Storeys still load from `public.memories`.
3. As a signed-in user, confirm `public.user_boxes` returns only Boxes where that user has a `box_memberships` row.
4. Confirm another authenticated user cannot select those Boxes, memberships, recording sessions, or processing jobs.
5. Confirm authenticated users cannot insert into `boxes`, `box_memberships`, `recording_sessions`, `box_events`, or `storey_processing_jobs` directly through the client API.
6. Confirm authenticated users cannot select `box_credentials`, `box_pairing_codes`, `box_pairing_claims`, or `box_events`.
7. Confirm a Box owner can update `boxes.name` and `boxes.location`, but not columns such as `lifecycle_status` or `cloud_state`; confirm a non-owner member's update matches zero rows and a non-member cannot update or select the Box at all.
8. Insert a service-role-only test path that creates a Box, membership, recording session, Storey placeholder, and processing job; then confirm the owning user can read the Storey and related status rows.
9. Confirm `memory-audio` remains private and existing playback signed URLs still work for paths under `{user_id}/{storey_id}/...`.

Useful smoke-test queries:

```sql
select id, source, processing_status
from public.memories
order by created_at desc
limit 5;

select *
from public.user_boxes;
```

RLS behavior should be tested through the Supabase client using real authenticated user sessions, not only from the SQL editor, because the SQL editor commonly runs with elevated privileges.

## Manual Supabase Dashboard Setup

The migration creates schema and RLS, but the following setup still belongs in Supabase Dashboard or server-only deployment configuration:

- Keep `memory-audio` private. The existing storage migration already configures this bucket.
- Deploy future hardware Edge Functions such as `box-api` with server-side access to `SUPABASE_SERVICE_ROLE_KEY`.
- Store hardware verification configuration as Edge Function secrets or server-side database rows, not in Expo public config.
- Store only public keys or hashed shared secrets in `box_credentials`.
- Configure allowed app redirect URLs for magic links and deep links separately from hardware API authentication.
- Keep OpenAI and processing credentials in Edge Function secrets.
- Provision Boxes through an admin/server process that creates `boxes` and `box_credentials`; do not provision devices from the mobile app.
- Use short-lived signed upload URLs for exact `memory-audio/{user_id}/{storey_id}/audio.*` paths.

## Notes For Future Edge Functions

The Box should send signed requests with `box_id`, `key_id`, timestamp, nonce, digest, and idempotency key. Edge Functions should validate the signature, reject replayed nonces/request ids, resolve the paired user from `box_memberships`, and write Storey rows to `public.memories`.

The app should keep using Storey language. The database compatibility table is still named `memories` for now.
