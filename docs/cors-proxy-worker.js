// CORS proxy for Schoology, deployable as a Cloudflare Worker (free tier).
// 1. https://dash.cloudflare.com → Workers & Pages → Create → paste this file → Deploy.
// 2. Your prefix is https://<worker-name>.<account>.workers.dev/?url=
// 3. In the app: Schoology → Setup → "CORS proxy prefix".
// It only forwards to *.schoology.com (calendar feeds and the REST API), GET only, and passes
// the OAuth Authorization header through untouched. Keys never leave your browser except to Schoology.

const ALLOWED_HOSTS = /(^|\.)schoology\.com$/i;

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') ?? '*';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Accept, Content-Type, X-Schoology-Authorization',
      'Access-Control-Expose-Headers': 'Content-Type',
      Vary: 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: cors });
    const target = new URL(request.url).searchParams.get('url');
    if (!target) return new Response('Missing ?url=', { status: 400, headers: cors });
    let u;
    try {
      u = new URL(target);
    } catch {
      return new Response('Bad url', { status: 400, headers: cors });
    }
    if (!ALLOWED_HOSTS.test(u.hostname)) return new Response('Only schoology.com is allowed', { status: 403, headers: cors });
    const isApi = u.hostname === 'api.schoology.com';
    const isFeed = /ical|\.ics$/i.test(u.pathname);
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
