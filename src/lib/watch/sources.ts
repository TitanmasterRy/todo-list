// Play → Watch: the list of sources the user added on this device (localStorage `homework-todo:watch`), saved
// positions for direct video links, and this browser's media-server device id. Versioned and validated on load, so
// a damaged or older entry never breaks the tab. Server sign-in tokens are not here: they're kept with the app's
// other keys (Settings → Privacy & security can lock them), as a small JSON map in the `watchTokens` secret.
import { httpUrl } from './embed';

export type SourceKind = 'jellyfin' | 'emby' | 'web' | 'embed' | 'direct';
export const SOURCE_KINDS: SourceKind[] = ['jellyfin', 'emby', 'web', 'embed', 'direct'];

export interface WatchSource {
  id: string;
  kind: SourceKind;
  name: string;
  /** server address (jellyfin/emby, no trailing slash), page (web), share link (embed) or file URL (direct) */
  url: string;
  /** media servers: the signed-in user */
  userId?: string;
  userName?: string;
  addedAt: string;
}

export interface SavedPosition {
  /** seconds */
  t: number;
  /** when it was saved (ms) */
  at: number;
}

export interface WatchData {
  v: typeof WATCH_VERSION;
  /** sent to media servers to tell this browser's sessions apart */
  deviceId: string;
  sources: WatchSource[];
  /** direct-link resume points, by source id */
  positions: Record<string, SavedPosition>;
  /** playback speed last used */
  speed: number;
}

export const WATCH_KEY = 'homework-todo:watch';
export const WATCH_VERSION = 1;
const MAX_SOURCES = 100;
const MAX_POSITIONS = 200;

export function randomId(bytes = 12): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function emptyWatch(deviceId = randomId(16)): WatchData {
  return { v: WATCH_VERSION, deviceId, sources: [], positions: {}, speed: 1 };
}

const str = (x: unknown, max: number): string => (typeof x === 'string' ? x.trim().slice(0, max) : '');

/** Server address as stored: http(s), no trailing slash, no query or hash, and without the "/web/…" app path. */
export function normalizeServer(input: string): string | null {
  const u = httpUrl(input);
  if (!u) return null;
  const path = u.pathname.replace(/\/web(\/.*)?$/i, '').replace(/\/+$/, '');
  return `${u.protocol}//${u.host}${path}`;
}

/** A source from untrusted JSON, or null when it doesn't make sense. */
export function cleanSource(x: unknown): WatchSource | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const kind = o.kind as SourceKind;
  if (!SOURCE_KINDS.includes(kind)) return null;
  const id = str(o.id, 64);
  if (!/^[\w-]{1,64}$/.test(id)) return null;
  const rawUrl = str(o.url, 2000);
  const url = kind === 'jellyfin' || kind === 'emby' ? normalizeServer(rawUrl) : httpUrl(rawUrl)?.href;
  if (!url) return null;
  const out: WatchSource = { id, kind, name: str(o.name, 80) || hostLabel(url), url, addedAt: str(o.addedAt, 40) || new Date(0).toISOString() };
  const userId = str(o.userId, 64);
  if (userId && /^[\w-]+$/.test(userId)) out.userId = userId;
  const userName = str(o.userName, 80);
  if (userName) out.userName = userName;
  return out;
}

export function hostLabel(url: string): string {
  return httpUrl(url)?.host ?? url;
}

/**
 * Read the saved entry. Version 0 (before the format was versioned) was a bare array of sources; anything
 * unreadable starts fresh.
 */
export function parseWatch(raw: string | null): WatchData {
  let json: unknown;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }
  if (Array.isArray(json)) json = { v: 0, sources: json };
  if (!json || typeof json !== 'object') return emptyWatch();
  const o = json as Record<string, unknown>;
  const deviceId = str(o.deviceId, 64);
  const data = emptyWatch(/^[\w-]{8,64}$/.test(deviceId) ? deviceId : undefined);
  const seen = new Set<string>();
  for (const s of Array.isArray(o.sources) ? o.sources : []) {
    const c = cleanSource(s);
    if (c && !seen.has(c.id) && data.sources.length < MAX_SOURCES) {
      seen.add(c.id);
      data.sources.push(c);
    }
  }
  if (o.positions && typeof o.positions === 'object') {
    for (const [k, v] of Object.entries(o.positions as Record<string, unknown>)) {
      const p = v as SavedPosition | null;
      if (/^[\w:.-]{1,80}$/.test(k) && p && Number.isFinite(p.t) && p.t > 0 && Number.isFinite(p.at)) data.positions[k] = { t: p.t, at: p.at };
    }
    data.positions = trimPositions(data.positions);
  }
  const speed = Number(o.speed);
  if (Number.isFinite(speed) && speed >= 0.25 && speed <= 4) data.speed = speed;
  return data;
}

export function loadWatch(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): WatchData {
  try {
    return parseWatch(storage?.getItem(WATCH_KEY) ?? null);
  } catch {
    return emptyWatch();
  }
}

export function saveWatch(data: WatchData, storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage): boolean {
  try {
    storage?.setItem(WATCH_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false; // private mode / quota: works for this session only
  }
}

function trimPositions(p: Record<string, SavedPosition>): Record<string, SavedPosition> {
  const entries = Object.entries(p).sort((a, b) => b[1].at - a[1].at);
  return Object.fromEntries(entries.slice(0, MAX_POSITIONS));
}

/**
 * Remember where playback got to. Near the start or the end there's nothing to resume, so the entry is dropped.
 */
export function rememberPosition(positions: Record<string, SavedPosition>, key: string, seconds: number, duration: number, now = Date.now()): Record<string, SavedPosition> {
  const out = { ...positions };
  const nearEnd = Number.isFinite(duration) && duration > 0 && (seconds >= duration - 10 || seconds / duration > 0.95);
  if (!Number.isFinite(seconds) || seconds < 5 || nearEnd) delete out[key];
  else out[key] = { t: Math.floor(seconds), at: now };
  return trimPositions(out);
}

// ---------- server sign-ins (the `watchTokens` secret) ----------
/** Source id → access token, from the stored secret (tolerates junk). */
export function parseTokens(json: string): Record<string, string> {
  try {
    const o = JSON.parse(json || '{}') as unknown;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    return Object.fromEntries(Object.entries(o as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string' && !!e[1] && /^[\w-]{1,64}$/.test(e[0])));
  } catch {
    return {};
  }
}

/** The stored secret with this source's token set (or removed, for ''). '' when no tokens are left. */
export function withToken(json: string, id: string, token: string): string {
  const map = parseTokens(json);
  if (token) map[id] = token;
  else delete map[id];
  return Object.keys(map).length ? JSON.stringify(map) : '';
}
