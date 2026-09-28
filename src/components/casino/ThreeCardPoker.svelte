<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { ANTE_BONUS, evalThree, PAIR_PLUS, shouldPlay, tcDeal, tcFinish, TC_CATS, TC_LABEL, type TcCat, type TcRound } from '../../lib/casino/threecard';
  import { playSound } from '../../lib/sounds';
  import BetControl from './BetControl.svelte';
  import PlayingCard from './PlayingCard.svelte';

  let ante = $state(10);
  let pairPlus = $state(true);
  let r = $state<TcRound | null>(null);
  let hint = $state(false);

  const staked = $derived(ante + (pairPlus ? ante : 0));

  function deal() {
    if (!economy.bet('three card poker', staked)) return;
    hint = false;
    r = tcDeal({ ante, pairPlus: pairPlus ? ante : 0 });
  }
  function decide(play: boolean) {
    if (!r || r.phase !== 'decide') return;
    if (play && !economy.raise('three card poker', r.bets.ante)) return;
    r = tcFinish(r, play);
    const total = r.result!.total;
    economy.payout('three card poker', total);
    if (total > r.bets.ante + r.bets.pairPlus + (play ? r.bets.ante : 0)) playSound('pop');
  }

  const OUTCOME = { fold: 'You folded', noQualify: "Dealer doesn't qualify: Ante wins, Play pushes", win: 'You beat the dealer', lose: 'Dealer wins', push: 'Push' };
  const cats = [...TC_CATS].reverse().filter((c) => c !== 'high') as TcCat[];
  const done = $derived(r?.phase === 'done' ? r.result : undefined);
  const net = $derived(done && r ? done.total - r.bets.ante - r.bets.pairPlus - (r.played ? r.bets.ante : 0) : 0);
</script>

<div class="cz-game">
  <div class="cz-table">
    <div class="zone" class:won={done && net < 0}>
      <div class="cz-label">
        Dealer {#if done}<span class="pill">{TC_LABEL[done.dealer.cat]}{done.qualified ? '' : ' (no queen high)'}</span>{/if}
      </div>
      <div class="cz-hand">
        {#if r}{#each r.dealer as c, i (i)}<span class="deal" style="animation-delay: {i * 60}ms"><PlayingCard card={c} hidden={r.phase !== 'done'} /></span
            >{/each}{:else}{#each [0, 1, 2] as i (i)}<span class="deal" style="animation-delay: {i * 60}ms"><PlayingCard hidden /></span>{/each}{/if}
      </div>
    </div>
    <div class="zone me" class:won={done && net > 0}>
      <div class="cz-label">
        You {#if r}<span class="pill">{TC_LABEL[evalThree(r.player).cat]}</span>{/if}
      </div>
      <div class="cz-hand">
        {#if r}{#each r.player as c, i (i)}<span class="deal" style="animation-delay: {i * 60}ms"><PlayingCard card={c} /></span>{/each}{/if}
      </div>
    </div>
    <div class="spots" aria-hidden="true">
      <span class="spot" class:filled={!!r}>Ante<small>{r ? r.bets.ante : ante}</small></span>
      <span class="spot" class:filled={!!r && r.bets.pairPlus > 0} class:off={!r && !pairPlus}>Pair Plus<small>{r ? r.bets.pairPlus || '—' : pairPlus ? ante : '—'}</small></span>
      <span class="spot" class:filled={!!r && r.played} class:off={done && !r?.played}>Play<small>{r?.played ? r.bets.ante : '—'}</small></span>
    </div>
    <div class="cz-result" aria-live="polite" class:win={done && net > 0} class:lose={done && net < 0}>
      {#if r?.phase === 'decide'}
        Play (match your ante) or fold.
        {#if hint}<span class="tip">Q-6-4 or better: {shouldPlay(r.player) ? 'play' : 'fold'}.</span>{/if}
      {:else if done}
        {OUTCOME[done.outcome]}{done.bonus ? ` · Ante bonus +${done.bonus}` : ''}{done.pairPlus ? ` · Pair Plus +${done.pairPlus - r!.bets.pairPlus}` : ''} · {net >= 0
          ? '+'
          : ''}{net.toLocaleString()}
      {/if}
    </div>
  </div>
  <div class="cz-actions">
    {#if r?.phase === 'decide'}
      <button class="btn primary" onclick={() => decide(true)} disabled={economy.wallet.chips < r.bets.ante}>Play {r.bets.ante}</button>
      <button class="btn" onclick={() => decide(false)}>Fold</button>
      <button class="btn ghost sm" onclick={() => (hint = true)} disabled={hint}>Hint</button>
    {:else}
      <BetControl bind:value={ante} label="Ante" />
      <label class="pp"><input type="checkbox" bind:checked={pairPlus} /> Pair Plus ({ante})</label>
      <button class="btn primary" onclick={deal} disabled={staked > economy.wallet.chips}>Deal</button>
    {/if}
  </div>
  <div class="tables">
    <div class="cz-paytable" aria-label="Pair Plus paytable">
      <strong class="h">Pair Plus</strong><span></span>
      {#each cats as c (c)}<span class:hit={done && done.player.cat === c && r?.bets.pairPlus}>{TC_LABEL[c]}</span><span>{PAIR_PLUS[c]}:1</span>{/each}
    </div>
    <div class="cz-paytable" aria-label="Ante bonus paytable">
      <strong class="h">Ante bonus</strong><span></span>
      {#each cats.filter((c) => ANTE_BONUS[c] > 0) as c (c)}<span class:hit={done?.bonus && done.player.cat === c}>{TC_LABEL[c]}</span><span>{ANTE_BONUS[c]}:1</span>{/each}
    </div>
  </div>
  <p class="cz-edge">
    One deck. The dealer needs queen high to qualify; if not, the Ante pays 1:1 and the Play bet pushes. The Ante bonus pays even when the dealer wins. Folding loses the Ante and
    Pair Plus. House edge: about 3.4% of the Ante playing Q-6-4 or better; Pair Plus 2.3%.
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
  .spot.off {
    opacity: 0.45;
  }
  .pp {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 13px;
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--bg-elev-2);
    transition:
      border-color var(--dur),
      box-shadow var(--dur);
  }
  .pp:has(:checked) {
    border-color: var(--gold);
    box-shadow: 0 0 10px color-mix(in srgb, var(--gold) 40%, transparent);
  }
  .pp input {
    accent-color: var(--gold);
  }
  .tip {
    display: block;
    font-weight: 500;
    font-size: 13px;
    opacity: 0.9;
  }
  .tables {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
  }
  .h {
    color: var(--text);
  }
</style>
