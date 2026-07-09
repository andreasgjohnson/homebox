import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { OpenAIProvider } from '../_shared/services/ai/openai.ts';

const STOREY_AUDIO_BUCKET = 'memory-audio';
const MAX_ATTEMPTS = 3;
const DEFAULT_BATCH_LIMIT = 3;
const MAX_BATCH_LIMIT = 10;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type JobRow = {
  id: string;
  storey_id: string;
  recording_session_id: string | null;
  status: string;
  attempts: number;
};

// Server-side worker for hardware Storeys: claims queued storey_processing_jobs,
// transcribes and summarizes the uploaded audio, and writes the results to
// memories. Invoked by box-api after upload-complete, and safe to run from a
// cron backstop; job claiming is atomic so concurrent runs never double-process.
serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  try {
    const supabaseUrl = readEnv('SUPABASE_URL');
    const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');
    const openAIKey = readEnv('OPENAI_API_KEY');

    requireServiceAuthorization(request, serviceRoleKey);

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const aiProvider = new OpenAIProvider(
      openAIKey,
      Deno.env.get('OPENAI_TRANSCRIBE_MODEL') ?? undefined,
      Deno.env.get('OPENAI_SUMMARY_MODEL') ?? undefined,
    );

    const { jobId, limit } = await readWorkerRequest(request);
    const jobs = await findQueuedJobs(supabase, jobId, limit);
    const processed: string[] = [];
    const failed: Array<{ job_id: string; error: string }> = [];

    for (const job of jobs) {
      const claimed = await claimJob(supabase, job);

      if (!claimed) {
        continue;
      }

      try {
        await processJob(supabase, aiProvider, claimed);
        processed.push(claimed.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Processing failed.';

        await failJob(supabase, claimed, message);
        failed.push({ job_id: claimed.id, error: message });
      }
    }

    return json({ processed, failed, checked: jobs.length });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Could not process Storey jobs.';

    return json({ error: message }, status);
  }
});

// Only server-side callers (box-api, cron) hold the service role key. Deploy
// with --no-verify-jwt so this check is the sole gate.
function requireServiceAuthorization(request: Request, serviceRoleKey: string) {
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token || token !== serviceRoleKey) {
    throw new HttpError(401, 'This worker only accepts service-role calls.');
  }
}

async function readWorkerRequest(request: Request) {
  let body: unknown = null;

  try {
    body = await request.json();
  } catch {
    // An empty body means "process the next batch of queued jobs".
  }

  const record = isRecord(body) ? body : {};
  const jobId = typeof record.job_id === 'string' && record.job_id.trim() ? record.job_id.trim() : null;
  const limit =
    typeof record.limit === 'number' && Number.isFinite(record.limit)
      ? Math.min(Math.max(Math.floor(record.limit), 1), MAX_BATCH_LIMIT)
      : DEFAULT_BATCH_LIMIT;

  return { jobId, limit };
}

async function findQueuedJobs(supabase: SupabaseClient, jobId: string | null, limit: number) {
  let query = supabase
    .from('storey_processing_jobs')
    .select('id,storey_id,recording_session_id,status,attempts')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (jobId) {
    query = query.eq('id', jobId);
  }

  const { data: jobs, error } = await query;

  if (error) {
    throw new HttpError(500, 'Could not load queued processing jobs.');
  }

  return (jobs ?? []) as JobRow[];
}

// Claiming flips queued -> transcribing and bumps attempts in one statement,
// so a concurrent worker run claims zero rows and skips the job.
async function claimJob(supabase: SupabaseClient, job: JobRow) {
  const { data: claimed, error } = await supabase
    .from('storey_processing_jobs')
    .update({ status: 'transcribing', attempts: job.attempts + 1, error_code: null, error_message: null })
    .eq('id', job.id)
    .eq('status', 'queued')
    .select('id,storey_id,recording_session_id,status,attempts');

  if (error) {
    throw new HttpError(500, 'Could not claim the processing job.');
  }

  return claimed && claimed.length > 0 ? (claimed[0] as JobRow) : null;
}

async function processJob(supabase: SupabaseClient, aiProvider: OpenAIProvider, job: JobRow) {
  const { data: storey, error: storeyError } = await supabase
    .from('memories')
    .select('id,user_id,audio_url')
    .eq('id', job.storey_id)
    .maybeSingle();

  if (storeyError || !storey) {
    throw new Error('The Storey for this job no longer exists.');
  }

  if (!storey.audio_url) {
    throw new Error('The Storey has no uploaded audio to process.');
  }

  await supabase.from('memories').update({ processing_status: 'transcribing' }).eq('id', storey.id);

  const { data: audioBlob, error: downloadError } = await supabase.storage
    .from(STOREY_AUDIO_BUCKET)
    .download(storey.audio_url);

  if (downloadError || !audioBlob) {
    throw new Error('Could not download the Storey audio from storage.');
  }

  const transcript = await aiProvider.transcribeAudio(audioBlob, getAudioFileName(storey.audio_url));

  await supabase.from('storey_processing_jobs').update({ status: 'summarizing' }).eq('id', job.id);
  await supabase.from('memories').update({ processing_status: 'summarizing' }).eq('id', storey.id);

  const ownerFirstName = await findOwnerFirstName(supabase, storey.user_id);
  const summary = await aiProvider.summarizeMemory(transcript, { ownerFirstName });

  const { error: updateError } = await supabase
    .from('memories')
    .update({
      title: summary.title,
      summary: summary.summary,
      transcript,
      emotional_tone: summary.emotional_tone,
      tags: summary.tags,
      memorable_quotes: summary.memorable_quotes,
      processing_status: 'ready',
    })
    .eq('id', storey.id);

  if (updateError) {
    throw new Error('Could not save the processed Storey.');
  }

  if (job.recording_session_id) {
    await supabase
      .from('recording_sessions')
      .update({ state: 'ready' })
      .eq('id', job.recording_session_id);
  }

  await supabase.from('storey_processing_jobs').update({ status: 'ready' }).eq('id', job.id);
}

// Retryable failures return to the queue until MAX_ATTEMPTS is reached; the
// Storey mirrors the terminal failure so the app can surface it.
async function failJob(supabase: SupabaseClient, job: JobRow, message: string) {
  const isTerminal = job.attempts >= MAX_ATTEMPTS;

  await supabase
    .from('storey_processing_jobs')
    .update({
      status: isTerminal ? 'failed' : 'queued',
      error_code: isTerminal ? 'processing_failed' : 'retrying',
      error_message: message.slice(0, 500),
    })
    .eq('id', job.id);

  if (isTerminal) {
    await supabase.from('memories').update({ processing_status: 'failed' }).eq('id', job.storey_id);

    if (job.recording_session_id) {
      await supabase
        .from('recording_sessions')
        .update({ state: 'failed', error_code: 'processing_failed', error_message: message.slice(0, 500) })
        .eq('id', job.recording_session_id);
    }
  }
}

async function findOwnerFirstName(supabase: SupabaseClient, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name,first_name')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  const firstName = typeof profile.first_name === 'string' ? profile.first_name.trim() : '';

  if (firstName) {
    return firstName.split(' ')[0];
  }

  const displayName = typeof profile.display_name === 'string' ? profile.display_name.trim() : '';

  return displayName ? displayName.split(' ')[0] : null;
}

function getAudioFileName(audioPath: string) {
  return audioPath.split('/').at(-1) || 'audio.m4a';
}

function readEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new HttpError(500, `${name} is not configured.`);
  }

  return value;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
