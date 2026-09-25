// End-to-end encryption of the synced copy (Gist, Google Drive, account server) and of encrypted backup files.
// With a sync passphrase set, the bundle is encrypted in the browser before upload and decrypted after download,
// so GitHub, Google and the Supabase project only ever store an EncryptedEnvelope. Plain copies from before
// still read fine; the next write replaces them with an encrypted one.
import { isEncryptedEnvelope, keyContext, openJSON, sealJSON, WrongPassphraseError, fromBase64, deriveKey, type KeyContext, type EncryptedEnvelope } from './crypto';
import { parseBundle } from './backup';
import { hasSecret, useSecret } from './secrets.svelte';
import type { ExportBundle } from './types';

export { isEncryptedEnvelope };

/** Sync can't go on: the copy is encrypted and this device can't open it (or can't encrypt without unlocking). */
export class SyncLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncLockedError';
  }
}

export const NEED_PASSPHRASE = 'Your synced copy is end-to-end encrypted. Enter your sync passphrase in Settings → Privacy & security to sync on this device.';
export const WRONG_PASSPHRASE = "The sync passphrase on this device doesn't match the one your synced copy was encrypted with. Check it in Settings → Privacy & security.";
const LOCKED = 'Your keys are locked. Unlock them to sync (the synced copy is encrypted with your sync passphrase).';

// Derived keys are cached in memory for the session (PBKDF2 is slow on purpose), keyed by passphrase + salt.
const keys = new Map<string, Promise<CryptoKey>>();
let sealCtx: { pass: string; ctx: KeyContext } | null = null;
/** After a passphrase change, the old one still opens the old copy this session (the next write uses the new one). */
let previous: string[] = [];

function cachedKey(pass: string, salt: string, iter: number): Promise<CryptoKey> {
  const id = `${iter}:${salt}:${pass}`;
  let k = keys.get(id);
  if (!k) {
    k = deriveKey(pass, fromBase64(salt), iter);
    k.catch(() => keys.delete(id));
    keys.set(id, k);
  }
  return k;
}

export function rememberPreviousPassphrase(pass: string): void {
  if (pass && !previous.includes(pass)) previous = [pass, ...previous].slice(0, 3);
}

/** Forget cached keys (passphrase removed or changed). */
export function clearSyncKeys(): void {
  keys.clear();
  sealCtx = null;
}

/** Decrypt an envelope with one of these passphrases. Throws WrongPassphraseError when none fits. */
export async function openEnvelope(env: EncryptedEnvelope, passphrases: string[]): Promise<unknown> {
  for (const pass of passphrases.filter(Boolean)) {
    try {
      return await openJSON(env, pass, (salt, iter) => cachedKey(pass, salt, iter));
    } catch (e) {
      if (!(e instanceof WrongPassphraseError)) throw e;
    }
  }
  throw new WrongPassphraseError();
}

/** Encrypt a value with a passphrase (reusing this session's salt and key; every message gets a new IV). */
export async function sealWith(value: unknown, pass: string): Promise<EncryptedEnvelope> {
  if (!sealCtx || sealCtx.pass !== pass) sealCtx = { pass, ctx: await keyContext(pass) };
  return sealJSON(value, sealCtx.ctx);
}

/** Is end-to-end encryption on for this device? */
export function syncEncryptionOn(): boolean {
  return hasSecret('syncPassphrase');
}

/**
 * What to upload: the envelope when a sync passphrase is set, else the plain bundle.
 * Never falls back to plain text when encryption is on but the passphrase is locked.
 */
export async function encodeForSync(bundle: ExportBundle, opts: { interactive?: boolean } = {}): Promise<ExportBundle | EncryptedEnvelope> {
  if (!syncEncryptionOn()) return bundle;
  const pass = await useSecret('syncPassphrase', { interactive: opts.interactive, reason: 'Enter your passphrase to sync (your synced copy is encrypted).' });
  if (!pass) throw new SyncLockedError(LOCKED);
  return sealWith(bundle, pass);
}

/** Read a downloaded copy: decrypt when it's an envelope, then validate. Throws SyncLockedError with a friendly message. */
export async function decodeFromSync(raw: unknown, opts: { interactive?: boolean } = {}): Promise<ExportBundle> {
  if (!isEncryptedEnvelope(raw)) return parseBundle(raw);
  if (!syncEncryptionOn()) throw new SyncLockedError(NEED_PASSPHRASE);
  const pass = await useSecret('syncPassphrase', { interactive: opts.interactive, reason: 'Enter your passphrase to sync (your synced copy is encrypted).' });
  if (!pass) throw new SyncLockedError(LOCKED);
  try {
    return parseBundle(await openEnvelope(raw, [pass, ...previous]));
  } catch (e) {
    if (e instanceof WrongPassphraseError) throw new SyncLockedError(WRONG_PASSPHRASE);
    throw e;
  }
}
