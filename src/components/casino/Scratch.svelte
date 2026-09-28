<script lang="ts">
  import { tick } from 'svelte';
  import { economy } from '../../lib/economy.svelte';
  import { artUrl } from '../../lib/art.svelte';
  import { makeScratchCard, scratchPrizeFor, SCRATCH_SYMBOLS } from '../../lib/casino/quick';
  import WinFx from './WinFx.svelte';
  import { reduced } from './fx';
  import { sfx } from './sfx';

  const PRICES = [10, 50, 100, 500];
  let price = $state(10);
  let card = $state<{ cells: string[]; mult: number } | null>(null);
  let shown = $state<boolean[]>([]);
  let paid = $state(false);
  let result = $state<{ text: string; win: boolean } | null>(null);
  let fx = $state<WinFx>();
  let canvas = $state<HTMLCanvasElement>();
  let grid = $state<HTMLElement>();
  let sparkles = $state<{ id: number; x: number; y: number }[]>([]);
  let sid = 0;
  let dpr = 1;

  async function buy() {
    if (!economy.bet('scratch', price)) return;
    card = makeScratchCard();
    shown = Array(9).fill(false);
    paid = false;
    result = null;
    fx?.clear();
    sfx('deal');
    await tick();
    paintFoil();
  }

  function paintFoil() {
    const c = canvas?.getContext('2d');
    if (!c || !canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalCompositeOperation = 'source-over';
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#c9ced6');
    g.addColorStop(0.35, '#f4f6f9');
    g.addColorStop(0.55, '#aeb5c0');
    g.addColorStop(0.8, '#e9ecf1');
    g.addColorStop(1, '#9aa2ae');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // speckles
    for (let i = 0; i < (w * h) / 40; i++) {
      c.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.45)' : 'rgba(80,90,105,.18)';
      c.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2);
    }
    // an embossed coin on every square
    for (const r of cellRects()) {
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const rad = Math.min(r.w, r.h) * 0.26;
      c.beginPath();
      c.arc(cx, cy, rad, 0, Math.PI * 2);
      c.fillStyle = 'rgba(255,255,255,.35)';
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = 'rgba(90,100,115,.35)';
      c.stroke();
      c.fillStyle = 'rgba(90,100,115,.55)';
      c.font = `900 ${Math.round(rad * 1.1)}px system-ui, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('?', cx, cy + 1);
    }
    const url = artUrl('casino/scratch-foil.webp');
    if (url) {
      const img = new Image();
      img.onload = () => {
        const pat = c.createPattern(img, 'repeat');
        if (!pat || !canvas) return;
        c.globalCompositeOperation = 'source-atop';
        c.fillStyle = pat;
        c.fillRect(0, 0, w, h);
        c.globalCompositeOperation = 'source-over';
      };
      img.src = url;
    }
  }

  function cellRects(): { x: number; y: number; w: number; h: number }[] {
    if (!grid || !canvas) return [];
    const base = canvas.getBoundingClientRect();
    return [...grid.querySelectorAll<HTMLElement>('.cell')].map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
    });
  }

  function reveal(i: number) {
    if (!card || shown[i]) return;
    const r = cellRects()[i];
    const c = canvas?.getContext('2d');
    if (r && c) {
      c.save();
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
      c.restore();
      if (!reduced()) {
        const k = ++sid;
        sparkles = [...sparkles, { id: k, x: r.x + r.w / 2, y: r.y + r.h / 2 }];
        setTimeout(() => (sparkles = sparkles.filter((s) => s.id !== k)), 800);
      }
    }
    shown = shown.map((s, j) => s || j === i);
    sfx('gem', shown.filter(Boolean).length);
    if (shown.every(Boolean)) settle();
  }
  function scratch(i: number) {
    reveal(i);
  }
  function revealAll() {
    shown.forEach((s, i) => !s && reveal(i));
    shown = Array(9).fill(true);
    settle();
  }
  function settle() {
    if (!card || paid) return;
    paid = true;
    const won = price * card.mult;
    economy.payout('scratch', won);
    result = won ? { text: `Match three! ×${card.mult} · ${won.toLocaleString()} chips`, win: true } : { text: 'No match this time', win: false };
    fx?.show(won, price);
  }

  // ---------- scratching with a finger or the mouse ----------
  let drawing = false;
  let last: { x: number; y: number } | null = null;
  let start: { x: number; y: number } | null = null;
  let moved = 0;
  let checkAt = 0;
  function local(e: PointerEvent) {
    const r = canvas!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function down(e: PointerEvent) {
    if (!card || paid || !canvas) return;
    drawing = true;
    canvas.setPointerCapture?.(e.pointerId);
    last = start = local(e);
    moved = 0;
    erase(last, last);
  }
  function move(e: PointerEvent) {
    if (!drawing || !last) return;
    const p = local(e);
    moved += Math.hypot(p.x - last.x, p.y - last.y);
    erase(last, p);
    last = p;
    sfx('scratch');
    const now = performance.now();
    if (now - checkAt > 140) {
      checkAt = now;
      check();
    }
  }
  function up(e: PointerEvent) {
    if (!drawing) return;
    drawing = false;
    // a tap (no real scratching) reveals the square under it, like before
    if (moved < 8 && start) {
      const p = local(e);
      const i = cellRects().findIndex((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
      if (i >= 0) reveal(i);
    }
    check();
    last = start = null;
  }
  function erase(a: { x: number; y: number }, b: { x: number; y: number }) {
    const c = canvas?.getContext('2d');
    if (!c) return;
    c.save();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalCompositeOperation = 'destination-out';
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.lineWidth = 26;
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x + 0.01, b.y);
    c.stroke();
    c.restore();
  }
  /** Squares scratched about halfway count as revealed. */
  function check() {
    const c = canvas?.getContext('2d', { willReadFrequently: true });
    if (!c || !canvas || !card || paid) return;
    const rects = cellRects();
    rects.forEach((r, i) => {
      if (shown[i]) return;
      const data = c.getImageData(Math.round(r.x * dpr), Math.round(r.y * dpr), Math.max(1, Math.round(r.w * dpr)), Math.max(1, Math.round(r.h * dpr))).data;
      let clear = 0;
      let total = 0;
      const stride = 4 * 7;
      for (let k = 3; k < data.length; k += stride) {
        total++;
        if (data[k] < 40) clear++;
      }
      if (total && clear / total > 0.5) reveal(i);
    });
  }
  const winSym = $derived(card && card.mult > 0 && paid ? card.cells.find((s) => card!.cells.filter((x) => x === s).length >= 3) : undefined);
</script>

<div class="cz-game">
  <div class="cz-table red scratch">
    {#if card}
      <div class="ticket">
        <div class="head">
          <span class="brand">Lucky 3</span>
          <span class="tag">Match three · win up to ×100</span>
        </div>
        <div class="wrap">
          <div class="grid" bind:this={grid}>
            {#each card.cells as c, i (i)}
              <button class="cell" class:scratched={shown[i]} class:win={winSym === c} onclick={() => scratch(i)} aria-label={shown[i] ? c : 'Scratch'}>
                <span class="sym" aria-hidden="true">{c}</span>
              </button>
            {/each}
          </div>
          <canvas
            bind:this={canvas}
            class:done={paid}
            aria-hidden="true"
            onpointerdown={down}
            onpointermove={move}
            onpointerup={up}
            onpointercancel={() => (drawing = false)}
          ></canvas>
          {#each sparkles as s (s.id)}
            <span class="sparkle" style="left:{s.x}px;top:{s.y}px" aria-hidden="true"></span>
          {/each}
        </div>
        <div class="foot">Price {price} · Scratch the silver or tap a square</div>
      </div>
    {:else}
      <div class="empty">
        <span class="ghost-ticket" aria-hidden="true"><span>Lucky 3</span></span>
        <p>Buy a card, then scratch the silver off each square (or tap it). Three of a symbol wins its prize.</p>
      </div>
    {/if}
    <div class="cz-result center" aria-live="polite" class:win={result?.win} class:lose={result && !result.win}>{result?.text ?? ''}</div>
    <WinFx bind:this={fx} />
  </div>
  <div class="cz-deck">
    <div class="cz-seg" role="group" aria-label="Card price">
      {#each PRICES as p (p)}<button class:on={price === p} aria-pressed={price === p} onclick={() => (price = p)} disabled={!!card && !paid}>{p}</button>{/each}
    </div>
    <div class="grow"></div>
    {#if card && !paid}
      <button class="btn cz-alt" onclick={revealAll}>Reveal all</button>
    {:else}
      <button class="btn cz-go" onclick={buy} disabled={price > economy.wallet.chips}>Buy card ({price})</button>
    {/if}
  </div>
  <div class="cz-paytable">
    {#each SCRATCH_SYMBOLS.slice(0, 6) as s (s)}<span>{s}{s}{s}</span><span>×{scratchPrizeFor(s)}</span>{/each}
  </div>
  <p class="cz-edge">About 90% return.</p>
</div>

<style>
  .scratch {
    justify-items: center;
  }
  .ticket {
    position: relative;
    width: min(340px, 100%);
    padding: 12px 14px 10px;
    border-radius: 14px;
    color: #3a1a00;
    background:
      radial-gradient(circle at 0 50%, transparent 7px, #fff6dc 7.5px) left / 51% 100% no-repeat,
      radial-gradient(circle at 100% 50%, transparent 7px, #fff6dc 7.5px) right / 51% 100% no-repeat;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.45);
    animation: deal 460ms cubic-bezier(0.25, 1.2, 0.4, 1);
    transform: rotate(-1deg);
  }
  .ticket::before {
    content: '';
    position: absolute;
    inset: 5px;
    border-radius: 10px;
    border: 2px solid #e7b84a;
    pointer-events: none;
  }
  @keyframes deal {
    from {
      transform: translateY(-40px) rotate(-10deg) scale(0.9);
      opacity: 0;
    }
  }
  .head {
    display: grid;
    justify-items: center;
    margin-bottom: 8px;
  }
  .brand {
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 900;
    font-size: 24px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #c3122e;
    text-shadow: 0 2px 0 #ffd76a;
  }
  .tag {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: #7a4a10;
  }
  .wrap {
    position: relative;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .cell {
    aspect-ratio: 1;
    border-radius: 10px;
    padding: 0;
    display: grid;
    place-items: center;
    background: radial-gradient(circle at 50% 40%, #fffdf5, #f3e6c4);
    box-shadow: inset 0 0 0 1px rgba(122, 74, 16, 0.25);
  }
  .cell:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
    position: relative;
    z-index: 3;
  }
  .sym {
    font-size: clamp(30px, 9vw, 42px);
    filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.25));
  }
  .cell.scratched .sym {
    animation: popin 420ms cubic-bezier(0.3, 1.6, 0.5, 1);
  }
  @keyframes popin {
    from {
      transform: scale(0.5);
    }
  }
  .cell.win {
    background: radial-gradient(circle at 50% 40%, #fffbe0, #ffd24a);
    box-shadow:
      0 0 0 2px #e39a0f,
      0 0 16px 3px rgba(255, 200, 40, 0.9);
    animation: winpulse 0.8s ease-in-out infinite alternate;
  }
  @keyframes winpulse {
    to {
      transform: scale(1.05);
    }
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border-radius: 10px;
    touch-action: none;
    cursor: crosshair;
    transition: opacity 400ms;
  }
  canvas.done {
    opacity: 0;
    pointer-events: none;
  }
  .sparkle {
    position: absolute;
    width: 90px;
    height: 90px;
    margin: -45px 0 0 -45px;
    pointer-events: none;
    background:
      radial-gradient(circle at 50% 50%, #fff 0 3px, transparent 4px),
      radial-gradient(circle at 20% 30%, #fff6c8 0 2px, transparent 3px),
      radial-gradient(circle at 78% 24%, #fff 0 2px, transparent 3px),
      radial-gradient(circle at 70% 76%, #fff6c8 0 2.5px, transparent 3.5px),
      radial-gradient(circle at 26% 74%, #fff 0 2px, transparent 3px),
      conic-gradient(from 0deg, transparent 0 40deg, rgba(255, 240, 180, 0.7) 45deg, transparent 50deg 130deg, rgba(255, 240, 180, 0.7) 135deg, transparent 140deg 220deg, rgba(255, 240, 180, 0.7) 225deg, transparent 230deg 310deg, rgba(255, 240, 180, 0.7) 315deg, transparent 320deg);
    mask-image: radial-gradient(circle, #000 30%, transparent 70%);
    animation: sparkle 800ms ease-out forwards;
  }
  @keyframes sparkle {
    from {
      transform: scale(0.3) rotate(0deg);
      opacity: 1;
    }
    to {
      transform: scale(1.3) rotate(60deg);
      opacity: 0;
    }
  }
  .foot {
    margin-top: 8px;
    text-align: center;
    font-size: 11px;
    color: #7a4a10;
  }
  .empty {
    display: grid;
    justify-items: center;
    gap: 10px;
    text-align: center;
    max-width: 360px;
  }
  .empty p {
    margin: 0;
  }
  .ghost-ticket {
    display: grid;
    place-items: center;
    width: 200px;
    height: 120px;
    border-radius: 12px;
    transform: rotate(-4deg);
    background:
      repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.25) 0 2px, transparent 2px 7px),
      linear-gradient(135deg, #c9ced6, #f4f6f9 40%, #aeb5c0 60%, #e9ecf1);
    box-shadow:
      0 0 0 3px #e7b84a,
      0 10px 20px rgba(0, 0, 0, 0.4);
    animation: bob 3s ease-in-out infinite;
  }
  .ghost-ticket span {
    font-family: Georgia, serif;
    font-weight: 900;
    font-size: 26px;
    color: #c3122e;
    text-shadow: 0 2px 0 #fff;
  }
  @keyframes bob {
    50% {
      transform: rotate(2deg) translateY(-6px);
    }
  }
  .grow {
    flex: 1;
  }
</style>
