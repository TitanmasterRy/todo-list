// The Content-Security-Policy the production build puts in index.html (see the csp plugin in vite.config.ts).
// Every host the app talks to is listed here, grouped by feature; grep for a new fetch() / iframe / script
// origin and add it here in the same change. Pure so it can be unit-tested and reused by the build.

/** Hosts reached with fetch() / XHR, by feature. */
export const CONNECT_HOSTS: Record<string, string[]> = {
  // AI providers (keys go only to the one picked); Ollama / LM Studio run on this computer
  ai: [
    'https://api.anthropic.com',
    'https://generativelanguage.googleapis.com',
    'https://api.groq.com',
    'https://openrouter.ai',
    'https://api.openai.com',
    'http://localhost:*',
    'http://127.0.0.1:*',
  ],
  // accounts: the project URL is set per site (or per user), so any Supabase project
  accounts: ['https://*.supabase.co'],
  gist: ['https://api.github.com', 'https://gist.githubusercontent.com'],
  // Gmail, Calendar, Classroom, Drive app data, userinfo; Google Identity Services
  google: ['https://www.googleapis.com', 'https://gmail.googleapis.com', 'https://classroom.googleapis.com', 'https://accounts.google.com'],
  // calendar feeds and the REST API, directly or through the user's Cloudflare Worker relay
  schoology: ['https://*.schoology.com', 'https://*.workers.dev'],
  spotify: ['https://accounts.spotify.com', 'https://api.spotify.com'],
  // citation lookups: DOI and ISBN
  citations: ['https://api.crossref.org', 'https://openlibrary.org'],
  // Python (Pyodide) and OCR (Tesseract) download their engines and data on first use
  cdn: ['https://cdn.jsdelivr.net'],
};

export interface CspOptions {
  /** VITE_SUPABASE_URL: added when it isn't a *.supabase.co project (self-hosted). */
  supabaseUrl?: string;
  /** VITE_ARCADE_MANIFEST: a games.json hosted elsewhere. */
  arcadeManifest?: string;
  /** VITE_CSP_CONNECT: extra origins (a relay or custom AI endpoint on another host), space or comma separated. */
  extraConnect?: string;
}

/** scheme://host[:port] of a URL, or null. */
export function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin : null;
  } catch {
    return null;
  }
}

/** Is `origin` allowed by a connect-src host source list? (Enough of CSP matching for the checks in the UI.) */
export function hostAllowed(origin: string, sources: string[]): boolean {
  let u: URL;
  try {
    u = new URL(origin);
  } catch {
    return false;
  }
  return sources.some((src) => {
    const m = /^(https?):\/\/(\*\.)?([^:/]+)(?::(\*|\d+))?$/.exec(src);
    if (!m) return false;
    const [, scheme, wild, host, port] = m;
    if (u.protocol !== `${scheme}:`) return false;
    const hostOk = wild ? u.hostname.endsWith(`.${host}`) : u.hostname === host;
    const portOk = port === '*' || (port ? u.port === port : u.port === '');
    return hostOk && portOk;
  });
}

export function connectSources(o: CspOptions = {}): string[] {
  const extra = [o.supabaseUrl, o.arcadeManifest].map(originOf).filter((x): x is string => !!x);
  const listed = (o.extraConnect ?? '').split(/[\s,]+/).filter((s) => /^(https?|wss?):\/\/[^\s;,']+$/.test(s));
  const all = [...Object.values(CONNECT_HOSTS).flat(), ...listed];
  for (const e of extra) if (!hostAllowed(e, all)) all.push(e);
  return Array.from(new Set(all));
}

export function buildCsp(o: CspOptions = {}): string {
  const directives: [string, string[]][] = [
    ['default-src', ["'self'"]],
    // No 'unsafe-inline': injected markup can't run script. 'unsafe-eval' is for the Code tool's JavaScript runner
    // (its blob: worker inherits this policy) and Pyodide; 'wasm-unsafe-eval' for Pyodide, Tesseract and sql.js.
    ['script-src', ["'self'", "'wasm-unsafe-eval'", "'unsafe-eval'", 'https://cdn.jsdelivr.net', 'https://accounts.google.com/gsi/client']],
    // Svelte writes style attributes; Google sign-in has its own stylesheet
    ['style-src', ["'self'", "'unsafe-inline'", 'https://accounts.google.com/gsi/style']],
    // album art, book covers, notecard pictures (data:), attachment previews (blob:)
    ['img-src', ["'self'", 'data:', 'blob:', 'https:']],
    ['font-src', ["'self'", 'data:']],
    ['media-src', ["'self'", 'data:', 'blob:']],
    ['connect-src', ["'self'", ...connectSources(o)]],
    // arcade games (sandbox.html, public/games/, embed links on any https site), music embeds, Google sign-in
    ['frame-src', ["'self'", 'blob:', 'data:', 'https:']],
    ['worker-src', ["'self'", 'blob:']],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
  ];
  return directives.map(([k, v]) => `${k} ${v.join(' ')}`).join('; ');
}

/**
 * When a request to `url` fails, explain it if this page's policy doesn't list the host (a custom AI endpoint
 * or relay on a host the build doesn't know about). Returns '' when the policy isn't the reason.
 */
export function cspHint(url: string): string {
  if (typeof document === 'undefined') return '';
  const policy = document.querySelector<HTMLMetaElement>('meta[http-equiv="Content-Security-Policy"]')?.content ?? '';
  const connect = /(?:^|;)\s*connect-src ([^;]*)/.exec(policy)?.[1].trim().split(/\s+/);
  const origin = originOf(url);
  if (!connect || !origin || origin === location.origin || hostAllowed(origin, connect)) return '';
  return ` This site's security policy doesn't allow ${origin}. The site admin can add it with VITE_CSP_CONNECT (see DEPLOY.md).`;
}
