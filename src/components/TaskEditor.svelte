<script lang="ts">
  import { focusTrap } from '../lib/focusTrap';
  import { store, PRIORITY_LABEL } from '../lib/store.svelte';
  import { PRIORITIES, TASK_TYPES, type Recurrence, type Subtask, type Task } from '../lib/types';
  import { isDateOnly, dueKey, combineDateTime, pad } from '../lib/dates';
  import { toasts } from '../lib/toast.svelte';
  import { uid } from '../lib/id';

  interface Props {
    taskId: string;
    onclose: () => void;
  }
  let { taskId, onclose }: Props = $props();

  // svelte-ignore state_referenced_locally
  const original = store.taskById(taskId);
  let title = $state(original?.title ?? '');
  let notes = $state(original?.notes ?? '');
  let courseId = $state(original?.courseId ?? '');
  let tags = $state(original?.tags.join(', ') ?? '');
  let priority = $state(original?.priority ?? 'normal');
  let dateKey = $state(original?.dueAt ? dueKey(original.dueAt) : '');
  let time = $state(
    original?.dueAt && !isDateOnly(original.dueAt)
      ? `${pad(new Date(original.dueAt).getHours())}:${pad(new Date(original.dueAt).getMinutes())}`
      : '',
  );
  let estimate = $state(original?.estimateMin ? String(original.estimateMin) : '');
  let type = $state(original?.type ?? '');
  let weight = $state(original?.weight ? String(original.weight) : '');
  let score = $state(typeof original?.score === 'number' ? String(original.score) : '');
  let subtasks = $state<Subtask[]>(original ? original.subtasks.map((s) => ({ ...s })) : []);
  let newSub = $state('');
  let recKind = $state<'' | Recurrence['kind']>(original?.recurrence?.kind ?? '');
  let recN = $state(String(original?.recurrence?.n ?? 2));
  let recDays = $state<number[]>(original?.recurrence?.days ?? []);
  let recUntil = $state(original?.recurrence?.until ?? '');
  let templateName = $state('');
  let showTemplate = $state(false);
  let titleInput: HTMLInputElement | undefined = $state();

  $effect(() => {
    titleInput?.focus();
  });

  function toggleDay(d: number) {
    recDays = recDays.includes(d) ? recDays.filter((x) => x !== d) : [...recDays, d].sort();
  }

  function save(e?: Event) {
    e?.preventDefault();
    if (!original) return onclose();
    if (!title.trim()) {
      toasts.push({ message: 'Title is required', kind: 'warn' });
      return;
    }
    let dueAt: string | undefined;
    if (dateKey) {
      if (time) {
        const [h, m] = time.split(':').map(Number);
        dueAt = combineDateTime(dateKey, h, m);
      } else dueAt = dateKey;
    }
    let recurrence: Recurrence | undefined;
    if (recKind) {
      recurrence = { kind: recKind };
      if (recKind === 'everyNDays') recurrence.n = Math.max(1, parseInt(recN, 10) || 1);
      if (recKind === 'weekly') recurrence.days = recDays.length ? recDays : [dateKey ? new Date(dateKey + 'T00:00:00').getDay() : new Date().getDay()];
      if (recUntil) recurrence.until = recUntil;
    }
    const patch: Partial<Task> = {
      title: title.trim(),
      notes: notes.trim() || undefined,
      courseId: courseId || undefined,
      tags: tags
        .split(/[,\s]+/)
        .map((t) => t.replace(/^#/, '').trim().toLowerCase())
        .filter(Boolean),
      priority,
      dueAt,
      estimateMin: estimate ? Math.max(0, parseInt(estimate, 10) || 0) || undefined : undefined,
      type: (type || undefined) as Task['type'],
      weight: weight ? parseFloat(weight) || undefined : undefined,
      score: score !== '' && !Number.isNaN(parseFloat(score)) ? Math.max(0, Math.min(200, parseFloat(score))) : undefined,
      subtasks: subtasks.filter((s) => s.title.trim()),
      recurrence,
    };
    store.updateTask(taskId, patch, { undoable: true });
    onclose();
  }

  function addSub() {
    if (!newSub.trim()) return;
    subtasks = [...subtasks, { id: uid('s'), title: newSub.trim(), done: false }];
    newSub = '';
  }

  function saveAsTemplate() {
    if (!original) return;
    const name = templateName.trim() || title.trim();
    if (!name) return;
    const t = store.saveTemplate({ ...original, title: title.trim(), subtasks }, name);
    toasts.push({ message: `Saved template @${t.name}`, detail: 'Use it in quick add with @' + t.name, kind: 'success' });
    showTemplate = false;
  }

  function del() {
    store.deleteTask(taskId);
    onclose();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onclose();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') save();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div class="modal-backdrop" onclick={onclose} onkeydown={onKey} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <form use:focusTrap class="modal" aria-label="Edit task" onclick={(e) => e.stopPropagation()} onsubmit={save}>
    {#if !original}
      <p>Task not found.</p>
    {:else}
      <div class="field">
        <input class="input title" bind:this={titleInput} bind:value={title} placeholder="Task title" aria-label="Title" />
      </div>
      <div class="row">
        <div class="field">
          <label for="ed-course">Course</label>
          <select id="ed-course" class="select" bind:value={courseId}>
            <option value="">None</option>
            {#each store.activeCourses as c (c.id)}
              <option value={c.id}>{c.emoji ? c.emoji + ' ' : ''}{c.name}</option>
            {/each}
          </select>
        </div>
        <div class="field">
          <label for="ed-priority">Priority</label>
          <select id="ed-priority" class="select" bind:value={priority}>
            {#each PRIORITIES as p}
              <option value={p}>{PRIORITY_LABEL[p]}</option>
            {/each}
          </select>
        </div>
        <div class="field">
          <label for="ed-type">Type</label>
          <select id="ed-type" class="select" bind:value={type}>
            <option value="">—</option>
            {#each TASK_TYPES as t}
              <option value={t}>{t}</option>
            {/each}
          </select>
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label for="ed-date">Due date</label>
          <input id="ed-date" class="input" type="date" bind:value={dateKey} />
        </div>
        <div class="field">
          <label for="ed-time">Time</label>
          <input id="ed-time" class="input" type="time" bind:value={time} disabled={!dateKey} />
        </div>
        <div class="field">
          <label for="ed-est">Estimate (min)</label>
          <input id="ed-est" class="input" type="number" min="0" step="5" bind:value={estimate} placeholder="45" />
        </div>
        <div class="field">
          <label for="ed-weight">Weight %</label>
          <input id="ed-weight" class="input" type="number" min="0" max="100" bind:value={weight} placeholder="10" />
        </div>
        <div class="field">
          <label for="ed-score">Score %</label>
          <input id="ed-score" class="input" type="number" min="0" max="200" step="0.5" bind:value={score} placeholder="—" title="Grade earned, for the grade calculator in Tools" />
        </div>
      </div>
      <div class="field">
        <label for="ed-tags">Tags</label>
        <input id="ed-tags" class="input" bind:value={tags} placeholder="reading, lab" />
      </div>
      <div class="field">
        <label for="ed-notes">Notes (markdown)</label>
        <textarea id="ed-notes" class="textarea" bind:value={notes} placeholder="Details, links, page numbers…"></textarea>
      </div>
      <div class="field">
        <label for="ed-sub">Subtasks</label>
        <ul class="subs">
          {#each subtasks as s, i (s.id)}
            <li>
              <input type="checkbox" bind:checked={s.done} aria-label="Done" />
              <input class="input" bind:value={s.title} aria-label="Subtask title" />
              <button type="button" class="btn ghost sm icon" aria-label="Remove" onclick={() => (subtasks = subtasks.filter((_, j) => j !== i))}>×</button>
            </li>
          {/each}
        </ul>
        <div class="addsub">
          <input id="ed-sub" class="input" bind:value={newSub} placeholder="Add subtask" onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }} />
          <button type="button" class="btn sm" onclick={addSub}>Add</button>
        </div>
      </div>
      <div class="field">
        <label for="ed-rec">Repeat</label>
        <div class="row">
          <select id="ed-rec" class="select" bind:value={recKind}>
            <option value="">Never</option>
            <option value="daily">Every day</option>
            <option value="weekdays">Weekdays</option>
            <option value="weekly">Weekly on…</option>
            <option value="everyNDays">Every N days</option>
          </select>
          {#if recKind === 'everyNDays'}
            <input class="input" type="number" min="1" bind:value={recN} aria-label="Every N days" />
          {/if}
          {#if recKind}
            <input class="input" type="date" bind:value={recUntil} aria-label="Until" title="Repeat until" />
          {/if}
        </div>
        {#if recKind === 'weekly'}
          <div class="days">
            {#each ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as d, i}
              <button type="button" class="day" class:on={recDays.includes(i)} onclick={() => toggleDay(i)} aria-pressed={recDays.includes(i)} aria-label={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]}>{d}</button>
            {/each}
          </div>
        {/if}
      </div>
      {#if showTemplate}
        <div class="field tpl">
          <label for="ed-tpl">Template name</label>
          <div class="row">
            <input id="ed-tpl" class="input" bind:value={templateName} placeholder={title.trim().replace(/\s+/g, '-').toLowerCase()} />
            <button type="button" class="btn" onclick={saveAsTemplate}>Save template</button>
          </div>
        </div>
      {/if}
      <div class="actions">
        <button type="button" class="btn ghost" onclick={() => (showTemplate = !showTemplate)}>Save as template</button>
        <button type="button" class="btn danger" onclick={del}>Delete</button>
        <span class="grow"></span>
        <button type="button" class="btn" onclick={onclose}>Cancel</button>
        <button type="submit" class="btn primary">Save <span class="kbd">⌘↵</span></button>
      </div>
    {/if}
  </form>
</div>

<style>
  .title {
    font-size: 17px;
    font-weight: 600;
  }
  .subs {
    list-style: none;
    margin: 0 0 6px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .subs li {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .subs input[type='checkbox'] {
    accent-color: var(--accent);
  }
  .addsub {
    display: flex;
    gap: 6px;
  }
  .days {
    display: flex;
    gap: 4px;
    margin-top: 6px;
  }
  .day {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid var(--border);
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
  }
  .day.on {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }
  .grow {
    flex: 1;
  }
  .tpl {
    background: var(--bg-elev-2);
    padding: 10px;
    border-radius: 8px;
  }
  .actions {
    flex-wrap: wrap;
  }
</style>
