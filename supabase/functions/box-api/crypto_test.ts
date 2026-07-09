import { fromBase64, sha256Base64, toBase64, verifyDeviceSignature } from './crypto.ts';

const encoder = new TextEncoder();

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test('verifies an ed25519 device signature over the contract signing string', async () => {
  const keyPair = (await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify'])) as CryptoKeyPair;
  const rawPublicKey = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));

  const body = encoder.encode(JSON.stringify({ request_id: 'req_test', box_id: 'box_test' }));
  const digestHeader = `SHA-256=${await sha256Base64(body)}`;
  const signingString = ['POST', '/v1/heartbeat', '2026-07-09T00:00:00Z', 'nonce123', digestHeader].join('\n');
  const signature = new Uint8Array(
    await crypto.subtle.sign('Ed25519', keyPair.privateKey, encoder.encode(signingString)),
  );

  assert(
    await verifyDeviceSignature({
      algorithm: 'ed25519',
      publicKey: toBase64(rawPublicKey),
      signature,
      signingString,
    }),
    'expected a valid ed25519 signature to verify',
  );

  assert(
    !(await verifyDeviceSignature({
      algorithm: 'ed25519',
      publicKey: toBase64(rawPublicKey),
      signature,
      signingString: signingString.replace('/v1/heartbeat', '/v1/errors'),
    })),
    'expected a tampered signing string to fail verification',
  );
});

Deno.test('verifies an ecdsa_p256 device signature', async () => {
  const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ]);
  const spkiPublicKey = new Uint8Array(await crypto.subtle.exportKey('spki', keyPair.publicKey));
  const signingString = ['POST', '/v1/recordings/start', '2026-07-09T00:00:00Z', 'nonce456', 'SHA-256=abc'].join('\n');
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, encoder.encode(signingString)),
  );

  assert(
    await verifyDeviceSignature({
      algorithm: 'ecdsa_p256',
      publicKey: toBase64(spkiPublicKey),
      signature,
      signingString,
    }),
    'expected a valid ecdsa signature to verify',
  );
});

Deno.test('fromBase64 accepts base64url signatures', () => {
  const bytes = new Uint8Array([251, 239, 190, 0, 1, 2]);
  const base64url = toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const decoded = fromBase64(base64url);

  assert(decoded.length === bytes.length, 'expected decoded length to match');
  assert(decoded.every((byte, index) => byte === bytes[index]), 'expected decoded bytes to match');
});
