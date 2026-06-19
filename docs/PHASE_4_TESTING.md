# Phase 4 Testing Plan

## Scope

Phase 4 validates private audio upload: creating the `memory-audio` bucket,
uploading the recorded file to Supabase Storage, showing upload progress stages,
handling upload errors, and storing the deterministic storage path on the memory.

## Automated Checks

1. Run TypeScript type checking.
2. Build/export the web app.
3. Apply `supabase/migrations/20260619000000_memory_audio_storage.sql` before
   manual upload testing.

## Manual Upload Tests

1. Sign in with a confirmed test account.
   - Expected: the protected memory timeline is shown.
2. Open the new-memory screen and record audio.
   - Expected: after stopping, the recording can be saved without playback.
3. Press **Save and upload recording**.
   - Expected: the app shows upload stages and then returns to the timeline.
4. Inspect the saved memory row in Supabase.
   - Expected: `audio_url` is a storage path in the form
     `user_id/memory_id/audio.m4a`.
5. Inspect the `memory-audio` storage bucket.
   - Expected: the uploaded object exists at the same path stored in
     `audio_url`.
6. Open the memory detail screen.
   - Expected: the app creates a private signed URL and playback works.
7. Delete the memory.
   - Expected: the memory row is deleted and the app attempts to remove the
     corresponding storage object.

## Error Handling Tests

1. Test without applying the Phase 4 storage migration.
   - Expected: saving shows an upload error and keeps the local recording on the
     screen for retry.
2. Test with network disabled during upload.
   - Expected: saving shows an upload error and does not leave a broken memory in
     the timeline.
3. Test with a second authenticated user.
   - Expected: User B cannot see or play User A's storage object or memory row.

## Common Failure Points

- The `memory-audio` bucket migration has not been applied.
- Storage policies do not match the `user_id/memory_id/audio.m4a` path shape.
- The browser blocks microphone access on an insecure origin.
- Supabase environment variables are missing or point at the wrong project.
- Web recordings use `audio/webm` content internally even though the MVP storage
  path is currently fixed as `audio.m4a`.
