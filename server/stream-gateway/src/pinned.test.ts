import { execFileSync } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type Server } from 'node:tls';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { normalizeFingerprint } from './config.js';
import { PinError, connectPinned } from './pinned.js';

let server: Server;
let url: URL;
let pin = '';
const received: string[] = [];

beforeAll(async () => {
  // a throwaway self-signed certificate, like MoonlightWeb's
  const dir = mkdtempSync(join(tmpdir(), 'pin-'));
  execFileSync(
    'openssl',
    ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes', '-keyout', join(dir, 'k.pem'), '-out', join(dir, 'c.pem'), '-days', '1', '-subj', '/CN=mw'],
    { stdio: 'ignore' },
  );
  const cert = readFileSync(join(dir, 'c.pem'));
  pin = normalizeFingerprint(new X509Certificate(cert).fingerprint256);
  server = createServer({ key: readFileSync(join(dir, 'k.pem')), cert }, (s) => s.on('data', (d) => received.push(d.toString())));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  url = new URL(`https://127.0.0.1:${(server.address() as { port: number }).port}`);
});

afterAll(() => server.close());

describe('connectPinned', () => {
  it('hands over a socket when the certificate matches the pin', async () => {
    const s = await connectPinned(url, pin);
    expect(s.authorized).toBe(false); // self-signed: the pin is the check
    s.end();
  });

  it('refuses another certificate before anything is sent', async () => {
    received.length = 0;
    const wrong = pin.replace(/^./, pin[0] === 'A' ? 'B' : 'A');
    await expect(connectPinned(url, wrong)).rejects.toBeInstanceOf(PinError);
    await new Promise((r) => setTimeout(r, 50));
    expect(received).toEqual([]);
  });

  it('normalizes fingerprints written either way', () => {
    const colons = pin.match(/../g)!.join(':').toLowerCase();
    expect(normalizeFingerprint(colons)).toBe(pin);
    expect(normalizeFingerprint(`sha256 Fingerprint=${colons}`)).toBe(pin);
    expect(normalizeFingerprint('abc')).toBe('');
  });
});
