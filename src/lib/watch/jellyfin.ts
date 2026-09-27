// A small Jellyfin / Emby API client for Play → Watch (both speak the same "MediaBrowser" API). Everything a server
// returns is treated as untrusted: items are copied field by field into plain objects with checked types and
// lengths, ids must look like ids, and the UI shows the text as text. `fetch` is injectable for tests.

export const CLIENT_NAME = 'Homework To-Do';
export const CLIENT_VERSION = '1.0';
const TICKS_PER_SECOND = 10_000_000;

export interface JfSubtitle {
  index: number;
  label: string;
  language: string;
  /** a text format the server can convert to WebVTT */
  text: boolean;
  isDefault: boolean;
}

export interface JfMediaSource {
  id: string;
  container: string;
  videoCodec: string;
  audioCodec: string;
  subtitles: JfSubtitle[];
}

export interface JfItem {
  id: string;
  name: string;
  /** Movie, Series, Season, Episode, Video, Folder, CollectionFolder, BoxSet, MusicVideo, … */
  type: string;
  overview: string;
  collectionType: string;
  seriesName: string;
  seriesId: string;
  seasonId: string;
  indexNumber: number | null;
  parentIndexNumber: number | null;
  productionYear: number | null;
  runTimeSeconds: number;
  positionSeconds: number;
  played: boolean;
  hasPrimaryImage: boolean;
  primaryImageTag: string;
  mediaSources: JfMediaSource[];
}

export interface JfAuth {
  token: string;
  userId: string;
  userName: string;
  serverId: string;
}

export interface PlaybackReport {
  itemId: string;
  mediaSourceId: string;
  playSessionId: string;
  positionSeconds: number;
  isPaused?: boolean;
  method: 'DirectPlay' | 'Transcode';
}

export class JellyfinError extends Error {
  constructor(
    message: string,
    readonly kind: 'network' | 'auth' | 'http' | 'data',
    readonly status = 0,
  ) {
    super(message);
    this.name = 'JellyfinError';
  }
}

export interface JellyfinOptions {
  /** server address, e.g. https://jellyfin.example.com (a sub-path is fine) */
  server: string;
  deviceId: string;
  token?: string;
  userId?: string;
  fetch?: typeof fetch;
}

// ---------- parsing untrusted JSON ----------
const ID = /^[A-Za-z0-9-]{1,64}$/;
const str = (x: unknown, max = 200): string => (typeof x === 'string' ? x.slice(0, max) : '');
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const id = (x: unknown): string => (typeof x === 'string' && ID.test(x) ? x : '');
const TEXT_SUBS = new Set(['srt', 'subrip', 'ass', 'ssa', 'vtt', 'webvtt', 'mov_text', 'ttml', 'text', 'smi', 'sami']);

function toSource(x: unknown): JfMediaSource | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const sid = id(o.Id);
  if (!sid) return null;
  const streams = Array.isArray(o.MediaStreams) ? (o.MediaStreams as Record<string, unknown>[]) : [];
  const video = streams.find((s) => s && s.Type === 'Video');
  const audio = streams.find((s) => s && s.Type === 'Audio' && s.IsDefault) ?? streams.find((s) => s && s.Type === 'Audio');
  const subtitles: JfSubtitle[] = [];
  for (const s of streams) {
    if (!s || s.Type !== 'Subtitle') continue;
    const index = num(s.Index);
    if (index === null || index < 0) continue;
    const codec = str(s.Codec, 20).toLowerCase();
    subtitles.push({
      index,
      label: str(s.DisplayTitle, 80) || str(s.Title, 80) || str(s.Language, 20) || `Subtitles ${index}`,
      language: str(s.Language, 20).replace(/[^\w-]/g, ''),
      text: s.IsTextSubtitleStream === true || TEXT_SUBS.has(codec),
      isDefault: s.IsDefault === true,
    });
  }
  return {
    id: sid,
    container: str(o.Container, 40).toLowerCase(),
    videoCodec: str(video?.Codec, 20).toLowerCase(),
    audioCodec: str(audio?.Codec, 20).toLowerCase(),
    subtitles,
  };
}

/** A server item as a plain, checked object; null when it has no usable id. */
export function toItem(x: unknown): JfItem | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const itemId = id(o.Id);
  if (!itemId) return null;
  const user = (o.UserData && typeof o.UserData === 'object' ? o.UserData : {}) as Record<string, unknown>;
  const tags = (o.ImageTags && typeof o.ImageTags === 'object' ? o.ImageTags : {}) as Record<string, unknown>;
  const tag = str(tags.Primary, 64);
  return {
    id: itemId,
    name: str(o.Name, 200) || 'Untitled',
    type: str(o.Type, 40),
    overview: str(o.Overview, 2000),
    collectionType: str(o.CollectionType, 40),
    seriesName: str(o.SeriesName, 200),
    seriesId: id(o.SeriesId),
    seasonId: id(o.SeasonId),
    indexNumber: num(o.IndexNumber),
    parentIndexNumber: num(o.ParentIndexNumber),
    productionYear: num(o.ProductionYear),
    runTimeSeconds: (num(o.RunTimeTicks) ?? 0) / TICKS_PER_SECOND,
    positionSeconds: (num(user.PlaybackPositionTicks) ?? 0) / TICKS_PER_SECOND,
    played: user.Played === true,
    hasPrimaryImage: /^[\w-]+$/.test(tag),
    primaryImageTag: /^[\w-]+$/.test(tag) ? tag : '',
    mediaSources: (Array.isArray(o.MediaSources) ? o.MediaSources : []).map(toSource).filter((s): s is JfMediaSource => !!s),
  };
}

function toItems(x: unknown): { items: JfItem[]; total: number } {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const list = Array.isArray(x) ? x : Array.isArray(o.Items) ? o.Items : [];
  const items = list.map(toItem).filter((i): i is JfItem => !!i);
  return { items, total: num(o.TotalRecordCount) ?? items.length };
}

/** Types the player can open directly (the rest are folders to browse into). */
export function isPlayable(item: Pick<JfItem, 'type'>): boolean {
  return ['Movie', 'Episode', 'Video', 'MusicVideo', 'Trailer', 'TvChannel', 'Recording'].includes(item.type);
}

/**
 * Can this browser play the file as it is ("direct play"), or does the server need to convert it to HLS?
 * `canPlay` is `video.canPlayType`.
 */
export function chooseMethod(source: Pick<JfMediaSource, 'container' | 'videoCodec' | 'audioCodec'>, canPlay: (mime: string) => string): 'direct' | 'hls' {
  const containers = source.container.split(',').map((c) => c.trim());
  const mime = containers.includes('webm') ? 'video/webm' : containers.some((c) => ['mp4', 'm4v', 'mov'].includes(c)) ? 'video/mp4' : '';
  if (!mime) return 'hls'; // mkv, avi, ts, wmv…: browsers can't be trusted with them
  const video: Record<string, string> = { h264: 'avc1.42E01E', vp8: 'vp8', vp9: 'vp9', av1: 'av01.0.05M.08', hevc: 'hvc1.1.6.L93.B0', h265: 'hvc1.1.6.L93.B0' };
  const audio: Record<string, string> = { aac: 'mp4a.40.2', mp3: 'mp3', opus: 'opus', vorbis: 'vorbis', flac: 'flac' };
  const v = source.videoCodec ? video[source.videoCodec] : undefined;
  const a = source.audioCodec ? audio[source.audioCodec] : undefined;
  if ((source.videoCodec && !v) || (source.audioCodec && !a)) return 'hls';
  const codecs = [v, a].filter(Boolean).join(', ');
  return canPlay(codecs ? `${mime}; codecs="${codecs}"` : mime) ? 'direct' : 'hls';
}

export const ticks = (seconds: number): number => Math.max(0, Math.round(seconds * TICKS_PER_SECOND));

const quote = (s: string) => s.replace(/["\\\r\n,]/g, '');

export class JellyfinClient {
  readonly server: string;
  readonly deviceId: string;
  token: string;
  userId: string;
  private readonly fetcher: typeof fetch;

  constructor(o: JellyfinOptions) {
    this.server = o.server.replace(/\/+$/, '');
    this.deviceId = o.deviceId;
    this.token = o.token ?? '';
    this.userId = o.userId ?? '';
    this.fetcher = o.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  }

  /** The MediaBrowser authorization value (Jellyfin reads `Authorization`, Emby `X-Emby-Authorization`). */
  authorization(): string {
    const parts = [`MediaBrowser Client="${quote(CLIENT_NAME)}"`, `Device="Browser"`, `DeviceId="${quote(this.deviceId)}"`, `Version="${CLIENT_VERSION}"`];
    if (this.token) parts.push(`Token="${quote(this.token)}"`);
    return parts.join(', ');
  }

  private url(path: string, query: Record<string, string | number | boolean | undefined> = {}): string {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') q.set(k, String(v));
    const qs = q.toString();
    return `${this.server}${path}${qs ? `?${qs}` : ''}`;
  }

  private async request(method: 'GET' | 'POST', path: string, query: Record<string, string | number | boolean | undefined> = {}, body?: unknown): Promise<unknown> {
    const auth = this.authorization();
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Emby-Authorization': auth, Authorization: auth };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let res: Response;
    try {
      res = await this.fetcher(this.url(path, query), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
    } catch (e) {
      throw new JellyfinError(`Couldn't reach ${this.server} (${e instanceof Error ? e.message : String(e)}).`, 'network');
    }
    if (res.status === 401 || res.status === 403)
      throw new JellyfinError(this.token ? 'The server signed you out. Sign in again.' : 'Wrong username or password.', 'auth', res.status);
    if (!res.ok) throw new JellyfinError(`The server answered ${res.status}${res.statusText ? ` ${res.statusText}` : ''}.`, 'http', res.status);
    if (res.status === 204) return null;
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new JellyfinError("The server's answer wasn't JSON. Is this the right address?", 'data', res.status);
    }
  }

  private needUser(): string {
    if (!this.userId || !this.token) throw new JellyfinError('Sign in first.', 'auth');
    return encodeURIComponent(this.userId);
  }

  /** Server name and version (no sign-in needed): a quick "is this a Jellyfin/Emby server?" check. */
  async publicInfo(): Promise<{ serverName: string; version: string; product: string }> {
    const o = ((await this.request('GET', '/System/Info/Public')) ?? {}) as Record<string, unknown>;
    return { serverName: str(o.ServerName, 80), version: str(o.Version, 30), product: str(o.ProductName, 40) };
  }

  /** Sign in with a username and password. Keeps the token and user id on the client. */
  async authenticate(username: string, password: string): Promise<JfAuth> {
    this.token = '';
    const o = ((await this.request('POST', '/Users/AuthenticateByName', {}, { Username: username, Pw: password })) ?? {}) as Record<string, unknown>;
    const user = (o.User && typeof o.User === 'object' ? o.User : {}) as Record<string, unknown>;
    const token = typeof o.AccessToken === 'string' && /^[\w-]{8,200}$/.test(o.AccessToken) ? o.AccessToken : '';
    const userId = id(user.Id);
    if (!token || !userId) throw new JellyfinError("The server didn't return a sign-in token.", 'data');
    this.token = token;
    this.userId = userId;
    return { token, userId, userName: str(user.Name, 80) || username, serverId: str(o.ServerId, 64) };
  }

  /** Sign this device out on the server (the token stops working). */
  async logout(): Promise<void> {
    if (!this.token) return;
    try {
      await this.request('POST', '/Sessions/Logout');
    } finally {
      this.token = '';
    }
  }

  /** The user's libraries (Movies, Shows, …). */
  async views(): Promise<JfItem[]> {
    return toItems(await this.request('GET', `/Users/${this.needUser()}/Views`)).items;
  }

  async items(
    q: { parentId?: string; search?: string; types?: string[]; recursive?: boolean; start?: number; limit?: number; sortBy?: string; sortOrder?: 'Ascending' | 'Descending' } = {},
  ) {
    return toItems(
      await this.request('GET', `/Users/${this.needUser()}/Items`, {
        ParentId: q.parentId && ID.test(q.parentId) ? q.parentId : undefined,
        SearchTerm: q.search?.trim().slice(0, 100) || undefined,
        IncludeItemTypes: q.types?.join(','),
        Recursive: q.recursive,
        StartIndex: q.start,
        Limit: q.limit ?? 60,
        SortBy: q.sortBy ?? (q.search ? undefined : 'SortName'),
        SortOrder: q.sortOrder ?? (q.search ? undefined : 'Ascending'),
        Fields: 'Overview,PrimaryImageAspectRatio',
        ImageTypeLimit: 1,
        EnableImageTypes: 'Primary',
      }),
    );
  }

  /** "Continue watching". */
  async resume(limit = 12): Promise<JfItem[]> {
    return toItems(
      await this.request('GET', `/Users/${this.needUser()}/Items/Resume`, {
        Limit: limit,
        MediaTypes: 'Video',
        Fields: 'Overview',
        EnableImageTypes: 'Primary',
        ImageTypeLimit: 1,
      }),
    ).items;
  }

  /** "Next up" episodes of shows in progress. */
  async nextUp(limit = 12): Promise<JfItem[]> {
    this.needUser();
    return toItems(await this.request('GET', '/Shows/NextUp', { userId: this.userId, Limit: limit, Fields: 'Overview', EnableImageTypes: 'Primary', ImageTypeLimit: 1 })).items;
  }

  async seasons(seriesId: string): Promise<JfItem[]> {
    this.needUser();
    return toItems(await this.request('GET', `/Shows/${encodeURIComponent(id(seriesId))}/Seasons`, { userId: this.userId })).items;
  }

  async episodes(seriesId: string, seasonId?: string): Promise<JfItem[]> {
    this.needUser();
    return toItems(
      await this.request('GET', `/Shows/${encodeURIComponent(id(seriesId))}/Episodes`, { userId: this.userId, seasonId: seasonId ? id(seasonId) : undefined, Fields: 'Overview' }),
    ).items;
  }

  /** One item with its media sources (files, codecs, subtitle streams). */
  async item(itemId: string): Promise<JfItem> {
    const it = toItem(await this.request('GET', `/Users/${this.needUser()}/Items/${encodeURIComponent(id(itemId))}`));
    if (!it) throw new JellyfinError("The server didn't return that item.", 'data');
    return it;
  }

  // ---------- URLs for <img>, <video> and <track> (they can't send headers, so the token goes in the query) ----------
  /** `api_key` for Emby and older Jellyfin, `ApiKey` for Jellyfin with legacy authorization turned off. */
  private keyQuery(): Record<string, string> {
    return { api_key: this.token, ApiKey: this.token };
  }

  imageUrl(item: Pick<JfItem, 'id' | 'primaryImageTag'>, maxHeight = 300): string {
    return this.url(`/Items/${encodeURIComponent(item.id)}/Images/Primary`, { maxHeight, quality: 90, tag: item.primaryImageTag || undefined });
  }

  /** The file as it is, for browsers that can play it. */
  directUrl(itemId: string, mediaSourceId: string, playSessionId: string): string {
    return this.url(`/Videos/${encodeURIComponent(id(itemId))}/stream`, {
      static: true,
      MediaSourceId: id(mediaSourceId),
      DeviceId: this.deviceId,
      PlaySessionId: playSessionId,
      ...this.keyQuery(),
    });
  }

  /** HLS converted by the server to H.264 + AAC, which every browser (with hls.js) can play. */
  hlsUrl(itemId: string, mediaSourceId: string, playSessionId: string): string {
    return this.url(`/Videos/${encodeURIComponent(id(itemId))}/master.m3u8`, {
      ...this.keyQuery(),
      MediaSourceId: id(mediaSourceId),
      VideoCodec: 'h264',
      AudioCodec: 'aac',
      DeviceId: this.deviceId,
      PlaySessionId: playSessionId,
      TranscodingMaxAudioChannels: 2,
      SegmentContainer: 'ts',
      MaxStreamingBitrate: 20_000_000,
    });
  }

  subtitleUrl(itemId: string, mediaSourceId: string, index: number): string {
    return this.url(`/Videos/${encodeURIComponent(id(itemId))}/${encodeURIComponent(id(mediaSourceId))}/Subtitles/${Math.max(0, Math.floor(index))}/Stream.vtt`, this.keyQuery());
  }

  /** The server's own web app (for the "open the server's web app" frame). */
  webAppUrl(): string {
    return `${this.server}/web/`;
  }

  // ---------- playback reporting (resume points and "Continue watching" on every device) ----------
  private report(path: string, r: PlaybackReport): Promise<unknown> {
    return this.request(
      'POST',
      path,
      {},
      {
        ItemId: id(r.itemId),
        MediaSourceId: id(r.mediaSourceId),
        PlaySessionId: r.playSessionId,
        PositionTicks: ticks(r.positionSeconds),
        IsPaused: !!r.isPaused,
        CanSeek: true,
        PlayMethod: r.method,
      },
    );
  }

  reportStart(r: PlaybackReport): Promise<unknown> {
    return this.report('/Sessions/Playing', r);
  }

  reportProgress(r: PlaybackReport): Promise<unknown> {
    return this.report('/Sessions/Playing/Progress', r);
  }

  reportStopped(r: PlaybackReport): Promise<unknown> {
    return this.report('/Sessions/Playing/Stopped', r);
  }
}
