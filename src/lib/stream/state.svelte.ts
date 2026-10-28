// Play → Stream state: the gateway address (VITE_STREAM_SERVER), the sign-in (the refresh token is a secret slot,
// so "Lock my keys" covers it; the access token never leaves memory) and the stream settings (this device only).
// Loaded only with the Stream tab.
import { forgetSecret, hasSecret, isLocked, requestUnlock, secret, setSecrets, useSecret } from '../secrets.svelte';
import { GatewayClient } from './api';
import { PREFS_KEY, parsePrefs, type StreamPrefs } from './display';

export const STREAM_SERVER = (import.meta.env.VITE_STREAM_SERVER || 'https://play.levitica.duckdns.org').replace(/\/+$/, '');

/** Kept for this session only when the key lock is on and the passphrase wasn't given. */
let sessionToken = '';

async function saveRefreshToken(token: string): Promise<void> {
  if (!token) {
    sessionToken = '';
    forgetSecret('streamToken');
    return;
  }
  if (isLocked('streamToken') && !(await requestUnlock('Enter your passphrase to save your stream sign-in.'))) {
    sessionToken = token;
    return;
  }
  sessionToken = '';
  setSecrets({ streamToken: token });
}

/** A gateway client with the saved sign-in (asks for the key-lock passphrase when needed). */
export async function gatewayClient(): Promise<GatewayClient> {
  const refreshToken = sessionToken || (hasSecret('streamToken') ? await useSecret('streamToken', { reason: 'Enter your passphrase to use your stream sign-in.' }) : '');
  return new GatewayClient({ server: STREAM_SERVER, refreshToken, onRefreshToken: (t) => void saveRefreshToken(t) });
}

export const signedInHere = () => !!sessionToken || !!secret('streamToken') || hasSecret('streamToken');

class StreamSettings {
  prefs = $state<StreamPrefs>(
    (() => {
      try {
        return parsePrefs(localStorage.getItem(PREFS_KEY));
      } catch {
        return parsePrefs(null);
      }
    })(),
  );

  update(patch: Partial<StreamPrefs>): void {
    this.prefs = parsePrefs(JSON.stringify({ ...this.prefs, ...patch }));
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
    } catch {
      /* private mode: this session only */
    }
  }
}

export const streamSettings = new StreamSettings();
