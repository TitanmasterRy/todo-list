import { describe, expect, it } from 'vitest';
import { dueToTask, oauthHeader, proxied, stripHtml } from './schoologyApi';

describe('schoology api helpers', () => {
  it('builds a stable OAuth 1.0a header', async () => {
    const h = await oauthHeader('GET', 'https://api.schoology.com/v1/users/me?limit=5', 'key123', 'sec456', { timestamp: 1700000000, nonce: 'abc' });
    expect(h.startsWith('OAuth ')).toBe(true);
    expect(h).toContain('oauth_consumer_key="key123"');
    expect(h).toContain('oauth_signature_method="HMAC-SHA1"');
    expect(h).toContain('oauth_timestamp="1700000000"');
    expect(h).toContain('oauth_token=""');
    const sig = /oauth_signature="([^"]+)"/.exec(h)?.[1];
    expect(sig).toBeTruthy();
    // deterministic for the same inputs
    const h2 = await oauthHeader('GET', 'https://api.schoology.com/v1/users/me?limit=5', 'key123', 'sec456', { timestamp: 1700000000, nonce: 'abc' });
    expect(h2).toBe(h);
    // different query -> different signature
    const h3 = await oauthHeader('GET', 'https://api.schoology.com/v1/users/me?limit=6', 'key123', 'sec456', { timestamp: 1700000000, nonce: 'abc' });
    expect(h3).not.toBe(h);
  });
  it('maps due strings', () => {
    expect(dueToTask('2026-09-21 23:59:00')).toBe('2026-09-21');
    expect(dueToTask('2026-09-21')).toBe('2026-09-21');
    expect(new Date(dueToTask('2026-09-21 14:30:00')!).getHours()).toBe(14);
    expect(dueToTask('')).toBeUndefined();
  });
  it('strips html', () => {
    expect(stripHtml('<p>Read <b>ch 4</b></p><ul><li>a</li><li>b</li></ul>&amp;')).toBe('Read ch 4\n\n- a- b&');
  });
  it('proxies urls', () => {
    expect(proxied('https://w.dev/?url=', 'https://api.schoology.com/v1/x?y=1')).toBe('https://w.dev/?url=https%3A%2F%2Fapi.schoology.com%2Fv1%2Fx%3Fy%3D1');
    expect(proxied('https://w.dev/{url}', 'https://a.b')).toBe('https://w.dev/https%3A%2F%2Fa.b');
    expect(proxied('', 'https://a.b')).toBe('https://a.b');
  });
});
