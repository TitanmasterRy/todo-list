import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';
import { openApp, seedCoins } from './helpers';

// A two-second VP8 clip (regenerate with tests/e2e/fixtures/make-clip.mjs)
const CLIP = readFileSync(new URL('./fixtures/clip.webm', import.meta.url));
// The test build allows this origin in connect-src (VITE_MEDIA_SERVERS in playwright.config.ts)
const JELLY = 'https://jelly.example.com';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const movie = (position = 0) => ({
  Id: 'm1',
  Name: 'Big Buck Bunny',
  Type: 'Movie',
  Overview: '<img src=x onerror=alert(1)> A bunny.',
  ProductionYear: 2008,
  RunTimeTicks: 20_000_000,
  ImageTags: { Primary: 'tag1' },
  UserData: { PlaybackPositionTicks: position, Played: false },
  MediaSources: [
    {
      Id: 'ms1',
      Container: 'webm',
      MediaStreams: [
        { Type: 'Video', Codec: 'vp8', Index: 0 },
        { Type: 'Subtitle', Codec: 'srt', Index: 2, Language: 'eng', DisplayTitle: 'English', IsTextSubtitleStream: true },
      ],
    },
  ],
});

/** A fake Jellyfin server. Returns the playback reports it receives. */
async function mockJellyfin(page: Page): Promise<{ reports: { path: string; body: Record<string, unknown> }[]; auth: string[] }> {
  const reports: { path: string; body: Record<string, unknown> }[] = [];
  const auth: string[] = [];
  await page.route(`${JELLY}/**`, async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const key = `${req.method()} ${url.pathname}`;
    if (key === 'POST /Users/AuthenticateByName') {
      auth.push(req.headers()['x-emby-authorization'] ?? '');
      const body = req.postDataJSON() as { Username: string; Pw: string };
      if (body.Username !== 'kid' || body.Pw !== 'hunter2') return route.fulfill({ status: 401, headers: CORS, body: '' });
      return json({ AccessToken: 'tok_e2e_123456', ServerId: 'srv', User: { Id: 'user1', Name: 'Kid' } });
    }
    if (key === 'GET /Users/user1/Views') return json({ Items: [{ Id: 'lib1', Name: 'Movies', Type: 'CollectionFolder', CollectionType: 'movies' }] });
    if (key === 'GET /Users/user1/Items/Resume') return json({ Items: [movie(10_000_000)] });
    if (key === 'GET /Shows/NextUp') return json({ Items: [] });
    if (key === 'GET /Users/user1/Items') return json({ Items: [movie()], TotalRecordCount: 1 });
    if (key === 'GET /Users/user1/Items/m1') return json(movie());
    if (key === 'GET /Items/m1/Images/Primary') return route.fulfill({ status: 200, contentType: 'image/png', headers: CORS, body: PNG });
    if (key === 'GET /Videos/m1/stream') return route.fulfill({ status: 200, contentType: 'video/webm', headers: CORS, body: CLIP });
    if (key === 'GET /Videos/m1/ms1/Subtitles/2/Stream.vtt')
      return route.fulfill({ status: 200, contentType: 'text/vtt', headers: CORS, body: 'WEBVTT\n\n00:00.000 --> 00:02.000\nHello\n' });
    if (key.startsWith('POST /Sessions/')) {
      reports.push({ path: url.pathname, body: req.postDataJSON() as Record<string, unknown> });
      return route.fulfill({ status: 204, headers: CORS });
    }
    return route.fulfill({ status: 404, headers: CORS, body: '' });
  });
  return { reports, auth };
}

async function openWatch(page: Page) {
  await page.goto('./?view=play');
  await page.getByRole('tab', { name: /Watch/ }).click();
  await expect(page.getByRole('heading', { name: '📺 Watch' })).toBeVisible();
}

const sourceButton = (page: Page, name: string) => page.locator('button.open', { hasText: name });

async function addSource(page: Page, kind: string, url: string, name: string) {
  await page.getByRole('button', { name: '+ Add a source' }).click();
  await page
    .locator('label.kind')
    .filter({ has: page.locator('strong', { hasText: new RegExp(`^${kind}$`) }) })
    .click();
  await page.getByLabel('Address').fill(url);
  await page.getByLabel(/^Name/).fill(name);
}

test('Jellyfin: sign in, browse, play directly and report progress', async ({ page }) => {
  const server = await mockJellyfin(page);
  const errors = await openApp(page);
  await openWatch(page);
  await addSource(page, 'Jellyfin', `${JELLY}/web/index.html#!/home.html`, 'Home server');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  // wrong password, then the right one
  await page.getByLabel('Username').fill('kid');
  await page.getByLabel('Password').fill('nope');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('.jf .err')).toContainText('Wrong username or password');
  await page.getByLabel('Password').fill('hunter2');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Continue watching' })).toBeVisible();
  expect(server.auth[0]).toMatch(/^MediaBrowser Client="Homework To-Do", Device="Browser", DeviceId="[0-9a-f]{32}", Version="1.0"$/);

  // the token is kept with the other keys, not in the watch list
  const stored = await page.evaluate(() => [localStorage.getItem('homework-todo:watch') ?? '', localStorage.getItem('homework-todo:settings') ?? '']);
  expect(stored[0]).toContain('"url":"https://jelly.example.com"');
  expect(stored[0]).not.toContain('tok_e2e_123456');
  expect(JSON.parse(stored[1]).watchTokens).toContain('tok_e2e_123456');

  // library → movie → play
  await page.locator('.poster', { hasText: 'Movies' }).click();
  await page.locator('.poster', { hasText: 'Big Buck Bunny' }).click();
  await expect(page.locator('.overview')).toHaveText('<img src=x onerror=alert(1)> A bunny.'); // shown as text
  await page.getByRole('button', { name: '▶ Play' }).click();
  const video = page.locator('.vp video');
  await expect(video).toHaveAttribute('src', /^https:\/\/jelly\.example\.com\/Videos\/m1\/stream\?static=true&MediaSourceId=ms1&.*api_key=tok_e2e_123456/);
  await expect(video.locator('track')).toHaveAttribute('src', 'https://jelly.example.com/Videos/m1/ms1/Subtitles/2/Stream.vtt?api_key=tok_e2e_123456&ApiKey=tok_e2e_123456');
  await expect(page.getByText('Direct play')).toBeVisible();
  await expect.poll(() => server.reports.map((r) => r.path)).toContain('/Sessions/Playing');
  expect(server.reports[0].body).toMatchObject({ ItemId: 'm1', MediaSourceId: 'ms1', PlayMethod: 'DirectPlay' });

  // leaving the player reports the stop
  await page.getByRole('button', { name: '← Back' }).click();
  await expect.poll(() => server.reports.map((r) => r.path)).toContain('/Sessions/Playing/Stopped');

  // signed in on the next visit too
  await openWatch(page);
  await sourceButton(page, 'Home server').click();
  await expect(page.getByRole('heading', { name: 'Libraries' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('video links become embeds, direct files use the built-in player', async ({ page }) => {
  await page.route('https://www.youtube-nocookie.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>player</p>' }));
  await page.route('https://media.example.com/**', (r) => r.fulfill({ status: 200, contentType: 'video/webm', body: CLIP }));
  const errors = await openApp(page);
  await openWatch(page);

  await addSource(page, 'Video link', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30', 'Music video');
  await expect(page.getByText('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=30')).toBeVisible();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await sourceButton(page, 'Music video').click();
  const frame = page.locator('.ef iframe');
  await expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=30');
  await expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms allow-presentation');
  await expect(frame).toHaveAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media');
  await expect(page.getByRole('link', { name: /Open in a new tab/ })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30');
  await page.getByRole('button', { name: '← All sources' }).click();

  await addSource(page, 'Video file URL', 'https://media.example.com/clip.webm', 'Clip');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await sourceButton(page, 'Clip').click();
  const video = page.locator('.vp video');
  await expect(video).toHaveAttribute('src', 'https://media.example.com/clip.webm');
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThan(0);
  // keyboard: m mutes
  await page.locator('.vp').focus();
  await page.keyboard.press('m');
  expect(await video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
  // speed is remembered
  await page.getByLabel('Speed').selectOption('1.5');
  expect(await video.evaluate((v: HTMLVideoElement) => v.playbackRate)).toBe(1.5);
  await page.getByRole('button', { name: '← All sources' }).click();
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('homework-todo:watch'))) ?? '{}').speed).toBe(1.5);
  expect(errors).toEqual([]);
});

test('servers the site policy or the browser would block are explained up front', async ({ page }) => {
  const errors = await openApp(page);
  await openWatch(page);
  await addSource(page, 'Jellyfin', 'https://other-jellyfin.example.org:8920', 'Friend server');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText("This site's security policy doesn't include your server yet")).toBeVisible();
  await expect(page.locator('.copy code')).toHaveText('https://other-jellyfin.example.org:8920');
  await expect(page.getByText('VITE_MEDIA_SERVERS').first()).toBeVisible();
  await page.getByRole('button', { name: '← All sources' }).click();

  // (the preview server is http://localhost, so mixed content doesn't apply here: unit-tested; the policy check still does)
  await addSource(page, 'Emby', 'http://192.168.1.5:8096', 'LAN');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText("This site's security policy doesn't include your server yet")).toBeVisible();
  expect(errors).toEqual([]);
});

test('watch time can cost vouchers (Settings → Economy)', async ({ page }) => {
  await page.route('https://media.example.com/**', (r) => r.fulfill({ status: 200, contentType: 'video/webm', body: CLIP }));
  const errors = await openApp(page, { watchVoucherMin: 30 });
  await seedCoins(page, 1, 'vouchers');
  await openWatch(page);
  await expect(page.getByText('Watching costs vouchers here')).toBeVisible();
  await addSource(page, 'Video file URL', 'https://media.example.com/clip.webm', 'Clip');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await sourceButton(page, 'Clip').click();
  await expect(page.locator('.vp video')).toHaveCount(0);
  await page.getByRole('button', { name: 'Spend 1 🎟️ for 30 min' }).click();
  await expect(page.getByText('Rules: 1 🎟️ = 30 min (30 min paid for)')).toBeVisible();
  await sourceButton(page, 'Clip').click();
  await expect(page.locator('.vp video')).toHaveAttribute('src', 'https://media.example.com/clip.webm');
  expect(errors).toEqual([]);
});

test('the Watch tab and its add form have no serious accessibility violations', async ({ page }) => {
  await openApp(page);
  await openWatch(page);
  await page.getByRole('button', { name: '+ Add a source' }).click();
  await page.getByLabel('Address').fill('https://youtu.be/dQw4w9WgXcQ');
  const results = await new AxeBuilder({ page }).include('.watch').withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
});
