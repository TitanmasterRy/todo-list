import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const FULL = {
  GATEWAY_PASSWORD_HASH: '$argon2id$v=19$m=65536,t=3,p=1$c2FsdA$aGFzaA',
  GATEWAY_SIGNING_KEY: 'k'.repeat(40),
  TURN_SECRET: 't',
  MW_URL: 'https://10.250.50.10:8443',
  MW_CERT_SHA256: 'ab:'.repeat(31) + 'ab',
};

describe('loadConfig', () => {
  it('reads the deploy contract with its defaults', () => {
    const { config, missing } = loadConfig(FULL);
    expect(missing).toEqual([]);
    expect(config).toMatchObject({
      port: 8080,
      dataDir: '/data',
      turnHost: 'turn.levitica.duckdns.org',
      allowedOrigin: 'https://titanmasterry.github.io',
      mwHostId: '',
      mwCertSha256: 'AB'.repeat(32),
    });
    expect(config.mwUrl?.host).toBe('10.250.50.10:8443');
  });

  it('names what is missing or wrong without echoing values', () => {
    const { missing } = loadConfig({ ...FULL, GATEWAY_PASSWORD_HASH: 'plaintext', GATEWAY_SIGNING_KEY: 'short', MW_URL: 'http://x', MW_CERT_SHA256: 'nope', TURN_SECRET: '' });
    expect(missing).toEqual([
      'GATEWAY_PASSWORD_HASH (not an argon2id hash)',
      'GATEWAY_SIGNING_KEY (at least 32 characters)',
      'TURN_SECRET',
      'MW_URL (an https:// URL)',
      'MW_CERT_SHA256 (a SHA-256 fingerprint)',
    ]);
    expect(missing.join()).not.toContain('plaintext');
  });
});
