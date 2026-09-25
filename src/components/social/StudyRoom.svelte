<script lang="ts">
  // Focus → Study room: a shared Pomodoro anyone can join from a link. No server: the link holds the room and each
  // device works out the phase from its own clock (see lib/studyroom.ts).
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { requestNotifications } from '../../lib/reminders';
  import { createRoom, decodeRoom, formatLeft, PHASE_LABEL, ROOM_LIMITS, roomLink } from '../../lib/studyroom';
  import { studyRoom } from '../../lib/social/room.svelte';
  import { socialUi } from '../../lib/social/state.svelte';
  import { account, accountConfig } from '../../lib/account.svelte';

  const s = store.settings;
  let name = $state('Study room');
  let work = $state(s.pomodoroWorkMin);
  let brk = $state(s.pomodoroBreakMin);
  let long = $state(s.pomodoroLongBreakMin);
  let every = $state(4);
  let rounds = $state(0);
  let startIn = $state(0);
  let joinInput = $state('');
  let presenceName = $state(studyRoom.myName);

  const room = $derived(studyRoom.room);
  const st = $derived(studyRoom.state);
  const link = $derived(room ? roomLink(room, location.href) : '');
  const pct = $derived(st && st.length ? 1 - st.left / st.length : 0);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const canPresence = $derived(!!accountConfig() && !!account.userId);
  const nextLabel = $derived.by(() => {
    if (!room || !st) return '';
    if (st.phase === 'done') return '';
    if (st.phase === 'waiting') return `Round 1 focus starts at ${new Date(st.endsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    if (st.phase !== 'work') return `Then round ${st.round + 1}: focus ${room.work} min`;
    if (room.rounds && st.round >= room.rounds) return 'Then the room ends';
    const longNext = room.every > 0 && room.long > 0 && st.round % room.every === 0;
    return `Then a ${longNext ? `${room.long} min long` : `${room.brk} min`} break`;
  });

  function create(e: SubmitEvent) {
    e.preventDefault();
    void requestNotifications();
    studyRoom.join(createRoom({ name, work, brk, long, every, rounds, startInMin: startIn }));
  }
  function join(e: SubmitEvent) {
    e.preventDefault();
    const r = decodeRoom(joinInput);
    if (!r) {
      toasts.push({ message: "That isn't a study-room link", detail: 'Paste the whole link someone shared.', kind: 'warn' });
      return;
    }
    void requestNotifications();
    studyRoom.join(r);
    joinInput = '';
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toasts.push({ message: 'Room link copied', detail: 'Send it to your study group.', kind: 'success', emoji: '🔗' });
    } catch {
      toasts.push({ message: "Couldn't copy: select the link and copy it", kind: 'warn' });
    }
  }
  async function share() {
    try {
      await navigator.share({ title: room?.name ?? 'Study room', text: `Join my study room "${room?.name}"`, url: link });
    } catch {
      /* cancelled */
    }
  }
</script>

<section class="card room" aria-label="Study room">
  <div class="head">
    <h2>👥 Study room</h2>
    <div class="grow"></div>
    <button class="btn ghost sm" onclick={() => (socialUi.roomOpen = false)} aria-label="Hide study room">Hide</button>
  </div>

  {#if room && st}
    <div class="live" data-phase={st.phase} data-ends-at={st.endsAt}>
      <div class="rname">{room.name}</div>
      <div class="phase" aria-live="polite">
        {PHASE_LABEL[st.phase]}{st.phase !== 'waiting' && st.phase !== 'done' ? ` · round ${st.round}${room.rounds ? ` of ${room.rounds}` : ''}` : ''}
      </div>
      <div class="left" aria-label="Time left">{formatLeft(st.left)}</div>
      <div class="bar" aria-hidden="true"><div class="fill" style="width:{pct * 100}%"></div></div>
      {#if nextLabel}<div class="muted">{nextLabel}</div>{/if}
    </div>
    <label class="field"
      >Room link
      <input class="input" readonly value={link} aria-label="Room link" onfocus={(e) => (e.currentTarget as HTMLInputElement).select()} />
    </label>
    <div class="row">
      <button class="btn primary sm" onclick={copy}>Copy link</button>
      {#if canShare}<button class="btn sm" onclick={share}>Share…</button>{/if}
      <label class="check"
        ><input type="checkbox" checked={studyRoom.chime} onchange={(e) => studyRoom.setChime((e.currentTarget as HTMLInputElement).checked)} /> Chime at each change</label
      >
      <div class="grow"></div>
      <button class="btn ghost sm danger" onclick={() => studyRoom.leave()}>Leave room</button>
    </div>
    <div class="who">
      {#if studyRoom.people}
        <strong>In the room:</strong>
        {studyRoom.people.join(', ') || 'just you'}
      {:else if canPresence}
        <form
          class="row"
          onsubmit={(e) => {
            e.preventDefault();
            void studyRoom.setPresence(true, presenceName);
          }}
        >
          <input class="input sm" bind:value={presenceName} maxlength="24" placeholder="Your name" aria-label="Name to show in the room" />
          <button class="btn sm" type="submit">Show who's in</button>
        </form>
        <p class="muted">Uses this site's account server (Supabase Realtime) to share the name you type with others in the room while you're here. Nothing is stored.</p>
      {:else}
        <p class="muted">
          There's no server behind rooms, so the app can't see who else opened the link. Everyone just runs the same clock.{accountConfig()
            ? ' Sign in to an account (Settings → Account) to see who’s in.'
            : ''}
        </p>
      {/if}
      {#if studyRoom.people}<button class="btn ghost sm" onclick={() => studyRoom.setPresence(false, presenceName)}>Stop sharing my name</button>{/if}
      {#if studyRoom.presenceError}<p class="muted">{studyRoom.presenceError}</p>{/if}
    </div>
  {:else}
    <p class="muted">
      A Pomodoro timer your friends join from a link: everyone sees the same phase and time left. The link holds the room's name, start time and lengths; there's no server, so it
      works offline and nobody else learns who joined.
    </p>
    <form class="create" onsubmit={create} aria-label="Create a study room">
      <label class="field wide">Room name <input class="input" bind:value={name} maxlength={ROOM_LIMITS.name} /></label>
      <label class="field">Focus (min) <input class="input" type="number" min="1" max="180" bind:value={work} /></label>
      <label class="field">Break (min) <input class="input" type="number" min="1" max="60" bind:value={brk} /></label>
      <label class="field">Long break (min) <input class="input" type="number" min="0" max="120" bind:value={long} /></label>
      <label class="field">Long break every <input class="input" type="number" min="0" max="12" bind:value={every} /></label>
      <label class="field">Rounds (0 = no end) <input class="input" type="number" min="0" max="48" bind:value={rounds} /></label>
      <label class="field"
        >Starts
        <select class="select" bind:value={startIn}>
          <option value={0}>Now</option>
          <option value={1}>In 1 minute</option>
          <option value={5}>In 5 minutes</option>
          <option value={10}>In 10 minutes</option>
        </select>
      </label>
      <button class="btn primary" type="submit">Create room</button>
    </form>
    <form class="row joinf" onsubmit={join} aria-label="Join a study room">
      <input class="input grow" bind:value={joinInput} placeholder="Paste a study-room link" aria-label="Study-room link" />
      <button class="btn" type="submit" disabled={!joinInput.trim()}>Join</button>
    </form>
  {/if}
</section>

<style>
  .room {
    margin-bottom: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .head {
    display: flex;
    align-items: center;
  }
  h2 {
    font-size: 16px;
    margin: 0;
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
  .live {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: center;
  }
  .rname {
    font-weight: 700;
  }
  .phase {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }
  .left {
    font-size: 40px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .bar {
    width: 100%;
    max-width: 320px;
    height: 6px;
    border-radius: 3px;
    background: var(--bg-elev-2);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    transition: width 400ms linear;
  }
  [data-phase='break'] .fill,
  [data-phase='long'] .fill {
    background: var(--success, #10b981);
  }
  .row {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .check {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 13px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
  }
  .create {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 8px;
    align-items: end;
  }
  .create .wide {
    grid-column: 1 / -1;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
    margin: 0;
  }
  .who {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
  }
  .danger {
    color: var(--danger, #ef4444);
  }
</style>
