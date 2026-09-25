<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { addDaysKey, thisWeekendKey, nextWeekKey, dayName as weekday, fromKey } from '../lib/dates';
  import { t } from '../lib/i18n/index.svelte';

  interface Props {
    taskId: string;
    onclose: () => void;
  }
  let { taskId, onclose }: Props = $props();
  let picking = $state(false);
  let date = $state('');

  const tomorrow = $derived(addDaysKey(store.today, 1));
  const weekend = $derived(thisWeekendKey(store.now));
  const nextWeek = $derived(nextWeekKey(store.now, store.settings.weekStart));
  const dayName = (k: string) => weekday(fromKey(k).getDay());

  function pick(k: string, label: string) {
    store.snoozeTask(taskId, k, label);
    onclose();
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onclose();
    }
  }
</script>

<svelte:window onclick={onclose} onkeydown={onKey} />
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="menu" role="menu" tabindex="-1" onclick={(e) => e.stopPropagation()}>
  <button role="menuitem" onclick={() => pick(tomorrow, t('snooze.toTomorrow'))}>{t('snooze.tomorrow')} <span>{dayName(tomorrow)}</span></button>
  <button role="menuitem" onclick={() => pick(weekend, t('snooze.toWeekend'))}>{t('snooze.weekend')} <span>{dayName(weekend)}</span></button>
  <button role="menuitem" onclick={() => pick(nextWeek, t('snooze.toNextWeek'))}>{t('snooze.nextWeek')} <span>{dayName(nextWeek)}</span></button>
  {#if store.taskById(taskId)?.recurrence}
    <button
      role="menuitem"
      onclick={() => {
        store.skipOccurrence(taskId);
        onclose();
      }}>{t('snooze.skip')} <span>🔁</span></button
    >
  {/if}
  {#if picking}
    <form
      class="pick"
      onsubmit={(e) => {
        e.preventDefault();
        if (date) pick(date, t('snooze.rescheduled'));
      }}
    >
      <input class="input" type="date" bind:value={date} min={store.today} />
      <button class="btn primary sm" type="submit">{t('snooze.go')}</button>
    </form>
  {:else}
    <button role="menuitem" onclick={() => (picking = true)}>{t('snooze.pick')}</button>
  {/if}
</div>

<style>
  .menu {
    position: absolute;
    inset-inline-end: 0;
    top: 34px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    box-shadow: var(--shadow);
    padding: 6px;
    display: flex;
    flex-direction: column;
    min-width: 190px;
    z-index: 50;
    animation: pop-in 120ms var(--ease);
  }
  .menu > button {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 10px;
    border-radius: 6px;
    font-size: 14px;
    text-align: start;
    color: var(--text);
  }
  .menu > button span {
    color: var(--text-faint);
    font-size: 12px;
  }
  .menu > button:hover {
    background: var(--bg-hover);
  }
  .pick {
    display: flex;
    gap: 6px;
    padding: 6px;
  }
</style>
