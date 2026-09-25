import { describe, expect, it } from 'vitest';
import { buildCsp, connectSources, hostAllowed, originOf } from './csp';
import { PROVIDERS } from './ai-providers';
import { PYODIDE_URL } from './coderunner';

const directive = (csp: string, name: string) =>
  csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `))
    ?.split(' ')
    .slice(1) ?? [];

describe('content security policy', () => {
  const csp = buildCsp();

  it('allows no inline script and no plugins', () => {
    expect(directive(csp, 'script-src')).not.toContain("'unsafe-inline'");
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(directive(csp, 'base-uri')).toEqual(["'self'"]);
    expect(csp).not.toMatch(/[<>"]/); // safe inside the meta attribute
  });

  it('lets every built-in AI provider, sync service and lookup through', () => {
    const connect = directive(csp, 'connect-src');
    for (const p of PROVIDERS) if (p.baseUrl) expect(hostAllowed(originOf(p.baseUrl)!, connect), p.id).toBe(true);
    for (const url of [
      'https://api.github.com',
      'https://gist.githubusercontent.com',
      'https://www.googleapis.com',
      'https://gmail.googleapis.com',
      'https://classroom.googleapis.com',
      'https://abcd.supabase.co',
      'https://myschool.schoology.com',
      'https://api.schoology.com',
      'https://my-relay.someone.workers.dev',
      'https://api.spotify.com',
      'https://accounts.spotify.com',
      'https://api.crossref.org',
      'https://openlibrary.org',
      originOf(PYODIDE_URL)!,
      'http://localhost:1234',
    ])
      expect(hostAllowed(url, connect), url).toBe(true);
    expect(hostAllowed('https://evil.example', connect)).toBe(false);
    expect(hostAllowed('https://supabase.co.evil.example', connect)).toBe(false);
    expect(hostAllowed('http://api.github.com', connect)).toBe(false);
  });

  it('adds build-time origins: a self-hosted Supabase, an arcade manifest host, extras', () => {
    const list = connectSources({
      supabaseUrl: 'https://db.myschool.org/',
      arcadeManifest: 'https://games.example.com/games.json',
      extraConnect: 'https://llm.example.net, https://x.y;bad',
    });
    expect(list).toContain('https://db.myschool.org');
    expect(list).toContain('https://games.example.com');
    expect(list).toContain('https://llm.example.net');
    expect(list.join(' ')).not.toContain('bad');
    // a *.supabase.co project is already covered by the wildcard
    expect(connectSources({ supabaseUrl: 'https://abcd.supabase.co' })).not.toContain('https://abcd.supabase.co');
  });

  it('matches hosts, wildcards and ports like CSP does', () => {
    expect(hostAllowed('https://a.b.workers.dev', ['https://*.workers.dev'])).toBe(true);
    expect(hostAllowed('https://workers.dev', ['https://*.workers.dev'])).toBe(false);
    expect(hostAllowed('http://localhost:11434', ['http://localhost:*'])).toBe(true);
    expect(hostAllowed('https://x.com:8443', ['https://x.com'])).toBe(false);
    expect(originOf('ftp://x')).toBeNull();
    expect(originOf('not a url')).toBeNull();
  });
});
