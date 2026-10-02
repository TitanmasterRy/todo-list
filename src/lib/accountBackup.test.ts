import { describe, expect, it } from 'vitest';
import { backupHasAccount, collectAccountDetails, hasAccountDetails, normalizeAccountDetails, openAccountDetails, sealAccountDetails } from './accountBackup';
import { WrongPassphraseError } from './crypto';
import { DEFAULT_SETTINGS } from './types';

const settings = {
  ...DEFAULT_SETTINGS,
  gistToken: 'ghp_secret',
  gistId: 'abc123',
  syncPassphrase: 'correct horse battery',
  aiKeys: { groq: 'gsk_1' },
  accountUrl: 'https://proj.supabase.co',
  accountAnonKey: 'anon-key',
};

describe('account details in backups', () => {
  it('collects the keys and the settings they belong to', () => {
    const d = collectAccountDetails(settings, 'me@example.com');
    expect(d.secrets).toEqual({ gistToken: 'ghp_secret', syncPassphrase: 'correct horse battery', 'aiKeys.groq': 'gsk_1' });
    expect(d.settings).toEqual({ gistId: 'abc123', accountUrl: 'https://proj.supabase.co', accountAnonKey: 'anon-key', schoologyMode: 'ics' });
    expect(d.email).toBe('me@example.com');
    expect(hasAccountDetails(collectAccountDetails({ ...DEFAULT_SETTINGS, schoologyMode: '' as 'ics' }))).toBe(false);
  });

  it('seals them with the sync passphrase and opens with it only', async () => {
    const env = await sealAccountDetails(collectAccountDetails(settings, 'me@example.com'), 'correct horse battery');
    expect(JSON.stringify(env)).not.toContain('ghp_secret');
    expect(backupHasAccount({ account: env })).toBe(true);
    expect(backupHasAccount({})).toBe(false);
    await expect(openAccountDetails(env, ['wrong one'])).rejects.toBeInstanceOf(WrongPassphraseError);
    const back = await openAccountDetails(env, ['', 'wrong one', 'correct horse battery']);
    expect(back.secrets.gistToken).toBe('ghp_secret');
    expect(back.settings.accountUrl).toBe('https://proj.supabase.co');
    expect(back.email).toBe('me@example.com');
  });

  it('a file cannot slip other settings or odd values in', () => {
    const d = normalizeAccountDetails({
      hwtodoAccount: 1,
      secrets: { gistToken: 'ok', parentPinHash: 'x', 'aiKeys.groq': 5 },
      settings: { accountUrl: 'https://a', economyEnabled: true, schoologyMode: 'evil', parentPinHash: '' },
    });
    expect(d.secrets).toEqual({ gistToken: 'ok' });
    expect(d.settings).toEqual({ accountUrl: 'https://a' });
    expect(() => normalizeAccountDetails({ secrets: {} })).toThrow();
  });
});
