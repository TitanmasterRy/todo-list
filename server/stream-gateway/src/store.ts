// Everything the gateway remembers, in one JSON file in the data volume (mode 0600, written atomically): the
// MoonlightWeb link (session cookie, pinned host key), the gateway's own pairing key, the TOTP secret and the live
// sign-ins. Refresh tokens and backup codes are stored as SHA-256 hashes only.
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { newPairingKey } from './mwbind.js';

export interface MwLink {
  cookie: string;
  /** base64 SPKI of the host's MW-BIND key */
  hostKey: string;
  hostId: string;
  linkedAt: string;
}

export interface RefreshEntry {
  fam: string;
  exp: number;
  /** rotated already: presenting it again means it was stolen, and its whole sign-in is ended */
  used: boolean;
}

export interface State {
  version: 1;
  pairingKey: string;
  clientUniqueId: string;
  mw?: MwLink;
  totp?: { secret: string; lastCounter: number; backupCodes: string[]; enrolledAt: string };
  generation: number;
  /** live sign-ins: family id → the moment it ends (the 12-hour cap) */
  families: Record<string, number>;
  /** sha256(refresh token) → entry */
  refresh: Record<string, RefreshEntry>;
}

export function freshState(): State {
  return { version: 1, pairingKey: newPairingKey(), clientUniqueId: randomBytes(16).toString('hex'), generation: 1, families: {}, refresh: {} };
}

export class Store {
  readonly file: string;
  state: State;

  constructor(dir: string) {
    this.file = join(dir, 'state.json');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
    if (existsSync(this.file)) {
      this.state = { ...freshState(), ...(JSON.parse(readFileSync(this.file, 'utf8')) as Partial<State>) } as State;
    } else {
      this.state = freshState();
      this.save();
    }
  }

  save(): void {
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.state, null, 2), { mode: 0o600 });
    chmodSync(tmp, 0o600);
    renameSync(tmp, this.file);
  }

  /** Drop expired sign-ins and refresh tokens. */
  prune(nowSec: number): void {
    const s = this.state;
    for (const [fam, end] of Object.entries(s.families)) if (end <= nowSec) delete s.families[fam];
    for (const [h, r] of Object.entries(s.refresh)) if (r.exp <= nowSec || !s.families[r.fam]) delete s.refresh[h];
  }

  endFamily(fam: string): void {
    delete this.state.families[fam];
    for (const [h, r] of Object.entries(this.state.refresh)) if (r.fam === fam) delete this.state.refresh[h];
  }
}
