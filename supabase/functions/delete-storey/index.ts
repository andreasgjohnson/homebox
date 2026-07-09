import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STOREY_AUDIO_BUCKET = 'memory-audio';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Server-side Storey deletion: verifies the signed-in owner, then removes the
// memories row (processing jobs cascade, recording sessions unlink) and the
// private audio object together. Clients no longer hold DELETE on memories or
// memory-audio, so this function is the only deletion path.
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
    const anonKey = readEnv('SUPABASE_ANON_KEY');
    const authHeader = request.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      throw new HttpError(401, 'Deleting a Storey requires a signed-in user.');
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await anonClient.auth.getUser(token);

    if (userError || !user) {
      throw new HttpError(401, 'Could not verify the signed-in user.');
    }

    const storeyId = await readStoreyId(request);
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const { data: storey, error: storeyError } = await supabase
      .from('memories')
      .select('id,user_id,audio_url')
      .eq('id', storeyId)
      .maybeSingle();

    if (storeyError) {
      throw new HttpError(500, 'Could not load the Storey.');
    }

    // A missing row and someone else's row look identical to the caller.
    if (!storey || storey.user_id !== user.id) {
      throw new HttpError(404, 'Storey not found.');
    }

    const { error: deleteError } = await supabase.from('memories').delete().eq('id', storey.id);

    if (deleteError) {
      throw new HttpError(500, 'Could not delete the Storey.');
    }

    let audioRemoved = true;

    if (storey.audio_url) {
      const { error: storageError } = await supabase.storage
        .from(STOREY_AUDIO_BUCKET)
        .remove([normalizeAudioPath(storey.audio_url)]);

      if (storageError) {
        // The Storey row is gone, which is what the user asked for; report the
        // cleanup miss instead of failing the whole request.
        console.error(`Could not remove audio for Storey ${storey.id}: ${storageError.message}`);
        audioRemoved = false;
      }
    }

    return json({ deleted: true, storey_id: storey.id, audio_removed: audioRemoved });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Could not delete the Storey.';

    return json({ error: message }, status);
  }
});

async function readStoreyId(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.');
  }

  if (typeof body !== 'object' || body === null) {
    throw new HttpError(400, 'Request body must be an object.');
  }

  const storeyId = (body as Record<string, unknown>).storey_id;

  if (typeof storeyId !== 'string' || storeyId.trim().length === 0) {
    throw new HttpError(400, 'storey_id is required.');
  }

  return storeyId.trim();
}

function normalizeAudioPath(audioPath: string) {
  const bucketPrefix = `${STOREY_AUDIO_BUCKET}/`;

  return audioPath.startsWith(bucketPrefix) ? audioPath.slice(bucketPrefix.length) : audioPath;
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

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
