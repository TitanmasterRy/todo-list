// Friends on this device: your card's name and emoji, the cards you've added, and the optional live copy in the
// site's Supabase project (friend_cards table, see docs/supabase.sql). The list never leaves this device.
import { addFriend, decodeCard, validateCard, type AddResult, type Friend, type FriendCard } from '../friends';
import { randomId } from '../b64url';
import { startOfWeekKey } from '../dates';
import { levelForXp } from '../gamification';
import { store } from '../store.svelte';
import { on } from '../events';
import { FRIEND_LIVE_KEY } from './links';
import { account, accountConfig, getClient } from '../account.svelte';

const PROFILE_KEY = 'homework-todo:friend-profile';
const LIST_KEY = 'homework-todo:friends';
const TABLE = 'friend_cards';
const PUBLISH_DEBOUNCE_MS = 60_000;

interface Profile {
  id: string;
  name: string;
  emoji: string;
  pid?: string; // live copy id (only while live updates are on)
}

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown): void {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

function loadProfile(): Profile {
  const p = read<Partial<Profile>>(PROFILE_KEY, {});
  const ok = typeof p.id === 'string' && /^[a-z0-9]{8,40}$/.test(p.id);
  const profile = { id: ok ? p.id! : randomId(16), name: p.name ?? '', emoji: p.emoji ?? '🙂', pid: p.pid };
  // the id has to stay the same, or friends would get a second row for you after every reload
  if (!ok) write(PROFILE_KEY, profile);
  return profile;
}

function loadList(): Friend[] {
  const now = Math.floor(Date.now() / 1000);
  const raw = read<unknown[]>(LIST_KEY, []);
  return (Array.isArray(raw) ? raw : []).flatMap((f) => {
    const card = validateCard((f as Friend | null)?.card, now);
    return card ? [{ card, addedAt: Number((f as Friend).addedAt) || now }] : [];
  });
}

class FriendsState {
  profile = $state<Profile>(loadProfile());
  list = $state<Friend[]>(loadList());
  liveStatus = $state<'off' | 'syncing' | 'ok' | 'error'>('off');
  liveError = $state('');
  lastPulled = $state<number | null>(null);

  /** Your card as of right now. */
  myCard(): FriendCard {
    const s = store.stats;
    const card: FriendCard = {
      id: this.profile.id,
      name: this.profile.name.trim() || 'Me',
      emoji: this.profile.emoji || '🙂',
      streak: store.streak,
      best: Math.max(s.streak.best, store.streak),
      wxp: store.weeklyXp,
      wk: startOfWeekKey(store.today, store.settings.weekStart),
      lvl: levelForXp(s.xp),
      at: Math.floor(Date.now() / 1000),
    };
    if (this.profile.pid) card.pid = this.profile.pid;
    return card;
  }

  setProfile(name: string, emoji: string): void {
    this.profile = { ...this.profile, name: name.trim().slice(0, 24), emoji: emoji.trim().slice(0, 16) || '🙂' };
    write(PROFILE_KEY, this.profile);
    if (this.profile.pid) schedulePublish();
  }

  /** Add a friend from a pasted code or link. */
  add(input: string): { result: AddResult | 'invalid'; card?: FriendCard } {
    const card = decodeCard(input);
    if (!card) return { result: 'invalid' };
    const { list, result } = addFriend(this.list, card, this.profile.id);
    this.list = list;
    write(LIST_KEY, list);
    return { result, card };
  }

  remove(id: string): void {
    this.list = this.list.filter((f) => f.card.id !== id);
    write(LIST_KEY, this.list);
  }

  get liveOn(): boolean {
    return !!this.profile.pid;
  }

  /** Turn on live updates: a fresh public id, published to the account's server. Codes made after this include it. */
  async enableLive(): Promise<void> {
    if (!account.userId) throw new Error('Sign in first (Settings → Account).');
    this.profile = { ...this.profile, pid: randomId(24) };
    try {
      await publishNow();
    } catch (e) {
      this.profile = { ...this.profile, pid: undefined };
      throw e;
    }
    write(PROFILE_KEY, this.profile);
    write(FRIEND_LIVE_KEY, 1);
    startLive();
  }

  /** Turn off live updates and delete the live copy. */
  async disableLive(): Promise<void> {
    const pid = this.profile.pid;
    this.profile = { ...this.profile, pid: undefined };
    write(PROFILE_KEY, this.profile);
    write(FRIEND_LIVE_KEY, null);
    this.liveStatus = 'off';
    if (!pid) return;
    const { error } = await (await getClient()).from(TABLE).delete().eq('id', pid);
    if (error) throw new Error(error.message);
  }

  /** Fetch the live copies of friends who have them (by their public ids only). */
  async pull(): Promise<number> {
    const ids = this.list.map((f) => f.card.pid).filter((x): x is string => !!x);
    if (!ids.length || !accountConfig()) return 0;
    const { data, error } = await (await getClient()).rpc('friend_cards_by_id', { ids: ids.slice(0, 100) });
    if (error)
      throw new Error(
        /function .* does not exist|schema cache/i.test(error.message)
          ? 'The account server is missing friend_cards. The site admin needs to run docs/supabase.sql.'
          : error.message,
      );
    let updated = 0;
    let list = this.list;
    for (const row of (Array.isArray(data) ? data : []) as { id?: unknown; card?: unknown }[]) {
      const card = validateCard(row?.card);
      const cur = list.find((f) => f.card.pid && f.card.pid === row?.id);
      // the row must be the same person the code named, or it's ignored
      if (!card || !cur || card.id !== cur.card.id) continue;
      const r = addFriend(list, { ...card, pid: cur.card.pid }, this.profile.id);
      if (r.result === 'updated') updated++;
      list = r.list;
    }
    this.list = list;
    write(LIST_KEY, list);
    this.lastPulled = Date.now();
    return updated;
  }
}

export const friends = new FriendsState();

async function publishNow(): Promise<void> {
  const pid = friends.profile.pid;
  if (!pid) return;
  if (!account.userId) return;
  friends.liveStatus = 'syncing';
  try {
    const { error } = await (await getClient()).from(TABLE).upsert({ id: pid, owner: account.userId, card: friends.myCard(), updated_at: new Date().toISOString() });
    if (error)
      throw new Error(
        /relation .* does not exist|schema cache/i.test(error.message)
          ? 'The account server is missing friend_cards. The site admin needs to run docs/supabase.sql.'
          : error.message,
      );
    friends.liveStatus = 'ok';
    friends.liveError = '';
  } catch (e) {
    friends.liveStatus = 'error';
    friends.liveError = e instanceof Error ? e.message : String(e);
    throw e;
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
function schedulePublish(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void publishNow().catch(() => {}), PUBLISH_DEBOUNCE_MS);
}

let liveStarted = false;
/** Keep the live copy fresh: once now, then a minute after changes. */
export function startLive(): void {
  if (liveStarted || !friends.profile.pid) return;
  liveStarted = true;
  on('changed', () => friends.profile.pid && schedulePublish());
  // the account session restores on its own after startup
  const t = setInterval(() => {
    if (account.userId) {
      clearInterval(t);
      void publishNow().catch(() => {});
    }
  }, 2000);
  setTimeout(() => clearInterval(t), 60_000);
}
