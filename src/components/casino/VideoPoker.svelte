<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { vpDeal, vpDraw, VP_LABEL, VP_PAYTABLE, type PokerHand, type VpState } from '../../lib/casino/videopoker';
  import BetControl from './BetControl.svelte';
  import PlayingCard from './PlayingCard.svelte';
  import WinFx from './WinFx.svelte';
  import { wait } from './fx';
  import { sfx } from './sfx';

  let bet = $state(10);
  let s = $state<VpState | null>(null);
  let busy = $state(false);
  let fx = $state<WinFx>();

  async function deal() {
    if (busy || !economy.bet('video poker', bet)) return;
    fx?.clear();
    s = vpDeal();
    busy = true;
    await wait(5 * 90 + 420);
    busy = false;
  }
  function toggle(i: number) {
    if (!s || s.phase !== 'hold' || busy) return;
    s = { ...s, held: s.held.map((h, j) => (j === i ? !h : h)) };
    sfx('click');
  }
  async function draw() {
    if (!s || busy) return;
    const replaced = s.held.filter((h) => !h).length;
    s = vpDraw(s, bet);
    busy = true;
    economy.payout('video poker', s.payout);
    if (s.result === 'royal') economy.achieve('royal');
    if (s.result === 'royal' || s.result === 'straightFlush' || s.result === 'four') economy.achieve('four-kind');
    await wait(replaced ? replaced * 90 + 420 : 150);
    busy = false;
    fx?.show(s.payout, bet);
  }
  const hands = Object.keys(VP_PAYTABLE).filter((h) => h !== 'nothing') as PokerHand[];
  const done = $derived(s?.phase === 'done' && !busy);
  // cards dealt fresh get a stagger by position
  const delays = $derived.by(() => {
    if (!s) return [0, 0, 0, 0, 0];
    let k = 0;
    return s.hand.map((_, i) => (s!.phase === 'done' && s!.held[i] ? 0 : k++ * 90));
  });
</script>

<div class="cz-game">
  <div class="cabinet">
    <div class="screen">
      <div class="pays" aria-label="Paytable">
        {#each hands as h (h)}
          <span class="pl" class:hit={done && s?.result === h}>{VP_LABEL[h]}</span>
          <span class="pv" class:hit={done && s?.result === h}>{(VP_PAYTABLE[h] * bet).toLocaleString()}</span>
        {/each}
      </div>
      <div class="cz-hand cards center" style="--cw: min(76px, calc((100vw - 120px) / 5)); --from-x: 0px; --from-y: -120px">
        {#if s}
          {#each s.hand as c, i (i + c.suit + c.rank)}
            <button class="hold" onclick={() => toggle(i)} disabled={s.phase !== 'hold' || busy} aria-pressed={s.held[i]}
              ><PlayingCard card={c} held={s.phase === 'hold' && s.held[i]} delay={delays[i]} win={done && s.payout > 0} /></button
            >
          {/each}
        {:else}
          {#each [0, 1, 2, 3, 4] as i (i)}<PlayingCard hidden deal={false} />{/each}
        {/if}
      </div>
      <div class="status cz-result" aria-live="polite" class:win={done && s!.payout > 0} class:lose={done && s!.payout === 0}>
        {#if s?.phase === 'hold'}Tap cards to hold, then draw.{:else if done && s?.result}<span class="big">{VP_LABEL[s.result]}</span>{s.payout ? ` · +${s.payout.toLocaleString()}` : ''}{:else if !s}Jacks or
          Better · press Deal{/if}
      </div>
      <div class="leds" aria-hidden="true">
        <span>Bet <b>{bet.toLocaleString()}</b></span>
        <span>Win <b>{done && s ? s.payout.toLocaleString() : '0'}</b></span>
        <span>Credits <b>{economy.wallet.chips.toLocaleString()}</b></span>
      </div>
      <WinFx bind:this={fx} />
    </div>
  </div>
  <div class="cz-deck">
    {#if s?.phase === 'hold'}
      <span class="muted">{s.held.filter(Boolean).length} held</span>
      <div class="grow"></div>
      <button class="btn cz-go" onclick={draw} disabled={busy}>Draw</button>
    {:else}
      <BetControl bind:value={bet} disabled={busy} />
      <div class="grow"></div>
      <button class="btn cz-go" onclick={deal} disabled={busy || bet > economy.wallet.chips}>Deal</button>
    {/if}
  </div>
  <p class="cz-edge">Jacks or Better, full-pay 9/6 table: about 99.5% return with perfect holds. The screen shows what each hand pays at your bet.</p>
</div>

<style>
  .cabinet {
    padding: 14px;
    border-radius: 24px;
    background: linear-gradient(180deg, #2b2b36 0%, #15151c 60%, #0b0b10 100%);
    box-shadow:
      inset 0 0 0 2px #e7b84a,
      inset 0 0 0 6px #0b0b10,
      inset 0 0 0 7px rgba(231, 184, 74, 0.5),
      0 16px 30px -12px rgba(0, 0, 0, 0.6);
  }
  .screen {
    position: relative;
    display: grid;
    gap: 12px;
    padding: 14px 14px 12px;
    border-radius: 18px / 22px;
    color: #fff;
    background:
      repeating-linear-gradient(180deg, rgba(0, 0, 0, 0.16) 0 1px, transparent 1px 3px),
      radial-gradient(ellipse at 50% 40%, #1a3ad8 0%, #0c1f9a 55%, #06104f 100%);
    box-shadow:
      inset 0 0 40px rgba(0, 0, 30, 0.8),
      inset 0 0 0 2px rgba(120, 160, 255, 0.35),
      0 0 24px rgba(40, 90, 255, 0.35);
    overflow: hidden;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .screen::after {
    /* curved glass */
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(ellipse at 30% 0%, rgba(255, 255, 255, 0.12), transparent 50%);
  }
  .pays {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr) 70px);
    gap: 1px 12px;
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #ffe14a;
    text-shadow: 0 0 6px rgba(255, 225, 74, 0.5);
  }
  .pv {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .pays .hit {
    color: #fff;
    background: #d6123a;
    animation: blink 0.5s steps(2) 6;
  }
  @keyframes blink {
    50% {
      background: transparent;
      color: #ffe14a;
    }
  }
  .cards {
    justify-content: center;
    gap: 8px;
    padding: 8px 0 22px;
  }
  .hold {
    background: none;
    padding: 0;
    border: 0;
    border-radius: 8px;
  }
  .hold:focus-visible {
    outline: 3px solid #ffe14a;
    outline-offset: 4px;
  }
  .hold:disabled {
    cursor: default;
  }
  .status {
    text-align: center;
    color: #ffe14a;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 15px;
    text-shadow: 0 0 8px rgba(255, 225, 74, 0.6);
  }
  .status.lose {
    color: #c9d4ff;
  }
  .big {
    font-size: 20px;
    color: #fff;
    text-shadow:
      0 0 10px #ffe14a,
      0 0 20px #ff9d00;
  }
  .leds {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #9fb4ff;
  }
  .leds b {
    display: inline-block;
    margin-left: 6px;
    min-width: 5ch;
    padding: 1px 6px;
    border-radius: 4px;
    background: #050510;
    color: #ff3b30;
    font-size: 14px;
    text-shadow: 0 0 6px rgba(255, 60, 40, 0.8);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  .grow {
    flex: 1;
  }
  @media (max-width: 520px) {
    .cabinet {
      padding: 8px;
    }
    .screen {
      padding: 10px 8px;
    }
    .pays {
      grid-template-columns: 1fr auto 1fr auto;
      font-size: 10px;
    }
    .cards {
      gap: 4px;
    }
    .leds {
      font-size: 9px;
    }
    .leds b {
      font-size: 12px;
      margin-left: 3px;
    }
  }
</style>
