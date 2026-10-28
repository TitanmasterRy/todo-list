import { EventEmitter } from 'node:events';
import { mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createGateway } from './app.js';
import { hashPassword } from './cli.js';
import type { Config } from './config.js';
import { MwError, type MwApi, type MwApp, type MwHost } from './mw.js';
import { Store } from './store.js';
import { hostIdentity } from './testkit.js';
import { base32Decode, hotp } from './totp.js';

const ORIGIN = 'https://titanmasterry.github.io';
const PASSWORD = 'correct horse battery staple';
const PNG = Buffer.from('89504e470d0a1a0a0000', 'hex');
const host = hostIdentity();
let passwordHash = '';

class FakeUpstream extends EventEmitter {
  readyState = 1;
  OPEN = 1;
  sent: string[] = [];
  constructor(
    readonly path: string,
    readonly deliver: (data: Buffer, isBinary: boolean) => void,
  ) {
    super();
  }
  send(t: string) {
    this.sent.push(t);
  }
  close(code = 1000, reason = '') {
    if (this.readyState !== 1) return;
    this.readyState = 3;
    this.emit('close', code, Buffer.from(reason));
  }
}

class FakeMw implements MwApi {
  calls: string[] = [];
  starts: Record<string, unknown>[] = [];
  upstreams: FakeUpstream[] = [];
  startResult: Record<string, unknown> | Error = { transport: 'webrtc', signalingUrl: 'wss://10.250.50.10:8443/ws', videoCodec: 'h264' };
  async health() {
    return true;
  }
  async validate() {
    return { cookie: 'cookie', hostKey: host.spki.toString('base64'), hostId: host.hostId };
  }
  async hosts(): Promise<MwHost[]> {
    return [{ uuid: 'H1', name: 'Gaming PC', state: 'online', pairState: 'paired' }];
  }
  async apps(): Promise<MwApp[]> {
    return [
      { id: 1, name: 'Desktop', boxArt: true },
      { id: 2, name: 'Steam Big Picture', boxArt: false },
    ];
  }
  async art() {
    return PNG;
  }
  async start(_h: string, body: Record<string, unknown>) {
    this.starts.push(body);
    if (this.startResult instanceof Error) throw this.startResult;
    return this.startResult;
  }
  async quit(_h: string, _c: string, quitApp: boolean) {
    this.calls.push(`quit:${quitApp}`);
  }
  async stopSession() {
    this.calls.push('stop-session');
  }
  async socket(path: string, onMessage: (data: Buffer, isBinary: boolean) => void) {
    const u = new FakeUpstream(path, onMessage);
    this.upstreams.push(u);
    return u as unknown as WebSocket;
  }
}

let clock = 1_700_000_000_000;
let base = '';
let mw: FakeMw;
let store: Store;
let gw: ReturnType<typeof createGateway>;

function config(): Config {
  return {
    port: 0,
    dataDir: '',
    passwordHash,
    signingKey: Buffer.from('s'.repeat(48)),
    turnSecret: 'turnsecret',
    turnHost: 'turn.example.org',
    mwUrl: new URL('https://10.250.50.10:8443'),
    mwCertSha256: 'A'.repeat(64),
    mwHostId: '',
    allowedOrigin: ORIGIN,
  };
}

async function api(path: string, o: { method?: string; body?: unknown; token?: string; origin?: string | null; ip?: string } = {}) {
  const headers: Record<string, string> = {};
  if (o.body !== undefined) headers['Content-Type'] = 'application/json';
  if (o.token) headers.Authorization = `Bearer ${o.token}`;
  if (o.origin !== null) headers.Origin = o.origin ?? ORIGIN;
  if (o.ip) headers['X-Forwarded-For'] = o.ip;
  const r = await fetch(base + path, { method: o.method ?? (o.body === undefined ? 'GET' : 'POST'), headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) });
  const text = await r.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: r.status, headers: r.headers, json };
}

const code = (secret: string, dt = 0) => hotp(base32Decode(secret), Math.floor((clock / 1000 + dt) / 30));

async function enroll(): Promise<{ secret: string; backupCodes: string[] }> {
  const r = await api('/auth/totp/enroll', { body: { password: PASSWORD } });
  expect(r.status).toBe(200);
  return { secret: new URL(r.json.otpauthUri as string).searchParams.get('secret')!, backupCodes: r.json.backupCodes as string[] };
}

async function signIn(): Promise<{ accessToken: string; refreshToken: string; secret: string }> {
  const { secret } = await enroll();
  const r = await api('/auth/login', { body: { password: PASSWORD, totp: code(secret) } });
  expect(r.status).toBe(200);
  return { ...(r.json as { accessToken: string; refreshToken: string }), secret };
}

function wsOpen(path: string, origin = ORIGIN): Promise<WebSocket> {
  const ws = new WebSocket(base.replace('http', 'ws') + path, { origin });
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve(ws));
    ws.once('unexpected-response', (_q, res) => reject(new Error(String(res.statusCode))));
    ws.once('error', reject);
  });
}

const nextMessage = (ws: WebSocket) => new Promise<{ data: Buffer; isBinary: boolean }>((r) => ws.once('message', (data, isBinary) => r({ data: data as Buffer, isBinary })));
const closed = (ws: WebSocket) => new Promise<number>((r) => ws.once('close', (c) => r(c)));
const tick = () => new Promise((r) => setTimeout(r, 30));

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD, 1024);
});

beforeEach(async () => {
  clock = 1_700_000_000_000;
  mw = new FakeMw();
  store = new Store(mkdtempSync(join(tmpdir(), 'gw-')));
  store.state.mw = { cookie: 'cookie', hostKey: host.spki.toString('base64'), hostId: host.hostId, linkedAt: '' };
  gw = createGateway({ config: config(), store, mw, now: () => clock, log: () => {} });
  await new Promise<void>((r) => gw.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(gw.server.address() as AddressInfo).port}`;
});

afterEach(() => gw.close());

describe('health', () => {
  it('reports MoonlightWeb and the host without auth', async () => {
    expect((await api('/health', { origin: null })).json).toEqual({ ok: true, mw: 'up', host: 'online' });
  });

  it('says unlinked before link-mw, and up right after it', async () => {
    const link = store.state.mw!;
    delete store.state.mw;
    expect((await api('/health')).json).toMatchObject({ mw: 'unlinked' });
    store.state.mw = { ...link, linkedAt: 'now' };
    expect((await api('/health')).json).toMatchObject({ mw: 'up', host: 'online' });
  });

  it('prefers the paired host that is online over an old paired entry, and never sticks to a dead one', async () => {
    const OLD: MwHost = { uuid: 'OLD', name: 'Sunshine', state: 'offline', pairState: 'paired' };
    const NEW: MwHost = { uuid: 'NEW', name: 'Apollo', state: 'online', pairState: 'paired' };
    let list = [OLD];
    mw.hosts = async () => list;
    expect((await api('/health')).json).toMatchObject({ host: 'offline' });
    // Apollo paired a minute later: picked up at once, not after the host cache runs out
    clock += 60_000;
    list = [OLD, NEW];
    expect((await api('/health')).json).toMatchObject({ host: 'online' });
    const { accessToken } = await signIn();
    let asked = '';
    mw.apps = (async (h: string) => ((asked = h), [])) as unknown as FakeMw['apps'];
    await api('/apps', { token: accessToken });
    expect(asked).toBe('NEW');
  });

  it('keeps state.json private', () => {
    expect(statSync(store.file).mode & 0o777).toBe(0o600);
  });
});

describe('CORS', () => {
  it('answers the site’s preflight', async () => {
    const r = await api('/auth/login', { method: 'OPTIONS' });
    expect(r.status).toBe(204);
    expect(r.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(r.headers.get('access-control-allow-headers')).toMatch(/Authorization/);
  });

  it('refuses every other origin', async () => {
    expect((await api('/health', { origin: 'https://evil.example' })).status).toBe(403);
    expect((await api('/auth/login', { method: 'OPTIONS', origin: 'https://titanmasterry.github.io.evil.example' })).status).toBe(403);
  });

  it('refuses WebSocket upgrades from other origins', async () => {
    await expect(wsOpen('/ws-probe', 'https://evil.example')).rejects.toThrow('403');
  });
});

describe('sign-in', () => {
  it('asks for TOTP enrollment first, then refuses to enroll again', async () => {
    expect((await api('/auth/login', { body: { password: PASSWORD, totp: '123456' } })).json.code).toBe('enroll_required');
    expect((await api('/auth/totp/enroll', { body: { password: 'wrong' } })).status).toBe(401);
    const r = await api('/auth/totp/enroll', { body: { password: PASSWORD } });
    expect(r.json.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
    expect(r.json.qrSvg).toMatch(/^<svg/);
    expect(r.json.backupCodes).toHaveLength(10);
    expect((await api('/auth/totp/enroll', { body: { password: PASSWORD } })).status).toBe(410);
  });

  it('needs the password and a fresh code', async () => {
    const { secret, backupCodes } = await enroll();
    expect((await api('/auth/login', { body: { password: 'nope', totp: code(secret) } })).status).toBe(401);
    expect((await api('/auth/login', { body: { password: PASSWORD, totp: '000000' } })).status).toBe(401);
    const ok = await api('/auth/login', { body: { password: PASSWORD, totp: code(secret) } });
    expect(ok.json).toMatchObject({ expiresIn: 900 });
    // the same code can't be replayed
    expect((await api('/auth/login', { body: { password: PASSWORD, totp: code(secret) } })).status).toBe(401);
    // a backup code works once
    expect((await api('/auth/login', { body: { password: PASSWORD, totp: backupCodes[0].toUpperCase() } })).status).toBe(200);
    expect((await api('/auth/login', { body: { password: PASSWORD, totp: backupCodes[0] } })).status).toBe(401);
    expect(JSON.stringify(store.state)).not.toContain(backupCodes[1]);
  });

  it('locks an address out after five failures, even with the right password', async () => {
    const { secret } = await enroll();
    for (let i = 0; i < 5; i++) expect((await api('/auth/login', { body: { password: 'x', totp: '1' }, ip: '7.7.7.7' })).status).toBe(401);
    const locked = await api('/auth/login', { body: { password: PASSWORD, totp: code(secret) }, ip: '7.7.7.7' });
    expect(locked.status).toBe(429);
    expect(locked.headers.get('retry-after')).toBe('900');
    expect((await api('/auth/login', { body: { password: PASSWORD, totp: code(secret) }, ip: '8.8.8.8' })).status).toBe(200);
    clock += 15 * 60_000;
    expect((await api('/auth/login', { body: { password: PASSWORD, totp: code(secret) }, ip: '7.7.7.7' })).status).toBe(200);
  });

  it('expires access tokens after 15 minutes and refreshes with rotation', async () => {
    const { accessToken, refreshToken } = await signIn();
    expect((await api('/apps', { token: accessToken })).status).toBe(200);
    clock += 15 * 60_000;
    expect((await api('/apps', { token: accessToken })).status).toBe(401);
    const r = await api('/auth/refresh', { body: { refreshToken } });
    expect(r.status).toBe(200);
    expect((await api('/apps', { token: r.json.accessToken as string })).status).toBe(200);
    // the old refresh token coming back means it leaked: that whole sign-in ends
    expect((await api('/auth/refresh', { body: { refreshToken } })).status).toBe(401);
    expect((await api('/apps', { token: r.json.accessToken as string })).status).toBe(401);
    expect((await api('/auth/refresh', { body: { refreshToken: r.json.refreshToken } })).status).toBe(401);
  });

  it('ends a sign-in 12 hours after the password, however often it is refreshed', async () => {
    let { refreshToken } = await signIn();
    for (let i = 0; i < 11; i++) {
      clock += 60 * 60_000;
      const r = await api('/auth/refresh', { body: { refreshToken } });
      expect(r.status).toBe(200);
      refreshToken = r.json.refreshToken as string;
    }
    clock += 60 * 60_000;
    expect((await api('/auth/refresh', { body: { refreshToken } })).status).toBe(401);
  });

  it('logs out at once', async () => {
    const { accessToken, refreshToken } = await signIn();
    expect((await api('/auth/logout', { method: 'POST', token: accessToken })).status).toBe(204);
    expect((await api('/apps', { token: accessToken })).status).toBe(401);
    expect((await api('/auth/refresh', { body: { refreshToken } })).status).toBe(401);
  });
});

describe('apps and TURN', () => {
  it('lists apps with art proxied behind auth', async () => {
    const { accessToken } = await signIn();
    expect((await api('/apps')).status).toBe(401);
    expect((await api('/apps', { token: accessToken })).json).toEqual([
      { id: 1, name: 'Desktop', art: '/apps/1/art' },
      { id: 2, name: 'Steam Big Picture', art: null },
    ]);
    const r = await fetch(`${base}/apps/1/art`, { headers: { Authorization: `Bearer ${accessToken}` } });
    expect(r.headers.get('content-type')).toBe('image/png');
    expect(Buffer.from(await r.arrayBuffer())).toEqual(PNG);
  });

  it('issues short-lived TURN credentials', async () => {
    const { accessToken } = await signIn();
    const r = await api('/turn-credentials', { token: accessToken });
    expect(r.json.ttl).toBe(600);
    expect(r.json.username).toMatch(new RegExp(`^${clock / 1000 + 600}:`));
    expect(r.json.urls).toHaveLength(3);
  });
});

describe('sessions', () => {
  it('launches the WebRTC DataChannel transport at the asked size, one stream at a time', async () => {
    const { accessToken } = await signIn();
    const r = await api('/sessions', { token: accessToken, body: { appId: 1, width: 2880, height: 1800, fps: 120 } });
    expect(r.status).toBe(201);
    expect(mw.starts[0]).toMatchObject({
      appId: 1,
      stream_height: 1800,
      stream_aspect: '2880:1800',
      stream_fps: 120,
      video_codec: 'h264',
      transport_mode: 'webrtc-dc-udp',
      client_uniqueid: store.state.clientUniqueId,
    });
    expect(r.json).toMatchObject({ transport: 'webrtc', signalingPath: `/sessions/${r.json.id}/signal`, width: 2880, height: 1800 });
    expect((r.json.iceServers as { urls: string[] }[])[0].urls[0]).toBe('turn:turn.example.org:3478?transport=udp');
    const again = await api('/sessions', { token: accessToken, body: { appId: 2, width: 1920, height: 1080, fps: 60 } });
    expect(again.json).toMatchObject({ code: 'stream_active', id: r.json.id });
    expect((await api(`/sessions/${r.json.id}`, { method: 'DELETE', token: accessToken, body: { quitApp: true } })).status).toBe(204);
    await tick();
    expect(mw.calls).toEqual(['quit:true']);
    expect((await api('/sessions', { token: accessToken, body: { appId: 2, width: 1920, height: 1080, fps: 60 } })).status).toBe(201);
  });

  it('clamps sizes and passes app_running through for the resume/quit prompt', async () => {
    const { accessToken } = await signIn();
    mw.startResult = new MwError('Another app is running', 409, { code: 'app_running', runningAppId: 2 });
    const r = await api('/sessions', { token: accessToken, body: { appId: 1, width: 9999, height: 99, fps: 500, bitrate: 1 } });
    expect(r.json).toMatchObject({ code: 'app_running', runningAppId: 2 });
    expect(mw.starts[0]).toMatchObject({ stream_height: 240, stream_aspect: '4096:240', stream_fps: 240, stream_bitrate: 1000 });
    expect((await api('/sessions', { token: accessToken, body: { appId: 'x' } })).status).toBe(400);
    mw.startResult = new MwError('Not authenticated', 401);
    expect((await api('/sessions', { token: accessToken, body: { appId: 1, width: 1920, height: 1080, fps: 60 } })).json).toMatchObject({ code: 'unlinked' });
  });

  it('launches the WebSocket transport for 443-only networks', async () => {
    const { accessToken } = await signIn();
    mw.startResult = { transport: 'wss', wsUrl: 'wss://10.250.50.10:8443/ws/stream', signalingUrl: '' };
    const r = await api('/sessions', { token: accessToken, body: { appId: 1, width: 1920, height: 1080, fps: 60, transport: 'ws' } });
    expect(mw.starts[0].transport_mode).toBe('wss');
    expect(r.json).toMatchObject({ transport: 'ws', mediaPath: `/sessions/${r.json.id}/media` });
  });

  it('revoke-all ends the stream and every token', async () => {
    const { accessToken, refreshToken } = await signIn();
    await api('/sessions', { token: accessToken, body: { appId: 1, width: 1920, height: 1080, fps: 60 } });
    const r = await api('/auth/revoke-all', { method: 'POST', token: accessToken });
    expect(r.json).toEqual({ ok: true, streamEnded: true });
    await tick();
    expect(mw.calls).toEqual(['quit:false', 'stop-session']);
    expect((await api('/apps', { token: accessToken })).status).toBe(401);
    expect((await api('/auth/refresh', { body: { refreshToken } })).status).toBe(401);
  });
});

describe('WebSockets', () => {
  async function start(transport: 'webrtc' | 'ws' = 'webrtc') {
    const { accessToken } = await signIn();
    if (transport === 'ws') mw.startResult = { transport: 'wss', wsUrl: '/ws/stream' };
    const r = await api('/sessions', { token: accessToken, body: { appId: 1, width: 1920, height: 1080, fps: 60, transport } });
    return r.json as { id: string; ticket: string; signalingPath?: string; mediaPath?: string };
  }

  it('echoes the connection probe', async () => {
    const ws = await wsOpen('/ws-probe');
    ws.send('ping');
    expect((await nextMessage(ws)).data.toString()).toBe('ping');
  });

  it('needs a one-time ticket as the first message', async () => {
    const s = await start();
    const bad = await wsOpen(s.signalingPath!);
    bad.send(JSON.stringify({ type: 'auth', ticket: 'nope' }));
    expect(await closed(bad)).toBe(4001);
    const ws = await wsOpen(s.signalingPath!);
    ws.send(JSON.stringify({ type: 'auth', ticket: s.ticket }));
    await tick();
    expect(mw.upstreams[0].path).toBe('/ws');
    const replay = await wsOpen(s.signalingPath!);
    replay.send(JSON.stringify({ type: 'auth', ticket: s.ticket }));
    expect(await closed(replay)).toBe(4001);
  });

  it('relays signaling with MW-BIND and TURN in place of MoonlightWeb’s ice-config', async () => {
    const s = await start();
    const ws = await wsOpen(s.signalingPath!);
    ws.send(JSON.stringify({ type: 'auth', ticket: s.ticket }));
    await tick();
    const up = mw.upstreams[0];
    expect(JSON.parse(up.sent[0]).type).toBe('hello');
    const msg = nextMessage(ws);
    up.deliver(Buffer.from(JSON.stringify({ type: 'ice-config', iceServers: [], iceTimeoutMs: 8000 })), false);
    const ice = JSON.parse((await msg).data.toString());
    expect(ice.iceServers[0].urls).toContain('turns:turn.example.org:5349?transport=tcp');
    // a forged offer closes the browser's socket with 1008
    const code = closed(ws);
    up.deliver(Buffer.from(JSON.stringify({ type: 'sdp', sdp: 'v=0', protocol: 'MW-BIND-v1', host_id: host.hostId, nonce: 'AAAAAAAAAAAAAAAAAAAAAA==', sig: 'AA==' })), false);
    expect(await code).toBe(1008);
  });

  it('pipes the WebSocket transport both ways', async () => {
    const s = await start('ws');
    const ws = await wsOpen(s.mediaPath!);
    ws.send(JSON.stringify({ type: 'auth', ticket: s.ticket }));
    await tick();
    const up = mw.upstreams[0];
    expect(up.path).toBe('/ws/stream');
    const msg = nextMessage(ws);
    up.deliver(Buffer.from([1, 1, 0, 0, 0, 1, 0x67]), true);
    expect(await msg).toEqual({ data: Buffer.from([1, 1, 0, 0, 0, 1, 0x67]), isBinary: true });
    ws.send(JSON.stringify({ type: 'keydown', keyCode: 65 }));
    await tick();
    expect(up.sent).toEqual([JSON.stringify({ type: 'keydown', keyCode: 65 })]);
    ws.close();
    await tick();
    expect(up.readyState).toBe(3);
  });
});
