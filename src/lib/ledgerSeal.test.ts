import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { checkLedger, hmacSha256, isSealed, ledgerSig, sealEntry, sha256 } from './ledgerSeal';
import type { LedgerEntry } from './types';

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const bytes = (s: string) => new TextEncoder().encode(s);

describe('sha256 / hmac', () => {
  it('matches the standard test vectors', () => {
    expect(hex(sha256(bytes('')))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(hex(sha256(bytes('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    // RFC 4231 test case 2
    expect(hex(hmacSha256(bytes('Jefe'), bytes('what do ya want for nothing?')))).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  });

  it('agrees with node:crypto across block boundaries and long keys', () => {
    for (const n of [1, 55, 56, 63, 64, 65, 119, 120, 1000]) {
      const msg = bytes('x'.repeat(n));
      expect(hex(sha256(msg))).toBe(createHash('sha256').update(msg).digest('hex'));
      const key = bytes('k'.repeat(n));
      expect(hex(hmacSha256(key, msg))).toBe(createHmac('sha256', key).update(msg).digest('hex'));
    }
  });
});

describe('ledger seal', () => {
  const entry: LedgerEntry = { id: 'l1', at: '2026-10-02T10:00:00.000Z', currency: 'coins', amount: 12, reason: 'task', ref: 't1' };

  it('a sealed entry checks out', () => {
    expect(isSealed(sealEntry(entry))).toBe(true);
    expect(isSealed(entry)).toBe(false);
  });

  it('changing any field breaks the seal', () => {
    const sealed = sealEntry(entry);
    for (const patch of [{ amount: 1200 }, { currency: 'chips' as const }, { reason: 'admin' }, { ref: 't2' }, { at: '2026-10-03T10:00:00.000Z' }, { id: 'l2' }]) {
      expect(isSealed({ ...sealed, ...patch })).toBe(false);
    }
    expect(isSealed({ ...sealed, sig: ledgerSig({ ...entry, amount: 13 }) })).toBe(false);
  });

  it('splits a ledger into what counts and what was tampered with', () => {
    const good = sealEntry(entry);
    const bad = { ...sealEntry({ ...entry, id: 'l2' }), amount: 999 };
    expect(checkLedger([good, bad, { ...entry, id: 'l3' }])).toEqual({ valid: [good], rejected: [bad, { ...entry, id: 'l3' }] });
  });
});
