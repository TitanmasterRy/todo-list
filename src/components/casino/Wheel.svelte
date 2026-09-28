<script lang="ts">
  import { onDestroy } from 'svelte';
  import { economy } from '../../lib/economy.svelte';
  import { spinWheel, WHEEL_LAYOUT, WHEEL_SEGMENTS } from '../../lib/casino/quick';
  import BetControl from './BetControl.svelte';
  import WinFx from './WinFx.svelte';
  import { chipsIn, chipsOut, reduced, wait } from './fx';
  import { sfx } from './sfx';

  let bet = $state(10);
  let pick = $state('1');
  let angle = $state(0);
  let flap = $state(0); // flapper deflection, degrees
  let spinning = $state(false);
  let landed = $state<number | null>(null);
  let result = $state<{ text: string; win: boolean } | null>(null);
  let fx = $state<WinFx>();
  let spotEl = $state<HTMLElement>();
  let pointerEl = $state<HTMLElement>();
  let raf = 0;
  onDestroy(() => cancelAnimationFrame(raf));
  const N = WHEEL_LAYOUT.length;
  const SLOT = 360 / N;
  const COLORS: Record<string, [string, string]> = {
    '1': ['#ffe07a', '#e8b322'],
    '2': ['#7cc0ff', '#2f7de1'],
    '5': ['#c3a4ff', '#7b4fe0'],
    '10': ['#7ff0c4', '#1fb57e'],
    '20': ['#ffb08a', '#f06a3a'],
    joker: ['#4a4a58', '#1c1c24'],
    star: ['#ff6b7f', '#c8102e'],
  };
  const seg = (id: string) => WHEEL_SEGMENTS.find((s) => s.id === id)!;

  async function spin() {
    if (spinning || !economy.bet('wheel', bet)) return;
    chipsIn(spotEl, bet);
    spinning = true;
    result = null;
    landed = null;
    fx?.clear();
    const i = spinWheel();
    // pointer at the top: rotate so slot i ends under it, plus a few full turns
    const from = angle;
    const base = from - (from % 360);
    const target = base + 360 * 5 + (360 - (i * SLOT + SLOT / 2)) + (Math.random() - 0.5) * SLOT * 0.6;
    const ms = reduced() ? 0 : 5200;
    sfx('spin');
    if (ms) {
      const t0 = performance.now();
      let lastPeg = Math.floor(from / SLOT);
      const frame = (now: number) => {
        const t = Math.min(1, (now - t0) / ms);
        const e = 1 - (1 - t) ** 4;
        angle = from + (target - from) * e;
        // a peg passing the flapper kicks it and ticks
        const peg = Math.floor(angle / SLOT);
        if (peg !== lastPeg) {
          lastPeg = peg;
          flap = -Math.min(28, 10 + (1 - t) * 30);
          sfx('tick', Math.floor((1 - t) * 6));
        } else flap *= 0.8;
        if (t < 1) raf = requestAnimationFrame(frame);
        else flap = 0;
      };
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    }
    await wait(ms || 600);
    cancelAnimationFrame(raf);
    angle = target;
    flap = 0;
    landed = i;
    const id = WHEEL_LAYOUT[i];
    const s = seg(id);
    const won = id === pick ? bet * (s.pays + 1) : 0;
    economy.payout('wheel', won);
    result = won ? { text: `${s.label} · pays ${s.pays}:1 · +${(won - bet).toLocaleString()}`, win: true } : { text: `${s.label} · no win`, win: false };
    fx?.show(won, bet);
    if (won) setTimeout(() => chipsOut(pointerEl, won), 300);
    spinning = false;
  }
  const pt = (r: number, deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return { x: 150 + r * Math.cos(a), y: 150 + r * Math.sin(a) };
  };
  function arc(i: number): string {
    const a = pt(138, i * SLOT);
    const b = pt(138, (i + 1) * SLOT);
    const c = pt(34, (i + 1) * SLOT);
    const d = pt(34, i * SLOT);
    return `M${d.x},${d.y} L${a.x},${a.y} A138,138 0 0 1 ${b.x},${b.y} L${c.x},${c.y} A34,34 0 0 0 ${d.x},${d.y} Z`;
  }
  const winId = $derived(landed === null ? null : WHEEL_LAYOUT[landed]);
</script>

<div class="cz-game">
  <div class="cz-table purple wheelwrap">
    <div class="stage">
      <div class="flapper" style="transform: translateX(-50%) rotate({flap}deg)" bind:this={pointerEl} aria-hidden="true">
        <svg viewBox="0 0 40 60"><path d="M20 58 L6 14 Q4 4 20 2 Q36 4 34 14 Z" fill="url(#bs-flap)" stroke="#6b4200" stroke-width="2" /><circle cx="20" cy="12" r="5" fill="#fff6d0" stroke="#8a5c0c" /><defs
            ><linearGradient id="bs-flap" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8861a" /><stop offset=".5" stop-color="#fff0a8" /><stop offset="1" stop-color="#b8861a" /></linearGradient
            ></defs
          ></svg
        >
      </div>
      <svg viewBox="0 0 300 300" class="wheel" role="img" aria-label="Big Six wheel{winId ? `, landed on ${seg(winId).label}` : ''}">
        <defs>
          <radialGradient id="bs-rim" cx="50%" cy="45%" r="55%">
            <stop offset=".85" stop-color="#6b3a14" />
            <stop offset="1" stop-color="#2a1405" />
          </radialGradient>
          <radialGradient id="bs-hub" cx="40%" cy="35%" r="70%">
            <stop offset="0" stop-color="#fff5c4" />
            <stop offset=".55" stop-color="#e7b84a" />
            <stop offset="1" stop-color="#8a5c0c" />
          </radialGradient>
          {#each Object.entries(COLORS) as [id, [a, b]] (id)}
            <linearGradient id="bs-{id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color={a} /><stop offset="1" stop-color={b} /></linearGradient>
          {/each}
        </defs>
        <circle cx="150" cy="150" r="149" fill="url(#bs-rim)" />
        <circle cx="150" cy="150" r="146" fill="none" stroke="#e7b84a" stroke-width="2" />
        <g style="transform: rotate({angle}deg); transform-origin: 150px 150px">
          {#each WHEEL_LAYOUT as id, i (i)}
            {@const p = pt(112, (i + 0.5) * SLOT)}
            {@const peg = pt(142, i * SLOT)}
            <path d={arc(i)} fill="url(#bs-{id})" stroke="#fff8e0" stroke-width="0.8" class:lit={landed === i} />
            <text
              x={p.x}
              y={p.y}
              font-size={id === 'joker' || id === 'star' ? 13 : 12}
              font-weight="900"
              text-anchor="middle"
              dominant-baseline="central"
              fill={id === 'joker' || id === 'star' ? '#fff' : '#2a1a00'}
              transform="rotate({(i + 0.5) * SLOT + 90} {p.x} {p.y})">{seg(id).label}</text
            >
            <circle cx={peg.x} cy={peg.y} r="2.6" fill="url(#bs-hub)" stroke="#6b4200" stroke-width=".5" />
          {/each}
          <circle cx="150" cy="150" r="34" fill="#2a1405" />
          {#each [0, 1, 2, 3, 4, 5, 6, 7] as k (k)}
            {@const q = pt(24, k * 45)}
            <circle cx={q.x} cy={q.y} r="3" fill="#ffe39a" />
          {/each}
        </g>
        <circle cx="150" cy="150" r="20" fill="url(#bs-hub)" stroke="#6b4200" />
        <path d="M150 138 l3.5 7.5 8 .9 -6 5.4 1.7 7.9 -7.2 -4.1 -7.2 4.1 1.7 -7.9 -6 -5.4 8 -.9 Z" fill="#b8101f" />
      </svg>
    </div>
    <div class="cz-result center" aria-live="polite" class:win={result?.win} class:lose={result && !result.win}>{result?.text ?? (spinning ? 'Round and round…' : 'Pick a symbol, then spin')}</div>
    <div class="betspot" bind:this={spotEl} aria-hidden="true">
      <span class="tag" style="--c1:{COLORS[pick][0]};--c2:{COLORS[pick][1]};--ink:{pick === 'joker' || pick === 'star' ? '#fff' : '#1b1300'}">{seg(pick).label}</span>
      <span>pays {seg(pick).pays}:1</span>
    </div>
    <WinFx bind:this={fx} />
  </div>
  <div class="cz-deck">
    <div class="picks" role="radiogroup" aria-label="Bet on">
      {#each WHEEL_SEGMENTS as s (s.id)}<button
          role="radio"
          aria-checked={pick === s.id}
          class:on={pick === s.id}
          style="--c1:{COLORS[s.id][0]};--c2:{COLORS[s.id][1]};--ink:{s.id === 'joker' || s.id === 'star' ? '#fff' : '#1b1300'}"
          disabled={spinning}
          onclick={() => {
            pick = s.id;
            sfx('chip');
          }}><b>{s.label}</b> <small>{s.pays}:1</small></button
        >{/each}
    </div>
    <BetControl bind:value={bet} disabled={spinning} />
    <div class="grow"></div>
    <button class="btn cz-go" onclick={spin} disabled={spinning || bet > economy.wallet.chips}>Spin</button>
  </div>
  <p class="cz-edge">54 slots: 1 (×24) pays 1:1, 2 (×15) 2:1, 5 (×7) 5:1, 10 (×4) 10:1, 20 (×2) 20:1, 🃏 and ⭐ (×1 each) 40:1. House edge 11–24% depending on the bet.</p>
</div>

<style>
  .wheelwrap {
    justify-items: center;
  }
  .stage {
    position: relative;
    width: min(340px, 82vw);
    padding-top: 18px;
  }
  .wheel {
    width: 100%;
    display: block;
    filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.5));
  }
  .wheel g {
    will-change: transform;
  }
  .wheel path.lit {
    stroke: #fff;
    stroke-width: 3;
    filter: brightness(1.25) drop-shadow(0 0 6px #fff3b0);
  }
  .flapper {
    position: absolute;
    left: 50%;
    top: 0;
    width: 30px;
    height: 46px;
    z-index: 2;
    transform-origin: 50% 12px;
    filter: drop-shadow(0 3px 3px rgba(0, 0, 0, 0.5));
  }
  .flapper svg {
    width: 100%;
    height: 100%;
    display: block;
  }
  .betspot {
    position: absolute;
    left: 14px;
    top: 14px;
    display: grid;
    justify-items: center;
    gap: 4px;
    font-size: 11px;
    color: #ffe9b0;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .tag {
    display: grid;
    place-items: center;
    min-width: 44px;
    height: 44px;
    border-radius: 50%;
    font-weight: 900;
    font-size: 18px;
    color: var(--ink);
    background: linear-gradient(135deg, var(--c1), var(--c2));
    box-shadow:
      0 0 0 3px #fff8e0,
      0 0 0 5px #e7b84a,
      0 4px 10px rgba(0, 0, 0, 0.4);
  }
  .picks {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .picks button {
    display: grid;
    justify-items: center;
    min-width: 50px;
    padding: 5px 8px;
    border-radius: 12px;
    color: var(--ink);
    background: linear-gradient(135deg, var(--c1), var(--c2));
    border: 2px solid transparent;
    box-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
    transition: transform 150ms var(--spring);
    line-height: 1.1;
  }
  .picks button b {
    font-size: 15px;
  }
  .picks button small {
    font-size: 10px;
    font-weight: 700;
    opacity: 0.85;
  }
  .picks button:hover:not(:disabled) {
    transform: translateY(-2px);
  }
  .picks button.on {
    border-color: var(--text);
    transform: translateY(-3px);
    box-shadow:
      0 0 0 2px var(--cz-gold),
      0 6px 14px rgba(0, 0, 0, 0.35);
  }
  .picks button:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .grow {
    flex: 1;
  }
  @media (max-width: 520px) {
    .betspot {
      transform: scale(0.8);
      transform-origin: left top;
      left: 6px;
      top: 6px;
    }
  }
</style>
