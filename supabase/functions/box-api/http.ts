export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, digest, idempotency-key',
};

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function readString(body: Record<string, unknown>, key: string) {
  const value = body[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpError(400, `${key} is required.`);
  }

  return value.trim();
}

export function readOptionalString(body: Record<string, unknown>, key: string) {
  const value = body[key];

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new HttpError(400, `${key} must be a string.`);
  }

  return value.trim() || null;
}

export function readTimestamp(body: Record<string, unknown>, key: string) {
  const value = readString(body, key);
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, `${key} must be an ISO 8601 timestamp.`);
  }

  return parsed.toISOString();
}

export function readNonNegativeInt(body: Record<string, unknown>, key: string) {
  const value = body[key];

  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new HttpError(400, `${key} must be a non-negative number.`);
  }

  return Math.floor(value);
}

export function readBoolean(body: Record<string, unknown>, key: string) {
  const value = body[key];

  if (typeof value !== 'boolean') {
    throw new HttpError(400, `${key} must be a boolean.`);
  }

  return value;
}

export function readEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new HttpError(500, `${name} is not configured.`);
  }

  return value;
}
