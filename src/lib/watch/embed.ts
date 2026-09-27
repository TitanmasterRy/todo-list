// Play → Watch: turn a link the user pastes into something the app can show. Share links from the common video
// sites become their embeddable player URLs, video files go to the built-in <video> player, and anything else is
// shown as a web page in a frame. Pure (no DOM), so it's unit-tested.

export type Playable =
  /** a page in an iframe; `provider` picks the referrer policy (some players refuse to run without one) */
  | { kind: 'iframe'; src: string; provider: EmbedProvider }
  /** a video file for the built-in player; `hls` when it's an .m3u8 playlist */
  | { kind: 'video'; src: string; hls: boolean };

export type EmbedProvider = 'youtube' | 'vimeo' | 'twitch' | 'dailymotion' | 'archive' | 'drive' | 'web';

const VIDEO_EXT = /\.(mp4|m4v|webm|ogv|ogg|mov|mkv)$/i;
const HLS_EXT = /\.m3u8$/i;

/** The URL when it's http(s), else null. Accepts a bare host ("example.com/x") as https. */
export function httpUrl(input: string): URL | null {
  const s = input.trim();
  if (!s || /\s/.test(s)) return null;
  // "host:8096/x" has no scheme (a port follows the colon); "javascript:…" or "data:…" keep theirs and are refused
  const withScheme = /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!u.hostname || u.username || u.password) return null;
    return u;
  } catch {
    return null;
  }
}

/** Seconds from a YouTube-style time: "90", "90s", "1m30s", "1h2m3s". */
export function parseStartTime(t: string | null): number {
  if (!t) return 0;
  if (/^\d+s?$/.test(t)) return parseInt(t, 10);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  if (!m || !t) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

const YT_ID = /^[\w-]{6,20}$/;

function youtube(u: URL, host: string, parts: string[]): string | null {
  let id: string | null = null;
  if (host === 'youtu.be') id = parts[0] ?? null;
  else if (u.searchParams.get('v')) id = u.searchParams.get('v');
  else if (['embed', 'shorts', 'live', 'v'].includes(parts[0] ?? '')) id = parts[1] ?? null;
  const list = u.searchParams.get('list');
  const start = parseStartTime(u.searchParams.get('t') ?? u.searchParams.get('start'));
  const q = new URLSearchParams();
  if (start > 0) q.set('start', String(start));
  if (id && YT_ID.test(id)) {
    if (list && /^[\w-]+$/.test(list)) q.set('list', list);
    const qs = q.toString();
    return `https://www.youtube-nocookie.com/embed/${id}${qs ? `?${qs}` : ''}`;
  }
  if (list && /^[\w-]+$/.test(list)) return `https://www.youtube-nocookie.com/embed/videoseries?list=${list}`;
  return null;
}

function vimeo(u: URL, host: string, parts: string[]): string | null {
  if (host === 'player.vimeo.com') return parts[0] === 'video' && /^\d+$/.test(parts[1] ?? '') ? `https://player.vimeo.com/video/${parts[1]}${u.search}` : null;
  // vimeo.com/123, /channels/x/123, /groups/x/videos/123, /showcase/x/video/123, unlisted vimeo.com/123/abcdef
  const i = parts.findIndex((p) => /^\d+$/.test(p));
  if (i < 0) return null;
  const id = parts[i];
  const hash = parts[i + 1] && /^[0-9a-f]{6,20}$/i.test(parts[i + 1]) ? parts[i + 1] : u.searchParams.get('h');
  return `https://player.vimeo.com/video/${id}${hash && /^[0-9a-f]+$/i.test(hash) ? `?h=${hash}` : ''}`;
}

function twitch(u: URL, host: string, parts: string[], parent: string): string | null {
  const p = encodeURIComponent(parent || 'localhost');
  if (host === 'clips.twitch.tv') return parts[0] && /^[\w-]+$/.test(parts[0]) ? `https://clips.twitch.tv/embed?clip=${parts[0]}&parent=${p}` : null;
  if (host === 'player.twitch.tv') {
    const ch = u.searchParams.get('channel');
    const v = u.searchParams.get('video');
    if (ch && /^\w+$/.test(ch)) return `https://player.twitch.tv/?channel=${ch}&parent=${p}`;
    if (v && /^v?\d+$/.test(v)) return `https://player.twitch.tv/?video=${v.replace(/^v?/, 'v')}&parent=${p}`;
    return null;
  }
  if (parts[0] === 'videos' && /^\d+$/.test(parts[1] ?? '')) return `https://player.twitch.tv/?video=v${parts[1]}&parent=${p}`;
  if (parts[1] === 'clip' && parts[2] && /^[\w-]+$/.test(parts[2])) return `https://clips.twitch.tv/embed?clip=${parts[2]}&parent=${p}`;
  if (parts.length === 1 && /^\w{3,25}$/.test(parts[0]) && !['directory', 'videos', 'settings', 'p', 'search', 'downloads'].includes(parts[0]))
    return `https://player.twitch.tv/?channel=${parts[0].toLowerCase()}&parent=${p}`;
  return null;
}

function dailymotion(host: string, parts: string[]): string | null {
  let id = '';
  if (host === 'dai.ly') id = parts[0] ?? '';
  else if (parts[0] === 'video') id = parts[1] ?? '';
  else if (parts[0] === 'embed' && parts[1] === 'video') id = parts[2] ?? '';
  id = id.split('_')[0];
  return /^[a-z0-9]{5,12}$/i.test(id) ? `https://www.dailymotion.com/embed/video/${id}` : null;
}

function archive(parts: string[]): string | null {
  if ((parts[0] === 'details' || parts[0] === 'embed') && parts[1] && /^[\w.-]+$/.test(parts[1])) {
    const file = parts.slice(2).map(encodeURIComponent).join('/');
    return `https://archive.org/embed/${parts[1]}${file ? `/${file}` : ''}`;
  }
  return null;
}

function drive(u: URL, parts: string[]): string | null {
  const id = parts[0] === 'file' && parts[1] === 'd' ? parts[2] : u.searchParams.get('id');
  return id && /^[\w-]{10,}$/.test(id) ? `https://drive.google.com/file/d/${id}/preview` : null;
}

/** Is this a link to a video file the built-in player can try (by its extension)? */
export function videoFileKind(u: URL): 'video' | 'hls' | null {
  if (HLS_EXT.test(u.pathname)) return 'hls';
  if (VIDEO_EXT.test(u.pathname)) return 'video';
  return null;
}

/**
 * What to do with a pasted link. `parentHost` is this page's hostname (Twitch's player insists on it).
 * Returns null when it isn't an http(s) link.
 */
export function toPlayable(input: string, parentHost = 'localhost'): Playable | null {
  const u = httpUrl(input);
  if (!u) return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
  const parts = u.pathname
    .split('/')
    .filter(Boolean)
    .map((p) => decodeURIComponentSafe(p));
  const iframe = (src: string | null, provider: EmbedProvider): Playable | null => (src ? { kind: 'iframe', src, provider } : null);

  if (host === 'youtu.be' || host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
    const r = iframe(youtube(u, host, parts), 'youtube');
    if (r) return r;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const r = iframe(vimeo(u, host, parts), 'vimeo');
    if (r) return r;
  }
  if (host === 'twitch.tv' || host === 'clips.twitch.tv' || host === 'player.twitch.tv') {
    const r = iframe(twitch(u, host, parts, parentHost), 'twitch');
    if (r) return r;
  }
  if (host === 'dailymotion.com' || host === 'dai.ly') {
    const r = iframe(dailymotion(host, parts), 'dailymotion');
    if (r) return r;
  }
  if (host === 'archive.org') {
    const r = iframe(archive(parts), 'archive');
    if (r) return r;
  }
  if (host === 'drive.google.com') {
    const r = iframe(drive(u, parts), 'drive');
    if (r) return r;
  }
  const file = videoFileKind(u);
  if (file) return { kind: 'video', src: u.href, hls: file === 'hls' };
  return { kind: 'iframe', src: u.href, provider: 'web' };
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * The referrer policy for a frame. No referrer at all where that's harmless; the big players check where they're
 * embedded (YouTube shows "error 153" without one), so they get just this site's origin.
 */
export function referrerFor(provider: EmbedProvider): ReferrerPolicy {
  return provider === 'web' || provider === 'archive' || provider === 'drive' ? 'no-referrer' : 'strict-origin-when-cross-origin';
}

/** Sandbox and permissions for embedded players and servers' web apps. */
export const FRAME_SANDBOX = 'allow-scripts allow-same-origin allow-popups allow-forms allow-presentation';
export const FRAME_ALLOW = 'autoplay; fullscreen; picture-in-picture; encrypted-media';

/**
 * Why the browser will refuse to load `url` from this page: an http:// server from an https:// page is "mixed
 * content" and is blocked (except localhost, which browsers trust).
 */
export function isMixedContent(url: string, pageProtocol: string): boolean {
  const u = httpUrl(url);
  if (!u || pageProtocol !== 'https:' || u.protocol !== 'http:') return false;
  return !/^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/i.test(u.hostname) && !u.hostname.endsWith('.localhost');
}

/** Is this a private-network address (a home server that other networks can't reach)? */
export function isPrivateHost(url: string): boolean {
  const h = httpUrl(url)?.hostname ?? '';
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(h) || h.endsWith('.local') || h === 'localhost';
}
