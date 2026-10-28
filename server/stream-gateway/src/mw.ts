// The gateway's side of MoonlightWeb's REST API and WebSockets (see docs/wiki/08-REST-API.md in its repository).
// Every connection goes through connectPinned(), carries the gateway's one `mw_session` cookie, and sends no
// Origin or X-Forwarded-For: MW then treats the gateway as the LAN browser it is.
import { request } from 'node:http';
import WebSocket from 'ws';
import { connectPinned } from './pinned.js';

export interface MwResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}

export class MwError extends Error {
  constructor(
    message: string,
    readonly status = 0,
    readonly data: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export interface MwHost {
  uuid: string;
  name: string;
  state: string;
  pairState: string;
}

export interface MwApp {
  id: number;
  name: string;
  boxArt: boolean;
}

/** What the rest of the gateway needs from MoonlightWeb (faked in tests). */
export interface MwApi {
  health(): Promise<boolean>;
  validate(pin: string, publicKeyB64: string): Promise<{ cookie: string; hostKey: string; hostId: string }>;
  hosts(): Promise<MwHost[]>;
  apps(host: string, clientId: string): Promise<MwApp[]>;
  art(host: string, appId: number): Promise<Buffer>;
  start(host: string, body: Record<string, unknown>): Promise<Record<string, unknown>>;
  quit(host: string, clientId: string, quitApp: boolean): Promise<void>;
  stopSession(host: string): Promise<void>;
  /** a WebSocket to an MW path (/ws, /ws/stream, …); `onMessage` is attached before the handshake so nothing is missed */
  socket(path: string, onMessage: (data: Buffer, isBinary: boolean) => void): Promise<WebSocket>;
}

const MAX_BODY = 8 * 1024 * 1024;

export function parseJson(b: Buffer): Record<string, unknown> {
  try {
    const v = JSON.parse(b.toString('utf8'));
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** The mw_session value out of Set-Cookie, or ''. */
export function sessionCookie(setCookie: string | string[] | undefined): string {
  for (const c of Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []) {
    const m = /^mw_session=([^;\s]+)/.exec(c);
    if (m) return m[1];
  }
  return '';
}

const str = (x: unknown, max = 200) => (typeof x === 'string' ? x.slice(0, max) : '');

export class MwClient implements MwApi {
  constructor(
    private url: URL,
    private pin: string,
    private cookie: () => string,
  ) {}

  async raw(method: string, path: string, body?: unknown, timeoutMs = 30_000): Promise<MwResponse> {
    const sock = await connectPinned(this.url, this.pin);
    const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
    const headers: Record<string, string> = { Host: this.url.host, Accept: 'application/json', Connection: 'close' };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(payload.length);
    }
    const c = this.cookie();
    if (c) headers.Cookie = `mw_session=${c}`;
    return new Promise((resolve, reject) => {
      const req = request({ createConnection: () => sock, method, path, headers, timeout: timeoutMs }, (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (d: Buffer) => {
          size += d.length;
          if (size > MAX_BODY) {
            req.destroy(new MwError('MoonlightWeb answered with too much data'));
            return;
          }
          chunks.push(d);
        });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
        res.on('error', reject);
      });
      req.on('timeout', () => req.destroy(new MwError('MoonlightWeb did not answer in time')));
      req.on('error', reject);
      req.end(payload);
    });
  }

  private async json(method: string, path: string, body?: unknown, timeoutMs?: number): Promise<Record<string, unknown>> {
    const r = await this.raw(method, path, body, timeoutMs);
    const data = parseJson(r.body);
    if (r.status < 200 || r.status >= 300) throw new MwError(str(data.error) || str(data.message) || `MoonlightWeb answered ${r.status}`, r.status, data);
    return data;
  }

  async health(): Promise<boolean> {
    try {
      return (await this.raw('GET', '/api/health', undefined, 5_000)).status === 200;
    } catch {
      return false;
    }
  }

  async validate(pin: string, publicKeyB64: string) {
    const r = await this.raw('POST', '/api/auth/validate', { pin, remember: true, public_key: publicKeyB64, machine_name: 'stream-gateway' });
    const data = parseJson(r.body);
    if (r.status !== 200) throw new MwError(str(data.error) || `MoonlightWeb answered ${r.status}`, r.status, data);
    const cookie = sessionCookie(r.headers['set-cookie']);
    if (!cookie) throw new MwError('MoonlightWeb set no session cookie');
    if (data.pairing_key !== 'bound') throw new MwError(`MoonlightWeb did not bind the gateway's key (${str(data.pairing_key) || 'no answer'})`);
    const hostKey = str(data.host_public_key, 1000);
    const hostId = str(data.host_id);
    if (!hostKey || !hostId) throw new MwError('MoonlightWeb sent no host key');
    return { cookie, hostKey, hostId };
  }

  async hosts(): Promise<MwHost[]> {
    const list = (await this.json('GET', '/api/hosts')).hosts;
    return (Array.isArray(list) ? list : []).map((h: Record<string, unknown>) => ({ uuid: str(h.uuid), name: str(h.name), state: str(h.state), pairState: str(h.pairState) }));
  }

  async apps(host: string, clientId: string): Promise<MwApp[]> {
    const list = (await this.json('GET', `/api/hosts/${encodeURIComponent(host)}/apps?client_uniqueid=${clientId}`)).apps;
    return (Array.isArray(list) ? list : [])
      .map((a: Record<string, unknown>) => ({ id: typeof a.id === 'number' ? a.id : 0, name: str(a.name, 100), boxArt: a.boxArt === true }))
      .filter((a) => a.id > 0 && a.name);
  }

  async art(host: string, appId: number): Promise<Buffer> {
    const r = await this.raw('GET', `/api/hosts/${encodeURIComponent(host)}/appasset?appid=${appId}`);
    const type = String(r.headers['content-type'] ?? '');
    if (r.status !== 200 || !/^image\/(png|jpeg|webp)$/.test(type)) throw new MwError('No box art', r.status || 404);
    return r.body;
  }

  start(host: string, body: Record<string, unknown>) {
    return this.json('POST', `/api/hosts/${encodeURIComponent(host)}/start`, body, 35_000);
  }

  async quit(host: string, clientId: string, quitApp: boolean): Promise<void> {
    await this.json('POST', `/api/hosts/${encodeURIComponent(host)}/quit`, { client_uniqueid: clientId, quit_app: quitApp });
  }

  async stopSession(host: string): Promise<void> {
    await this.json('POST', `/api/hosts/${encodeURIComponent(host)}/stop-session`, {});
  }

  async socket(path: string, onMessage: (data: Buffer, isBinary: boolean) => void): Promise<WebSocket> {
    if (!/^\/ws\d?(\/stream)?$/.test(path)) throw new MwError('Unexpected MoonlightWeb socket path');
    const sock = await connectPinned(this.url, this.pin);
    const ws = new WebSocket(`wss://${this.url.host}${path}`, {
      createConnection: () => sock,
      headers: { Cookie: `mw_session=${this.cookie()}` },
      perMessageDeflate: false,
      maxPayload: 16 * 1024 * 1024,
      handshakeTimeout: 10_000,
    });
    ws.on('message', (data, isBinary) => onMessage(Buffer.isBuffer(data) ? data : Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data), isBinary));
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
      ws.once('unexpected-response', (_req, res) => reject(new MwError(`MoonlightWeb refused the socket (${res.statusCode})`, res.statusCode ?? 0)));
    });
    return ws;
  }
}

/** The path of a URL MW returned (signalingUrl / wsUrl), which may be absolute or already a path. */
export function mwPath(url: unknown): string {
  if (typeof url !== 'string' || !url) return '';
  try {
    return new URL(url, 'wss://mw.invalid').pathname;
  } catch {
    return '';
  }
}
