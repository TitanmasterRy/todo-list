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

<section class="card share glow-edge" aria-label="What your friend code shares">
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
  <table class="board stagger" aria-label="Chip leaderboard">
    <thead><tr><th>#</th><th>Name</th><th>Chips</th></tr></thead>
    <tbody>
      {#each chips as r (r.card.id)}
        <tr class:me={r.me} class:top1={r.rank === 1} class:top2={r.rank === 2} class:top3={r.rank === 3}
          ><td><span class="rank">{r.rank}</span></td><td>{who(r)}</td><td>{r.value.toLocaleString()}</td></tr
        >
      {/each}
    </tbody>
  </table>
{:else}
  <p class="muted">No chip balances shared yet{friends.profile.shareChips ? '' : ': switch on "Share my chip balance" to join'}.</p>
{/if}
{#if !friends.profile.shareChips && chips.length}<p class="muted">You're not on this board: your chip balance isn't shared.</p>{/if}

<h2 class="sec">🕹️ Arcade high scores</h2>
{#if boards.length}
  <div class="boards stagger">
    {#each boards as b (b.game)}
      <table class="board stagger" aria-label="{title(b.game)} leaderboard">
        <caption>{title(b.game)}</caption>
        <tbody>
          {#each b.rows as r (r.card.id)}
            <tr class:me={r.me} class:top1={r.rank === 1} class:top2={r.rank === 2} class:top3={r.rank === 3}
              ><td><span class="rank">{r.rank}</span></td><td>{who(r)}</td><td>{r.value.toLocaleString()}</td></tr
            >
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
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 800;
    margin: 18px 0 8px;
    letter-spacing: -0.01em;
  }
  .sec::before {
    content: '';
    width: 4px;
    height: 16px;
    border-radius: 2px;
    background: var(--grad-accent);
    box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 50%, transparent);
    flex-shrink: 0;
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
    gap: 8px;
    align-items: center;
    font-size: 14px;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    box-shadow: inset 0 1px 0 var(--sheen);
    transition: border-color var(--dur);
  }
  .check:hover {
    border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  }
  .check input {
    accent-color: var(--accent);
    width: 16px;
    height: 16px;
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
  /* boards: rows as pills, the top three with gold, silver and bronze medals, your row glowing in the accent */
  .board {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0 4px;
    font-size: 13px;
  }
  caption {
    text-align: start;
    font-weight: 800;
    padding-bottom: 2px;
  }
  .board th {
    text-align: start;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    padding: 2px 8px;
  }
  .board td {
    padding: 6px 8px;
    background: var(--bg-elev);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    transition:
      background var(--dur),
      border-color var(--dur);
  }
  .board td:first-child {
    border-inline-start: 1px solid var(--border);
    border-start-start-radius: var(--radius-sm);
    border-end-start-radius: var(--radius-sm);
    width: 40px;
  }
  .board td:last-child {
    border-inline-end: 1px solid var(--border);
    border-start-end-radius: var(--radius-sm);
    border-end-end-radius: var(--radius-sm);
    text-align: end;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }
  .board tbody tr:hover td {
    background: var(--bg-hover);
  }
  .rank {
    display: inline-grid;
    place-items: center;
    min-width: 24px;
    height: 24px;
    padding: 0 6px;
    border-radius: 999px;
    font-weight: 800;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
  }
  .top1 .rank,
  .top2 .rank,
  .top3 .rank {
    border-color: transparent;
    color: #2b2100;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.5),
      0 2px 8px -2px rgba(0, 0, 0, 0.4);
  }
  .top1 .rank {
    background: var(--grad-gold);
  }
  .top2 .rank {
    background: linear-gradient(135deg, #f4f6fb, #c3c9d6 55%, #9aa3b5);
    color: #1c2030;
  }
  .top3 .rank {
    background: linear-gradient(135deg, #f0b98a, #cd7f32 55%, #a05a1c);
    color: #2b1600;
  }
  .top1 td {
    background: linear-gradient(90deg, color-mix(in srgb, var(--gold) 18%, var(--bg-elev)), var(--bg-elev));
    border-color: color-mix(in srgb, var(--gold) 45%, var(--border));
  }
  .top2 td {
    background: linear-gradient(90deg, color-mix(in srgb, #c3c9d6 18%, var(--bg-elev)), var(--bg-elev));
    border-color: color-mix(in srgb, #c3c9d6 45%, var(--border));
  }
  .top3 td {
    background: linear-gradient(90deg, color-mix(in srgb, #cd7f32 18%, var(--bg-elev)), var(--bg-elev));
    border-color: color-mix(in srgb, #cd7f32 45%, var(--border));
  }
  .board tr.me td {
    font-weight: 700;
    border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
    box-shadow: 0 0 16px -6px color-mix(in srgb, var(--accent) 70%, transparent);
  }
  .board tr.me td:nth-child(2) {
    color: var(--accent-text);
  }
</style>
