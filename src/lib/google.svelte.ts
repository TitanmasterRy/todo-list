// Google integration without a backend: Google Identity Services token flow in the browser.
// The access token lives in memory only; the OAuth Client ID is the only thing stored (in settings).
// Features: Gmail scan, Google Classroom import, Google Calendar push, optional Drive appdata sync.
import { store } from './store.svelte';
import { on } from './events';
import { toasts } from './toast.svelte';
import { mergeBundles, parseBundle } from './backup';
import { addDaysKey, dueKey, isDateOnly, pad } from './dates';
import { inferType } from './schoology';
import type { ExportBundle, Task } from './types';
import type { GmailMessage } from './google-parse';
export type { GmailMessage } from './google-parse';

export const SCOPE_GMAIL = 'https://www.googleapis.com/auth/gmail.readonly';
export const SCOPE_CAL = 'https://www.googleapis.com/auth/calendar.events';
export const SCOPE_CLASSROOM =
  'https://www.googleapis.com/auth/classroom.courses.readonly https://www.googleapis.com/auth/classroom.coursework.me.readonly https://www.googleapis.com/auth/classroom.student-submissions.me.readonly';
export const SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive.appdata';
const SCOPE_BASE = 'openid email';

export const DEFAULT_GMAIL_QUERY = 'newer_than:30d (assignment OR homework OR due OR quiz OR test OR project)';
export const GCAL_MAP_KEY = 'homework-todo:gcal-map';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';
const CAL_API = 'https://www.googleapis.com/calendar/v3';
const CLASSROOM_API = 'https://classroom.googleapis.com/v1';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const DRIVE_FILE = 'homework-todo.json';
const DEBOUNCE_MS = 3000;

// ---------- minimal GIS typing ----------
interface GisTokenResponse {
  access_token?: string;
  expires_in?: number | string;
  scope?: string;
  error?: string;
  error_description?: string;
}
interface GisTokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}
interface GisTokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: GisTokenResponse) => void;
  prompt?: string;
  include_granted_scopes?: boolean;
  error_callback?: (err: { type: string; message?: string }) => void;
}
interface GisOAuth2 {
  initTokenClient(config: GisTokenClientConfig): GisTokenClient;
  revoke(token: string, done?: () => void): void;
}
declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GisOAuth2 } };
  }
}

// ---------- state ----------
class GoogleState {
  status = $state<'off' | 'ready' | 'signedIn' | 'error'>('off');
  error = $state<string | null>(null);
  email = $state<string | null>(null);
  scopes = $state<string[]>([]);
  syncStatus = $state<'idle' | 'syncing' | 'ok' | 'error'>('idle');
  syncError = $state<string | null>(null);
}
export const google = new GoogleState();

interface TokenInfo {
  value: string;
  expiresAt: number;
  scopes: string[];
}
let token: TokenInfo | null = null;
let gisPromise: Promise<void> | null = null;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function splitScopes(scopes: string[]): string[] {
  return Array.from(new Set(scopes.flatMap((s) => s.split(/\s+/)).filter(Boolean)));
}

function clientId(): string {
  return (store.settings.googleClientId ?? '').trim();
}

// ---------- GIS loading and tokens ----------
/** Inject the GIS script once and resolve when window.google.accounts.oauth2 is available. */
export function loadGis(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google sign-in needs a browser'));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<void>((resolve, reject) => {
    const fail = (msg: string) => {
      gisPromise = null;
      reject(new Error(msg));
    };
    const waitReady = () => {
      const started = Date.now();
      const tick = () => {
        if (window.google?.accounts?.oauth2) resolve();
        else if (Date.now() - started > 10_000) fail('Google sign-in script loaded but did not initialize');
        else setTimeout(tick, 50);
      };
      tick();
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      waitReady();
      return;
    }
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = waitReady;
    s.onerror = () => fail('Could not load the Google sign-in script (offline, or blocked by an extension?)');
    document.head.appendChild(s);
  });
  return gisPromise;
}

function describeAuthError(r: GisTokenResponse): string {
  switch (r.error) {
    case 'access_denied':
      return 'Google access was denied. Approve the requested permissions to continue.';
    case 'invalid_client':
      return 'Google rejected the Client ID. Check it in Settings.';
    case 'immediate_failed':
    case 'interaction_required':
      return 'Sign in again.';
    default:
      return r.error_description ?? r.error ?? 'Google sign-in failed';
  }
}

function requestToken(scopes: string[], prompt: string): Promise<TokenInfo> {
  const id = clientId();
  if (!id) return Promise.reject(new Error('Paste your Google OAuth Client ID in Settings first.'));
  return new Promise<TokenInfo>((resolve, reject) => {
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) return reject(new Error('Google sign-in is not loaded yet'));
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };
    try {
      const client = oauth2.initTokenClient({
        client_id: id,
        scope: scopes.join(' '),
        prompt,
        include_granted_scopes: true,
        callback: (r) => {
          if (r.error || !r.access_token) return done(() => reject(new Error(describeAuthError(r))));
          const ttl = Number(r.expires_in ?? 3600);
          done(() =>
            resolve({
              value: r.access_token!,
              expiresAt: Date.now() + (Number.isFinite(ttl) ? ttl : 3600) * 1000 - 60_000,
              scopes: splitScopes([r.scope ?? scopes.join(' ')]),
            }),
          );
        },
        error_callback: (e) => {
          const msg =
            e.type === 'popup_closed'
              ? 'The Google sign-in window was closed before finishing.'
              : e.type === 'popup_failed_to_open'
                ? 'The sign-in popup was blocked. Allow popups for this site and try again.'
                : (e.message ?? `Google sign-in failed (${e.type})`);
          done(() => reject(new Error(msg)));
        },
      });
      client.requestAccessToken({ prompt });
    } catch (e) {
      done(() => reject(e instanceof Error ? e : new Error(String(e))));
    }
  });
}

function hasValidToken(scopes: string[]): boolean {
  if (!token || token.expiresAt <= Date.now()) return false;
  const have = new Set(token.scopes);
  return splitScopes(scopes).every((s) => have.has(s));
}

async function fetchEmail(): Promise<void> {
  if (!token) return;
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token.value}` } });
    if (res.ok) {
      const j = (await res.json()) as { email?: string };
      google.email = j.email ?? null;
    }
  } catch {
    /* email is cosmetic */
  }
}

/** Interactive sign-in requesting the given feature scopes (openid + email are always included). */
export async function signIn(scopes: string[]): Promise<void> {
  google.error = null;
  try {
    await loadGis();
    const wanted = splitScopes([SCOPE_BASE, ...(token?.scopes ?? []), ...scopes]);
    token = await requestToken(wanted, token ? '' : 'select_account');
    google.scopes = token.scopes;
    google.status = 'signedIn';
    await fetchEmail();
  } catch (e) {
    google.status = clientId() ? 'ready' : 'off';
    google.error = e instanceof Error ? e.message : String(e);
    throw e;
  }
}

/** Return a valid access token covering `scopes`, re-prompting (silently where Google allows) if expired or missing. */
export async function ensureToken(scopes: string[]): Promise<string> {
  if (hasValidToken(scopes)) return token!.value;
  await loadGis();
  const wanted = splitScopes([SCOPE_BASE, ...(token?.scopes ?? []), ...scopes]);
  try {
    token = await requestToken(wanted, '');
  } catch (e) {
    google.error = e instanceof Error ? e.message : String(e);
    throw e;
  }
  google.scopes = token.scopes;
  google.status = 'signedIn';
  if (!google.email) void fetchEmail();
  return token.value;
}

export function isSignedIn(): boolean {
  return !!token && token.expiresAt > Date.now();
}

export function signOut(): void {
  const t = token;
  token = null;
  google.status = clientId() ? 'ready' : 'off';
  google.email = null;
  google.scopes = [];
  google.error = null;
  google.syncStatus = 'idle';
  if (t && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(t.value);
    } catch {
      /* best effort */
    }
  }
}

// ---------- fetch wrapper ----------
interface ApiOpts {
  scopes: string[];
  api: string; // human name for error messages, e.g. "Gmail API"
  method?: string;
  body?: BodyInit;
  headers?: Record<string, string>;
  text?: boolean;
}

async function describeHttpError(res: Response, api: string): Promise<string> {
  let detail = '';
  let reason = '';
  try {
    const j = (await res.json()) as { error?: { message?: string; status?: string; errors?: { reason?: string }[] } | string; error_description?: string };
    if (typeof j.error === 'string') detail = j.error_description ?? j.error;
    else {
      detail = j.error?.message ?? '';
      reason = j.error?.errors?.[0]?.reason ?? j.error?.status ?? '';
    }
  } catch {
    /* no JSON body */
  }
  if (res.status === 401) {
    token = null;
    google.status = clientId() ? 'ready' : 'off';
    return 'Your Google session expired. Sign in again.';
  }
  if (res.status === 403) {
    if (/has not been used|is disabled|accessNotConfigured|SERVICE_DISABLED/i.test(`${reason} ${detail}`)) {
      return `Enable the ${api} in your Google Cloud project (APIs & Services → Library → ${api} → Enable), then try again.`;
    }
    if (/insufficient|ACCESS_TOKEN_SCOPE_INSUFFICIENT|forbidden/i.test(`${reason} ${detail}`)) {
      return `Google did not grant access to the ${api}. Sign in again and allow it.`;
    }
    return `Enable the ${api} in your Google Cloud project (APIs & Services → Library) and make sure your account is a test user.${detail ? ` (${detail})` : ''}`;
  }
  if (res.status === 429) return `Google rate limit hit on the ${api}. Wait a minute and try again.`;
  if (res.status === 404) return `${api}: not found${detail ? ` (${detail})` : ''}`;
  return `${api} error ${res.status}${detail ? `: ${detail}` : ''}`;
}

async function api<T>(url: string, o: ApiOpts): Promise<T> {
  const t = await ensureToken(o.scopes);
  let res: Response;
  try {
    res = await fetch(url, { method: o.method ?? 'GET', headers: { Authorization: `Bearer ${t}`, ...(o.headers ?? {}) }, body: o.body });
  } catch (e) {
    throw new Error(`Could not reach the ${o.api} (offline?)`);
  }
  if (!res.ok) throw new ApiError(res.status, await describeHttpError(res, o.api));
  if (o.text) return (await res.text()) as unknown as T;
  if (res.status === 204) return undefined as T;
  const body = await res.text();
  return (body ? JSON.parse(body) : undefined) as T;
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

// ---------- Gmail ----------
interface GmailListResponse {
  messages?: { id: string; threadId: string }[];
}
interface GmailMessageResponse {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  payload?: { headers?: { name: string; value: string }[] };
}

/** Search mail with a Gmail query and return light-weight message metadata. */
export async function scanGmail(query: string, max = 25): Promise<GmailMessage[]> {
  const o: ApiOpts = { scopes: [SCOPE_GMAIL], api: 'Gmail API' };
  const list = await api<GmailListResponse>(`${GMAIL_API}/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${Math.max(1, Math.min(100, max))}`, o);
  const refs = list.messages ?? [];
  if (!refs.length) return [];
  const msgs = await pool(refs, 5, (ref) =>
    api<GmailMessageResponse>(`${GMAIL_API}/users/me/messages/${ref.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, o),
  );
  return msgs.map((m) => {
    const header = (name: string) => m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
    const ms = Number(m.internalDate);
    let date = Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : '';
    if (!date) {
      const d = new Date(header('Date'));
      date = Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    }
    return {
      id: m.id,
      threadId: m.threadId,
      subject: decodeEntities(header('Subject')),
      from: decodeEntities(header('From')),
      date,
      snippet: decodeEntities(m.snippet ?? ''),
      url: `https://mail.google.com/mail/u/0/#inbox/${m.threadId}`,
    };
  });
}

// ---------- Google Calendar ----------
function readCalMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(GCAL_MAP_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}
function writeCalMap(map: Record<string, string>): void {
  try {
    localStorage.setItem(GCAL_MAP_KEY, JSON.stringify(map));
  } catch {
    /* storage full or unavailable */
  }
}

function eventBody(task: Task): Record<string, unknown> {
  const course = store.courseById(task.courseId);
  const summary = course ? `[${course.name}] ${task.title}` : task.title;
  const description = [task.notes?.trim(), task.url].filter(Boolean).join('\n\n');
  const due = task.dueAt!;
  let start: Record<string, string>;
  let end: Record<string, string>;
  if (isDateOnly(due)) {
    start = { date: due };
    end = { date: addDaysKey(due, 1) };
  } else {
    const s = new Date(due);
    const e = new Date(s.getTime() + 30 * 60_000);
    start = { dateTime: s.toISOString() };
    end = { dateTime: e.toISOString() };
  }
  return {
    summary,
    description: description || undefined,
    start,
    end,
    extendedProperties: { private: { homeworkTodoTaskId: task.id } },
  };
}

/** Create or update one calendar event per dated task; the task→event map lives in localStorage. */
export async function pushTasksToCalendar(tasks: Task[], calendarId = 'primary'): Promise<{ created: number; updated: number }> {
  const o: ApiOpts = { scopes: [SCOPE_CAL], api: 'Google Calendar API', headers: { 'Content-Type': 'application/json' } };
  const base = `${CAL_API}/calendars/${encodeURIComponent(calendarId)}/events`;
  const map = readCalMap();
  let created = 0;
  let updated = 0;
  const dated = tasks.filter((t) => !!t.dueAt);
  await pool(dated, 3, async (task) => {
    const body = JSON.stringify(eventBody(task));
    const existing = map[task.id];
    if (existing) {
      try {
        await api(`${base}/${encodeURIComponent(existing)}`, { ...o, method: 'PATCH', body });
        updated++;
        return;
      } catch (e) {
        if (!(e instanceof ApiError && (e.status === 404 || e.status === 410))) throw e;
        delete map[task.id];
      }
    }
    const ev = await api<{ id: string }>(base, { ...o, method: 'POST', body });
    map[task.id] = ev.id;
    created++;
  });
  writeCalMap(map);
  return { created, updated };
}

// ---------- Google Classroom ----------
export interface ClassroomWork {
  externalId: string;
  title: string;
  courseName: string;
  dueAt?: string;
  url: string;
  notes?: string;
  type: 'homework' | 'quiz' | 'exam' | 'project' | 'reading';
  done: boolean;
}
interface ClassroomCourse {
  id: string;
  name: string;
  section?: string;
}
interface CourseWork {
  id: string;
  title: string;
  description?: string;
  alternateLink?: string;
  workType?: string;
  state?: string;
  dueDate?: { year: number; month: number; day: number };
  dueTime?: { hours?: number; minutes?: number };
}

async function pageAll<T>(url: string, key: string, o: ApiOpts): Promise<T[]> {
  const out: T[] = [];
  let pageToken: string | undefined;
  for (let guard = 0; guard < 20; guard++) {
    const u = pageToken ? `${url}&pageToken=${encodeURIComponent(pageToken)}` : url;
    const res = await api<Record<string, unknown>>(u, o);
    const items = res?.[key];
    if (Array.isArray(items)) out.push(...(items as T[]));
    pageToken = typeof res?.nextPageToken === 'string' ? res.nextPageToken : undefined;
    if (!pageToken) break;
  }
  return out;
}

function classroomDue(cw: CourseWork): string | undefined {
  const d = cw.dueDate;
  if (!d?.year || !d.month || !d.day) return undefined;
  if (cw.dueTime && (cw.dueTime.hours !== undefined || cw.dueTime.minutes !== undefined)) {
    // Classroom due times are given in UTC.
    return new Date(Date.UTC(d.year, d.month - 1, d.day, cw.dueTime.hours ?? 0, cw.dueTime.minutes ?? 0)).toISOString();
  }
  return `${d.year}-${pad(d.month)}-${pad(d.day)}`;
}

function classroomType(cw: CourseWork): ClassroomWork['type'] {
  if (cw.workType === 'SHORT_ANSWER_QUESTION' || cw.workType === 'MULTIPLE_CHOICE_QUESTION') return 'quiz';
  const t = inferType(cw.title ?? '');
  return t === 'other' ? 'homework' : t;
}

/** Active courses plus their published coursework, with turned-in/returned items flagged done. */
export async function importClassroom(): Promise<{ courses: { id: string; name: string }[]; work: ClassroomWork[] }> {
  const o: ApiOpts = { scopes: [SCOPE_CLASSROOM], api: 'Google Classroom API' };
  const courses = await pageAll<ClassroomCourse>(`${CLASSROOM_API}/courses?courseStates=ACTIVE&pageSize=100`, 'courses', o);
  const work: ClassroomWork[] = [];
  await pool(courses, 3, async (c) => {
    const [items, submissions] = await Promise.all([
      pageAll<CourseWork>(`${CLASSROOM_API}/courses/${encodeURIComponent(c.id)}/courseWork?pageSize=100`, 'courseWork', o),
      pageAll<{ courseWorkId: string; state?: string }>(
        `${CLASSROOM_API}/courses/${encodeURIComponent(c.id)}/courseWork/-/studentSubmissions?states=TURNED_IN&states=RETURNED&pageSize=100`,
        'studentSubmissions',
        o,
      ).catch(() => [] as { courseWorkId: string }[]), // teachers have no submissions of their own
    ]);
    const done = new Set(submissions.map((s) => s.courseWorkId));
    for (const cw of items) {
      if (!cw.id || !cw.title) continue;
      if (cw.state && cw.state !== 'PUBLISHED') continue;
      const notes = cw.description?.trim().slice(0, 2000) || undefined;
      work.push({
        externalId: `classroom:${cw.id}`,
        title: cw.title.trim(),
        courseName: c.name,
        dueAt: classroomDue(cw),
        url: cw.alternateLink ?? `https://classroom.google.com/c/${c.id}`,
        notes,
        type: classroomType(cw),
        done: done.has(cw.id),
      });
    }
  });
  work.sort((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'));
  return { courses: courses.map((c) => ({ id: c.id, name: c.name })), work };
}

// ---------- Drive appdata sync ----------
let timer: ReturnType<typeof setTimeout> | undefined;
let inFlight: Promise<void> | null = null;
let started = false;

function localBundle(): ExportBundle {
  return store.snapshotBundle();
}

const driveOpts: ApiOpts = { scopes: [SCOPE_DRIVE], api: 'Google Drive API' };

async function findDriveFile(): Promise<string | null> {
  const q = encodeURIComponent(`name='${DRIVE_FILE}' and 'appDataFolder' in parents and trashed=false`);
  const res = await api<{ files?: { id: string }[] }>(`${DRIVE_API}/files?q=${q}&spaces=appDataFolder&fields=files(id,name)`, driveOpts);
  return res.files?.[0]?.id ?? null;
}

async function readDriveFile(id: string): Promise<ExportBundle | null> {
  try {
    const text = await api<string>(`${DRIVE_API}/files/${encodeURIComponent(id)}?alt=media`, { ...driveOpts, text: true });
    if (!text.trim()) return null;
    return parseBundle(JSON.parse(text));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

async function createDriveFile(bundle: ExportBundle): Promise<string> {
  const boundary = `hw${Date.now().toString(36)}`;
  const meta = JSON.stringify({ name: DRIVE_FILE, parents: ['appDataFolder'], mimeType: 'application/json' });
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(bundle)}\r\n--${boundary}--`;
  const res = await api<{ id: string }>(`${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id`, {
    ...driveOpts,
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return res.id;
}

async function updateDriveFile(id: string, bundle: ExportBundle): Promise<string> {
  const res = await api<{ id?: string }>(`${DRIVE_UPLOAD}/files/${encodeURIComponent(id)}?uploadType=media&fields=id`, {
    ...driveOpts,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bundle),
  });
  return res?.id ?? id;
}

function bundleKey(b: ExportBundle): string {
  return JSON.stringify({ t: b.tasks, c: b.courses, tp: b.templates, n: b.dayNotes, s: b.stats, d: b.decks ?? [], k: b.cards ?? [], ts: b.tombstones ?? [], l: b.ledger ?? [] });
}

/**
 * Pull the appdata file, merge (last-write-wins per task), apply locally when changed, then push the merged result.
 * Background runs (`interactive: false`) never open a sign-in popup; they just report that a sign-in is needed.
 */
export async function driveSync(opts: { pull: boolean; interactive?: boolean } = { pull: true }): Promise<void> {
  if (!store.settings.googleSyncEnabled) {
    google.syncStatus = 'idle';
    return;
  }
  if (inFlight) return inFlight;
  inFlight = (async () => {
    google.syncStatus = 'syncing';
    google.syncError = null;
    try {
      if (!opts.interactive && !hasValidToken([SCOPE_DRIVE])) throw new Error('Sign in to Google to sync.');
      let local = localBundle();
      let id = store.settings.googleDriveFileId || (await findDriveFile()) || '';
      if (opts.pull && id) {
        const remote = await readDriveFile(id);
        if (remote === null) {
          id = (await findDriveFile()) ?? '';
        } else {
          const { merged, conflicts } = mergeBundles(local, remote);
          if (bundleKey(merged) !== bundleKey(local)) {
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
      try {
        id = id ? await updateDriveFile(id, local) : await createDriveFile(local);
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) throw e;
        id = await createDriveFile(local);
      }
      const at = new Date().toISOString();
      const patch: Record<string, unknown> = { lastGoogleSyncAt: at };
      if (id !== store.settings.googleDriveFileId) patch.googleDriveFileId = id;
      store.updateSettings(patch);
      google.syncStatus = 'ok';
    } catch (e) {
      google.syncStatus = 'error';
      google.syncError = e instanceof Error ? e.message : String(e);
      console.warn('google drive sync failed', e);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Debounced background push after local changes. */
export function scheduleDriveSync(): void {
  if (!store.settings.googleSyncEnabled) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void driveSync({ pull: false, interactive: false }), DEBOUNCE_MS);
}

/** Call once after the store is ready. The token is in memory only, so the first sync happens after the user signs in. */
export function startGoogleSync(): void {
  if (started) return;
  started = true;
  google.status = clientId() ? 'ready' : 'off';
  on('changed', () => scheduleDriveSync());
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      if (store.settings.googleSyncEnabled && google.syncStatus === 'error' && hasValidToken([SCOPE_DRIVE])) void driveSync({ pull: true, interactive: false });
    });
  }
}

/** Scopes needed for the features currently switched on (Gmail and Calendar are always offered). */
export function neededScopes(): string[] {
  const s = [SCOPE_GMAIL, SCOPE_CAL];
  if (store.settings.googleClassroomEnabled) s.push(SCOPE_CLASSROOM);
  if (store.settings.googleSyncEnabled) s.push(SCOPE_DRIVE);
  return s;
}

/** Open, dated tasks due within the next `days` days (for the calendar push). */
export function upcomingDatedTasks(days = 30): Task[] {
  const today = store.today;
  const limit = addDaysKey(today, days);
  return store.openTasks.filter((t) => t.dueAt && dueKey(t.dueAt) >= today && dueKey(t.dueAt) <= limit);
}
