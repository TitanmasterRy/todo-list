import { describe, expect, it } from 'vitest';
import { GatewayClient, StreamError, toSession } from './api';

const SERVER = 'https://play.example.com';

interface Call {
  path: string;
  method: string;
  auth: string;
  body: Record<string, unknown> | undefined;
  init: RequestInit;
}

function gateway(routes: Record<string, (c: Call) => [number, unknown]>) {
  const calls: Call[] = [];
  const fetcher = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const headers = (init.headers ?? {}) as Record<string, string>;
    const c: Call = { path: url.pathname, method: init.method ?? 'GET', auth: headers.Authorization ?? '', body: init.body ? JSON.parse(String(init.body)) : undefined, init };
    calls.push(c);
    const r = routes[`${c.method} ${c.path}`];
    if (!r) return new Response('{}', { status: 404 });
    const [status, body] = r(c);
    return new Response(body === null ? null : JSON.stringify(body), { status });
  }) as typeof fetch;
  return { calls, fetcher };
}

const tokens = (n: number) => ({ accessToken: `access-token-number-${n}`, refreshToken: `refresh-${n}`, expiresIn: 900 });

describe('GatewayClient', () => {
  it('signs in, keeps the access token in memory and hands out the refresh token', async () => {
    const saved: string[] = [];
    const { calls, fetcher } = gateway({
      'POST /auth/login': () => [200, tokens(1)],
      'GET /apps': (c) => [
        c.auth === 'Bearer access-token-number-1' ? 200 : 401,
        [
          { id: 1, name: 'Desktop', art: '/apps/1/art' },
          { id: 0, name: 'bad' },
          { id: 2, name: 'Steam', art: 'https://evil/x' },
        ],
      ],
    });
    const api = new GatewayClient({ server: `${SERVER}/`, fetch: fetcher, onRefreshToken: (t) => saved.push(t) });
    await api.login('pw', '123456');
    expect(saved).toEqual(['refresh-1']);
    expect(await api.apps()).toEqual([
      { id: 1, name: 'Desktop', art: '/apps/1/art' },
      { id: 2, name: 'Steam', art: null },
    ]);
    expect(calls[0].body).toEqual({ password: 'pw', totp: '123456' });
    expect(calls[0].init.credentials).toBe('omit');
    expect(api.wsUrl('/ws-probe')).toBe('wss://play.example.com/ws-probe');
  });

  it('refreshes before the access token runs out, and once after a 401', async () => {
    let now = 0;
    let n = 1;
    const { calls, fetcher } = gateway({
      'POST /auth/refresh': (c) => [c.body?.refreshToken === `refresh-${n}` ? 200 : 401, tokens(++n)],
      'GET /apps': (c) => [c.auth === `Bearer access-token-number-${n}` ? 200 : 401, []],
    });
    const api = new GatewayClient({ server: SERVER, refreshToken: 'refresh-1', fetch: fetcher, now: () => now });
    await api.apps();
    expect(calls.map((c) => c.path)).toEqual(['/auth/refresh', '/apps']);
    now += 14.5 * 60_000; // within 30 s of expiry
    await api.apps();
    expect(calls.map((c) => c.path).slice(2)).toEqual(['/auth/refresh', '/apps']);
  });

  it('forgets the sign-in when the refresh token is refused', async () => {
    const saved: string[] = [];
    const { fetcher } = gateway({ 'POST /auth/refresh': () => [401, { error: 'unauthorized' }] });
    const api = new GatewayClient({ server: SERVER, refreshToken: 'old', fetch: fetcher, onRefreshToken: (t) => saved.push(t) });
    await expect(api.apps()).rejects.toMatchObject({ kind: 'auth' });
    expect(saved).toEqual(['']);
    expect(api.signedIn).toBe(false);
  });

  it('reports lockouts, enrollment and app_running with their codes', async () => {
    const { fetcher } = gateway({
      'POST /auth/login': () => [429, { error: 'locked', retryAfter: 900 }],
      'POST /auth/totp/enroll': () => [200, { otpauthUri: 'otpauth://totp/x?secret=A', qrSvg: '<svg/>', backupCodes: ['abcd-2345', '<script>'] }],
      'POST /auth/refresh': () => [200, tokens(1)],
      'POST /sessions': () => [409, { code: 'app_running', runningAppId: 2, error: 'Another app is running' }],
    });
    const api = new GatewayClient({ server: SERVER, refreshToken: 'r', fetch: fetcher });
    await expect(api.login('a', 'b')).rejects.toMatchObject({ kind: 'locked', data: { retryAfter: 900 } });
    expect((await api.enroll('pw')).backupCodes).toEqual(['abcd-2345']);
    const err = await api.startSession({ appId: 1, width: 1920, height: 1080, fps: 60 }).catch((e) => e);
    expect(err).toBeInstanceOf(StreamError);
    expect(err).toMatchObject({ status: 409, code: 'app_running', data: { runningAppId: 2 } });
  });

  it('turns network failures into a readable error', async () => {
    const api = new GatewayClient({ server: SERVER, fetch: (async () => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch });
    await expect(api.health()).rejects.toMatchObject({ kind: 'network', message: "Can't reach the stream server." });
  });

  it('logs out locally even when the server is unreachable', async () => {
    const saved: string[] = [];
    const api = new GatewayClient({
      server: SERVER,
      refreshToken: 'r',
      fetch: (async () => Promise.reject(new TypeError('offline'))) as typeof fetch,
      onRefreshToken: (t) => saved.push(t),
    });
    await expect(api.logout()).rejects.toThrow();
    expect(saved).toEqual(['']);
  });
});

describe('toSession', () => {
  const good = {
    id: 'abcdefghijklmnop',
    transport: 'webrtc',
    signalingPath: '/sessions/abcdefghijklmnop/signal',
    ticket: 't',
    iceServers: [{ urls: ['turn:a:3478?transport=udp', 'javascript:x'], username: 'u', credential: 'c' }],
    width: 1920,
    height: 1080,
    fps: 60,
  };

  it('keeps only TURN URLs and the right path', () => {
    const s = toSession(good);
    expect(s.iceServers).toEqual([{ urls: ['turn:a:3478?transport=udp'], username: 'u', credential: 'c' }]);
    expect(s.signalingPath).toBe('/sessions/abcdefghijklmnop/signal');
    expect(s.mediaPath).toBe('');
  });

  it('rejects odd answers', () => {
    expect(() => toSession({ ...good, id: '../x' })).toThrow(StreamError);
    expect(() => toSession({ ...good, signalingPath: 'https://evil.example/x' })).toThrow(StreamError);
    expect(() => toSession({ ...good, ticket: '' })).toThrow(StreamError);
  });
});
