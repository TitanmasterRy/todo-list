<script lang="ts">
  import { onDestroy, type Component } from 'svelte';
  import { economy } from '../../lib/economy.svelte';
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { addCasinoMinutes, casinoMinutesLeft } from '../../lib/parental';
  import '../casino/casino.css';
  import Slots from '../casino/Slots.svelte';
  import Blackjack from '../casino/Blackjack.svelte';
  import Roulette from '../casino/Roulette.svelte';
  import VideoPoker from '../casino/VideoPoker.svelte';
  import Baccarat from '../casino/Baccarat.svelte';
  import Craps from '../casino/Craps.svelte';
  import HiLo from '../casino/HiLo.svelte';
  import Plinko from '../casino/Plinko.svelte';
  import Keno from '../casino/Keno.svelte';
  import Mines from '../casino/Mines.svelte';
  import Dice from '../casino/Dice.svelte';
  import Wheel from '../casino/Wheel.svelte';
  import Scratch from '../casino/Scratch.svelte';

  const GAMES: { id: string; name: string; emoji: string; blurb: string; comp: Component }[] = [
    { id: 'slots', name: 'Slots', emoji: '🎰', blurb: 'Three reels, themed symbols', comp: Slots },
    { id: 'blackjack', name: 'Blackjack', emoji: '🃏', blurb: 'Beat the dealer to 21', comp: Blackjack },
    { id: 'roulette', name: 'Roulette', emoji: '🎡', blurb: 'European single zero', comp: Roulette },
    { id: 'videopoker', name: 'Video poker', emoji: '♠️', blurb: 'Jacks or Better 9/6', comp: VideoPoker },
    { id: 'baccarat', name: 'Baccarat', emoji: '💠', blurb: 'Player, Banker or Tie', comp: Baccarat },
    { id: 'craps', name: 'Craps', emoji: '🎲', blurb: 'Pass line and field', comp: Craps },
    { id: 'hilo', name: 'Hi-Lo', emoji: '⬆️', blurb: 'Higher or lower, cash out', comp: HiLo },
    { id: 'plinko', name: 'Plinko', emoji: '🔻', blurb: 'Drop the ball', comp: Plinko },
    { id: 'keno', name: 'Keno', emoji: '🔢', blurb: 'Pick up to 10 numbers', comp: Keno },
    { id: 'mines', name: 'Mines', emoji: '💎', blurb: 'Find gems, dodge mines', comp: Mines },
    { id: 'dice', name: 'Dice', emoji: '🎯', blurb: 'Roll over or under', comp: Dice },
    { id: 'wheel', name: 'Big Six', emoji: '🎠', blurb: 'Money wheel', comp: Wheel },
    { id: 'scratch', name: 'Scratch cards', emoji: '🎟️', blurb: 'Match three', comp: Scratch },
  ];
  let current = $state<string | null>(null);
  const game = $derived(GAMES.find((g) => g.id === current));
  const net = $derived(economy.session.returned - economy.session.wagered);

  // Homework-break reminder after N minutes of play
  const timer = setInterval(() => {
    const mins = store.settings.casinoBreakMin;
    const s = economy.session;
    if (!mins || !s.startedAt || s.reminded) return;
    if (Date.now() - s.startedAt >= mins * 60_000) {
      s.reminded = true;
      toasts.push({
        message: `You've played ${mins} minutes`,
        detail: 'Time for a homework break? Your chips will be here later.',
        kind: 'warn',
        emoji: '⏰',
        timeout: 15000,
        action: { label: 'Back to Today', onClick: () => store.go('today') },
      });
    }
  }, 15_000);
  // daily time limit (Settings → Economy → Parent lock): count minutes while the casino is open and visible
  const minutesLeft = $derived(casinoMinutesLeft(store.settings.casinoDailyLimitMin, store.settings.casinoMinutesByDay ?? {}, store.today));
  const clock = setInterval(() => {
    if (!store.settings.casinoDailyLimitMin || document.visibilityState !== 'visible') return;
    store.updateSettings({ casinoMinutesByDay: addCasinoMinutes(store.settings.casinoMinutesByDay ?? {}, store.today, 1) });
  }, 60_000);
  onDestroy(() => {
    clearInterval(clock);
    clearInterval(timer);
    economy.resetSession();
  });
</script>

{#if minutesLeft <= 0}
  <div class="card note">
    <strong>Casino time is up for today.</strong> The daily limit ({store.settings.casinoDailyLimitMin} min) was set in Settings → Economy. Your chips are safe; come back tomorrow.
  </div>
{:else}
  {#if Number.isFinite(minutesLeft) && minutesLeft <= 5}
    <div class="card note">⏳ {minutesLeft} minute{minutesLeft === 1 ? '' : 's'} of casino time left today.</div>
  {/if}
  {#if economy.wallet.chips < 10 && !game}
    <div class="card note">
      You're out of chips. Buy a stack in the <strong>Shop</strong> with coins from homework, or close your daily ring for 100 free chips.
    </div>
  {/if}

  {#if game}
    <div class="bar">
      <button class="btn ghost sm" onclick={() => (current = null)}>← All games</button>
      <h2>{game.emoji} {game.name}</h2>
      <div class="grow"></div>
      {#if economy.session.rounds}
        <span class="sess">Session: {economy.session.rounds} rounds · <span class:pos={net > 0} class:neg={net < 0}>{net > 0 ? '+' : ''}{net.toLocaleString()}</span></span>
      {/if}
    </div>
    {@const G = game.comp}
    <G />
  {:else}
    <div class="lobby">
      {#each GAMES as g (g.id)}
        <button class="card tile" onclick={() => (current = g.id)}>
          <span class="e">{g.emoji}</span>
          <span class="n">{g.name}</span>
          <span class="b">{g.blurb}</span>
        </button>
      {/each}
    </div>
    <h3 class="ach-h">Casino achievements <span class="count">{economy.achievements.filter((a) => a.unlocked).length}/{economy.achievements.length}</span></h3>
    <div class="ach">
      {#each economy.achievements as a (a.id)}
        <div class="card a" class:on={a.unlocked} title={a.description}>
          <span class="ae" aria-hidden="true">{a.unlocked ? a.emoji : '🔒'}</span>
          <span class="an">{a.name}</span>
          <span class="ad">{a.description} · {a.chips} chips</span>
        </div>
      {/each}
    </div>
    <p class="muted">
      Play chips only: no real money, and chips never turn back into coins. Every game shows its odds. A reminder pops up after {store.settings.casinoBreakMin || 'no'} minutes of play
      (Settings → Economy).
    </p>
  {/if}
{/if}

<style>
  .ach-h {
    font-size: 15px;
    margin: 18px 0 8px;
  }
  .count {
    color: var(--text-muted);
    font-weight: 400;
  }
  .ach {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 6px;
  }
  .a {
    display: grid;
    gap: 2px;
    padding: 10px;
  }
  .a:not(.on) {
    border-style: dashed;
  }
  .a:not(.on) .ae {
    filter: grayscale(1);
    opacity: 0.6;
  }
  .ae {
    font-size: 22px;
  }
  .an {
    font-weight: 700;
    font-size: 13px;
  }
  .ad {
    font-size: 11px;
    color: var(--text-muted);
  }
  .lobby {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
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
    font-size: 28px;
  }
  .n {
    font-weight: 700;
  }
  .b {
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
  .grow {
    flex: 1;
  }
  .sess {
    font-size: 13px;
    color: var(--text-muted);
  }
  .pos {
    color: var(--success-text);
    font-weight: 700;
  }
  .neg {
    color: var(--danger-text);
    font-weight: 700;
  }
  .note {
    margin-bottom: 10px;
    font-size: 14px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
    margin-top: 14px;
  }
</style>
