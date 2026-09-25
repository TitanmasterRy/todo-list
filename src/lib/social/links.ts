// Social links arrive in the URL hash (#room=…, #friend=…, #class=…), so the codes never reach the web host.
// This tiny check is all the first load carries: the social code loads only for a link or saved social state.
export const ROOM_KEY = 'homework-todo:study-room';
export const CLASS_SUBS_KEY = 'homework-todo:class-subs';
export const FRIEND_LIVE_KEY = 'homework-todo:friend-live';
const LINK = /[#?&](room|friend|class)=/;

function saved(): boolean {
  try {
    return [ROOM_KEY, CLASS_SUBS_KEY, FRIEND_LIVE_KEY].some((k) => localStorage.getItem(k));
  } catch {
    return false;
  }
}

/** Call once the store is ready. */
export function startSocial(): void {
  const boot = () => void import('./boot').then((m) => m.start());
  if (LINK.test(location.hash) || LINK.test(location.search) || saved()) boot();
  window.addEventListener('hashchange', () => LINK.test(location.hash) && boot());
}
