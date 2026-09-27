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
    <div class="cz-label">Dealer {done ? `· ${TC_LABEL[done.dealer.cat]}${done.qualified ? '' : ' (no queen high)'}` : ''}</div>
    <div class="cz-hand">
      {#if r}{#each r.dealer as c, i (i)}<PlayingCard card={c} hidden={r.phase !== 'done'} />{/each}{:else}{#each [0, 1, 2] as i (i)}<PlayingCard hidden />{/each}{/if}
    </div>
    <div class="cz-label">You {r ? `· ${TC_LABEL[evalThree(r.player).cat]}` : ''}</div>
    <div class="cz-hand">
      {#if r}{#each r.player as c, i (i)}<PlayingCard card={c} />{/each}{/if}
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
  .pp {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 13px;
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
