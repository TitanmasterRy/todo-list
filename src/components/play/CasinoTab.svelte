<script lang="ts">
  import { onDestroy, type Component } from 'svelte';
  import { economy } from '../../lib/economy.svelte';
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { artUrl } from '../../lib/art.svelte';
  import { addCasinoMinutes, casinoMinutesLeft } from '../../lib/parental';
  import '../casino/casino.css';
  import ArtImg from '../ArtImg.svelte';
  import ChipBalance from '../casino/ChipBalance.svelte';
  import LobbyArt from '../casino/LobbyArt.svelte';
  import { sfx } from '../casino/sfx';

  type Cat = 'tables' | 'cards' | 'slots' | 'quick';
  interface Game {
    id: string;
    name: string;
    emoji: string;
    blurb: string;
    cat: Cat;
    load: () => Promise<{ default: Component }>;
  }
  // every game is its own chunk, loaded when opened
  const GAMES: Game[] = [
    { id: 'blackjack', name: 'Blackjack', emoji: '🃏', blurb: 'Beat the dealer to 21', cat: 'tables', load: () => import('../casino/Blackjack.svelte') },
    { id: 'roulette', name: 'Roulette', emoji: '🎡', blurb: 'European single zero', cat: 'tables', load: () => import('../casino/Roulette.svelte') },
    { id: 'baccarat', name: 'Baccarat', emoji: '💠', blurb: 'Player, Banker or Tie', cat: 'tables', load: () => import('../casino/Baccarat.svelte') },
    { id: 'craps', name: 'Craps', emoji: '🎲', blurb: 'Pass line and field', cat: 'tables', load: () => import('../casino/Craps.svelte') },
    { id: 'videopoker', name: 'Video poker', emoji: '♠️', blurb: 'Jacks or Better 9/6', cat: 'cards', load: () => import('../casino/VideoPoker.svelte') },
    { id: 'threecard', name: 'Three Card Poker', emoji: '🂱', blurb: 'Ante, Play and Pair Plus', cat: 'cards', load: () => import('../casino/ThreeCardPoker.svelte') },
    { id: 'letitride', name: 'Let It Ride', emoji: '💵', blurb: 'Pull back two of three bets', cat: 'cards', load: () => import('../casino/LetItRide.svelte') },
    { id: 'holdem', name: "Texas Hold'em", emoji: '🂡', blurb: 'Fixed-limit vs 1–3 bots', cat: 'cards', load: () => import('../casino/Holdem.svelte') },
    { id: 'hilo', name: 'Hi-Lo', emoji: '⬆️', blurb: 'Higher or lower, cash out', cat: 'cards', load: () => import('../casino/HiLo.svelte') },
    { id: 'slots', name: 'Slots', emoji: '🎰', blurb: 'Three reels, themed symbols', cat: 'slots', load: () => import('../casino/Slots.svelte') },
    { id: 'wheel', name: 'Big Six', emoji: '🎠', blurb: 'Money wheel', cat: 'slots', load: () => import('../casino/Wheel.svelte') },
    { id: 'plinko', name: 'Plinko', emoji: '🔻', blurb: 'Drop the ball', cat: 'slots', load: () => import('../casino/Plinko.svelte') },
    { id: 'keno', name: 'Keno', emoji: '🔢', blurb: 'Pick up to 10 numbers', cat: 'quick', load: () => import('../casino/Keno.svelte') },
    { id: 'mines', name: 'Mines', emoji: '💎', blurb: 'Find gems, dodge mines', cat: 'quick', load: () => import('../casino/Mines.svelte') },
    { id: 'dice', name: 'Dice', emoji: '🎯', blurb: 'Roll over or under', cat: 'quick', load: () => import('../casino/Dice.svelte') },
    { id: 'scratch', name: 'Scratch cards', emoji: '🎟️', blurb: 'Match three', cat: 'quick', load: () => import('../casino/Scratch.svelte') },
  ];
  const CATS: { id: Cat; name: string; icon: string }[] = [
    { id: 'tables', name: 'Tables', icon: '♣' },
    { id: 'cards', name: 'Cards', icon: '♠' },
    { id: 'slots', name: 'Slots & wheels', icon: '✦' },
    { id: 'quick', name: 'Quick games', icon: '⚡' },
  ];
  let current = $state<string | null>(null);
  const game = $derived(GAMES.find((g) => g.id === current));
  const loading = $derived(game ? game.load() : null);
  const net = $derived(economy.session.returned - economy.session.wagered);
  const felt = $derived(artUrl('casino/table-felt.webp'));

  function open(id: string) {
    sfx('chip');
    current = id;
    window.scrollTo?.({ top: 0, behavior: 'instant' as ScrollBehavior });
  }
  // lobby tiles lean toward the pointer, with a shine that follows it
  function tilt(e: PointerEvent) {
    if (e.pointerType !== 'mouse') return;
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', `${(0.5 - y) * 10}deg`);
    el.style.setProperty('--ry', `${(x - 0.5) * 12}deg`);
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
  }
  function untilt(e: PointerEvent) {
    const el = e.currentTarget as HTMLElement;
    el.style.removeProperty('--rx');
    el.style.removeProperty('--ry');
  }

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
  <div class="casino" style={felt ? `--cz-felt-art: url("${felt}")` : undefined}>
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
        <span class="gicon" aria-hidden="true">
          <ArtImg name="casino/lobby/{game.id}.webp" class="gimg">
            {#snippet fallback()}<LobbyArt id={game.id} />{/snippet}
          </ArtImg>
        </span>
        <h2>{game.name}</h2>
        <div class="grow"></div>
        {#if economy.session.rounds}
          <span class="sess"
            >Session: {economy.session.rounds} rounds · <span class:pos={net > 0} class:neg={net < 0}>{net > 0 ? '+' : ''}{net.toLocaleString()}</span></span
          >
        {/if}
        <ChipBalance />
      </div>
      {#key game.id}
        {#await loading}
          <div class="loadingtable" aria-busy="true"><span>Opening {game.name}…</span></div>
        {:then m}
          {#if m}<m.default />{/if}
        {/await}
      {/key}
    {:else}
      <header class="marquee">
        <span class="bulbs" aria-hidden="true"></span>
        <div class="sign">
          <span class="pre">Play chips only</span>
          <h2 class="title">Casino</h2>
          <span class="sub">16 games · every one shows its odds</span>
        </div>
        <div class="side">
          <ChipBalance />
          {#if economy.session.rounds}
            <span class="sess"
              >Session: {economy.session.rounds} rounds · <span class:pos={net > 0} class:neg={net < 0}>{net > 0 ? '+' : ''}{net.toLocaleString()}</span></span
            >
          {/if}
        </div>
      </header>

      {#each CATS as c (c.id)}
        <section class="cat" aria-labelledby="cat-{c.id}">
          <h3 id="cat-{c.id}" class="cat-h"><span class="ci" aria-hidden="true">{c.icon}</span>{c.name}</h3>
          <div class="lobby">
            {#each GAMES.filter((g) => g.cat === c.id) as g (g.id)}
              <button class="tile {g.cat}" onclick={() => open(g.id)} onpointermove={tilt} onpointerleave={untilt} data-game={g.id}>
                <span class="art" aria-hidden="true">
                  <ArtImg name="casino/lobby/{g.id}.webp" class="tileimg">
                    {#snippet fallback()}<LobbyArt id={g.id} />{/snippet}
                  </ArtImg>
                  <span class="shine"></span>
                </span>
                <span class="meta">
                  <span class="n">{g.name}</span>
                  <span class="b">{g.blurb}</span>
                </span>
              </button>
            {/each}
          </div>
        </section>
      {/each}

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
        Play chips only: no real money. Chips cash back into coins at half value, up to a daily limit (Wallet). Every game shows its odds. A reminder pops up after {store
          .settings.casinoBreakMin || 'no'} minutes of play (Settings → Economy).
      </p>
    {/if}
  </div>
{/if}

<style>
  /* ---------- marquee ---------- */
  .marquee {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
    padding: 20px 24px;
    margin-bottom: 18px;
    border-radius: 20px;
    color: #fff3cf;
    background:
      radial-gradient(ellipse at 20% 0%, rgba(255, 90, 110, 0.35), transparent 55%),
      radial-gradient(ellipse at 90% 100%, rgba(120, 80, 255, 0.35), transparent 60%),
      linear-gradient(135deg, #3b0a1a 0%, #1a0822 55%, #0c0a1f 100%);
    box-shadow:
      inset 0 0 0 2px #e7b84a,
      inset 0 0 0 5px #2a0d12,
      inset 0 0 0 6px rgba(231, 184, 74, 0.6),
      0 12px 30px -12px rgba(0, 0, 0, 0.6);
    overflow: hidden;
  }
  .bulbs {
    position: absolute;
    inset: 8px;
    border-radius: 14px;
    pointer-events: none;
    padding: 3px;
    background:
      radial-gradient(circle, #fff6c8 0 2px, #ffcf4a 2.6px, transparent 3.4px) 0 0 / 16px 16px,
      radial-gradient(circle, rgba(255, 207, 74, 0.35) 0 2px, transparent 3px) 8px 8px / 16px 16px;
    -webkit-mask:
      linear-gradient(#000 0 0) content-box exclude,
      linear-gradient(#000 0 0);
    mask:
      linear-gradient(#000 0 0) content-box exclude,
      linear-gradient(#000 0 0);
    animation: chase 1.1s steps(2) infinite;
    filter: drop-shadow(0 0 3px rgba(255, 207, 74, 0.9));
  }
  @keyframes chase {
    to {
      background-position:
        16px 0,
        24px 8px;
    }
  }
  .sign {
    position: relative;
    display: grid;
    gap: 0;
    padding-left: 6px;
  }
  .pre,
  .sub {
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #ffd98a;
    opacity: 0.9;
  }
  .sub {
    letter-spacing: 0.08em;
    text-transform: none;
    font-size: 13px;
    opacity: 0.8;
  }
  .title {
    margin: 0;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: clamp(34px, 6vw, 52px);
    line-height: 1.05;
    font-weight: 900;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    background: linear-gradient(180deg, #fffbe6 0%, #ffe07a 45%, #e3a51a 55%, #fff1b0 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    filter: drop-shadow(0 2px 0 #6b3a00) drop-shadow(0 0 16px rgba(255, 180, 40, 0.55));
  }
  .side {
    position: relative;
    display: grid;
    justify-items: end;
    gap: 6px;
  }
  .side .sess {
    color: #ffe6b0;
  }

  /* ---------- categories and tiles ---------- */
  .cat {
    margin-bottom: 16px;
  }
  .cat-h {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    margin: 0 0 8px;
    color: var(--text-muted);
  }
  .cat-h::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, color-mix(in srgb, var(--cz-gold) 60%, transparent), transparent);
  }
  .ci {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    font-size: 12px;
    color: #2a1a00;
    background: linear-gradient(180deg, #fff1b8, #e7b84a);
  }
  .lobby {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
    gap: 12px;
    perspective: 900px;
  }
  .tile {
    --rx: 0deg;
    --ry: 0deg;
    --mx: 50%;
    --my: 0%;
    position: relative;
    display: grid;
    grid-template-rows: auto 1fr;
    padding: 0;
    text-align: left;
    border-radius: 16px;
    overflow: hidden;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    color: var(--text);
    box-shadow: 0 6px 16px -8px rgba(0, 0, 0, 0.45);
    transform: rotateX(var(--rx)) rotateY(var(--ry));
    transition:
      transform 220ms var(--ease),
      box-shadow 220ms,
      border-color 220ms;
    transform-style: preserve-3d;
  }
  .tile:hover {
    transform: rotateX(var(--rx)) rotateY(var(--ry)) translateY(-4px) scale(1.02);
    border-color: color-mix(in srgb, var(--cz-gold) 70%, transparent);
    box-shadow:
      0 16px 30px -12px rgba(0, 0, 0, 0.55),
      0 0 0 1px color-mix(in srgb, var(--cz-gold) 50%, transparent),
      0 0 24px -6px rgba(231, 184, 74, 0.55);
  }
  .tile:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 3px;
  }
  .art {
    position: relative;
    display: block;
    aspect-ratio: 16 / 10;
    overflow: hidden;
    background: #111;
  }
  .art :global(.tileimg) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .art :global(.lobbyart) {
    transition: transform 400ms var(--ease);
  }
  .tile:hover .art :global(.lobbyart),
  .tile:hover .art :global(.tileimg) {
    transform: scale(1.06);
  }
  .shine {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at var(--mx) var(--my), rgba(255, 255, 255, 0.35), transparent 45%),
      linear-gradient(180deg, transparent 60%, rgba(0, 0, 0, 0.35));
    opacity: 0.5;
    transition: opacity 200ms;
    pointer-events: none;
  }
  .tile:hover .shine {
    opacity: 1;
  }
  .meta {
    display: grid;
    gap: 1px;
    padding: 10px 12px 12px;
    border-top: 2px solid color-mix(in srgb, var(--cz-gold) 55%, transparent);
  }
  .n {
    font-weight: 800;
    font-size: 15px;
  }
  .b {
    font-size: 12px;
    color: var(--text-muted);
  }

  /* ---------- in a game ---------- */
  .bar {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .bar h2 {
    font-size: 20px;
    margin: 0;
    font-family: Georgia, 'Times New Roman', serif;
    letter-spacing: 0.02em;
  }
  .gicon {
    width: 48px;
    height: 30px;
    border-radius: 8px;
    overflow: hidden;
    flex: none;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--cz-gold) 60%, transparent);
  }
  .gicon :global(.gimg) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
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
  .side .pos {
    color: #7dffa8;
  }
  .side .neg {
    color: #ffb0b0;
  }
  .loadingtable {
    min-height: 260px;
    border-radius: 22px;
    display: grid;
    place-items: center;
    color: #f6f3e6;
    background: radial-gradient(ellipse at 50% 35%, #1c8a50, #083a20);
  }
  .note {
    margin-bottom: 10px;
    font-size: 14px;
  }

  /* ---------- achievements ---------- */
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
  .a.on {
    border-color: color-mix(in srgb, var(--cz-gold) 70%, var(--border));
    background: linear-gradient(160deg, color-mix(in srgb, var(--cz-gold) 14%, var(--bg-elev)), var(--bg-elev));
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
  .muted {
    color: var(--text-muted);
    font-size: 13px;
    margin-top: 14px;
  }
  @media (max-width: 520px) {
    .lobby {
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    .marquee {
      padding: 18px;
    }
    .side {
      justify-items: start;
    }
  }
  :global(:root.reduced-motion) .bulbs {
    animation: none;
  }
  @media (prefers-reduced-motion: reduce) {
    :global(:root:not(.motion-ok)) .bulbs {
      animation: none;
    }
    .tile {
      transform: none !important;
    }
  }
</style>
