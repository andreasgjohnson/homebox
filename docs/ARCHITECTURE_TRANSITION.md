# Storeybox Architecture Transition Guide

Last updated: 2026-07-09

This guide is for agents cleaning up the codebase during the move from the old Homebox app architecture to the new hardware-first Storeybox iPhone app.

## Product Rule

The physical Storeybox Box captures audio. The iPhone app does not record audio.

Do not reintroduce:

- microphone capture UI
- hold-to-record or press-to-record phone flows
- `MediaRecorder`
- `getUserMedia`
- Expo audio recorder hooks for capture
- client-side local recording upload flows
- onboarding that asks the phone user to record a first memory

The iPhone app is now a companion/archive app. It shows Box state, Archive, Storey detail, playback, profile, auth, and eventually pairing/sync.

## Old Architecture

The old app treated the phone as the capture device.

The old flow was roughly:

1. User signs in.
2. User records audio on the phone.
3. App saves a local recording or placeholder memory.
4. App uploads that audio to Supabase Storage.
5. App invokes processing, transcription, and summary.
6. App shows the saved item in a `memories` timeline/detail UI.

Old concepts included:

- `memories` as both product language and database table.
- `/memories` routes as the main app surface.
- `/memories/new` as the phone recording route.
- first-memory onboarding tied to email/magic-link auth.
- local recording storage and upload helpers.
- client-invoked `process-memory` flow.
- testing docs focused on browser/mobile microphone permissions.

Old code that should stay removed:

- `app/(app)/memories/new.tsx`
- `lib/onboardingFirstMemory.ts`
- old client recording helpers
- old local audio upload helpers
- old client-side processing wrappers such as `processMemory`
- old testing docs that instruct users to grant microphone permission or record from the phone

## New Architecture

The new architecture is hardware-first.

The Box flow should become:

1. Physical Box is provisioned.
2. User pairs the Box to their account.
3. Box sends heartbeat/status to the backend.
4. Box captures audio when the user presses the physical device.
5. Box creates a recording session through a server-validated hardware API.
6. Backend allocates a Storey placeholder and an exact storage path.
7. Backend returns a short-lived signed upload URL.
8. Box uploads audio directly to storage.
9. Backend verifies upload and queues processing.
10. Processing creates transcript, summary, tags, moment pins, and provenance.
11. iPhone app reads the Storey and Box status through authenticated Supabase/RLS.

New product language:

- Box: the physical Storeybox hardware.
- Storey: the user-facing saved audio item.
- Archive: the collection of Storeys.
- Your Box: the app surface for pairing/status/settings.
- Provenance: `KEPT AT HOME - Captured by {BoxName}` or a safe generic fallback until real Box data exists.

## Current Compatibility Layer

The app-facing language should be Storey/Archive/Box, but some backend names are intentionally still legacy for compatibility.

Keep for now:

- `public.memories` as the current Storey table.
- `memory-audio` as the private audio storage bucket.
- `memories.audio_url` as a bucket-relative storage path.
- Existing profile/auth/storage migrations.
- Existing `process-memory` Edge Function unless a replacement server-side processing path is ready.

Do not rename database tables or buckets casually. A later migration can introduce views or renamed tables, but current app code and historical data still depend on the compatibility names.

## Current App-Facing Files

Important app-facing files in the new direction:

- `app/(app)/archive/index.tsx`
- `app/(app)/archive/search.tsx`
- `app/(app)/archive/[id].tsx`
- `app/(app)/your-box.tsx`
- `app/(app)/index.tsx`
- `app/(app)/profile.tsx`
- `app/auth/callback.tsx`
- `components/BoxHardware.tsx`
- `components/DaybookChrome.tsx`
- `components/StoreyHero.tsx`
- `components/AuthForm.tsx`
- `lib/authRedirect.ts`
- `lib/box.ts`
- `lib/storeys.ts`
- `lib/storeyAudio.ts`
- `lib/hardwareContract.ts`
- `docs/HARDWARE_API_CONTRACT.md`
- `docs/SUPABASE_HARDWARE_SCHEMA.md`

## What To Keep

Keep:

- Supabase Auth and magic-link flow.
- Native deep-link handling for `storeybox://auth/callback`.
- `lib/storeys.ts` as the app-facing Storey data wrapper.
- `lib/storeyAudio.ts` as the app-facing audio playback/removal wrapper.
- `lib/box.ts` Box state model, including `unpaired`.
- `components/BoxHardware.tsx` hardware status visuals.
- Archive, Storey detail, Search, Your Box, Profile, Theme, and Person screens.
- Existing `profiles` and profile photo helpers.
- Existing `memory-audio` private bucket until a deliberate storage migration replaces it.
- Existing `public.memories` rows and RLS compatibility.

## What To Remove Or Avoid

Remove or avoid:

- phone capture screens
- new phone recording routes
- old Memory product copy in UI
- old microphone permission docs
- browser recording tests
- code paths that upload local phone recordings
- client-side direct hardware writes
- service-role keys in Expo/public code
- device credentials in mobile app config
- generic deep-link auth handling that accepts auth params on any URL path

If a future link uses `code` for pairing, auth code must not consume it. Auth redirect code should only process the allow-listed auth callback path.

## Box State Guidance

Until real pairing/status data exists, the UI must be honest.

Use:

- `unpaired`
- "Pair your Box"
- "Not paired yet"
- "Box status will appear here after pairing"

Do not show:

- "connected"
- "ready"
- "last sync"
- "Bedside Box"

unless that data came from the backend or a deliberate fixture clearly marked as mock/demo.

## Storey Deletion Guidance

Long-term deletion should move behind a backend/RPC path that authorizes ownership and deletes database/storage consistently.

Until then, prefer:

1. Delete the database Storey row first.
2. Attempt storage cleanup after successful row deletion.
3. Report storage cleanup failures instead of silently ignoring them.

Do not delete the audio object first and then attempt the row delete; a row delete failure would leave a Storey with missing audio.

## Audio Path Contract

Define storage as:

```text
bucket: memory-audio
path: {user_id}/{storey_id}/audio.m4a
```

The value in `memories.audio_url` should be bucket-relative whenever possible:

```text
{user_id}/{storey_id}/audio.m4a
```

Helpers may normalize accidentally bucket-prefixed values such as:

```text
memory-audio/{user_id}/{storey_id}/audio.m4a
```

but new backend writes should prefer the bucket-relative path.

## Supabase And Hardware Security

Hardware should not write directly through the mobile app.

Do not put these in Expo/public code:

- Supabase service-role key
- Box private key
- shared hardware secret
- provisioning credential
- OpenAI/API processing secrets

Preferred pattern:

- Box signs requests with per-device credentials.
- Edge Functions validate Box identity, nonce, timestamp, digest, and request id.
- Edge Functions use server-side credentials to write rows and issue signed upload URLs.
- App users read through Supabase Auth and RLS.

## Cleanup Checklist For Agents

Before removing code, ask:

1. Is this phone capture or hardware capture?
2. Is this user-facing Storey/Archive language or legacy database compatibility?
3. Does deleting this break existing `public.memories` data?
4. Does this expose hardware write ability to the mobile app?
5. Does this imply a Box is paired/connected before backend pairing exists?
6. Does this route still exist under Expo Router?
7. Does this auth redirect only process the allow-listed auth callback path?

Searches that should stay clean in app/component/lib code:

```sh
rg "MediaRecorder|getUserMedia|requestRecordingPermissionsAsync|useAudioRecorder|RecordingPresets|allowsRecording|Hold to remember|Press to record|memories/new|audioStorage|processMemory" app components lib
rg "backgroundImage|boxShadow|linear-gradient|radial-gradient" app components lib
```

Intentional exceptions:

- `docs/HARDWARE_API_CONTRACT.md` may mention forbidden APIs to state the product rule.
- `public.memories` and `memory-audio` may appear as backend compatibility names.
- `process-memory` may exist as a legacy Edge Function until server-side processing is replaced.

## Recommended Next Work

The next cleanup/build steps should happen in this order:

1. Finish and validate the Supabase hardware schema and RLS.
2. Add server-side Box API Edge Functions for pairing, heartbeat, recording sessions, upload complete, and event ingest.
3. Replace `defaultBox` with real Supabase Box membership/status data.
4. Use real provenance fields from Storeys instead of generic fallback copy.
5. Move Storey deletion into a backend/RPC path.
6. Run iOS simulator/dev-client testing for auth, routing, no mic permissions, Archive, Storey playback, and Your Box.

