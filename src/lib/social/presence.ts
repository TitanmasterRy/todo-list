// Optional "who's in" for a study room, over the site's Supabase Realtime (presence only: nothing is stored).
// Without a server there's no way to see who else opened a link, so this needs a signed-in account.
import { account, accountConfig, getClient } from '../account.svelte';

/** Join the room's presence channel with a display name. Calls `onChange` with everyone's names; returns a leave function. */
export async function joinPresence(roomId: string, name: string, onChange: (names: string[]) => void): Promise<() => void> {
  if (!accountConfig()) throw new Error("This site has no account server, so the room can't show who's in.");
  if (!account.userId) throw new Error("Sign in (Settings → Account) to see who's in.");
  const c = await getClient();
  const ch = c.channel(`hwtodo-room-${roomId}`, { config: { presence: { key: crypto.randomUUID() } } });
  ch.on('presence', { event: 'sync' }, () => {
    const names = Object.values(ch.presenceState<{ name?: string }>())
      .flat()
      .map((p) => String(p.name ?? 'Someone').slice(0, 24));
    onChange(names.sort((a, b) => a.localeCompare(b)));
  });
  ch.subscribe((status) => {
    if (status === 'SUBSCRIBED') void ch.track({ name });
  });
  return () => void c.removeChannel(ch);
}
