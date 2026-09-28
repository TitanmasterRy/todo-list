<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { LIR_PAYTABLE, lirDeal, lirDecide, lirReturned, rideFirst, rideSecond, type LirRound } from '../../lib/casino/letitride';
  import { describeHand, evalHand } from '../../lib/casino/poker';
  import BetControl from './BetControl.svelte';
  import BotAvatar from './BotAvatar.svelte';
  import ChipStack from './ChipStack.svelte';
  import PlayingCard from './PlayingCard.svelte';
  import WinFx from './WinFx.svelte';
  import { chipsIn, chipsOut, wait } from './fx';

  let unit = $state(10);
  let r = $state<LirRound | null>(null);
  let hint = $state(false);
  let busy = $state(false);
  let n = $state(0);
  let fx = $state<WinFx>();
  let spotEls = $state<HTMLElement[]>([]);

  async function deal() {
    if (busy || !economy.bet('let it ride', unit * 3)) return;
    spotEls.forEach((el, i) => setTimeout(() => chipsIn(el, unit), i * 90));
    fx?.clear();
    hint = false;
    n++;
    r = lirDeal(unit);
    busy = true;
    await wait(3 * 200 + 520);
    busy = false;
  }
  async function decide(ride: boolean) {
    if (!r || r.step === 'done' || busy) return;
    const step = r.step;
    // a pulled bet goes straight back to you
    if (!ride) {
      economy.payout('let it ride', r.unit);
      chipsOut(spotEls[step - 1], r.unit);
    }
    r = lirDecide(r, ride);
    hint = false;
    busy = true;
    await wait(520);
    busy = false;
    if (r.step === 'done') {
      economy.payout('let it ride', r.payout);
      fx?.show(r.payout + lirReturned(r), r.unit * 3);
      if (r.payout > 0) spotEls.forEach((el, i) => r!.riding[i] && setTimeout(() => chipsOut(el, r!.payout / Math.max(1, riding)), i * 120));
    }
  }

  const shown = $derived(r ? (r.step === 1 ? 0 : r.step === 2 ? 1 : 2) : 0);
  const advice = $derived(r && r.step !== 'done' ? (r.step === 1 ? rideFirst(r.player) : rideSecond([...r.player, r.community[0]])) : false);
  const riding = $derived(r ? r.riding.filter(Boolean).length : 0);
  const net = $derived(r?.step === 'done' ? r.payout + lirReturned(r) - r.unit * 3 : 0);
  const label = $derived(r?.step === 'done' ? describeHand(r.value ?? evalHand([...r.player, ...r.community])) : '');
  const settled = $derived(r?.step === 'done' && !busy);
</script>

<div class="cz-game">
  <div class="cz-table lir">
    <div class="top">
      <div class="cz-dealer">
        <BotAvatar who="lou" size={48} label="Lou, the dealer" />
        <span class="who"><strong>Lou</strong><span>Dealer</span></span>
      </div>
      <span class="cz-shoe" aria-hidden="true"></span>
    </div>
    <div class="cz-label center">Community cards</div>
    {#key n}
      <div class="cz-hand center" style="--from-x: 90px; --from-y: -80px">
        {#if r}{#each r.community as c, i (i)}<PlayingCard card={c} hidden={i >= shown} delay={600 + i * 200} flipDelay={150} />{/each}{:else}<PlayingCard
            hidden
            deal={false}
          /><PlayingCard hidden deal={false} />{/if}
      </div>
    {/key}
    <div class="bets" aria-label="Your three bets" role="group">
      {#each [0, 1, 2] as i (i)}
        <div class="cz-spot" class:pulled={r && !r.riding[i]} class:win={settled && r!.payout > 0 && r!.riding[i]} bind:this={spotEls[i]}>
          <span class="mark" aria-hidden="true">{i === 2 ? '$' : i + 1}</span>
          {#if !r || r.riding[i]}<span class="stack"><ChipStack amount={r ? r.unit : unit} size={26} tag={false} /></span>{/if}
          <span class="cz-spot-label">{r ? (r.riding[i] ? `${r.unit} riding` : 'back') : `${unit}`}</span>
        </div>
      {/each}
    </div>
    <div class="cz-label center">
      You {#if r}<span class="cz-badge">{settled ? label : 'three cards'}</span>{/if}
    </div>
    {#key n}
      <div class="cz-hand center" style="--from-x: 130px; --from-y: -240px">
        {#if r}{#each r.player as c, i (i)}<PlayingCard card={c} delay={i * 200} />{/each}{/if}
      </div>
    {/key}
    <div class="cz-result center" aria-live="polite" class:win={settled && net > 0} class:lose={settled && net < 0}>
      {#if r && r.step !== 'done'}
        {r.step === 1 ? 'Let bet 1 ride, or pull it back?' : 'Let bet 2 ride, or pull it back?'}
        {#if hint}<span class="tip">Basic strategy: {advice ? 'let it ride' : 'pull it back'}.</span>{/if}
      {:else if settled && r}
        {r.payout ? `${LIR_PAYTABLE.find((p) => p.hand === r!.hand)?.label} on ${riding} bet${riding === 1 ? '' : 's'}` : 'No win'} · {net >= 0 ? '+' : ''}{net.toLocaleString()}
      {/if}
    </div>
    <WinFx bind:this={fx} />
  </div>
  <div class="cz-deck">
    {#if r && r.step !== 'done'}
      <button class="btn cz-go" onclick={() => decide(true)} disabled={busy}>Let it ride</button>
      <button class="btn cz-alt" onclick={() => decide(false)} disabled={busy}>Pull back {r.unit}</button>
      <button class="btn ghost sm" onclick={() => (hint = true)} disabled={hint}>Hint</button>
    {:else}
      <BetControl bind:value={unit} label="Each bet" disabled={busy} />
      <div class="grow"></div>
      <button class="btn cz-go" onclick={deal} disabled={busy || unit * 3 > economy.wallet.chips}>Deal ({(unit * 3).toLocaleString()})</button>
    {/if}
  </div>
  <div class="cz-paytable">
    {#each LIR_PAYTABLE as p (p.hand)}<span class:hit={settled && r?.hand === p.hand}>{p.label}</span><span class:hit={settled && r?.hand === p.hand}>{p.pays}:1</span>{/each}
  </div>
  <p class="cz-edge">
    You place three equal bets and get three cards; two community cards finish the hand. Pull back bet 1 after your cards, bet 2 after the first community card. The $ bet always
    rides. One deck; house edge about 3.5% per bet with the basic strategy (the Hint button shows it).
  </p>
</div>

<style>
  .lir {
    gap: 10px;
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .center {
    justify-content: center;
  }
  .bets {
    display: flex;
    justify-content: center;
    gap: 22px;
    padding: 4px 0 20px;
  }
  .bets .cz-spot {
    width: 66px;
    height: 66px;
    transition: opacity 300ms;
  }
  .mark {
    font-family: Georgia, serif;
    font-size: 26px;
    font-weight: 900;
    color: rgba(255, 236, 170, 0.5);
  }
  .stack {
    position: absolute;
    bottom: 10px;
  }
  .cz-spot.pulled {
    opacity: 0.5;
    border-style: dashed;
  }
  .tip {
    display: block;
    font-weight: 500;
    font-size: 13px;
    opacity: 0.9;
  }
  .grow {
    flex: 1;
  }
</style>
