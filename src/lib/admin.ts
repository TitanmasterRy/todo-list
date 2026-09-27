// Admin panel helpers (pure, no Svelte). The panel itself is src/components/admin/AdminPanel.svelte.
//
// What "admin" means in an app with no server: the panel is hidden (Ctrl+Alt+Shift+A, ?admin in the address, or
// tapping the version in Settings → Help 7 times) and opens only with the admin passphrase. It edits this
// browser's data, and it publishes site-wide files (site.json, games.json) by committing them to the GitHub repo
// with a token, which redeploys the site. The token is the real key to the site; it's stored sealed with the
// admin passphrase and never synced.
import { fromBase64, toBase64 } from './crypto';
import type { Currency, LedgerEntry } from './types';

// ---------- passphrase ----------
export const ADMIN_ITERATIONS = 310_000;

async function pbkdf2(pass: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, 256));
}

/** A storable hash of the admin passphrase: `pbkdf2$<iterations>$<salt>$<hash>` (base64). Safe to put in VITE_ADMIN_HASH. */
export async function hashPassphrase(pass: string, iterations = ADMIN_ITERATIONS, salt = crypto.getRandomValues(new Uint8Array(16))): Promise<string> {
  return `pbkdf2$${iterations}$${toBase64(salt)}$${toBase64(await pbkdf2(pass, salt, iterations))}`;
}

export function isPassHash(s: unknown): s is string {
  return typeof s === 'string' && /^pbkdf2\$\d{4,7}\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/.test(s.trim());
}

export async function verifyPassphrase(pass: string, stored: string): Promise<boolean> {
  if (!isPassHash(stored)) return false;
  const [, iter, salt, hash] = stored.trim().split('$');
  const want = fromBase64(hash);
  const got = await pbkdf2(pass, fromBase64(salt), Number(iter));
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

// ---------- economy adjustments ----------
/** Ledger entries for an admin grant or take-back. Marked reason 'admin' so they're easy to spot (and undo). */
export function adjustEntries(currency: Currency | `item:${string}`, amount: number, note?: string): Omit<LedgerEntry, 'id' | 'at'>[] {
  const n = Math.trunc(amount);
  if (!n || !Number.isFinite(n)) return [];
  return [{ currency, amount: n, reason: 'admin', ref: note?.trim().slice(0, 80) || undefined }];
}

/** The reversal of a ledger entry (entries are never edited; see store.addLedger). */
export function reversal(e: LedgerEntry): Omit<LedgerEntry, 'id' | 'at'> {
  return { currency: e.currency, amount: -e.amount, reason: 'admin', ref: `undo ${e.id}` };
}

// ---------- site.json ----------
// (parsing lives in siteconfig.ts so the app's first load doesn't pull in the admin code)
export { activeAnnouncement, parseSite, type Announcement, type AnnouncementLevel, type SiteConfig, type SiteFlags } from './siteconfig';
import type { SiteConfig } from './siteconfig';

export function siteJson(site: SiteConfig): string {
  return JSON.stringify({ ...site, updatedAt: new Date().toISOString() }, null, 2) + '\n';
}

// ---------- publishing to GitHub ----------
export interface RepoTarget {
  owner: string;
  repo: string;
  branch: string;
}

/** Guess the repo from a GitHub Pages address: owner.github.io/repo/ → owner/repo. */
export function repoFromLocation(host: string, path: string): Partial<RepoTarget> {
  const m = /^([a-z0-9-]+)\.github\.io$/i.exec(host);
  if (!m) return {};
  const first = path.split('/').filter(Boolean)[0];
  return { owner: m[1], repo: first || `${m[1]}.github.io`, branch: 'main' };
}

export function validRepo(t: Partial<RepoTarget>): t is RepoTarget {
  return !!t.owner && !!t.repo && !!t.branch && /^[\w.-]+$/.test(t.owner) && /^[\w.-]+$/.test(t.repo) && /^[\w./-]+$/.test(t.branch);
}

/** UTF-8 safe base64 for the contents API. */
export function utf8ToBase64(s: string): string {
  return toBase64(new TextEncoder().encode(s));
}

type Fetch = typeof fetch;

/** Create or update one file in the repo (one commit). Returns the commit URL. */
export async function publishFile(opts: RepoTarget & { token: string; path: string; content: string; message: string }, f: Fetch = fetch): Promise<string> {
  const api = `https://api.github.com/repos/${opts.owner}/${opts.repo}/contents/${opts.path.split('/').map(encodeURIComponent).join('/')}`;
  const headers = { Authorization: `Bearer ${opts.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const cur = await f(`${api}?ref=${encodeURIComponent(opts.branch)}`, { headers });
  let sha: string | undefined;
  if (cur.ok) sha = ((await cur.json()) as { sha?: string }).sha;
  else if (cur.status !== 404) throw new Error(await ghError(cur));
  const res = await f(api, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: opts.message, content: utf8ToBase64(opts.content), branch: opts.branch, ...(sha ? { sha } : {}) }),
  });
  if (!res.ok) throw new Error(await ghError(res));
  const body = (await res.json()) as { commit?: { html_url?: string } };
  return body.commit?.html_url ?? '';
}

/** Read a text file from the repo (undefined if it doesn't exist). */
export async function readRepoFile(opts: RepoTarget & { token: string; path: string }, f: Fetch = fetch): Promise<string | undefined> {
  const api = `https://api.github.com/repos/${opts.owner}/${opts.repo}/contents/${opts.path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(opts.branch)}`;
  const res = await f(api, { headers: { Authorization: `Bearer ${opts.token}`, Accept: 'application/vnd.github.raw+json', 'X-GitHub-Api-Version': '2022-11-28' } });
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(await ghError(res));
  return res.text();
}

/** Add or replace one game in a games.json document, keeping everything else (and its shape) as is. */
export function upsertManifest(text: string | undefined, entry: Record<string, unknown> & { id: string }): string {
  let doc: unknown = text ? JSON.parse(text) : { games: [] };
  const wrapped = !Array.isArray(doc);
  if (wrapped && !(doc && typeof doc === 'object' && Array.isArray((doc as { games?: unknown }).games))) doc = { games: [] };
  const list = (wrapped ? (doc as { games: Record<string, unknown>[] }).games : (doc as Record<string, unknown>[])).filter((g) => g?.id !== entry.id);
  list.push(entry);
  const out = wrapped ? { ...(doc as object), games: list } : list;
  return JSON.stringify(out, null, 2) + '\n';
}

/** Remove a game from a games.json document. */
export function removeFromManifest(text: string, id: string): string {
  const doc = JSON.parse(text) as unknown;
  if (Array.isArray(doc))
    return (
      JSON.stringify(
        doc.filter((g: { id?: string }) => g?.id !== id),
        null,
        2,
      ) + '\n'
    );
  const d = doc as { games?: { id?: string }[] };
  return JSON.stringify({ ...d, games: (d.games ?? []).filter((g) => g?.id !== id) }, null, 2) + '\n';
}

async function ghError(res: Response): Promise<string> {
  let msg = '';
  try {
    msg = ((await res.json()) as { message?: string }).message ?? '';
  } catch {
    /* not JSON */
  }
  if (res.status === 401) return 'GitHub rejected the token (401). Check it hasn’t expired.';
  if (res.status === 403 || res.status === 404) return `GitHub said ${res.status}${msg ? `: ${msg}` : ''}. The token needs “Contents: read and write” on this repository.`;
  return `GitHub said ${res.status}${msg ? `: ${msg}` : ''}`;
}

// ---------- data browser ----------
export type RecordKey = IDBValidKey;

/** Short one-line preview of a stored record for the data browser list. */
export function recordLabel(v: unknown): string {
  if (!v || typeof v !== 'object') return String(v).slice(0, 80);
  const o = v as Record<string, unknown>;
  const name = o.title ?? o.name ?? o.front ?? o.reason ?? o.kind;
  return typeof name === 'string' ? name.slice(0, 80) : JSON.stringify(v).slice(0, 80);
}

/** Parse edited JSON for a record, keeping its key field unchanged. */
export function parseEditedRecord(text: string, keyPath: string | null, originalKey: RecordKey): { ok: true; value: unknown } | { ok: false; error: string } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Not valid JSON' };
  }
  if (keyPath) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'The record must be a JSON object.' };
    if ((value as Record<string, unknown>)[keyPath] !== originalKey)
      return { ok: false, error: `Keep "${keyPath}" the same (${String(originalKey)}). Delete and re-add to change it.` };
  }
  return { ok: true, value };
}
