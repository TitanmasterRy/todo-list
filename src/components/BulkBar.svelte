<script lang="ts">
  import { fly } from 'svelte/transition';
  import { store } from '../lib/store.svelte';
  import { PRIORITIES, type Priority } from '../lib/types';
  import { addDaysKey, nextWeekKey } from '../lib/dates';

  const ids = $derived([...store.selection]);
  const n = $derived(ids.length);
  let tag = $state('');
  let date = $state('');
  let showTag = $state(false);
  let showDate = $state(false);

  function course(e: Event) {
    const v = (e.target as HTMLSelectElement).value;
    if (v === '__none') return;
    store.bulkUpdate(ids, { courseId: v || undefined }, `Moved ${n} tasks to ${store.courseById(v)?.name ?? 'no course'}`);
    (e.target as HTMLSelectElement).value = '__none';
  }
  function priority(e: Event) {
    const v = (e.target as HTMLSelectElement).value as Priority | '__none';
    if (v === '__none') return;
    store.bulkUpdate(ids, { priority: v }, `Set ${n} tasks to ${v}`);
    (e.target as HTMLSelectElement).value = '__none';
  }
  function reschedule(key: string | null, label: string) {
    store.bulkUpdate(ids, { dueAt: key ?? undefined, pinnedDay: undefined }, `${label} ${n} tasks`);
    showDate = false;
  }
  function addTag(e: Event) {
    e.preventDefault();
    const t = tag.trim().replace(/^#/, '').toLowerCase();
    if (!t) return;
    store.bulkAddTag(ids, t);
    tag = '';
    showTag = false;
  }
</script>

{#if store.bulkMode}
  <div class="bulk" transition:fly={{ y: 30, duration: 200 }} role="toolbar" aria-label="Bulk actions">
    <span class="n">{n} selected</span>
    <select class="select" onchange={course} aria-label="Move to course" disabled={!n}>
      <option value="__none">Course…</option>
      <option value="">No course</option>
      {#each store.activeCourses as c (c.id)}<option value={c.id}>{c.emoji ?? ''} {c.name}</option>{/each}
    </select>
    <div class="grp">
      <button class="btn sm" onclick={() => (showDate = !showDate)} disabled={!n}>Reschedule…</button>
      {#if showDate}
        <div class="pop">
          <button class="btn ghost sm" onclick={() => reschedule(store.today, 'Rescheduled')}>Today</button>
          <button class="btn ghost sm" onclick={() => reschedule(addDaysKey(store.today, 1), 'Rescheduled')}>Tomorrow</button>
          <button class="btn ghost sm" onclick={() => reschedule(nextWeekKey(store.now, store.settings.weekStart), 'Rescheduled')}>Next week</button>
          <button class="btn ghost sm" onclick={() => reschedule(null, 'Cleared date on')}>No date</button>
          <form onsubmit={(e) => { e.preventDefault(); if (date) reschedule(date, 'Rescheduled'); }}>
            <input class="input" type="date" bind:value={date} aria-label="Date" />
            <button class="btn primary sm" type="submit">Go</button>
          </form>
        </div>
      {/if}
    </div>
    <div class="grp">
      <button class="btn sm" onclick={() => (showTag = !showTag)} disabled={!n}>Tag…</button>
      {#if showTag}
        <form class="pop" onsubmit={addTag}>
          <input class="input" bind:value={tag} placeholder="tag" aria-label="Tag" />
          <button class="btn primary sm" type="submit">Add</button>
        </form>
      {/if}
    </div>
    <select class="select" onchange={priority} aria-label="Priority" disabled={!n}>
      <option value="__none">Priority…</option>
      {#each PRIORITIES as p}<option value={p}>{p}</option>{/each}
    </select>
    <button class="btn danger sm" onclick={() => store.bulkDelete(ids)} disabled={!n}>Delete</button>
    <span class="grow"></span>
    <button class="btn ghost sm" onclick={() => store.clearSelection()}>Done <span class="kbd">Esc</span></button>
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
    left: 0;
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
