import { describe, expect, it } from 'vitest';
import { browserDigest, extractFingerprint, framed, fromB64, hostDigest, keyIdOf, newPairingKey, signRaw, spkiOf, verifyRaw } from './mwbind.js';
import { fp, sdp } from './testkit.js';

describe('extractFingerprint', () => {
  it('normalizes the one sha-256 fingerprint', () => {
    expect(extractFingerprint(sdp(fp('ab')))).toBe(fp('AB'));
  });

  it('accepts repeated identical lines but nothing ambiguous', () => {
    expect(extractFingerprint(sdp(fp('ab'), `a=fingerprint:sha-256 ${fp('AB')}`))).toBe(fp('AB'));
    expect(extractFingerprint(sdp(fp('ab'), `a=fingerprint:sha-256 ${fp('cd')}`))).toBe('');
    expect(extractFingerprint(sdp(fp('ab')).replace('sha-256', 'sha-1'))).toBe('');
    expect(extractFingerprint(sdp(fp('ab'), `a=fingerprint:sha-1 ${fp('ab')}`))).toBe('');
    expect(extractFingerprint(sdp('AB:CD'))).toBe('');
    expect(extractFingerprint('v=0\r\n')).toBe('');
  });
});

describe('framing and signatures', () => {
  it('length-prefixes every field so boundaries cannot move', () => {
    expect(framed(['ab', 'c'])).not.toEqual(framed(['a', 'bc']));
    expect(framed(['ab']).toString('hex')).toBe('000000026162');
  });

  it('separates the host and browser roles', () => {
    const n = Buffer.alloc(16, 1);
    expect(hostDigest('h', 'k', n, 'f')).not.toEqual(browserDigest('h', n, 'k', 'f'));
    expect(hostDigest('h', 'k', n, 'f').subarray(0, 19).toString('latin1')).toBe('\x00\x00\x00\x0fMW-BIND-v1|host');
  });

  it('signs raw r||s that verifies only with the right key and message', () => {
    const key = newPairingKey();
    const spki = spkiOf(key);
    const msg = Buffer.from('hello');
    const sig = signRaw(key, msg);
    expect(sig).toHaveLength(64);
    expect(verifyRaw(spki, msg, sig)).toBe(true);
    expect(verifyRaw(spki, Buffer.from('hellO'), sig)).toBe(false);
    expect(verifyRaw(spkiOf(newPairingKey()), msg, sig)).toBe(false);
    expect(verifyRaw(spki, msg, sig.subarray(1))).toBe(false);
    expect(verifyRaw(Buffer.from('not a key'), msg, sig)).toBe(false);
  });

  it('names a key by base64url SHA-256 of its SPKI', () => {
    expect(keyIdOf(Buffer.from('abc'))).toBe('ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0');
  });

  it('only decodes clean base64', () => {
    expect(fromB64('aGk=')?.toString()).toBe('hi');
    expect(fromB64('a b')).toBeNull();
    expect(fromB64(5)).toBeNull();
  });
});
