// Passphrase encryption with WebCrypto: PBKDF2-SHA-256 (random 16-byte salt) derives an AES-256-GCM key;
// every message gets a fresh 12-byte IV. GCM authenticates, so a wrong passphrase (or a tampered copy)
// fails to decrypt instead of producing garbage. Used for the key vault (secrets.svelte.ts) and for the
// end-to-end encrypted sync copy (syncCrypto.ts). Pure functions; runs in browsers and in Node 20+.

/** OWASP's current recommendation for PBKDF2-HMAC-SHA256 (the floor this app accepts is 310,000). */
export const PBKDF2_ITERATIONS = 600_000;
export const MIN_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

/** Thrown when a passphrase doesn't open the data (GCM authentication failed). */
export class WrongPassphraseError extends Error {
  constructor(message = 'That passphrase is not right.') {
    super(message);
    this.name = 'WrongPassphraseError';
  }
}

/** One encrypted string: base64 IV and base64 ciphertext (with the GCM tag). */
export interface Sealed {
  iv: string;
  data: string;
}

/** The self-describing wrapper stored in place of plain JSON (sync copies and encrypted backups). */
export interface EncryptedEnvelope extends Sealed {
  hwtodoEncrypted: 1;
  kdf: 'PBKDF2-SHA256';
  iter: number;
  cipher: 'AES-GCM';
  salt: string;
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('This browser has no WebCrypto (it needs a secure https:// page).');
  return s;
}

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

export function newSalt(): Uint8Array<ArrayBuffer> {
  return randomBytes(SALT_BYTES);
}

// Chunked so a multi-megabyte bundle doesn't overflow the argument list of String.fromCharCode.
export function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Derive a non-extractable AES-GCM key from a passphrase. */
export async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  if (!passphrase) throw new Error('Enter a passphrase.');
  if (iterations < MIN_ITERATIONS) throw new Error('Refusing a weak key-derivation setting.');
  const base = await subtle().importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptString(key: CryptoKey, plaintext: string): Promise<Sealed> {
  const iv = randomBytes(IV_BYTES);
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  return { iv: toBase64(iv), data: toBase64(new Uint8Array(ct)) };
}

/** Decrypt; throws WrongPassphraseError when the key doesn't match (or the data was changed). */
export async function decryptString(key: CryptoKey, sealed: Sealed): Promise<string> {
  let pt: ArrayBuffer;
  try {
    pt = await subtle().decrypt({ name: 'AES-GCM', iv: fromBase64(sealed.iv) }, key, fromBase64(sealed.data));
  } catch {
    throw new WrongPassphraseError();
  }
  return new TextDecoder().decode(pt);
}

/** True for anything shaped like an encrypted envelope (checked before parsing a bundle). */
export function isEncryptedEnvelope(x: unknown): x is EncryptedEnvelope {
  if (!x || typeof x !== 'object') return false;
  const e = x as Partial<EncryptedEnvelope>;
  return e.hwtodoEncrypted === 1 && typeof e.salt === 'string' && typeof e.iv === 'string' && typeof e.data === 'string';
}

/** A salt and the key derived from it, reusable for many messages (each still gets its own IV). */
export interface KeyContext {
  salt: string;
  iter: number;
  key: CryptoKey;
}

export async function keyContext(passphrase: string, salt: Uint8Array<ArrayBuffer> = newSalt(), iterations = PBKDF2_ITERATIONS): Promise<KeyContext> {
  return { salt: toBase64(salt), iter: iterations, key: await deriveKey(passphrase, salt, iterations) };
}

/** Encrypt any JSON value into an envelope. */
export async function sealJSON(value: unknown, ctx: KeyContext): Promise<EncryptedEnvelope> {
  const sealed = await encryptString(ctx.key, JSON.stringify(value));
  return { hwtodoEncrypted: 1, kdf: 'PBKDF2-SHA256', iter: ctx.iter, cipher: 'AES-GCM', salt: ctx.salt, ...sealed };
}

/**
 * Open an envelope. `keyFor` supplies the key for the envelope's salt (so callers can cache derived keys);
 * it defaults to deriving from `passphrase`.
 */
export async function openJSON(env: EncryptedEnvelope, passphrase: string, keyFor?: (salt: string, iter: number) => Promise<CryptoKey>): Promise<unknown> {
  if (env.kdf !== undefined && env.kdf !== 'PBKDF2-SHA256') throw new Error(`Unknown key derivation “${String(env.kdf)}”.`);
  if (env.cipher !== undefined && env.cipher !== 'AES-GCM') throw new Error(`Unknown cipher “${String(env.cipher)}”.`);
  const iter = Number(env.iter) || PBKDF2_ITERATIONS;
  const key = keyFor ? await keyFor(env.salt, iter) : await deriveKey(passphrase, fromBase64(env.salt), iter);
  const text = await decryptString(key, env);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('The decrypted data is not valid JSON.');
  }
}
