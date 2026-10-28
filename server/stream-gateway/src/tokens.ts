// Access tokens: compact HS256 JWTs, 15 minutes. Each carries the sign-in it belongs to (`fam`) and the revocation
// generation (`gen`), so signing out or "sign out everywhere" ends it at once instead of when it expires.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const ACCESS_TTL = 15 * 60;
export const REFRESH_TTL = 12 * 60 * 60;
/** a sign-in ends 12 hours after the password was typed, however often it's refreshed */
export const SESSION_CAP = 12 * 60 * 60;

export interface AccessClaims {
  sub: 'owner';
  fam: string;
  gen: number;
  iat: number;
  exp: number;
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');
const HEADER = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

export function signAccess(key: Buffer, fam: string, gen: number, nowSec: number, ttl = ACCESS_TTL): string {
  const claims: AccessClaims = { sub: 'owner', fam, gen, iat: nowSec, exp: nowSec + ttl };
  const body = `${HEADER}.${b64url(JSON.stringify(claims))}`;
  return `${body}.${createHmac('sha256', key).update(body).digest('base64url')}`;
}

export function verifyAccess(key: Buffer, token: string, nowSec: number): AccessClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== HEADER) return null;
  const want = createHmac('sha256', key).update(`${parts[0]}.${parts[1]}`).digest();
  const got = Buffer.from(parts[2], 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  let c: Partial<AccessClaims>;
  try {
    c = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (c.sub !== 'owner' || typeof c.fam !== 'string' || typeof c.gen !== 'number' || typeof c.exp !== 'number' || typeof c.iat !== 'number') return null;
  if (c.exp <= nowSec) return null;
  return c as AccessClaims;
}

/** The bearer token from an Authorization header, or ''. */
export function bearer(header: string | undefined): string {
  const m = /^Bearer ([A-Za-z0-9_.-]{20,2048})$/.exec(header ?? '');
  return m ? m[1] : '';
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
