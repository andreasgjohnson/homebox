# Storeybox

Storeybox is a hardware-first memory archive. The physical Storeybox Box
captures spoken memories at home; this repository contains the companion
iPhone/Expo app and the Supabase backend that the Box and the app share.

## Product Rule

**The Box records. The app does not.**

The iPhone app never captures audio. It is a companion/archive app: it pairs
the Box to an account, reflects Box status, and lets the owner browse and play
back the Storeys the Box brings home. Do not reintroduce microphone capture UI,
phone recording flows, or client-side upload of local recordings. See
[docs/ARCHITECTURE_TRANSITION.md](docs/ARCHITECTURE_TRANSITION.md) for the full
keep/remove guidance.

## Product Language

- **Box** — the physical Storeybox hardware.
- **Storey** — a saved audio memory: playback, transcript, summary, tags,
  emotional texture, memorable quotes, and provenance.
- **Archive** — the collection of Storeys, browsable by time, theme, and
  people.
- **Your Box** — the app surface for pairing, status, and settings.

## How It Works

1. A user signs in with a Supabase magic link (native deep link:
   `storeybox://auth/callback`).
2. The user pairs their Box from the app.
3. The Box sends signed heartbeats and status to the backend through the
   `box-api` Edge Function (per-device credentials; see
   [docs/HARDWARE_API_CONTRACT.md](docs/HARDWARE_API_CONTRACT.md)).
4. When someone presses the Box, it opens a recording session, uploads audio
   directly to private storage via a short-lived signed URL, and the backend
   queues processing.
5. Processing produces the transcript, summary, tags, and provenance for the
   Storey.
6. The app reads Storeys and Box status through Supabase Auth and RLS — read
   paths only; hardware writes go through Edge Functions, never the app.

## App Surfaces

- Home daybook with Box presence and recent Storeys.
- Your Box: pairing, connection status, last sync, notification settings.
- Archive with time, theme, and people lenses, plus search.
- Storey detail: playback, transcript, summary, texture, quotes.
- Theme and person detail pages.
- Profile settings.

## Backend Compatibility Layer

Some backend names are intentionally legacy — do not rename them casually:

- `public.memories` is the current Storey table (`source='legacy'` marks
  pre-hardware rows).
- `memory-audio` is the private audio bucket; `memories.audio_url` stores a
  bucket-relative path (`{user_id}/{storey_id}/audio.m4a`).
- The `process-memory` Edge Function remains until the server-side processing
  path fully replaces it.

Hardware tables (`boxes`, `box_memberships`, `box_credentials`,
`recording_sessions`, `storey_processing_jobs`, …) are documented in
[docs/SUPABASE_HARDWARE_SCHEMA.md](docs/SUPABASE_HARDWARE_SCHEMA.md).

## Technical Stack

- Expo Router, React Native / React Native Web, TypeScript
- Supabase Auth, Postgres, Storage, Row Level Security, Edge Functions
- EAS for iOS builds

## Box Firmware

The ESP32 firmware lives in
[firmware/storeybox_esp32](firmware/storeybox_esp32). It targets a classic
ESP32 DevKit with an INMP441 microphone, MAX98357A speaker amp, WS2812 status
ring, and GPIO record button. The sketch generates its own P-256 device key,
prints provisioning SQL, pairs through `box-api`, records WAV audio to LittleFS,
and syncs Storeys through signed upload URLs.

## Local Setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and enter the project's URL and anon key.
3. Apply the Supabase migrations in `supabase/migrations`.
4. Set the OpenAI API key as a Supabase Edge Function secret:
   `supabase secrets set OPENAI_API_KEY=sk-...`.
5. Deploy the Edge Functions:
   `supabase functions deploy box-api`,
   `supabase functions deploy process-storey-jobs --no-verify-jwt`, and
   `supabase functions deploy process-memory` (legacy, kept for
   compatibility; see `supabase/functions/process-storey-jobs/README.md`).
6. In Supabase Auth settings, enable email magic links and add the app's
   redirect URLs (including `storeybox://auth/callback`) to the allowed
   redirect URLs.
7. Install dependencies with `pnpm install`.
8. Start the app with `pnpm start`.

Never put the Supabase service-role key, Box credentials, or AI API keys in an
`EXPO_PUBLIC_*` variable or anywhere in app code. Server-side secrets belong in
Edge Function configuration only.
