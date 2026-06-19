# Phase 3 Testing Plan

## Scope

Phase 3 validates audio recording only: microphone permission handling, start
and stop recording controls, local document-directory file storage, playback,
and saving a recorded draft memory.

## Automated Checks

1. Run TypeScript type checking.
2. Run Expo Doctor.
3. Start the Expo app and confirm the recording route compiles.

## Manual Recording Tests

1. Sign in with a confirmed test account.
   - Expected: the protected memory timeline is shown.
2. Open the new-memory screen.
   - Expected: the screen asks for microphone permission if needed.
3. Start recording and speak for several seconds.
   - Expected: the timer advances and the primary recorder control changes to
     stop recording.
4. Stop recording.
   - Expected: the app shows a local file URI and a non-zero file size.
5. Play the recording.
   - Expected: playback starts from the saved local file and can be paused.
6. Save the recording.
   - Expected: a new draft memory is inserted for the signed-in user and the
     app opens its detail screen.
7. Return to the timeline.
   - Expected: the saved recording appears in the memory list.
8. Open the saved memory.
   - Expected: the recorded audio playback control is visible and can replay the
     local file.

## Common Failure Points

- Microphone permission is denied in the OS settings.
- Web testing is served from an insecure origin, which blocks microphone access.
- The app is tested in an environment without microphone support.
- Supabase environment variables are missing, so saving the recorded draft fails.
- The local file URI is device-specific and will be replaced by Supabase Storage
  in Phase 4.
