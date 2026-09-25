// Which settings are secrets, and how to read/write them as flat "slots" (each AI provider's key is its own
// slot, so the vault can say which keys exist without decrypting). Pure helpers; the vault lives in secrets.svelte.ts.
import type { AiProvider, Settings } from './types';

/** String settings that are credentials (or, for the Schoology feed URL, contain a private token). */
export const SECRET_FIELDS = ['gistToken', 'aiApiKey', 'schoologyFeedUrl', 'schoologyKey', 'schoologySecret', 'spotifyRefreshToken', 'syncPassphrase'] as const;
export type SecretField = (typeof SECRET_FIELDS)[number];
export type SecretSlot = SecretField | `aiKeys.${AiProvider}`;

export function isSecretSlot(x: string): x is SecretSlot {
  return (SECRET_FIELDS as readonly string[]).includes(x) || /^aiKeys\.[a-z]+$/.test(x);
}

/** True when a settings patch writes any secret (so the vault must be updated). */
export function touchesSecrets(patch: Partial<Settings>): boolean {
  return 'aiKeys' in patch || SECRET_FIELDS.some((f) => f in patch);
}

export function readSlot(s: Partial<Settings>, slot: SecretSlot): string {
  if (slot.startsWith('aiKeys.')) return s.aiKeys?.[slot.slice(7) as AiProvider] ?? '';
  return (s[slot as SecretField] as string | undefined) ?? '';
}

/** Every non-empty secret in these settings, as a flat slot → value map. */
export function pickSecrets(s: Partial<Settings>): Partial<Record<SecretSlot, string>> {
  const out: Partial<Record<SecretSlot, string>> = {};
  for (const f of SECRET_FIELDS) if (s[f]) out[f] = s[f] as string;
  for (const [p, v] of Object.entries(s.aiKeys ?? {})) if (v) out[`aiKeys.${p as AiProvider}`] = v;
  return out;
}

/** The same settings with every secret blanked (what is written to localStorage while the vault is on). */
export function stripSecrets<T extends Partial<Settings>>(s: T): T {
  const out = { ...s };
  for (const f of SECRET_FIELDS) if (f in out) (out as Partial<Settings>)[f] = '';
  if ('aiKeys' in out) (out as Partial<Settings>).aiKeys = {};
  return out;
}

/** A settings patch that writes these slot values (aiKeys merged into the current map). */
export function secretsPatch(current: Partial<Settings>, values: Partial<Record<SecretSlot, string>>): Partial<Settings> {
  const patch: Partial<Settings> = {};
  let aiKeys: Settings['aiKeys'] | undefined;
  for (const [slot, v] of Object.entries(values) as [SecretSlot, string][]) {
    if (slot.startsWith('aiKeys.')) {
      aiKeys ??= { ...(current.aiKeys ?? {}) };
      const p = slot.slice(7) as AiProvider;
      if (v) aiKeys[p] = v;
      else delete aiKeys[p];
    } else (patch as Record<string, string>)[slot] = v;
  }
  if (aiKeys) patch.aiKeys = aiKeys;
  return patch;
}

/** Secrets never arrive from an imported file: keep this device's own. */
export function withoutSecrets(s: Partial<Settings>): Partial<Settings> {
  const out = { ...s };
  for (const f of SECRET_FIELDS) delete out[f];
  delete out.aiKeys;
  return out;
}
