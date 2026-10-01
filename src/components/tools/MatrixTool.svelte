<script lang="ts">
  // Tools → Priority matrix: open tasks in four boxes (urgent × important), with the minutes in each. Rows are the
  // usual task rows, so completing, snoozing and editing work in place.
  import { store } from '../../lib/store.svelte';
  import { buildMatrix, QUADRANTS, quadrantMinutes, type Quadrant } from '../../lib/matrix';
  import { formatMinutes } from '../../lib/dates';
  import TaskItem from '../TaskItem.svelte';
  import { t } from '../../lib/i18n/index.svelte';

  let urgentDays = $state(2);
  const matrix = $derived(buildMatrix(store.openTasks, store.today, { urgentDays }));
  const ICON: Record<Quadrant, string> = { do: '🔥', plan: '🗓️', quick: '⚡', later: '🌱' };
  const label = (q: Quadrant) => t(`matrix.${q}` as const);
  const hint = (q: Quadrant) => t(`matrix.${q}Hint` as const);
</script>

<div class="matrix-tool">
  <div class="card intro">
    <p>{t('matrix.intro')}</p>
    <label class="window"
      >{t('matrix.window')}
      <select class="select" bind:value={urgentDays}>
        {#each [1, 2, 3, 5, 7] as d (d)}<option value={d}>{t('matrix.days', { count: d })}</option>{/each}
      </select>
    </label>
  </div>
  <div class="grid">
    {#each QUADRANTS as q (q)}
      <section class="card box {q}" aria-labelledby="mx-{q}">
        <h3 id="mx-{q}">
          <span class="ico" aria-hidden="true">{ICON[q]}</span>
          {label(q)}
          <span class="count">{matrix[q].length}</span>
          {#if matrix[q].length}<span class="min">{formatMinutes(quadrantMinutes(matrix[q]))}</span>{/if}
        </h3>
        <p class="hint">{hint(q)}</p>
        {#if matrix[q].length}
          <div class="task-list">
            {#each matrix[q] as task (task.id)}
              <TaskItem {task} compact />
            {/each}
          </div>
        {:else}
          <p class="empty">{t('matrix.empty')}</p>
        {/if}
      </section>
    {/each}
  </div>
</div>

<style>
  .intro {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .intro p {
    margin: 0;
    flex: 1;
    min-width: 220px;
    color: var(--text-muted);
    font-size: 14px;
  }
  .window {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    white-space: nowrap;
  }
  .select {
    width: auto;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  @media (max-width: 720px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
  .box {
    --tone: var(--accent);
    border-top: 3px solid var(--tone);
    min-height: 160px;
  }
  .box.do {
    --tone: var(--danger, #e17055);
  }
  .box.plan {
    --tone: var(--accent);
  }
  .box.quick {
    --tone: var(--warn, #fdcb6e);
  }
  .box.later {
    --tone: var(--success, #00b894);
  }
  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    margin: 0 0 2px;
  }
  .count {
    font-size: 12px;
    font-weight: 700;
    padding: 1px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--tone) 18%, transparent);
    color: var(--text);
  }
  .min {
    margin-inline-start: auto;
    font-size: 12px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .hint {
    margin: 0 0 10px;
    font-size: 12px;
    color: var(--text-muted);
  }
  .empty {
    color: var(--text-faint);
    font-size: 13px;
    margin: 12px 0;
  }
</style>
