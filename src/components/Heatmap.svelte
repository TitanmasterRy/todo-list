<script lang="ts">
  // GitHub-style year heatmap of completions per day.
  import { addDaysKey, dateKey, fromKey, startOfDay, addDays, MONTH_SHORT, DAY_SHORT } from '../lib/dates';

  interface Props {
    data: Record<string, number>;
    weekStart?: 0 | 1;
    endKey?: string;
    weeks?: number;
  }
  let { data, weekStart = 1, endKey = dateKey(new Date()), weeks = 53 }: Props = $props();

  // Build columns of 7 days ending at the end of the current week.
  const grid = $derived.by(() => {
    const end = fromKey(endKey);
    const dow = (end.getDay() - weekStart + 7) % 7;
    const lastColStart = addDays(startOfDay(end), -dow);
    const firstColStart = addDays(lastColStart, -(weeks - 1) * 7);
    const cols: { key: string; count: number; future: boolean }[][] = [];
    const months: { label: string; col: number }[] = [];
    let lastMonth = -1;
    for (let c = 0; c < weeks; c++) {
      const col: { key: string; count: number; future: boolean }[] = [];
      for (let r = 0; r < 7; r++) {
        const d = addDays(firstColStart, c * 7 + r);
        const key = dateKey(d);
        if (r === 0 && d.getMonth() !== lastMonth) {
          lastMonth = d.getMonth();
          if (c === 0 || d.getDate() <= 7) months.push({ label: MONTH_SHORT[d.getMonth()], col: c });
        }
        col.push({ key, count: data[key] ?? 0, future: key > endKey });
      }
      cols.push(col);
    }
    return { cols, months };
  });
  const max = $derived(Math.max(1, ...Object.values(data)));
  const level = (n: number) => (n === 0 ? 0 : n >= max * 0.75 ? 4 : n >= max * 0.5 ? 3 : n >= max * 0.25 ? 2 : 1);
  let hover = $state<{ key: string; count: number } | null>(null);
  const total = $derived(Object.entries(data).filter(([k]) => k > addDaysKey(endKey, -365)).reduce((a, [, v]) => a + v, 0));
  const rowLabels = $derived(Array.from({ length: 7 }, (_, r) => DAY_SHORT[(r + weekStart) % 7]));

  function label(key: string): string {
    const d = fromKey(key);
    return `${DAY_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }
</script>

<div class="heatmap">
  <div class="head">
    <span><strong>{total}</strong> tasks completed in the last year</span>
    <span class="hover">{hover ? `${hover.count} on ${label(hover.key)}` : ''}</span>
  </div>
  <div class="scroll">
    <div class="months" style="--cols:{weeks}">
      {#each grid.months as m}
        <span style="grid-column:{m.col + 2}">{m.label}</span>
      {/each}
    </div>
    <div class="body">
      <div class="rows">
        {#each rowLabels as l, r}
          <span class:show={r % 2 === 0}>{l}</span>
        {/each}
      </div>
      <div class="grid" role="img" aria-label="Completion heatmap">
        {#each grid.cols as col}
          <div class="col">
            {#each col as cell}
              <!-- svelte-ignore a11y_no_static_element_interactions, a11y_mouse_events_have_key_events -->
              <div
                class="cell l{level(cell.count)}"
                class:future={cell.future}
                title="{cell.count} on {label(cell.key)}"
                onmouseover={() => (hover = cell.future ? null : { key: cell.key, count: cell.count })}
                onmouseout={() => (hover = null)}
              ></div>
            {/each}
          </div>
        {/each}
      </div>
    </div>
  </div>
  <div class="legend">
    <span>Less</span>
    {#each [0, 1, 2, 3, 4] as l}<span class="cell l{l}"></span>{/each}
    <span>More</span>
  </div>
</div>

<style>
  .heatmap {
    --cell: 11px;
    --gap: 3px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 8px;
    gap: 8px;
    flex-wrap: wrap;
  }
  .head strong {
    color: var(--text);
  }
  .hover {
    min-height: 1.4em;
  }
  .scroll {
    overflow-x: auto;
    padding-bottom: 4px;
  }
  .months {
    display: grid;
    grid-template-columns: 28px repeat(var(--cols), var(--cell));
    column-gap: var(--gap);
    font-size: 10px;
    color: var(--text-faint);
    height: 14px;
  }
  .body {
    display: flex;
    gap: 4px;
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
    width: 24px;
    font-size: 10px;
    color: var(--text-faint);
  }
  .rows span {
    height: var(--cell);
    line-height: var(--cell);
    visibility: hidden;
  }
  .rows span.show {
    visibility: visible;
  }
  .grid {
    display: flex;
    gap: var(--gap);
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
  }
  .cell {
    width: var(--cell);
    height: var(--cell);
    border-radius: 2px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    display: inline-block;
  }
  .cell.future {
    opacity: 0.3;
  }
  .cell.l1 {
    background: color-mix(in srgb, var(--accent) 30%, var(--bg-elev-2));
  }
  .cell.l2 {
    background: color-mix(in srgb, var(--accent) 55%, var(--bg-elev-2));
  }
  .cell.l3 {
    background: color-mix(in srgb, var(--accent) 80%, var(--bg-elev-2));
  }
  .cell.l4 {
    background: var(--accent);
  }
  .cell:hover {
    outline: 1px solid var(--text);
  }
  .legend {
    display: flex;
    align-items: center;
    gap: 3px;
    justify-content: flex-end;
    font-size: 10px;
    color: var(--text-faint);
    margin-top: 6px;
  }
</style>
