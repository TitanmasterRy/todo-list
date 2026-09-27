<script lang="ts">
  // Opened by a #tasks=… link: pick which shared tasks to add, and to which course.
  import { fly } from 'svelte/transition';
  import { focusTrap } from '../lib/focusTrap';
  import { store } from '../lib/store.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { isDuplicate, parseSharedList } from '../lib/sharelist';
  import { dueKey, fromKey } from '../lib/dates';
  import { t } from '../lib/i18n/index.svelte';

  let { code, onclose }: { code: string; onclose: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const list = parseSharedList(code);
  let rows = $state((list?.items ?? []).map((it) => ({ it, dup: isDuplicate(it, store.tasks), on: !isDuplicate(it, store.tasks) })));
  let courseId = $state('');
  const n = $derived(rows.filter((r) => r.on).length);

  const day = (d: string) => fromKey(dueKey(d)).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  function add() {
    const chosen = rows.filter((r) => r.on).map((r) => r.it);
    const made = store.addTasks(
      chosen.map((it) => ({
        title: it.t,
        dueAt: it.d,
        type: it.y,
        estimateMin: it.e,
        notes: it.n,
        subtasks: it.s,
        courseId: courseId || undefined,
      })),
    );
    toasts.push({ message: t('recv.added', { count: made.length }), kind: 'success', emoji: '🤝' });
    onclose();
  }
</script>

<div class="modal-backdrop" onkeydown={(e) => e.key === 'Escape' && onclose()} role="presentation">
  <div use:focusTrap class="modal" role="dialog" aria-modal="true" aria-labelledby="recv-h" tabindex="-1" in:fly={{ y: 20, duration: 200 }}>
    <h2 id="recv-h">🤝 {list?.name ?? t('recv.title')}</h2>
    {#if !list}
      <p>{t('recv.bad')}</p>
      <div class="actions"><button class="btn primary" onclick={onclose}>{t('common.close')}</button></div>
    {:else}
      {#if list.from}<p class="muted">{t('recv.from', { name: list.from })}</p>{/if}
      <ul>
        {#each rows as r, i (i)}
          <li class:dup={r.dup}>
            <label>
              <input type="checkbox" bind:checked={r.on} />
              <span class="grow">
                {r.it.t}
                <span class="muted"
                  >{[r.it.d ? day(r.it.d) : '', r.it.s ? t('recv.steps', { count: r.it.s.length }) : '', r.dup ? t('recv.dup') : ''].filter(Boolean).join(' · ')}</span
                >
              </span>
            </label>
          </li>
        {/each}
      </ul>
      <label class="course"
        >{t('recv.course')}
        <select class="select" bind:value={courseId}>
          <option value="">{t('inbox.noCourse')}</option>
          {#each store.activeCourses as c (c.id)}<option value={c.id}>{c.emoji ? c.emoji + ' ' : ''}{c.name}</option>{/each}
        </select>
      </label>
      <div class="actions">
        <button class="btn ghost" onclick={onclose}>{t('common.cancel')}</button>
        <button class="btn primary" onclick={add} disabled={!n}>{t('recv.add', { count: n })}</button>
      </div>
    {/if}
  </div>
</div>

<style>
  h2 {
    margin: 0 0 8px;
    font-size: 17px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 12px;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 8px 0;
    max-height: 50vh;
    overflow: auto;
  }
  li + li {
    border-top: 1px solid var(--border);
  }
  li label {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    padding: 6px 0;
    font-size: 14px;
  }
  li.dup {
    opacity: 0.7;
  }
  .grow {
    display: grid;
    flex: 1;
  }
  .course {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 13px;
    color: var(--text-muted);
  }
  .course .select {
    width: auto;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }
</style>
