// CORS proxy for Schoology (and Canvas calendar feeds), deployable as a Cloudflare Worker (free tier).
// 1. https://dash.cloudflare.com → Workers & Pages → Create → paste this file → Deploy.
// 2. Your prefix is https://<worker-name>.<account>.workers.dev/?url=
// 3. In the app: Schoology → Setup → "CORS proxy prefix".
// It only forwards to *.schoology.com (calendar feeds and the REST API) and Canvas calendar feeds (*.instructure.com,
// plus any hosts in EXTRA_FEED_HOSTS for schools on their own domain), GET only, and passes
// the OAuth Authorization header through untouched. Keys never leave your browser except to Schoology.
//
// Locking it down (Settings → Variables and Secrets on the Worker; see DEPLOY.md):
//   ALLOWED_ORIGINS    comma-separated sites allowed to use the relay, e.g. "https://my-homework.vercel.app".
//                      Other sites get 403. Unset means any site (fine for trying it out, not for sharing the URL).
//   RATE_LIMIT_PER_MIN requests per minute per visitor IP (default 60; 0 turns the limit off).
//   EXTRA_FEED_HOSTS   comma-separated extra hosts allowed for calendar feeds only, e.g. "canvas.myschool.edu".
//   RATE_LIMITER       optional Cloudflare rate-limiting binding (wrangler.toml [[ratelimits]], see DEPLOY.md);
//                      when present it's used instead of the built-in per-isolate limiter.

const ALLOWED_HOSTS = /(^|\.)schoology\.com$/i;
const CANVAS_HOSTS = /(^|\.)instructure\.com$/i;

/** Hosts allowed for calendar feeds only (Canvas on a school's own domain). */
export function extraFeedHosts(env) {
  return String(env?.EXTRA_FEED_HOSTS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
const DEFAULT_PER_MIN = 60;

// In-memory token buckets, one per IP. Each Worker isolate keeps its own, so this is a per-location cap rather
// than an exact global one; the RATE_LIMITER binding is exact. Old entries are pruned as the map grows.
const buckets = new Map();

export function allowedOrigins(env) {
  return String(env?.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

/** Take one token for `key`; false when the bucket is empty. Refills continuously at perMin per minute. */
export function takeToken(key, perMin, now = Date.now()) {
  if (!(perMin > 0)) return true;
  let b = buckets.get(key);
  if (!b) {
    if (buckets.size > 5000) for (const [k, v] of buckets) if (now - v.at > 120_000) buckets.delete(k);
    b = { tokens: perMin, at: now };
    buckets.set(key, b);
  }
  b.tokens = Math.min(perMin, b.tokens + ((now - b.at) / 60_000) * perMin);
  b.at = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

export function resetBuckets() {
  buckets.clear();
}

async function rateLimited(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ?? 'unknown';
  if (env?.RATE_LIMITER && typeof env.RATE_LIMITER.limit === 'function') {
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    return !success;
  }
  const perMin = env?.RATE_LIMIT_PER_MIN === undefined || env.RATE_LIMIT_PER_MIN === '' ? DEFAULT_PER_MIN : Number(env.RATE_LIMIT_PER_MIN);
  return !takeToken(ip, perMin);
}

export default {
  async fetch(request, env) {
    const allowed = allowedOrigins(env);
    const requestOrigin = request.headers.get('Origin');
    // Locked to your own site(s): browsers always send Origin on these cross-site requests.
    if (allowed.length && (!requestOrigin || !allowed.includes(requestOrigin))) {
      return new Response('This relay only serves its own site', { status: 403, headers: { Vary: 'Origin' } });
    }
    const origin = requestOrigin ?? '*';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Accept, Content-Type, X-Schoology-Authorization',
      'Access-Control-Expose-Headers': 'Content-Type',
      Vary: 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: cors });
    if (await rateLimited(request, env)) return new Response('Too many requests. Wait a minute and try again.', { status: 429, headers: { ...cors, 'Retry-After': '60' } });
    const target = new URL(request.url).searchParams.get('url');
    if (!target) return new Response('Missing ?url=', { status: 400, headers: cors });
    let u;
    try {
      u = new URL(target);
    } catch {
      return new Response('Bad url', { status: 400, headers: cors });
    }
    const schoology = ALLOWED_HOSTS.test(u.hostname);
    const canvas = CANVAS_HOSTS.test(u.hostname) || extraFeedHosts(env).includes(u.hostname.toLowerCase());
    if (u.protocol !== 'https:' || (!schoology && !canvas)) return new Response('Only schoology.com and Canvas calendar feeds are allowed', { status: 403, headers: cors });
    const isApi = u.hostname === 'api.schoology.com';
    const isFeed = schoology ? /ical|\.ics$/i.test(u.pathname) : /^\/feeds\/calendars\/[\w.-]+\.ics$/i.test(u.pathname);
    if (!isApi && !isFeed) return new Response('Only calendar feeds and the API are allowed', { status: 403, headers: cors });
    const headers = { 'User-Agent': 'homework-todo-sync', Accept: isApi ? 'application/json' : 'text/calendar' };
    const auth = request.headers.get('X-Schoology-Authorization') ?? request.headers.get('Authorization');
    if (isApi && auth) headers['Authorization'] = auth;
    const upstream = await fetch(u.toString(), { headers });
    const out = new Headers(cors);
    out.set('Content-Type', upstream.headers.get('Content-Type') ?? (isApi ? 'application/json' : 'text/calendar; charset=utf-8'));
    out.set('Cache-Control', 'no-store');
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};
