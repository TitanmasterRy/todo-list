<script lang="ts">
  import { CATEGORIES, convert, formatNumber, type Unit } from '../../lib/units';
  import { hasKey, t } from '../../lib/i18n/index.svelte';

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
  // names in the app language when there is one (symbols like cm² stay as they are)
  const unitName = (catId: string, u: Unit) => {
    const k = `unit.${catId}.${u.id}`;
    return hasKey(k) ? t(k) : u.label;
  };
  const catName = (id: string, fallback: string) => {
    const k = `unit.${id}`;
    return hasKey(k) ? t(k) : fallback;
  };
  const label = (id: string) => {
    const u = category.units.find((x) => x.id === id);
    return u ? unitName(cat, u) : id;
  };
</script>

<section class="card">
  <h2>{t('tools.units')}</h2>
  <div class="cats" role="tablist" aria-label={t('units.category')}>
    {#each CATEGORIES as c (c.id)}<button role="tab" aria-selected={cat === c.id} class="chip" class:on={cat === c.id} onclick={() => pickCategory(c.id)}
        >{catName(c.id, c.label)}</button
      >{/each}
  </div>
  <div class="conv">
    <input class="input" type="number" step="any" bind:value aria-label={t('units.value')} />
    <select class="select" bind:value={from} aria-label={t('units.from')}
      >{#each category.units as u (u.id)}<option value={u.id}>{unitName(cat, u)}</option>{/each}</select
    >
    <button class="btn ghost" onclick={swap} aria-label={t('units.swap')}>⇄</button>
    <select class="select" bind:value={to} aria-label={t('units.to')}
      >{#each category.units as u (u.id)}<option value={u.id}>{unitName(cat, u)}</option>{/each}</select
    >
  </div>
  <p class="result" aria-live="polite">{formatNumber(Number(value))} {label(from)} = <strong>{formatNumber(result)}</strong> {label(to)}</p>
  <details>
    <summary>{t('units.all', { category: catName(category.id, category.label).toLowerCase() })}</summary>
    <ul class="all">
      {#each category.units as u (u.id)}<li><span>{unitName(cat, u)}</span><span>{formatNumber(convert(Number(value), cat, from, u.id))}</span></li>{/each}
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
