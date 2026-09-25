import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';

// A real (in-memory) localStorage, installed before the modules read it.
class MemoryStorage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}
const ls = new MemoryStorage();
Object.assign(globalThis, { localStorage: ls });

let secrets: typeof import('./secrets.svelte');
let store: typeof import('./store.svelte').store;
let sync: typeof import('./syncCrypto');
beforeAll(async () => {
  secrets = await import('./secrets.svelte');
  store = (await import('./store.svelte')).store;
  sync = await import('./syncCrypto');
});

const disk = () => JSON.parse(ls.getItem('homework-todo:settings') ?? '{}') as Record<string, unknown>;
const vaultRaw = () => ls.getItem('homework-todo:vault') ?? '';
const settle = () => new Promise((r) => setTimeout(r, 50));

describe('secret accessor and key lock', () => {
  it('without a lock, secrets are plain settings read through the accessor', () => {
    secrets.setSecrets({ gistToken: 'ghp_plain', 'aiKeys.groq': 'gsk_1' });
    expect(secrets.secret('gistToken')).toBe('ghp_plain');
    expect(secrets.secret('aiKeys.groq')).toBe('gsk_1');
    expect(secrets.hasSecret('aiKeys.openai')).toBe(false);
    expect(disk().gistToken).toBe('ghp_plain');
    expect(secrets.isLocked('gistToken')).toBe(false);
  });

  it('locking encrypts the secrets and blanks them on disk', async () => {
    await secrets.enableLock('my long passphrase');
    expect(secrets.vault.enabled).toBe(true);
    expect(disk().gistToken).toBe('');
    expect(disk().aiKeys).toEqual({});
    expect(vaultRaw()).not.toContain('ghp_plain');
    expect(secrets.secret('gistToken')).toBe('ghp_plain'); // still unlocked this session
    expect(secrets.vault.stored.sort()).toEqual(['aiKeys.groq', 'gistToken']);
  });

  it('new keys saved while unlocked go into the vault', async () => {
    secrets.setSecrets({ schoologyKey: 'sk_key' });
    await settle();
    expect(disk().schoologyKey).toBe('');
    expect(secrets.vault.stored).toContain('schoologyKey');
    expect(vaultRaw()).not.toContain('sk_key');
  });

  it('after locking, reads are empty but the app still knows the key exists', async () => {
    secrets.lockNow();
    expect(secrets.secret('gistToken')).toBe('');
    expect(secrets.hasSecret('gistToken')).toBe(true);
    expect(secrets.isLocked('gistToken')).toBe(true);
    // background callers skip quietly
    expect(await secrets.useSecret('gistToken', { interactive: false })).toBe('');
    expect(secrets.vault.prompt).toBeNull();
  });

  it('a feature that needs the key asks once; a wrong passphrase is refused', async () => {
    const got = secrets.useSecret('gistToken');
    const again = secrets.requestUnlock();
    expect(secrets.vault.prompt).not.toBeNull();
    await expect(secrets.unlock('wrong passphrase')).rejects.toMatchObject({ name: 'WrongPassphraseError' });
    expect(secrets.vault.unlocked).toBe(false);
    await secrets.unlock('my long passphrase');
    expect(await got).toBe('ghp_plain');
    expect(await again).toBe(true);
    expect(secrets.secret('schoologyKey')).toBe('sk_key');
    expect(secrets.vault.prompt).toBeNull();
  });

  it('cancelling the prompt resolves false and leaves the key locked', async () => {
    secrets.lockNow();
    const p = secrets.requestUnlock('why');
    expect(secrets.vault.prompt?.reason).toBe('why');
    secrets.cancelUnlock();
    expect(await p).toBe(false);
    expect(secrets.secret('gistToken')).toBe('');
  });

  it('forgetting one key works while locked (no passphrase needed)', async () => {
    secrets.forgetSecret('schoologyKey');
    await settle();
    expect(secrets.vault.stored).not.toContain('schoologyKey');
    expect(secrets.hasSecret('schoologyKey')).toBe(false);
    await secrets.unlock('my long passphrase');
    expect(secrets.secret('schoologyKey')).toBe('');
    expect(secrets.secret('gistToken')).toBe('ghp_plain');
  });

  it('changing the passphrase re-encrypts; removing it puts the keys back in plain settings', async () => {
    await secrets.changePassphrase('another passphrase');
    secrets.lockNow();
    await expect(secrets.unlock('my long passphrase')).rejects.toMatchObject({ name: 'WrongPassphraseError' });
    await secrets.unlock('another passphrase');
    await secrets.disableLock();
    expect(secrets.vault.enabled).toBe(false);
    expect(vaultRaw()).toBe('');
    expect(disk().gistToken).toBe('ghp_plain');
  });

  it('"forget passphrase" wipes the encrypted keys and nothing else', async () => {
    await secrets.enableLock('third passphrase');
    secrets.lockNow();
    store.updateSettings({ dailyGoal: 7 });
    secrets.forgetVault();
    expect(secrets.vault.enabled).toBe(false);
    expect(secrets.hasSecret('gistToken')).toBe(false);
    expect(vaultRaw()).toBe('');
    expect(disk().dailyGoal).toBe(7);
  });
});

describe('sync encryption', () => {
  const bundle = { version: 1, exportedAt: '2026-09-01T00:00:00.000Z', tasks: [{ id: 't1', title: 'Lab report', updatedAt: '2026-09-01T00:00:00.000Z' }], courses: [] };

  it('uploads plain JSON until a sync passphrase is set, then an envelope', async () => {
    secrets.setSecrets({ syncPassphrase: '' });
    expect(await sync.encodeForSync(bundle as never)).toBe(bundle);
    secrets.setSecrets({ syncPassphrase: 'sync passphrase 1' });
    const env = await sync.encodeForSync(bundle as never);
    expect(sync.isEncryptedEnvelope(env)).toBe(true);
    expect(JSON.stringify(env)).not.toContain('Lab report');
    expect((await sync.decodeFromSync(env)).tasks[0].title).toBe('Lab report');
  });

  it('reads old plain copies, and explains an encrypted copy it cannot open', async () => {
    expect((await sync.decodeFromSync(bundle)).tasks).toHaveLength(1);
    const env = await sync.sealWith(bundle, 'the other passphrase');
    await expect(sync.decodeFromSync(env)).rejects.toThrow(sync.WRONG_PASSPHRASE);
    secrets.setSecrets({ syncPassphrase: '' });
    await expect(sync.decodeFromSync(env)).rejects.toThrow(sync.NEED_PASSPHRASE);
    await expect(sync.decodeFromSync(env)).rejects.toBeInstanceOf(sync.SyncLockedError);
  });

  it('after a passphrase change the old copy still opens once', async () => {
    const old = await sync.sealWith(bundle, 'old sync pass');
    sync.rememberPreviousPassphrase('old sync pass');
    secrets.setSecrets({ syncPassphrase: 'new sync pass' });
    expect((await sync.decodeFromSync(old)).tasks).toHaveLength(1);
    const fresh = await sync.encodeForSync(bundle as never);
    await expect(sync.openEnvelope(fresh as never, ['old sync pass'])).rejects.toMatchObject({ name: 'WrongPassphraseError' });
  });

  it('never uploads plain text when encryption is on but locked', async () => {
    await secrets.enableLock('lock passphrase');
    secrets.lockNow();
    expect(sync.syncEncryptionOn()).toBe(true);
    await expect(sync.encodeForSync(bundle as never, { interactive: false })).rejects.toBeInstanceOf(sync.SyncLockedError);
    secrets.forgetVault();
  });
});
