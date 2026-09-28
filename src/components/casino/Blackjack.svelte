<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { deal, doubleDown, handValue, hit, stand, type BjState } from '../../lib/casino/blackjack';
  import type { PlayingCard as Card } from '../../lib/casino/cards';
  import { playSound } from '../../lib/sounds';
  import BetControl from './BetControl.svelte';
  import PlayingCard from './PlayingCard.svelte';

  let bet = $state(25);
  let s = $state<BjState | null>(null);
  let shoe: Card[] | undefined;

  const OUTCOME: Record<string, string> = {
    blackjack: 'Blackjack! Pays 3:2',
    win: 'You win',
    dealerBust: 'Dealer busts. You win',
    push: 'Push: bet returned',
    lose: 'Dealer wins',
    bust: 'Bust',
  };

  function start() {
    if (!economy.bet('blackjack', bet)) return;
    s = deal(bet, shoe);
    finish();
  }
  function act(next: BjState) {
    s = next;
    finish();
  }
  function dbl() {
    if (!s || !economy.raise('blackjack', s.bet)) return;
    act(doubleDown(s));
  }
  function finish() {
    if (!s) return;
    shoe = s.shoe;
    if (s.phase === 'done') {
      economy.payout('blackjack', s.payout);
      if (s.outcome === 'blackjack') economy.achieve('natural');
      if (s.payout > s.bet) playSound('pop');
    }
  }
  const playing = $derived(s?.phase === 'player');
  const pv = $derived(s ? handValue(s.player) : null);
  const dv = $derived(s ? handValue(playing ? s.dealer.slice(0, 1) : s.dealer) : null);
</script>

<div class="cz-game">
  <div class="cz-table">
    <div class="zone" class:won={s?.phase === 'done' && s.payout === 0}>
      <div class="cz-label">
        Dealer {#if dv}<span class="pill" class:bust={dv.total > 21}>{dv.total}{playing ? '+' : ''}</span>{/if}
      </div>
      <div class="cz-hand">
        {#if s}{#each s.dealer as c, i (i)}<span class="deal" style="animation-delay: {i * 60}ms"><PlayingCard card={c} hidden={playing && i === 1} /></span>{/each}{/if}
      </div>
    </div>
    <div class="zone me" class:won={s?.phase === 'done' && s.payout > s.bet}>
      <div class="cz-label">
        You {#if pv}<span class="pill" class:gold={pv.total === 21} class:bust={pv.total > 21}>{pv.soft && pv.total <= 21 ? 'soft ' : ''}{pv.total}</span>{/if}{s?.doubled
          ? ' · doubled'
          : ''}
        <span class="spot" class:filled={!!s && s.phase !== 'done'} aria-hidden="true">Bet<small>{s && s.phase !== 'done' ? s.bet : bet}</small></span>
      </div>
      <div class="cz-hand">
        {#if s}{#each s.player as c, i (i)}<span class="deal" style="animation-delay: {i * 60}ms"><PlayingCard card={c} /></span>{/each}{/if}
      </div>
    </div>
    <div class="cz-result" aria-live="polite" class:win={s?.phase === 'done' && s.payout > s.bet} class:lose={s?.phase === 'done' && s.payout === 0}>
      {s?.phase === 'done' && s.outcome ? `${OUTCOME[s.outcome]}${s.payout > s.bet ? ` · +${(s.payout - s.bet).toLocaleString()}` : ''}` : ''}
    </div>
  </div>
  <div class="cz-actions">
    {#if playing && s}
      <button class="btn primary" onclick={() => act(hit(s!))}>Hit</button>
      <button class="btn" onclick={() => act(stand(s!))}>Stand</button>
      <button class="btn" onclick={dbl} disabled={s.player.length !== 2 || economy.wallet.chips < s.bet}>Double</button>
    {:else}
      <BetControl bind:value={bet} />
      <button class="btn primary" onclick={start} disabled={bet > economy.wallet.chips}>Deal</button>
    {/if}
  </div>
  <p class="cz-edge">Six decks, dealer stands on soft 17, blackjack pays 3:2, double on your first two cards. House edge about 0.6% with good play.</p>
</div>

<style>
  .zone {
    padding: 8px 10px;
    border-radius: var(--radius);
    background: rgba(0, 0, 0, 0.18);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
    transition: box-shadow var(--dur-slow);
  }
  .zone.me {
    border-top: 3px solid #ffe066;
  }
  .zone.won {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 0 0 2px #ffe066,
      0 0 22px rgba(255, 224, 102, 0.6);
  }
  .cz-label {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  /* hand totals: glossy pills, gold on 21, red on a bust */
  .pill {
    font-size: 13px;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0;
    padding: 2px 10px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.25);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
    animation: bump 420ms var(--spring);
  }
  .pill.gold {
    background: var(--grad-gold);
    color: #3a2e00;
    text-shadow: none;
    border-color: #fff3b0;
    box-shadow: 0 0 14px rgba(255, 224, 102, 0.7);
  }
  .pill.bust {
    background: linear-gradient(180deg, #f87171, #dc2626);
    border-color: #fca5a5;
    color: #fff;
  }
  .deal {
    display: inline-block;
    animation: cz-pop 260ms var(--spring) backwards;
  }
  .spot {
    margin-inline-start: auto;
    min-width: 46px;
    height: 46px;
    padding: 0 6px;
    border-radius: 50%;
    border: 2px dashed rgba(255, 224, 102, 0.75);
    display: grid;
    place-content: center;
    text-align: center;
    line-height: 1.1;
    font-size: 9px;
    letter-spacing: 0.08em;
    color: #ffe066;
    transition:
      background var(--dur-slow),
      box-shadow var(--dur-slow),
      color var(--dur-slow),
      transform var(--dur) var(--spring);
  }
  .spot small {
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0;
  }
  .spot.filled {
    background: var(--grad-gold);
    color: #3a2e00;
    text-shadow: none;
    border-style: solid;
    border-color: #fff3b0;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.7),
      0 0 16px rgba(255, 224, 102, 0.6);
    transform: scale(1.08);
  }
</style>
