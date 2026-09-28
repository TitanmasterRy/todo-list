<script lang="ts">
  // "What should I do now?": the single best next task, with the reasons, and a one-tap start.
  import { store } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import { whatNow } from '../lib/whatnow';
  import { formatDue, formatMinutes } from '../lib/dates';
  import { t } from '../lib/i18n/index.svelte';

  let index = $state(0);
  const minutesFree = $derived(Math.max(0, (store.settings.dailyCapacityMin || 180) - store.todayEstimateMin));
  const picks = $derived(ui.whatNow ? whatNow(store.openTasks, store.now, { today: store.today, minutesFree, limit: 5 }) : []);
  const pick = $derived(picks[index % Math.max(1, picks.length)]);
  const course = $derived(pick ? store.courseById(pick.task.courseId) : undefined);
</script>

{#if ui.whatNow}
  <section class="card whatnow glow-edge" aria-live="polite" aria-label={t('now.label')}>
    <span class="orb" aria-hidden="true">🧭</span>
    {#if !pick}
      <p>{t('now.nothing')}</p>
      <button class="btn sm" onclick={() => (ui.whatNow = false)}>{t('common.close')}</button>
    {:else}
      <div class="head">
        <span class="k">{t('now.next')}{picks.length > 1 ? ` · ${t('now.of', { i: (index % picks.length) + 1, n: picks.length })}` : ''}</span>
        <button class="btn ghost sm" onclick={() => (ui.whatNow = false)} aria-label={t('now.close')}>✕</button>
      </div>
      <div class="title">{course?.emoji ?? ''} {pick.task.title}</div>
      <div class="meta">
        {#if course}<span class="chip" style="border-color:{course.color}">{course.name}</span>{/if}
        {#if pick.task.dueAt}<span class="chip">{formatDue(pick.task.dueAt, store.now, store.settings.timeFormat)}</span>{/if}
        {#if pick.task.estimateMin}<span class="chip">~{formatMinutes(pick.task.estimateMin)}</span>{/if}
      </div>
      {#if pick.reasons.length}<p class="why">{t('now.why', { reasons: pick.reasons.slice(0, 3).join(' · ') })}</p>{/if}
      <div class="btns">
        <button class="btn primary" onclick={() => store.go('focus', { taskId: pick.task.id })}>🎯 {t('now.start')}</button>
        {#if picks.length > 1}<button class="btn" onclick={() => index++}>{t('now.else')}</button>{/if}
        <button class="btn ghost" onclick={() => (store.editingTaskId = pick.task.id)}>{t('now.open')}</button>
      </div>
    {/if}
  </section>
{/if}

<style>
  .whatnow {
    position: relative;
    overflow: hidden;
    margin-bottom: 14px;
    animation: pop-in var(--dur-slow) var(--spring) both;
  }
  .whatnow.glow-edge {
    background:
      linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, var(--bg-elev)), var(--bg-elev) 60%) padding-box,
      linear-gradient(135deg, color-mix(in srgb, var(--accent) 70%, var(--border)), color-mix(in srgb, var(--accent-2) 60%, var(--border))) border-box;
  }
  .orb {
    position: absolute;
    top: 10px;
    inset-inline-end: 44px;
    font-size: 40px;
    opacity: 0.35;
    pointer-events: none;
    animation: float 3.4s ease-in-out infinite;
    filter: drop-shadow(0 6px 12px color-mix(in srgb, var(--accent) 50%, transparent));
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
    font-size: 19px;
    font-weight: 800;
    letter-spacing: -0.01em;
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
