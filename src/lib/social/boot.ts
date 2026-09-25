// Loaded only for a social link or saved social state (see links.ts): opens links, resumes a study room,
// refreshes class subscriptions and keeps the live friend card fresh.
import { store } from '../store.svelte';
import { ui } from '../ui.svelte';
import { toasts } from '../toast.svelte';
import { paramFrom } from '../b64url';
import { CLASS_SUBS_KEY, FRIEND_LIVE_KEY, ROOM_KEY } from './links';
import { socialUi } from './state.svelte';

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
      toasts.push({ message: "That study-room link doesn't work", detail: 'Ask for a fresh link.', kind: 'warn' });
      return { room: false };
    }
    const { studyRoom } = await import('./room.svelte');
    studyRoom.resume(); // keeps your chime and presence choices when it's the same room
    if (studyRoom.room?.id !== room.id || studyRoom.room.start !== room.start) studyRoom.join(room);
    socialUi.roomOpen = true;
    store.go('focus');
    toasts.push({ message: `Joined ${room.name}`, detail: 'Everyone with the link sees the same timer.', kind: 'success', emoji: '👥' });
    return { room: true };
  }
  if (kind === 'friend') {
    const { friends } = await import('./friends.svelte');
    const { result, card } = friends.add(value);
    const msg: Record<string, string> = {
      added: `Added ${card?.name} as a friend`,
      updated: `Updated ${card?.name}'s card`,
      older: `You already have a newer card from ${card?.name}`,
      self: "That's your own friend code",
      full: 'Your friends list is full',
      invalid: "That friend link doesn't work",
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
