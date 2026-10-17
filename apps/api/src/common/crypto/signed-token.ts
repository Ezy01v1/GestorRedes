import { createHmac, timingSafeEqual } from 'node:crypto';

type Payload = Record<string, unknown> & { exp: number };

function hmac(data: string, secret: Buffer): Buffer {
  return createHmac('sha256', secret).update(data).digest();
}

/** Firma un payload: base64url(JSON) + "." + base64url(HMAC-SHA256). `exp` en segundos Unix. */
export function signToken(payload: Payload, secret: Buffer): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${hmac(body, secret).toString('base64url')}`;
}

/** Devuelve el payload si la firma es válida y no ha caducado; si no, null. Nunca lanza. */
export function verifyToken<T extends Record<string, unknown>>(
  token: string,
  secret: Buffer,
  nowSeconds: number,
): (T & { exp: number }) | null {
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [body, signature] = parts as [string, string];

  const expected = hmac(body, secret);
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const payload: unknown = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof payload !== 'object' || payload === null) return null;
    const exp = (payload as { exp?: unknown }).exp;
    if (typeof exp !== 'number' || exp <= nowSeconds) return null;
    return payload as T & { exp: number };
  } catch {
    return null;
  }
}
