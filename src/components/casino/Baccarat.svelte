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
      <div class="zone player" class:won={round?.winner === 'player'}>
        <div class="cz-label">
          Player {#if round}<span class="pill">{bacTotal(round.player)}</span>{/if}
        </div>
        <div class="cz-hand">
          {#if round}{#each round.player as c, i (i)}<span class="deal" style="animation-delay: {i * 60}ms"><PlayingCard card={c} /></span>{/each}{/if}
        </div>
      </div>
      <div class="zone banker" class:won={round?.winner === 'banker'}>
        <div class="cz-label">
          Banker {#if round}<span class="pill">{bacTotal(round.banker)}</span>{/if}
        </div>
        <div class="cz-hand">
          {#if round}{#each round.banker as c, i (i)}<span class="deal" style="animation-delay: {i * 60}ms"><PlayingCard card={c} /></span>{/each}{/if}
        </div>
      </div>
    </div>
    <div class="spots" aria-hidden="true">
      {#each ['player', 'tie', 'banker'] as const as b (b)}<span class="spot" class:filled={side === b}>{LABEL[b]}<small>{side === b ? bet : ''}</small></span>{/each}
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
  /* two labeled zones: a cool blue for the player, a warm red for the banker */
  .zone {
    padding: 8px 10px;
    border-radius: var(--radius);
    background: rgba(0, 0, 0, 0.18);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
    transition: box-shadow var(--dur-slow);
  }
  .zone.player {
    border-top: 3px solid #74b9ff;
  }
  .zone.banker {
    border-top: 3px solid #ff7675;
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
  }
  .pill {
    font-size: 13px;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0;
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
  .spots {
    display: flex;
    gap: 10px;
    justify-content: center;
  }
  .spot {
    min-width: 60px;
    height: 60px;
    padding: 0 8px;
    border-radius: 50%;
    border: 2px dashed rgba(255, 224, 102, 0.75);
    display: grid;
    place-content: center;
    text-align: center;
    line-height: 1.1;
    font-size: 11px;
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
      transform var(--dur) var(--spring);
  }
  .spot small {
    font-size: 13px;
    font-weight: 900;
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
    transform: scale(1.08);
  }
  @media (max-width: 480px) {
    .sides {
      grid-template-columns: 1fr;
    }
  }
</style>
