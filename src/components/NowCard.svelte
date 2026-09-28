<script lang="ts">
  // Today → what's on now at school: the current class, time left, and what's next (from Tools → Timetable).
  import { store } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import { ATTENDANCE, formatHM, nextMeeting, whatsNow, type Slot } from '../lib/timetable';
  import { toasts } from '../lib/toast.svelte';
  import type { AttendanceMark } from '../lib/types';
  import { t } from '../lib/i18n/index.svelte';

  const info = $derived(store.schedule?.classes.length ? whatsNow(store.schedule, store.now, store.stats.breaks) : undefined);
  const fmt = (t: string) => formatHM(t, store.settings.timeFormat);

  function label(s: Slot): string {
    const c = s.meetings[0] && store.courseById(s.meetings[0].courseId);
    return c ? `${c.emoji ? c.emoji + ' ' : ''}${c.name}` : s.period.name;
  }
  function room(s: Slot): string {
    return [s.meetings[0]?.room && t('now2.room', { room: s.meetings[0].room }), s.meetings[0]?.teacher].filter(Boolean).join(' · ');
  }
  // quick attendance for the class that's on now
  const curMeeting = $derived(info?.current?.meetings[0]);
  const curMark = $derived(curMeeting ? store.schedule?.attendance?.[store.today]?.[curMeeting.id] : undefined);
  function mark(m: AttendanceMark) {
    if (!curMeeting) return;
    const prev = curMark; // read before saving: the derived value updates right away
    store.markAttendance(store.today, curMeeting.id, prev === m ? undefined : m);
    if (m !== 'absent' || prev === 'absent') return;
    const c = store.courseById(curMeeting.courseId);
    const next = store.schedule && nextMeeting(store.schedule, curMeeting.courseId, store.today, store.stats.breaks);
    toasts.push({
      message: c ? t('now2.absentFrom', { name: c.name }) : t('now2.absent'),
      detail: t('now2.catchUpQ'),
      kind: 'info',
      emoji: '📝',
      timeout: 10000,
      action: {
        label: t('now2.catchUpBtn'),
        onClick: () => store.addTask({ title: t('now2.catchUp', { name: c?.name ?? t('now2.class') }), courseId: curMeeting.courseId, dueAt: next?.key, priority: 'high' }),
      },
    });
  }

  /** Open tasks for the class that's on now or next. */
  const focusCourse = $derived((info?.current ?? info?.next)?.meetings[0]?.courseId);
  const openForCourse = $derived(focusCourse ? store.openTasks.filter((t) => t.courseId === focusCourse).length : 0);
</script>

{#if info?.schoolDay && !info.done}
  <section class="card now" aria-label={t('now2.label')}>
    {#if info.rotation}<span class="rot">{t('tt.rotDay', { day: info.rotation })}</span>{/if}
    {#if info.current}
      <div class="line">
        <span class="k">{t('now2.now')}</span>
        <strong>{label(info.current)}</strong>
        {#if room(info.current)}<span class="muted">{room(info.current)}</span>{/if}
        <span class="left">{t('now2.left', { n: info.minutesLeft ?? 0 })}</span>
      </div>
    {/if}
    {#if curMeeting}
      <span class="marks" role="group" aria-label={t('now2.att')}>
        {#each ATTENDANCE.slice(0, 3) as a (a.id)}
          <button class="chip pick" class:on={curMark === a.id} aria-pressed={curMark === a.id} onclick={() => mark(a.id)} title={a.label}>{a.emoji} {a.label}</button>
        {/each}
      </span>
    {/if}
    {#if info.next}
      <div class="line">
        <span class="k">{t('now2.next')}</span>
        <span>{label(info.next)}</span>
        <span class="muted">{t('now2.at', { time: fmt(info.next.period.start) })}{room(info.next) ? ` · ${room(info.next)}` : ''}</span>
        {#if !info.current}<span class="left">{t('now2.in', { n: info.minutesUntilNext ?? 0 })}</span>{/if}
      </div>
    {/if}
    {#if openForCourse && focusCourse}
      <button class="link" onclick={() => store.go('courses', { courseId: focusCourse })}>{t('now2.open', { count: openForCourse })} →</button>
    {/if}
    <button
      class="link muted small"
      onclick={() => {
        ui.toolsTab = 'timetable';
        store.go('tools');
      }}>{t('tools.timetable')}</button
    >
  </section>
{/if}

<style>
  .now {
    animation: rise-in var(--dur-slow) var(--ease) backwards;
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
    background: var(--grad-accent);
    color: var(--accent-contrast, #fff);
    box-shadow: 0 2px 10px -3px color-mix(in srgb, var(--accent) 70%, transparent);
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
  .marks {
    display: inline-flex;
    gap: 4px;
  }
  .marks .chip {
    font-size: 12px;
    padding: 2px 8px;
  }
  .marks .chip:hover {
    transform: translateY(-1px);
    border-color: var(--border-strong);
  }
  .marks .chip.on {
    color: var(--accent-text);
    border-color: color-mix(in srgb, var(--accent) 50%, transparent);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    box-shadow: 0 0 10px -3px var(--accent);
  }
</style>
