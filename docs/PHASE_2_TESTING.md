# Phase 2 Testing Plan

## Scope

Phase 2 validates memory storage: the protected timeline, placeholder memory
creation, memory detail routing, and Supabase persistence through the existing
`memories` table and RLS policies.

## Automated Checks

1. Run TypeScript type checking.
2. Build/export the web app.
3. Confirm no new migration is required for Phase 2.

## Manual Memory Tests

1. Sign in with a confirmed test account.
   - Expected: the protected memory timeline is shown.
2. Open the create-memory placeholder screen.
   - Expected: the user sees the placeholder copy and save action.
3. Save a placeholder memory.
   - Expected: a new row is inserted into `public.memories` for the signed-in
     user, and the app opens the memory detail screen.
4. Return to the timeline.
   - Expected: the new memory appears in the list.
5. Open the memory from the timeline.
   - Expected: the detail screen shows the same persisted title, summary,
     recorded date, emotional tone, and tags.
6. Sign out and sign back in.
   - Expected: the memory is still present.

## RLS Tests

Use two authenticated test users, User A and User B.

1. User A creates a placeholder memory.
2. User B signs in.
3. User B should not see User A's memory in the timeline.
4. User B should not be able to open User A's memory detail route directly.

## Common Failure Points

- The Phase 1 migration has not been applied.
- The Supabase URL or anon key in `.env.local` is incorrect.
- The app is still serving an old web bundle after changing environment values.
- The signed-in user does not have a valid Supabase session.
