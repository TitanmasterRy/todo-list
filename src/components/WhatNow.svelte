<script lang="ts">
  // "What should I do now?": the single best next task, with the reasons, and a one-tap start.
  import { store } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import { whatNow } from '../lib/whatnow';
  import { formatDue, formatMinutes } from '../lib/dates';

  let index = $state(0);
  const minutesFree = $derived(Math.max(0, (store.settings.dailyCapacityMin || 180) - store.todayEstimateMin));
  const picks = $derived(ui.whatNow ? whatNow(store.openTasks, store.now, { today: store.today, minutesFree, limit: 5 }) : []);
  const pick = $derived(picks[index % Math.max(1, picks.length)]);
  const course = $derived(pick ? store.courseById(pick.task.courseId) : undefined);
</script>

{#if ui.whatNow}
  <section class="card whatnow" aria-live="polite" aria-label="Suggested next task">
    {#if !pick}
      <p>Nothing open. Enjoy the free time, or plan ahead in Upcoming.</p>
      <button class="btn sm" onclick={() => (ui.whatNow = false)}>Close</button>
    {:else}
      <div class="head">
        <span class="k">Do this next{picks.length > 1 ? ` · ${(index % picks.length) + 1} of ${picks.length}` : ''}</span>
        <button class="btn ghost sm" onclick={() => (ui.whatNow = false)} aria-label="Close suggestion">✕</button>
      </div>
      <div class="title">{course?.emoji ?? ''} {pick.task.title}</div>
      <div class="meta">
        {#if course}<span class="chip" style="border-color:{course.color}">{course.name}</span>{/if}
        {#if pick.task.dueAt}<span class="chip">{formatDue(pick.task.dueAt, store.now, store.settings.timeFormat)}</span>{/if}
        {#if pick.task.estimateMin}<span class="chip">~{formatMinutes(pick.task.estimateMin)}</span>{/if}
      </div>
      {#if pick.reasons.length}<p class="why">Why: {pick.reasons.slice(0, 3).join(' · ')}</p>{/if}
      <div class="btns">
        <button class="btn primary" onclick={() => store.go('focus', { taskId: pick.task.id })}>🎯 Start in Focus</button>
        {#if picks.length > 1}<button class="btn" onclick={() => index++}>Something else</button>{/if}
        <button class="btn ghost" onclick={() => (store.editingTaskId = pick.task.id)}>Open</button>
      </div>
    {/if}
  </section>
{/if}

<style>
  .whatnow {
    margin-bottom: 14px;
    border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
    background: color-mix(in srgb, var(--accent) 6%, var(--bg-elev));
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .k {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent-text);
    font-weight: 700;
  }
  .title {
    font-size: 18px;
    font-weight: 700;
    margin: 4px 0 6px;
  }
  .meta {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .why {
    font-size: 13px;
    color: var(--text-muted);
    margin: 8px 0;
  }
  .btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
</style>
