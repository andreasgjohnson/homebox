import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { HttpError, isRecord } from './http.ts';

type EventInput = {
  boxId: string;
  requestId: string;
  eventType: string;
  observedAt: string;
  recordingSessionId?: string | null;
  request: Record<string, unknown>;
};

// Every signed hardware request is recorded in box_events keyed by its unique
// request_id. A replayed request_id returns the stored response instead of
// re-running the handler, which makes all hardware endpoints idempotent.
export async function beginIdempotentEvent(supabase: SupabaseClient, input: EventInput) {
  const { error } = await supabase.from('box_events').insert({
    box_id: input.boxId,
    recording_session_id: input.recordingSessionId ?? null,
    request_id: input.requestId,
    event_type: input.eventType,
    observed_at: input.observedAt,
    payload: { request: input.request },
  });

  if (!error) {
    return null;
  }

  if (error.code !== '23505') {
    throw new HttpError(500, 'Could not record the hardware event.');
  }

  const { data: existing } = await supabase
    .from('box_events')
    .select('payload')
    .eq('request_id', input.requestId)
    .maybeSingle();

  const payload = isRecord(existing) && isRecord(existing.payload) ? existing.payload : null;
  const response = payload && isRecord(payload.response) ? payload.response : null;

  if (response) {
    return response;
  }

  throw new HttpError(409, 'This request is already being processed. Retry shortly.');
}

export async function finishIdempotentEvent(
  supabase: SupabaseClient,
  requestId: string,
  request: Record<string, unknown>,
  response: Record<string, unknown>,
  recordingSessionId?: string | null,
) {
  const update: Record<string, unknown> = { payload: { request, response } };

  if (recordingSessionId) {
    update.recording_session_id = recordingSessionId;
  }

  await supabase.from('box_events').update(update).eq('request_id', requestId);
}
