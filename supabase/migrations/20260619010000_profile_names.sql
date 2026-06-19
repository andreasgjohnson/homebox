alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text;

update public.profiles
set
  first_name = nullif(split_part(display_name, ' ', 1), ''),
  last_name = nullif(trim(regexp_replace(display_name, '^[^ ]+ ?', '')), '')
where display_name is not null
  and first_name is null
  and last_name is null;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can create their own profile'
  ) then
    create policy "Users can create their own profile"
      on public.profiles for insert
      to authenticated
      with check ((select auth.uid()) = id);
  end if;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, first_name, last_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  );
  return new;
end;
$$;
