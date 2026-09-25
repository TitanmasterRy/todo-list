<script lang="ts">
  import { fly } from 'svelte/transition';
  import { store } from '../lib/store.svelte';
  import { PRIORITIES, type Priority } from '../lib/types';
  import { addDaysKey, nextWeekKey } from '../lib/dates';
  import { locale as appLocale, t } from '../lib/i18n/index.svelte';
  import { PRIORITY_LABEL } from '../lib/store.svelte';

  const ids = $derived([...store.selection]);
  const n = $derived(ids.length);
  let tag = $state('');
  let date = $state('');
  let showTag = $state(false);
  let showDate = $state(false);

  function course(e: Event) {
    const v = (e.target as HTMLSelectElement).value;
    if (v === '__none') return;
    store.bulkUpdate(ids, { courseId: v || undefined }, t('bulk.moved', { count: n, course: store.courseById(v)?.name ?? t('bulk.noCourse') }));
    (e.target as HTMLSelectElement).value = '__none';
  }
  function priority(e: Event) {
    const v = (e.target as HTMLSelectElement).value as Priority | '__none';
    if (v === '__none') return;
    store.bulkUpdate(ids, { priority: v }, t('bulk.setPriority', { count: n, priority: appLocale() === 'en' ? v : PRIORITY_LABEL[v].toLowerCase() }));
    (e.target as HTMLSelectElement).value = '__none';
  }
  function reschedule(key: string | null) {
    store.bulkUpdate(ids, { dueAt: key ?? undefined, pinnedDay: undefined }, key ? t('bulk.rescheduled', { count: n }) : t('bulk.cleared', { count: n }));
    showDate = false;
  }
  function addTag(e: Event) {
    e.preventDefault();
    const tg = tag.trim().replace(/^#/, '').toLowerCase();
    if (!tg) return;
    store.bulkAddTag(ids, tg);
    tag = '';
    showTag = false;
  }
</script>

{#if store.bulkMode}
  <div class="bulk" transition:fly={{ y: 30, duration: 200 }} role="toolbar" aria-label={t('bulk.label')}>
    <span class="n">{t('bulk.selected', { count: n })}</span>
    <select class="select" onchange={course} aria-label={t('bulk.moveTo')} disabled={!n}>
      <option value="__none">{t('bulk.course')}</option>
      <option value="">{t('inbox.noCourse')}</option>
      {#each store.activeCourses as c (c.id)}<option value={c.id}>{c.emoji ?? ''} {c.name}</option>{/each}
    </select>
    <div class="grp">
      <button class="btn sm" onclick={() => (showDate = !showDate)} disabled={!n}>{t('bulk.reschedule')}</button>
      {#if showDate}
        <div class="pop">
          <button class="btn ghost sm" onclick={() => reschedule(store.today)}>{t('date.today')}</button>
          <button class="btn ghost sm" onclick={() => reschedule(addDaysKey(store.today, 1))}>{t('date.tomorrow')}</button>
          <button class="btn ghost sm" onclick={() => reschedule(nextWeekKey(store.now, store.settings.weekStart))}>{t('snooze.nextWeek')}</button>
          <button class="btn ghost sm" onclick={() => reschedule(null)}>{t('today.noDate')}</button>
          <form
            onsubmit={(e) => {
              e.preventDefault();
              if (date) reschedule(date);
            }}
          >
            <input class="input" type="date" bind:value={date} aria-label={t('bulk.date')} />
            <button class="btn primary sm" type="submit">{t('snooze.go')}</button>
          </form>
        </div>
      {/if}
    </div>
    <div class="grp">
      <button class="btn sm" onclick={() => (showTag = !showTag)} disabled={!n}>{t('bulk.tag')}</button>
      {#if showTag}
        <form class="pop" onsubmit={addTag}>
          <input class="input" bind:value={tag} placeholder={t('bulk.tagPh')} aria-label={t('inbox.tag')} />
          <button class="btn primary sm" type="submit">{t('common.add')}</button>
        </form>
      {/if}
    </div>
    <select class="select" onchange={priority} aria-label={t('inbox.priority')} disabled={!n}>
      <option value="__none">{t('bulk.priority')}</option>
      {#each PRIORITIES as p}<option value={p}>{appLocale() === 'en' ? p : PRIORITY_LABEL[p]}</option>{/each}
    </select>
    <button class="btn danger sm" onclick={() => store.bulkDelete(ids)} disabled={!n}>{t('common.delete')}</button>
    <span class="grow"></span>
    <button class="btn ghost sm" onclick={() => store.clearSelection()}>{t('common.done')} <span class="kbd">Esc</span></button>
  </div>
{/if}

<style>
  .bulk {
    position: fixed;
    left: 50%;
    bottom: 20px;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    background: var(--bg-elev-2);
    border: 1px solid var(--border-strong);
    border-radius: 14px;
    padding: 8px 10px;
    box-shadow: var(--shadow);
    z-index: 150;
    width: min(760px, calc(100vw - 24px));
  }
  .n {
    font-weight: 600;
    font-size: 13px;
    padding: 0 6px;
  }
  .select {
    width: auto;
    padding: 5px 8px;
    font-size: 13px;
  }
  .grp {
    position: relative;
  }
  .pop {
    position: absolute;
    bottom: 40px;
    inset-inline-start: 0;
    background: var(--bg-elev-2);
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    box-shadow: var(--shadow);
    min-width: 180px;
  }
  .pop form {
    display: flex;
    gap: 4px;
  }
  .grow {
    flex: 1;
  }
  @media (max-width: 720px) {
    .bulk {
      bottom: calc(var(--tabbar-h) + 10px + env(safe-area-inset-bottom));
    }
  }
</style>
