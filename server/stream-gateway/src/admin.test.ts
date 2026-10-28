import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { linkMw, resetTotp } from './admin.js';
import type { MwApi } from './mw.js';
import { spkiOf } from './mwbind.js';
import { Store } from './store.js';

const tmpStore = () => new Store(mkdtempSync(join(tmpdir(), 'gw-')));

describe('link-mw', () => {
  it("registers the gateway's public key and remembers MoonlightWeb's", async () => {
    const store = tmpStore();
    let sent: [string, string] = ['', ''];
    const mw = { validate: async (pin: string, key: string) => ((sent = [pin, key]), { cookie: 'c00kie', hostKey: 'SG9zdA==', hostId: 'hid' }) } as unknown as MwApi;
    expect(await linkMw(store, mw, '123456')).toEqual({ hostId: 'hid' });
    expect(sent).toEqual(['123456', spkiOf(store.state.pairingKey).toString('base64')]);
    expect(new Store(join(store.file, '..')).state.mw).toMatchObject({ cookie: 'c00kie', hostKey: 'SG9zdA==', hostId: 'hid' });
  });

  it('only takes a numeric PIN', async () => {
    await expect(linkMw(tmpStore(), {} as MwApi, '12ab')).rejects.toThrow(/digits/);
  });
});

describe('reset-totp', () => {
  it('forgets the secret and ends every sign-in', () => {
    const store = tmpStore();
    store.state.totp = { secret: 'S', lastCounter: 1, backupCodes: [], enrolledAt: '' };
    store.state.families = { f: 9e9 };
    const gen = store.state.generation;
    resetTotp(store);
    expect(store.state.totp).toBeUndefined();
    expect(store.state.families).toEqual({});
    expect(store.state.generation).toBe(gen + 1);
  });

  it('keeps the pairing key and client id across restarts', () => {
    const store = tmpStore();
    const again = new Store(join(store.file, '..'));
    expect(again.state.pairingKey).toBe(store.state.pairingKey);
    expect(again.state.clientUniqueId).toMatch(/^[0-9a-f]{32}$/);
  });
});
