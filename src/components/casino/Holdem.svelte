<script lang="ts">
  // Texas Hold'em vs bots (fixed-limit). You sit down with a buy-in from your chips and cash out when you leave.
  import { onDestroy, onMount } from 'svelte';
  import { economy } from '../../lib/economy.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { act, betSize, botDecide, BOTS, createTable, legal, pot, startHand, type Action, type HoldemState } from '../../lib/casino/holdem';
  import { playSound } from '../../lib/sounds';
  import PlayingCard from './PlayingCard.svelte';

  const SAVE_KEY = 'homework-todo:holdem-table';
  const SMALL = 10;
  const BUY_INS = [100, 200, 400, 1000];
  let bots = $state(2);
  let buyIn = $state(200);
  let t = $state.raw<HoldemState | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

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
    t = act(t, a);
    after();
  }
  function after() {
    if (!t) return;
    save(t.seats[0].stack);
    if (t.over && t.winners.some((w) => w.seat === 0)) playSound('pop');
  }

  // bots take their turns one at a time, with a short pause so you can follow along
  $effect(() => {
    const s = t;
    if (!s || s.over || s.toAct === 0) return;
    timer = setTimeout(() => {
      if (t !== s) return;
      t = act(s, botDecide(s).action);
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
</script>

<div class="cz-game">
  {#if !t}
    <div class="cz-table lobby">
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
        {#each BOTS.slice(0, bots) as b, i (b.name)}<li style="animation-delay: {i * 60}ms">
            <span class="avatar" aria-hidden="true">{b.emoji}</span> <strong>{b.name}</strong>: {b.blurb}
          </li>{/each}
      </ul>
    </div>
    <div class="cz-actions">
      <button class="btn primary" onclick={sit} disabled={buyIn > economy.wallet.chips}>Sit down ({buyIn.toLocaleString()} chips)</button>
    </div>
  {:else}
    <div class="cz-table">
      <div class="seats">
        {#each t.seats as x, i (i)}
          {#if i > 0}
            <div class="seat" class:out={x.folded} class:turn={!t.over && t.toAct === i} class:winner={!!won(i)}>
              <div class="nm"><span class="avatar" aria-hidden="true">{x.emoji}</span> {x.name}{t.dealer === i ? ' · D' : ''}</div>
              <div class="cz-hand small">
                {#if x.hole.length}{#each x.hole as c, k (k)}<span class="deal" style="animation-delay: {k * 60}ms"><PlayingCard card={c} hidden={!reveal(i)} small /></span
                    >{/each}{/if}
              </div>
              <div class="st">{x.stack.toLocaleString()} chips{x.bet ? ` · bet ${x.bet}` : ''}</div>
              <div class="tag">{won(i) ? `wins ${won(i)!.amount}` : status(i)}</div>
            </div>
          {/if}
        {/each}
      </div>
      <div class="middle">
        <div class="cz-label">
          Board · {#key pot(t)}<span class="pot bump">pot {pot(t).toLocaleString()}</span>{/key}{t.rake && t.over ? ` · rake ${t.rake}` : ''}
        </div>
        <div class="cz-hand">
          {#each t.board as c, k (k)}<span class="deal" style="animation-delay: {k * 60}ms"><PlayingCard card={c} /></span>{/each}
          {#each Array.from({ length: 5 - t.board.length }, (_, k) => k) as k (k)}<span class="slot" aria-hidden="true"></span>{/each}
        </div>
      </div>
      <div class="seat me" class:out={t.seats[0].folded} class:turn={!t.over && t.toAct === 0} class:winner={!!won(0)}>
        <div class="nm">You{t.dealer === 0 ? ' · D' : ''} · {t.seats[0].stack.toLocaleString()} chips{t.seats[0].bet ? ` · bet ${t.seats[0].bet}` : ''}</div>
        <div class="cz-hand">
          {#each t.seats[0].hole as c, k (k)}<span class="deal" style="animation-delay: {k * 60}ms"><PlayingCard card={c} /></span>{/each}
        </div>
        <div class="tag">{won(0) ? `You win ${won(0)!.amount}` : status(0)}</div>
      </div>
      <div class="cz-result log" aria-live="polite">
        {#each t.log.slice(-3) as line, k (k)}<div>{line}</div>{/each}
      </div>
    </div>
    <div class="cz-actions">
      {#if l}
        <button class="btn" onclick={() => you('fold')}>Fold</button>
        {#if l.canCheck}
          <button class="btn primary" onclick={() => you('check')}>Check</button>
        {:else}
          <button class="btn primary" onclick={() => you('call')}>Call {l.toCall}</button>
        {/if}
        {#if l.canRaise}<button class="btn" onclick={() => you('raise')}>{t.currentBet ? 'Raise to' : 'Bet'} {l.raiseTo}</button>{/if}
      {:else if t.over}
        {#if t.seats[0].stack > 0}<button class="btn primary" onclick={deal}>{t.handNo ? 'Next hand' : 'Deal'}</button>{:else}<span>You're out of chips at this table.</span>{/if}
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
  .who {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 6px;
    font-size: 13px;
  }
  .who li {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.12);
    animation: cz-pop 260ms var(--spring) backwards;
  }
  /* a round avatar chip for each bot */
  .avatar {
    display: inline-grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    font-size: 16px;
    background: radial-gradient(circle at 35% 30%, #ffffff, #d8dde3 55%, #9aa4ae);
    box-shadow:
      inset 0 -2px 4px rgba(0, 0, 0, 0.2),
      0 2px 4px rgba(0, 0, 0, 0.4);
    flex: none;
  }
  .seats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px;
  }
  .seat {
    position: relative;
    background: rgba(0, 0, 0, 0.2);
    border-radius: var(--radius);
    padding: 8px 10px;
    display: grid;
    gap: 4px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
    transition:
      border-color var(--dur-slow),
      box-shadow var(--dur-slow),
      opacity var(--dur-slow),
      transform var(--dur) var(--spring);
  }
  /* the seat whose turn it is gets a pulsing gold ring */
  .seat.turn {
    border-color: #ffe066;
    transform: translateY(-2px);
    animation: hd-turn 1.2s ease-in-out infinite;
  }
  .seat.turn .avatar {
    box-shadow:
      0 0 0 2px #ffe066,
      0 0 12px rgba(255, 224, 102, 0.8);
  }
  @keyframes hd-turn {
    0%,
    100% {
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.08),
        0 0 8px rgba(255, 224, 102, 0.4);
    }
    50% {
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.08),
        0 0 22px rgba(255, 224, 102, 0.9);
    }
  }
  .seat.winner {
    border-color: #4ade80;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 0 22px rgba(34, 197, 94, 0.7);
  }
  .seat.winner .tag {
    color: #ffe066;
    font-weight: 800;
    text-shadow: 0 0 10px rgba(255, 224, 102, 0.8);
  }
  .seat.out {
    opacity: 0.55;
  }
  .seat.me {
    border-top: 3px solid #ffe066;
  }
  .nm {
    font-weight: 700;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-variant-numeric: tabular-nums;
  }
  .st,
  .tag {
    font-size: 12px;
    opacity: 0.9;
    min-height: 16px;
    font-variant-numeric: tabular-nums;
  }
  .small {
    min-height: 0;
  }
  .deal {
    display: inline-block;
    animation: cz-pop 260ms var(--spring) backwards;
  }
  .middle .cz-label {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  /* the pot: a gold pill that bumps whenever it grows */
  .pot {
    font-size: 12px;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    padding: 2px 10px;
    border-radius: 999px;
    background: var(--grad-gold);
    color: #3a2e00;
    text-shadow: none;
    border: 1px solid #fff3b0;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.6),
      0 0 12px rgba(255, 224, 102, 0.5);
  }
  .slot {
    width: 56px;
    height: 80px;
    border-radius: 8px;
    border: 2px dashed rgba(255, 224, 102, 0.35);
    background: rgba(0, 0, 0, 0.12);
  }
  .log {
    font-size: 13px;
    font-weight: 500;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
</style>
