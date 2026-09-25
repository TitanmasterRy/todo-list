<script lang="ts">
  // Today → what's on now at school: the current class, time left, and what's next (from Tools → Timetable).
  import { store } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import { formatHM, whatsNow, type Slot } from '../lib/timetable';

  const info = $derived(store.schedule?.classes.length ? whatsNow(store.schedule, store.now, store.stats.breaks) : undefined);
  const fmt = (t: string) => formatHM(t, store.settings.timeFormat);

  function label(s: Slot): string {
    const c = s.meetings[0] && store.courseById(s.meetings[0].courseId);
    return c ? `${c.emoji ? c.emoji + ' ' : ''}${c.name}` : s.period.name;
  }
  function room(s: Slot): string {
    return [s.meetings[0]?.room && `Room ${s.meetings[0].room}`, s.meetings[0]?.teacher].filter(Boolean).join(' · ');
  }
  /** Open tasks for the class that's on now or next. */
  const focusCourse = $derived((info?.current ?? info?.next)?.meetings[0]?.courseId);
  const openForCourse = $derived(focusCourse ? store.openTasks.filter((t) => t.courseId === focusCourse).length : 0);
</script>

{#if info?.schoolDay && !info.done}
  <section class="card now" aria-label="School schedule now">
    {#if info.rotation}<span class="rot">{info.rotation} day</span>{/if}
    {#if info.current}
      <div class="line">
        <span class="k">Now</span>
        <strong>{label(info.current)}</strong>
        {#if room(info.current)}<span class="muted">{room(info.current)}</span>{/if}
        <span class="left">{info.minutesLeft} min left</span>
      </div>
    {/if}
    {#if info.next}
      <div class="line">
        <span class="k">Next</span>
        <span>{label(info.next)}</span>
        <span class="muted">at {fmt(info.next.period.start)}{room(info.next) ? ` · ${room(info.next)}` : ''}</span>
        {#if !info.current}<span class="left">in {info.minutesUntilNext} min</span>{/if}
      </div>
    {/if}
    {#if openForCourse && focusCourse}
      <button class="link" onclick={() => store.go('courses', { courseId: focusCourse })}>{openForCourse} open task{openForCourse === 1 ? '' : 's'} for this class →</button>
    {/if}
    <button
      class="link muted small"
      onclick={() => {
        ui.toolsTab = 'timetable';
        store.go('tools');
      }}>Timetable</button
    >
  </section>
{/if}

<style>
  .now {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 14px;
    margin-bottom: 12px;
    font-size: 14px;
  }
  .rot {
    font-size: 12px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    color: var(--accent-text);
  }
  .line {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 6px;
  }
  .k {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    font-weight: 700;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  .left {
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: var(--accent-text);
    font-weight: 600;
  }
  .link {
    color: var(--accent-text);
    padding: 0;
    font-size: 13px;
  }
  .link.small {
    margin-left: auto;
    font-size: 12px;
  }
</style>
