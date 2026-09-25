// Email + password accounts for sync, backed by Supabase (free tier): Supabase Auth handles sign-up,
// password hashing, email confirmation and reset emails; one row per user in `user_data` holds the
// synced bundle, protected by row-level security (see docs/supabase.sql).
//
// The site admin configures the project once with VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY at build
// time (or in Settings → Account → Server). The anon key is public by design; RLS keeps rows private.
import type { SupabaseClient, Session } from '@supabase/supabase-js';
import { store } from './store.svelte';
import { on } from './events';
import { bundlesDiffer, mergeBundles, parseBundle } from './backup';
import { toasts } from './toast.svelte';
import type { ExportBundle } from './types';

const TABLE = 'user_data';
const DEBOUNCE_MS = 3000;
export const MIN_PASSWORD = 8;

export type AccountStatus = 'unconfigured' | 'signedOut' | 'idle' | 'syncing' | 'ok' | 'error';

class AccountState {
  status = $state<AccountStatus>('unconfigured');
  email = $state<string | null>(null);
  userId = $state<string | null>(null);
  lastError = $state<string | null>(null);
  lastSyncAt = $state<string | null>(store.settings.lastAccountSyncAt ?? null);
  /** Set when the user arrived from a password-reset email and needs to choose a new password. */
  recovering = $state(false);
  pending = $state(false);
}

export const account = new AccountState();

/** Project URL and public anon key: Settings override first, then build-time env. */
export function accountConfig(): { url: string; anonKey: string } | null {
  const url = (store.settings.accountUrl || (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '').trim().replace(/\/+$/, '');
  const anonKey = (store.settings.accountAnonKey || (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '').trim();
  return url && anonKey ? { url, anonKey } : null;
}

/** True when the server was set at build time (the Settings fields are then optional). */
export function configuredAtBuild(): boolean {
  return !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

let client: SupabaseClient | null = null;
let clientKey = '';

async function getClient(): Promise<SupabaseClient> {
  const cfg = accountConfig();
  if (!cfg) throw new Error('Accounts are not set up on this site yet. See Settings → Account → Server.');
  const key = `${cfg.url}|${cfg.anonKey}`;
  if (client && clientKey === key) return client;
  const { createClient } = await import('@supabase/supabase-js');
  client = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'homework-todo:auth' },
  });
  clientKey = key;
  client.auth.onAuthStateChange((event, session) => {
    applySession(session);
    if (event === 'PASSWORD_RECOVERY') {
      account.recovering = true;
      store.go('settings');
      toasts.push({ message: 'Choose a new password', detail: 'Settings → Account', kind: 'info', emoji: '🔑', timeout: 8000 });
    }
    if (event === 'SIGNED_IN') void syncNow({ pull: true });
  });
  return client;
}

function applySession(session: Session | null): void {
  account.email = session?.user.email ?? null;
  account.userId = session?.user.id ?? null;
  if (!session) {
    account.status = accountConfig() ? 'signedOut' : 'unconfigured';
  } else if (account.status === 'signedOut' || account.status === 'unconfigured') {
    account.status = 'idle';
  }
}

function redirectUrl(): string {
  return `${location.origin}${import.meta.env.BASE_URL}`;
}

function friendly(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (/invalid login credentials/i.test(msg)) return 'Wrong email or password.';
  if (/email not confirmed/i.test(msg)) return 'Confirm your email first: check your inbox for the link.';
  if (/already registered|already exists/i.test(msg)) return 'That email already has an account. Sign in instead.';
  if (/rate limit|too many/i.test(msg)) return 'Too many attempts. Wait a minute and try again.';
  if (/failed to fetch|networkerror|load failed/i.test(msg)) return 'Could not reach the account server. Check your connection.';
  if (/relation .*user_data.* does not exist|schema cache/i.test(msg)) return 'The account server is missing its table. The site admin needs to run docs/supabase.sql.';
  return msg;
}

export function validateCredentials(email: string, password: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.';
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters for the password.`;
  return null;
}

// ---------- auth ----------
export async function signUp(email: string, password: string): Promise<'signedIn' | 'confirmEmail'> {
  const bad = validateCredentials(email, password);
  if (bad) throw new Error(bad);
  const c = await getClient();
  const { data, error } = await c.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectUrl() } });
  if (error) throw new Error(friendly(error));
  // Supabase returns a user with no identities when the email is already registered (to avoid leaking accounts)
  if (data.user && data.user.identities && data.user.identities.length === 0) throw new Error('That email already has an account. Sign in instead.');
  if (data.session) {
    applySession(data.session);
    return 'signedIn';
  }
  return 'confirmEmail';
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!email.trim() || !password) throw new Error('Enter your email and password.');
  const c = await getClient();
  const { data, error } = await c.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(friendly(error));
  applySession(data.session);
}

export async function signOut(): Promise<void> {
  const c = await getClient();
  await c.auth.signOut();
  applySession(null);
  account.lastSyncAt = null;
  store.updateSettings({ lastAccountSyncAt: undefined });
}

export async function sendPasswordReset(email: string): Promise<void> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Enter the email you signed up with.');
  const c = await getClient();
  const { error } = await c.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectUrl() });
  if (error) throw new Error(friendly(error));
}

export async function changePassword(password: string): Promise<void> {
  if (password.length < MIN_PASSWORD) throw new Error(`Use at least ${MIN_PASSWORD} characters for the password.`);
  const c = await getClient();
  const { error } = await c.auth.updateUser({ password });
  if (error) throw new Error(friendly(error));
  account.recovering = false;
}

/** Delete this account's synced data from the server (the login itself is removed by the site admin). */
export async function deleteServerData(): Promise<void> {
  const c = await getClient();
  if (!account.userId) throw new Error('Not signed in.');
  const { error } = await c.from(TABLE).delete().eq('user_id', account.userId);
  if (error) throw new Error(friendly(error));
}

// ---------- sync ----------
let inFlight: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

interface Row {
  data: unknown;
  version: number;
}

async function readRow(c: SupabaseClient, userId: string): Promise<Row | null> {
  const { data, error } = await c.from(TABLE).select('data, version').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(friendly(error));
  return (data as Row | null) ?? null;
}

/**
 * Pull the account's copy, merge it with this device (same rules as Gist/Drive sync), apply locally,
 * then write it back. Writes are conditional on the version read, so two devices syncing at the same
 * moment can't overwrite each other: the loser re-reads, re-merges and tries again.
 */
export async function syncNow(_opts: { pull?: boolean } = { pull: true }): Promise<void> {
  if (!accountConfig() || !account.userId) return;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    account.status = 'syncing';
    account.lastError = null;
    try {
      const c = await getClient();
      const userId = account.userId!;
      for (let attempt = 0; attempt < 4; attempt++) {
        let local: ExportBundle = store.snapshotBundle();
        const row = await readRow(c, userId);
        let version = 0;
        if (row) {
          version = row.version;
          const remote = parseBundle(row.data);
          const { merged, conflicts } = mergeBundles(local, remote);
          if (bundlesDiffer(merged, local)) {
            await store.loadBundle(merged);
            local = store.snapshotBundle();
          }
          if (conflicts.length) toasts.push({ message: `Sync kept the newer copy of ${conflicts.length} task${conflicts.length > 1 ? 's' : ''}`, kind: 'warn', emoji: '⚠️' });
          if (!bundlesDiffer(local, remote)) break; // server already has everything
        }
        const now = new Date().toISOString();
        if (!row) {
          const { error } = await c.from(TABLE).insert({ user_id: userId, data: local, version: 1, updated_at: now });
          if (!error) break;
          if (/duplicate|unique|conflict/i.test(error.message)) continue; // another device created it first
          throw new Error(friendly(error));
        }
        const { data, error } = await c
          .from(TABLE)
          .update({ data: local, version: version + 1, updated_at: now })
          .eq('user_id', userId)
          .eq('version', version)
          .select('version');
        if (error) throw new Error(friendly(error));
        if (data && data.length) break;
        // version moved on: someone else wrote in between; loop to re-merge
        if (attempt === 3) throw new Error('Another device kept syncing at the same time. Try again.');
      }
      account.lastSyncAt = new Date().toISOString();
      store.updateSettings({ lastAccountSyncAt: account.lastSyncAt });
      account.status = 'ok';
      account.pending = false;
    } catch (e) {
      account.status = 'error';
      account.lastError = friendly(e);
      console.warn('account sync failed', e);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

function scheduleSync(): void {
  if (!account.userId) return;
  account.pending = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void syncNow({ pull: false }), DEBOUNCE_MS);
}

let started = false;
/** Call once after the store is ready. Restores the saved session, syncs on load and after changes. */
export async function startAccount(): Promise<void> {
  if (started) return;
  started = true;
  on('changed', (e) => {
    if (e.reason !== 'reset') scheduleSync();
  });
  window.addEventListener('online', () => {
    if (account.pending || account.status === 'error') void syncNow({ pull: true });
  });
  if (!accountConfig()) return;
  account.status = 'signedOut';
  try {
    const c = await getClient();
    const { data } = await c.auth.getSession();
    applySession(data.session);
    if (data.session) void syncNow({ pull: true });
  } catch (e) {
    console.warn('account init failed', e);
  }
}

/** Re-read config after the server settings change. */
export async function reconfigure(): Promise<void> {
  client = null;
  clientKey = '';
  applySession(null);
  if (!accountConfig()) return;
  const c = await getClient();
  const { data } = await c.auth.getSession();
  applySession(data.session);
}
