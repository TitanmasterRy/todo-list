<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { ANTE_BONUS, evalThree, PAIR_PLUS, shouldPlay, tcDeal, tcFinish, TC_CATS, TC_LABEL, type TcCat, type TcRound } from '../../lib/casino/threecard';
  import BetControl from './BetControl.svelte';
  import BotAvatar from './BotAvatar.svelte';
  import ChipStack from './ChipStack.svelte';
  import PlayingCard from './PlayingCard.svelte';
  import WinFx from './WinFx.svelte';
  import { chipsIn, chipsOut, wait } from './fx';

  let ante = $state(10);
  let pairPlus = $state(true);
  let r = $state<TcRound | null>(null);
  let hint = $state(false);
  let busy = $state(false);
  let revealed = $state(false);
  let n = $state(0);
  let fx = $state<WinFx>();
  let anteEl = $state<HTMLElement>();
  let playEl = $state<HTMLElement>();
  let ppEl = $state<HTMLElement>();

  const staked = $derived(ante + (pairPlus ? ante : 0));

  async function deal() {
    if (busy || !economy.bet('three card poker', staked)) return;
    chipsIn(anteEl, ante);
    if (pairPlus) setTimeout(() => chipsIn(ppEl, ante), 100);
    fx?.clear();
    hint = false;
    revealed = false;
    n++;
    r = tcDeal({ ante, pairPlus: pairPlus ? ante : 0 });
    busy = true;
    await wait(5 * 160 + 420);
    busy = false;
  }
  async function decide(play: boolean) {
    if (!r || r.phase !== 'decide' || busy) return;
    if (play && !economy.raise('three card poker', r.bets.ante)) return;
    if (play) chipsIn(playEl, r.bets.ante);
    r = tcFinish(r, play);
    const total = r.result!.total;
    const risked = r.bets.ante + r.bets.pairPlus + (play ? r.bets.ante : 0);
    busy = true;
    await wait(play ? 3 * 220 + 520 : 300);
    busy = false;
    revealed = true;
    economy.payout('three card poker', total);
    fx?.show(total, risked);
    if (total > 0) chipsOut(anteEl, total);
  }

  const OUTCOME = { fold: 'You folded', noQualify: "Dealer doesn't qualify: Ante wins, Play pushes", win: 'You beat the dealer', lose: 'Dealer wins', push: 'Push' };
  const cats = [...TC_CATS].reverse().filter((c) => c !== 'high') as TcCat[];
  const done = $derived(r?.phase === 'done' && revealed ? r.result : undefined);
  const net = $derived(done && r ? done.total - r.bets.ante - r.bets.pairPlus - (r.played ? r.bets.ante : 0) : 0);
  // deal alternates: you, dealer, you, dealer …
  const youDelay = (i: number) => i * 320;
  const dealerDelay = (i: number) => i * 320 + 160;
</script>

<div class="cz-game">
  <div class="cz-table tc">
    <div class="top">
      <div class="cz-dealer">
        <BotAvatar who="sam" size={48} label="Sam, the dealer" />
        <span class="who"><strong>Sam</strong><span>Dealer · plays with queen high</span></span>
      </div>
      <span class="cz-shoe" aria-hidden="true"></span>
    </div>
    <div class="cz-label">
      Dealer {#if done}<span class="cz-badge dark">{TC_LABEL[done.dealer.cat]}{done.qualified ? '' : ' (no queen high)'}</span>{/if}
    </div>
    {#key n}
      <div class="cz-hand center" style="--from-x: 100px; --from-y: -80px">
        {#if r}{#each r.dealer as c, i (i)}<PlayingCard
              card={c}
              hidden={r.phase !== 'done'}
              delay={dealerDelay(i)}
              flipDelay={120 + i * 220}
            />{/each}{:else}{#each [0, 1, 2] as i (i)}<PlayingCard hidden deal={false} />{/each}{/if}
      </div>
    {/key}
    <div class="spots" aria-hidden="true">
      <div class="cz-spot ppspot" bind:this={ppEl}>
        {#if r ? r.bets.pairPlus : pairPlus}<ChipStack amount={r ? r.bets.pairPlus : ante} size={26} />{/if}<span class="cz-spot-label">Pair Plus</span>
      </div>
      <div class="cz-spot" bind:this={anteEl}>
        <ChipStack amount={r ? r.bets.ante : ante} size={26} /><span class="cz-spot-label">Ante</span>
      </div>
      <div class="cz-spot" bind:this={playEl}>
        {#if r?.played}<ChipStack amount={r.bets.ante} size={26} />{/if}<span class="cz-spot-label">Play</span>
      </div>
    </div>
    <div class="cz-label">
      You {#if r}<span class="cz-badge">{TC_LABEL[evalThree(r.player).cat]}</span>{/if}
    </div>
    {#key n}
      <div class="cz-hand center" style="--from-x: 140px; --from-y: -220px">
        {#if r}{#each r.player as c, i (i)}<PlayingCard card={c} delay={youDelay(i)} />{/each}{/if}
      </div>
    {/key}
    <div class="cz-result center" aria-live="polite" class:win={done && net > 0} class:lose={done && net < 0}>
      {#if r?.phase === 'decide'}
        Play (match your ante) or fold.
        {#if hint}<span class="tip">Q-6-4 or better: {shouldPlay(r.player) ? 'play' : 'fold'}.</span>{/if}
      {:else if done}
        {OUTCOME[done.outcome]}{done.bonus ? ` · Ante bonus +${done.bonus}` : ''}{done.pairPlus ? ` · Pair Plus +${done.pairPlus - r!.bets.pairPlus}` : ''} · {net >= 0
          ? '+'
          : ''}{net.toLocaleString()}
      {/if}
    </div>
    <WinFx bind:this={fx} />
  </div>
  <div class="cz-deck">
    {#if r?.phase === 'decide'}
      <button class="btn cz-go" onclick={() => decide(true)} disabled={busy || economy.wallet.chips < r.bets.ante}>Play {r.bets.ante}</button>
      <button class="btn cz-alt" onclick={() => decide(false)} disabled={busy}>Fold</button>
      <button class="btn ghost sm" onclick={() => (hint = true)} disabled={hint}>Hint</button>
    {:else}
      <BetControl bind:value={ante} label="Ante" disabled={busy} />
      <label class="pp"><input type="checkbox" bind:checked={pairPlus} disabled={busy} /> Pair Plus ({ante})</label>
      <div class="grow"></div>
      <button class="btn cz-go" onclick={deal} disabled={busy || staked > economy.wallet.chips}>Deal</button>
    {/if}
  </div>
  <div class="tables">
    <div class="cz-paytable" role="group" aria-label="Pair Plus paytable">
      <strong class="h">Pair Plus</strong><span></span>
      {#each cats as c (c)}<span class:hit={done && done.player.cat === c && r?.bets.pairPlus}>{TC_LABEL[c]}</span><span>{PAIR_PLUS[c]}:1</span>{/each}
    </div>
    <div class="cz-paytable" role="group" aria-label="Ante bonus paytable">
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
  .tc {
    gap: 10px;
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .tc .cz-label {
    justify-content: center;
  }
  .spots {
    display: flex;
    justify-content: center;
    gap: 22px;
    padding: 6px 0 18px;
  }
  .spots .cz-spot {
    width: 62px;
    height: 62px;
  }
  .spots .ppspot {
    border-style: dashed;
  }
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
  .grow {
    flex: 1;
  }
</style>
