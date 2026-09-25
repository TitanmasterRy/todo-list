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
    <div class="cz-label">Dealer {dv ? `· ${dv.total}${playing ? '+' : ''}` : ''}</div>
    <div class="cz-hand">
      {#if s}{#each s.dealer as c, i (i)}<PlayingCard card={c} hidden={playing && i === 1} />{/each}{/if}
    </div>
    <div class="cz-label">You {pv ? `· ${pv.soft && pv.total <= 21 ? 'soft ' : ''}${pv.total}` : ''}{s?.doubled ? ' · doubled' : ''}</div>
    <div class="cz-hand">
      {#if s}{#each s.player as c, i (i)}<PlayingCard card={c} />{/each}{/if}
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
