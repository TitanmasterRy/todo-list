<script lang="ts">
  // Phone replacement for the row's hover buttons: everything you can do to one task, in a sheet. Opened from the ⋯
  // on a task row; loaded the first time it's needed.
  import { store } from '../lib/store.svelte';
  import { addDaysKey, thisWeekendKey, nextWeekKey, dayName as weekday, fromKey, formatDue } from '../lib/dates';
  import { buzz } from '../lib/haptics';
  import Sheet from './Sheet.svelte';
  import { t } from '../lib/i18n/index.svelte';

  interface Props {
    taskId: string;
    onclose: () => void;
  }
  let { taskId, onclose }: Props = $props();
  const task = $derived(store.taskById(taskId));
  const done = $derived(!!task?.completedAt);
  const timing = $derived(!!task?.timerStartedAt);
  const tomorrow = $derived(addDaysKey(store.today, 1));
  const weekend = $derived(thisWeekendKey(store.now));
  const nextWeek = $derived(nextWeekKey(store.now, store.settings.weekStart));
  const dayName = (k: string) => weekday(fromKey(k).getDay());
  let picking = $state(false);
  let date = $state('');

  function run(fn: () => void) {
    buzz('tap');
    fn();
    onclose();
  }
</script>

{#if task}
  <Sheet label={t('sheet.actions')} {onclose}>
    <div class="title">
      <strong>{task.title}</strong>
      {#if task.dueAt}<span class="due">{formatDue(task.dueAt, store.now, store.settings.timeFormat)}</span>{/if}
    </div>
    <div class="grid">
      {#if done}
        <button class="act" onclick={() => run(() => store.uncompleteTask(taskId))}><span aria-hidden="true">↩️</span>{t('sheet.reopen')}</button>
      {:else}
        <button class="act primary" onclick={() => run(() => store.completeTask(taskId))}><span aria-hidden="true">✓</span>{t('sheet.complete')}</button>
        <button class="act" onclick={() => run(() => (timing ? store.stopTimer(taskId) : store.startTimer(taskId)))}
          ><span aria-hidden="true">{timing ? '⏹' : '▶'}</span>{timing ? t('task.stopTimer') : t('task.startTimer')}</button
        >
        <button class="act" onclick={() => run(() => store.go('focus', { taskId }))}><span aria-hidden="true">🎯</span>{t('nav.focus')}</button>
        {#if !task.dueAt && task.pinnedDay !== store.today}
          <button class="act" onclick={() => run(() => store.pinToToday(taskId))}><span aria-hidden="true">📌</span>{t('sheet.toToday')}</button>
        {/if}
        {#if !(task.frog && task.frogDate === store.today)}
          <button class="act" onclick={() => run(() => store.setFrog(taskId))}><span aria-hidden="true">🐸</span>{t('sheet.frog')}</button>
        {/if}
      {/if}
      <button class="act" onclick={() => run(() => (store.editingTaskId = taskId))}><span aria-hidden="true">✎</span>{t('common.edit')}</button>
      <button class="act" onclick={() => run(() => store.duplicateTask(taskId))}><span aria-hidden="true">⧉</span>{t('sheet.duplicate')}</button>
      <button class="act danger" onclick={() => run(() => store.deleteTask(taskId))}><span aria-hidden="true">🗑</span>{t('common.delete')}</button>
    </div>
    {#if !done}
      <div class="snooze">
        <div class="lbl">💤 {t('sheet.snooze')}</div>
        <div class="row">
          <button class="chip" onclick={() => run(() => store.snoozeTask(taskId, tomorrow, t('snooze.toTomorrow')))}>{t('snooze.tomorrow')} · {dayName(tomorrow)}</button>
          <button class="chip" onclick={() => run(() => store.snoozeTask(taskId, weekend, t('snooze.toWeekend')))}>{t('snooze.weekend')} · {dayName(weekend)}</button>
          <button class="chip" onclick={() => run(() => store.snoozeTask(taskId, nextWeek, t('snooze.toNextWeek')))}>{t('snooze.nextWeek')}</button>
          {#if task.recurrence}
            <button class="chip" onclick={() => run(() => store.skipOccurrence(taskId))}>{t('snooze.skip')} 🔁</button>
          {/if}
          {#if picking}
            <form
              class="pick"
              onsubmit={(e) => {
                e.preventDefault();
                if (date) run(() => store.snoozeTask(taskId, date, t('snooze.rescheduled')));
              }}
            >
              <input class="input" type="date" bind:value={date} min={store.today} aria-label={t('snooze.pick')} />
              <button class="btn primary sm" type="submit">{t('snooze.go')}</button>
            </form>
          {:else}
            <button class="chip" onclick={() => (picking = true)}>{t('snooze.pick')}</button>
          {/if}
        </div>
      </div>
    {/if}
  </Sheet>
{/if}

<style>
  .title {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 2px 12px;
  }
  .title strong {
    font-size: 16px;
    line-height: 1.3;
  }
  .due {
    font-size: 13px;
    color: var(--text-muted);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .act {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 12px 4px 10px;
    border-radius: var(--radius);
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    font-size: 12px;
    font-weight: 700;
    color: var(--text);
    min-height: 72px;
    text-align: center;
    -webkit-tap-highlight-color: transparent;
  }
  .act span {
    font-size: 22px;
    line-height: 1;
  }
  .act:active {
    transform: scale(0.96);
  }
  .act.primary {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 16%, var(--bg-elev-2));
  }
  .act.danger {
    color: var(--danger-text);
  }
  .snooze {
    margin-top: 14px;
  }
  .lbl {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin-bottom: 8px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    cursor: pointer;
    font-size: 13px;
    padding: 8px 12px;
  }
  .pick {
    display: flex;
    gap: 6px;
    width: 100%;
  }
  .pick .input {
    flex: 1;
  }
</style>
