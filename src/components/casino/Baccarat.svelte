<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { bacTotal, playBaccarat, settleBaccarat, type BaccaratBet, type BaccaratRound } from '../../lib/casino/baccarat';
  import BetControl from './BetControl.svelte';
  import BotAvatar from './BotAvatar.svelte';
  import ChipStack from './ChipStack.svelte';
  import PlayingCard from './PlayingCard.svelte';
  import WinFx from './WinFx.svelte';
  import { chipsIn, chipsOut, wait } from './fx';
  import { sfx } from './sfx';

  let bet = $state(25);
  let side = $state<BaccaratBet>('banker');
  let round = $state<BaccaratRound | null>(null);
  let returned = $state(0);
  let busy = $state(false);
  let revealed = $state(false);
  let n = $state(0);
  let roads = $state<BaccaratBet[]>([]);
  let fx = $state<WinFx>();
  const spots: Record<BaccaratBet, HTMLElement | undefined> = $state({ player: undefined, banker: undefined, tie: undefined });

  // deal order: player, banker, player, banker, then any third cards
  const pDelay = (i: number) => [0, 500, 1250][i] ?? 0;
  const bDelay = (i: number) => [250, 750, 1250 + (round && round.player.length > 2 ? 500 : 0)][i] ?? 0;

  async function deal() {
    if (busy || !economy.bet('baccarat', bet)) return;
    chipsIn(spots[side], bet);
    fx?.clear();
    revealed = false;
    busy = true;
    round = playBaccarat();
    n++;
    const staked = bet;
    const pick = side;
    returned = settleBaccarat(pick, staked, round.winner);
    const last = Math.max(pDelay(round.player.length - 1), bDelay(round.banker.length - 1));
    await wait(last + 800);
    economy.payout('baccarat', returned);
    revealed = true;
    busy = false;
    roads = [...roads, round.winner].slice(-18);
    fx?.show(returned, staked);
    if (returned > 0) chipsOut(spots[pick], returned);
  }
  const LABEL: Record<BaccaratBet, string> = { player: 'Player', banker: 'Banker', tie: 'Tie' };
  const PAYS: Record<BaccaratBet, string> = { player: '1 to 1', banker: '0.95 to 1', tie: '8 to 1' };
  const natural = (cards: BaccaratRound['player']) => cards.length === 2 && bacTotal(cards) >= 8;
</script>

<div class="cz-game">
  <div class="cz-table blue bac">
    <div class="top">
      <div class="cz-dealer">
        <BotAvatar who="lou" size={48} label="Lou, the dealer" />
        <span class="who"><strong>Lou</strong><span>Dealer</span></span>
      </div>
      <div class="road" aria-label="Recent winners">
        {#each roads as r, i (i)}<span class="bead {r}" title={LABEL[r]}>{r === 'tie' ? 'T' : r === 'player' ? 'P' : 'B'}</span>{/each}
      </div>
      <span class="cz-shoe" aria-hidden="true"></span>
    </div>
    <div class="sides">
      {#each ['player', 'banker'] as const as who (who)}
        {@const cards = round ? round[who] : []}
        <div class="box {who}" class:won={revealed && round?.winner === who}>
          <div class="cz-label">
            <span class="name">{LABEL[who]}</span>
            {#if round && revealed}<span class="cz-badge">{bacTotal(cards)}</span>{#if natural(cards)}<span class="nat">Natural</span>{/if}{/if}
          </div>
          {#key n}
            <div class="cz-hand fan center" style="--from-x: {who === 'player' ? 200 : 60}px; --from-y: -140px">
              {#each cards as c, i (i)}<PlayingCard card={c} delay={who === 'player' ? pDelay(i) : bDelay(i)} />{/each}
            </div>
          {/key}
        </div>
      {/each}
    </div>
    <div class="spots" role="radiogroup" aria-label="Bet on">
      {#each ['player', 'tie', 'banker'] as const as b (b)}
        <button
          class="spot {b}"
          role="radio"
          aria-checked={side === b}
          aria-label={LABEL[b]}
          class:on={side === b}
          class:win={revealed && round?.winner === b && side === b}
          disabled={busy}
          bind:this={spots[b]}
          onclick={() => {
            side = b;
            sfx('chip');
          }}
        >
          <span class="sl">{LABEL[b]}</span>
          <span class="sp">{PAYS[b]}</span>
          {#if side === b}<span class="stack"><ChipStack amount={bet} size={28} /></span>{/if}
        </button>
      {/each}
    </div>
    <div class="cz-result center" aria-live="polite" class:win={revealed && returned > bet} class:lose={revealed && returned === 0}>
      {#if round && revealed}{LABEL[round.winner]}{round.winner === 'tie' ? '' : ' wins'} · {returned > bet
          ? `+${(returned - bet).toLocaleString()}`
          : returned === bet
            ? 'push'
            : 'you lose'}{:else if busy}Dealing…{:else}Pick Player, Banker or Tie{/if}
    </div>
    <WinFx bind:this={fx} />
  </div>
  <div class="cz-deck">
    <BetControl bind:value={bet} disabled={busy} />
    <div class="grow"></div>
    <button class="btn cz-go" onclick={deal} disabled={busy || bet > economy.wallet.chips}>Deal</button>
  </div>
  <p class="cz-edge">Player pays 1:1, Banker 0.95:1 (5% commission), Tie 8:1 (Player and Banker bets push on a tie). House edge: Banker 1.06%, Player 1.24%, Tie 14.4%.</p>
</div>

<style>
  .top {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .road {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    justify-content: center;
    min-height: 22px;
  }
  .bead {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 10px;
    font-weight: 900;
    color: #fff;
    box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.25);
    animation: bead 300ms cubic-bezier(0.3, 1.6, 0.5, 1);
  }
  .bead.player {
    background: #2f7de1;
  }
  .bead.banker {
    background: #d6123a;
  }
  .bead.tie {
    background: #18a957;
  }
  @keyframes bead {
    from {
      transform: scale(0);
    }
  }
  .sides {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .box {
    display: grid;
    gap: 6px;
    justify-items: center;
    padding: 10px 8px 12px;
    border-radius: 14px;
    border: 2px solid rgba(255, 244, 210, 0.55);
    transition:
      box-shadow 300ms,
      border-color 300ms;
  }
  .box.won {
    border-color: #ffe39a;
    box-shadow:
      0 0 0 2px rgba(255, 215, 106, 0.4),
      0 0 24px rgba(255, 215, 106, 0.45);
  }
  .name {
    font-family: Georgia, serif;
    font-weight: 900;
    letter-spacing: 0.2em;
    font-size: 14px;
  }
  .player .name {
    color: #9cd2ff;
  }
  .banker .name {
    color: #ffb3b3;
  }
  .nat {
    font-size: 10px;
    font-weight: 900;
    padding: 2px 6px;
    border-radius: 4px;
    background: #ffe39a;
    color: #2a1a00;
    letter-spacing: 0.08em;
  }
  .spots {
    display: grid;
    grid-template-columns: 1fr 0.8fr 1fr;
    gap: 8px;
  }
  .spot {
    position: relative;
    display: grid;
    justify-items: center;
    gap: 2px;
    padding: 12px 8px 26px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.14);
    border: 2px solid rgba(255, 244, 210, 0.6);
    color: #fff8e0;
    transition:
      background 200ms,
      box-shadow 200ms,
      transform 150ms var(--spring);
  }
  .spot:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }
  .spot:focus-visible {
    outline: 3px solid #ffe39a;
    outline-offset: 2px;
  }
  .spot.on {
    background: rgba(255, 230, 120, 0.16);
    border-color: #ffe39a;
  }
  .spot.win {
    box-shadow: 0 0 22px rgba(255, 215, 106, 0.7);
  }
  .sl {
    font-family: Georgia, serif;
    font-weight: 900;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    font-size: 14px;
  }
  .spot.player .sl {
    color: #9cd2ff;
  }
  .spot.banker .sl {
    color: #ffb3b3;
  }
  .spot.tie .sl {
    color: #8dffb8;
  }
  .sp {
    font-size: 10px;
    opacity: 0.8;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .stack {
    position: absolute;
    bottom: -18px;
  }
  .grow {
    flex: 1;
  }
  @media (max-width: 520px) {
    .sides {
      gap: 6px;
    }
    .box {
      --cw: clamp(44px, 13vw, 56px);
      padding: 8px 4px;
    }
    .sl {
      font-size: 12px;
      letter-spacing: 0.08em;
    }
  }
</style>
