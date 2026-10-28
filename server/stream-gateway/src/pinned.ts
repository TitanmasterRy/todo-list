// A TLS connection to MoonlightWeb that is only handed on once its certificate matches the pinned SHA-256. MW's
// certificate is self-signed, so chain checking can't be used; the pin replaces it. Nothing (no cookie, no HTTP
// request line) is written to the socket before the check, because the caller only gets it afterwards.
import { connect, type TLSSocket } from 'node:tls';
import { isIP } from 'node:net';
import { timingSafeEqual } from 'node:crypto';
import { normalizeFingerprint } from './config.js';

export class PinError extends Error {}

export function connectPinned(url: URL, pin: string, timeoutMs = 10_000): Promise<TLSSocket> {
  return new Promise((resolve, reject) => {
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const sock = connect({
      host,
      port: Number(url.port) || 443,
      servername: isIP(host) ? undefined : host,
      rejectUnauthorized: false,
      ALPNProtocols: ['http/1.1'],
    });
    const timer = setTimeout(() => {
      sock.destroy();
      reject(new Error('MoonlightWeb did not answer in time'));
    }, timeoutMs);
    sock.once('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    sock.once('secureConnect', () => {
      clearTimeout(timer);
      const got = Buffer.from(normalizeFingerprint(sock.getPeerCertificate()?.fingerprint256 ?? ''), 'utf8');
      const want = Buffer.from(pin, 'utf8');
      if (want.length !== 64 || got.length !== want.length || !timingSafeEqual(got, want)) {
        sock.destroy();
        reject(new PinError("MoonlightWeb's certificate does not match MW_CERT_SHA256"));
        return;
      }
      resolve(sock);
    });
  });
}
