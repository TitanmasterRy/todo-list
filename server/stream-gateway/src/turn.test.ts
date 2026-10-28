import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { TURN_TTL, iceServers, turnCredentials } from './turn.js';

describe('TURN REST credentials', () => {
  it('follow the coturn use-auth-secret scheme', () => {
    const c = turnCredentials('s3cret', 'turn.example.org', 1_700_000_000, 600, 'abcd');
    expect(c.username).toBe('1700000600:abcd');
    expect(c.credential).toBe(createHmac('sha1', 's3cret').update('1700000600:abcd').digest('base64'));
    // a fixed vector (from openssl dgst -sha1 -hmac), so the scheme can't drift along with the test's own HMAC call
    expect(turnCredentials('secret', 'h', 0, 600, 'x').credential).toBe('O9jHxwNaDimAGxx9hMY+UPi3FhY=');
    expect(c.ttl).toBe(600);
  });

  it('never live longer than ten minutes', () => {
    expect(turnCredentials('s', 'h', 0, 86400).ttl).toBe(TURN_TTL);
    expect(turnCredentials('s', 'h', 0, 86400).username).toMatch(/^600:[0-9a-f]{16}$/);
    expect(turnCredentials('s', 'h', 0, 1).ttl).toBe(60);
  });

  it('list UDP, TCP and TLS on the documented ports', () => {
    const c = turnCredentials('s', 'turn.levitica.duckdns.org', 0);
    expect(c.urls).toEqual([
      'turn:turn.levitica.duckdns.org:3478?transport=udp',
      'turn:turn.levitica.duckdns.org:3478?transport=tcp',
      'turns:turn.levitica.duckdns.org:5349?transport=tcp',
    ]);
    expect(iceServers(c)).toEqual([{ urls: c.urls, username: c.username, credential: c.credential }]);
  });
});
