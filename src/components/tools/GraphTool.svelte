<script lang="ts">
  import { onMount } from 'svelte';
  import { compile, formatNumber, MathError } from '../../lib/mathparser';

  const COLORS = ['#6c5ce7', '#ef4444', '#10b981', '#f59e0b', '#0ea5e9', '#ec4899'];
  let fns = $state<{ expr: string; on: boolean }[]>([
    { expr: 'x^2', on: true },
    { expr: 'sin(x)', on: true },
    { expr: '', on: true },
  ]);
  let angle = $state<'rad' | 'deg'>('rad');
  let xmin = $state(-10);
  let xmax = $state(10);
  let ymin = $state(-10);
  let ymax = $state(10);
  let canvas: HTMLCanvasElement | undefined = $state();
  let trace = $state<{ x: number; ys: (number | null)[] } | null>(null);
  const built = $derived.by(() => {
    const errs: string[] = [];
    const out = fns.map((f, i) => {
      if (!f.expr.trim() || !f.on) return null;
      try {
        return compile(f.expr, { angle });
      } catch (e) {
        errs[i] = e instanceof MathError ? e.message : String(e);
        return null;
      }
    });
    return { fns: out, errors: errs };
  });
  const compiled = $derived(built.fns);
  const errors = $derived(built.errors);

  function niceStep(range: number, px: number): number {
    const raw = range / (px / 70);
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  }

  function draw() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    if (!W) return;
    const H = Math.round(W * 0.66);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(canvas);
    const grid = css.getPropertyValue('--border').trim() || '#ccc';
    const axis = css.getPropertyValue('--text-muted').trim() || '#888';
    const text = css.getPropertyValue('--text-faint').trim() || '#999';
    ctx.clearRect(0, 0, W, H);
    const sx = (x: number) => ((x - xmin) / (xmax - xmin)) * W;
    const sy = (y: number) => H - ((y - ymin) / (ymax - ymin)) * H;
    ctx.lineWidth = 1;
    ctx.font = '10px system-ui';
    ctx.fillStyle = text;
    const xs = niceStep(xmax - xmin, W);
    for (let x = Math.ceil(xmin / xs) * xs; x <= xmax; x += xs) {
      ctx.strokeStyle = grid;
      ctx.beginPath();
      ctx.moveTo(sx(x), 0);
      ctx.lineTo(sx(x), H);
      ctx.stroke();
      if (Math.abs(x) > 1e-9) ctx.fillText(formatNumber(x, 6), sx(x) + 2, Math.min(H - 4, Math.max(10, sy(0) - 3)));
    }
    const ys = niceStep(ymax - ymin, H);
    for (let y = Math.ceil(ymin / ys) * ys; y <= ymax; y += ys) {
      ctx.strokeStyle = grid;
      ctx.beginPath();
      ctx.moveTo(0, sy(y));
      ctx.lineTo(W, sy(y));
      ctx.stroke();
      if (Math.abs(y) > 1e-9) ctx.fillText(formatNumber(y, 6), Math.min(W - 24, Math.max(2, sx(0) + 3)), sy(y) - 2);
    }
    ctx.strokeStyle = axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, sy(0));
    ctx.lineTo(W, sy(0));
    ctx.moveTo(sx(0), 0);
    ctx.lineTo(sx(0), H);
    ctx.stroke();
    compiled.forEach((f, i) => {
      if (!f) return;
      ctx.strokeStyle = COLORS[i % COLORS.length];
      ctx.lineWidth = 2;
      ctx.beginPath();
      let pen = false;
      const N = W * 2;
      let prevY: number | null = null;
      for (let px = 0; px <= N; px++) {
        const x = xmin + ((xmax - xmin) * px) / N;
        const y = f(x);
        if (!Number.isFinite(y)) {
          pen = false;
          prevY = null;
          continue;
        }
        const jump = prevY !== null && Math.abs(y - prevY) > (ymax - ymin) * 2;
        const X = px / 2;
        const Y = sy(y);
        if (!pen || jump) {
          ctx.moveTo(X, Y);
          pen = true;
        } else ctx.lineTo(X, Y);
        prevY = y;
      }
      ctx.stroke();
    });
    if (trace) {
      const X = sx(trace.x);
      ctx.strokeStyle = axis;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(X, 0);
      ctx.lineTo(X, H);
      ctx.stroke();
      ctx.setLineDash([]);
      trace.ys.forEach((y, i) => {
        if (y === null || !Number.isFinite(y)) return;
        ctx.fillStyle = COLORS[i % COLORS.length];
        ctx.beginPath();
        ctx.arc(X, sy(y), 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  $effect(() => {
    void compiled;
    void xmin;
    void xmax;
    void ymin;
    void ymax;
    void trace;
    draw();
  });
  onMount(() => {
    const ro = new ResizeObserver(() => draw());
    if (canvas) ro.observe(canvas);
    return () => ro.disconnect();
  });

  function onMove(e: PointerEvent) {
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const x = xmin + ((e.clientX - r.left) / r.width) * (xmax - xmin);
    trace = { x, ys: compiled.map((f) => (f ? f(x) : null)) };
  }
  function zoom(factor: number) {
    const cx = (xmin + xmax) / 2;
    const cy = (ymin + ymax) / 2;
    const hw = ((xmax - xmin) / 2) * factor;
    const hh = ((ymax - ymin) / 2) * factor;
    xmin = cx - hw;
    xmax = cx + hw;
    ymin = cy - hh;
    ymax = cy + hh;
  }
  function pan(dx: number, dy: number) {
    const w = (xmax - xmin) * dx;
    const h = (ymax - ymin) * dy;
    xmin += w;
    xmax += w;
    ymin += h;
    ymax += h;
  }
  function reset() {
    xmin = -10;
    xmax = 10;
    ymin = -10;
    ymax = 10;
  }
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15);
  }
  let drag: { x: number; y: number } | null = null;
  function down(e: PointerEvent) {
    drag = { x: e.clientX, y: e.clientY };
  }
  function up() {
    drag = null;
  }
  function dragMove(e: PointerEvent) {
    if (drag && canvas) {
      const r = canvas.getBoundingClientRect();
      pan(-(e.clientX - drag.x) / r.width, (e.clientY - drag.y) / r.height);
      drag = { x: e.clientX, y: e.clientY };
    } else onMove(e);
  }
</script>

<section class="card graph">
  <div class="head">
    <h2>Graphing</h2>
    <div class="modes" role="radiogroup" aria-label="Angle unit">
      <button role="radio" aria-checked={angle === 'rad'} class:on={angle === 'rad'} onclick={() => (angle = 'rad')}>rad</button>
      <button role="radio" aria-checked={angle === 'deg'} class:on={angle === 'deg'} onclick={() => (angle = 'deg')}>deg</button>
    </div>
  </div>
  <div class="fns">
    {#each fns as f, i (i)}
      <div class="fn" style="--c:{COLORS[i % COLORS.length]}">
        <input type="checkbox" bind:checked={f.on} aria-label="Show function {i + 1}" />
        <span class="y">y =</span>
        <input class="input" bind:value={f.expr} placeholder="e.g. 2x + 1, cos(x), abs(x)-3" spellcheck="false" />
        {#if errors[i]}<span class="err" title={errors[i]}>⚠</span>{/if}
        <button class="btn ghost sm icon" aria-label="Remove" onclick={() => (fns = fns.filter((_, j) => j !== i))}>×</button>
      </div>
    {/each}
    {#if fns.length < 6}<button class="btn ghost sm" onclick={() => (fns = [...fns, { expr: '', on: true }])}>+ Add function</button>{/if}
  </div>
  <canvas
    bind:this={canvas}
    class="plot"
    aria-label="Graph"
    onpointermove={dragMove}
    onpointerdown={down}
    onpointerup={up}
    onpointerleave={() => {
      up();
      trace = null;
    }}
    onwheel={onWheel}
  ></canvas>
  <div class="readout" aria-live="polite">
    {#if trace}
      x = {formatNumber(trace.x, 5)}
      {#each trace.ys as y, i}{#if y !== null}<span style="color:{COLORS[i % COLORS.length]}"> · y{i + 1} = {Number.isFinite(y) ? formatNumber(y, 6) : '—'}</span>{/if}{/each}
    {:else}
      Hover to trace · drag to pan · scroll to zoom
    {/if}
  </div>
  <div class="ctrls">
    <button class="btn sm" onclick={() => zoom(1 / 1.5)}>Zoom in</button>
    <button class="btn sm" onclick={() => zoom(1.5)}>Zoom out</button>
    <button class="btn sm" onclick={reset}>Reset</button>
    <label>x <input class="input num" type="number" bind:value={xmin} /> to <input class="input num" type="number" bind:value={xmax} /></label>
    <label>y <input class="input num" type="number" bind:value={ymin} /> to <input class="input num" type="number" bind:value={ymax} /></label>
  </div>
</section>

<style>
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  h2 {
    font-size: 16px;
    margin: 0;
  }
  .modes {
    display: flex;
    gap: 2px;
    background: var(--bg-elev-2);
    border-radius: 999px;
    padding: 3px;
  }
  .modes button {
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
  }
  .modes button.on {
    background: var(--bg-elev);
    color: var(--text);
  }
  .fns {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 8px;
  }
  .fn {
    display: flex;
    align-items: center;
    gap: 6px;
    border-left: 4px solid var(--c);
    padding-left: 8px;
  }
  .fn input[type='checkbox'] {
    accent-color: var(--c);
  }
  .y {
    font-family: var(--mono);
    color: var(--text-muted);
    font-size: 13px;
  }
  .fn .input {
    font-family: var(--mono);
    padding: 6px 10px;
  }
  .err {
    color: var(--warn);
  }
  .plot {
    width: 100%;
    display: block;
    border-radius: 10px;
    background: var(--bg-elev-2);
    touch-action: none;
    cursor: crosshair;
  }
  .readout {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--text-muted);
    min-height: 1.5em;
    margin: 6px 0;
  }
  .ctrls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    font-size: 12px;
    color: var(--text-muted);
  }
  .ctrls label {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .input.num {
    width: 64px;
    padding: 4px 6px;
    font-size: 12px;
  }
</style>
