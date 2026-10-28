import { describe, expect, it } from 'vitest';
import { ACCESS_TTL, bearer, signAccess, verifyAccess } from './tokens.js';

const KEY = Buffer.from('k'.repeat(48));

describe('access tokens', () => {
  it('verify until they expire', () => {
    const t = signAccess(KEY, 'fam1', 3, 1000);
    expect(verifyAccess(KEY, t, 1000)).toMatchObject({ fam: 'fam1', gen: 3, exp: 1000 + ACCESS_TTL });
    expect(verifyAccess(KEY, t, 1000 + ACCESS_TTL - 1)).not.toBeNull();
    expect(verifyAccess(KEY, t, 1000 + ACCESS_TTL)).toBeNull();
  });

  it('reject another key, tampering and alg tricks', () => {
    const t = signAccess(KEY, 'fam1', 1, 1000);
    expect(verifyAccess(Buffer.from('x'.repeat(48)), t, 1000)).toBeNull();
    const [h, p, s] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), gen: 99 })).toString('base64url');
    expect(verifyAccess(KEY, `${h}.${forged}.${s}`, 1000)).toBeNull();
    const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    expect(verifyAccess(KEY, `${none}.${p}.`, 1000)).toBeNull();
    expect(verifyAccess(KEY, 'garbage', 1000)).toBeNull();
  });

  it('reads only well-formed bearer headers', () => {
    expect(bearer('Bearer abcdefghijklmnopqrstuvwxyz.123')).toBe('abcdefghijklmnopqrstuvwxyz.123');
    expect(bearer('bearer abcdefghijklmnopqrstuvwxyz')).toBe('');
    expect(bearer('Bearer short')).toBe('');
    expect(bearer(undefined)).toBe('');
  });
});
