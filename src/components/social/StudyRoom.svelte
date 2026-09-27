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
  import { formatClock } from '../../lib/dates';
  import { t } from '../../lib/i18n/index.svelte';

  const s = store.settings;
  let name = $state(t('focus.studyRoom'));
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
    if (st.phase === 'waiting') return t('room.startsAt', { time: formatClock(new Date(st.endsAt), { hour: 'numeric', minute: '2-digit' }) });
    if (st.phase !== 'work') return t('room.thenRound', { n: st.round + 1, min: room.work });
    if (room.rounds && st.round >= room.rounds) return t('room.thenEnds');
    const longNext = room.every > 0 && room.long > 0 && st.round % room.every === 0;
    return longNext ? t('room.thenLong', { min: room.long }) : t('room.thenBreak', { min: room.brk });
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
      toasts.push({ message: t('room.notLink'), detail: t('room.notLinkDetail'), kind: 'warn' });
      return;
    }
    void requestNotifications();
    studyRoom.join(r);
    joinInput = '';
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toasts.push({ message: t('room.copied'), detail: t('room.copiedDetail'), kind: 'success', emoji: '🔗' });
    } catch {
      toasts.push({ message: t('room.copyFailed'), kind: 'warn' });
    }
  }
  async function share() {
    try {
      await navigator.share({ title: room?.name ?? t('focus.studyRoom'), text: t('room.shareText', { name: room?.name ?? '' }), url: link });
    } catch {
      /* cancelled */
    }
  }
</script>

<section class="card room" aria-label={t('focus.studyRoom')}>
  <div class="head">
    <h2>👥 {t('focus.studyRoom')}</h2>
    <div class="grow"></div>
    <button class="btn ghost sm" onclick={() => (socialUi.roomOpen = false)} aria-label={t('room.hide')}>{t('common.hide')}</button>
  </div>

  {#if room && st}
    <div class="live" data-phase={st.phase} data-ends-at={st.endsAt}>
      <div class="rname">{room.name}</div>
      <div class="phase" aria-live="polite">
        {PHASE_LABEL[st.phase]}{st.phase !== 'waiting' && st.phase !== 'done'
          ? ` · ${room.rounds ? t('room.roundOf', { n: st.round, total: room.rounds }) : t('room.round', { n: st.round })}`
          : ''}
      </div>
      <div class="left" aria-label={t('room.timeLeft')}>{formatLeft(st.left)}</div>
      <div class="bar" aria-hidden="true"><div class="fill" style="width:{pct * 100}%"></div></div>
      {#if nextLabel}<div class="muted">{nextLabel}</div>{/if}
    </div>
    <label class="field"
      >{t('room.link')}
      <input class="input" readonly value={link} aria-label={t('room.link')} onfocus={(e) => (e.currentTarget as HTMLInputElement).select()} />
    </label>
    <div class="row">
      <button class="btn primary sm" onclick={copy}>{t('friends.copyLink')}</button>
      {#if canShare}<button class="btn sm" onclick={share}>{t('card.share')}</button>{/if}
      <label class="check"
        ><input type="checkbox" checked={studyRoom.chime} onchange={(e) => studyRoom.setChime((e.currentTarget as HTMLInputElement).checked)} /> {t('room.chime')}</label
      >
      <div class="grow"></div>
      <button class="btn ghost sm danger" onclick={() => studyRoom.leave()}>{t('room.leave')}</button>
    </div>
    <div class="who">
      {#if studyRoom.people}
        <strong>{t('room.inRoom')}</strong>
        {studyRoom.people.join(', ') || t('room.justYou')}
      {:else if canPresence}
        <form
          class="row"
          onsubmit={(e) => {
            e.preventDefault();
            void studyRoom.setPresence(true, presenceName);
          }}
        >
          <input class="input sm" bind:value={presenceName} maxlength="24" placeholder={t('friends.yourName')} aria-label={t('room.nameLabel')} />
          <button class="btn sm" type="submit">{t('room.showWho')}</button>
        </form>
        <p class="muted">{t('room.presenceHelp')}</p>
      {:else}
        <p class="muted">
          {t('room.noServerHelp')}{accountConfig() ? ` ${t('room.signIn')}` : ''}
        </p>
      {/if}
      {#if studyRoom.people}<button class="btn ghost sm" onclick={() => studyRoom.setPresence(false, presenceName)}>{t('room.stopSharing')}</button>{/if}
      {#if studyRoom.presenceError}<p class="muted">{studyRoom.presenceError}</p>{/if}
    </div>
  {:else}
    <p class="muted">
      {t('room.help')}
    </p>
    <form class="create" onsubmit={create} aria-label={t('room.create')}>
      <label class="field wide">{t('room.name')} <input class="input" bind:value={name} maxlength={ROOM_LIMITS.name} /></label>
      <label class="field">{t('room.focusMin')} <input class="input" type="number" min="1" max="180" bind:value={work} /></label>
      <label class="field">{t('room.breakMin')} <input class="input" type="number" min="1" max="60" bind:value={brk} /></label>
      <label class="field">{t('room.longMin')} <input class="input" type="number" min="0" max="120" bind:value={long} /></label>
      <label class="field">{t('room.longEvery')} <input class="input" type="number" min="0" max="12" bind:value={every} /></label>
      <label class="field">{t('room.rounds')} <input class="input" type="number" min="0" max="48" bind:value={rounds} /></label>
      <label class="field"
        >{t('room.starts')}
        <select class="select" bind:value={startIn}>
          <option value={0}>{t('room.now')}</option>
          <option value={1}>{t('room.inMin', { count: 1 })}</option>
          <option value={5}>{t('room.inMin', { count: 5 })}</option>
          <option value={10}>{t('room.inMin', { count: 10 })}</option>
        </select>
      </label>
      <button class="btn primary" type="submit">{t('room.createBtn')}</button>
    </form>
    <form class="row joinf" onsubmit={join} aria-label={t('room.joinLabel')}>
      <input class="input grow" bind:value={joinInput} placeholder={t('room.pastePh')} aria-label={t('room.pasteLabel')} />
      <button class="btn" type="submit" disabled={!joinInput.trim()}>{t('room.join')}</button>
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
