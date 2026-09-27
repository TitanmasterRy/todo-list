// Loaded only for a social link or saved social state (see links.ts): opens links, resumes a study room,
// refreshes class subscriptions and keeps the live friend card fresh.
import { store } from '../store.svelte';
import { ui } from '../ui.svelte';
import { toasts } from '../toast.svelte';
import { paramFrom } from '../b64url';
import { CLASS_SUBS_KEY, FRIEND_LIVE_KEY, ROOM_KEY } from './links';
import { socialUi } from './state.svelte';
import { t } from '../i18n/index.svelte';

let started = false;

function has(key: string): boolean {
  try {
    return !!localStorage.getItem(key);
  } catch {
    return false;
  }
}

export async function start(): Promise<void> {
  const linked = await openLink();
  if (started) return;
  started = true;
  if (!linked.room && has(ROOM_KEY)) {
    const { studyRoom } = await import('./room.svelte');
    studyRoom.resume();
  }
  if (has(CLASS_SUBS_KEY)) void import('./classSync.svelte').then((m) => m.refreshAll({ quiet: true }));
  if (has(FRIEND_LIVE_KEY)) void import('./friends.svelte').then((m) => m.startLive());
}

/** Act on #room= / #friend= / #class= (or the same as query parameters), then take it out of the address bar. */
async function openLink(): Promise<{ room: boolean }> {
  const where = `${location.search}${location.hash}`;
  const kind = /[#?&](room|friend|class)=/.exec(where)?.[1];
  if (!kind) return { room: false };
  const value = paramFrom(where, kind);
  const params = new URLSearchParams(location.search);
  params.delete(kind);
  const rest = params.toString();
  history.replaceState(history.state, '', `${location.pathname}${rest ? `?${rest}` : ''}`);
  if (kind === 'room') {
    const { decodeRoom } = await import('../studyroom');
    const room = decodeRoom(value);
    if (!room) {
      toasts.push({ message: t('room.badLink'), detail: t('room.badLinkDetail'), kind: 'warn' });
      return { room: false };
    }
    const { studyRoom } = await import('./room.svelte');
    studyRoom.resume(); // keeps your chime and presence choices when it's the same room
    if (studyRoom.room?.id !== room.id || studyRoom.room.start !== room.start) studyRoom.join(room);
    socialUi.roomOpen = true;
    store.go('focus');
    toasts.push({ message: t('room.joined', { name: room.name }), detail: t('room.joinedDetail'), kind: 'success', emoji: '👥' });
    return { room: true };
  }
  if (kind === 'friend') {
    const { friends } = await import('./friends.svelte');
    const { result, card } = friends.add(value);
    const msg: Record<string, string> = {
      added: t('friends.addedFriend', { name: card?.name ?? '' }),
      updated: t('friends.updated', { name: card?.name ?? '' }),
      older: t('friends.older', { name: card?.name ?? '' }),
      self: t('friends.selfLink'),
      full: t('friends.fullShort'),
      invalid: t('friends.badLink'),
    };
    toasts.push({ message: msg[result], kind: result === 'added' || result === 'updated' ? 'success' : 'warn', emoji: card?.emoji ?? '👋' });
    store.go('stats');
    return { room: false };
  }
  // a class list: Class mode shows it with a Subscribe button (nothing is fetched until the student says so)
  socialUi.classUrl = value;
  ui.toolsTab = 'class';
  store.go('tools');
  return { room: false };
}
