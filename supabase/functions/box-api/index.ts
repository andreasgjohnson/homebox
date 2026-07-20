import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { authenticateBox, type BoxRow } from './auth.ts';
import { randomNumericCode, randomToken, sha256Hex } from './crypto.ts';
import { beginIdempotentEvent, finishIdempotentEvent } from './events.ts';
import {
  corsHeaders,
  HttpError,
  isRecord,
  json,
  readBoolean,
  readEnv,
  readNonNegativeInt,
  readOptionalString,
  readString,
  readTimestamp,
} from './http.ts';

const STOREY_AUDIO_BUCKET = 'memory-audio';
const HEARTBEAT_INTERVAL_SECONDS = 60;
const OFFLINE_AFTER_SECONDS = 180;
// storage-js signed upload URLs are valid for a fixed two hours.
const SIGNED_UPLOAD_TTL_SECONDS = 7200;
const PAIRING_CODE_MIN_TTL_SECONDS = 60;
const PAIRING_CODE_MAX_TTL_SECONDS = 900;
const PREFERRED_AUDIO = {
  container: 'm4a',
  codec: 'aac',
  sample_rate_hz: 48000,
  channel_count: 1,
};

const CLOUD_STATES = new Set(['idle', 'recording', 'syncing', 'offline', 'needs_attention']);

const sessionColumns =
  'id,box_id,user_id,storey_id,client_recording_id,state,trigger,started_at,ended_at,audio_bucket,audio_path,sha256,container,file_size_bytes';

type BoxContext = {
  supabase: SupabaseClient;
  box: BoxRow;
  body: Record<string, unknown>;
  requestId: string;
};

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
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const routePath = getRoutePath(request.url);
    const rawBody = new Uint8Array(await request.arrayBuffer());
    const body = parseJsonBody(rawBody);

    if (routePath === '/v1/pairings/claim') {
      return json(await handlePairingClaim(supabase, supabaseUrl, request, body));
    }

    const box = await authenticateBox(supabase, request, routePath, rawBody, body);
    const requestId = readString(body, 'request_id');
    readTimestamp(body, 'sent_at');
    const observedAt = typeof body.observed_at === 'string' ? readTimestamp(body, 'observed_at') : new Date().toISOString();

    const route = matchBoxRoute(routePath);
    const replayedResponse = await beginIdempotentEvent(supabase, {
      boxId: box.id,
      requestId,
      eventType: route.eventType,
      observedAt,
      request: body,
    });

    if (replayedResponse) {
      return json(replayedResponse);
    }

    const context: BoxContext = { supabase, box, body, requestId };
    const { response, recordingSessionId } = await route.handler(context);
    await finishIdempotentEvent(supabase, requestId, body, response, recordingSessionId);

    return json(response);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Box API request failed.';

    return json({ error: message }, status);
  }
});

type BoxRouteResult = {
  response: Record<string, unknown>;
  recordingSessionId?: string | null;
};

type BoxRoute = {
  eventType: string;
  handler: (context: BoxContext) => Promise<BoxRouteResult>;
};

function matchBoxRoute(routePath: string): BoxRoute {
  const staticRoutes: Record<string, BoxRoute> = {
    '/v1/hello': { eventType: 'hello', handler: handleHello },
    '/v1/pairing-codes': { eventType: 'pairing_code_issued', handler: handlePairingCodes },
    '/v1/heartbeat': { eventType: 'heartbeat', handler: handleHeartbeat },
    '/v1/recordings/start': { eventType: 'recording_started', handler: handleRecordingStart },
    '/v1/recordings/complete': { eventType: 'recording_completed', handler: handleRecordingComplete },
    '/v1/errors': { eventType: 'error_reported', handler: handleErrorReport },
  };

  const staticRoute = staticRoutes[routePath];

  if (staticRoute) {
    return staticRoute;
  }

  const sessionMatch = routePath.match(
    /^\/v1\/recordings\/([0-9a-f-]{36})\/(upload-url|upload-complete|sync-complete|pins)$/,
  );

  if (sessionMatch) {
    const sessionId = sessionMatch[1];
    const action = sessionMatch[2];
    const routesBySessionAction: Record<string, { eventType: string; handler: SessionHandler }> = {
      'upload-url': { eventType: 'upload_lease_issued', handler: handleUploadUrl },
      'upload-complete': { eventType: 'upload_completed', handler: handleUploadComplete },
      'sync-complete': { eventType: 'sync_completed', handler: handleSyncComplete },
      pins: { eventType: 'moment_pin', handler: handleMomentPin },
    };
    const sessionRoute = routesBySessionAction[action];

    return {
      eventType: sessionRoute.eventType,
      handler: (context) => sessionRoute.handler(context, sessionId),
    };
  }

  throw new HttpError(404, `Unknown box-api route: ${routePath}`);
}

function handleHello({ box }: BoxContext): Promise<BoxRouteResult> {
  return Promise.resolve({
    response: {
      accepted_at: new Date().toISOString(),
      lifecycle_status: box.lifecycle_status,
      box_state: box.cloud_state,
      paired: box.lifecycle_status === 'paired',
    },
  });
}

async function handlePairingCodes({ supabase, box, body }: BoxContext): Promise<BoxRouteResult> {
  const displayCodeFormat = readOptionalString(body, 'display_code_format') ?? 'numeric_6';
  const requestedTtl =
    body.expires_in_seconds === undefined ? 600 : readNonNegativeInt(body, 'expires_in_seconds');
  const ttlSeconds = Math.min(
    Math.max(requestedTtl, PAIRING_CODE_MIN_TTL_SECONDS),
    PAIRING_CODE_MAX_TTL_SECONDS,
  );

  const pairingCode = randomNumericCode(6);
  const pairingNonce = randomToken('pn_');
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const { error } = await supabase.from('box_pairing_codes').insert({
    box_id: box.id,
    code_hash: await sha256Hex(pairingCode),
    pairing_nonce_hash: await sha256Hex(pairingNonce),
    display_code_format: displayCodeFormat,
    expires_at: expiresAt,
  });

  if (error) {
    throw new HttpError(500, 'Could not issue a pairing code.');
  }

  return {
    response: {
      pairing_code: pairingCode,
      pairing_uri: `storeybox://pair?box_id=${box.public_device_id}&nonce=${pairingNonce}`,
      expires_at: expiresAt,
      box_state: box.lifecycle_status === 'paired' ? box.cloud_state : 'unpaired',
    },
  };
}

async function handleHeartbeat({ supabase, box, body }: BoxContext): Promise<BoxRouteResult> {
  const state = readString(body, 'state');

  if (!CLOUD_STATES.has(state)) {
    throw new HttpError(400, `state must be one of: ${[...CLOUD_STATES].join(', ')}.`);
  }

  const network = isRecord(body.network) ? body.network : null;
  const storage = isRecord(body.storage) ? body.storage : null;
  const reportedError = isRecord(body.error) ? body.error : null;
  const activeSessionId = await resolveActiveSessionId(supabase, box, body.active_recording_session_id);

  const { error } = await supabase
    .from('boxes')
    .update({
      cloud_state: state,
      last_heartbeat_at: new Date().toISOString(),
      firmware_version: readOptionalString(body, 'firmware_version'),
      battery_percent: typeof body.battery_percent === 'number' ? Math.round(body.battery_percent) : null,
      power_source: readOptionalString(body, 'power'),
      network_type: network && typeof network.type === 'string' ? network.type : null,
      wifi_rssi: network && typeof network.rssi === 'number' ? Math.round(network.rssi) : null,
      free_storage_bytes: storage && typeof storage.free_bytes === 'number' ? Math.floor(storage.free_bytes) : null,
      queued_recordings:
        storage && typeof storage.queued_recordings === 'number' ? Math.floor(storage.queued_recordings) : null,
      active_recording_session_id: activeSessionId,
      needs_attention_reason:
        state === 'needs_attention'
          ? (reportedError && typeof reportedError.message === 'string' && reportedError.message) ||
            box.needs_attention_reason ||
            'The Box reported that it needs attention.'
          : null,
    })
    .eq('id', box.id);

  if (error) {
    throw new HttpError(500, 'Could not record the heartbeat.');
  }

  const ownerUserId = await findOwnerUserId(supabase, box.id);

  return {
    response: {
      accepted_at: new Date().toISOString(),
      server_time: new Date().toISOString(),
      paired: box.lifecycle_status === 'paired' && Boolean(ownerUserId),
      box: {
        name: box.name,
        location: box.location,
        cloud_state: state,
      },
      config: {
        heartbeat_interval_seconds: HEARTBEAT_INTERVAL_SECONDS,
        offline_after_seconds: OFFLINE_AFTER_SECONDS,
        preferred_audio: PREFERRED_AUDIO,
      },
      commands: [],
    },
  };
}

async function handleRecordingStart({ supabase, box, body }: BoxContext): Promise<BoxRouteResult> {
  const clientRecordingId = readString(body, 'client_recording_id');
  const startedAt = readTimestamp(body, 'started_at');
  const trigger = readOptionalString(body, 'trigger') ?? 'button';
  const audio = isRecord(body.audio) ? body.audio : {};
  const ownerUserId = await requireOwnerUserId(supabase, box);

  let session = await findSessionByClientRecordingId(supabase, box.id, clientRecordingId);

  if (!session) {
    const { data: created, error } = await supabase
      .from('recording_sessions')
      .insert({
        box_id: box.id,
        user_id: ownerUserId,
        client_recording_id: clientRecordingId,
        state: 'recording',
        trigger,
        started_at: startedAt,
        codec: typeof audio.codec === 'string' ? audio.codec : null,
        container: typeof audio.container === 'string' ? audio.container : null,
        sample_rate_hz: typeof audio.sample_rate_hz === 'number' ? Math.floor(audio.sample_rate_hz) : null,
        channel_count: typeof audio.channel_count === 'number' ? Math.floor(audio.channel_count) : null,
      })
      .select(sessionColumns)
      .single();

    if (error || !created) {
      // A concurrent retry may have inserted the same client_recording_id.
      session = await findSessionByClientRecordingId(supabase, box.id, clientRecordingId);

      if (!session) {
        throw new HttpError(500, 'Could not create the recording session.');
      }
    } else {
      session = created;
    }
  }

  await supabase
    .from('boxes')
    .update({ cloud_state: 'recording', active_recording_session_id: session.id })
    .eq('id', box.id);

  return {
    recordingSessionId: session.id,
    response: {
      recording_session_id: session.id,
      box_state: 'recording',
      app_box_state: 'recording',
      accepted_at: new Date().toISOString(),
    },
  };
}

async function handleRecordingComplete({ supabase, box, body }: BoxContext): Promise<BoxRouteResult> {
  const sessionId = readString(body, 'recording_session_id');
  const clientRecordingId = readString(body, 'client_recording_id');
  const endedAt = readTimestamp(body, 'ended_at');
  const durationMs = readNonNegativeInt(body, 'duration_ms');
  const fileSizeBytes = readNonNegativeInt(body, 'file_size_bytes');
  const sha256 = readString(body, 'sha256');
  const interrupted = body.interrupted === undefined ? false : readBoolean(body, 'interrupted');

  const session = await requireSession(supabase, box, sessionId);

  if (session.client_recording_id !== clientRecordingId) {
    throw new HttpError(409, 'client_recording_id does not match this recording session.');
  }

  const userId = session.user_id ?? (await requireOwnerUserId(supabase, box));
  let storeyId = session.storey_id;

  if (!storeyId) {
    const { data: storey, error: storeyError } = await supabase
      .from('memories')
      .insert({
        user_id: userId,
        box_id: box.id,
        source: 'box',
        processing_status: 'awaiting_upload',
        recorded_at: session.started_at,
        title: null,
        summary: null,
        transcript: null,
        emotional_tone: null,
        tags: [],
        memorable_quotes: [],
        audio_url: null,
        captured_by_box_name: box.name,
        captured_at_location: box.location,
        provenance_label: `KEPT AT HOME · Captured by ${box.name}`,
      })
      .select('id')
      .single();

    if (storeyError || !storey) {
      throw new HttpError(500, 'Could not create the Storey placeholder.');
    }

    storeyId = storey.id as string;
  }

  const audioFile = getAudioFile(session.container);
  const audioPath = session.audio_path ?? `${userId}/${storeyId}/${audioFile.fileName}`;
  const upload = await createUploadLease(supabase, audioPath, sha256, audioFile.contentType);

  const { error: sessionError } = await supabase
    .from('recording_sessions')
    .update({
      state: 'uploading',
      storey_id: storeyId,
      user_id: userId,
      ended_at: endedAt,
      duration_ms: durationMs,
      file_size_bytes: fileSizeBytes,
      sha256,
      interrupted,
      audio_bucket: STOREY_AUDIO_BUCKET,
      audio_path: audioPath,
      upload_started_at: new Date().toISOString(),
    })
    .eq('id', session.id);

  if (sessionError) {
    throw new HttpError(500, 'Could not update the recording session.');
  }

  await supabase
    .from('memories')
    .update({ recording_session_id: session.id })
    .eq('id', storeyId);

  await supabase
    .from('boxes')
    .update({ cloud_state: 'syncing', active_recording_session_id: null })
    .eq('id', box.id);

  return {
    recordingSessionId: session.id,
    response: {
      recording_session_id: session.id,
      storey_id: storeyId,
      box_state: 'syncing',
      app_box_state: 'syncing',
      storey: {
        user_id: userId,
        recorded_at: session.started_at,
        processing_status: 'awaiting_upload',
        provenance_label: `KEPT AT HOME · Captured by ${box.name}`,
      },
      upload,
    },
  };
}

type SessionHandler = (context: BoxContext, sessionId: string) => Promise<BoxRouteResult>;

async function handleUploadUrl({ supabase, box, body }: BoxContext, sessionId: string): Promise<BoxRouteResult> {
  const session = await requireSession(supabase, box, sessionId);

  if (!session.audio_path || !session.storey_id) {
    throw new HttpError(409, 'This recording has no allocated upload path yet. Call recordings/complete first.');
  }

  const requestSha = readOptionalString(body, 'sha256');

  if (requestSha && session.sha256 && requestSha !== session.sha256) {
    throw new HttpError(409, 'sha256 does not match the completed recording.');
  }

  const audioFile = getAudioFile(session.container);
  const upload = await createUploadLease(supabase, session.audio_path, session.sha256, audioFile.contentType);

  await supabase
    .from('recording_sessions')
    .update({ upload_started_at: new Date().toISOString() })
    .eq('id', session.id);

  return {
    recordingSessionId: session.id,
    response: {
      recording_session_id: session.id,
      storey_id: session.storey_id,
      upload,
    },
  };
}

async function handleUploadComplete({ supabase, box, body }: BoxContext, sessionId: string): Promise<BoxRouteResult> {
  const session = await requireSession(supabase, box, sessionId);
  const upload = isRecord(body.upload) ? body.upload : null;

  if (!upload) {
    throw new HttpError(400, 'upload is required.');
  }

  if (!session.audio_path || !session.storey_id) {
    throw new HttpError(409, 'This recording has no allocated upload path yet. Call recordings/complete first.');
  }

  // A Box that loses power between upload-complete and deleting its local file
  // retries the whole sync, landing here a second time. If the worker already
  // let this recording go, re-queueing it would restore a Storey whose job is
  // terminal and will never claim it again — a ghost stuck at "queued" in the
  // archive. The session's own state cannot answer this: recordings/complete
  // resets it to 'uploading' on the way back through. The Storey's status is
  // what survives the retry, so that is what decides.
  if (await isStoreyDiscarded(supabase, session.storey_id)) {
    await supabase
      .from('recording_sessions')
      .update({ state: 'discarded' })
      .eq('id', session.id);

    // The retry re-uploaded audio the worker had already deleted; drop it again
    // rather than leave an object no Storey points at.
    await supabase.storage.from(STOREY_AUDIO_BUCKET).remove([session.audio_path]);
    await supabase.from('boxes').update({ cloud_state: 'idle' }).eq('id', box.id);

    return {
      recordingSessionId: session.id,
      response: {
        recording_session_id: session.id,
        storey_id: session.storey_id,
        box_state: 'idle',
        app_box_state: 'idle',
        discarded: true,
        safe_to_delete_local: true,
      },
    };
  }

  if (upload.bucket !== STOREY_AUDIO_BUCKET || upload.path !== session.audio_path) {
    throw new HttpError(409, 'upload bucket/path does not match the allocated storage object.');
  }

  const objectSize = await findStorageObjectSize(supabase, session.audio_path);

  if (objectSize === null) {
    throw new HttpError(409, 'The uploaded object was not found in storage. Upload the audio, then retry.');
  }

  if (typeof upload.file_size_bytes === 'number' && objectSize > 0 && objectSize !== upload.file_size_bytes) {
    throw new HttpError(409, 'The uploaded object size does not match file_size_bytes.');
  }

  const { error: sessionError } = await supabase
    .from('recording_sessions')
    .update({ state: 'uploaded', uploaded_at: new Date().toISOString() })
    .eq('id', session.id);

  if (sessionError) {
    throw new HttpError(500, 'Could not mark the recording as uploaded.');
  }

  await supabase
    .from('memories')
    .update({ audio_url: session.audio_path, processing_status: 'queued' })
    .eq('id', session.storey_id);

  const job = await findOrCreateProcessingJob(supabase, session.storey_id, session.id);

  await supabase.from('boxes').update({ cloud_state: 'idle' }).eq('id', box.id);

  triggerStoreyProcessing(job.id as string);

  return {
    recordingSessionId: session.id,
    response: {
      recording_session_id: session.id,
      storey_id: session.storey_id,
      box_state: 'idle',
      app_box_state: 'syncing',
      processing_job: job,
      safe_to_delete_local: true,
    },
  };
}

async function handleSyncComplete({ supabase, box }: BoxContext, sessionId: string): Promise<BoxRouteResult> {
  const session = await requireSession(supabase, box, sessionId);

  await supabase.from('boxes').update({ cloud_state: 'idle' }).eq('id', box.id);

  return {
    recordingSessionId: session.id,
    response: {
      accepted_at: new Date().toISOString(),
      box_state: 'idle',
    },
  };
}

async function handleMomentPin({ supabase, box, body }: BoxContext, sessionId: string): Promise<BoxRouteResult> {
  const session = await requireSession(supabase, box, sessionId);
  const pin = isRecord(body.pin) ? body.pin : null;

  if (!pin || typeof pin.offset_ms !== 'number' || pin.offset_ms < 0) {
    throw new HttpError(400, 'pin.offset_ms is required.');
  }

  if (session.storey_id) {
    const { data: storey } = await supabase
      .from('memories')
      .select('moment_pins')
      .eq('id', session.storey_id)
      .maybeSingle();
    const existingPins = storey && Array.isArray(storey.moment_pins) ? storey.moment_pins : [];

    await supabase
      .from('memories')
      .update({
        moment_pins: [
          ...existingPins,
          {
            source: typeof pin.source === 'string' ? pin.source : 'unknown',
            offset_ms: Math.floor(pin.offset_ms),
            confidence: typeof pin.confidence === 'number' ? pin.confidence : null,
          },
        ],
      })
      .eq('id', session.storey_id);
  }

  return {
    recordingSessionId: session.id,
    response: {
      accepted_at: new Date().toISOString(),
    },
  };
}

async function handleErrorReport({ supabase, box, body }: BoxContext): Promise<BoxRouteResult> {
  const severity = readString(body, 'severity');
  const message = readString(body, 'message');
  const needsAttention = severity === 'fatal';
  let boxState = box.cloud_state;

  if (needsAttention) {
    boxState = 'needs_attention';
    await supabase
      .from('boxes')
      .update({ cloud_state: 'needs_attention', needs_attention_reason: message })
      .eq('id', box.id);
  }

  const reportedSessionId = readOptionalString(body, 'recording_session_id');

  return {
    recordingSessionId: reportedSessionId,
    response: {
      accepted_at: new Date().toISOString(),
      box_state: boxState,
      needs_attention: needsAttention,
    },
  };
}

async function handlePairingClaim(
  supabase: SupabaseClient,
  supabaseUrl: string,
  request: Request,
  body: Record<string, unknown>,
) {
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    throw new HttpError(401, 'Pairing requires a signed-in user.');
  }

  const anonClient = createClient(supabaseUrl, readEnv('SUPABASE_ANON_KEY'), {
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

  const pairingCode = readString(body, 'pairing_code');
  const pairingNonce = readOptionalString(body, 'pairing_nonce');
  const boxName = readString(body, 'box_name').slice(0, 80);
  const location = readOptionalString(body, 'location');

  const codeHash = await sha256Hex(pairingCode);
  const { data: codeRow } = await supabase
    .from('box_pairing_codes')
    .select('id,box_id,pairing_nonce_hash,expires_at,consumed_at')
    .eq('code_hash', codeHash)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!codeRow) {
    await recordClaim(supabase, null, null, user.id, 'rejected', 'invalid_code');
    throw new HttpError(404, 'That pairing code is not valid. Ask your Box for a fresh code.');
  }

  if (codeRow.consumed_at) {
    await recordClaim(supabase, codeRow.id, codeRow.box_id, user.id, 'already_consumed', 'code_already_used');
    throw new HttpError(409, 'That pairing code was already used. Ask your Box for a fresh code.');
  }

  if (new Date(codeRow.expires_at).getTime() < Date.now()) {
    await recordClaim(supabase, codeRow.id, codeRow.box_id, user.id, 'expired', 'code_expired');
    throw new HttpError(410, 'That pairing code expired. Ask your Box for a fresh code.');
  }

  if (pairingNonce && codeRow.pairing_nonce_hash && (await sha256Hex(pairingNonce)) !== codeRow.pairing_nonce_hash) {
    await recordClaim(supabase, codeRow.id, codeRow.box_id, user.id, 'rejected', 'nonce_mismatch');
    throw new HttpError(409, 'That pairing link does not match this Box. Ask your Box for a fresh code.');
  }

  // Consume the code atomically so two claims cannot both succeed.
  const { data: consumed } = await supabase
    .from('box_pairing_codes')
    .update({ consumed_at: new Date().toISOString(), consumed_by: user.id })
    .eq('id', codeRow.id)
    .is('consumed_at', null)
    .select('id');

  if (!consumed || consumed.length === 0) {
    await recordClaim(supabase, codeRow.id, codeRow.box_id, user.id, 'already_consumed', 'claim_race_lost');
    throw new HttpError(409, 'That pairing code was already used. Ask your Box for a fresh code.');
  }

  const ownerUserId = await findOwnerUserId(supabase, codeRow.box_id);

  if (!ownerUserId || ownerUserId !== user.id) {
    const role = ownerUserId ? 'member' : 'owner';
    const { error: membershipError } = await supabase
      .from('box_memberships')
      .upsert({ box_id: codeRow.box_id, user_id: user.id, role }, { onConflict: 'box_id,user_id' });

    if (membershipError) {
      throw new HttpError(500, 'Could not create the Box membership.');
    }
  }

  const pairedAt = new Date().toISOString();
  const { data: updatedBox, error: boxError } = await supabase
    .from('boxes')
    .update({
      name: boxName,
      location,
      lifecycle_status: 'paired',
      paired_at: pairedAt,
    })
    .eq('id', codeRow.box_id)
    .select('id,public_device_id,name,location,cloud_state,paired_at')
    .single();

  if (boxError || !updatedBox) {
    throw new HttpError(500, 'Could not update the Box after pairing.');
  }

  await recordClaim(supabase, codeRow.id, codeRow.box_id, user.id, 'accepted', null);

  return { box: updatedBox };
}

async function recordClaim(
  supabase: SupabaseClient,
  pairingCodeId: string | null,
  boxId: string | null,
  userId: string,
  status: 'accepted' | 'rejected' | 'expired' | 'already_consumed',
  failureReason: string | null,
) {
  await supabase.from('box_pairing_claims').insert({
    pairing_code_id: pairingCodeId,
    box_id: boxId,
    user_id: userId,
    claim_status: status,
    failure_reason: failureReason,
  });
}

type SessionRow = {
  id: string;
  box_id: string;
  user_id: string | null;
  storey_id: string | null;
  client_recording_id: string;
  state: string;
  started_at: string;
  audio_bucket: string | null;
  audio_path: string | null;
  sha256: string | null;
  container: string | null;
};

async function requireSession(supabase: SupabaseClient, box: BoxRow, sessionId: string): Promise<SessionRow> {
  const { data: session, error } = await supabase
    .from('recording_sessions')
    .select(sessionColumns)
    .eq('id', sessionId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, 'Could not load the recording session.');
  }

  if (!session || session.box_id !== box.id) {
    throw new HttpError(404, 'Recording session not found for this Box.');
  }

  return session as SessionRow;
}

async function findSessionByClientRecordingId(supabase: SupabaseClient, boxId: string, clientRecordingId: string) {
  const { data: session } = await supabase
    .from('recording_sessions')
    .select(sessionColumns)
    .eq('box_id', boxId)
    .eq('client_recording_id', clientRecordingId)
    .maybeSingle();

  return (session as SessionRow | null) ?? null;
}

async function findOwnerUserId(supabase: SupabaseClient, boxId: string) {
  const { data: owner } = await supabase
    .from('box_memberships')
    .select('user_id')
    .eq('box_id', boxId)
    .eq('role', 'owner')
    .maybeSingle();

  return owner?.user_id ?? null;
}

async function requireOwnerUserId(supabase: SupabaseClient, box: BoxRow) {
  const ownerUserId = await findOwnerUserId(supabase, box.id);

  if (!ownerUserId) {
    throw new HttpError(409, 'This Box is not paired to a user yet.');
  }

  return ownerUserId;
}

async function resolveActiveSessionId(supabase: SupabaseClient, box: BoxRow, value: unknown) {
  if (typeof value !== 'string' || !value) {
    return null;
  }

  const { data: session } = await supabase
    .from('recording_sessions')
    .select('id,box_id')
    .eq('id', value)
    .maybeSingle();

  return session && session.box_id === box.id ? session.id : null;
}

async function createUploadLease(
  supabase: SupabaseClient,
  audioPath: string,
  sha256: string | null,
  contentType: string,
) {
  const { data: lease, error } = await supabase.storage
    .from(STOREY_AUDIO_BUCKET)
    .createSignedUploadUrl(audioPath, { upsert: true });

  if (error || !lease) {
    throw new HttpError(500, 'Could not create a signed upload URL.');
  }

  const headers: Record<string, string> = { 'content-type': contentType };

  if (sha256) {
    headers['x-storeybox-sha256'] = sha256;
  }

  return {
    bucket: STOREY_AUDIO_BUCKET,
    path: audioPath,
    method: 'PUT',
    signed_url: lease.signedUrl,
    token: lease.token,
    expires_at: new Date(Date.now() + SIGNED_UPLOAD_TTL_SECONDS * 1000).toISOString(),
    headers,
  };
}

async function findStorageObjectSize(supabase: SupabaseClient, audioPath: string) {
  const separatorIndex = audioPath.lastIndexOf('/');
  const directory = audioPath.slice(0, separatorIndex);
  const fileName = audioPath.slice(separatorIndex + 1);

  const { data: entries, error } = await supabase.storage
    .from(STOREY_AUDIO_BUCKET)
    .list(directory, { search: fileName });

  if (error) {
    throw new HttpError(500, 'Could not verify the uploaded object.');
  }

  const entry = entries?.find((item) => item.name === fileName);

  if (!entry) {
    return null;
  }

  const size = isRecord(entry.metadata) ? entry.metadata.size : null;

  return typeof size === 'number' ? size : 0;
}

// 'discarded' is terminal: once the worker has let a recording go, no retry
// from the Box brings it back.
async function isStoreyDiscarded(supabase: SupabaseClient, storeyId: string) {
  const { data: storey } = await supabase
    .from('memories')
    .select('processing_status')
    .eq('id', storeyId)
    .maybeSingle();

  return storey?.processing_status === 'discarded';
}

async function findOrCreateProcessingJob(supabase: SupabaseClient, storeyId: string, sessionId: string) {
  const { data: existing } = await supabase
    .from('storey_processing_jobs')
    .select('id,status')
    .eq('recording_session_id', sessionId)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  const { data: job, error } = await supabase
    .from('storey_processing_jobs')
    .insert({ storey_id: storeyId, recording_session_id: sessionId, status: 'queued' })
    .select('id,status')
    .single();

  if (error || !job) {
    throw new HttpError(500, 'Could not queue the processing job.');
  }

  return job;
}

// Fire-and-forget kick of the processing worker so transcription starts
// immediately after upload; a cron backstop can drain anything this misses.
function triggerStoreyProcessing(jobId: string) {
  try {
    const supabaseUrl = readEnv('SUPABASE_URL');
    const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');
    const invocation = fetch(`${supabaseUrl}/functions/v1/process-storey-jobs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ job_id: jobId }),
    }).catch(() => {
      // The cron backstop retries queued jobs; upload-complete must not fail
      // because the worker kick did.
    });

    const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;
    runtime?.waitUntil?.(invocation);
  } catch {
    // Missing env only happens outside the edge runtime; never block the Box.
  }
}

function getAudioFile(container: string | null) {
  switch ((container ?? 'm4a').toLowerCase()) {
    case 'webm':
      return { fileName: 'audio.webm', contentType: 'audio/webm' };
    case 'wav':
      return { fileName: 'audio.wav', contentType: 'audio/wav' };
    case 'mp4':
    case 'm4a':
    default:
      return { fileName: 'audio.m4a', contentType: 'audio/mp4' };
  }
}

// Accepts /functions/v1/box-api/v1/..., /box-api/v1/..., or /v1/... and
// normalizes to the /v1/... route path that devices sign over.
function getRoutePath(url: string) {
  let path = new URL(url).pathname;
  path = path.replace(/^\/functions\/v1(?=\/)/, '');
  path = path.replace(/^\/box-api(?=\/)/, '');

  if (!path.startsWith('/v1/')) {
    throw new HttpError(404, `Unknown box-api route: ${path}`);
  }

  return path.replace(/\/+$/, '');
}

function parseJsonBody(rawBody: Uint8Array) {
  let body: unknown;

  try {
    body = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.');
  }

  if (!isRecord(body)) {
    throw new HttpError(400, 'Request body must be an object.');
  }

  return body;
}
