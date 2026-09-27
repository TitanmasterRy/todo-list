<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { LIR_PAYTABLE, lirDeal, lirDecide, lirReturned, rideFirst, rideSecond, type LirRound } from '../../lib/casino/letitride';
  import { describeHand, evalHand } from '../../lib/casino/poker';
  import { playSound } from '../../lib/sounds';
  import BetControl from './BetControl.svelte';
  import PlayingCard from './PlayingCard.svelte';

  let unit = $state(10);
  let r = $state<LirRound | null>(null);
  let hint = $state(false);

  function deal() {
    if (!economy.bet('let it ride', unit * 3)) return;
    hint = false;
    r = lirDeal(unit);
  }
  function decide(ride: boolean) {
    if (!r || r.step === 'done') return;
    // a pulled bet goes straight back to you
    if (!ride) economy.payout('let it ride', r.unit);
    r = lirDecide(r, ride);
    hint = false;
    if (r.step === 'done') {
      economy.payout('let it ride', r.payout);
      if (r.payout > 0) playSound('pop');
    }
  }

  const shown = $derived(r ? (r.step === 1 ? 0 : r.step === 2 ? 1 : 2) : 0);
  const advice = $derived(r && r.step !== 'done' ? (r.step === 1 ? rideFirst(r.player) : rideSecond([...r.player, r.community[0]])) : false);
  const riding = $derived(r ? r.riding.filter(Boolean).length : 0);
  const net = $derived(r?.step === 'done' ? r.payout + lirReturned(r) - r.unit * 3 : 0);
  const label = $derived(r?.step === 'done' ? describeHand(r.value ?? evalHand([...r.player, ...r.community])) : '');
</script>

<div class="cz-game">
  <div class="cz-table">
    <div class="cz-label">Community cards</div>
    <div class="cz-hand">
      {#if r}{#each r.community as c, i (i)}<PlayingCard card={c} hidden={i >= shown} />{/each}{:else}<PlayingCard hidden /><PlayingCard hidden />{/if}
    </div>
    <div class="cz-label">You {r ? `· ${r.step === 'done' ? label : 'three cards'}` : ''}</div>
    <div class="cz-hand">
      {#if r}{#each r.player as c, i (i)}<PlayingCard card={c} />{/each}{/if}
    </div>
    <div class="bets" aria-label="Your three bets">
      {#each [0, 1, 2] as i (i)}
        <span class="spot" class:pulled={r && !r.riding[i]}>{i === 2 ? '$' : i + 1}<small>{r ? (r.riding[i] ? r.unit : 'back') : unit}</small></span>
      {/each}
    </div>
    <div class="cz-result" aria-live="polite" class:win={r?.step === 'done' && net > 0} class:lose={r?.step === 'done' && net < 0}>
      {#if r && r.step !== 'done'}
        {r.step === 1 ? 'Let bet 1 ride, or pull it back?' : 'Let bet 2 ride, or pull it back?'}
        {#if hint}<span class="tip">Basic strategy: {advice ? 'let it ride' : 'pull it back'}.</span>{/if}
      {:else if r?.step === 'done'}
        {r.payout ? `${LIR_PAYTABLE.find((p) => p.hand === r!.hand)?.label} on ${riding} bet${riding === 1 ? '' : 's'}` : 'No win'} · {net >= 0 ? '+' : ''}{net.toLocaleString()}
      {/if}
    </div>
  </div>
  <div class="cz-actions">
    {#if r && r.step !== 'done'}
      <button class="btn primary" onclick={() => decide(true)}>Let it ride</button>
      <button class="btn" onclick={() => decide(false)}>Pull back {r.unit}</button>
      <button class="btn ghost sm" onclick={() => (hint = true)} disabled={hint}>Hint</button>
    {:else}
      <BetControl bind:value={unit} label="Each bet" />
      <button class="btn primary" onclick={deal} disabled={unit * 3 > economy.wallet.chips}>Deal ({(unit * 3).toLocaleString()})</button>
    {/if}
  </div>
  <div class="cz-paytable">
    {#each LIR_PAYTABLE as p (p.hand)}<span class:hit={r?.step === 'done' && r.hand === p.hand}>{p.label}</span><span class:hit={r?.step === 'done' && r.hand === p.hand}
        >{p.pays}:1</span
      >{/each}
  </div>
  <p class="cz-edge">
    You place three equal bets and get three cards; two community cards finish the hand. Pull back bet 1 after your cards, bet 2 after the first community card. The $ bet always
    rides. One deck; house edge about 3.5% per bet with the basic strategy (the Hint button shows it).
  </p>
</div>

<style>
  .bets {
    display: flex;
    gap: 10px;
  }
  .spot {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    border: 2px dashed rgba(255, 255, 255, 0.7);
    display: grid;
    place-items: center;
    font-weight: 800;
    line-height: 1;
    font-size: 15px;
  }
  .spot small {
    font-size: 10px;
    font-weight: 600;
  }
  .spot.pulled {
    opacity: 0.45;
  }
  .tip {
    display: block;
    font-weight: 500;
    font-size: 13px;
    opacity: 0.9;
  }
</style>
