// The one accessor for API keys and tokens, and the optional passphrase lock over them.
//
// Without a lock, secrets live in the settings object in localStorage (as before). With a lock, the settings
// copy on disk has every secret blanked and the values sit in an encrypted vault (vault.ts) next to it; the
// passphrase is asked once per app session and the derived key stays in memory only. Reading code never
// touches the settings fields directly:
//   secret(slot)        current value ('' while locked)            – sync, for building requests
//   hasSecret(slot)     a value exists (even if locked)            – for "connected" / "key saved" UI
//   useSecret(slot)     unlock first if needed, then the value     – before a user-started request
// Background work passes { interactive: false } and skips quietly while locked.
import { store } from './store.svelte';
import { emit } from './events';
import { toasts } from './toast.svelte';
import { pickSecrets, readSlot, secretsPatch, SECRET_FIELDS, stripSecrets, touchesSecrets, type SecretField, type SecretSlot } from './secretSlots';
import { createVault, dropSlots, openVault, parseVaultFile, rewriteVault, storedSlots, VAULT_KEY, type VaultFile } from './vault';
import type { Settings } from './types';

export type { SecretSlot } from './secretSlots';

function readFile(): VaultFile | null {
  try {
    return typeof localStorage === 'undefined' ? null : parseVaultFile(localStorage.getItem(VAULT_KEY));
  } catch {
    return null;
  }
}

function writeFile(f: VaultFile | null): void {
  try {
    if (f) localStorage.setItem(VAULT_KEY, JSON.stringify(f));
    else localStorage.removeItem(VAULT_KEY);
  } catch {
    /* private mode / quota: the in-memory copy still works this session */
  }
}

let file: VaultFile | null = readFile();
let key: CryptoKey | null = null;

class VaultState {
  /** A passphrase lock is set up on this device. */
  enabled = $state(!!file);
  /** The passphrase was entered this session (the key is in memory). */
  unlocked = $state(false);
  /** Which secrets the vault holds (readable without the passphrase). */
  stored = $state<SecretSlot[]>(storedSlots(file));
  /** Set while the unlock dialog should show. */
  prompt = $state<{ reason: string } | null>(null);
}
export const vault = new VaultState();

let fileVersion = 0;
function setFile(f: VaultFile | null): void {
  fileVersion++;
  file = f;
  writeFile(f);
  vault.enabled = !!f;
  vault.stored = storedSlots(f);
}

// ---------- reading ----------
/** The current value of a secret ('' when unset or still locked). */
export function secret(slot: SecretSlot): string {
  return readSlot(store.settings, slot);
}

/** True when this secret is locked away (stored in the vault, passphrase not entered yet). */
export function isLocked(slot?: SecretSlot): boolean {
  if (!vault.enabled || vault.unlocked) return false;
  return slot ? vault.stored.includes(slot) && !secret(slot) : true;
}

/** A value exists for this secret, whether or not it's unlocked. */
export function hasSecret(slot: SecretSlot): boolean {
  return !!secret(slot) || isLocked(slot);
}

/** The value, asking for the passphrase first when it's locked (unless `interactive` is false). */
export async function useSecret(slot: SecretSlot, opts: { interactive?: boolean; reason?: string } = {}): Promise<string> {
  if (isLocked(slot) && opts.interactive !== false) await requestUnlock(opts.reason);
  return secret(slot);
}

// ---------- unlocking ----------
let pending: { promise: Promise<boolean>; resolve: (ok: boolean) => void } | null = null;

/** Show the unlock dialog (once; concurrent callers share it). Resolves false if the user cancels. */
export function requestUnlock(reason = 'Enter your passphrase to use your saved keys.'): Promise<boolean> {
  if (!vault.enabled || vault.unlocked) return Promise.resolve(true);
  if (pending) return pending.promise;
  let resolve!: (ok: boolean) => void;
  const promise = new Promise<boolean>((r) => (resolve = r));
  pending = { promise, resolve };
  vault.prompt = { reason };
  return promise;
}

export function cancelUnlock(): void {
  vault.prompt = null;
  pending?.resolve(false);
  pending = null;
}

// Writes into the settings object that must not be mirrored into the vault (lock / wipe).
let quiet = false;
function applyQuietly(patch: Partial<Settings>): void {
  quiet = true;
  try {
    store.updateSettings(patch);
  } finally {
    quiet = false;
  }
}

/** Try a passphrase. Throws WrongPassphraseError when it doesn't match. */
export async function unlock(passphrase: string): Promise<void> {
  if (!file) return;
  const opened = await openVault(file, passphrase);
  key = opened.key;
  vault.unlocked = true;
  vault.prompt = null;
  // anything typed in while locked is newer than the vault's copy
  const merged = { ...opened.values, ...pickSecrets(store.settings) };
  store.updateSettings(secretsPatch(store.settings, merged)); // → mirrored back into the vault below
  pending?.resolve(true);
  pending = null;
  emit('unlocked', {});
}

/** Forget the key and hide the secrets again until the passphrase is entered. */
export function lockNow(): void {
  if (!vault.enabled) return;
  key = null;
  vault.unlocked = false;
  applyQuietly(blankPatch());
}

function blankPatch(): Partial<Settings> {
  const p: Partial<Settings> = { aiKeys: {} };
  for (const f of SECRET_FIELDS) (p as Record<SecretField, string>)[f] = '';
  return p;
}

// ---------- keeping the vault in step with settings (called by store.updateSettings) ----------
/** What goes to localStorage: secrets blanked while the lock is on. */
export function settingsForDisk(s: Settings): Settings {
  return vault.enabled ? stripSecrets(s) : s;
}

let writing: Promise<void> = Promise.resolve();

function queueRewrite(): Promise<void> {
  writing = writing.then(async () => {
    if (!file || !key || !vault.unlocked) return;
    const [v, k] = [fileVersion, key];
    const next = await rewriteVault(file, k, pickSecrets(store.settings));
    // locked, forgotten or replaced meanwhile: this snapshot is stale
    if (v === fileVersion && k === key) setFile(next);
  });
  return writing;
}

export function afterSettingsChange(patch: Partial<Settings>): void {
  if (quiet || !vault.enabled || !touchesSecrets(patch)) return;
  if (vault.unlocked) {
    void queueRewrite();
    return;
  }
  // Locked: a cleared field is a removal (no key needed); a new value needs the passphrase to be saved.
  const cleared = SECRET_FIELDS.filter((f) => f in patch && !patch[f] && vault.stored.includes(f));
  if (cleared.length && file) setFile(dropSlots(file, cleared));
  if (Object.keys(pickSecrets(patch)).length) {
    void requestUnlock('Enter your passphrase to save the new key.').then((ok) => {
      if (!ok) toasts.push({ message: 'New key kept for this session only', detail: 'Unlock your keys to save it on this device.', kind: 'warn', timeout: 8000 });
    });
  }
}

/** Save secrets (an empty string removes one). While locked, this asks for the passphrase to store them. */
export function setSecrets(values: Partial<Record<SecretSlot, string>>): void {
  store.updateSettings(secretsPatch(store.settings, values));
}

/** Remove secrets (disconnect / remove key). Works while locked. */
export function forgetSecret(...slots: SecretSlot[]): void {
  if (file && !vault.unlocked) setFile(dropSlots(file, slots));
  store.updateSettings(secretsPatch(store.settings, Object.fromEntries(slots.map((s) => [s, '']))));
}

// ---------- managing the lock (Settings → Privacy & security) ----------
export async function enableLock(passphrase: string): Promise<void> {
  if (vault.enabled) throw new Error('A passphrase is already set.');
  const made = await createVault(passphrase, pickSecrets(store.settings));
  key = made.key;
  setFile(made.file);
  vault.unlocked = true;
  store.updateSettings({}); // re-save settings with the secrets blanked
}

export async function changePassphrase(passphrase: string): Promise<void> {
  if (!vault.enabled || !vault.unlocked) throw new Error('Unlock first.');
  await writing;
  const made = await createVault(passphrase, pickSecrets(store.settings));
  key = made.key;
  setFile(made.file);
}

/** Turn the lock off: secrets go back into settings in plain text. Needs the vault unlocked. */
export async function disableLock(): Promise<void> {
  if (!vault.enabled) return;
  if (!vault.unlocked) throw new Error('Unlock first.');
  await writing;
  vault.enabled = false;
  store.updateSettings({}); // plain copy first, then drop the vault
  setFile(null);
  key = null;
  vault.unlocked = false;
}

/** "Forgot my passphrase": delete the vault and every secret in it. Local data is untouched. */
export function forgetVault(): void {
  cancelUnlock();
  setFile(null);
  key = null;
  vault.unlocked = false;
  applyQuietly(blankPatch());
}

/** Slots that background work (sync on load, Schoology refresh, Spotify) needs. */
const BACKGROUND: SecretSlot[] = ['gistToken', 'syncPassphrase', 'schoologyFeedUrl', 'canvasFeedUrl', 'schoologyKey', 'spotifyRefreshToken'];

/**
 * Called once after startup. The less annoying option: ask right away only when something that runs in the
 * background is locked (sync would silently stop otherwise); AI keys alone wait until an AI feature is used.
 */
export function promptAtStartup(): void {
  if (vault.enabled && !vault.unlocked && BACKGROUND.some((s) => vault.stored.includes(s))) {
    void requestUnlock('Your keys are locked. Enter your passphrase to turn sync back on for this session.');
  }
}

/** For tests and "Delete everything". */
export function resetVault(): void {
  cancelUnlock();
  setFile(null);
  key = null;
  vault.unlocked = false;
}
