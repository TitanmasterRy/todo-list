// Optional GitHub Gist sync. Token (gist scope) lives only in localStorage via settings (or the key vault).
// With a sync passphrase, the gist holds an encrypted envelope instead of the plain bundle (syncCrypto.ts).
import { store } from './store.svelte';
import { on } from './events';
import { toasts } from './toast.svelte';
import { bundlesDiffer, mergeBundles } from './backup';
import { forgetSecret, hasSecret, isLocked, useSecret } from './secrets.svelte';
import { decodeFromSync, encodeForSync, SyncLockedError } from './syncCrypto';
import type { ExportBundle } from './types';

const GIST_FILE = 'homework-todo.json';
const API = 'https://api.github.com';
const DEBOUNCE_MS = 2000;

class SyncState {
  status = $state<'off' | 'idle' | 'syncing' | 'ok' | 'error'>('off');
  lastError = $state<string | null>(null);
  lastSyncAt = $state<string | null>(null);
  pending = $state(false);
}
export const sync = new SyncState();

let timer: ReturnType<typeof setTimeout> | undefined;
let inFlight: Promise<void> | null = null;
let started = false;
/** Set when the gist is encrypted and this device can't open it: pushing would overwrite it, so don't. */
let blocked: string | null = null;

function headers(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' };
}

function localBundle(): ExportBundle {
  return store.snapshotBundle();
}

async function fetchRemote(token: string, gistId: string, interactive: boolean): Promise<ExportBundle | null> {
  const res = await fetch(`${API}/gists/${gistId}`, { headers: headers(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await safeText(res)}`);
  const json = (await res.json()) as { files?: Record<string, { content?: string; truncated?: boolean; raw_url?: string }> };
  const file = json.files?.[GIST_FILE];
  if (!file) return null;
  let content = file.content ?? '';
  if (file.truncated && file.raw_url) {
    const raw = await fetch(file.raw_url, { headers: { Authorization: `Bearer ${token}` } });
    content = await raw.text();
  }
  if (!content.trim()) return null;
  return decodeFromSync(JSON.parse(content), { interactive });
}

async function writeRemote(token: string, gistId: string | '', bundle: ExportBundle, interactive: boolean): Promise<string> {
  const payload = await encodeForSync(bundle, { interactive });
  const body = JSON.stringify({
    description: 'Homework To-Do data (private sync)',
    public: false,
    files: { [GIST_FILE]: { content: JSON.stringify(payload) } },
  });
  const res = gistId
    ? await fetch(`${API}/gists/${gistId}`, { method: 'PATCH', headers: headers(token), body })
    : await fetch(`${API}/gists`, { method: 'POST', headers: headers(token), body });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await safeText(res)}`);
  const json = (await res.json()) as { id: string };
  return json.id;
}

async function safeText(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { message?: string };
    return j.message ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

/** Pull remote, merge (last-write-wins per task), apply locally, then push the merged result. */
export async function syncNow(opts: { pull?: boolean; interactive?: boolean } = { pull: true }): Promise<void> {
  const interactive = !!opts.interactive;
  if (!hasSecret('gistToken')) {
    sync.status = 'off';
    return;
  }
  // background syncs wait quietly for the key lock; "Sync now" asks for the passphrase
  if (!interactive && isLocked('gistToken')) {
    sync.status = 'idle';
    sync.pending = true;
    return;
  }
  if (inFlight) return inFlight;
  const token = await useSecret('gistToken');
  const { gistId } = store.settings;
  if (!token) return;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    sync.status = 'syncing';
    sync.lastError = null;
    try {
      let local = localBundle();
      let id = gistId;
      if (!opts.pull && blocked) throw new SyncLockedError(blocked);
      if (opts.pull && id) {
        const remote = await fetchRemote(token, id, interactive);
        blocked = null;
        if (remote) {
          const { merged, conflicts } = mergeBundles(local, remote);
          const changed = bundlesDiffer(merged, local);
          if (changed) {
            await store.loadBundle(merged);
            local = localBundle();
          }
          if (conflicts.length) {
            const names = conflicts.map((cid) => merged.tasks.find((t) => t.id === cid)?.title ?? cid).slice(0, 3);
            toasts.push({
              message: `Sync conflict on ${conflicts.length} task${conflicts.length > 1 ? 's' : ''}`,
              detail: `Edited on two devices in the same second; kept the newer copy. ${names.join(', ')}`,
              kind: 'warn',
              emoji: '⚠️',
              timeout: 10000,
            });
          }
        }
      }
      id = await writeRemote(token, id, local, interactive);
      if (id !== gistId) store.updateSettings({ gistId: id });
      sync.lastSyncAt = new Date().toISOString();
      store.updateSettings({ lastSyncAt: sync.lastSyncAt });
      sync.status = 'ok';
      sync.pending = false;
    } catch (e) {
      sync.status = 'error';
      sync.lastError = e instanceof Error ? e.message : String(e);
      if (e instanceof SyncLockedError && opts.pull) blocked = e.message;
      console.warn('gist sync failed', e);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function scheduleSync(): void {
  if (!hasSecret('gistToken')) return;
  sync.pending = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void syncNow({ pull: false }), DEBOUNCE_MS);
}

/** Call once after the store is ready: sync on load and after changes (debounced). */
export function startSync(): void {
  if (started) return;
  started = true;
  on('changed', () => scheduleSync());
  on('unlocked', () => {
    if (hasSecret('gistToken')) void syncNow({ pull: true });
  });
  if (hasSecret('gistToken')) {
    sync.status = 'idle';
    void syncNow({ pull: true });
  }
  window.addEventListener('online', () => {
    if (sync.pending || sync.status === 'error') void syncNow({ pull: true });
  });
}

/** Validate a token by hitting /user; returns the login or throws. */
export async function checkToken(token: string): Promise<string> {
  const res = await fetch(`${API}/user`, { headers: headers(token) });
  if (!res.ok) throw new Error(res.status === 401 ? 'Token rejected (401). Make sure it has the gist scope.' : `GitHub ${res.status}`);
  const j = (await res.json()) as { login: string };
  return j.login;
}

export function disconnect(): void {
  forgetSecret('gistToken');
  store.updateSettings({ gistId: '', lastSyncAt: undefined });
  blocked = null;
  sync.status = 'off';
  sync.lastError = null;
  sync.pending = false;
}

/** Delete the sync gist on GitHub (for "Delete everything"). Resolves false when there was none. */
export async function deleteGist(): Promise<boolean> {
  const token = await useSecret('gistToken', { reason: 'Enter your passphrase to delete your gist.' });
  const { gistId } = store.settings;
  if (!token && isLocked('gistToken')) throw new Error('Your keys are locked, so the gist was not deleted.');
  if (!token || !gistId) return false;
  const res = await fetch(`${API}/gists/${gistId}`, { method: 'DELETE', headers: headers(token) });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await safeText(res)}`);
  return true;
}
