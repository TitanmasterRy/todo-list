// TURN REST API credentials (coturn `use-auth-secret`): username "<expiry>:<id>", credential base64(HMAC-SHA1).
import { createHmac, randomBytes } from 'node:crypto';

export const TURN_TTL = 600;

export interface TurnCredentials {
  username: string;
  credential: string;
  ttl: number;
  urls: string[];
}

export function turnUrls(host: string): string[] {
  return [`turn:${host}:3478?transport=udp`, `turn:${host}:3478?transport=tcp`, `turns:${host}:5349?transport=tcp`];
}

export function turnCredentials(secret: string, host: string, nowSec: number, ttl = TURN_TTL, id = randomBytes(8).toString('hex')): TurnCredentials {
  const life = Math.max(60, Math.min(ttl, TURN_TTL));
  const username = `${nowSec + life}:${id}`;
  return { username, credential: createHmac('sha1', secret).update(username).digest('base64'), ttl: life, urls: turnUrls(host) };
}

/** The same credentials as an RTCPeerConnection `iceServers` list. */
export function iceServers(c: TurnCredentials): { urls: string[]; username: string; credential: string }[] {
  return [{ urls: c.urls, username: c.username, credential: c.credential }];
}
