// Keys and sign-ins inside a JSON backup. They ride along only when a sync passphrase is set, sealed with it
// in their own envelope (`account` on the bundle), so a plain backup never holds a token in clear text and an
// encrypted one holds them twice-wrapped. On import, the passphrase that opened the file (or this device's sync
// passphrase) is tried first; otherwise the backup's password is asked for. Pure functions; the UI is DataSettings.
import { isEncryptedEnvelope, keyContext, openJSON, sealJSON, WrongPassphraseError, type EncryptedEnvelope } from './crypto';
import { isSecretSlot, pickSecrets, type SecretSlot } from './secretSlots';
import type { ExportBundle, Settings } from './types';

/** Settings that aren't secret but say where the keys point (the account server, the Gist, the Drive file…). */
export const ACCOUNT_SETTINGS = [
  'accountUrl',
  'accountAnonKey',
  'gistId',
  'googleClientId',
  'googleDriveFileId',
  'spotifyClientId',
  'schoologyMode',
  'schoologyDomain',
  'schoologyProxy',
  'aiBaseUrl',
] as const satisfies readonly (keyof Settings)[];
type AccountSetting = (typeof ACCOUNT_SETTINGS)[number];

export interface AccountDetails {
  hwtodoAccount: 1;
  secrets: Partial<Record<SecretSlot, string>>;
  settings: Partial<Pick<Settings, AccountSetting>>;
  /** The account (Supabase) email, so the restored device knows whom to sign in as. */
  email?: string;
}

/** What a backup carries about this device's sign-ins: every non-empty key plus the settings they belong to. */
export function collectAccountDetails(s: Partial<Settings>, email?: string | null): AccountDetails {
  const settings: Record<string, string> = {};
  for (const k of ACCOUNT_SETTINGS) if (typeof s[k] === 'string' && s[k]) settings[k] = s[k];
  return { hwtodoAccount: 1, secrets: pickSecrets(s), settings: settings as AccountDetails['settings'], ...(email ? { email } : {}) };
}

/** Anything to save? (Nothing worth an envelope when no key or account setting is set.) */
export function hasAccountDetails(d: AccountDetails): boolean {
  return Object.keys(d.secrets).length > 0 || Object.keys(d.settings).length > 0 || !!d.email;
}

/** Seal the details with the sync passphrase. */
export async function sealAccountDetails(d: AccountDetails, passphrase: string): Promise<EncryptedEnvelope> {
  return sealJSON(d, await keyContext(passphrase));
}

/** Does this backup hold sealed keys and sign-ins? */
export function backupHasAccount(b: Pick<ExportBundle, 'account'>): b is { account: EncryptedEnvelope } {
  return isEncryptedEnvelope(b.account);
}

/** Keep only well-formed fields (a tampered or newer file can't slip other settings in). */
export function normalizeAccountDetails(raw: unknown): AccountDetails {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<AccountDetails>;
  if (r.hwtodoAccount !== 1) throw new Error('Not an account-details block.');
  const secrets: AccountDetails['secrets'] = {};
  for (const [k, v] of Object.entries(r.secrets ?? {})) if (isSecretSlot(k) && typeof v === 'string' && v) secrets[k] = v;
  const settings: Record<string, string> = {};
  const src = (r.settings ?? {}) as Record<string, unknown>;
  for (const k of ACCOUNT_SETTINGS) if (typeof src[k] === 'string' && src[k]) settings[k] = src[k];
  if (settings.schoologyMode && settings.schoologyMode !== 'ics' && settings.schoologyMode !== 'api') delete settings.schoologyMode;
  return { hwtodoAccount: 1, secrets, settings: settings as AccountDetails['settings'], ...(typeof r.email === 'string' && r.email ? { email: r.email } : {}) };
}

/** Open the sealed details with the first passphrase that fits. Throws WrongPassphraseError when none does. */
export async function openAccountDetails(env: EncryptedEnvelope, passphrases: string[]): Promise<AccountDetails> {
  for (const pass of [...new Set(passphrases.filter(Boolean))]) {
    try {
      return normalizeAccountDetails(await openJSON(env, pass));
    } catch (e) {
      if (!(e instanceof WrongPassphraseError)) throw e;
    }
  }
  throw new WrongPassphraseError();
}
