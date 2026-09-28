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
    <div class="zone">
      <div class="cz-label">Community cards</div>
      <div class="cz-hand">
        {#if r}{#each r.community as c, i (i)}<span class="deal" style="animation-delay: {i * 60}ms"><PlayingCard card={c} hidden={i >= shown} /></span>{/each}{:else}<span
            class="deal"><PlayingCard hidden /></span
          ><span class="deal" style="animation-delay: 60ms"><PlayingCard hidden /></span>{/if}
      </div>
    </div>
    <div class="zone me" class:won={r?.step === 'done' && net > 0}>
      <div class="cz-label">
        You {#if r}<span class="pill">{r.step === 'done' ? label : 'three cards'}</span>{/if}
      </div>
      <div class="cz-hand">
        {#if r}{#each r.player as c, i (i)}<span class="deal" style="animation-delay: {i * 60}ms"><PlayingCard card={c} /></span>{/each}{/if}
      </div>
    </div>
    <div class="spots" aria-label="Your three bets">
      {#each [0, 1, 2] as i (i)}
        <span class="spot" class:filled={r && r.riding[i]} class:pulled={r && !r.riding[i]}>{i === 2 ? '$' : i + 1}<small>{r ? (r.riding[i] ? r.unit : 'back') : unit}</small></span
        >
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
  /* hand names in glossy pills */
  .pill {
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0;
    text-transform: none;
    padding: 2px 10px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.25);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
    animation: bump 420ms var(--spring);
  }
  .won .pill {
    background: var(--grad-gold);
    color: #3a2e00;
    text-shadow: none;
    border-color: #fff3b0;
  }
  .deal {
    display: inline-block;
    animation: cz-pop 260ms var(--spring) backwards;
  }
  /* bet spots: dashed gold rings that fill once a bet is down */
  .spots {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .spot {
    min-width: 56px;
    height: 56px;
    padding: 0 8px;
    border-radius: 50%;
    border: 2px dashed rgba(255, 224, 102, 0.75);
    display: grid;
    place-content: center;
    text-align: center;
    line-height: 1.1;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-variant-numeric: tabular-nums;
    color: #ffe066;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    transition:
      background var(--dur-slow),
      box-shadow var(--dur-slow),
      color var(--dur-slow),
      opacity var(--dur-slow),
      transform var(--dur) var(--spring);
  }
  .spot small {
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 0;
    min-height: 13px;
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
    transform: scale(1.06);
  }
  .spot.pulled {
    opacity: 0.45;
    border-style: dotted;
  }
  .spots .spot:first-child {
    font-size: 15px;
  }
  .spots .spot:nth-child(2) {
    font-size: 15px;
  }
  .spots .spot:last-child {
    font-size: 17px;
  }
  .tip {
    display: block;
    font-weight: 500;
    font-size: 13px;
    opacity: 0.9;
  }
</style>
