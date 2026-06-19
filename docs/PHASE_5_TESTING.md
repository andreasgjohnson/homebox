# Phase 5 Testing

Phase 5 adds the `process-memory` Supabase Edge Function. The app uploads audio
to private Supabase Storage, then invokes the function with:

```json
{
  "memoryId": "memory uuid",
  "audioPath": "user uuid/memory uuid/audio.m4a"
}
```

## Setup

1. Confirm Phase 4 storage is applied:
   `supabase/migrations/20260619000000_memory_audio_storage.sql`.
2. Apply the profile-name migration:
   `supabase/migrations/20260619010000_profile_names.sql`.
3. Set the OpenAI key as a Supabase secret:
   `supabase secrets set OPENAI_API_KEY=sk-...`.
4. Optional: override model defaults with Supabase secrets:
   `OPENAI_TRANSCRIBE_MODEL` and `OPENAI_SUMMARY_MODEL`.
5. Deploy the processor:
   `supabase functions deploy process-memory`.

Do not add `OPENAI_API_KEY` to `.env.local` or any `EXPO_PUBLIC_*` variable.

## Happy Path

1. Start the app and sign in.
2. Open `New memory`.
3. Open `Profile` from the timeline and save a first name.
4. Record a short clip.
5. Keep or edit the title.
6. Press `Save and process recording`.
7. Expected: the progress card advances through upload, then
   `Transcribing and summarizing...`.
8. Expected: the app returns to the timeline.
9. Open the saved memory.
10. Expected: `Summary`, `Transcript`, `Emotional tone`, `Memorable quotes`, and
   `Tags` are populated from the recording.
11. Expected: summaries refer to the account owner as `you` when a speaker
    reference is needed, and use first names for named people.

## Security Checks

1. Confirm the mobile/web client never sends requests directly to OpenAI.
2. Confirm the Edge Function rejects a request with no `Authorization` header.
3. Confirm the Edge Function rejects an `audioPath` that does not match the
   memory row.
4. Confirm the Edge Function rejects an `audioPath` outside the signed-in
   user's storage folder.

## Failure Checks

1. If `process-memory` is not deployed, expected: the app explains that AI
   processing is not ready yet.
2. If `OPENAI_API_KEY` is missing, expected: the function returns a configuration
   error and the app does not keep a partial memory.
3. If upload fails, expected: no memory row remains in the timeline.
