# Storeybox Home

Storeybox Home is a private memory preservation app. This repository currently
contains Phase 2: the Expo app shell, Supabase authentication, protected
routing, session persistence, the initial RLS-protected database schema, and a
memory timeline backed by Supabase.

## Setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and enter the project's URL and anon key.
3. Apply `supabase/migrations/20260615000000_initial_schema.sql` with the
   Supabase CLI or SQL editor.
4. Install dependencies with `pnpm install`.
5. Start the app with `pnpm start`.

The anon key is safe to use in the client when RLS is enabled. Never place the
Supabase service-role key or an OpenAI API key in an `EXPO_PUBLIC_*` variable.

See `docs/PHASE_1_TESTING.md` and `docs/PHASE_2_TESTING.md` for verification
plans.
