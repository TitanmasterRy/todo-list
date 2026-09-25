// Optional Spotify Web API integration using Authorization Code + PKCE (no backend).
// Access token lives in memory; the rotating refresh token is persisted via settings (localStorage).
import { store } from './store.svelte';
import type { Settings } from './types';

const ACCOUNTS = 'https://accounts.spotify.com';
const API = 'https://api.spotify.com/v1';
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private user-read-private streaming';
const SS_VERIFIER = 'spotify_pkce_verifier';
const SS_STATE = 'spotify_pkce_state';
const POLL_MS = 5000;

export interface SpotifyTrack {
  name: string;
  artists: string;
  album: string;
  image?: string;
  durationMs: number;
  progressMs: number;
  uri: string;
}
export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  volume?: number;
}
export interface SpotifyPlayback {
  isPlaying: boolean;
  track?: SpotifyTrack;
  device?: { id: string; name: string; type: string; volume?: number };
}
export interface SpotifyPlaylist {
  id: string;
  name: string;
  uri: string;
  image?: string;
  owner: string;
}

class SpotifyState {
  status = $state<'off' | 'connecting' | 'connected' | 'error'>('off');
  error = $state<string | null>(null);
  user = $state<{ name: string; product?: string } | null>(null);
  playback = $state<SpotifyPlayback | null>(null);
  devices = $state<SpotifyDevice[]>([]);
  premium = $state(false);
}
export const spotify = new SpotifyState();

let accessToken = '';
let expiresAt = 0;
let refreshing: Promise<string> | null = null;
let pollTimer: ReturnType<typeof setInterval> | undefined;

// ---------- pure helpers ----------
function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** PKCE verifier (43-128 chars, unreserved set) and its S256 challenge. */
export async function pkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(64)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

export type EmbedProvider = 'spotify' | 'apple' | 'youtube' | 'soundcloud';

/** Convert a share link into an embeddable iframe src. Returns null for unsupported links. */
export function toEmbedUrl(url: string): { provider: EmbedProvider; src: string } | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.replace(/^www\./, '');
  const parts = u.pathname.split('/').filter(Boolean);

  if (host === 'open.spotify.com') {
    // Optional locale prefix (e.g. /intl-de/track/...) and /embed/ already present.
    const rest = parts.filter((p) => !/^intl-/.test(p) && p !== 'embed');
    const [type, id] = rest;
    if (['playlist', 'album', 'track', 'episode'].includes(type ?? '') && /^[A-Za-z0-9]+$/.test(id ?? '')) {
      return { provider: 'spotify', src: `https://open.spotify.com/embed/${type}/${id}?theme=0` };
    }
    return null;
  }
  if (host === 'music.apple.com' || host === 'embed.music.apple.com') {
    const [cc, type] = parts;
    if (/^[a-z]{2}$/i.test(cc ?? '') && (type === 'album' || type === 'playlist')) {
      return { provider: 'apple', src: `https://embed.music.apple.com/${parts.join('/')}${u.search}` };
    }
    return null;
  }
  if (host === 'youtu.be') {
    const id = parts[0];
    return id ? { provider: 'youtube', src: `https://www.youtube.com/embed/${id}` } : null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
    const list = u.searchParams.get('list');
    const v = u.searchParams.get('v');
    if (parts[0] === 'playlist' && list) return { provider: 'youtube', src: `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(list)}` };
    if (v) return { provider: 'youtube', src: `https://www.youtube.com/embed/${encodeURIComponent(v)}` };
    if ((parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') && parts[1]) return { provider: 'youtube', src: `https://www.youtube.com/embed/${parts[1]}` };
    if (list) return { provider: 'youtube', src: `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(list)}` };
    return null;
  }
  if (host === 'soundcloud.com' || host === 'on.soundcloud.com' || host === 'api.soundcloud.com' || host === 'w.soundcloud.com') {
    return { provider: 'soundcloud', src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u.toString())}` };
  }
  return null;
}

// ---------- auth ----------
function redirectUri(): string {
  return location.origin + location.pathname;
}

function clientId(): string {
  return store.settings.spotifyClientId?.trim() ?? '';
}

function fail(e: unknown): void {
  spotify.status = 'error';
  spotify.error = e instanceof Error ? e.message : String(e);
  console.warn('spotify', e);
}

export async function login(id: string = clientId()): Promise<void> {
  if (!id) throw new Error('Add your Spotify Client ID in Settings first.');
  const { verifier, challenge } = await pkce();
  const state = base64url(crypto.getRandomValues(new Uint8Array(16)));
  sessionStorage.setItem(SS_VERIFIER, verifier);
  sessionStorage.setItem(SS_STATE, state);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: id,
    scope: SCOPES,
    redirect_uri: redirectUri(),
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });
  spotify.status = 'connecting';
  location.assign(`${ACCOUNTS}/authorize?${params}`);
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<void> {
  const res = await fetch(`${ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !json.access_token) throw new Error(json.error_description ?? json.error ?? `Spotify token ${res.status}`);
  accessToken = json.access_token;
  expiresAt = Date.now() + (json.expires_in - 60) * 1000;
  if (json.refresh_token && json.refresh_token !== store.settings.spotifyRefreshToken) {
    store.updateSettings({ spotifyRefreshToken: json.refresh_token } satisfies Partial<Settings>);
  }
}

/** Finish the PKCE dance if we just came back from Spotify. Returns true if a redirect was handled. */
export async function handleRedirect(): Promise<boolean> {
  const url = new URL(location.href);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const err = url.searchParams.get('error');
  const expected = sessionStorage.getItem(SS_STATE);
  if (!expected || (!code && !err) || state !== expected) return false;
  const verifier = sessionStorage.getItem(SS_VERIFIER) ?? '';
  sessionStorage.removeItem(SS_STATE);
  sessionStorage.removeItem(SS_VERIFIER);
  for (const k of ['code', 'state', 'error']) url.searchParams.delete(k);
  history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
  if (err || !code) {
    fail(new Error(err === 'access_denied' ? 'Spotify access was denied.' : `Spotify: ${err}`));
    return true;
  }
  spotify.status = 'connecting';
  try {
    await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(), client_id: clientId(), code_verifier: verifier });
    spotify.status = 'connected';
    spotify.error = null;
  } catch (e) {
    fail(e);
  }
  return true;
}

/** Return a valid access token, refreshing with the stored refresh token when needed. */
export async function ensureToken(): Promise<string> {
  if (accessToken && Date.now() < expiresAt) return accessToken;
  if (refreshing) return refreshing;
  const refresh = store.settings.spotifyRefreshToken;
  if (!refresh) throw new Error('Not connected to Spotify.');
  refreshing = (async () => {
    try {
      await tokenRequest({ grant_type: 'refresh_token', refresh_token: refresh, client_id: clientId() });
      return accessToken;
    } catch (e) {
      // A dead refresh token cannot recover; drop it so the UI offers Connect again.
      if (e instanceof Error && /invalid_grant|revoked/i.test(e.message)) logout();
      throw e;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export function logout(): void {
  stopPolling();
  accessToken = '';
  expiresAt = 0;
  store.updateSettings({ spotifyRefreshToken: '' });
  spotify.status = 'off';
  spotify.error = null;
  spotify.user = null;
  spotify.playback = null;
  spotify.devices = [];
  spotify.premium = false;
}

// ---------- API ----------
async function api<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const token = await ensureToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) },
  });
  if (res.status === 204 || res.status === 202) return null;
  const json = (await res.json().catch(() => null)) as (T & { error?: { status?: number; message?: string; reason?: string } }) | null;
  if (!res.ok) {
    const reason = json?.error?.reason ?? '';
    const message = json?.error?.message ?? '';
    if (res.status === 403 && (reason === 'PREMIUM_REQUIRED' || /premium/i.test(message))) {
      throw new Error('Playback control needs Spotify Premium; the embedded player still works.');
    }
    if (res.status === 404 && (reason === 'NO_ACTIVE_DEVICE' || /no active device|device not found/i.test(message))) {
      throw new Error('Open Spotify on a device first, then pick it below.');
    }
    if (res.status === 401) {
      accessToken = '';
      expiresAt = 0;
    }
    throw new Error(message || `Spotify ${res.status}`);
  }
  return json;
}

const body = (o: unknown): RequestInit => ({ method: 'PUT', body: JSON.stringify(o) });

interface RawTrack {
  name: string;
  uri: string;
  duration_ms: number;
  artists?: { name: string }[];
  album?: { name: string; images?: { url: string }[] };
  show?: { name: string; images?: { url: string }[] };
}
interface RawPlayback {
  is_playing: boolean;
  progress_ms: number | null;
  item: RawTrack | null;
  device?: { id: string | null; name: string; type: string; volume_percent: number | null };
}
interface RawPlaylist {
  id: string;
  name: string;
  uri: string;
  images?: { url: string }[] | null;
  owner?: { display_name?: string; id: string };
}

const mapPlaylist = (p: RawPlaylist): SpotifyPlaylist => ({ id: p.id, name: p.name, uri: p.uri, image: p.images?.at(-1)?.url, owner: p.owner?.display_name ?? p.owner?.id ?? '' });

export async function getMe(): Promise<{ name: string; product?: string }> {
  const me = await api<{ display_name?: string; id: string; product?: string }>('/me');
  const user = { name: me?.display_name ?? me?.id ?? 'Spotify user', product: me?.product };
  spotify.user = user;
  spotify.premium = me?.product === 'premium';
  return user;
}

export async function getPlayback(): Promise<SpotifyPlayback | null> {
  const p = await api<RawPlayback>('/me/player?additional_types=track,episode');
  if (!p) {
    spotify.playback = null;
    return null;
  }
  const it = p.item;
  const coll = it?.album ?? it?.show;
  const pb: SpotifyPlayback = {
    isPlaying: p.is_playing,
    track: it
      ? {
          name: it.name,
          artists: it.artists?.map((a) => a.name).join(', ') ?? coll?.name ?? '',
          album: coll?.name ?? '',
          image: coll?.images?.[0]?.url,
          durationMs: it.duration_ms,
          progressMs: p.progress_ms ?? 0,
          uri: it.uri,
        }
      : undefined,
    device: p.device?.id ? { id: p.device.id, name: p.device.name, type: p.device.type, volume: p.device.volume_percent ?? undefined } : undefined,
  };
  spotify.playback = pb;
  return pb;
}

export async function getDevices(): Promise<SpotifyDevice[]> {
  const r = await api<{ devices: { id: string | null; name: string; type: string; is_active: boolean; volume_percent: number | null }[] }>('/me/player/devices');
  spotify.devices = (r?.devices ?? []).filter((d) => d.id).map((d) => ({ id: d.id!, name: d.name, type: d.type, isActive: d.is_active, volume: d.volume_percent ?? undefined }));
  return spotify.devices;
}

export async function transferPlayback(deviceId: string, play = true): Promise<void> {
  await api('/me/player', body({ device_ids: [deviceId], play }));
  setTimeout(() => void refreshPlayback(), 800);
}

export async function play(opts: { contextUri?: string; uris?: string[]; deviceId?: string } = {}): Promise<void> {
  const q = opts.deviceId ? `?device_id=${encodeURIComponent(opts.deviceId)}` : '';
  const payload: Record<string, unknown> = {};
  if (opts.contextUri) payload.context_uri = opts.contextUri;
  if (opts.uris) payload.uris = opts.uris;
  await api(`/me/player/play${q}`, { method: 'PUT', body: Object.keys(payload).length ? JSON.stringify(payload) : undefined });
  if (spotify.playback) spotify.playback = { ...spotify.playback, isPlaying: true };
  setTimeout(() => void refreshPlayback(), 600);
}

export async function pause(): Promise<void> {
  await api('/me/player/pause', { method: 'PUT' });
  if (spotify.playback) spotify.playback = { ...spotify.playback, isPlaying: false };
}

export async function next(): Promise<void> {
  await api('/me/player/next', { method: 'POST' });
  setTimeout(() => void refreshPlayback(), 600);
}

export async function previous(): Promise<void> {
  await api('/me/player/previous', { method: 'POST' });
  setTimeout(() => void refreshPlayback(), 600);
}

export async function setVolume(pct: number): Promise<void> {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  await api(`/me/player/volume?volume_percent=${v}`, { method: 'PUT' });
  if (spotify.playback?.device) spotify.playback = { ...spotify.playback, device: { ...spotify.playback.device, volume: v } };
}

export async function seek(ms: number): Promise<void> {
  await api(`/me/player/seek?position_ms=${Math.max(0, Math.round(ms))}`, { method: 'PUT' });
  if (spotify.playback?.track) spotify.playback = { ...spotify.playback, track: { ...spotify.playback.track, progressMs: ms } };
}

export async function searchPlaylists(q: string): Promise<SpotifyPlaylist[]> {
  if (!q.trim()) return [];
  const r = await api<{ playlists?: { items?: (RawPlaylist | null)[] } }>(`/search?type=playlist&limit=8&q=${encodeURIComponent(q.trim())}`);
  return (r?.playlists?.items ?? []).filter((p): p is RawPlaylist => !!p).map(mapPlaylist);
}

export async function myPlaylists(): Promise<SpotifyPlaylist[]> {
  const r = await api<{ items?: (RawPlaylist | null)[] }>('/me/playlists?limit=20');
  return (r?.items ?? []).filter((p): p is RawPlaylist => !!p).map(mapPlaylist);
}

// ---------- lifecycle ----------
async function refreshPlayback(): Promise<void> {
  try {
    await getPlayback();
  } catch (e) {
    console.warn('spotify playback', e);
  }
}

function tick(): void {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  if (!store.settings.spotifyRefreshToken) return;
  void refreshPlayback();
}

/** Poll playback every 5 s while the tab is visible. Call from the panel when it opens. */
export function startPolling(): void {
  if (pollTimer) return;
  tick();
  pollTimer = setInterval(tick, POLL_MS);
}

export function stopPolling(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = undefined;
}

/** Call once on app load: finish a pending login, then restore the session from the refresh token. */
export async function init(): Promise<void> {
  if (typeof window === 'undefined') return;
  await handleRedirect();
  if (!store.settings.spotifyRefreshToken || !clientId()) {
    if (spotify.status !== 'error') spotify.status = 'off';
    return;
  }
  try {
    if (spotify.status !== 'connected') spotify.status = 'connecting';
    await ensureToken();
    await Promise.all([getMe(), refreshPlayback()]);
    spotify.status = 'connected';
    spotify.error = null;
  } catch (e) {
    fail(e);
  }
}
