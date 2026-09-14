// Minimal CORS proxy for the Schoology iCal feed, deployable as a Cloudflare Worker (free tier).
// 1. Create a Worker at https://dash.cloudflare.com → Workers & Pages → Create → paste this file.
// 2. Deploy. Your prefix is: https://<worker-name>.<account>.workers.dev/?url=
// 3. In the app: Schoology → Setup → "CORS proxy prefix".
// It only proxies *.schoology.com calendar feeds and only responds to GET, so it cannot be abused for other sites.

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') ?? '*';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Vary': 'Origin',
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
    if (!/(^|\.)schoology\.com$/i.test(u.hostname) || !/ical|\.ics$/i.test(u.pathname)) {
      return new Response('Only Schoology calendar feeds are allowed', { status: 403, headers: cors });
    }
    const upstream = await fetch(u.toString(), { headers: { 'User-Agent': 'homework-todo-sync' } });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  },
};
