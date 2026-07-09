create extension if not exists pgcrypto;

create table public.boxes (
  id uuid primary key default gen_random_uuid(),
  public_device_id text not null unique,
  serial_number text unique,
  name text not null default 'Storeybox',
  location text,
  lifecycle_status text not null default 'unpaired',
  cloud_state text not null default 'idle',
  last_heartbeat_at timestamptz,
  firmware_version text,
  battery_percent int,
  wifi_rssi int,
  network_type text,
  power_source text,
  ip_address inet,
  free_storage_bytes bigint,
  queued_recordings int,
  needs_attention_reason text,
  provisioned_at timestamptz not null default now(),
  paired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boxes_lifecycle_status_check
    check (lifecycle_status in ('provisioned', 'unpaired', 'paired', 'revoked')),
  constraint boxes_cloud_state_check
    check (cloud_state in ('idle', 'recording', 'syncing', 'offline', 'needs_attention')),
  constraint boxes_battery_percent_check
    check (battery_percent is null or battery_percent between 0 and 100),
  constraint boxes_free_storage_bytes_check
    check (free_storage_bytes is null or free_storage_bytes >= 0),
  constraint boxes_queued_recordings_check
    check (queued_recordings is null or queued_recordings >= 0)
);

create table public.box_memberships (
  box_id uuid not null references public.boxes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  paired_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (box_id, user_id),
  constraint box_memberships_role_check
    check (role in ('owner', 'member'))
);

create unique index box_memberships_one_owner_per_box_idx
  on public.box_memberships (box_id)
  where role = 'owner';

create index box_memberships_user_id_idx
  on public.box_memberships (user_id);

create table public.box_credentials (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references public.boxes(id) on delete cascade,
  key_id text not null unique,
  credential_type text not null,
  public_key text,
  secret_hash text,
  status text not null default 'active',
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  revoked_at timestamptz,
  constraint box_credentials_credential_type_check
    check (credential_type in ('ed25519', 'ecdsa_p256', 'hmac_v1')),
  constraint box_credentials_status_check
    check (status in ('active', 'rotated', 'revoked'))
);

create index box_credentials_box_id_idx
  on public.box_credentials (box_id);

create table public.box_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references public.boxes(id) on delete cascade,
  code_hash text not null,
  pairing_nonce_hash text,
  display_code_format text not null default 'numeric_6',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint box_pairing_codes_expiry_check
    check (expires_at > created_at),
  constraint box_pairing_codes_consumed_at_check
    check (consumed_at is null or consumed_at >= created_at)
);

create index box_pairing_codes_box_id_expires_at_idx
  on public.box_pairing_codes (box_id, expires_at desc);

create index box_pairing_codes_code_hash_idx
  on public.box_pairing_codes (code_hash);

create table public.box_pairing_claims (
  id uuid primary key default gen_random_uuid(),
  pairing_code_id uuid references public.box_pairing_codes(id) on delete set null,
  box_id uuid references public.boxes(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  claim_status text not null,
  failure_reason text,
  attempted_at timestamptz not null default now(),
  constraint box_pairing_claims_status_check
    check (claim_status in ('accepted', 'rejected', 'expired', 'already_consumed'))
);

create index box_pairing_claims_box_id_attempted_at_idx
  on public.box_pairing_claims (box_id, attempted_at desc);

create index box_pairing_claims_user_id_attempted_at_idx
  on public.box_pairing_claims (user_id, attempted_at desc);

create table public.recording_sessions (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references public.boxes(id),
  user_id uuid references auth.users(id) on delete set null,
  storey_id uuid references public.memories(id) on delete set null,
  client_recording_id text not null,
  state text not null default 'recording',
  trigger text not null default 'button',
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_ms int,
  interrupted boolean not null default false,
  codec text,
  container text,
  sample_rate_hz int,
  channel_count int,
  file_size_bytes bigint,
  sha256 text,
  audio_bucket text not null default 'memory-audio',
  audio_path text,
  upload_started_at timestamptz,
  uploaded_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (box_id, client_recording_id),
  constraint recording_sessions_state_check
    check (state in ('recording', 'recorded', 'uploading', 'uploaded', 'processing', 'ready', 'failed')),
  constraint recording_sessions_duration_ms_check
    check (duration_ms is null or duration_ms >= 0),
  constraint recording_sessions_file_size_bytes_check
    check (file_size_bytes is null or file_size_bytes >= 0),
  constraint recording_sessions_sample_rate_hz_check
    check (sample_rate_hz is null or sample_rate_hz > 0),
  constraint recording_sessions_channel_count_check
    check (channel_count is null or channel_count > 0),
  constraint recording_sessions_ended_at_check
    check (ended_at is null or ended_at >= started_at),
  constraint recording_sessions_audio_bucket_check
    check (audio_bucket = 'memory-audio')
);

create index recording_sessions_box_id_started_at_idx
  on public.recording_sessions (box_id, started_at desc);

create index recording_sessions_user_id_started_at_idx
  on public.recording_sessions (user_id, started_at desc);

create index recording_sessions_storey_id_idx
  on public.recording_sessions (storey_id);

create index recording_sessions_state_idx
  on public.recording_sessions (state);

alter table public.boxes
  add column active_recording_session_id uuid;

alter table public.boxes
  add constraint boxes_active_recording_session_id_fkey
  foreign key (active_recording_session_id)
  references public.recording_sessions(id)
  on delete set null;

create index boxes_active_recording_session_id_idx
  on public.boxes (active_recording_session_id);

create table public.box_events (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references public.boxes(id) on delete cascade,
  recording_session_id uuid references public.recording_sessions(id) on delete set null,
  request_id text not null unique,
  event_type text not null,
  observed_at timestamptz not null,
  sent_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint box_events_payload_check
    check (jsonb_typeof(payload) = 'object')
);

create index box_events_box_id_observed_at_idx
  on public.box_events (box_id, observed_at desc);

create index box_events_recording_session_id_idx
  on public.box_events (recording_session_id);

create index box_events_event_type_idx
  on public.box_events (event_type);

create table public.storey_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  storey_id uuid not null references public.memories(id) on delete cascade,
  recording_session_id uuid references public.recording_sessions(id) on delete set null,
  status text not null default 'queued',
  attempts int not null default 0,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storey_processing_jobs_status_check
    check (status in ('queued', 'transcribing', 'summarizing', 'processing', 'ready', 'failed')),
  constraint storey_processing_jobs_attempts_check
    check (attempts >= 0)
);

create index storey_processing_jobs_storey_id_idx
  on public.storey_processing_jobs (storey_id);

create index storey_processing_jobs_recording_session_id_idx
  on public.storey_processing_jobs (recording_session_id);

create index storey_processing_jobs_status_created_at_idx
  on public.storey_processing_jobs (status, created_at);

alter table public.memories
  add column if not exists box_id uuid,
  add column if not exists recording_session_id uuid,
  add column if not exists source text,
  add column if not exists processing_status text,
  add column if not exists captured_by_box_name text,
  add column if not exists captured_at_location text,
  add column if not exists provenance_label text,
  add column if not exists moment_pins jsonb not null default '[]'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

update public.memories
set source = 'legacy'
where source is null;

update public.memories
set processing_status = 'ready'
where processing_status is null;

update public.memories
set moment_pins = '[]'::jsonb
where moment_pins is null;

alter table public.memories
  alter column source set default 'box',
  alter column source set not null,
  alter column processing_status set default 'queued',
  alter column processing_status set not null,
  alter column moment_pins set default '[]'::jsonb,
  alter column moment_pins set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.memories
  add constraint memories_box_id_fkey
  foreign key (box_id)
  references public.boxes(id)
  on delete set null;

alter table public.memories
  add constraint memories_recording_session_id_fkey
  foreign key (recording_session_id)
  references public.recording_sessions(id)
  on delete set null;

alter table public.memories
  add constraint memories_source_check
  check (source in ('box', 'app', 'import', 'legacy'));

alter table public.memories
  add constraint memories_processing_status_check
  check (processing_status in ('awaiting_upload', 'queued', 'transcribing', 'summarizing', 'processing', 'ready', 'failed'));

alter table public.memories
  add constraint memories_moment_pins_check
  check (jsonb_typeof(moment_pins) = 'array');

create index memories_box_id_recorded_at_idx
  on public.memories (box_id, recorded_at desc);

create index memories_recording_session_id_idx
  on public.memories (recording_session_id);

create index memories_processing_status_idx
  on public.memories (processing_status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger boxes_set_updated_at
  before update on public.boxes
  for each row execute procedure public.set_updated_at();

create trigger box_memberships_set_updated_at
  before update on public.box_memberships
  for each row execute procedure public.set_updated_at();

create trigger recording_sessions_set_updated_at
  before update on public.recording_sessions
  for each row execute procedure public.set_updated_at();

create trigger storey_processing_jobs_set_updated_at
  before update on public.storey_processing_jobs
  for each row execute procedure public.set_updated_at();

create trigger memories_set_updated_at
  before update on public.memories
  for each row execute procedure public.set_updated_at();

alter table public.boxes enable row level security;
alter table public.box_memberships enable row level security;
alter table public.box_credentials enable row level security;
alter table public.box_pairing_codes enable row level security;
alter table public.box_pairing_claims enable row level security;
alter table public.recording_sessions enable row level security;
alter table public.box_events enable row level security;
alter table public.storey_processing_jobs enable row level security;

create policy "Users can view their own boxes"
  on public.boxes for select
  to authenticated
  using (
    exists (
      select 1
      from public.box_memberships box_memberships
      where box_memberships.box_id = boxes.id
        and box_memberships.user_id = (select auth.uid())
    )
  );

create policy "Owners can update their box name and location"
  on public.boxes for update
  to authenticated
  using (
    exists (
      select 1
      from public.box_memberships box_memberships
      where box_memberships.box_id = boxes.id
        and box_memberships.user_id = (select auth.uid())
        and box_memberships.role = 'owner'
    )
  )
  with check (
    exists (
      select 1
      from public.box_memberships box_memberships
      where box_memberships.box_id = boxes.id
        and box_memberships.user_id = (select auth.uid())
        and box_memberships.role = 'owner'
    )
  );

create policy "Users can view their own box memberships"
  on public.box_memberships for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can view their own recording sessions"
  on public.recording_sessions for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.box_memberships box_memberships
      where box_memberships.box_id = recording_sessions.box_id
        and box_memberships.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.memories memories
      where memories.id = recording_sessions.storey_id
        and memories.user_id = (select auth.uid())
    )
  );

create policy "Users can view their own Storey processing jobs"
  on public.storey_processing_jobs for select
  to authenticated
  using (
    exists (
      select 1
      from public.memories memories
      where memories.id = storey_processing_jobs.storey_id
        and memories.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.recording_sessions recording_sessions
      where recording_sessions.id = storey_processing_jobs.recording_session_id
        and (
          recording_sessions.user_id = (select auth.uid())
          or exists (
            select 1
            from public.box_memberships box_memberships
            where box_memberships.box_id = recording_sessions.box_id
              and box_memberships.user_id = (select auth.uid())
          )
        )
    )
  );

create or replace view public.user_boxes
with (security_invoker = true)
as
select
  boxes.id,
  boxes.public_device_id,
  boxes.name,
  boxes.location,
  boxes.lifecycle_status,
  boxes.cloud_state,
  boxes.last_heartbeat_at,
  boxes.firmware_version,
  boxes.battery_percent,
  boxes.wifi_rssi,
  boxes.network_type,
  boxes.power_source,
  boxes.free_storage_bytes,
  boxes.queued_recordings,
  boxes.needs_attention_reason,
  boxes.active_recording_session_id,
  box_memberships.role,
  box_memberships.user_id,
  box_memberships.paired_at
from public.boxes boxes
join public.box_memberships box_memberships
  on box_memberships.box_id = boxes.id;

grant select on public.boxes to authenticated;
-- Column-level grant restricts app UPDATE to friendly fields only; RLS restricts rows to owned Boxes.
grant update (name, location) on public.boxes to authenticated;
grant select on public.box_memberships to authenticated;
grant select on public.recording_sessions to authenticated;
grant select on public.storey_processing_jobs to authenticated;
grant select on public.user_boxes to authenticated;

revoke all on public.box_credentials from anon, authenticated;
revoke all on public.box_pairing_codes from anon, authenticated;
revoke all on public.box_pairing_claims from anon, authenticated;
revoke all on public.box_events from anon, authenticated;

comment on table public.boxes is
  'Physical Storeybox hardware identity and app-facing cloud state. Hardware updates this only through server-side Edge Functions.';

comment on table public.box_memberships is
  'User-to-Box ownership and membership. Pairing Edge Functions create these rows after validating short-lived pairing codes.';

comment on table public.box_credentials is
  'Per-Box credential metadata for signed hardware requests. Store public keys or secret hashes only, never raw private keys or device secrets.';

comment on table public.box_pairing_codes is
  'Short-lived hashed pairing codes issued to authenticated hardware and claimed by signed-in app users through Edge Functions.';

comment on table public.recording_sessions is
  'One hardware capture attempt from physical button press through upload and processing.';

comment on table public.storey_processing_jobs is
  'Server-side transcription and summarization work queue for hardware-created Storeys.';

comment on column public.memories.source is
  'Storey source. Existing rows are backfilled as legacy; hardware-created rows should use box.';

comment on column public.memories.provenance_label is
  'Snapshot label such as KEPT AT HOME - Captured by Bedside Box, kept stable even if the Box is later renamed.';
