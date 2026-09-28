// Play → Watch state: the saved sources (localStorage, this device only), media-server sign-ins (the app's key
// store, so "Lock my keys" covers them) and the homework rules read from settings. Loaded only with the Watch tab.
import { store } from '../store.svelte';
import { isLocked, requestUnlock, secret, setSecrets, useSecret } from '../secrets.svelte';
import type { WatchRules, WatchUsage } from './limits';
import { loadWatch, parseTokens, randomId, rememberPosition, saveWatch, withToken, type WatchData, type WatchSource } from './sources';

class WatchState {
  data = $state<WatchData>(loadWatch());

  private save(): void {
    saveWatch($state.snapshot(this.data) as WatchData);
  }

  add(s: Omit<WatchSource, 'id' | 'addedAt'>): WatchSource {
    const src: WatchSource = { ...s, id: randomId(8), addedAt: new Date().toISOString() };
    this.data.sources = [...this.data.sources, src];
    this.save();
    return src;
  }

  update(id: string, patch: Partial<Omit<WatchSource, 'id'>>): void {
    this.data.sources = this.data.sources.map((s) => (s.id === id ? { ...s, ...patch } : s));
    this.save();
  }

  remove(id: string): void {
    this.data.sources = this.data.sources.filter((s) => s.id !== id);
    const { [id]: _gone, ...rest } = this.data.positions;
    this.data.positions = rest;
    this.save();
    void forgetToken(id);
  }

  position(key: string): number {
    return this.data.positions[key]?.t ?? 0;
  }

  setPosition(key: string, seconds: number, duration: number): void {
    this.data.positions = rememberPosition(this.data.positions, key, seconds, duration);
    this.save();
  }

  setSpeed(speed: number): void {
    this.data.speed = speed;
    this.save();
  }
}

export const watch = new WatchState();

// ---------- sign-in tokens ----------
/** Tokens kept for this session only (the key lock was on and the passphrase wasn't given). */
const sessionTokens = new Map<string, string>();

/** The saved access token for a media-server source ('' when not signed in, or locked and not unlocked). */
export async function getToken(id: string): Promise<string> {
  if (sessionTokens.has(id)) return sessionTokens.get(id)!;
  const json = await useSecret('watchTokens', { reason: 'Enter your passphrase to use your media server sign-in.' });
  return parseTokens(json)[id] ?? '';
}

export async function saveToken(id: string, token: string): Promise<void> {
  // while locked the stored map can't be read, and writing a partial one would replace it: unlock first
  if (isLocked('watchTokens') && !(await requestUnlock('Enter your passphrase to save your media server sign-in.'))) {
    if (token) sessionTokens.set(id, token);
    else sessionTokens.delete(id);
    return;
  }
  sessionTokens.delete(id);
  const next = withToken(secret('watchTokens'), id, token);
  if (next !== secret('watchTokens')) setSecrets({ watchTokens: next });
}

export async function forgetToken(id: string): Promise<void> {
  sessionTokens.delete(id);
  // while locked this asks for the passphrase (cancelling leaves the unused token in the locked store)
  if (isLocked('watchTokens') || parseTokens(secret('watchTokens'))[id]) await saveToken(id, '');
}

// ---------- homework rules ----------
export function watchRules(): WatchRules {
  const s = store.settings;
  return { voucherMin: s.watchVoucherMin ?? 0, ringFirst: !!s.watchRingFirst, dailyLimitMin: s.watchDailyLimitMin ?? 0, breakMin: s.watchBreakMin ?? 0 };
}

export function watchUsage(): WatchUsage {
  const s = store.settings;
  return { byDay: s.watchMinutesByDay ?? {}, creditMin: s.watchCreditMin ?? 0 };
}

export function saveUsage(u: WatchUsage): void {
  store.updateSettings({ watchMinutesByDay: u.byDay, watchCreditMin: u.creditMin });
}

export function ringClosedToday(): boolean {
  return store.stats.ringDays.includes(store.today);
}
