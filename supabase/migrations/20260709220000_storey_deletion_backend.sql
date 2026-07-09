-- Storey deletion now flows through the delete-storey Edge Function, which
-- verifies the owner and removes the memories row and its private audio
-- together with the service role. Direct client deletes are withdrawn so the
-- row and its storage object can never fall out of sync.

drop policy if exists "Users can delete their own memories" on public.memories;

revoke delete on public.memories from anon, authenticated;

drop policy if exists "Users can delete their own memory audio" on storage.objects;
