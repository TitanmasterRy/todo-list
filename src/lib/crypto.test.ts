import { describe, expect, it } from 'vitest';
import {
  decryptString,
  deriveKey,
  encryptString,
  fromBase64,
  isEncryptedEnvelope,
  keyContext,
  MIN_ITERATIONS,
  newSalt,
  openJSON,
  PBKDF2_ITERATIONS,
  sealJSON,
  toBase64,
  WrongPassphraseError,
} from './crypto';

describe('crypto helpers', () => {
  it('uses at least 310k PBKDF2 iterations and refuses fewer', async () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(310_000);
    await expect(deriveKey('pw', newSalt(), MIN_ITERATIONS - 1)).rejects.toThrow(/weak/);
    await expect(deriveKey('', newSalt())).rejects.toThrow(/passphrase/);
  });

  it('round-trips strings and uses a fresh IV every time', async () => {
    const key = await deriveKey('correct horse', newSalt());
    const a = await encryptString(key, 'sk-ant-secret');
    const b = await encryptString(key, 'sk-ant-secret');
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
    expect(a.data).not.toContain('secret');
    expect(await decryptString(key, a)).toBe('sk-ant-secret');
    expect(await decryptString(key, b)).toBe('sk-ant-secret');
  });

  it('a wrong passphrase or a changed byte fails with WrongPassphraseError', async () => {
    const salt = newSalt();
    const key = await deriveKey('right one', salt);
    const sealed = await encryptString(key, 'hello');
    const wrong = await deriveKey('wrong one', salt);
    await expect(decryptString(wrong, sealed)).rejects.toBeInstanceOf(WrongPassphraseError);
    const bytes = fromBase64(sealed.data);
    bytes[0] ^= 1;
    await expect(decryptString(key, { ...sealed, data: toBase64(bytes) })).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it('base64 survives large payloads (no argument-list overflow)', () => {
    const big = new Uint8Array(300_000).map((_, i) => i % 256);
    expect(fromBase64(toBase64(big))).toEqual(big);
  });

  it('seals JSON in a self-describing envelope and opens it again', async () => {
    const ctx = await keyContext('sync pass');
    const value = { tasks: [{ id: 't1', title: 'Essay draft' }], n: 3 };
    const env = await sealJSON(value, ctx);
    expect(env).toMatchObject({ hwtodoEncrypted: 1, kdf: 'PBKDF2-SHA256', cipher: 'AES-GCM', iter: PBKDF2_ITERATIONS, salt: ctx.salt });
    expect(JSON.stringify(env)).not.toContain('Essay draft');
    expect(isEncryptedEnvelope(env)).toBe(true);
    expect(await openJSON(env, 'sync pass')).toEqual(value);
    await expect(openJSON(env, 'nope')).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it('refuses envelopes with an unknown cipher', async () => {
    const env = await sealJSON({ a: 1 }, await keyContext('p'));
    await expect(openJSON({ ...env, cipher: 'ROT13' as 'AES-GCM' }, 'p')).rejects.toThrow(/cipher/);
  });

  it('detects the envelope format and nothing else', () => {
    expect(isEncryptedEnvelope({ hwtodoEncrypted: 1, salt: 's', iv: 'i', data: 'd' })).toBe(true);
    expect(isEncryptedEnvelope({ version: 1, tasks: [], courses: [] })).toBe(false);
    expect(isEncryptedEnvelope({ hwtodoEncrypted: 2, salt: 's', iv: 'i', data: 'd' })).toBe(false);
    expect(isEncryptedEnvelope({ hwtodoEncrypted: 1, salt: 's', iv: 'i' })).toBe(false);
    expect(isEncryptedEnvelope(null)).toBe(false);
    expect(isEncryptedEnvelope('hwtodoEncrypted')).toBe(false);
  });
});
