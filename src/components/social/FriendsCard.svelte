<script lang="ts">
  // Stats → Friends: swap share codes to compare streaks and this week's XP. The code is the only thing shared.
  import { onMount } from 'svelte';
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { ago, encodeCard, friendLink, leaderboard } from '../../lib/friends';
  import { startOfWeekKey } from '../../lib/dates';
  import { friends } from '../../lib/social/friends.svelte';
  import { account, accountConfig } from '../../lib/account.svelte';

  let name = $state(friends.profile.name);
  let emoji = $state(friends.profile.emoji);
  let paste = $state('');
  let busy = $state(false);
  // re-made when the stats or the profile change
  const me = $derived(friends.myCard());
  const code = $derived(encodeCard(me));
  const link = $derived(friendLink(me, location.href));
  const week = $derived(startOfWeekKey(store.today, store.settings.weekStart));
  const rows = $derived(leaderboard(me, friends.list, week));
  const anyStale = $derived(rows.some((r) => r.stale || (r.lastWeek && !r.me)));
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const liveAvailable = $derived(!!accountConfig());

  onMount(() => {
    if (friends.list.some((f) => f.card.pid)) void pull(true);
  });

  function saveProfile() {
    friends.setProfile(name, emoji);
  }
  function add(e: SubmitEvent) {
    e.preventDefault();
    const { result, card } = friends.add(paste);
    const msg: Record<string, string> = {
      added: `Added ${card?.name}`,
      updated: `Updated ${card?.name}'s card`,
      older: `You already have a newer card from ${card?.name}`,
      self: "That's your own code",
      full: 'Your friends list is full (50)',
      invalid: "That isn't a friend code",
    };
    toasts.push({ message: msg[result], kind: result === 'added' || result === 'updated' ? 'success' : 'warn', emoji: card?.emoji });
    if (result !== 'invalid') paste = '';
  }
  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toasts.push({ message: `${what} copied`, kind: 'success', emoji: '📋' });
    } catch {
      toasts.push({ message: "Couldn't copy: select it and copy it", kind: 'warn' });
    }
  }
  async function share() {
    try {
      await navigator.share({ title: 'My Homework To-Do friend card', text: `Add me on Homework To-Do: ${code}`, url: link });
    } catch {
      /* cancelled */
    }
  }
  async function pull(quiet = false) {
    busy = true;
    try {
      const n = await friends.pull();
      if (!quiet) toasts.push({ message: n ? `${n} friend card${n === 1 ? '' : 's'} updated` : 'Friend cards are up to date', kind: 'info' });
    } catch (e) {
      if (!quiet) toasts.push({ message: "Couldn't fetch live cards", detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    } finally {
      busy = false;
    }
  }
  async function toggleLive(on: boolean) {
    busy = true;
    try {
      if (on) await friends.enableLive();
      else await friends.disableLive();
      toasts.push({ message: on ? 'Live card on: send friends a fresh code' : 'Live card off and deleted from the server', kind: 'success' });
    } catch (e) {
      toasts.push({ message: on ? "Couldn't turn on live updates" : "Couldn't delete the live card", detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    } finally {
      busy = false;
    }
  }
</script>

<section class="card block friends" aria-label="Friends">
  <div class="block-title">Friends <span class="muted">streaks and this week's XP</span></div>
  <p class="muted">
    Swap friend codes to compare. A code holds only your name, emoji, streak, best streak, this week's XP, level and when it was made. No tasks, courses, grades or anything else,
    and there's no server: friends see what you had when you made the code.
  </p>

  <div class="me">
    <label class="field">Emoji <input class="input emoji" bind:value={emoji} maxlength="8" onchange={saveProfile} aria-label="Your emoji" /></label>
    <label class="field grow">Name friends see <input class="input" bind:value={name} maxlength="24" onchange={saveProfile} placeholder="Me" aria-label="Your name" /></label>
  </div>
  <label class="field"
    >My friend code
    <input class="input mono" readonly value={code} aria-label="My friend code" onfocus={(e) => (e.currentTarget as HTMLInputElement).select()} />
  </label>
  <div class="row">
    <button class="btn sm primary" onclick={() => copy(code, 'Friend code')}>Copy code</button>
    <button class="btn sm" onclick={() => copy(link, 'Friend link')}>Copy link</button>
    {#if canShare}<button class="btn sm" onclick={share}>Share…</button>{/if}
  </div>

  <form class="row" onsubmit={add} aria-label="Add a friend">
    <input class="input grow" bind:value={paste} placeholder="Paste a friend's code or link" aria-label="Paste a friend's code" />
    <button class="btn" type="submit" disabled={!paste.trim()}>Add friend</button>
  </form>

  <div class="scroll">
    <table class="board" aria-label="Friends leaderboard">
      <thead><tr><th>#</th><th>Name</th><th>XP this week</th><th>Streak</th><th>Level</th><th>Updated</th><th></th></tr></thead>
      <tbody>
        {#each rows as r (r.card.id)}
          <tr class:me={r.me}>
            <td>{r.rank}</td>
            <td>{r.card.emoji} {r.card.name}{r.me ? ' (you)' : ''}</td>
            <td
              >{r.weekXp.toLocaleString()}{#if r.lastWeek && !r.me}<span class="muted" title="This card is from an earlier week"> · last week</span>{/if}</td
            >
            <td>🔥 {r.card.streak} <span class="muted">best {r.card.best}</span></td>
            <td>{r.card.lvl}</td>
            <td class:stale={r.stale}>{r.me ? 'now' : ago(r.card.at)}{r.card.pid && !r.me ? ' · live' : ''}</td>
            <td>
              {#if !r.me}<button class="btn ghost sm" onclick={() => friends.remove(r.card.id)} aria-label="Remove {r.card.name}">✕</button>{/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if !friends.list.length}
    <p class="muted">No friends yet. Send your code, and paste theirs above.</p>
  {:else if anyStale}
    <p class="nudge">⏳ Some cards are a few days old or from last week. Swap fresh codes to see where everyone is now.</p>
  {/if}

  {#if liveAvailable}
    <details class="live">
      <summary>Live updates (optional, uses this site's account server)</summary>
      <p class="muted">
        With an account, your card is also kept in one row on the site's server under a random id, so friends who have your code see it update without a new code. Only that card is
        stored; anyone with the id can read it, and only you can change it. Turning it off deletes the row.
      </p>
      {#if !account.userId}
        <p class="muted">Sign in first (Settings → Account).</p>
      {:else}
        <label class="check"
          ><input type="checkbox" checked={friends.liveOn} disabled={busy} onchange={(e) => toggleLive((e.currentTarget as HTMLInputElement).checked)} /> Keep my card live</label
        >
        {#if friends.liveError}<p class="muted">{friends.liveError}</p>{/if}
      {/if}
      {#if friends.list.some((f) => f.card.pid)}<button class="btn sm" onclick={() => pull()} disabled={busy}>Refresh live cards</button>{/if}
    </details>
  {/if}
</section>

<style>
  .friends {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
    margin: 0;
  }
  .me,
  .row {
    display: flex;
    gap: 8px;
    align-items: end;
    flex-wrap: wrap;
  }
  .grow {
    flex: 1;
    min-width: 160px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
  }
  .emoji {
    width: 64px;
    text-align: center;
  }
  .mono {
    font-family: var(--mono);
    font-size: 12px;
  }
  .scroll {
    overflow-x: auto;
  }
  .board {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .board th {
    text-align: left;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    padding: 4px 6px;
  }
  .board td {
    padding: 6px;
    border-top: 1px solid var(--border);
  }
  .board tr.me td {
    font-weight: 700;
  }
  .stale {
    color: var(--warning, #f59e0b);
  }
  .nudge {
    font-size: 13px;
    margin: 0;
  }
  .check {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 13px;
  }
  .live {
    font-size: 13px;
  }
  .live summary {
    cursor: pointer;
    color: var(--text-muted);
  }
  @media (max-width: 560px) {
    .board th:nth-child(5),
    .board td:nth-child(5) {
      display: none;
    }
  }
</style>
