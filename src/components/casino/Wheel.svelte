<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { spinWheel, WHEEL_LAYOUT, WHEEL_SEGMENTS } from '../../lib/casino/quick';
  import { playSound } from '../../lib/sounds';
  import BetControl from './BetControl.svelte';

  let bet = $state(10);
  let pick = $state('1');
  let angle = $state(0);
  let spinning = $state(false);
  let result = $state<{ text: string; win: boolean } | null>(null);
  const N = WHEEL_LAYOUT.length;
  const COLORS: Record<string, string> = { '1': '#fdcb6e', '2': '#74b9ff', '5': '#a29bfe', '10': '#55efc4', '20': '#fab1a0', joker: '#2d3436', star: '#d63031' };
  const seg = (id: string) => WHEEL_SEGMENTS.find((s) => s.id === id)!;

  async function spin() {
    if (spinning || !economy.bet('wheel', bet)) return;
    spinning = true;
    result = null;
    const i = spinWheel();
    // pointer at the top: rotate so slot i ends under it, plus a few full turns
    const slot = 360 / N;
    const target = 360 * 5 + (360 - (i * slot + slot / 2));
    angle = angle - (angle % 360) + target;
    await new Promise((r) => setTimeout(r, 2600));
    const id = WHEEL_LAYOUT[i];
    const s = seg(id);
    const won = id === pick ? bet * (s.pays + 1) : 0;
    economy.payout('wheel', won);
    result = won ? { text: `${s.label} · pays ${s.pays}:1 · +${(won - bet).toLocaleString()}`, win: true } : { text: `${s.label} · no win`, win: false };
    if (won) playSound('pop');
    spinning = false;
  }
  function arc(i: number): string {
    const a0 = ((i * 360) / N - 90) * (Math.PI / 180);
    const a1 = (((i + 1) * 360) / N - 90) * (Math.PI / 180);
    const r = 140;
    return `M150,150 L${150 + r * Math.cos(a0)},${150 + r * Math.sin(a0)} A${r},${r} 0 0 1 ${150 + r * Math.cos(a1)},${150 + r * Math.sin(a1)} Z`;
  }
  function labelPos(i: number): { x: number; y: number; rot: number } {
    const a = (((i + 0.5) * 360) / N - 90) * (Math.PI / 180);
    return { x: 150 + 118 * Math.cos(a), y: 150 + 118 * Math.sin(a), rot: ((i + 0.5) * 360) / N };
  }
  function pegPos(i: number): { x: number; y: number } {
    const a = ((i * 360) / N - 90) * (Math.PI / 180);
    return { x: 150 + 140 * Math.cos(a), y: 150 + 140 * Math.sin(a) };
  }
  const landed = $derived(!spinning && result !== null);
</script>

<div class="cz-game">
  <div class="cz-table wheelwrap" class:won={result?.win}>
    <div class="pointer" class:land={landed} aria-hidden="true">▼</div>
    <div class="disc" class:spinning>
      <svg
        viewBox="0 0 300 300"
        role="img"
        aria-label="Big Six wheel"
        style="transform: rotate({angle}deg); transition: transform {spinning ? '2.5s' : '0s'} cubic-bezier(0.15, 0.85, 0.2, 1)"
      >
        <defs>
          <linearGradient id="wh-rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ffe08a" />
            <stop offset="45%" stop-color="#f5c542" />
            <stop offset="100%" stop-color="#b07a10" />
          </linearGradient>
          <radialGradient id="wh-hub" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="55%" stop-color="#ffe08a" />
            <stop offset="100%" stop-color="#c78a12" />
          </radialGradient>
          <radialGradient id="wh-shade" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stop-color="rgba(0,0,0,0)" />
            <stop offset="100%" stop-color="rgba(0,0,0,0.35)" />
          </radialGradient>
        </defs>
        {#each WHEEL_LAYOUT as id, i (i)}
          {@const p = labelPos(i)}
          <path d={arc(i)} fill={COLORS[id]} stroke="#fff" stroke-width="0.6" />
          <text
            x={p.x}
            y={p.y}
            font-size="9"
            font-weight="800"
            text-anchor="middle"
            dominant-baseline="middle"
            fill={id === 'joker' || id === 'star' ? '#fff' : '#222'}
            transform="rotate({p.rot} {p.x} {p.y})">{seg(id).label}</text
          >
        {/each}
        <circle cx="150" cy="150" r="140" fill="url(#wh-shade)" />
        <circle class="rim" cx="150" cy="150" r="143" />
        {#each WHEEL_LAYOUT as _, i (i)}
          {@const q = pegPos(i)}
          <circle class="peg" cx={q.x} cy={q.y} r="1.8" />
        {/each}
        <circle class="hub" cx="150" cy="150" r="30" />
        <circle cx="150" cy="150" r="8" fill="#4a2a12" opacity="0.6" />
      </svg>
    </div>
    <div class="cz-result" aria-live="polite" class:win={result?.win} class:lose={result && !result.win}>{result?.text ?? ''}</div>
  </div>
  <div class="cz-actions">
    <div class="cz-seg" role="radiogroup" aria-label="Bet on">
      {#each WHEEL_SEGMENTS as s (s.id)}<button role="radio" aria-checked={pick === s.id} class:on={pick === s.id} onclick={() => (pick = s.id)}
          >{s.label} <small>{s.pays}:1</small></button
        >{/each}
    </div>
    <BetControl bind:value={bet} disabled={spinning} />
    <button class="btn primary" onclick={spin} disabled={spinning || bet > economy.wallet.chips}>Spin</button>
  </div>
  <p class="cz-edge">54 slots: 1 (×24) pays 1:1, 2 (×15) 2:1, 5 (×7) 5:1, 10 (×4) 10:1, 20 (×2) 20:1, 🃏 and ⭐ (×1 each) 40:1. House edge 11–24% depending on the bet.</p>
</div>

<style>
  .wheelwrap {
    position: relative;
    justify-items: center;
  }
  .disc {
    position: relative;
    width: min(300px, 80vw);
    border-radius: 50%;
    filter: drop-shadow(0 14px 22px rgba(0, 0, 0, 0.55));
    transition: filter var(--dur-slow) var(--ease);
  }
  .won .disc {
    filter: drop-shadow(0 0 28px rgba(255, 224, 102, 0.85)) drop-shadow(0 14px 22px rgba(0, 0, 0, 0.55));
  }
  .disc svg {
    width: 100%;
    display: block;
    overflow: visible;
  }
  .disc.spinning svg {
    filter: saturate(1.15);
  }
  .rim {
    fill: none;
    stroke: url(#wh-rim);
    stroke-width: 7;
  }
  .peg {
    fill: #fff8dc;
    filter: drop-shadow(0 0 1.5px rgba(0, 0, 0, 0.6));
  }
  .hub {
    fill: url(#wh-hub);
    stroke: #b07a10;
    stroke-width: 2;
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5));
  }
  /* a gold pointer that glows; it bounces when the wheel stops under it */
  .pointer {
    font-size: 30px;
    line-height: 1;
    margin-bottom: -22px;
    z-index: 1;
    background: var(--grad-gold);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 0 8px rgba(255, 224, 102, 0.9)) drop-shadow(0 3px 3px rgba(0, 0, 0, 0.6));
  }
  .pointer.land {
    animation: wiggle 500ms var(--spring);
  }
  .wheelwrap .cz-result {
    text-align: center;
  }
</style>
