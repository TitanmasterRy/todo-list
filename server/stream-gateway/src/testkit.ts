// Shared test fixtures: a fake MoonlightWeb host key and SDPs with known fingerprints.
import { randomBytes } from 'node:crypto';
import { keyIdOf, newPairingKey, spkiOf } from './mwbind.js';

export const fp = (byte: string) => Array.from({ length: 32 }, () => byte).join(':');

export function sdp(fingerprint: string, extra = ''): string {
  return ['v=0', 'o=- 1 1 IN IP4 0.0.0.0', 's=-', 't=0 0', 'm=video 9 UDP/TLS/RTP/SAVPF 96', `a=fingerprint:sha-256 ${fingerprint}`, extra].filter(Boolean).join('\r\n') + '\r\n';
}

export function hostIdentity() {
  const key = newPairingKey();
  const spki = spkiOf(key);
  return { key, spki, hostId: keyIdOf(spki) };
}

export const nonce = () => randomBytes(32);
