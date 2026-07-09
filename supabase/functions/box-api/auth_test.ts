import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { authenticateBox } from './auth.ts';
import { sha256Base64, toBase64 } from './crypto.ts';
import { HttpError } from './http.ts';

const encoder = new TextEncoder();

const boxRow = {
  id: 'b7e8c9d0-1111-2222-3333-444455556666',
  public_device_id: 'box_test_device',
  name: 'Bedside Box',
  location: 'Bedside',
  lifecycle_status: 'paired',
  cloud_state: 'idle',
  paired_at: '2026-07-01T00:00:00Z',
  needs_attention_reason: null,
};

function fakeSupabase(publicKey: string) {
  const credential = {
    key_id: 'key_test',
    credential_type: 'ed25519',
    public_key: publicKey,
    status: 'active',
    box: boxRow,
  };

  const chain = {
    select: () => chain,
    eq: () => chain,
    update: () => chain,
    maybeSingle: () => Promise.resolve({ data: credential, error: null }),
    then: (resolve: (value: { data: null; error: null }) => void) => resolve({ data: null, error: null }),
  };

  return { from: () => chain } as unknown as SupabaseClient;
}

async function buildSignedRequest(privateKey: CryptoKey, publicKey: string, options: { path?: string; ts?: string } = {}) {
  const path = options.path ?? '/v1/heartbeat';
  const ts = options.ts ?? new Date().toISOString();
  const body = { request_id: 'req_test_1', box_id: boxRow.public_device_id, sent_at: ts, state: 'idle' };
  const rawBody = encoder.encode(JSON.stringify(body));
  const digestHeader = `SHA-256=${await sha256Base64(rawBody)}`;
  const signingString = ['POST', '/v1/heartbeat', ts, 'nonce_test', digestHeader].join('\n');
  const signature = new Uint8Array(await crypto.subtle.sign('Ed25519', privateKey, encoder.encode(signingString)));

  const request = new Request(`https://example.test/box-api${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Storeybox-Signature box_id="${boxRow.public_device_id}", key_id="key_test", ts="${ts}", nonce="nonce_test", sig="${toBase64(signature)}"`,
      Digest: digestHeader,
    },
    body: rawBody,
  });

  return { request, rawBody, body: body as unknown as Record<string, unknown>, supabase: fakeSupabase(publicKey), path };
}

Deno.test('authenticateBox accepts a correctly signed hardware request', async () => {
  const keyPair = (await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify'])) as CryptoKeyPair;
  const publicKey = toBase64(new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey)));
  const { request, rawBody, body, supabase } = await buildSignedRequest(keyPair.privateKey, publicKey);

  const box = await authenticateBox(supabase, request, '/v1/heartbeat', rawBody, body);

  if (box.id !== boxRow.id) {
    throw new Error('expected the authenticated box row to be returned');
  }
});

Deno.test('authenticateBox rejects a signature over a different path', async () => {
  const keyPair = (await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify'])) as CryptoKeyPair;
  const publicKey = toBase64(new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey)));
  const { request, rawBody, body, supabase } = await buildSignedRequest(keyPair.privateKey, publicKey);

  await assertHttpError(() => authenticateBox(supabase, request, '/v1/errors', rawBody, body), 401);
});

Deno.test('authenticateBox rejects a stale timestamp', async () => {
  const keyPair = (await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify'])) as CryptoKeyPair;
  const publicKey = toBase64(new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey)));
  const staleTs = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { request, rawBody, body, supabase } = await buildSignedRequest(keyPair.privateKey, publicKey, { ts: staleTs });

  await assertHttpError(() => authenticateBox(supabase, request, '/v1/heartbeat', rawBody, body), 401);
});

Deno.test('authenticateBox rejects a tampered body', async () => {
  const keyPair = (await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify'])) as CryptoKeyPair;
  const publicKey = toBase64(new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey)));
  const { request, body, supabase } = await buildSignedRequest(keyPair.privateKey, publicKey);
  const tamperedBody = encoder.encode(JSON.stringify({ ...body, state: 'needs_attention' }));

  await assertHttpError(() => authenticateBox(supabase, request, '/v1/heartbeat', tamperedBody, body), 401);
});

async function assertHttpError(run: () => Promise<unknown>, status: number) {
  try {
    await run();
  } catch (error) {
    if (error instanceof HttpError && error.status === status) {
      return;
    }

    throw new Error(`expected HttpError(${status}), got: ${error}`);
  }

  throw new Error(`expected HttpError(${status}), but the call succeeded`);
}
