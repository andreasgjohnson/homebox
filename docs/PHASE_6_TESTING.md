# Phase 6 Testing

Phase 6 is UI polish only: refined styling, clearer empty/loading/error states,
and a settings surface for account identity.

## Visual Direction

- Heirloom archive
- Premium minimal
- Soft whites, charcoal, muted gold
- Dusty blue accents
- Clean system typography

## Screens To Check

1. Login and signup
   - Expected: soft white form, charcoal primary button, muted gold eyebrow.
   - Expected: validation or Supabase errors are readable and not visually loud.

2. Timeline
   - Expected: archive header uses the new palette.
   - Expected: `Settings` and `Sign out` controls are visible and aligned.
   - Expected: empty state feels calm and memory-focused.
   - Expected: loading state says `Opening your archive...`.

3. Settings
   - Expected: page heading says `Your archive`.
   - Expected: first and last name fields load and save.
   - Expected: success and error messages use the polished state treatment.

4. New memory
   - Expected: title field remains visually prominent.
   - Expected: recorder, playback, upload progress, and errors use the new palette.
   - Expected: save flow still uploads and processes the recording.

5. Memory detail
   - Expected: editable title, audio playback, transcript, summary, tags, and delete section all render cleanly.
   - Expected: destructive delete styling is clearly separate from archive content.

## Common Failure Points

- Supabase schema cache not refreshed after profile-name migration.
- Edge Function not redeployed after AI prompt changes.
- Browser microphone permission blocked.
- OpenAI quota or unsupported audio errors during processing.
