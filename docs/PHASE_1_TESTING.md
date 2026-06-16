# Phase 1 Testing Plan

## Scope

Phase 1 validates project setup, Supabase authentication, session persistence,
protected routes, the initial database schema, and row-level security (RLS).

## Automated Checks

1. Run TypeScript type checking.
2. Run Expo's project health check.
3. Apply the Supabase migration to a local or hosted project.
4. Run the included RLS verification queries with two test users.

## Manual Authentication Tests

1. Launch the app while signed out.
   - Expected: the login screen is shown.
2. Create an account with a valid email and password.
   - Expected: the account is created. If email confirmation is disabled, the
     user enters the protected app immediately. Otherwise, a confirmation
     message is shown.
3. Sign in with the account.
   - Expected: the protected home screen is shown.
4. Fully close and reopen the app.
   - Expected: the user remains signed in.
5. Sign out.
   - Expected: the login screen is shown and protected routes are inaccessible.

## RLS Tests

Use two authenticated test users, User A and User B.

1. Each user can read and update only their own profile.
2. User A can create, read, update, and delete memories owned by User A.
3. User A cannot create a memory for User B.
4. User A cannot read, update, or delete memories owned by User B.
5. Anonymous requests cannot access profiles or memories.

## Common Failure Points

- Missing or incorrect `EXPO_PUBLIC_SUPABASE_URL` or
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Email confirmation enabled in Supabase while testing immediate signup access.
- The migration has not been applied to the selected Supabase project.
- A redirect URL required by the chosen Supabase auth configuration is missing.
- Device storage is unavailable, preventing persisted sessions.
