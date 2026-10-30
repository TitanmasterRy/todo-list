import { expect, test, type Page, type Route } from '@playwright/test';
import { openApp } from './helpers';

// The test build allows this origin (VITE_STREAM_SERVER in playwright.config.ts); the gateway is mocked below.
const GW = 'https://play.example.com';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' };
const PASSWORD = 'correct horse battery staple';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="2" height="2"/></svg>';
const CODES = ['abcd-2345', 'efgh-6723', 'ijkl-2345', 'mnop-3456', 'qrst-4567', 'uvwx-5672', 'yzab-6723', 'cdef-7234', 'ghij-2345', 'klmn-3456'];

interface Gateway {
  calls: { method: string; path: string; body: Record<string, unknown> }[];
  enrolled: boolean;
  startResults: [number, unknown][];
}

/** A fake gateway (server/stream-gateway/API.md). TURN points nowhere, so the relay probes fail as on a 443-only network. */
async function mockGateway(page: Page, { holdSignal = false } = {}): Promise<Gateway> {
  const gw: Gateway = { calls: [], enrolled: false, startResults: [] };
  let n = 0;
  const tokens = () => ({ accessToken: `access-token-e2e-${++n}`, refreshToken: `refresh-e2e-${n}`, expiresIn: 900 });
  await page.route(`${GW}/**`, async (route: Route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
    gw.calls.push({ method: req.method(), path, body });
    const json = (status: number, data?: unknown) =>
      route.fulfill({ status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: data === undefined ? '' : JSON.stringify(data) });
    const authed = /^Bearer access-token-e2e-\d+$/.test(req.headers()['authorization'] ?? '');
    const key = `${req.method()} ${path}`;
    if (key === 'GET /health') return json(200, { ok: true, mw: 'up', host: 'online' });
    if (key === 'POST /auth/login') {
      if (body.password === 'locked') return json(429, { error: 'locked', retryAfter: 900 });
      if (body.password !== PASSWORD) return json(401, { error: 'invalid_credentials' });
      if (!gw.enrolled) return json(409, { code: 'enroll_required' });
      return body.totp === '123456' ? json(200, tokens()) : json(401, { error: 'invalid_credentials' });
    }
    if (key === 'POST /auth/totp/enroll') {
      gw.enrolled = true;
      return json(200, { otpauthUri: 'otpauth://totp/Homework%20To-Do%3AStream?secret=JBSWY3DPEHPK3PXP&issuer=Homework%20To-Do', qrSvg: SVG, backupCodes: CODES });
    }
    if (key === 'POST /auth/refresh') return json(200, tokens());
    if (!authed) return json(401, { error: 'unauthorized' });
    if (key === 'GET /apps')
      return json(200, [
        { id: 1, name: 'Desktop', art: '/apps/1/art' },
        { id: 2, name: 'Steam Big Picture', art: null },
      ]);
    if (key === 'GET /apps/1/art') return route.fulfill({ status: 200, headers: { ...CORS, 'Content-Type': 'image/png' }, body: PNG });
    if (key === 'GET /turn-credentials')
      return json(200, {
        username: '1:x',
        credential: 'c',
        ttl: 600,
        urls: ['turn:127.0.0.1:9?transport=udp', 'turn:127.0.0.1:9?transport=tcp', 'turns:127.0.0.1:9?transport=tcp'],
      });
    if (key === 'POST /sessions') {
      const [status, data] = gw.startResults.shift() ?? [500, { error: 'no result queued' }];
      return json(status, data);
    }
    if (req.method() === 'DELETE' && path.startsWith('/sessions/')) return json(204);
    if (key === 'POST /auth/logout' || key === 'POST /auth/revoke-all') return json(key.endsWith('logout') ? 204 : 200, { ok: true });
    return json(404, { error: 'not_found' });
  });
  // the connection test's probe echoes; the signaling socket refuses the binding like the gateway does on a forged offer
  await page.routeWebSocket(`wss://play.example.com/ws-probe`, (ws) => ws.onMessage((m) => ws.send(m)));
  await page.routeWebSocket(/\/sessions\/[\w-]+\/signal$/, (ws) => {
    ws.onMessage((m) => {
      if (!holdSignal && typeof m === 'string' && JSON.parse(m).type === 'auth') ws.close({ code: 1008, reason: 'pairing verification failed' });
    });
  });
  return gw;
}

async function openStream(page: Page) {
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Stream/ }).click();
}

async function signIn(page: Page, gw: Gateway) {
  gw.enrolled = true;
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByLabel(/^Code/).fill('123456');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start Desktop' })).toBeVisible();
}

test('Stream: the first sign-in sets up two-step codes, then lists the PC’s apps', async ({ page }) => {
  const gw = await mockGateway(page);
  const errors = await openApp(page);
  await openStream(page);
  await expect(page.getByRole('heading', { name: 'Sign in to stream' })).toBeVisible();
  await expect(page.locator('[data-host-status]')).toHaveText('Gaming PC online');

  await page.getByLabel('Password').fill('nope');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Wrong password or code.');

  // right password, no code yet: the gateway asks for enrollment
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Set up two-step sign-in' })).toBeVisible();
  await page.getByRole('button', { name: 'Show the QR code' }).click();
  await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible();
  await expect(page.locator('[data-enroll] code').first()).toHaveText('JBSW Y3DP EHPK 3PXP');
  await expect(page.locator('[data-backup-codes] li')).toHaveCount(10);
  const finish = page.getByRole('button', { name: 'Finish and sign in' });
  await page.getByLabel('Enter the code your app shows now').fill('123456');
  await expect(finish).toBeDisabled();
  await page.getByLabel('I saved my backup codes').check();
  await finish.click();

  await expect(page.getByRole('button', { name: 'Start Desktop' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Desktop' }).locator('img')).toHaveAttribute('src', /^blob:/);
  await expect(page.getByRole('button', { name: 'Start Steam Big Picture' })).toBeVisible();

  // the refresh token is kept with the other keys; the password is kept nowhere
  const settings = await page.evaluate(() => localStorage.getItem('homework-todo:settings') ?? '');
  expect(JSON.parse(settings).streamToken).toMatch(/^refresh-e2e-\d+$/);
  const everything = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  expect(everything).not.toContain(PASSWORD);
  expect(gw.calls.filter((c) => c.path === '/auth/totp/enroll')).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('Stream: a lockout says how long to wait', async ({ page }) => {
  await mockGateway(page);
  await openApp(page);
  await openStream(page);
  await page.getByLabel('Password').fill('locked');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Too many tries. Wait 15 minutes and try again.');
});

test('Stream: the connection test explains a network that only lets 443 out', async ({ page }) => {
  test.setTimeout(60_000);
  const gw = await mockGateway(page);
  const errors = await openApp(page);
  await openStream(page);
  await signIn(page, gw);
  await page.getByRole('button', { name: /Connection test/ }).click();
  const panel = page.locator('[data-conn-test]');
  await expect(panel.locator('[data-verdict]')).toHaveText(/only lets normal web traffic \(port 443\) out/, { timeout: 40_000 });
  await expect(panel).toContainText('Stream server reachable (HTTPS): The server, the home bridge and the gaming PC are up.');
  await expect(panel).toContainText('Secure WebSocket (signaling): Works.');
  await expect(panel).toContainText('Relay over UDP 3478: Blocked or not answering.');
  await expect(panel).toContainText('WebSocket stream on port 443: Works');
  expect(errors).toEqual([]);
});

test('Stream: resume-or-quit prompt, then a refused binding ends the stream with a clear reason', async ({ page }) => {
  test.setTimeout(60_000);
  const gw = await mockGateway(page);
  // WebRTC chosen in settings, so the launch doesn't depend on the connection test's verdict
  await page.addInitScript(() => localStorage.setItem('homework-todo:stream', JSON.stringify({ transport: 'webrtc' })));
  const errors = await openApp(page);
  await openStream(page);
  await signIn(page, gw);

  gw.startResults.push([409, { code: 'app_running', runningAppId: 2, error: 'Another app is running' }]);
  await page.getByRole('button', { name: 'Start Desktop' }).click();
  // the first launch runs the connection test, whose relay probes time out here
  const prompt = page.getByRole('alertdialog', { name: 'Another app is running' });
  await expect(prompt).toContainText('Steam Big Picture is already running on the PC.', { timeout: 30_000 });
  await expect(prompt.getByRole('button', { name: 'Resume Steam Big Picture' })).toBeVisible();

  gw.startResults.push([
    201,
    {
      id: 'abcdefghijklmnop',
      transport: 'webrtc',
      signalingPath: '/sessions/abcdefghijklmnop/signal',
      ticket: 'ticket-e2e',
      iceServers: [{ urls: ['turn:127.0.0.1:9?transport=udp'], username: 'u', credential: 'c' }],
      videoCodec: 'h264',
      width: 1920,
      height: 1080,
      fps: 60,
      bitrate: 20000,
    },
  ]);
  await prompt.getByRole('button', { name: 'Quit it and start Desktop' }).click();
  const start = gw.calls.filter((c) => c.path === '/sessions').at(-1)!;
  expect(start.body).toMatchObject({ appId: 1, quitRunning: true, transport: 'webrtc' });
  expect(Number(start.body.width) % 2).toBe(0);
  expect(Number(start.body.fps)).toBeGreaterThan(0);

  // the fake gateway closes the signaling socket with 1008, as it does when MoonlightWeb's offer doesn't verify
  await expect(page.getByRole('status').filter({ hasText: 'couldn’t verify the gaming PC' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try the WebSocket mode' })).toBeVisible();
  await expect.poll(() => gw.calls.some((c) => c.method === 'DELETE' && c.path === '/sessions/abcdefghijklmnop')).toBe(true);
  expect(errors).toEqual([]);
});

test('Stream: while streaming, keys go to the PC instead of switching tabs, and Lock mouse hides the bar', async ({ page }) => {
  const gw = await mockGateway(page, { holdSignal: true });
  // a stand-in for WebRTC: the relay probes find a relay, and the stream's channels open at once (no PC behind them);
  // pointer lock is faked too, since headless Chromium has no mouse to lock
  await page.addInitScript(() => {
    const w = window as unknown as { sent: string[]; locked: Element | null; RTCPeerConnection: unknown };
    w.sent = [];
    w.locked = null;
    class FakeChannel {
      readyState = 'connecting';
      binaryType = 'blob';
      onopen: (() => void) | null = null;
      onmessage: (() => void) | null = null;
      constructor(readonly label: string) {
        setTimeout(() => {
          this.readyState = 'open';
          this.onopen?.();
        }, 50);
      }
      send(m: string) {
        if (this.label === 'input') w.sent.push(m);
      }
      close() {
        this.readyState = 'closed';
      }
    }
    w.RTCPeerConnection = class {
      connectionState = 'new';
      onicecandidate: ((e: { candidate: { candidate: string } | null }) => void) | null = null;
      createDataChannel(label: string) {
        return new FakeChannel(label);
      }
      async createOffer() {
        return { type: 'offer', sdp: '' };
      }
      async setLocalDescription() {
        this.onicecandidate?.({ candidate: { candidate: 'candidate:1 1 udp 1 192.0.2.1 3478 typ relay raddr 0.0.0.0 rport 0' } });
      }
      setConfiguration() {}
      async getStats() {
        return new Map();
      }
      close() {}
    };
    Object.defineProperty(Document.prototype, 'pointerLockElement', { get: () => w.locked });
    Element.prototype.requestPointerLock = function (this: Element) {
      w.locked = this;
      document.dispatchEvent(new Event('pointerlockchange'));
      return Promise.resolve();
    } as Element['requestPointerLock'];
    Document.prototype.exitPointerLock = () => {
      w.locked = null;
      document.dispatchEvent(new Event('pointerlockchange'));
    };
  });
  const errors = await openApp(page);
  await openStream(page);
  await signIn(page, gw);
  gw.startResults.push([
    201,
    {
      id: 'keyskeyskeyskeys',
      transport: 'webrtc',
      signalingPath: '/sessions/keyskeyskeyskeys/signal',
      ticket: 'ticket-e2e',
      iceServers: [{ urls: ['turn:127.0.0.1:9?transport=udp'], username: 'u', credential: 'c' }],
      videoCodec: 'h264',
      width: 1920,
      height: 1080,
      fps: 60,
      bitrate: 20000,
    },
  ]);
  await page.getByRole('button', { name: 'Start Desktop' }).click();
  const bar = page.getByRole('toolbar', { name: 'Stream controls' });
  await expect(bar.getByText('Live')).toBeVisible({ timeout: 20_000 });

  const sent = () => page.evaluate(() => (window as unknown as { sent: string[] }).sent.map((m) => JSON.parse(m) as { type: string; code?: string }));
  // 2 would open Upcoming and n would jump to quick add; both go to the PC instead
  await page.keyboard.press('2');
  await page.keyboard.press('n');
  await expect.poll(async () => (await sent()).filter((m) => m.type === 'keydown').map((m) => m.code)).toEqual(['Digit2', 'KeyN']);
  await expect(bar).toBeVisible();
  await expect(page.getByRole('tab', { name: /Stream/ })).toHaveAttribute('aria-selected', 'true');

  // Lock mouse hides the bar, and Space reaches the PC instead of pressing the button again
  await bar.getByRole('button', { name: 'Lock mouse' }).click();
  await expect(bar).toBeHidden();
  await page.keyboard.press('Space');
  await expect.poll(async () => (await sent()).some((m) => m.type === 'keydown' && m.code === 'Space')).toBe(true);
  // Esc (the browser releases the mouse) brings the bar back
  await page.evaluate(() => document.exitPointerLock());
  await expect(bar).toBeVisible();
  expect(errors).toEqual([]);
});
