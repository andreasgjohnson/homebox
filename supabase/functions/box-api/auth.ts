import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { fromBase64, sha256Base64, verifyDeviceSignature } from './crypto.ts';
import { HttpError, isRecord } from './http.ts';

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export type BoxRow = {
  id: string;
  public_device_id: string;
  name: string;
  location: string | null;
  lifecycle_status: 'provisioned' | 'unpaired' | 'paired' | 'revoked';
  cloud_state: 'idle' | 'recording' | 'syncing' | 'offline' | 'needs_attention';
  paired_at: string | null;
  needs_attention_reason: string | null;
};

const boxColumns = 'id,public_device_id,name,location,lifecycle_status,cloud_state,paired_at,needs_attention_reason';

type SignatureParams = {
  boxId: string;
  keyId: string;
  ts: string;
  nonce: string;
  sig: string;
};

// The Box signs: METHOD + "\n" + PATH + "\n" + ts + "\n" + nonce + "\n" + DIGEST_HEADER
// where PATH is the route path starting at /v1 (gateway prefixes stripped) and
// DIGEST_HEADER is the full `SHA-256=<base64>` value it sent in the Digest header.
export async function authenticateBox(
  supabase: SupabaseClient,
  request: Request,
  routePath: string,
  rawBody: Uint8Array,
  body: Record<string, unknown>,
): Promise<BoxRow> {
  const params = parseSignatureHeader(request.headers.get('Authorization'));
  const digestHeader = request.headers.get('Digest');

  if (!digestHeader) {
    throw new HttpError(401, 'Missing Digest header.');
  }

  const digestValue = digestHeader.replace(/^SHA-256=/i, '');

  if (digestValue === digestHeader) {
    throw new HttpError(401, 'Digest header must use SHA-256.');
  }

  if ((await sha256Base64(rawBody)) !== digestValue) {
    throw new HttpError(401, 'Body digest mismatch.');
  }

  const signedAt = new Date(params.ts).getTime();

  if (Number.isNaN(signedAt) || Math.abs(Date.now() - signedAt) > MAX_CLOCK_SKEW_MS) {
    throw new HttpError(401, 'Signature timestamp is outside the allowed clock skew.');
  }

  if (body.box_id !== params.boxId) {
    throw new HttpError(401, 'Body box_id does not match the signature.');
  }

  const { data: credential, error } = await supabase
    .from('box_credentials')
    .select(`key_id,credential_type,public_key,status,box:boxes(${boxColumns})`)
    .eq('key_id', params.keyId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    throw new HttpError(500, 'Could not load device credentials.');
  }

  // PostgREST returns the to-one embedded box as an object, but the untyped
  // client infers an array shape; normalize both.
  const embeddedBox = isRecord(credential) ? (credential.box as unknown) : null;
  const box = (Array.isArray(embeddedBox) ? embeddedBox[0] ?? null : embeddedBox) as BoxRow | null;

  if (!credential || !box) {
    throw new HttpError(401, 'Unknown or inactive device credential.');
  }

  if (box.public_device_id !== params.boxId) {
    throw new HttpError(401, 'Credential does not belong to this Box.');
  }

  if (box.lifecycle_status === 'revoked') {
    throw new HttpError(403, 'This Box has been revoked.');
  }

  if (credential.credential_type !== 'ed25519' && credential.credential_type !== 'ecdsa_p256') {
    throw new HttpError(400, `Credential type ${credential.credential_type} is not supported yet.`);
  }

  if (typeof credential.public_key !== 'string' || !credential.public_key) {
    throw new HttpError(401, 'Device credential has no public key.');
  }

  const signingString = [request.method, routePath, params.ts, params.nonce, digestHeader].join('\n');
  let isValid = false;

  try {
    isValid = await verifyDeviceSignature({
      algorithm: credential.credential_type,
      publicKey: credential.public_key,
      signature: fromBase64(params.sig),
      signingString,
    });
  } catch {
    throw new HttpError(401, 'Device signature could not be verified.');
  }

  if (!isValid) {
    throw new HttpError(401, 'Invalid device signature.');
  }

  await supabase
    .from('box_credentials')
    .update({ last_used_at: new Date().toISOString() })
    .eq('key_id', params.keyId);

  return box;
}

function parseSignatureHeader(header: string | null): SignatureParams {
  if (!header || !/^Storeybox-Signature\s/i.test(header)) {
    throw new HttpError(401, 'Missing Storeybox-Signature authorization.');
  }

  const values = new Map<string, string>();
  const paramPattern = /([a-z_]+)="([^"]*)"/g;

  for (const match of header.matchAll(paramPattern)) {
    values.set(match[1], match[2]);
  }

  const boxId = values.get('box_id');
  const keyId = values.get('key_id');
  const ts = values.get('ts');
  const nonce = values.get('nonce');
  const sig = values.get('sig');

  if (!boxId || !keyId || !ts || !nonce || !sig) {
    throw new HttpError(401, 'Storeybox-Signature is missing required parameters.');
  }

  return { boxId, keyId, ts, nonce, sig };
}
