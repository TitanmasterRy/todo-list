<script lang="ts">
  // Play → Study games: games built on your notecard decks. Loaded on demand from PlayView.
  import { arcade } from '../../lib/arcade.svelte';
  import { store } from '../../lib/store.svelte';
  import { ui } from '../../lib/ui.svelte';
  import { BOSS_MIN_CARDS, MATCH_MIN_CARDS, canBattle, canMatch, formatTime, playableCards } from '../../lib/studygames';
  import { CROSSWORD_MIN_CARDS, canCrossword } from '../../lib/crossword';
  import { RACE_MIN_QUIZ, canRaceQuiz, loadGhosts, raceFromCards, raceFromQuiz } from '../../lib/quizrace';
  import { loadQuizSets, type QuizSet } from '../../lib/quizmaker';
  import type { Card, Deck } from '../../lib/types';
  import BossBattle from './BossBattle.svelte';
  import MatchRush from './MatchRush.svelte';
  import Crossword from './Crossword.svelte';
  import QuizRace from './QuizRace.svelte';

  type GameId = 'boss' | 'match' | 'crossword' | 'race';
  const GAMES: { id: GameId; name: string; emoji: string; blurb: string }[] = [
    { id: 'boss', name: 'Boss battle', emoji: '🐉', blurb: 'Pick the right answer to hit the boss. Wrong answers hurt you.' },
    { id: 'match', name: 'Match rush', emoji: '⚡', blurb: 'Match each term to its definition against the clock.' },
    { id: 'crossword', name: 'Crossword', emoji: '🧩', blurb: 'A crossword made from your vocab. Solve it fast for a best time.' },
    { id: 'race', name: 'Quiz race', emoji: '🏁', blurb: 'Race the ghost of your best run through ten quick questions.' },
  ];
  const MIN_TEXT: Record<GameId, string> = {
    boss: `Needs at least ${BOSS_MIN_CARDS} cards with different answers.`,
    match: `Needs at least ${MATCH_MIN_CARDS} cards.`,
    crossword: `Needs at least ${CROSSWORD_MIN_CARDS} cards with a short answer (one to three words, up to 15 letters).`,
    race: `Needs at least ${BOSS_MIN_CARDS} cards with different answers.`,
  };
  let game = $state<GameId | null>(null);
  let playing = $state<{ deck: Deck; cards: Card[] } | null>(null);
  let racingSet = $state<QuizSet | null>(null);
  const info = $derived(GAMES.find((g) => g.id === game));
  const decks = $derived(
    store.decks.map((d) => {
      const cards = playableCards(store.cards.filter((c) => c.deckId === d.id));
      return { deck: d, cards, ok: game === 'match' ? canMatch(cards) : game === 'crossword' ? canCrossword(cards) : canBattle(cards) };
    }),
  );
  // quiz race can also run a Tools → Quiz maker set (read when the race picker opens)
  const quizSets = $derived(game === 'race' ? loadQuizSets().map((s) => ({ set: s, ok: canRaceQuiz(s) })) : []);
  const ghosts = $derived(game === 'race' && !playing && !racingSet ? loadGhosts() : {});
  const ghostText = (key: string): string => {
    const g = ghosts[key];
    return g ? `👻 ${g.hits.length}/${g.n} in ${formatTime(g.total)}` : '';
  };
  const bestFor = (id: GameId, deckId: string): string => {
    if (id === 'boss') return arcade.scores[`boss:${deckId}`] ? `🏆 ${arcade.scores[`boss:${deckId}`].toLocaleString()}` : '';
    if (id === 'race') return ghostText(`deck:${deckId}`);
    const t = arcade.times[`${id}:${deckId}`];
    return t !== undefined ? `⏱ best ${formatTime(t)}` : '';
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
{:else if playing && game === 'crossword'}
  <Crossword deck={playing.deck} cards={playing.cards} onexit={() => (playing = null)} />
{:else if playing && game === 'race'}
  {@const p = playing}
  <QuizRace title={p.deck.name} raceKey={`deck:${p.deck.id}`} make={() => raceFromCards(p.cards)} onexit={() => (playing = null)} />
{:else if racingSet && game === 'race'}
  {@const s = racingSet}
  <QuizRace title={s.title} raceKey={`quiz:${s.id}`} make={() => raceFromQuiz(s)} onexit={() => (racingSet = null)} />
{:else if info}
  <div class="bar">
    <button class="btn ghost sm" onclick={() => (game = null)}>← Study games</button>
    <h2>{info.emoji} {info.name}</h2>
  </div>
  {#if !store.decks.length && !quizSets.length}
    <div class="card note">
      <p>You don't have any notecard decks yet. Make one and come back to play with it.</p>
      <button class="btn primary sm" onclick={openNotecards}>Open Notecards</button>
    </div>
  {:else}
    <p class="muted">{info.blurb} Pick a deck:</p>
    <div class="decks stagger">
      {#each decks as d (d.deck.id)}
        <button class="card deck" disabled={!d.ok} onclick={() => (playing = { deck: d.deck, cards: [...d.cards] })}>
          <span class="dk" aria-hidden="true">🗂️</span>
          <span class="n">{d.deck.name}</span>
          <span class="m">{d.cards.length} card{d.cards.length === 1 ? '' : 's'}{bestFor(info.id, d.deck.id) ? ` · ${bestFor(info.id, d.deck.id)}` : ''}</span>
          {#if !d.ok}
            <span class="why">{MIN_TEXT[info.id]} Add more in Notecards.</span>
          {/if}
        </button>
      {/each}
    </div>
    {#if quizSets.length}
      <h3 class="sets">Quiz sets from Tools → Quiz maker</h3>
      <div class="decks stagger">
        {#each quizSets as q (q.set.id)}
          <button class="card deck" disabled={!q.ok} onclick={() => (racingSet = q.set)}>
            <span class="dk" aria-hidden="true">📝</span>
            <span class="n">{q.set.title}</span>
            <span class="m"
              >{q.set.questions.length} question{q.set.questions.length === 1 ? '' : 's'}{ghostText(`quiz:${q.set.id}`) ? ` · ${ghostText(`quiz:${q.set.id}`)}` : ''}</span
            >
            {#if !q.ok}<span class="why">Needs at least {RACE_MIN_QUIZ} complete questions with choices.</span>{/if}
          </button>
        {/each}
      </div>
    {/if}
  {/if}
{:else}
  <div class="lobby stagger">
    {#each GAMES as g, i (g.id)}
      <button class="card tile" style="--hue:{(i * 71 + 250) % 360}" onclick={() => (game = g.id)}>
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
    gap: 10px;
  }
  /* every game gets its own hue for a colored glow pool behind the emoji, like the casino lobby */
  .tile {
    position: relative;
    display: grid;
    gap: 2px;
    justify-items: start;
    text-align: left;
    padding: 16px 14px 14px;
    overflow: hidden;
    background: radial-gradient(70% 60% at 100% 0%, hsl(var(--hue) 90% 60% / 0.22), transparent 70%), var(--bg-elev);
  }
  .tile::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(115deg, transparent 40%, rgba(255, 255, 255, 0.12) 50%, transparent 60%);
    transform: translateX(-130%);
    pointer-events: none;
  }
  .tile:hover::before {
    animation: sheen 700ms var(--ease);
  }
  .tile:hover {
    border-color: hsl(var(--hue) 80% 60% / 0.7);
    box-shadow:
      var(--shadow),
      0 0 30px -8px hsl(var(--hue) 90% 60% / 0.6);
    transform: translateY(-3px) scale(1.02);
  }
  .tile:hover .e {
    transform: scale(1.25) rotate(-8deg);
  }
  .e {
    font-size: 32px;
    line-height: 1;
    height: 40px;
    display: grid;
    align-items: center;
    filter: drop-shadow(0 4px 8px hsl(var(--hue) 90% 50% / 0.5));
    transition: transform var(--dur-slow) var(--spring);
  }
  .n {
    font-weight: 800;
  }
  .tile .n {
    margin-top: 4px;
  }
  .b,
  .m {
    font-size: 12px;
    color: var(--text-muted);
  }
  .m {
    font-variant-numeric: tabular-nums;
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
    font-weight: 800;
  }
  .decks {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 8px;
  }
  /* deck cards: an accent-tinted corner, a folder badge that tilts on hover, dashed when the deck is too small */
  .deck {
    position: relative;
    display: grid;
    grid-template-columns: 36px 1fr;
    gap: 2px 10px;
    align-items: center;
    text-align: left;
    padding: 12px;
    overflow: hidden;
    background: radial-gradient(60% 50% at 100% 0%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 70%), var(--bg-elev);
  }
  .deck > :not(.dk) {
    grid-column: 2;
  }
  .dk {
    grid-row: span 2;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    font-size: 20px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 28%, transparent), color-mix(in srgb, var(--accent-2) 10%, transparent));
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
    transition: transform var(--dur-slow) var(--spring);
  }
  .deck:not(:disabled):hover .dk {
    transform: scale(1.12) rotate(-6deg);
  }
  .deck:disabled {
    cursor: default;
    border-style: dashed;
    background: var(--bg-elev);
    opacity: 0.75;
  }
  .deck:disabled:hover {
    transform: none;
    border-color: var(--border);
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow-sm);
  }
  .deck:disabled .dk {
    filter: grayscale(1);
    opacity: 0.6;
  }
  .why {
    font-size: 12px;
    color: var(--text);
  }
  .sets {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    margin: 16px 0 8px;
  }
  .sets::before {
    content: '';
    width: 4px;
    height: 14px;
    border-radius: 2px;
    background: var(--grad-accent);
    box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 50%, transparent);
    flex-shrink: 0;
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
