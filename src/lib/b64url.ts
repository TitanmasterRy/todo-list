// base64url (RFC 4648 §5, no padding) of UTF-8 text for codes that travel in links (study rooms, friend cards),
// and small helpers for the untrusted text that arrives in them.

export function toB64url(text: string): string {
  let bin = '';
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode base64url to text; null when it isn't valid base64url or valid UTF-8. */
export function fromB64url(code: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(code) || code.length % 4 === 1) return null;
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

/** Parse base64url JSON, or null. */
export function decodeJson(code: string, maxLen = 4096): unknown {
  if (!code || code.length > maxLen) return null;
  const text = fromB64url(code);
  if (text === null) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** A random id of `n` characters from [a-z0-9] (crypto.getRandomValues). */
export function randomId(n = 12): string {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
}

/** Pull `key=value` out of a pasted link (hash or query) or return the input when it's already a bare code. */
export function paramFrom(input: string, key: string): string {
  const s = input.trim();
  const m = new RegExp(`[#?&]${key}=([^&#\\s]+)`).exec(s);
  if (!m) return s;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

/** Remove control and bidi-override characters (keeping newlines and tabs when `multiline`), trim and cut to `max` characters. */
export function cleanText(v: unknown, max: number, multiline = false): string {
  if (typeof v !== 'string') return '';
  const out = v
    .replace(/\r\n?/g, '\n')
    .replace(/[\u202a-\u202e\u2066-\u2069]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g : /[\u0000-\u001f\u007f]+/g, multiline ? '' : ' ')
    .trim();
  return Array.from(out).slice(0, max).join('').trim();
}
