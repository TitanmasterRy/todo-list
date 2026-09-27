// Admin passphrase and the sealed publishing settings. Loaded only with the admin panel.
// The passphrase hash comes from the build (VITE_ADMIN_HASH, same on every device) or, without one, is set on
// this device the first time the panel opens. The GitHub token is sealed with the passphrase and stays on this
// device (meta 'admin' in IndexedDB is not part of backups or sync).
import { getMeta, putMeta } from './storage';
import { hashPassphrase, isPassHash, publishFile, readRepoFile, validRepo, verifyPassphrase, type RepoTarget } from './admin';
import { keyContext, openJSON, sealJSON, type EncryptedEnvelope } from './crypto';
import { ui } from './ui.svelte';

interface AdminMeta {
  hash?: string;
  sealed?: EncryptedEnvelope;
  failures?: number;
  lockedUntil?: number;
}

export interface Publishing extends Partial<RepoTarget> {
  token?: string;
}

const META_KEY = 'admin';
const BUILD_HASH = (import.meta.env.VITE_ADMIN_HASH as string | undefined)?.trim();

class AdminAuth {
  ready = $state(false);
  /** 'build' when the passphrase comes from VITE_ADMIN_HASH. */
  source = $state<'build' | 'device' | 'none'>('none');
  lockedUntil = $state(0);
  publishing = $state<Publishing>({});
  private pass = '';
  private meta: AdminMeta = {};

  get unlocked(): boolean {
    return ui.adminUnlocked;
  }

  async load(): Promise<void> {
    this.meta = (await getMeta<AdminMeta>(META_KEY)) ?? {};
    this.source = isPassHash(BUILD_HASH) ? 'build' : isPassHash(this.meta.hash) ? 'device' : 'none';
    this.lockedUntil = this.meta.lockedUntil ?? 0;
    this.ready = true;
  }

  private get hash(): string | undefined {
    return this.source === 'build' ? BUILD_HASH : this.meta.hash;
  }

  /** First run on a device without a build hash: choose the passphrase. */
  async setup(pass: string): Promise<void> {
    if (this.source !== 'none') throw new Error('An admin passphrase is already set.');
    if (pass.length < 8) throw new Error('Use at least 8 characters.');
    this.meta = { hash: await hashPassphrase(pass) };
    await putMeta(META_KEY, this.meta);
    this.source = 'device';
    this.pass = pass;
    ui.adminUnlocked = true;
  }

  /** Check the passphrase. Five wrong tries lock the panel for a few minutes (longer each time). */
  async unlock(pass: string): Promise<boolean> {
    if (Date.now() < this.lockedUntil) return false;
    const hash = this.hash;
    if (!hash || !(await verifyPassphrase(pass, hash))) {
      const failures = (this.meta.failures ?? 0) + 1;
      this.meta = { ...this.meta, failures, lockedUntil: failures % 5 === 0 ? Date.now() + 60_000 * 2 ** Math.min(6, failures / 5) : this.meta.lockedUntil };
      this.lockedUntil = this.meta.lockedUntil ?? 0;
      await putMeta(META_KEY, this.meta);
      return false;
    }
    this.pass = pass;
    this.meta = { ...this.meta, failures: 0, lockedUntil: 0 };
    this.lockedUntil = 0;
    await putMeta(META_KEY, this.meta);
    if (this.meta.sealed) {
      try {
        this.publishing = (await openJSON(this.meta.sealed, pass)) as Publishing;
      } catch {
        // sealed with an older passphrase (the build hash changed): start fresh
        this.publishing = {};
      }
    }
    ui.adminUnlocked = true;
    return true;
  }

  lock(): void {
    this.pass = '';
    this.publishing = {};
    ui.adminUnlocked = false;
  }

  async changePassphrase(current: string, next: string): Promise<void> {
    if (this.source === 'build') throw new Error('This site’s passphrase is set at build time (VITE_ADMIN_HASH). Change it there.');
    if (!this.meta.hash || !(await verifyPassphrase(current, this.meta.hash))) throw new Error('The current passphrase is not right.');
    if (next.length < 8) throw new Error('Use at least 8 characters.');
    this.pass = next;
    this.meta = { ...this.meta, hash: await hashPassphrase(next) };
    await this.savePublishing(this.publishing);
  }

  async savePublishing(p: Publishing): Promise<void> {
    if (!this.pass) throw new Error('Unlock the admin panel first.');
    this.publishing = { ...p };
    const sealed = p.token || p.owner || p.repo ? await sealJSON($state.snapshot(this.publishing), await keyContext(this.pass)) : undefined;
    this.meta = { ...this.meta, sealed };
    await putMeta(META_KEY, this.meta);
  }

  /** Publishing is set up: a token and a repo. */
  get canPublish(): boolean {
    return !!this.publishing.token && validRepo(this.publishing);
  }

  private target(): RepoTarget & { token: string } {
    const { token, ...repo } = this.publishing;
    if (!token || !validRepo(repo)) throw new Error('Set up publishing first (Site tab → Publishing).');
    return { owner: repo.owner, repo: repo.repo, branch: repo.branch, token };
  }

  /** Commit one file to the repo (the deploy workflow then rebuilds the site). Returns the commit URL. */
  publish(path: string, content: string, message: string): Promise<string> {
    return publishFile({ ...this.target(), path, content, message });
  }

  read(path: string): Promise<string | undefined> {
    return readRepoFile({ ...this.target(), path });
  }
}

export const adminAuth = new AdminAuth();
