<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { deal, doubleDown, handValue, hit, stand, type BjState } from '../../lib/casino/blackjack';
  import type { PlayingCard as Card } from '../../lib/casino/cards';
  import BetControl from './BetControl.svelte';
  import BotAvatar from './BotAvatar.svelte';
  import ChipStack from './ChipStack.svelte';
  import PlayingCard from './PlayingCard.svelte';
  import WinFx from './WinFx.svelte';
  import { chipsIn, chipsOut, wait } from './fx';

  let bet = $state(25);
  let s = $state<BjState | null>(null);
  let shoe: Card[] | undefined;
  let round = $state(0);
  let busy = $state(false);
  let revealed = $state(false);
  let fx = $state<WinFx>();
  let spot = $state<HTMLElement>();

  const OUTCOME: Record<string, string> = {
    blackjack: 'Blackjack! Pays 3:2',
    win: 'You win',
    dealerBust: 'Dealer busts. You win',
    push: 'Push: bet returned',
    lose: 'Dealer wins',
    bust: 'Bust',
  };
  const SAYS: Record<string, string> = { blackjack: 'Blackjack!', win: 'Nice hand!', dealerBust: 'Too many…', push: 'Push.', lose: 'House wins.', bust: 'Bust!' };

  async function start() {
    if (busy || !economy.bet('blackjack', bet)) return;
    chipsIn(spot, bet);
    fx?.clear();
    revealed = false;
    round++;
    s = deal(bet, shoe);
    busy = true;
    await wait(1000);
    busy = false;
    await finish(0);
  }
  async function act(next: BjState, cards = 1) {
    const before = s?.dealer.length ?? 2;
    s = next;
    busy = true;
    await wait(cards ? 440 : 120);
    busy = false;
    await finish(Math.max(0, (s?.dealer.length ?? 2) - before));
  }
  function dbl() {
    if (!s || !economy.raise('blackjack', s.bet)) return;
    chipsIn(spot, s.bet);
    void act(doubleDown(s));
  }
  async function finish(extra: number) {
    if (!s) return;
    shoe = s.shoe;
    if (s.phase !== 'done') return;
    busy = true;
    // the hole card turns over, then the dealer's draws come one at a time
    await wait(500 + extra * 460);
    busy = false;
    revealed = true;
    economy.payout('blackjack', s.payout);
    if (s.outcome === 'blackjack') economy.achieve('natural');
    fx?.show(s.payout, s.bet);
    if (s.payout > 0) chipsOut(spot, s.payout);
  }
  const playing = $derived(s?.phase === 'player');
  const pv = $derived(s ? handValue(s.player) : null);
  const dv = $derived(s ? handValue(playing || !revealed ? s.dealer.slice(0, 1) : s.dealer) : null);
  const dealerDelay = (i: number) => (i === 0 ? 180 : i === 1 ? 540 : 360 + (i - 2) * 460);
  const playerDelay = (i: number) => (i === 0 ? 0 : i === 1 ? 360 : 0);
</script>

<div class="cz-game">
  <div class="cz-table bj">
    <svg class="cz-arc" viewBox="0 0 400 60" aria-hidden="true">
      <path id="bj-arc" d="M8 8 Q200 66 392 8" fill="none" />
      <text><textPath href="#bj-arc" startOffset="50%" text-anchor="middle">Blackjack pays 3 to 2 · Dealer stands on soft 17</textPath></text>
    </svg>
    <div class="top">
      <div class="cz-dealer">
        <BotAvatar who="tess" size={52} label="Tess, the dealer" />
        <span class="who"><strong>Tess</strong><span>Dealer</span></span>
        {#if revealed && s?.outcome}<span class="cz-bubble say">{SAYS[s.outcome]}</span>{/if}
      </div>
      <span class="cz-shoe" aria-hidden="true"></span>
    </div>
    <div class="cz-label">
      Dealer {#if dv}<span class="cz-badge" class:bust={revealed && dv.total > 21}>{dv.total}{playing || !revealed ? '+' : ''}</span>{/if}
    </div>
    {#key round}
      <div class="cz-hand fan dealer" style="--from-x: 120px; --from-y: -90px">
        {#if s}{#each s.dealer as c, i (i)}<PlayingCard card={c} hidden={playing && i === 1} delay={dealerDelay(i)} />{/each}{/if}
      </div>
    {/key}
    <div class="mid">
      <div class="cz-spot" class:win={revealed && !!s && s.payout > s.bet} bind:this={spot}>
        <span class="stk" class:preview={!s || revealed}><ChipStack amount={!s || revealed ? bet : s.bet} size={30} /></span>
        <span class="cz-spot-label">{s?.doubled ? 'Doubled' : 'Bet'}</span>
      </div>
    </div>
    <div class="cz-label">
      You {#if pv}<span class="cz-badge" class:bust={pv.total > 21}>{pv.soft && pv.total <= 21 ? 'soft ' : ''}{pv.total}</span>{/if}{s?.doubled ? ' · doubled' : ''}
    </div>
    {#key round}
      <div class="cz-hand fan" style="--from-x: 160px; --from-y: -220px">
        {#if s}{#each s.player as c, i (i)}<PlayingCard card={c} delay={playerDelay(i)} />{/each}{/if}
      </div>
    {/key}
    <div class="cz-result" aria-live="polite" class:win={revealed && !!s && s.payout > s.bet} class:lose={revealed && s?.payout === 0}>
      {revealed && s?.phase === 'done' && s.outcome ? `${OUTCOME[s.outcome]}${s.payout > s.bet ? ` · +${(s.payout - s.bet).toLocaleString()}` : ''}` : ''}
    </div>
    <WinFx bind:this={fx} />
  </div>
  <div class="cz-deck">
    {#if playing && s}
      <button class="btn cz-go" onclick={() => act(hit(s!))} disabled={busy}>Hit</button>
      <button class="btn cz-alt" onclick={() => act(stand(s!), 0)} disabled={busy}>Stand</button>
      <button class="btn cz-alt" onclick={dbl} disabled={busy || s.player.length !== 2 || economy.wallet.chips < s.bet}>Double</button>
    {:else}
      <BetControl bind:value={bet} disabled={busy} />
      <div class="grow"></div>
      <button class="btn cz-go" onclick={start} disabled={busy || bet > economy.wallet.chips}>Deal</button>
    {/if}
  </div>
  <p class="cz-edge">Six decks, dealer stands on soft 17, blackjack pays 3:2, double on your first two cards. House edge about 0.6% with good play.</p>
</div>

<style>
  .bj {
    gap: 8px;
  }
  .bj :global(.cz-arc text) {
    font-size: 10px;
    letter-spacing: 0.12em;
  }
  .bj > .cz-label,
  .bj .cz-hand {
    justify-content: center;
  }
  .bj .cz-result {
    text-align: center;
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: -6px;
  }
  .cz-dealer {
    position: relative;
  }
  .say {
    left: 30px;
    top: -30px;
  }
  .mid {
    display: flex;
    justify-content: center;
    padding: 6px 0 14px;
  }
  .stk {
    transition: opacity 300ms;
  }
  .stk.preview {
    opacity: 0.55;
  }
  .grow {
    flex: 1;
  }
</style>
