<script lang="ts">
  // Upcoming → Print week: a one-page weekly planner (landscape) with each day's tasks and room to write.
  import { fly } from 'svelte/transition';
  import { focusTrap } from '../lib/focusTrap';
  import { store } from '../lib/store.svelte';
  import { weekPlan } from '../lib/printplan';
  import { addDaysKey, DAY_NAMES, formatTime, fromKey, isDateOnly, MONTH_SHORT, startOfWeekKey } from '../lib/dates';

  let { onclose }: { onclose: () => void } = $props();

  let which = $state<0 | 1>(0);
  let blankLines = $state(4);
  const start = $derived(addDaysKey(startOfWeekKey(store.today, store.settings.weekStart), which * 7));
  const days = $derived(weekPlan(store.tasks, start));
  const label = (key: string) => {
    const d = fromKey(key);
    return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
  };
</script>

<div class="modal-backdrop" onclick={onclose} onkeydown={(e) => e.key === 'Escape' && onclose()} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div use:focusTrap class="modal wide" role="dialog" aria-modal="true" aria-labelledby="pp-h" tabindex="-1" onclick={(e) => e.stopPropagation()} in:fly={{ y: 20, duration: 200 }}>
    <h2 id="pp-h">🖨️ Print a weekly planner</h2>
    <div class="opts">
      <div class="seg" role="radiogroup" aria-label="Week">
        <button role="radio" aria-checked={which === 0} class:on={which === 0} onclick={() => (which = 0)}>This week</button>
        <button role="radio" aria-checked={which === 1} class:on={which === 1} onclick={() => (which = 1)}>Next week</button>
      </div>
      <label>Blank lines per day <input class="input n" type="number" min="0" max="12" bind:value={blankLines} /></label>
    </div>

    <div id="print-planner" class="sheet">
      <header>
        <strong>Week of {label(days[0].key)} – {label(days[6].key)}</strong>
        <span>Homework To-Do</span>
      </header>
      <div class="grid">
        {#each days as d (d.key)}
          <section class="day">
            <h3>{DAY_NAMES[fromKey(d.key).getDay()]} <small>{label(d.key)}</small></h3>
            <ul>
              {#each d.tasks as t (t.id)}
                {@const c = store.courseById(t.courseId)}
                <li class:done={!!t.completedAt}>
                  <span class="box">{t.completedAt ? '☑' : '☐'}</span>
                  <span
                    >{t.title}{#if c}<em> · {c.name}</em>{/if}{#if t.dueAt && !isDateOnly(t.dueAt)}<em> · {formatTime(new Date(t.dueAt), store.settings.timeFormat)}</em>{/if}</span
                  >
                </li>
              {/each}
              {#each Array(Math.max(0, blankLines)) as _, i (i)}<li class="blank"><span class="box">☐</span><span class="line"></span></li>{/each}
            </ul>
          </section>
        {/each}
        <section class="day notes">
          <h3>Notes &amp; goals</h3>
          {#each Array(8) as _, i (i)}<div class="line"></div>{/each}
        </section>
      </div>
    </div>

    <div class="actions">
      <button class="btn" onclick={onclose}>Close</button>
      <button class="btn primary" onclick={() => window.print()}>Print</button>
    </div>
  </div>
</div>

<style>
  .wide {
    max-width: 980px;
    width: calc(100vw - 32px);
  }
  .opts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .opts label {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .n {
    width: 64px;
    padding: 4px 6px;
  }
  .seg {
    display: inline-flex;
    gap: 2px;
    background: var(--bg-sunken, var(--bg-elev));
    border-radius: 8px;
    padding: 2px;
  }
  .seg button {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .seg button.on {
    background: var(--bg-elev);
    color: var(--text);
    font-weight: 600;
  }
  /* the sheet always looks like paper, in both themes */
  .sheet {
    background: #fff;
    color: #111;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
    max-height: 60vh;
    overflow: auto;
    font-size: 12px;
  }
  .sheet header {
    display: flex;
    justify-content: space-between;
    border-bottom: 2px solid #111;
    padding-bottom: 4px;
    margin-bottom: 8px;
    font-size: 14px;
  }
  .sheet header span {
    color: #555;
    font-size: 11px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }
  .day {
    border: 1px solid #999;
    border-radius: 4px;
    padding: 6px;
    min-height: 150px;
    break-inside: avoid;
  }
  .day h3 {
    margin: 0 0 4px;
    font-size: 12px;
    border-bottom: 1px solid #ccc;
    padding-bottom: 2px;
  }
  .day h3 small {
    color: #555;
    font-weight: 400;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: flex;
    gap: 4px;
    align-items: baseline;
    padding: 2px 0;
    line-height: 1.3;
  }
  li.done {
    color: #666;
    text-decoration: line-through;
  }
  li em {
    color: #555;
    font-style: normal;
  }
  .box {
    flex: none;
  }
  .line {
    flex: 1;
    border-bottom: 1px solid #bbb;
    height: 14px;
  }
  .notes .line {
    display: block;
    margin: 4px 0;
  }
  @media print {
    :global(body *) {
      visibility: hidden;
    }
    #print-planner,
    #print-planner :global(*) {
      visibility: visible;
    }
    #print-planner {
      position: fixed;
      inset: 0;
      max-height: none;
      overflow: visible;
      border: none;
      border-radius: 0;
      padding: 0;
    }
    :global(.modal-backdrop) {
      background: none !important;
    }
  }
  @page {
    size: landscape;
    margin: 12mm;
  }
</style>
