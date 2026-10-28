// The gateway's HTTP and WebSocket surface (contract in API.md). One owner, one stream at a time.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import { timingSafeEqual } from 'node:crypto';
import { argon2Verify } from 'hash-wasm';
import QRCode from 'qrcode';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Config } from './config.js';
import { MwError, mwPath, type MwApi } from './mw.js';
import { LoginLimiter, clientIp } from './ratelimit.js';
import { SignalRelay } from './relay.js';
import type { Store } from './store.js';
import { ACCESS_TTL, REFRESH_TTL, SESSION_CAP, bearer, randomToken, sha256, signAccess, verifyAccess, type AccessClaims } from './tokens.js';
import { newBackupCodes, newSecret, normalizeBackupCode, otpauthUri, verifyTotp } from './totp.js';
import { iceServers, turnCredentials } from './turn.js';

export interface GatewayDeps {
  config: Config;
  /** names of settings that are missing or invalid */
  missing?: string[];
  store: Store;
  mw: MwApi | null;
  /** ms */
  now?: () => number;
  log?: (line: string) => void;
}

interface StreamSession {
  id: string;
  host: string;
  transport: 'webrtc' | 'ws';
  mwPath: string;
  createdAt: number;
  /** one-time WebSocket tickets → expiry (ms) */
  tickets: Map<string, number>;
  sockets: Map<'signal' | 'media', WebSocket>;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: Record<string, unknown>,
  ) {
    super(String(body.error ?? status));
  }
}

const TICKET_MS = 60_000;
const STREAM_MAX_MS = 12 * 60 * 60_000;
const MAX_BODY = 16 * 1024;
const ID = /^[A-Za-z0-9_-]{16}$/;

const int = (x: unknown, lo: number, hi: number, fallback?: number): number => {
  const n = typeof x === 'number' && Number.isFinite(x) ? Math.round(x) : NaN;
  if (Number.isNaN(n)) {
    if (fallback !== undefined) return fallback;
    throw new HttpError(400, { error: 'bad_request' });
  }
  return Math.min(hi, Math.max(lo, n));
};

/** A bitrate (kbps) for a size and rate: about 20 Mbps for 1080p60, scaled by pixels per second. */
export function suggestBitrate(width: number, height: number, fps: number): number {
  const k = Math.round(((width * height * fps) / (1920 * 1080 * 60)) * 20_000);
  return Math.min(80_000, Math.max(5_000, k));
}

export function createGateway(deps: GatewayDeps): { server: Server; close: () => void } {
  const { config, store, mw } = deps;
  const missing = deps.missing ?? [];
  const now = deps.now ?? Date.now;
  const nowSec = () => Math.floor(now() / 1000);
  const log = deps.log ?? ((line: string) => console.log(line));
  const limiter = new LoginLimiter();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024, perMessageDeflate: false });
  let active: StreamSession | null = null;
  let hostCache: { id: string; at: number; link: string } | null = null;
  let healthCache: { body: Record<string, unknown>; at: number; link: string } | null = null;
  // a new link-mw (from the CLI) makes the cached answers stale
  const link = () => store.state.mw?.linkedAt ?? '';

  // ---------- helpers ----------
  function send(res: ServerResponse, status: number, body?: unknown): void {
    res.statusCode = status;
    if (body === undefined) return void res.end();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  }

  /** Same-origin rules: no Origin (curl, the healthcheck) is fine; any Origin but the site's is refused. */
  function originOk(origin: string | undefined): boolean {
    return origin === undefined || origin === config.allowedOrigin;
  }

  async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const c of req) {
      size += (c as Buffer).length;
      if (size > MAX_BODY) throw new HttpError(413, { error: 'too_large' });
      chunks.push(c as Buffer);
    }
    if (!size) return {};
    if (!/^application\/json\b/i.test(req.headers['content-type'] ?? '')) throw new HttpError(415, { error: 'json_only' });
    try {
      const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    } catch {
      /* falls through */
    }
    throw new HttpError(400, { error: 'bad_json' });
  }

  function claims(req: IncomingMessage): AccessClaims {
    if (!config.signingKey) throw new HttpError(503, { error: 'not_configured' });
    const c = verifyAccess(config.signingKey, bearer(req.headers.authorization), nowSec());
    const s = store.state;
    if (!c || c.gen !== s.generation || !(s.families[c.fam] > nowSec())) throw new HttpError(401, { error: 'unauthorized' });
    return c;
  }

  function linkedMw(): MwApi {
    if (!mw) throw new HttpError(503, { error: 'not_configured' });
    if (!store.state.mw) throw new HttpError(503, { error: 'unlinked' });
    return mw;
  }

  async function host(): Promise<string> {
    if (config.mwHostId) return config.mwHostId;
    if (hostCache && hostCache.link === link() && now() - hostCache.at < 5 * 60_000) return hostCache.id;
    const hosts = await linkedMw().hosts();
    const h = hosts.find((x) => x.pairState === 'paired') ?? hosts[0];
    if (!h) throw new HttpError(503, { error: 'no_host' });
    hostCache = { id: h.uuid, at: now(), link: link() };
    return h.uuid;
  }

  function issue(fam: string): Record<string, unknown> {
    const s = store.state;
    const refreshToken = randomToken();
    s.refresh[sha256(refreshToken)] = { fam, exp: Math.min(nowSec() + REFRESH_TTL, s.families[fam]), used: false };
    store.prune(nowSec());
    store.save();
    return { accessToken: signAccess(config.signingKey!, fam, s.generation, nowSec()), refreshToken, expiresIn: ACCESS_TTL };
  }

  async function passwordOk(password: unknown): Promise<boolean> {
    if (typeof password !== 'string' || !password || password.length > 1024) return false;
    try {
      return await argon2Verify({ password, hash: config.passwordHash });
    } catch {
      return false;
    }
  }

  function throttle(req: IncomingMessage): string {
    if (!config.passwordHash || !config.signingKey) throw new HttpError(503, { error: 'not_configured' });
    const ip = clientIp(req.headers['x-forwarded-for'], req.socket.remoteAddress);
    const wait = limiter.wait(ip, now());
    if (wait > 0) throw new HttpError(429, { error: 'locked', retryAfter: Math.ceil(wait / 1000) });
    return ip;
  }

  function secondFactorOk(code: unknown): boolean {
    const t = store.state.totp;
    if (!t || typeof code !== 'string') return false;
    const c = code.replace(/\s/g, '');
    if (/^\d{6}$/.test(c)) {
      const counter = verifyTotp(t.secret, c, nowSec(), t.lastCounter);
      if (counter === null) return false;
      t.lastCounter = counter;
      return true;
    }
    const backup = normalizeBackupCode(c);
    if (!backup) return false;
    const h = Buffer.from(sha256(backup));
    const i = t.backupCodes.findIndex((x) => x.length === h.length && timingSafeEqual(Buffer.from(x), h));
    if (i < 0) return false;
    t.backupCodes.splice(i, 1);
    return true;
  }

  function endActive(quitApp: boolean, alsoStopSession = false): StreamSession | null {
    const s = active;
    if (!s) return null;
    active = null;
    for (const ws of s.sockets.values()) ws.close(1000, 'stream ended');
    if (mw && store.state.mw) {
      void (async () => {
        try {
          await mw.quit(s.host, store.state.clientUniqueId, quitApp);
        } catch (e) {
          log(`quit failed: ${(e as Error).message}`);
        }
        if (alsoStopSession) {
          try {
            await mw.stopSession(s.host);
          } catch (e) {
            log(`stop-session failed: ${(e as Error).message}`);
          }
        }
      })();
    }
    return s;
  }

  function newTicket(s: StreamSession): string {
    const t = randomToken();
    for (const [k, exp] of s.tickets) if (exp <= now()) s.tickets.delete(k);
    s.tickets.set(t, now() + TICKET_MS);
    return t;
  }

  function freshIce(): unknown[] {
    return iceServers(turnCredentials(config.turnSecret, config.turnHost, nowSec()));
  }

  // ---------- routes ----------
  async function route(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
    const m = req.method ?? 'GET';

    if (m === 'GET' && path === '/health') {
      if (!healthCache || healthCache.link !== link() || now() - healthCache.at > 5_000) {
        let mwState = 'unlinked';
        let hostState = 'offline';
        if (mw && store.state.mw) {
          mwState = (await mw.health()) ? 'up' : 'down';
          if (mwState === 'up') {
            try {
              const id = await host();
              const h = (await mw.hosts()).find((x) => x.uuid === id);
              hostState = h?.state === 'online' ? 'online' : 'offline';
            } catch (e) {
              if (e instanceof MwError && e.status === 401) mwState = 'unlinked';
            }
          }
        }
        healthCache = { body: { ok: missing.length === 0, mw: mwState, host: hostState }, at: now(), link: link() };
      }
      return send(res, 200, healthCache.body);
    }

    if (m === 'POST' && path === '/auth/login') {
      const ip = throttle(req);
      const body = await readJson(req);
      if (!(await passwordOk(body.password))) {
        limiter.fail(ip, now());
        throw new HttpError(401, { error: 'invalid_credentials' });
      }
      if (!store.state.totp) throw new HttpError(409, { code: 'enroll_required', error: 'Set up two-factor sign-in first' });
      if (!secondFactorOk(body.totp)) {
        limiter.fail(ip, now());
        store.save();
        throw new HttpError(401, { error: 'invalid_credentials' });
      }
      limiter.succeed(ip);
      const fam = randomToken(12);
      store.state.families[fam] = nowSec() + SESSION_CAP;
      return send(res, 200, issue(fam));
    }

    if (m === 'POST' && path === '/auth/totp/enroll') {
      if (store.state.totp) throw new HttpError(410, { code: 'already_enrolled', error: 'Two-factor sign-in is already set up' });
      const ip = throttle(req);
      const body = await readJson(req);
      if (!(await passwordOk(body.password))) {
        limiter.fail(ip, now());
        throw new HttpError(401, { error: 'invalid_credentials' });
      }
      if (store.state.totp) throw new HttpError(410, { code: 'already_enrolled', error: 'Two-factor sign-in is already set up' });
      const secret = newSecret();
      const backupCodes = newBackupCodes();
      store.state.totp = { secret, lastCounter: -1, backupCodes: backupCodes.map(sha256), enrolledAt: new Date(now()).toISOString() };
      store.save();
      const uri = otpauthUri(secret);
      const qrSvg = await QRCode.toString(uri, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
      return send(res, 200, { otpauthUri: uri, qrSvg, backupCodes });
    }

    if (m === 'POST' && path === '/auth/refresh') {
      if (!config.signingKey) throw new HttpError(503, { error: 'not_configured' });
      const body = await readJson(req);
      const token = typeof body.refreshToken === 'string' ? body.refreshToken : '';
      const s = store.state;
      const h = sha256(token);
      const entry = token ? s.refresh[h] : undefined;
      if (!entry || entry.exp <= nowSec() || !(s.families[entry.fam] > nowSec())) throw new HttpError(401, { error: 'unauthorized' });
      if (entry.used) {
        // a rotated token came back: someone else has a copy, so this whole sign-in ends
        store.endFamily(entry.fam);
        store.save();
        log('a used refresh token was presented again; that sign-in was ended');
        throw new HttpError(401, { error: 'unauthorized' });
      }
      entry.used = true;
      return send(res, 200, issue(entry.fam));
    }

    if (m === 'POST' && path === '/auth/logout') {
      const c = claims(req);
      store.endFamily(c.fam);
      store.save();
      return send(res, 204);
    }

    if (m === 'POST' && path === '/auth/revoke-all') {
      claims(req);
      const s = store.state;
      s.generation += 1;
      s.families = {};
      s.refresh = {};
      store.save();
      const ended = endActive(false, true);
      if (!ended && mw && s.mw) {
        // a stream the gateway lost track of (restart) still gets stopped
        try {
          await mw.stopSession(await host());
        } catch (e) {
          log(`stop-session failed: ${(e as Error).message}`);
        }
      }
      return send(res, 200, { ok: true, streamEnded: !!ended });
    }

    if (m === 'GET' && path === '/turn-credentials') {
      claims(req);
      if (!config.turnSecret) throw new HttpError(503, { error: 'not_configured' });
      return send(res, 200, turnCredentials(config.turnSecret, config.turnHost, nowSec()));
    }

    if (m === 'GET' && path === '/apps') {
      claims(req);
      const api = linkedMw();
      const apps = await api.apps(await host(), store.state.clientUniqueId);
      return send(
        res,
        200,
        apps.map((a) => ({ id: a.id, name: a.name, art: a.boxArt ? `/apps/${a.id}/art` : null })),
      );
    }

    const art = /^\/apps\/(\d{1,9})\/art$/.exec(path);
    if (m === 'GET' && art) {
      claims(req);
      const png = await linkedMw().art(await host(), Number(art[1]));
      const type = png[0] === 0xff && png[1] === 0xd8 ? 'image/jpeg' : png.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : 'image/png';
      res.setHeader('Content-Type', type);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.statusCode = 200;
      return void res.end(png);
    }

    if (m === 'POST' && path === '/sessions') {
      claims(req);
      const api = linkedMw();
      if (!config.turnSecret) throw new HttpError(503, { error: 'not_configured' });
      const body = await readJson(req);
      if (active && now() - active.createdAt < STREAM_MAX_MS) throw new HttpError(409, { code: 'stream_active', id: active.id, error: 'A stream is already running' });
      if (active) endActive(false);
      const appId = int(body.appId, 1, 2 ** 31 - 1);
      const width = int(body.width, 320, 4096) & ~1;
      const height = int(body.height, 240, 2304) & ~1;
      const fps = int(body.fps, 24, 240);
      const bitrate = int(body.bitrate, 1_000, 150_000, suggestBitrate(width, height, fps));
      const transport = body.transport === 'ws' ? 'ws' : 'webrtc';
      const h = await host();
      if (body.quitRunning === true) await api.stopSession(h);
      let r: Record<string, unknown>;
      try {
        r = await api.start(h, {
          appId,
          stream_height: height,
          stream_aspect: `${width}:${height}`,
          stream_fps: fps,
          stream_bitrate: bitrate,
          video_codec: 'h264',
          transport_mode: transport === 'ws' ? 'wss' : 'webrtc-media-udp',
          transport_index: 0,
          client_uniqueid: store.state.clientUniqueId,
        });
      } catch (e) {
        if (e instanceof MwError && e.status === 409 && e.data.code === 'app_running') {
          throw new HttpError(409, { code: 'app_running', runningAppId: typeof e.data.runningAppId === 'number' ? e.data.runningAppId : 0, error: 'Another app is running' });
        }
        if (e instanceof MwError && e.status === 503) throw new HttpError(503, { code: 'host_busy', error: e.message });
        throw new HttpError(502, { code: 'start_failed', error: e instanceof MwError ? e.message : 'MoonlightWeb could not start the stream' });
      }
      const ws = transport === 'ws';
      const path2 = mwPath(ws ? r.wsUrl : r.signalingUrl);
      if (!path2 || (ws && r.transport !== 'wss')) throw new HttpError(502, { code: 'start_failed', error: 'MoonlightWeb started another transport' });
      const s: StreamSession = { id: randomToken(12), host: h, transport, mwPath: path2, createdAt: now(), tickets: new Map(), sockets: new Map() };
      active = s;
      return send(res, 201, {
        id: s.id,
        transport,
        ...(ws ? { mediaPath: `/sessions/${s.id}/media` } : { signalingPath: `/sessions/${s.id}/signal` }),
        ticket: newTicket(s),
        iceServers: freshIce(),
        videoCodec: typeof r.videoCodec === 'string' ? r.videoCodec : 'h264',
        width,
        height,
        fps,
        bitrate,
      });
    }

    const sess = /^\/sessions\/([A-Za-z0-9_-]{16})(\/ticket)?$/.exec(path);
    if (sess && ((m === 'DELETE' && !sess[2]) || (m === 'POST' && sess[2]))) {
      claims(req);
      const body = await readJson(req);
      if (!active || active.id !== sess[1]) throw new HttpError(404, { error: 'not_found' });
      if (m === 'POST') return send(res, 200, { ticket: newTicket(active), iceServers: freshIce() });
      endActive(body.quitApp === true);
      return send(res, 204);
    }

    throw new HttpError(404, { error: 'not_found' });
  }

  const server = createServer(async (req, res) => {
    const started = now();
    const path = (req.url ?? '/').split('?')[0];
    // method, path and status only: no headers, bodies or tokens
    res.once('finish', () => log(`${req.method} ${path.replace(/\/sessions\/[^/]+/, '/sessions/:id')} ${res.statusCode} ${now() - started}ms`));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    try {
      const origin = req.headers.origin;
      if (!originOk(origin)) throw new HttpError(403, { error: 'origin_not_allowed' });
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', config.allowedOrigin);
        res.setHeader('Vary', 'Origin');
      }
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.setHeader('Access-Control-Max-Age', '600');
        send(res, 204);
      } else await route(req, res, path);
    } catch (e) {
      if (e instanceof HttpError) {
        if (e.status === 429) res.setHeader('Retry-After', String(e.body.retryAfter ?? 60));
        send(res, e.status, e.body);
      } else if (e instanceof MwError) {
        log(`MoonlightWeb error: ${e.message}`);
        send(res, e.status === 401 ? 503 : 502, { code: e.status === 401 ? 'unlinked' : 'mw_error', error: 'MoonlightWeb did not answer as expected' });
      } else {
        log(`error: ${(e as Error).message}`);
        send(res, 500, { error: 'internal' });
      }
    }
  });

  // ---------- WebSockets ----------
  function refuse(socket: Duplex, status: number, text: string): void {
    socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  }

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const path = (req.url ?? '').split('?')[0];
    if (req.headers.origin !== config.allowedOrigin) return refuse(socket, 403, 'Forbidden');
    if (path === '/ws-probe') return wss.handleUpgrade(req, socket, head, probe);
    const m = /^\/sessions\/([A-Za-z0-9_-]{16})\/(signal|media)$/.exec(path);
    if (!m || !active || active.id !== m[1] || !ID.test(m[1])) return refuse(socket, 404, 'Not Found');
    const kind = m[2] as 'signal' | 'media';
    if ((kind === 'signal') !== (active.transport === 'webrtc')) return refuse(socket, 404, 'Not Found');
    const s = active;
    wss.handleUpgrade(req, socket, head, (ws) => {
      log(`ws ${kind} open`);
      const timer = setTimeout(() => ws.close(4001, 'no auth'), 5_000);
      ws.once('message', (data, isBinary) => {
        clearTimeout(timer);
        let ticket = '';
        try {
          const msg = isBinary ? null : JSON.parse(data.toString());
          if (msg?.type === 'auth' && typeof msg.ticket === 'string') ticket = msg.ticket;
        } catch {
          /* ticket stays empty */
        }
        const exp = s.tickets.get(ticket);
        if (!ticket || !exp || exp <= now() || active !== s) return ws.close(4001, 'bad ticket');
        s.tickets.delete(ticket);
        s.sockets.get(kind)?.close(1000, 'replaced');
        s.sockets.set(kind, ws);
        ws.on('close', () => {
          if (s.sockets.get(kind) === ws) s.sockets.delete(kind);
        });
        void (kind === 'signal' ? signal(ws, s) : media(ws, s)).catch((e: Error) => {
          log(`ws ${kind}: ${e.message}`);
          if (ws.readyState === ws.OPEN) ws.close(1011, 'MoonlightWeb is not reachable');
        });
      });
    });
  });

  function probe(ws: WebSocket): void {
    const timer = setTimeout(() => ws.close(1000), 5_000);
    ws.once('message', (data, isBinary) => {
      clearTimeout(timer);
      ws.send(data, { binary: isBinary }, () => ws.close(1000));
    });
  }

  function pair(browser: WebSocket, upstream: WebSocket): void {
    browser.on('close', () => upstream.close(1000));
    upstream.on('close', (code, reason) => {
      if (browser.readyState === browser.OPEN) browser.close(code === 1008 ? 1008 : 1000, code === 1008 ? reason.toString().slice(0, 100) : 'stream ended');
    });
    upstream.on('error', (e) => log(`MoonlightWeb socket error: ${e.message}`));
    browser.on('error', (e) => log(`browser socket error: ${e.message}`));
  }

  async function signal(ws: WebSocket, s: StreamSession): Promise<void> {
    const link = store.state.mw;
    if (!mw || !link) throw new Error('not linked');
    let relay: SignalRelay | null = null;
    const pending: string[] = [];
    const upstream = await mw.socket(s.mwPath, (data, isBinary) => {
      if (isBinary) return;
      if (relay) relay.fromMw(data.toString('utf8'));
      else pending.push(data.toString('utf8'));
    });
    if (ws.readyState !== ws.OPEN) return void upstream.close(1000);
    relay = new SignalRelay({
      pairingKey: store.state.pairingKey,
      hostKey: Buffer.from(link.hostKey, 'base64'),
      hostId: link.hostId,
      iceServers: freshIce,
      browser: { send: (t) => ws.readyState === ws.OPEN && ws.send(t), close: (c, r) => ws.close(c, r) },
      mw: { send: (t) => upstream.readyState === upstream.OPEN && upstream.send(t), close: (c, r) => upstream.close(c, r) },
      log,
    });
    pair(ws, upstream);
    ws.on('message', (data, isBinary) => !isBinary && relay!.fromBrowser(data.toString()));
    for (const t of pending.splice(0)) relay.fromMw(t);
    relay.start();
  }

  async function media(ws: WebSocket, s: StreamSession): Promise<void> {
    if (!mw) throw new Error('not linked');
    const upstream = await mw.socket(s.mwPath, (data, isBinary) => {
      if (ws.readyState !== ws.OPEN) return;
      // a browser that can't keep up gets dropped rather than buffering minutes of video here
      if (ws.bufferedAmount > 32 * 1024 * 1024) return void ws.close(1013, 'too slow');
      ws.send(data, { binary: isBinary });
    });
    if (ws.readyState !== ws.OPEN) return void upstream.close(1000);
    pair(ws, upstream);
    // input from the browser is JSON text; nothing binary goes up
    ws.on('message', (data, isBinary) => {
      if (!isBinary && upstream.readyState === upstream.OPEN) upstream.send(data.toString());
    });
  }

  const sweep = setInterval(() => {
    if (active && now() - active.createdAt >= STREAM_MAX_MS) endActive(false);
    store.prune(nowSec());
  }, 60_000);
  sweep.unref();

  return {
    server,
    close: () => {
      clearInterval(sweep);
      for (const c of wss.clients) c.terminate();
      server.close();
    },
  };
}
