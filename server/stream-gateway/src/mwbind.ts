// MW-BIND-v1, the signature MoonlightWeb puts around the DTLS fingerprints (docs/design/pairing-signature.md in
// its repository; written here from that description). The gateway is the "browser" MoonlightWeb paired with: it
// checks the host's signature on each offer and signs the real browser's fingerprint on each answer.
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';

export const PROTOCOL = 'MW-BIND-v1';
export const MIN_NONCE_BYTES = 16;

/** The one sha-256 fingerprint an SDP commits to (upper-case hex pairs joined by ':'), or '' when there isn't exactly one. */
export function extractFingerprint(sdp: string): string {
  let found = '';
  for (const raw of sdp.split(/[\r\n]+/)) {
    const line = raw.trim();
    if (!/^a=fingerprint:/i.test(line)) continue;
    const body = line.slice('a=fingerprint:'.length).trim();
    const sep = body.indexOf(' ');
    if (sep <= 0) return '';
    if (body.slice(0, sep).toLowerCase() !== 'sha-256') return '';
    const bytes = body
      .slice(sep + 1)
      .trim()
      .split(':')
      .filter(Boolean);
    if (bytes.length !== 32 || bytes.some((b) => !/^[0-9a-fA-F]{2}$/.test(b))) return '';
    const value = bytes.map((b) => b.toUpperCase()).join(':');
    if (found && found !== value) return '';
    found = value;
  }
  return found;
}

/** Fields, each preceded by its length as a 4-byte big-endian integer. */
export function framed(fields: (Buffer | string)[]): Buffer {
  return Buffer.concat(
    fields.flatMap((f) => {
      const b = Buffer.isBuffer(f) ? f : Buffer.from(f, 'utf8');
      const len = Buffer.alloc(4);
      len.writeUInt32BE(b.length);
      return [len, b];
    }),
  );
}

export const hostDigest = (hostId: string, keyId: string, nonceB: Buffer, fpH: string) => framed([`${PROTOCOL}|host`, hostId, keyId, nonceB, fpH]);
export const browserDigest = (hostId: string, nonceH: Buffer, fpH: string, fpB: string) => framed([`${PROTOCOL}|browser`, hostId, nonceH, fpH, fpB]);

export function keyIdOf(spkiDer: Buffer): string {
  return createHash('sha256').update(spkiDer).digest('base64url');
}

export function newPairingKey(): string {
  return generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
}

export function spkiOf(privatePem: string): Buffer {
  return createPublicKey(createPrivateKey(privatePem)).export({ type: 'spki', format: 'der' });
}

/** Raw r‖s (64 bytes), the form WebCrypto and MoonlightWeb use on the wire. */
export function signRaw(privatePem: string, message: Buffer): Buffer {
  return sign('sha256', message, { key: createPrivateKey(privatePem), dsaEncoding: 'ieee-p1363' });
}

export function verifyRaw(spkiDer: Buffer, message: Buffer, signature: Buffer): boolean {
  if (signature.length !== 64) return false;
  try {
    const key = createPublicKey({ key: spkiDer, format: 'der', type: 'spki' });
    if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') return false;
    return verify('sha256', message, { key, dsaEncoding: 'ieee-p1363' }, signature);
  } catch {
    return false;
  }
}

/** base64 → bytes, or null when it isn't clean base64. */
export function fromB64(s: unknown): Buffer | null {
  if (typeof s !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return null;
  return Buffer.from(s, 'base64');
}
