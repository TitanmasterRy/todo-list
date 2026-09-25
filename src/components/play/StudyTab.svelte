<script lang="ts">
  // Play → Study games: games built on your notecard decks. Loaded on demand from PlayView.
  import { arcade } from '../../lib/arcade.svelte';
  import { store } from '../../lib/store.svelte';
  import { ui } from '../../lib/ui.svelte';
  import { BOSS_MIN_CARDS, MATCH_MIN_CARDS, canBattle, canMatch, formatTime, playableCards } from '../../lib/studygames';
  import type { Card, Deck } from '../../lib/types';
  import BossBattle from './BossBattle.svelte';
  import MatchRush from './MatchRush.svelte';

  type GameId = 'boss' | 'match';
  const GAMES: { id: GameId; name: string; emoji: string; blurb: string }[] = [
    { id: 'boss', name: 'Boss battle', emoji: '🐉', blurb: 'Pick the right answer to hit the boss. Wrong answers hurt you.' },
    { id: 'match', name: 'Match rush', emoji: '⚡', blurb: 'Match each term to its definition against the clock.' },
  ];
  let game = $state<GameId | null>(null);
  let playing = $state<{ deck: Deck; cards: Card[] } | null>(null);
  const info = $derived(GAMES.find((g) => g.id === game));
  const decks = $derived(
    store.decks.map((d) => {
      const cards = playableCards(store.cards.filter((c) => c.deckId === d.id));
      return { deck: d, cards, ok: game === 'match' ? canMatch(cards) : canBattle(cards) };
    }),
  );
  const bestFor = (id: GameId, deckId: string): string => {
    if (id === 'boss') return arcade.scores[`boss:${deckId}`] ? `🏆 ${arcade.scores[`boss:${deckId}`].toLocaleString()}` : '';
    return arcade.times[`match:${deckId}`] !== undefined ? `⏱ best ${formatTime(arcade.times[`match:${deckId}`])}` : '';
  };
  function openNotecards() {
    ui.toolsTab = 'notecards';
    store.go('tools');
  }
</script>

{#if playing && game === 'boss'}
  <BossBattle deck={playing.deck} cards={playing.cards} onexit={() => (playing = null)} />
{:else if playing && game === 'match'}
  <MatchRush deck={playing.deck} cards={playing.cards} onexit={() => (playing = null)} />
{:else if info}
  <div class="bar">
    <button class="btn ghost sm" onclick={() => (game = null)}>← Study games</button>
    <h2>{info.emoji} {info.name}</h2>
  </div>
  {#if !store.decks.length}
    <div class="card note">
      <p>You don't have any notecard decks yet. Make one and come back to play with it.</p>
      <button class="btn primary sm" onclick={openNotecards}>Open Notecards</button>
    </div>
  {:else}
    <p class="muted">{info.blurb} Pick a deck:</p>
    <div class="decks">
      {#each decks as d (d.deck.id)}
        <button class="card deck" disabled={!d.ok} onclick={() => (playing = { deck: d.deck, cards: [...d.cards] })}>
          <span class="n">{d.deck.name}</span>
          <span class="m">{d.cards.length} card{d.cards.length === 1 ? '' : 's'}{bestFor(info.id, d.deck.id) ? ` · ${bestFor(info.id, d.deck.id)}` : ''}</span>
          {#if !d.ok}
            <span class="why"
              >{info.id === 'boss' ? `Needs at least ${BOSS_MIN_CARDS} cards with different answers.` : `Needs at least ${MATCH_MIN_CARDS} cards.`} Add more in Notecards.</span
            >
          {/if}
        </button>
      {/each}
    </div>
  {/if}
{:else}
  <div class="lobby">
    {#each GAMES as g (g.id)}
      <button class="card tile" onclick={() => (game = g.id)}>
        <span class="e" aria-hidden="true">{g.emoji}</span>
        <span class="n">{g.name}</span>
        <span class="b">{g.blurb}</span>
      </button>
    {/each}
  </div>
  <p class="muted">Free to play, no vouchers. These games use your notecards but don't change when cards are due; study in Tools → Notecards for that.</p>
{/if}

<style>
  .lobby {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 8px;
  }
  .tile {
    display: grid;
    gap: 2px;
    justify-items: start;
    text-align: left;
    padding: 14px;
    transition:
      transform var(--dur) var(--spring),
      border-color var(--dur);
  }
  .tile:hover {
    transform: translateY(-2px);
    border-color: var(--accent);
  }
  .e {
    font-size: 30px;
  }
  .n {
    font-weight: 700;
  }
  .b,
  .m {
    font-size: 12px;
    color: var(--text-muted);
  }
  .bar {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .bar h2 {
    font-size: 18px;
    margin: 0;
  }
  .decks {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 8px;
  }
  .deck {
    display: grid;
    gap: 2px;
    text-align: left;
    padding: 12px;
  }
  .deck:not(:disabled):hover {
    border-color: var(--accent);
  }
  .deck:disabled {
    cursor: default;
    border-style: dashed;
  }
  .why {
    font-size: 12px;
    color: var(--text);
  }
  .note p {
    margin: 0 0 8px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
    margin: 12px 0;
  }
</style>
