insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memory-audio',
  'memory-audio',
  false,
  52428800,
  array[
    'audio/aac',
    'audio/mp4',
    'audio/mpeg',
    'audio/m4a',
    'audio/webm',
    'audio/wav',
    'audio/x-m4a'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can view their own memory audio"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'memory-audio'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "Users can upload their own memory audio"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'memory-audio'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "Users can update their own memory audio"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'memory-audio'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'memory-audio'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own memory audio"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'memory-audio'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
