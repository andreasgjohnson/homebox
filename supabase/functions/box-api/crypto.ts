const encoder = new TextEncoder();

export async function sha256Hex(input: string | Uint8Array) {
  const data = typeof input === 'string' ? encoder.encode(input) : input;
  const digest = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);

  return toHex(new Uint8Array(digest));
}

export async function sha256Base64(input: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', input.buffer as ArrayBuffer);

  return toBase64(new Uint8Array(digest));
}

export function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function toBase64(bytes: Uint8Array) {
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

export function fromBase64(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function randomNumericCode(digits: number) {
  const values = new Uint32Array(digits);
  crypto.getRandomValues(values);

  return Array.from(values)
    .map((value) => (value % 10).toString())
    .join('');
}

export function randomToken(prefix: string, bytes = 10) {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);

  return `${prefix}${toHex(values)}`;
}

type SignatureInput = {
  algorithm: 'ed25519' | 'ecdsa_p256';
  publicKey: string;
  signature: Uint8Array;
  signingString: string;
};

// Ed25519 public keys are base64-encoded raw 32-byte keys; ECDSA P-256 public
// keys are base64-encoded SPKI. Signatures are base64url; ECDSA uses the raw
// r||s (IEEE P1363) form that WebCrypto verifies natively.
export async function verifyDeviceSignature({ algorithm, publicKey, signature, signingString }: SignatureInput) {
  const data = encoder.encode(signingString);
  const keyBytes = fromBase64(publicKey);

  if (algorithm === 'ed25519') {
    const key = await crypto.subtle.importKey('raw', keyBytes.buffer as ArrayBuffer, { name: 'Ed25519' }, false, [
      'verify',
    ]);

    return crypto.subtle.verify('Ed25519', key, signature.buffer as ArrayBuffer, data);
  }

  const key = await crypto.subtle.importKey(
    'spki',
    keyBytes.buffer as ArrayBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );

  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    signature.buffer as ArrayBuffer,
    data,
  );
}
