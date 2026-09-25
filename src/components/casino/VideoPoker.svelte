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
    if (s.payout > bet) playSound('pop');
  }
  const hands = Object.keys(VP_PAYTABLE).filter((h) => h !== 'nothing') as PokerHand[];
</script>

<div class="cz-game">
  <div class="cz-table">
    <div class="cz-hand cards">
      {#if s}
        {#each s.hand as c, i (i + c.suit + c.rank)}
          <button class="hold" onclick={() => toggle(i)} disabled={s.phase !== 'hold'} aria-pressed={s.held[i]}
            ><PlayingCard card={c} held={s.phase === 'hold' && s.held[i]} /></button
          >
        {/each}
      {:else}
        {#each [0, 1, 2, 3, 4] as i (i)}<PlayingCard hidden />{/each}
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
  .cards {
    justify-content: center;
    padding-bottom: 18px;
  }
  .hold {
    background: none;
    padding: 0;
  }
</style>
