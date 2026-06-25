# Storeybox Home

Storeybox Home is a private memory preservation app. This repository currently
contains Phase 2: the Expo app shell, Supabase authentication, protected
routing, session persistence, the initial RLS-protected database schema, and a
memory timeline backed by Supabase. Phase 3 adds local audio recording,
document-directory storage, playback, and saved recording drafts. Phase 4 adds
private Supabase Storage uploads for recorded audio. Phase 5 adds server-side
AI processing through a Supabase Edge Function that transcribes audio and saves
structured memory metadata. Phase 6 polishes the UI into a calmer heirloom
archive experience.

## Setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and enter the project's URL and anon key.
3. Apply `supabase/migrations/20260615000000_initial_schema.sql` with the
   Supabase CLI or SQL editor.
4. Apply `supabase/migrations/20260619000000_memory_audio_storage.sql` to create
   the private `memory-audio` bucket and storage policies.
5. Apply `supabase/migrations/20260619010000_profile_names.sql` to add first
   and last name fields for personalized summaries.
6. Apply `supabase/migrations/20260625090000_profile_photos.sql` to add the
   optional profile photo field and private `profile-photos` bucket.
7. Set the OpenAI API key as a Supabase Edge Function secret:
   `supabase secrets set OPENAI_API_KEY=sk-...`.
8. Deploy the Phase 5 processor with
   `supabase functions deploy process-memory`.
9. Install dependencies with `pnpm install`.
10. Start the app with `pnpm start`.

The anon key is safe to use in the client when RLS is enabled. Never place the
Supabase service-role key or an OpenAI API key in an `EXPO_PUBLIC_*` variable.
All OpenAI calls run inside `supabase/functions/process-memory`.

## Friend Test Deployment

The simplest non-local beta is a hosted Expo web build on Netlify.

1. Connect this GitHub repo to Netlify.
2. Use these build settings:
   - Build command: `pnpm build:web`
   - Publish directory: `dist`
3. Add these Netlify environment variables:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy the site.
5. In Supabase Auth settings, add the Netlify URL to the allowed site/redirect
   URLs before inviting testers to sign up.

See `docs/PHASE_1_TESTING.md`, `docs/PHASE_2_TESTING.md`, and
`docs/PHASE_3_TESTING.md`, `docs/PHASE_4_TESTING.md`, and
`docs/PHASE_5_TESTING.md`, and `docs/PHASE_6_TESTING.md` for verification
plans.
