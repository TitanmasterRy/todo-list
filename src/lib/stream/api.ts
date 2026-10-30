// A typed client for the Play → Stream gateway (server/stream-gateway/API.md). The access token stays in memory and
// is refreshed when it's about to run out; the refresh token is handed to `onRefreshToken` to be kept with the
// app's other keys. Everything the gateway returns is checked before use. `fetch` is injectable for tests.

export type StreamTransport = 'webrtc' | 'ws' | 'http';

export interface Health {
  ok: boolean;
  mw: 'up' | 'down' | 'unlinked';
  host: 'online' | 'offline';
}

export interface Enrollment {
  otpauthUri: string;
  /** an SVG document, shown through an <img> (data: URL) so nothing in it can run */
  qrSvg: string;
  backupCodes: string[];
}

export interface StreamApp {
  id: number;
  name: string;
  /** gateway path of the box art, or null */
  art: string | null;
}

export interface IceServer {
  urls: string[];
  username: string;
  credential: string;
}

export interface StreamSession {
  id: string;
  transport: StreamTransport;
  signalingPath: string;
  /** WebSocket media path (ws), or the chunked /down path (http) */
  mediaPath: string;
  /** input POST path (http only) */
  upPath: string;
  ticket: string;
  iceServers: IceServer[];
  videoCodec: string;
  width: number;
  height: number;
  fps: number;
  bitrate: number;
}

export interface TurnCredentials {
  username: string;
  credential: string;
  ttl: number;
  urls: string[];
}

export interface SessionRequest {
  appId: number;
  width: number;
  height: number;
  fps: number;
  bitrate?: number;
  transport?: StreamTransport;
  quitRunning?: boolean;
}

export class StreamError extends Error {
  constructor(
    message: string,
    readonly kind: 'network' | 'auth' | 'locked' | 'http' | 'data',
    readonly status = 0,
    readonly code = '',
    readonly data: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'StreamError';
  }
}

export interface GatewayOptions {
  /** https origin of the gateway */
  server: string;
  refreshToken?: string;
  /** called with each new refresh token ('' when signed out) */
  onRefreshToken?: (token: string) => void;
  fetch?: typeof fetch;
  now?: () => number;
}

const str = (x: unknown, max = 200): string => (typeof x === 'string' ? x.slice(0, max) : '');
const int = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? Math.round(x) : 0);
const obj = (x: unknown): Record<string, unknown> => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {});
const PATH = /^\/[A-Za-z0-9/_-]{1,100}$/;

function iceList(x: unknown): IceServer[] {
  return (Array.isArray(x) ? x : [])
    .map(obj)
    .map((s) => ({
      urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u): u is string => typeof u === 'string' && /^turns?:[^\s]{1,200}$/.test(u)),
      username: str(s.username),
      credential: str(s.credential),
    }))
    .filter((s) => s.urls.length > 0);
}

/** The gateway's answer to POST /sessions as a checked object. */
export function toSession(x: unknown): StreamSession {
  const o = obj(x);
  const id = str(o.id);
  const transport: StreamTransport = o.transport === 'ws' ? 'ws' : o.transport === 'http' ? 'http' : 'webrtc';
  const signalingPath = str(o.signalingPath);
  const mediaPath = str(o.mediaPath);
  const upPath = str(o.upPath);
  const path = transport === 'webrtc' ? signalingPath : mediaPath;
  const paths = [path, ...(transport === 'http' ? [upPath] : [])];
  if (!/^[A-Za-z0-9_-]{16}$/.test(id) || !paths.every((p) => PATH.test(p)) || !str(o.ticket)) throw new StreamError('The stream server sent an unexpected answer.', 'data');
  return {
    id,
    transport,
    signalingPath: transport === 'webrtc' ? signalingPath : '',
    mediaPath: transport === 'webrtc' ? '' : mediaPath,
    upPath: transport === 'http' ? upPath : '',
    ticket: str(o.ticket, 100),
    iceServers: iceList(o.iceServers),
    videoCodec: str(o.videoCodec, 10) || 'h264',
    width: int(o.width),
    height: int(o.height),
    fps: int(o.fps),
    bitrate: int(o.bitrate),
  };
}

export class GatewayClient {
  readonly server: string;
  private refreshToken: string;
  private access = '';
  private accessUntil = 0;
  private refreshing: Promise<void> | null = null;
  private fetcher: typeof fetch;
  private now: () => number;

  constructor(private o: GatewayOptions) {
    this.server = o.server.replace(/\/+$/, '');
    this.refreshToken = o.refreshToken ?? '';
    this.fetcher = o.fetch ?? ((...a) => fetch(...a));
    this.now = o.now ?? Date.now;
  }

  get signedIn(): boolean {
    return !!this.refreshToken;
  }

  /** wss:// URL for a gateway path */
  wsUrl(path: string): string {
    return this.server.replace(/^http/, 'ws') + path;
  }

  private setTokens(x: unknown): void {
    const o = obj(x);
    const access = str(o.accessToken, 2048);
    const refresh = str(o.refreshToken, 200);
    if (!access || !refresh) throw new StreamError('The stream server sent an unexpected answer.', 'data');
    this.access = access;
    this.accessUntil = this.now() + Math.max(60, int(o.expiresIn) || 900) * 1000;
    this.refreshToken = refresh;
    this.o.onRefreshToken?.(refresh);
  }

  private forget(): void {
    this.access = '';
    this.accessUntil = 0;
    if (this.refreshToken) {
      this.refreshToken = '';
      this.o.onRefreshToken?.('');
    }
  }

  private async send(method: string, path: string, body?: unknown, token = ''): Promise<Response> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      return await this.fetcher(this.server + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'omit', cache: 'no-store' });
    } catch {
      throw new StreamError("Can't reach the stream server.", 'network');
    }
  }

  private async fail(r: Response): Promise<never> {
    const data = obj(await r.json().catch(() => ({})));
    const code = str(data.code, 40);
    const message = str(data.error, 200) || `The stream server answered ${r.status}.`;
    if (r.status === 429) throw new StreamError(message, 'locked', 429, code, data);
    if (r.status === 401) throw new StreamError(message, 'auth', 401, code, data);
    throw new StreamError(message, 'http', r.status, code, data);
  }

  private async token(): Promise<string> {
    if (this.access && this.accessUntil - this.now() > 30_000) return this.access;
    await this.refresh();
    return this.access;
  }

  /** An authenticated call; one retry after a refresh when the access token was refused. */
  private async authed(method: string, path: string, body?: unknown): Promise<Response> {
    let r = await this.send(method, path, body, await this.token());
    if (r.status === 401) {
      this.access = '';
      r = await this.send(method, path, body, await this.token());
    }
    if (!r.ok) await this.fail(r);
    return r;
  }

  async health(): Promise<Health> {
    const r = await this.send('GET', '/health');
    if (!r.ok) await this.fail(r);
    const o = obj(await r.json().catch(() => ({})));
    return { ok: o.ok === true, mw: o.mw === 'up' || o.mw === 'down' ? o.mw : 'unlinked', host: o.host === 'online' ? 'online' : 'offline' };
  }

  async login(password: string, totp: string): Promise<void> {
    const r = await this.send('POST', '/auth/login', { password, totp });
    if (!r.ok) await this.fail(r);
    this.setTokens(await r.json());
  }

  async enroll(password: string): Promise<Enrollment> {
    const r = await this.send('POST', '/auth/totp/enroll', { password });
    if (!r.ok) await this.fail(r);
    const o = obj(await r.json());
    const qrSvg = str(o.qrSvg, 200_000);
    const backupCodes = (Array.isArray(o.backupCodes) ? o.backupCodes : []).filter((c): c is string => typeof c === 'string' && /^[a-z2-7]{4}-[a-z2-7]{4}$/.test(c));
    if (!/^otpauth:\/\/totp\//.test(str(o.otpauthUri, 500)) || !qrSvg.startsWith('<svg')) throw new StreamError('The stream server sent an unexpected answer.', 'data');
    return { otpauthUri: str(o.otpauthUri, 500), qrSvg, backupCodes };
  }

  async refresh(): Promise<void> {
    if (!this.refreshToken) throw new StreamError('Sign in to stream.', 'auth', 401);
    this.refreshing ??= (async () => {
      try {
        const r = await this.send('POST', '/auth/refresh', { refreshToken: this.refreshToken });
        if (r.status === 401) {
          this.forget();
          throw new StreamError('Your stream sign-in ended. Sign in again.', 'auth', 401);
        }
        if (!r.ok) await this.fail(r);
        this.setTokens(await r.json());
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  async logout(): Promise<void> {
    try {
      if (this.refreshToken) await this.authed('POST', '/auth/logout');
    } finally {
      this.forget();
    }
  }

  async revokeAll(): Promise<void> {
    try {
      await this.authed('POST', '/auth/revoke-all');
    } finally {
      this.forget();
    }
  }

  async apps(): Promise<StreamApp[]> {
    const list = await (await this.authed('GET', '/apps')).json();
    return (Array.isArray(list) ? list : [])
      .map(obj)
      .map((a) => ({ id: int(a.id), name: str(a.name, 100), art: /^\/apps\/\d+\/art$/.test(str(a.art)) ? str(a.art) : null }))
      .filter((a) => a.id > 0 && a.name);
  }

  /** Box art as a Blob (the request needs the bearer token, so it can't be a plain <img src>). */
  async art(path: string): Promise<Blob> {
    if (!/^\/apps\/\d+\/art$/.test(path)) throw new StreamError('Bad art path', 'data');
    return (await this.authed('GET', path)).blob();
  }

  async turnCredentials(): Promise<TurnCredentials> {
    const o = obj(await (await this.authed('GET', '/turn-credentials')).json());
    const [ice] = iceList([o]);
    if (!ice) throw new StreamError('The stream server sent an unexpected answer.', 'data');
    return { username: ice.username, credential: ice.credential, urls: ice.urls, ttl: int(o.ttl) };
  }

  async startSession(req: SessionRequest): Promise<StreamSession> {
    return toSession(await (await this.authed('POST', '/sessions', req)).json());
  }

  /** HTTP transport: forward a batch of input messages (each already JSON) to the PC. */
  async sendInput(id: string, msgs: string[]): Promise<void> {
    await this.authed('POST', `/sessions/${encodeURIComponent(id)}/up`, { msgs });
  }

  async newTicket(id: string): Promise<{ ticket: string; iceServers: IceServer[] }> {
    const o = obj(await (await this.authed('POST', `/sessions/${encodeURIComponent(id)}/ticket`, {})).json());
    return { ticket: str(o.ticket, 100), iceServers: iceList(o.iceServers) };
  }

  /** End the stream; `quitApp` also closes the game on the PC. `keepalive` lets it finish while the page closes. */
  async endSession(id: string, quitApp = false, keepalive = false): Promise<void> {
    const token = await this.token();
    try {
      await this.fetcher(`${this.server}/sessions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quitApp }),
        keepalive,
        credentials: 'omit',
      });
    } catch {
      /* the gateway ends forgotten streams itself after 12 hours, and the next start offers to end it */
    }
  }
}
