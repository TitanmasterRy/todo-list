<script lang="ts">
  // Texas Hold'em vs bots (fixed-limit). You sit down with a buy-in from your chips and cash out when you leave.
  import { onDestroy, onMount } from 'svelte';
  import { economy } from '../../lib/economy.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { act, betSize, botDecide, BOTS, createTable, legal, pot, startHand, type Action, type HoldemState } from '../../lib/casino/holdem';
  import BotAvatar, { type Who } from './BotAvatar.svelte';
  import ChipStack from './ChipStack.svelte';
  import PlayingCard from './PlayingCard.svelte';
  import { flyChips } from './fx';
  import { sfx } from './sfx';

  const SAVE_KEY = 'homework-todo:holdem-table';
  const SMALL = 10;
  const BUY_INS = [100, 200, 400, 1000];
  let bots = $state(2);
  let buyIn = $state(200);
  let t = $state.raw<HoldemState | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  // speech bubbles with each seat's last action
  let bubbles = $state<Record<number, { text: string; id: number }>>({});
  let bid = 0;
  let potEl = $state<HTMLElement>();
  const seatEls: HTMLElement[] = $state([]);

  function say(prev: HoldemState, a: Action) {
    const l = legal(prev);
    const text =
      a === 'fold'
        ? 'Fold'
        : a === 'check' && l.canCheck
          ? 'Check'
          : a === 'raise' && l.canRaise
            ? `${prev.currentBet ? 'Raise' : 'Bet'} ${l.raiseTo}`
            : l.toCall
              ? `Call ${l.toCall}`
              : 'Check';
    bubbles = { ...bubbles, [prev.toAct]: { text, id: ++bid } };
    sfx(a === 'fold' ? 'deal' : a === 'check' ? 'click' : 'chips');
  }

  function save(stack: number | null) {
    try {
      if (stack === null) localStorage.removeItem(SAVE_KEY);
      else localStorage.setItem(SAVE_KEY, JSON.stringify({ stack }));
    } catch {
      /* ignore */
    }
  }

  onMount(() => {
    // chips left at a table when the page closed go back to the wallet
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      const stack = raw ? Math.floor(Number((JSON.parse(raw) as { stack?: unknown }).stack)) : 0;
      save(null);
      if (stack > 0) {
        economy.payout('holdem', stack);
        toasts.push({ message: `Returned ${stack.toLocaleString()} chips from your last Hold'em table`, kind: 'info', emoji: '🂡' });
      }
    } catch {
      save(null);
    }
  });

  function sit() {
    if (!economy.bet('holdem', buyIn)) return;
    t = createTable({ you: { name: 'You', emoji: '🙂', stack: buyIn }, bots, small: SMALL, botStack: 20 * SMALL });
    save(buyIn);
    deal();
  }
  function deal() {
    if (!t || t.seats[0].stack <= 0) return;
    t = startHand(t);
    bubbles = {};
    save(t.seats[0].stack);
  }
  function leave() {
    if (!t) return;
    if (timer) clearTimeout(timer);
    const stack = t.seats[0].stack;
    if (stack > 0) economy.payout('holdem', stack);
    save(null);
    toasts.push({ message: stack > 0 ? `Cashed out ${stack.toLocaleString()} chips` : 'Left the table', kind: 'info', emoji: '🂡', timeout: 2500 });
    t = null;
  }
  function you(a: Action) {
    if (!t || t.over || t.toAct !== 0) return;
    say(t, a);
    t = act(t, a);
    after();
  }
  function after() {
    if (!t) return;
    save(t.seats[0].stack);
    if (t.over) {
      for (const w of t.winners) setTimeout(() => flyChips(potEl, seatEls[w.seat], w.amount, { max: 7 }), 300);
      sfx(t.winners.some((w) => w.seat === 0) ? 'win' : 'lose');
    }
  }

  // bots take their turns one at a time, with a short pause so you can follow along
  $effect(() => {
    const s = t;
    if (!s || s.over || s.toAct === 0) return;
    timer = setTimeout(() => {
      if (t !== s) return;
      const a = botDecide(s).action;
      say(s, a);
      t = act(s, a);
      after();
    }, 550);
    return () => clearTimeout(timer);
  });

  onDestroy(() => {
    // leaving the casino cashes out; a hand in progress counts as folded
    if (timer) clearTimeout(timer);
    if (t && t.seats[0].stack > 0) economy.payout('holdem', t.seats[0].stack);
    if (t) save(null);
  });

  const l = $derived(t && !t.over && t.toAct === 0 ? legal(t) : null);
  const reveal = (i: number) => !!t && (i === 0 || (t.showdown && !t.seats[i].folded));
  const status = (i: number) => {
    if (!t) return '';
    const x = t.seats[i];
    if (!x.inHand && t.handNo > 0) return 'sitting out';
    if (x.folded) return 'folded';
    if (x.allIn) return 'all in';
    if (!t.over && t.toAct === i) return i === 0 ? 'your turn' : 'thinking…';
    return '';
  };
  const won = (i: number) => t?.winners.find((w) => w.seat === i);
  const who = (i: number): Who => (!t || t.seats[i].bot === null ? 'you' : (BOTS[t.seats[i].bot!].name.toLowerCase() as Who));
</script>

<div class="cz-game">
  {#if !t}
    <div class="cz-table lobby">
      <div class="crew" aria-hidden="true">
        {#each BOTS.slice(0, bots) as b (b.name)}<BotAvatar who={b.name.toLowerCase() as Who} size={64} label={b.name} />{/each}
      </div>
      <p>Fixed-limit Texas Hold'em: blinds {SMALL / 2}/{SMALL}, bets {SMALL} before the turn and {SMALL * 2} on the turn and river, four bets a round at most.</p>
      <div class="cz-row" role="group" aria-label="Number of bots">
        <span class="cz-label">Bots</span>
        {#each [1, 2, 3] as n (n)}
          <button class="btn sm" class:primary={bots === n} aria-pressed={bots === n} onclick={() => (bots = n)}>{n}</button>
        {/each}
      </div>
      <div class="cz-row" role="group" aria-label="Buy-in">
        <span class="cz-label">Buy-in</span>
        {#each BUY_INS as b (b)}
          <button class="btn sm" class:primary={buyIn === b} aria-pressed={buyIn === b} onclick={() => (buyIn = b)} disabled={b > economy.wallet.chips}>{b.toLocaleString()}</button
          >
        {/each}
      </div>
      <ul class="who">
        {#each BOTS.slice(0, bots) as b (b.name)}<li><strong>{b.name}</strong>: {b.blurb}</li>{/each}
      </ul>
    </div>
    <div class="cz-deck">
      <button class="btn cz-go" onclick={sit} disabled={buyIn > economy.wallet.chips}>Sit down ({buyIn.toLocaleString()} chips)</button>
    </div>
  {:else}
    <div class="cz-table poker">
      <div class="seats n{t.seats.length - 1}">
        {#each t.seats as x, i (i)}
          {#if i > 0}
            <div class="seat" class:out={x.folded} class:turn={!t.over && t.toAct === i} class:winner={!!won(i)} bind:this={seatEls[i]}>
              {#if bubbles[i]}{#key bubbles[i].id}<span class="cz-bubble bub">{bubbles[i].text}</span>{/key}{/if}
              <div class="head">
                <BotAvatar who={who(i)} size={44} label={x.name} />
                <div class="nm">
                  <span
                    >{x.name}{#if t.dealer === i}<span class="dbtn" title="Dealer">D</span>{/if}</span
                  >
                  <span class="st">{x.stack.toLocaleString()} chips</span>
                </div>
              </div>
              {#key t.handNo}
                <div class="cz-hand small" style="--from-x: 0px; --from-y: 120px">
                  {#if x.hole.length}{#each x.hole as c, k (k)}<PlayingCard card={c} hidden={!reveal(i)} small delay={k * 200 + i * 60} />{/each}{/if}
                </div>
              {/key}
              <div class="tag">{won(i) ? `wins ${won(i)!.amount}` : status(i)}</div>
              {#if x.bet}<span class="betchips"><ChipStack amount={x.bet} size={22} /></span>{/if}
            </div>
          {/if}
        {/each}
      </div>
      <div class="middle">
        <div class="pot" bind:this={potEl}>
          {#if pot(t)}<ChipStack amount={pot(t)} size={26} tag={false} />{/if}
          <span class="cz-label">Board · pot {pot(t).toLocaleString()}{t.rake && t.over ? ` · rake ${t.rake}` : ''}</span>
        </div>
        {#key t.handNo}
          <div class="cz-hand center" style="--from-x: 0px; --from-y: -100px">
            {#each t.board as c, k (k)}<PlayingCard card={c} delay={k < 3 ? k * 150 : 0} />{/each}
            {#each Array.from({ length: 5 - t.board.length }, (_, k) => k) as k (k)}<span class="slot" aria-hidden="true"></span>{/each}
          </div>
        {/key}
      </div>
      <div class="seat me" class:out={t.seats[0].folded} class:turn={!t.over && t.toAct === 0} class:winner={!!won(0)} bind:this={seatEls[0]}>
        {#if bubbles[0]}{#key bubbles[0].id}<span class="cz-bubble bub">{bubbles[0].text}</span>{/key}{/if}
        <div class="head">
          <BotAvatar who="you" size={44} />
          <div class="nm">
            <span
              >You{#if t.dealer === 0}<span class="dbtn" title="Dealer">D</span>{/if}</span
            >
            <span class="st">{t.seats[0].stack.toLocaleString()} chips{t.seats[0].bet ? ` · bet ${t.seats[0].bet}` : ''}</span>
          </div>
        </div>
        {#key t.handNo}
          <div class="cz-hand center" style="--from-x: 0px; --from-y: -200px">
            {#each t.seats[0].hole as c, k (k)}<PlayingCard card={c} delay={k * 200} />{/each}
          </div>
        {/key}
        <div class="tag">{won(0) ? `You win ${won(0)!.amount}` : status(0)}</div>
        {#if t.seats[0].bet}<span class="betchips mine"><ChipStack amount={t.seats[0].bet} size={24} /></span>{/if}
      </div>
      <div class="cz-result log" aria-live="polite">
        {#each t.log.slice(-3) as line, k (k)}<div>{line}</div>{/each}
      </div>
    </div>
    <div class="cz-deck">
      {#if l}
        <button class="btn" onclick={() => you('fold')}>Fold</button>
        {#if l.canCheck}
          <button class="btn cz-go" onclick={() => you('check')}>Check</button>
        {:else}
          <button class="btn cz-go" onclick={() => you('call')}>Call {l.toCall}</button>
        {/if}
        {#if l.canRaise}<button class="btn" onclick={() => you('raise')}>{t.currentBet ? 'Raise to' : 'Bet'} {l.raiseTo}</button>{/if}
      {:else if t.over}
        {#if t.seats[0].stack > 0}<button class="btn cz-go" onclick={deal}>{t.handNo ? 'Next hand' : 'Deal'}</button>{:else}<span>You're out of chips at this table.</span>{/if}
        <button class="btn ghost" onclick={leave}>Leave table</button>
      {:else}
        <span class="muted">Waiting for {t.seats[t.toAct]?.name}… (bets are {betSize(t)} this round)</span>
      {/if}
    </div>
  {/if}
  <p class="cz-edge">
    The bots estimate their chances from their own cards and the board only, compare them with the pot odds, and sometimes bluff. The table takes a 5% rake from pots that see a
    flop (at most {SMALL * 2}). Leaving the table, or the casino, cashes your stack out; a hand in progress counts as folded.
  </p>
</div>

<style>
  .lobby p {
    margin: 0;
  }
  .crew {
    display: flex;
    gap: 12px;
    justify-content: center;
  }
  .crew :global(.av) {
    animation: bob 2.6s ease-in-out infinite;
  }
  .crew :global(.av:nth-child(2)) {
    animation-delay: 0.4s;
  }
  .crew :global(.av:nth-child(3)) {
    animation-delay: 0.8s;
  }
  @keyframes bob {
    50% {
      transform: translateY(-5px);
    }
  }
  .who {
    margin: 0;
    padding-inline-start: 18px;
    font-size: 13px;
  }
  .poker {
    border-radius: 140px / 90px;
    padding: 22px 26px;
  }
  .seats {
    display: flex;
    justify-content: space-around;
    gap: 8px;
    flex-wrap: wrap;
  }
  .seat {
    position: relative;
    background: rgba(0, 0, 0, 0.28);
    border-radius: 16px;
    padding: 8px 10px;
    display: grid;
    gap: 4px;
    justify-items: center;
    border: 2px solid rgba(255, 244, 210, 0.2);
    min-width: 130px;
    transition:
      border-color 200ms,
      box-shadow 200ms,
      opacity 200ms;
  }
  .seat.turn {
    border-color: #ffe39a;
    box-shadow: 0 0 18px rgba(255, 215, 106, 0.55);
  }
  .seat.winner {
    border-color: #5cff9d;
    box-shadow: 0 0 22px rgba(60, 255, 140, 0.55);
  }
  .seat.out {
    opacity: 0.5;
  }
  .seat.me {
    justify-self: center;
    min-width: 220px;
    background: rgba(0, 0, 0, 0.32);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .nm {
    display: grid;
    font-weight: 800;
    font-size: 13px;
    line-height: 1.25;
  }
  .st {
    font-weight: 600;
    font-size: 12px;
    color: #ffe39a;
  }
  .dbtn {
    display: inline-grid;
    place-items: center;
    width: 18px;
    height: 18px;
    margin-left: 6px;
    border-radius: 50%;
    background: #fffdf4;
    color: #111;
    font-size: 10px;
    font-weight: 900;
    box-shadow: 0 2px 0 rgba(0, 0, 0, 0.4);
    vertical-align: middle;
  }
  .tag {
    font-size: 12px;
    opacity: 0.9;
    min-height: 16px;
  }
  .small {
    min-height: 0;
  }
  .bub {
    top: -14px;
    right: -6px;
  }
  .betchips {
    position: absolute;
    bottom: -14px;
    right: 8px;
  }
  .betchips.mine {
    top: -10px;
    bottom: auto;
    right: 12px;
  }
  .middle {
    display: grid;
    justify-items: center;
    gap: 6px;
    padding: 10px 0;
  }
  .pot {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    min-height: 40px;
  }
  .center {
    justify-content: center;
  }
  .slot {
    width: var(--cw, clamp(50px, 15vw, 66px));
    height: calc(var(--cw, clamp(50px, 15vw, 66px)) * 1.4);
    border-radius: 8px;
    border: 2px dashed rgba(255, 244, 210, 0.3);
  }
  .log {
    font-size: 13px;
    font-weight: 500;
    text-align: center;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  @media (max-width: 520px) {
    .poker {
      border-radius: 40px;
      padding: 14px 10px;
    }
    .seat {
      min-width: 0;
      padding: 6px;
    }
  }
</style>
