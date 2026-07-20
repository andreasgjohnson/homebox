import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import type { OpenAIProvider } from '../_shared/services/ai/openai.ts';
import { EmptyTranscriptionError } from '../_shared/services/ai/openai.ts';
import { processJob } from './index.ts';

// The point of these tests is the OpenAI spy. The gates exist to keep audio away
// from the paid APIs, so the assertion that matters is not what the row says
// afterwards — it is that transcribe/summarize were never called at all.

type Writes = Record<string, unknown>;

function fakeSupabase(options: {
  durationMs: number | null;
  audioUrl?: string | null;
  removed: string[];
  writes: Record<string, Writes[]>;
}) {
  const record = (table: string, values: Writes) => {
    options.writes[table] = [...(options.writes[table] ?? []), values];
  };

  const query = (table: string) => {
    const state: { op: string; values: Writes } = { op: 'select', values: {} };

    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      update: (values: Writes) => {
        state.op = 'update';
        state.values = values;
        record(table, values);
        return builder;
      },
      maybeSingle: () => {
        if (table === 'memories') {
          return Promise.resolve({
            data: { id: 'storey-1', user_id: 'user-1', audio_url: options.audioUrl ?? 'user-1/storey-1/a.wav' },
            error: null,
          });
        }
        if (table === 'recording_sessions') {
          return Promise.resolve({ data: { duration_ms: options.durationMs }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      // Awaiting the builder directly (as the worker does for updates).
      then: (resolve: (value: unknown) => unknown) => resolve({ data: null, error: null }),
    };

    return builder;
  };

  return {
    from: (table: string) => query(table),
    storage: {
      from: () => ({
        download: () =>
          Promise.resolve({ data: new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' }), error: null }),
        remove: (paths: string[]) => {
          options.removed.push(...paths);
          return Promise.resolve({ error: null });
        },
      }),
    },
  } as unknown as SupabaseClient;
}

function spyProvider(transcript: string | Error) {
  const calls = { transcribe: 0, summarize: 0 };

  const provider = {
    transcribeAudio: (_audio: Blob, _fileName: string) => {
      calls.transcribe++;
      if (transcript instanceof Error) {
        return Promise.reject(transcript);
      }
      return Promise.resolve(transcript);
    },
    summarizeMemory: (_transcript: string) => {
      calls.summarize++;
      return Promise.resolve({
        title: 'A title',
        summary: 'A summary',
        emotional_tone: 'Warm',
        tags: ['family'],
        memorable_quotes: [],
      });
    },
  } as unknown as OpenAIProvider;

  return { provider, calls };
}

const job = { id: 'job-1', storey_id: 'storey-1', recording_session_id: 'session-1', status: 'transcribing', attempts: 1 };

Deno.test('a 2.5s slipped button never reaches OpenAI', async () => {
  const removed: string[] = [];
  const writes: Record<string, Writes[]> = {};
  const supabase = fakeSupabase({ durationMs: 2500, removed, writes });
  const { provider, calls } = spyProvider('should never be requested');

  await processJob(supabase, provider, job);

  assertEquals(calls.transcribe, 0);
  assertEquals(calls.summarize, 0);
  assertEquals(writes.memories?.some((w) => w.processing_status === 'discarded'), true);
  assertEquals(writes.storey_processing_jobs?.some((w) => w.status === 'discarded'), true);
  assertEquals(writes.recording_sessions?.some((w) => w.state === 'discarded'), true);
  assertEquals(removed, ['user-1/storey-1/a.wav']);
});

Deno.test('a short recording is never marked failed — nothing went wrong', async () => {
  const writes: Record<string, Writes[]> = {};
  const supabase = fakeSupabase({ durationMs: 900, removed: [], writes });
  const { provider } = spyProvider('unused');

  await processJob(supabase, provider, job);

  assertEquals(writes.memories?.some((w) => w.processing_status === 'failed'), false);
  assertEquals(writes.storey_processing_jobs?.some((w) => w.status === 'failed'), false);
});

Deno.test('a real recording is transcribed and summarized as before', async () => {
  const writes: Record<string, Writes[]> = {};
  const supabase = fakeSupabase({ durationMs: 42000, removed: [], writes });
  const { provider, calls } = spyProvider(
    'Grandma told me about the summer she learned to drive the tractor and nearly took out the barn door.',
  );

  await processJob(supabase, provider, job);

  assertEquals(calls.transcribe, 1);
  assertEquals(calls.summarize, 1);
  assertEquals(writes.memories?.some((w) => w.processing_status === 'ready'), true);
});

Deno.test('a long-but-empty recording is transcribed once, then let go before summarizing', async () => {
  const removed: string[] = [];
  const writes: Record<string, Writes[]> = {};
  const supabase = fakeSupabase({ durationMs: 20000, removed, writes });
  const { provider, calls } = spyProvider('Thank you.');

  await processJob(supabase, provider, job);

  // Whisper is unavoidable here — words cannot be counted without it. The
  // summarization call is what the gate saves.
  assertEquals(calls.transcribe, 1);
  assertEquals(calls.summarize, 0);
  assertEquals(writes.memories?.some((w) => w.processing_status === 'discarded'), true);
  assertEquals(removed, ['user-1/storey-1/a.wav']);
});

Deno.test('silence discards instead of burning three Whisper retries', async () => {
  const writes: Record<string, Writes[]> = {};
  const supabase = fakeSupabase({ durationMs: 20000, removed: [], writes });
  const { provider, calls } = spyProvider(new EmptyTranscriptionError());

  await processJob(supabase, provider, job);

  assertEquals(calls.transcribe, 1);
  assertEquals(calls.summarize, 0);
  assertEquals(writes.memories?.some((w) => w.processing_status === 'discarded'), true);
  assertEquals(writes.storey_processing_jobs?.some((w) => w.status === 'failed'), false);
});

Deno.test('a genuine OpenAI outage still fails and retries — it is not a discard', async () => {
  const writes: Record<string, Writes[]> = {};
  const supabase = fakeSupabase({ durationMs: 20000, removed: [], writes });
  const { provider } = spyProvider(new Error('OpenAI request failed with status 503.'));

  let threw = false;

  try {
    await processJob(supabase, provider, job);
  } catch {
    threw = true;
  }

  // processJob must throw so the caller's failJob() re-queues it. Discarding a
  // real Storey because OpenAI had a bad minute would lose it forever.
  assertEquals(threw, true);
  assertEquals(writes.memories?.some((w) => w.processing_status === 'discarded'), false);
});

Deno.test('an unknown duration still transcribes — absent evidence is not a slip', async () => {
  const writes: Record<string, Writes[]> = {};
  const supabase = fakeSupabase({ durationMs: null, removed: [], writes });
  const { provider, calls } = spyProvider(
    'This is a legacy row with no duration recorded but it is a real story worth keeping.',
  );

  await processJob(supabase, provider, job);

  assertEquals(calls.transcribe, 1);
  assertEquals(writes.memories?.some((w) => w.processing_status === 'ready'), true);
});
