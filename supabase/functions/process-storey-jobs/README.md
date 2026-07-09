# process-storey-jobs

Server-side processing worker for hardware Storeys. Replaces the user-JWT `process-memory`
path for Box recordings: it consumes `storey_processing_jobs`, transcribes and summarizes the
uploaded audio with the shared OpenAI provider, and writes the results to `memories`.

## How jobs flow

1. `box-api` `upload-complete` verifies the storage object, queues a `storey_processing_jobs`
   row, and fires this worker asynchronously with `{ "job_id": ... }`.
2. The worker claims jobs atomically (`queued → transcribing` with an attempts bump in one
   statement), so concurrent runs never double-process.
3. Status flows `queued → transcribing → summarizing → ready`; the Storey mirrors it in
   `memories.processing_status`. Failures return to `queued` until 3 attempts, then land on
   `failed` (job, Storey, and recording session all marked).

## Auth

The worker only accepts `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`. Deploy with JWT
verification disabled so that check is the sole gate:

```sh
supabase functions deploy process-storey-jobs --no-verify-jwt
```

Required secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (automatic on hosted Supabase)
and `OPENAI_API_KEY` (shared with `process-memory`). Optional: `OPENAI_TRANSCRIBE_MODEL`,
`OPENAI_SUMMARY_MODEL`.

## Cron backstop (optional, recommended)

The box-api kick covers the happy path. To drain jobs missed by crashes or retries, schedule
a periodic call with pg_cron + pg_net (SQL editor; store the service key in Vault first):

```sql
select cron.schedule(
  'process-storey-jobs',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/process-storey-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{"limit": 5}'::jsonb
  );
  $$
);
```
