create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  display_name text
);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  summary text,
  transcript text,
  emotional_tone text,
  tags text[],
  memorable_quotes text[],
  audio_url text,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index memories_user_id_recorded_at_idx
  on public.memories (user_id, recorded_at desc);

alter table public.profiles enable row level security;
alter table public.memories enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users can view their own memories"
  on public.memories for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own memories"
  on public.memories for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own memories"
  on public.memories for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own memories"
  on public.memories for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
