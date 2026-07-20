-- A recording that is too short, or transcribes to almost nothing, is a slipped
-- button rather than a Storey. It is not a failure — nothing went wrong, and the
-- keeper should never see it reported as an error — so it needs a state of its
-- own rather than borrowing 'failed'.
--
-- 'discarded' is terminal: the worker never retries it, and the app filters it
-- out of the archive.

alter table public.memories
  drop constraint if exists memories_processing_status_check;

alter table public.memories
  add constraint memories_processing_status_check
  check (processing_status in (
    'awaiting_upload', 'queued', 'transcribing', 'summarizing', 'processing', 'ready', 'failed', 'discarded'
  ));

alter table public.recording_sessions
  drop constraint if exists recording_sessions_state_check;

alter table public.recording_sessions
  add constraint recording_sessions_state_check
  check (state in (
    'recording', 'recorded', 'uploading', 'uploaded', 'processing', 'ready', 'failed', 'discarded'
  ));

alter table public.storey_processing_jobs
  drop constraint if exists storey_processing_jobs_status_check;

alter table public.storey_processing_jobs
  add constraint storey_processing_jobs_status_check
  check (status in (
    'queued', 'transcribing', 'summarizing', 'processing', 'ready', 'failed', 'discarded'
  ));
