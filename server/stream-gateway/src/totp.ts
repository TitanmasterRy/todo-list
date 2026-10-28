// RFC 6238 TOTP (SHA-1, 6 digits, 30 s): what every authenticator app speaks. A code is accepted one step either
// side of now, and never twice (the caller stores the last counter that was used).
import { createHmac, randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const PERIOD = 30;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[=\s]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error('not base32');
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function hotp(secret: Buffer, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', secret).update(msg).digest();
  const off = h[h.length - 1] & 15;
  const bin = h.readUInt32BE(off) & 0x7fffffff;
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export function newSecret(): string {
  return base32Encode(randomBytes(20));
}

/** The counter a valid code belongs to, or null. `lastCounter` blocks reuse of a code (and of anything older). */
export function verifyTotp(secretB32: string, code: string, nowSec: number, lastCounter = -1): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretB32);
  const now = Math.floor(nowSec / PERIOD);
  for (const c of [now - 1, now, now + 1]) {
    if (c <= lastCounter) continue;
    if (hotp(secret, c) === code) return c;
  }
  return null;
}

export function otpauthUri(secretB32: string, account = 'Stream', issuer = 'Homework To-Do'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const q = new URLSearchParams({ secret: secretB32, issuer, algorithm: 'SHA1', digits: '6', period: String(PERIOD) });
  return `otpauth://totp/${label}?${q.toString().replace(/\+/g, '%20')}`;
}

/** Ten one-time backup codes like `k4m2-x9qa` (40 bits each). */
export function newBackupCodes(n = 10): string[] {
  return Array.from({ length: n }, () => {
    const s = base32Encode(randomBytes(5)).toLowerCase();
    return `${s.slice(0, 4)}-${s.slice(4, 8)}`;
  });
}

export function normalizeBackupCode(s: string): string {
  const c = s.toLowerCase().replace(/[\s-]/g, '');
  return /^[a-z2-7]{8}$/.test(c) ? `${c.slice(0, 4)}-${c.slice(4)}` : '';
}
