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
</script>

<div class="cz-game">
  <div class="cz-table wheelwrap">
    <div class="pointer" aria-hidden="true">▼</div>
    <svg viewBox="0 0 300 300" role="img" aria-label="Big Six wheel" style="transform: rotate({angle}deg); transition: transform {spinning ? '2.5s' : '0s'} cubic-bezier(0.15, 0.85, 0.2, 1)">
      {#each WHEEL_LAYOUT as id, i (i)}
        {@const p = labelPos(i)}
        <path d={arc(i)} fill={COLORS[id]} stroke="#fff" stroke-width="0.6" />
        <text x={p.x} y={p.y} font-size="9" font-weight="800" text-anchor="middle" dominant-baseline="middle" fill={id === 'joker' || id === 'star' ? '#fff' : '#222'} transform="rotate({p.rot} {p.x} {p.y})">{seg(id).label}</text>
      {/each}
      <circle cx="150" cy="150" r="30" fill="#fff" />
    </svg>
    <div class="cz-result" aria-live="polite" class:win={result?.win} class:lose={result && !result.win}>{result?.text ?? ''}</div>
  </div>
  <div class="cz-actions">
    <div class="cz-seg" role="radiogroup" aria-label="Bet on">
      {#each WHEEL_SEGMENTS as s (s.id)}<button role="radio" aria-checked={pick === s.id} class:on={pick === s.id} onclick={() => (pick = s.id)}>{s.label} <small>{s.pays}:1</small></button>{/each}
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
  .wheelwrap svg {
    width: min(300px, 80vw);
  }
  .pointer {
    font-size: 26px;
    color: #ffe066;
    margin-bottom: -18px;
    z-index: 1;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  }
</style>
