<script lang="ts">
  import { CATEGORIES, convert, formatNumber } from '../../lib/units';

  let cat = $state('length');
  const category = $derived(CATEGORIES.find((c) => c.id === cat)!);
  let from = $state('mi');
  let to = $state('km');
  let value = $state(1);
  const result = $derived(convert(Number(value), cat, from, to));

  function pickCategory(id: string) {
    cat = id;
    const c = CATEGORIES.find((x) => x.id === id)!;
    from = c.units[0].id;
    to = c.units[Math.min(1, c.units.length - 1)].id;
  }
  function swap() {
    [from, to] = [to, from];
  }
  const label = (id: string) => category.units.find((u) => u.id === id)?.label ?? id;
</script>

<section class="card">
  <h2>Unit converter</h2>
  <div class="cats" role="tablist" aria-label="Category">
    {#each CATEGORIES as c (c.id)}<button role="tab" aria-selected={cat === c.id} class="chip" class:on={cat === c.id} onclick={() => pickCategory(c.id)}>{c.label}</button>{/each}
  </div>
  <div class="conv">
    <input class="input" type="number" step="any" bind:value aria-label="Value" />
    <select class="select" bind:value={from} aria-label="From unit"
      >{#each category.units as u (u.id)}<option value={u.id}>{u.label}</option>{/each}</select
    >
    <button class="btn ghost" onclick={swap} aria-label="Swap units">⇄</button>
    <select class="select" bind:value={to} aria-label="To unit"
      >{#each category.units as u (u.id)}<option value={u.id}>{u.label}</option>{/each}</select
    >
  </div>
  <p class="result" aria-live="polite">{formatNumber(Number(value))} {label(from)} = <strong>{formatNumber(result)}</strong> {label(to)}</p>
  <details>
    <summary>All {category.label.toLowerCase()} units</summary>
    <ul class="all">
      {#each category.units as u (u.id)}<li><span>{u.label}</span><span>{formatNumber(convert(Number(value), cat, from, u.id))}</span></li>{/each}
    </ul>
  </details>
</section>

<style>
  h2 {
    font-size: 16px;
    margin: 0 0 8px;
  }
  .cats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }
  .chip.on {
    background: var(--accent);
    color: var(--accent-contrast, #fff);
    border-color: transparent;
  }
  .conv {
    display: grid;
    grid-template-columns: 1fr 1.4fr auto 1.4fr;
    gap: 8px;
    align-items: center;
  }
  @media (max-width: 600px) {
    .conv {
      grid-template-columns: 1fr;
    }
  }
  .result {
    font-size: 18px;
    margin: 12px 0;
  }
  .all {
    list-style: none;
    padding: 0;
    font-size: 13px;
  }
  .all li {
    display: flex;
    justify-content: space-between;
    border-top: 1px solid var(--border);
    padding: 4px 0;
    font-variant-numeric: tabular-nums;
  }
</style>
