import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { OpenAIProvider } from '../_shared/services/ai/openai.ts';

const MEMORY_AUDIO_BUCKET = 'memory-audio';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const detailMemoryColumns =
  'id,user_id,title,summary,transcript,emotional_tone,tags,memorable_quotes,audio_url,recorded_at,created_at';

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  try {
    const supabaseUrl = readEnv('SUPABASE_URL');
    const supabaseAnonKey = readEnv('SUPABASE_ANON_KEY');
    const openAIKey = readEnv('OPENAI_API_KEY');
    const authHeader = request.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      throw new HttpError(401, 'Missing authorization token.');
    }

    const { memoryId, audioPath } = await readProcessRequest(request);
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new HttpError(401, 'Could not verify the signed-in user.');
    }

    const { data: memory, error: memoryError } = await supabase
      .from('memories')
      .select(detailMemoryColumns)
      .eq('id', memoryId)
      .eq('user_id', user.id)
      .single();

    if (memoryError || !memory) {
      throw new HttpError(404, 'Memory not found.');
    }

    if (memory.audio_url !== audioPath) {
      throw new HttpError(403, 'Audio path does not match this memory.');
    }

    if (!audioPath.startsWith(`${user.id}/`)) {
      throw new HttpError(403, 'Audio path is outside this user archive.');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name,first_name,last_name')
      .eq('id', user.id)
      .single();
    const ownerFirstName = getOwnerFirstName(profile);

    const { data: audioBlob, error: downloadError } = await supabase.storage
      .from(MEMORY_AUDIO_BUCKET)
      .download(audioPath);

    if (downloadError || !audioBlob) {
      throw new HttpError(404, 'Could not download the memory audio.');
    }

    const aiProvider = new OpenAIProvider(
      openAIKey,
      Deno.env.get('OPENAI_TRANSCRIBE_MODEL') ?? undefined,
      Deno.env.get('OPENAI_SUMMARY_MODEL') ?? undefined,
    );
    const transcript = await aiProvider.transcribeAudio(
      audioBlob,
      getAudioFileName(audioPath, audioBlob.type),
    );
    const summary = await aiProvider.summarizeMemory(transcript, { ownerFirstName });

    const { data: updatedMemory, error: updateError } = await supabase
      .from('memories')
      .update({
        title: summary.title,
        summary: summary.summary,
        transcript,
        emotional_tone: summary.emotional_tone,
        tags: summary.tags,
        memorable_quotes: summary.memorable_quotes,
      })
      .eq('id', memoryId)
      .eq('user_id', user.id)
      .select(detailMemoryColumns)
      .single();

    if (updateError || !updatedMemory) {
      throw new HttpError(500, 'Could not save the processed memory.');
    }

    return json({ memory: updatedMemory });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Could not process memory.';

    return json({ error: message }, status);
  }
});

async function readProcessRequest(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.');
  }

  if (!isRecord(body)) {
    throw new HttpError(400, 'Request body must be an object.');
  }

  const memoryId = body.memoryId;
  const audioPath = body.audioPath;

  if (typeof memoryId !== 'string' || memoryId.trim().length === 0) {
    throw new HttpError(400, 'memoryId is required.');
  }

  if (typeof audioPath !== 'string' || audioPath.trim().length === 0) {
    throw new HttpError(400, 'audioPath is required.');
  }

  return {
    memoryId: memoryId.trim(),
    audioPath: audioPath.trim(),
  };
}

function readEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new HttpError(500, `${name} is not configured.`);
  }

  return value;
}

function getAudioFileName(audioPath: string, mimeType: string) {
  const pathFileName = audioPath.split('/').at(-1) || '';
  const extension = getAudioExtension(mimeType);

  if (!extension) {
    return pathFileName || 'audio.m4a';
  }

  return `audio.${extension}`;
}

function getAudioExtension(mimeType: string) {
  const normalizedMimeType = mimeType.toLowerCase().split(';')[0].trim();

  switch (normalizedMimeType) {
    case 'audio/webm':
      return 'webm';
    case 'audio/mp4':
    case 'audio/m4a':
    case 'audio/x-m4a':
      return 'm4a';
    case 'audio/mpeg':
      return 'mp3';
    case 'audio/wav':
      return 'wav';
    case 'audio/aac':
      return 'aac';
    default:
      return null;
  }
}

function getOwnerFirstName(profile: unknown) {
  if (!isRecord(profile)) {
    return null;
  }

  const firstName = readProfileString(profile.first_name);

  if (firstName) {
    return firstName.split(' ')[0] || null;
  }

  const displayName = readProfileString(profile.display_name);

  return displayName?.split(' ')[0] || null;
}

function readProfileString(value: unknown) {
  return typeof value === 'string' ? value.trim() : null;
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
