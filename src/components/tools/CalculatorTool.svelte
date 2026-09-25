<script lang="ts">
  import { evaluate, formatNumber, MathError, FUNCTIONS } from '../../lib/mathparser';

  let expr = $state('');
  let angle = $state<'rad' | 'deg'>('deg');
  let history = $state<{ expr: string; result: string }[]>([]);
  let ans = $state(0);
  let error = $state('');
  let input: HTMLInputElement | undefined = $state();
  const preview = $derived.by(() => {
    if (!expr.trim()) return '';
    try {
      return formatNumber(evaluate(expr, { angle, variables: { ans } }));
    } catch {
      return '';
    }
  });

  function run(e?: Event) {
    e?.preventDefault();
    if (!expr.trim()) return;
    try {
      const v = evaluate(expr, { angle, variables: { ans } });
      const result = formatNumber(v);
      history = [{ expr, result }, ...history].slice(0, 30);
      ans = v;
      expr = '';
      error = '';
    } catch (err) {
      error = err instanceof MathError ? err.message : String(err);
    }
  }
  function insert(s: string) {
    expr += s;
    input?.focus();
  }
  const keys = ['7', '8', '9', '/', '(', ')', '4', '5', '6', '*', '^', '√', '1', '2', '3', '-', 'π', 'e', '0', '.', 'ans', '+', '%', '!'];
  function key(k: string) {
    if (k === '√') insert('sqrt(');
    else if (k === 'π') insert('pi');
    else insert(k);
  }
</script>

<section class="card calc">
  <div class="head">
    <h2>Calculator</h2>
    <div class="modes" role="radiogroup" aria-label="Angle unit">
      <button role="radio" aria-checked={angle === 'deg'} class:on={angle === 'deg'} onclick={() => (angle = 'deg')}>deg</button>
      <button role="radio" aria-checked={angle === 'rad'} class:on={angle === 'rad'} onclick={() => (angle = 'rad')}>rad</button>
    </div>
  </div>
  <form onsubmit={run}>
    <input
      class="input expr"
      bind:this={input}
      bind:value={expr}
      placeholder="2^10 / 4, sin(30), sqrt(2)x, 5!, 15% * 80"
      aria-label="Expression"
      autocomplete="off"
      spellcheck="false"
      data-calc
    />
    <div class="preview" aria-live="polite">{error ? `⚠ ${error}` : preview ? `= ${preview}` : ' '}</div>
  </form>
  <div class="pad">
    {#each keys as k}<button class="k" class:op={['/', '*', '-', '+', '^', '%', '!'].includes(k)} onclick={() => key(k)}>{k}</button>{/each}
    <button class="k fn" onclick={() => insert('sin(')}>sin</button>
    <button class="k fn" onclick={() => insert('cos(')}>cos</button>
    <button class="k fn" onclick={() => insert('tan(')}>tan</button>
    <button class="k fn" onclick={() => insert('ln(')}>ln</button>
    <button class="k fn" onclick={() => insert('log(')}>log</button>
    <button class="k fn" onclick={() => insert('abs(')}>abs</button>
    <button
      class="k fn"
      onclick={() => {
        expr = '';
        error = '';
        input?.focus();
      }}>C</button
    >
    <button class="k go" onclick={run}>=</button>
  </div>
  {#if history.length}
    <ul class="hist">
      {#each history as h, i (i)}
        <li><button onclick={() => (expr = h.result)}><span class="e">{h.expr}</span><span class="r">= {h.result}</span></button></li>
      {/each}
    </ul>
  {/if}
  <details class="help">
    <summary>Functions and syntax</summary>
    <p>
      {FUNCTIONS.join(', ')}. Constants: pi, e, tau. <code>ans</code> is the last result. Implicit multiplication works (<code>2pi</code>, <code>3(4+1)</code>). <code>x!</code>
      factorial, <code>7 % 3</code> modulo, <code>50%</code> percent, <code>^</code> power.
    </p>
  </details>
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
  .expr {
    font-family: var(--mono);
    font-size: 18px;
    padding: 12px;
  }
  .preview {
    min-height: 1.6em;
    text-align: right;
    font-family: var(--mono);
    font-size: 20px;
    font-weight: 700;
    padding: 4px 2px;
  }
  .pad {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 6px;
    margin-top: 6px;
  }
  .k {
    padding: 12px 0;
    border-radius: 10px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    font-family: var(--mono);
    font-size: 15px;
    font-weight: 600;
  }
  .k:active {
    transform: scale(0.96);
  }
  .k.op {
    color: var(--accent-text);
  }
  .k.fn {
    font-size: 13px;
  }
  .k.go {
    background: var(--accent);
    color: var(--accent-contrast, #fff);
    border-color: transparent;
  }
  .hist {
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
    max-height: 200px;
    overflow-y: auto;
  }
  .hist button {
    width: 100%;
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 6px 8px;
    border-radius: 6px;
    font-family: var(--mono);
    font-size: 13px;
    color: var(--text-muted);
  }
  .hist button:hover {
    background: var(--bg-hover);
  }
  .hist .r {
    color: var(--text);
    font-weight: 600;
  }
  .help {
    margin-top: 10px;
    font-size: 12px;
    color: var(--text-muted);
  }
  .help code {
    font-family: var(--mono);
  }
  @media (max-width: 480px) {
    .pad {
      grid-template-columns: repeat(4, 1fr);
    }
  }
</style>
