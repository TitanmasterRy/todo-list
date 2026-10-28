import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, hotp, newBackupCodes, normalizeBackupCode, otpauthUri, verifyTotp } from './totp.js';

// RFC 6238 appendix B, SHA-1 secret "12345678901234567890" (8 digits there; the last 6 are what 6-digit apps show)
const SECRET = base32Encode(Buffer.from('12345678901234567890'));
const VECTORS: [number, string][] = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
];

describe('totp', () => {
  it('base32 round-trips', () => {
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
    expect(base32Decode('MZXW6YTBOI').toString()).toBe('foobar');
    expect(base32Decode(SECRET).toString()).toBe('12345678901234567890');
  });

  it('matches the RFC 6238 test vectors', () => {
    for (const [t, code] of VECTORS) {
      expect(hotp(base32Decode(SECRET), Math.floor(t / 30), 8)).toBe(code);
      expect(verifyTotp(SECRET, code.slice(2), t)).toBe(Math.floor(t / 30));
    }
  });

  it('accepts one step either side and nothing further', () => {
    const t = 1111111111;
    const code = (dt: number) => hotp(base32Decode(SECRET), Math.floor((t + dt) / 30));
    expect(verifyTotp(SECRET, code(-30), t)).not.toBeNull();
    expect(verifyTotp(SECRET, code(30), t)).not.toBeNull();
    expect(verifyTotp(SECRET, code(-90), t)).toBeNull();
    expect(verifyTotp(SECRET, code(90), t)).toBeNull();
  });

  it('never accepts a code twice', () => {
    const counter = verifyTotp(SECRET, '287082', 59)!;
    expect(verifyTotp(SECRET, '287082', 59, counter)).toBeNull();
  });

  it('rejects malformed codes', () => {
    expect(verifyTotp(SECRET, '28708', 59)).toBeNull();
    expect(verifyTotp(SECRET, 'abcdef', 59)).toBeNull();
  });

  it('builds an otpauth URI apps understand', () => {
    const uri = otpauthUri('JBSWY3DPEHPK3PXP');
    expect(uri).toMatch(/^otpauth:\/\/totp\/Homework%20To-Do%3AStream\?/);
    const q = new URL(uri).searchParams;
    expect(q.get('secret')).toBe('JBSWY3DPEHPK3PXP');
    expect(q.get('issuer')).toBe('Homework To-Do');
    expect(q.get('digits')).toBe('6');
  });

  it('makes ten distinct backup codes and normalizes typed ones', () => {
    const codes = newBackupCodes();
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[a-z2-7]{4}-[a-z2-7]{4}$/);
    expect(normalizeBackupCode(' ABCD 2345 ')).toBe('abcd-2345');
    expect(normalizeBackupCode('abcd-234')).toBe('');
  });
});
