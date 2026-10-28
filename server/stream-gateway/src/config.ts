// Settings from the environment. The server starts with secrets missing (so the CLI can run in the container to
// make them) and reports what's missing by name only; the routes that need a secret answer 503 until it's set.

export interface Config {
  port: number;
  dataDir: string;
  /** argon2id PHC string */
  passwordHash: string;
  signingKey: Buffer | null;
  turnSecret: string;
  turnHost: string;
  mwUrl: URL | null;
  /** upper-case hex, no colons */
  mwCertSha256: string;
  /** '' = the first paired host */
  mwHostId: string;
  allowedOrigin: string;
}

export function normalizeFingerprint(s: string): string {
  const hex = s
    .replace(/^sha256 fingerprint=/i, '')
    .replace(/[:\s]/g, '')
    .toUpperCase();
  return /^[0-9A-F]{64}$/.test(hex) ? hex : '';
}

export function loadConfig(env: Record<string, string | undefined> = process.env): { config: Config; missing: string[] } {
  const missing: string[] = [];
  const need = (name: string): string => {
    const v = (env[name] ?? '').trim();
    if (!v) missing.push(name);
    return v;
  };
  const passwordHash = need('GATEWAY_PASSWORD_HASH');
  if (passwordHash && !passwordHash.startsWith('$argon2id$')) missing.push('GATEWAY_PASSWORD_HASH (not an argon2id hash)');
  const key = need('GATEWAY_SIGNING_KEY');
  if (key && key.length < 32) missing.push('GATEWAY_SIGNING_KEY (at least 32 characters)');
  const turnSecret = need('TURN_SECRET');
  const mw = need('MW_URL');
  let mwUrl: URL | null = null;
  if (mw) {
    try {
      mwUrl = new URL(mw);
      if (mwUrl.protocol !== 'https:') throw new Error('not https');
    } catch {
      mwUrl = null;
      missing.push('MW_URL (an https:// URL)');
    }
  }
  const pin = need('MW_CERT_SHA256');
  const mwCertSha256 = normalizeFingerprint(pin);
  if (pin && !mwCertSha256) missing.push('MW_CERT_SHA256 (a SHA-256 fingerprint)');
  return {
    config: {
      port: Number(env.PORT) || 8080,
      dataDir: env.DATA_DIR || '/data',
      passwordHash,
      signingKey: key.length >= 32 ? Buffer.from(key, 'utf8') : null,
      turnSecret,
      turnHost: (env.TURN_HOST || 'turn.levitica.duckdns.org').trim(),
      mwUrl,
      mwCertSha256,
      mwHostId: (env.MW_HOST_ID ?? '').trim(),
      allowedOrigin: (env.ALLOWED_ORIGIN || 'https://titanmasterry.github.io').trim().replace(/\/+$/, ''),
    },
    missing,
  };
}
