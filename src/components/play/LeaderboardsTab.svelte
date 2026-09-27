<script lang="ts">
  // Play → Leaderboards: chips and best arcade scores among friends, from friend codes. Opt-in: your card carries
  // your chip balance or scores only while the toggles here are on.
  import { onMount } from 'svelte';
  import { friends } from '../../lib/social/friends.svelte';
  import { chipBoard, encodeCard, scoreBoards, type ExtraRow } from '../../lib/friends';
  import { arcade } from '../../lib/arcade.svelte';
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';

  onMount(() => void arcade.load());
  // re-made when the ledger, scores or the toggles change
  const me = $derived.by(() => {
    void store.ledger.length;
    void arcade.scores;
    void friends.profile;
    return friends.myCard();
  });
  const code = $derived(encodeCard(me));
  const chips = $derived(chipBoard(me, friends.list));
  const boards = $derived(scoreBoards(me, friends.list));
  const title = (id: string) => {
    const g = arcade.games.find((x) => x.id === id);
    return g ? `${g.emoji ?? '🎮'} ${g.title}` : id;
  };
  let paste = $state('');

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      toasts.push({ message: 'Friend code copied', kind: 'success', emoji: '📋' });
    } catch {
      toasts.push({ message: "Couldn't copy: select it and copy it", kind: 'warn' });
    }
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
  const who = (r: ExtraRow) => `${r.card.emoji} ${r.card.name}${r.me ? ' (you)' : ''}`;
</script>

<section class="card share" aria-label="What your friend code shares">
  <h2 class="sec">Share with friends</h2>
  <p class="muted">
    Leaderboards come from friend codes (Stats → Friends), with no server. Nothing below goes into your code unless you switch it on, and friends only see it in the next code you
    send them (or your live card, if that's on).
  </p>
  <label class="check"
    ><input type="checkbox" checked={!!friends.profile.shareChips} onchange={(e) => friends.setSharing({ shareChips: e.currentTarget.checked })} /> Share my chip balance</label
  >
  <label class="check"
    ><input type="checkbox" checked={!!friends.profile.shareScores} onchange={(e) => friends.setSharing({ shareScores: e.currentTarget.checked })} /> Share my best arcade scores (up
    to 8)</label
  >
  <div class="row">
    <input class="input mono grow" readonly value={code} aria-label="My friend code" onfocus={(e) => (e.currentTarget as HTMLInputElement).select()} />
    <button class="btn sm primary" onclick={copy}>Copy my code</button>
  </div>
  <form class="row" onsubmit={add} aria-label="Add a friend">
    <input class="input grow" bind:value={paste} placeholder="Paste a friend's code" aria-label="Paste a friend's code" />
    <button class="btn sm" type="submit" disabled={!paste.trim()}>Add friend</button>
  </form>
</section>

<h2 class="sec">🎰 Chips</h2>
{#if chips.length}
  <table class="board" aria-label="Chip leaderboard">
    <thead><tr><th>#</th><th>Name</th><th>Chips</th></tr></thead>
    <tbody>
      {#each chips as r (r.card.id)}
        <tr class:me={r.me}><td>{r.rank}</td><td>{who(r)}</td><td>{r.value.toLocaleString()}</td></tr>
      {/each}
    </tbody>
  </table>
{:else}
  <p class="muted">No chip balances shared yet{friends.profile.shareChips ? '' : ': switch on "Share my chip balance" to join'}.</p>
{/if}
{#if !friends.profile.shareChips && chips.length}<p class="muted">You're not on this board: your chip balance isn't shared.</p>{/if}

<h2 class="sec">🕹️ Arcade high scores</h2>
{#if boards.length}
  <div class="boards">
    {#each boards as b (b.game)}
      <table class="board" aria-label="{title(b.game)} leaderboard">
        <caption>{title(b.game)}</caption>
        <tbody>
          {#each b.rows as r (r.card.id)}
            <tr class:me={r.me}><td>{r.rank}</td><td>{who(r)}</td><td>{r.value.toLocaleString()}</td></tr>
          {/each}
        </tbody>
      </table>
    {/each}
  </div>
{:else}
  <p class="muted">No scores shared yet. Play something in the Arcade{friends.profile.shareScores ? '' : ' and switch on "Share my best arcade scores"'}.</p>
{/if}

<style>
  .share {
    display: grid;
    gap: 8px;
    margin-bottom: 8px;
  }
  .sec {
    font-size: 15px;
    margin: 14px 0 8px;
  }
  .share .sec {
    margin: 0;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
    margin: 0;
  }
  .check {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 14px;
  }
  .row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .grow {
    flex: 1;
    min-width: 160px;
  }
  .mono {
    font-family: var(--mono);
    font-size: 11px;
  }
  .boards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 10px;
  }
  .board {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  caption {
    text-align: start;
    font-weight: 700;
    padding-bottom: 4px;
  }
  .board th {
    text-align: start;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    padding: 4px 6px;
  }
  .board td {
    padding: 5px 6px;
    border-top: 1px solid var(--border);
  }
  .board td:last-child {
    text-align: end;
    font-variant-numeric: tabular-nums;
  }
  .board tr.me td {
    font-weight: 700;
  }
</style>
