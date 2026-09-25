<script lang="ts">
  // Grade calculator: upcoming exams, weighted scores per course, and what you need on the rest.
  import { store, byDueThenOrder } from '../../lib/store.svelte';
  import type { Task } from '../../lib/types';
  import { dueKey, diffDays, formatDue } from '../../lib/dates';
  import { letterGrade, neededOnRemaining, summarize } from '../../lib/grades';

  const target = $derived(store.settings.targetGrade || 90);
  function setTarget(e: Event) {
    store.updateSettings({ targetGrade: Math.max(1, Math.min(100, Number((e.target as HTMLInputElement).value) || 90)) });
  }
  const gradeCourses = $derived(
    store.activeCourses.map((c) => {
      const items = store.tasks.filter((t) => t.courseId === c.id && (t.weight ?? 0) > 0 && !t.archived).sort(byDueThenOrder);
      const summary = summarize(items.map((t) => ({ weight: t.weight!, score: t.score })));
      const needed = neededOnRemaining(
        items.map((t) => ({ weight: t.weight!, score: t.score })),
        target,
      );
      return { course: c, items, summary, needed };
    }),
  );
  function setScore(t: Task, e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    const v = raw === '' ? undefined : Math.max(0, Math.min(200, parseFloat(raw)));
    if (v === t.score || (v !== undefined && Number.isNaN(v))) return;
    store.updateTask(t.id, { score: v }, { undoable: true, label: `Scored “${t.title}”` });
  }
  function setWeight(t: Task, e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    const v = raw === '' ? undefined : Math.max(0, Math.min(100, parseFloat(raw)));
    if (v === t.weight) return;
    store.updateTask(t.id, { weight: v }, { undoable: true, label: `Changed weight of “${t.title}”` });
  }
  const exams = $derived(
    store.openTasks
      .filter((t) => (t.type === 'exam' || t.type === 'quiz') && t.dueAt)
      .sort(byDueThenOrder)
      .map((t) => ({ t, days: diffDays(store.today, dueKey(t.dueAt!)) })),
  );
  let newGraded = $state<{ courseId: string; title: string; weight: string }>({ courseId: '', title: '', weight: '' });
  function addGraded(e: Event) {
    e.preventDefault();
    if (!newGraded.title.trim() || !newGraded.courseId) return;
    store.addTask({ title: newGraded.title.trim(), courseId: newGraded.courseId, weight: parseFloat(newGraded.weight) || undefined, type: 'exam' });
    newGraded = { courseId: newGraded.courseId, title: '', weight: '' };
  }
</script>

{#if exams.length}
  <div class="exams">
    {#each exams.slice(0, 6) as { t, days } (t.id)}
      <div class="exam card" class:soon={days <= 3}>
        <div class="days">{days === 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`}</div>
        <div class="et">{t.type === 'exam' ? '📝' : '❓'} {t.title}</div>
        <div class="muted">{store.courseById(t.courseId)?.name ?? ''}{t.weight ? ` · ${t.weight}%` : ''}</div>
      </div>
    {/each}
  </div>
{/if}
<section class="card">
  <div class="row-head">
    <h2>Grade calculator</h2>
    <label class="cap">Target <input class="input num" type="number" min="1" max="100" value={target} onchange={setTarget} aria-label="Target grade" /> %</label>
  </div>
  <p class="help">
    Give tasks a <strong>weight %</strong> (task editor, or the form below) and enter the <strong>score</strong> you got. Unweighted remainder counts as “not graded yet”.
  </p>
  {#if !store.activeCourses.length}
    <p class="muted">Add a course first.</p>
  {/if}
  {#each gradeCourses as g (g.course.id)}
    <div class="course" style="--course:{g.course.color}">
      <div class="c-head">
        <span class="dot"></span>
        <strong>{g.course.emoji ?? ''} {g.course.name}</strong>
        {#if g.summary.current !== null}
          <span class="grade">{g.summary.current.toFixed(1)}% <span class="letter">{letterGrade(g.summary.current)}</span></span>
        {:else}
          <span class="muted">no scores yet</span>
        {/if}
      </div>
      {#if g.items.length}
        <table>
          <thead><tr><th>Item</th><th>Weight %</th><th>Score %</th></tr></thead>
          <tbody>
            {#each g.items as t (t.id)}
              <tr class:done={!!t.completedAt}>
                <td
                  ><button class="link-title" onclick={() => (store.editingTaskId = t.id)}>{t.title}</button>{#if t.dueAt}<span class="muted">
                      · {formatDue(t.dueAt, store.now)}</span
                    >{/if}</td
                >
                <td><input class="input num" type="number" min="0" max="100" value={t.weight ?? ''} onchange={(e) => setWeight(t, e)} aria-label="Weight" /></td>
                <td
                  ><input
                    class="input num"
                    type="number"
                    min="0"
                    max="200"
                    step="0.5"
                    value={t.score ?? ''}
                    placeholder="—"
                    onchange={(e) => setScore(t, e)}
                    aria-label="Score"
                  /></td
                >
              </tr>
            {/each}
          </tbody>
        </table>
        <div class="outlook">
          <span>Graded {g.summary.gradedWeight}% of {g.summary.totalWeight}%</span>
          <span>Range {g.summary.floor.toFixed(0)}–{g.summary.ceiling.toFixed(0)}%</span>
          {#if g.needed === null}
            <span class="ok">Final: {g.summary.floor.toFixed(1)}% ({letterGrade(g.summary.floor)})</span>
          {:else if g.needed <= 0}
            <span class="ok">✓ {target}% is already locked in</span>
          {:else if g.needed > 100}
            <span class="bad">{target}% is out of reach (needs {g.needed.toFixed(0)}% on the rest); max is {g.summary.ceiling.toFixed(0)}%</span>
          {:else}
            <span class="need">Need <strong>{g.needed.toFixed(1)}%</strong> average on the remaining {g.summary.remainingWeight}% for {target}%</span>
          {/if}
        </div>
      {:else}
        <p class="muted">No weighted items yet.</p>
      {/if}
    </div>
  {/each}
  {#if store.activeCourses.length}
    <form class="addg" onsubmit={addGraded}>
      <select class="select" bind:value={newGraded.courseId} aria-label="Course">
        <option value="">Course…</option>
        {#each store.activeCourses as c (c.id)}<option value={c.id}>{c.emoji ?? ''} {c.name}</option>{/each}
      </select>
      <input class="input" bind:value={newGraded.title} placeholder="Graded item, e.g. Midterm" aria-label="Title" />
      <input class="input num" type="number" min="0" max="100" bind:value={newGraded.weight} placeholder="wt %" aria-label="Weight" />
      <button class="btn primary sm" type="submit" disabled={!newGraded.courseId || !newGraded.title.trim()}>Add</button>
    </form>
  {/if}
</section>

<style>
  section {
    margin-bottom: 12px;
  }
  h2 {
    font-size: 16px;
    margin: 0 0 8px;
  }
  .row-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  .cap {
    font-size: 13px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .input.num {
    width: 76px;
    padding: 5px 8px;
  }
  .help {
    font-size: 13px;
    color: var(--text-muted);
    margin: 4px 0 10px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--course);
  }
  .exams {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 8px;
    margin-bottom: 12px;
  }
  .exam {
    padding: 10px 12px;
  }
  .exam.soon {
    border-color: var(--danger);
  }
  .exam .days {
    font-size: 20px;
    font-weight: 800;
  }
  .exam.soon .days {
    color: var(--danger-text);
  }
  .et {
    font-weight: 600;
    font-size: 14px;
  }
  .course {
    border-top: 1px solid var(--border);
    padding: 12px 0;
  }
  .c-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  .grade {
    margin-left: auto;
    font-weight: 700;
  }
  .letter {
    display: inline-block;
    padding: 0 6px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--course) 25%, transparent);
    margin-left: 4px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  th {
    text-align: left;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
    padding: 4px 6px;
  }
  td {
    padding: 3px 6px;
    vertical-align: middle;
  }
  tr.done td:first-child {
    color: var(--text-muted);
  }
  .link-title {
    color: var(--text);
    text-align: left;
    font-weight: 500;
  }
  .link-title:hover {
    color: var(--accent-text);
  }
  .outlook {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    font-size: 13px;
    color: var(--text-muted);
    margin-top: 8px;
  }
  .ok {
    color: var(--success-text);
  }
  .bad {
    color: var(--danger-text);
  }
  .need strong {
    color: var(--text);
  }
  .addg {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }
  .addg .select {
    width: auto;
  }
  .addg .input:not(.num) {
    flex: 1;
    min-width: 160px;
  }
</style>
