// Anti-tamper seal for the coin ledger. Every entry the app writes (earning, spending, admin grants) carries
// `sig`, an HMAC-SHA-256 of its fields; an entry whose seal is missing or doesn't match was typed into a backup
// file, a synced copy or IndexedDB by hand, and is left out of every balance until an admin approves it.
// With no server the key has to ship with the app, so this stops editing data, not someone rewriting the app's
// code. Synchronous (a small SHA-256 below) so balances and sync merges can check entries in place.
import type { LedgerEntry } from './types';

// SHA-256 constants: the first 32 bits of the fractional parts of the cube roots (K) and square roots (H0) of the first primes
const PRIMES: number[] = [];
for (let n = 2; PRIMES.length < 64; n++) if (PRIMES.every((p) => n % p)) PRIMES.push(n);
const frac = (x: number) => ((x - Math.floor(x)) * 2 ** 32) >>> 0;
const K = Uint32Array.from(PRIMES, (p) => frac(Math.cbrt(p)));
const H0 = Uint32Array.from(PRIMES.slice(0, 8), (p) => frac(Math.sqrt(p)));

export function sha256(msg: Uint8Array): Uint8Array {
  const len = msg.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(msg);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(len / 0x20000000));
  view.setUint32(padded.length - 4, len << 3);
  const h = H0.slice();
  const w = new Uint32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15];
      const b = w[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[i] = w[i - 16] + s0 + w[i - 7] + s1;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const t1 = (hh + S1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h[0] += a;
    h[1] += b;
    h[2] += c;
    h[3] += d;
    h[4] += e;
    h[5] += f;
    h[6] += g;
    h[7] += hh;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, h[i]);
  return out;
}

export function hmacSha256(key: Uint8Array, msg: Uint8Array): Uint8Array {
  const k = new Uint8Array(64);
  k.set(key.length > 64 ? sha256(key) : key);
  const inner = new Uint8Array(64 + msg.length);
  const outer = new Uint8Array(64 + 32);
  for (let i = 0; i < 64; i++) {
    inner[i] = k[i] ^ 0x36;
    outer[i] = k[i] ^ 0x5c;
  }
  inner.set(msg, 64);
  outer.set(sha256(inner), 64);
  return sha256(outer);
}

const enc = new TextEncoder();
const KEY = enc.encode('homework-todo ledger seal v1 · coins come from schoolwork');

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The seal for an entry: covers every field that moves a balance. */
export function ledgerSig(e: Omit<LedgerEntry, 'sig'>): string {
  const body = JSON.stringify(['v1', e.id, e.at, e.currency, e.amount, e.reason, e.ref ?? null]);
  return b64url(hmacSha256(KEY, enc.encode(body)).subarray(0, 16));
}

export function sealEntry(e: LedgerEntry): LedgerEntry {
  return { ...e, sig: ledgerSig(e) };
}

// Entries never change once written, so a verdict can be cached on the object.
const verdicts = new WeakMap<LedgerEntry, boolean>();

export function isSealed(e: LedgerEntry): boolean {
  let ok = verdicts.get(e);
  if (ok === undefined) {
    ok = typeof e.sig === 'string' && e.sig === ledgerSig(e);
    verdicts.set(e, ok);
  }
  return ok;
}

/** Split entries into the ones that count and the ones that were tampered with (or never sealed). */
export function checkLedger(entries: LedgerEntry[]): { valid: LedgerEntry[]; rejected: LedgerEntry[] } {
  const valid: LedgerEntry[] = [];
  const rejected: LedgerEntry[] = [];
  for (const e of entries) (isSealed(e) ? valid : rejected).push(e);
  return { valid, rejected };
}
