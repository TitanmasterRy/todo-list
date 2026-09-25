// The key vault's storage format: one localStorage entry holding each secret slot encrypted on its own
// (so a locked vault can still drop a key without the passphrase) plus a check value that tells a wrong
// passphrase apart from an empty vault. Pure functions over plain objects; the reactive glue is secrets.svelte.ts.
import { decryptString, encryptString, fromBase64, keyContext, MIN_ITERATIONS, deriveKey, type Sealed } from './crypto';
import { isSecretSlot, type SecretSlot } from './secretSlots';

export const VAULT_KEY = 'homework-todo:vault';
const CHECK = 'homework-todo vault v1';

export interface VaultFile {
  v: 1;
  kdf: 'PBKDF2-SHA256';
  iter: number;
  salt: string;
  check: Sealed;
  items: Partial<Record<SecretSlot, Sealed>>;
}

export type SecretValues = Partial<Record<SecretSlot, string>>;

function isSealed(x: unknown): x is Sealed {
  return !!x && typeof (x as Sealed).iv === 'string' && typeof (x as Sealed).data === 'string';
}

/** Read the stored vault; null when there is none or it's unreadable. */
export function parseVaultFile(raw: string | null | undefined): VaultFile | null {
  if (!raw) return null;
  try {
    const f = JSON.parse(raw) as Partial<VaultFile>;
    if (f.v !== 1 || typeof f.salt !== 'string' || !isSealed(f.check) || !(Number(f.iter) >= MIN_ITERATIONS)) return null;
    const items: VaultFile['items'] = {};
    for (const [k, v] of Object.entries(f.items ?? {})) if (isSecretSlot(k) && isSealed(v)) items[k] = v;
    return { v: 1, kdf: 'PBKDF2-SHA256', iter: Number(f.iter), salt: f.salt, check: f.check, items };
  } catch {
    return null;
  }
}

async function sealAll(key: CryptoKey, values: SecretValues): Promise<VaultFile['items']> {
  const items: VaultFile['items'] = {};
  for (const [slot, v] of Object.entries(values) as [SecretSlot, string][]) if (v) items[slot] = await encryptString(key, v);
  return items;
}

/** A new vault (fresh salt) holding these values. */
export async function createVault(passphrase: string, values: SecretValues, iterations?: number): Promise<{ file: VaultFile; key: CryptoKey }> {
  const ctx = await keyContext(passphrase, undefined, iterations);
  const file: VaultFile = { v: 1, kdf: 'PBKDF2-SHA256', iter: ctx.iter, salt: ctx.salt, check: await encryptString(ctx.key, CHECK), items: await sealAll(ctx.key, values) };
  return { file, key: ctx.key };
}

/** Unlock: derive the key and decrypt every slot. Throws WrongPassphraseError on a wrong passphrase. */
export async function openVault(file: VaultFile, passphrase: string): Promise<{ key: CryptoKey; values: SecretValues }> {
  const key = await deriveKey(passphrase, fromBase64(file.salt), file.iter);
  await decryptString(key, file.check);
  const values: SecretValues = {};
  for (const [slot, sealed] of Object.entries(file.items) as [SecretSlot, Sealed][]) values[slot] = await decryptString(key, sealed);
  return { key, values };
}

/** Replace the vault's contents with these values (same salt and key, fresh IVs). */
export async function rewriteVault(file: VaultFile, key: CryptoKey, values: SecretValues): Promise<VaultFile> {
  return { ...file, items: await sealAll(key, values) };
}

/** Remove slots without the key (a locked vault can still forget a key). */
export function dropSlots(file: VaultFile, slots: SecretSlot[]): VaultFile {
  const items = { ...file.items };
  for (const s of slots) delete items[s];
  return { ...file, items };
}

export function storedSlots(file: VaultFile | null): SecretSlot[] {
  return file ? (Object.keys(file.items) as SecretSlot[]) : [];
}
