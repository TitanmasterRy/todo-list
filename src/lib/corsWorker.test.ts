import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// The Schoology relay (a Cloudflare Worker) lives in docs/ so people can paste it into the dashboard.
import worker, { resetBuckets, takeToken } from '../../docs/cors-proxy-worker.js';

const FEED = 'https://myschool.schoology.com/calendar/feed/ical/123/abc/ical.ics';
const req = (origin: string | null, target = FEED, ip = '1.2.3.4', method = 'GET') =>
  new Request(`https://relay.example.workers.dev/?url=${encodeURIComponent(target)}`, {
    method,
    headers: { ...(origin ? { Origin: origin } : {}), 'CF-Connecting-IP': ip },
  });

describe('CORS relay worker', () => {
  beforeEach(() => {
    resetBuckets();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('BEGIN:VCALENDAR\nEND:VCALENDAR', { headers: { 'Content-Type': 'text/calendar' } })),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('forwards calendar feeds for any site when ALLOWED_ORIGINS is unset', async () => {
    const res = await worker.fetch(req('https://anyone.example'), {});
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://anyone.example');
    expect(await res.text()).toContain('VCALENDAR');
  });

  it('only serves the listed origins once locked', async () => {
    const env = { ALLOWED_ORIGINS: 'https://my-homework.vercel.app, https://localhost:5173/' };
    expect((await worker.fetch(req('https://evil.example'), env)).status).toBe(403);
    expect((await worker.fetch(req(null), env)).status).toBe(403);
    expect((await worker.fetch(req('https://localhost:5173'), env)).status).toBe(200);
    const ok = await worker.fetch(req('https://my-homework.vercel.app'), env);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('https://my-homework.vercel.app');
    // preflight from a stranger is refused too
    expect((await worker.fetch(req('https://evil.example', FEED, '1.2.3.4', 'OPTIONS'), env)).status).toBe(403);
  });

  it('still only forwards to schoology.com over https', async () => {
    expect((await worker.fetch(req('https://a.example', 'https://evil.example/x.ics'), {})).status).toBe(403);
    expect((await worker.fetch(req('https://a.example', 'http://myschool.schoology.com/x.ics'), {})).status).toBe(403);
    expect((await worker.fetch(req('https://a.example', 'https://app.schoology.com/home'), {})).status).toBe(403);
  });

  it("forwards Canvas calendar feeds, including a school's own domain when listed", async () => {
    const canvas = 'https://myschool.instructure.com/feeds/calendars/user_AbC123.ics';
    expect((await worker.fetch(req('https://a.example', canvas), {})).status).toBe(200);
    // only the feed path, nothing else on Canvas
    expect((await worker.fetch(req('https://a.example', 'https://myschool.instructure.com/api/v1/courses'), {})).status).toBe(403);
    const own = 'https://canvas.myschool.edu/feeds/calendars/user_AbC123.ics';
    expect((await worker.fetch(req('https://a.example', own), {})).status).toBe(403);
    expect((await worker.fetch(req('https://a.example', own), { EXTRA_FEED_HOSTS: 'canvas.myschool.edu' })).status).toBe(200);
  });

  it('rate-limits each IP', async () => {
    const env = { RATE_LIMIT_PER_MIN: '3' };
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await worker.fetch(req('https://a.example'), env)).status);
    expect(codes).toEqual([200, 200, 200, 429, 429]);
    // another visitor has their own bucket
    expect((await worker.fetch(req('https://a.example', FEED, '5.6.7.8'), env)).status).toBe(200);
    const limited = await worker.fetch(req('https://a.example'), env);
    expect(limited.headers.get('Retry-After')).toBe('60');
  });

  it('refills over time and can be switched off', () => {
    expect(takeToken('x', 2, 0)).toBe(true);
    expect(takeToken('x', 2, 0)).toBe(true);
    expect(takeToken('x', 2, 0)).toBe(false);
    expect(takeToken('x', 2, 30_000)).toBe(true); // half a minute = one token back
    expect(takeToken('y', 0, 0)).toBe(true);
  });

  it('uses the Cloudflare rate-limiting binding when configured', async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const res = await worker.fetch(req('https://a.example'), { RATE_LIMITER: { limit } });
    expect(res.status).toBe(429);
    expect(limit).toHaveBeenCalledWith({ key: '1.2.3.4' });
  });
});
