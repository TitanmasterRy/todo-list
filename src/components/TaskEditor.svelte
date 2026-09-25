<script lang="ts">
  import { focusTrap } from '../lib/focusTrap';
  import { store, PRIORITY_LABEL } from '../lib/store.svelte';
  import { PRIORITIES, TASK_TYPES, type Recurrence, type ReminderRule, type Subtask, type Task } from '../lib/types';
  import { REMINDER_PRESETS, ruleKey, ruleLabel } from '../lib/remind';
  import { wouldCycle, dependents } from '../lib/deps';
  import { describeRecurrence } from '../lib/recurrence';
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
  let time = $state(original?.dueAt && !isDateOnly(original.dueAt) ? `${pad(new Date(original.dueAt).getHours())}:${pad(new Date(original.dueAt).getMinutes())}` : '');
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
  let recWeeks = $state(String(original?.recurrence?.kind === 'weekly' ? (original.recurrence.n ?? 1) : 1));
  let recNth = $state(String(original?.recurrence?.nth ?? 1));
  let recWeekday = $state(String(original?.recurrence?.weekday ?? 1));
  let blockedBy = $state<string[]>(original?.blockedBy ? [...original.blockedBy] : []);
  let blockerPick = $state('');
  let reminders = $state<ReminderRule[]>(original?.reminders ? original.reminders.map((r) => ({ ...r })) : []);
  let reminderAt = $state('');
  let spent = $state(original?.timeSpentMin ? String(original.timeSpentMin) : '');
  const blockerChoices = $derived(
    store.openTasks
      .filter((t) => t.id !== taskId && !blockedBy.includes(t.id) && !wouldCycle(taskId, t.id, store.byId))
      .sort((a, b) => (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9'))
      .slice(0, 200),
  );
  const waitingOnMe = $derived(dependents(taskId, store.tasks));
  function addBlocker() {
    if (blockerPick && !blockedBy.includes(blockerPick)) blockedBy = [...blockedBy, blockerPick];
    blockerPick = '';
  }
  function toggleReminder(r: ReminderRule) {
    const k = ruleKey(r);
    reminders = reminders.some((x) => ruleKey(x) === k) ? reminders.filter((x) => ruleKey(x) !== k) : [...reminders, r];
  }
  function addReminderAt() {
    if (!reminderAt) return;
    reminders = [...reminders, { at: new Date(reminderAt).toISOString() }];
    reminderAt = '';
  }
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
      if (recKind === 'weekly') {
        recurrence.days = recDays.length ? recDays : [dateKey ? new Date(dateKey + 'T00:00:00').getDay() : new Date().getDay()];
        const w = Math.max(1, parseInt(recWeeks, 10) || 1);
        if (w > 1) recurrence.n = w;
      }
      if (recKind === 'monthlyNth') {
        recurrence.nth = parseInt(recNth, 10) || 1;
        recurrence.weekday = parseInt(recWeekday, 10) || 0;
      }
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
      blockedBy: blockedBy.length ? blockedBy : undefined,
      reminders: reminders.length ? reminders : undefined,
      timeSpentMin: spent !== '' ? Math.max(0, parseInt(spent, 10) || 0) || undefined : undefined,
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
          <input
            id="ed-score"
            class="input"
            type="number"
            min="0"
            max="200"
            step="0.5"
            bind:value={score}
            placeholder="—"
            title="Grade earned, for the grade calculator in Tools"
          />
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
          <input
            id="ed-sub"
            class="input"
            bind:value={newSub}
            placeholder="Add subtask"
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSub();
              }
            }}
          />
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
            <option value="monthly">Monthly (same date)</option>
            <option value="monthlyNth">Monthly on the…</option>
          </select>
          {#if recKind === 'weekly'}
            <label class="inl">every <input class="input n" type="number" min="1" max="8" bind:value={recWeeks} aria-label="Every N weeks" /> wk</label>
          {/if}
          {#if recKind === 'monthlyNth'}
            <select class="select" bind:value={recNth} aria-label="Which week">
              <option value="1">1st</option><option value="2">2nd</option><option value="3">3rd</option><option value="4">4th</option><option value="-1">last</option>
            </select>
            <select class="select" bind:value={recWeekday} aria-label="Weekday">
              {#each ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as d, i (d)}<option value={String(i)}>{d}</option>{/each}
            </select>
          {/if}
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
              <button
                type="button"
                class="day"
                class:on={recDays.includes(i)}
                onclick={() => toggleDay(i)}
                aria-pressed={recDays.includes(i)}
                aria-label={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]}>{d}</button
              >
            {/each}
          </div>
        {/if}
      </div>
      {#if original.recurrence}
        <div class="skip">
          <span class="muted">{describeRecurrence(original.recurrence)}</span>
          <button
            type="button"
            class="btn sm"
            onclick={() => {
              store.skipOccurrence(taskId);
              onclose();
            }}>Skip this one</button
          >
        </div>
      {/if}
      <div class="field">
        <label for="ed-block">Waiting on</label>
        {#if blockedBy.length}
          <ul class="chips">
            {#each blockedBy as id (id)}
              {@const b = store.taskById(id)}
              <li class="chip" class:done={!!b?.completedAt}>
                {b ? b.title : 'Deleted task'}{b?.completedAt ? ' ✓' : ''}
                <button type="button" class="x" onclick={() => (blockedBy = blockedBy.filter((x) => x !== id))} aria-label="Remove {b?.title ?? 'task'}">×</button>
              </li>
            {/each}
          </ul>
        {/if}
        <div class="addsub">
          <select id="ed-block" class="select" bind:value={blockerPick} aria-label="Task that must be done first">
            <option value="">Pick a task that must be done first…</option>
            {#each blockerChoices as t (t.id)}<option value={t.id}>{t.title}{t.dueAt ? ` · ${t.dueAt.slice(5, 10)}` : ''}</option>{/each}
          </select>
          <button type="button" class="btn sm" onclick={addBlocker} disabled={!blockerPick}>Add</button>
        </div>
        {#if waitingOnMe.length}<p class="muted">Finishing this unblocks: {waitingOnMe.map((t) => t.title).join(', ')}</p>{/if}
      </div>
      <div class="field">
        <span class="lbl" id="ed-rem-l">Reminders</span>
        <div class="chips" role="group" aria-labelledby="ed-rem-l">
          {#each REMINDER_PRESETS as p (p.label)}
            <button
              type="button"
              class="chip pick"
              class:on={reminders.some((r) => ruleKey(r) === ruleKey(p.rule))}
              aria-pressed={reminders.some((r) => ruleKey(r) === ruleKey(p.rule))}
              onclick={() => toggleReminder(p.rule)}
              disabled={!dateKey}>{p.label}</button
            >
          {/each}
          {#each reminders.filter((r) => 'at' in r) as r (ruleKey(r))}
            <span class="chip on">{ruleLabel(r)} <button type="button" class="x" onclick={() => toggleReminder(r)} aria-label="Remove reminder">×</button></span>
          {/each}
        </div>
        <div class="addsub">
          <input class="input" type="datetime-local" bind:value={reminderAt} aria-label="Remind me at" />
          <button type="button" class="btn sm" onclick={addReminderAt} disabled={!reminderAt}>Add time</button>
        </div>
        {#if !dateKey}<p class="muted">Set a due date to use reminders relative to it.</p>{/if}
      </div>
      <div class="field">
        <label for="ed-spent">Time spent (min)</label>
        <input id="ed-spent" class="input n2" type="number" min="0" step="5" bind:value={spent} placeholder="0" />
        <span class="muted">Tracked by the task timer and Focus Pomodoros.</span>
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
    color: var(--accent-contrast, #fff);
    border-color: var(--accent);
  }
  .grow {
    flex: 1;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    list-style: none;
    margin: 0 0 6px;
    padding: 0;
  }
  .chip.pick.on,
  .chips .chip.on {
    background: var(--accent);
    color: var(--accent-contrast, #fff);
    border-color: transparent;
  }
  .chip.done {
    text-decoration: line-through;
    color: var(--text-muted);
  }
  .x {
    background: none;
    padding: 0 0 0 4px;
    color: inherit;
    font-weight: 700;
  }
  .muted {
    font-size: 12px;
    color: var(--text-muted);
  }
  .lbl {
    display: block;
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 4px;
  }
  .inl {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .n {
    width: 60px;
  }
  .n2 {
    width: 110px;
  }
  .skip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    background: var(--bg-elev-2);
    padding: 8px 10px;
    border-radius: 8px;
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
