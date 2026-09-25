<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { bacTotal, playBaccarat, settleBaccarat, type BaccaratBet, type BaccaratRound } from '../../lib/casino/baccarat';
  import { playSound } from '../../lib/sounds';
  import BetControl from './BetControl.svelte';
  import PlayingCard from './PlayingCard.svelte';

  let bet = $state(25);
  let side = $state<BaccaratBet>('banker');
  let round = $state<BaccaratRound | null>(null);
  let returned = $state(0);

  function deal() {
    if (!economy.bet('baccarat', bet)) return;
    round = playBaccarat();
    returned = settleBaccarat(side, bet, round.winner);
    economy.payout('baccarat', returned);
    if (returned > bet) playSound('pop');
  }
  const LABEL: Record<BaccaratBet, string> = { player: 'Player', banker: 'Banker', tie: 'Tie' };
</script>

<div class="cz-game">
  <div class="cz-table">
    <div class="sides">
      <div>
        <div class="cz-label">Player {round ? `· ${bacTotal(round.player)}` : ''}</div>
        <div class="cz-hand">
          {#if round}{#each round.player as c, i (i)}<PlayingCard card={c} />{/each}{/if}
        </div>
      </div>
      <div>
        <div class="cz-label">Banker {round ? `· ${bacTotal(round.banker)}` : ''}</div>
        <div class="cz-hand">
          {#if round}{#each round.banker as c, i (i)}<PlayingCard card={c} />{/each}{/if}
        </div>
      </div>
    </div>
    <div class="cz-result" aria-live="polite" class:win={round && returned > bet} class:lose={round && returned === 0}>
      {#if round}{LABEL[round.winner]}{round.winner === 'tie' ? '' : ' wins'} · {returned > bet
          ? `+${(returned - bet).toLocaleString()}`
          : returned === bet
            ? 'push'
            : 'you lose'}{/if}
    </div>
  </div>
  <div class="cz-actions">
    <div class="cz-seg" role="radiogroup" aria-label="Bet on">
      {#each ['player', 'banker', 'tie'] as const as b (b)}<button role="radio" aria-checked={side === b} class:on={side === b} onclick={() => (side = b)}>{LABEL[b]}</button
        >{/each}
    </div>
    <BetControl bind:value={bet} />
    <button class="btn primary" onclick={deal} disabled={bet > economy.wallet.chips}>Deal</button>
  </div>
  <p class="cz-edge">Player pays 1:1, Banker 0.95:1 (5% commission), Tie 8:1 (Player and Banker bets push on a tie). House edge: Banker 1.06%, Player 1.24%, Tie 14.4%.</p>
</div>

<style>
  .sides {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
</style>
