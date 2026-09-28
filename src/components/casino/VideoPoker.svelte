<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { vpDeal, vpDraw, VP_LABEL, VP_PAYTABLE, type PokerHand, type VpState } from '../../lib/casino/videopoker';
  import { playSound } from '../../lib/sounds';
  import BetControl from './BetControl.svelte';
  import PlayingCard from './PlayingCard.svelte';

  let bet = $state(10);
  let s = $state<VpState | null>(null);

  function deal() {
    if (!economy.bet('video poker', bet)) return;
    s = vpDeal();
  }
  function toggle(i: number) {
    if (!s || s.phase !== 'hold') return;
    s = { ...s, held: s.held.map((h, j) => (j === i ? !h : h)) };
  }
  function draw() {
    if (!s) return;
    s = vpDraw(s, bet);
    economy.payout('video poker', s.payout);
    if (s.result === 'royal') economy.achieve('royal');
    if (s.result === 'royal' || s.result === 'straightFlush' || s.result === 'four') economy.achieve('four-kind');
    if (s.payout > bet) playSound('pop');
  }
  const hands = Object.keys(VP_PAYTABLE).filter((h) => h !== 'nothing') as PokerHand[];
</script>

<div class="cz-game">
  <div class="cz-table">
    <div class="cz-label">Your hand <span class="spot" class:filled={!!s} aria-hidden="true">Bet<small>{bet}</small></span></div>
    <div class="cz-hand cards">
      {#if s}
        {#each s.hand as c, i (i + c.suit + c.rank)}
          <button
            class="hold deal"
            class:held={s.phase === 'hold' && s.held[i]}
            style="animation-delay: {i * 60}ms"
            onclick={() => toggle(i)}
            disabled={s.phase !== 'hold'}
            aria-pressed={s.held[i]}><PlayingCard card={c} held={s.phase === 'hold' && s.held[i]} /></button
          >
        {/each}
      {:else}
        {#each [0, 1, 2, 3, 4] as i (i)}<span class="deal" style="animation-delay: {i * 60}ms"><PlayingCard hidden /></span>{/each}
      {/if}
    </div>
    <div class="cz-result" aria-live="polite" class:win={s?.phase === 'done' && s.payout > 0} class:lose={s?.phase === 'done' && s.payout === 0}>
      {#if s?.phase === 'hold'}Tap cards to hold, then draw.{:else if s?.result}{VP_LABEL[s.result]}{s.payout ? ` · +${s.payout.toLocaleString()}` : ''}{/if}
    </div>
  </div>
  <div class="cz-actions">
    {#if s?.phase === 'hold'}
      <button class="btn primary" onclick={draw}>Draw</button>
    {:else}
      <BetControl bind:value={bet} />
      <button class="btn primary" onclick={deal} disabled={bet > economy.wallet.chips}>Deal</button>
    {/if}
  </div>
  <div class="cz-paytable">
    {#each hands as h (h)}<span class:hit={s?.result === h}>{VP_LABEL[h]}</span><span class:hit={s?.result === h}>×{VP_PAYTABLE[h]}</span>{/each}
  </div>
  <p class="cz-edge">Jacks or Better, full-pay 9/6 table: about 99.5% return with perfect holds.</p>
</div>

<style>
  .cz-label {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .cards {
    justify-content: center;
    padding-bottom: 18px;
  }
  .deal {
    display: inline-block;
    animation: cz-pop 260ms var(--spring) backwards;
  }
  /* each card is a button: it lifts on hover and glows gold while held */
  .hold {
    background: none;
    padding: 0;
    border-radius: 9px;
    transition:
      transform var(--dur) var(--spring),
      box-shadow var(--dur-slow);
  }
  .hold:not(:disabled):hover {
    transform: translateY(-4px);
  }
  .hold.held {
    box-shadow: 0 0 22px rgba(255, 224, 102, 0.6);
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
    font-variant-numeric: tabular-nums;
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
