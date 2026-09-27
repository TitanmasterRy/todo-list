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
        {#each BOTS.slice(0, bots) as b (b.name)}<li>{b.emoji} <strong>{b.name}</strong>: {b.blurb}</li>{/each}
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
              <div class="nm">{x.emoji} {x.name}{t.dealer === i ? ' · D' : ''}</div>
              <div class="cz-hand small">
                {#if x.hole.length}{#each x.hole as c, k (k)}<PlayingCard card={c} hidden={!reveal(i)} small />{/each}{/if}
              </div>
              <div class="st">{x.stack.toLocaleString()} chips{x.bet ? ` · bet ${x.bet}` : ''}</div>
              <div class="tag">{won(i) ? `wins ${won(i)!.amount}` : status(i)}</div>
            </div>
          {/if}
        {/each}
      </div>
      <div class="middle">
        <div class="cz-label">Board · pot {pot(t).toLocaleString()}{t.rake && t.over ? ` · rake ${t.rake}` : ''}</div>
        <div class="cz-hand">
          {#each t.board as c, k (k)}<PlayingCard card={c} />{/each}
          {#each Array.from({ length: 5 - t.board.length }, (_, k) => k) as k (k)}<span class="slot" aria-hidden="true"></span>{/each}
        </div>
      </div>
      <div class="seat me" class:out={t.seats[0].folded} class:turn={!t.over && t.toAct === 0} class:winner={!!won(0)}>
        <div class="nm">You{t.dealer === 0 ? ' · D' : ''} · {t.seats[0].stack.toLocaleString()} chips{t.seats[0].bet ? ` · bet ${t.seats[0].bet}` : ''}</div>
        <div class="cz-hand">
          {#each t.seats[0].hole as c, k (k)}<PlayingCard card={c} />{/each}
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
    padding-inline-start: 18px;
    font-size: 13px;
  }
  .seats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px;
  }
  .seat {
    background: rgba(0, 0, 0, 0.18);
    border-radius: var(--radius-sm);
    padding: 8px;
    display: grid;
    gap: 4px;
    border: 2px solid transparent;
  }
  .seat.turn {
    border-color: #ffe066;
  }
  .seat.winner {
    border-color: #22c55e;
  }
  .seat.out {
    opacity: 0.55;
  }
  .nm {
    font-weight: 700;
    font-size: 13px;
  }
  .st,
  .tag {
    font-size: 12px;
    opacity: 0.9;
    min-height: 16px;
  }
  .small {
    min-height: 0;
  }
  .slot {
    width: 56px;
    height: 80px;
    border-radius: 8px;
    border: 2px dashed rgba(255, 255, 255, 0.25);
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
