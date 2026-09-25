<script lang="ts">
  // Grade calculator: upcoming exams, weighted scores per course, and what you need on the rest.
  import { store, byDueThenOrder } from '../../lib/store.svelte';
  import type { Task } from '../../lib/types';
  import { dueKey, diffDays, formatDue } from '../../lib/dates';
  import { formatScale, GRADE_SCALES, gradeTimeline, letterOn, neededOnRemaining, nextLetter, parseScale, scaleFor, summarize, whatIf } from '../../lib/grades';
  import GradeTrend from '../GradeTrend.svelte';
  import type { Course } from '../../lib/types';

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
      const scale = scaleFor(c);
      const timeline = gradeTimeline(
        items
          .filter((t) => typeof t.score === 'number')
          .map((t) => ({ id: t.id, title: t.title, date: t.completedAt ?? t.dueAt ?? t.updatedAt, weight: t.weight!, score: t.score! })),
      );
      return { course: c, items, summary, needed, scale, timeline };
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
  // ---------- letter scales ----------
  let scaleText = $state<Record<string, string>>({});
  function setScale(c: Course, id: string) {
    store.updateCourse(c.id, { gradeScale: id === 'plusminus' ? undefined : id, customScale: id === 'custom' ? (c.customScale ?? scaleFor(c)) : c.customScale });
  }
  function saveCustom(c: Course) {
    const steps = parseScale(scaleText[c.id] ?? '');
    if (steps) store.updateCourse(c.id, { gradeScale: 'custom', customScale: steps });
  }

  // ---------- what if (nothing here is saved) ----------
  let whatIfOpen = $state<Record<string, boolean>>({});
  let imagined = $state<Record<string, Record<number, number | undefined>>>({});
  let extra = $state<Record<string, { weight: string; score: string }>>({});
  function projection(courseId: string, items: Task[]) {
    const e = extra[courseId];
    const ew = parseFloat(e?.weight ?? '');
    const es = parseFloat(e?.score ?? '');
    return whatIf(
      items.map((t) => ({ weight: t.weight!, score: t.score })),
      imagined[courseId] ?? {},
      ew > 0 && Number.isFinite(es) ? [{ weight: ew, score: es }] : [],
    );
  }
  let showTrend = $state<Record<string, boolean>>({});

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
          {@const up = nextLetter(g.summary.current, g.scale)}
          <span class="grade">{g.summary.current.toFixed(1)}% <span class="letter">{letterOn(g.summary.current, g.scale)}</span></span>
          {#if up}<span class="muted small">{(up.min - g.summary.current).toFixed(1)} to {up.letter}</span>{/if}
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
            <span class="ok">Final: {g.summary.floor.toFixed(1)}% ({letterOn(g.summary.floor, g.scale)})</span>
          {:else if g.needed <= 0}
            <span class="ok">✓ {target}% is already locked in</span>
          {:else if g.needed > 100}
            <span class="bad">{target}% is out of reach (needs {g.needed.toFixed(0)}% on the rest); max is {g.summary.ceiling.toFixed(0)}%</span>
          {:else}
            <span class="need">Need <strong>{g.needed.toFixed(1)}%</strong> average on the remaining {g.summary.remainingWeight}% for {target}%</span>
          {/if}
        </div>
        <div class="gtools">
          {#if g.timeline.length >= 2}
            <button class="btn sm ghost" aria-expanded={!!showTrend[g.course.id]} onclick={() => (showTrend[g.course.id] = !showTrend[g.course.id])}>📈 Trend</button>
          {/if}
          <button class="btn sm ghost" aria-expanded={!!whatIfOpen[g.course.id]} onclick={() => (whatIfOpen[g.course.id] = !whatIfOpen[g.course.id])}>🔮 What if…</button>
          <label class="scale"
            >Scale
            <select
              class="select"
              value={g.course.gradeScale ?? 'plusminus'}
              onchange={(e) => setScale(g.course, e.currentTarget.value)}
              aria-label="Letter scale for {g.course.name}"
            >
              {#each GRADE_SCALES as sc (sc.id)}<option value={sc.id}>{sc.label}</option>{/each}
              <option value="custom">Custom…</option>
            </select></label
          >
        </div>
        {#if g.course.gradeScale === 'custom'}
          <div class="custom">
            <input
              class="input"
              value={scaleText[g.course.id] ?? formatScale(g.scale)}
              oninput={(e) => (scaleText[g.course.id] = e.currentTarget.value)}
              onchange={() => saveCustom(g.course)}
              aria-label="Custom scale for {g.course.name}"
              placeholder="A 94, B 85, C 75, D 65, F 0"
            />
            {#if scaleText[g.course.id] && !parseScale(scaleText[g.course.id])}<span class="bad small">Use “letter number” pairs, e.g. A 94, B 85.</span>{/if}
          </div>
        {/if}
        {#if showTrend[g.course.id] && g.timeline.length >= 2}
          <GradeTrend points={g.timeline} color={g.course.color} {target} letter={(p) => letterOn(p, g.scale)} label="{g.course.name} grade trend" />
        {/if}
        {#if whatIfOpen[g.course.id]}
          {@const p = projection(g.course.id, g.items)}
          <div class="whatif" role="group" aria-label="What if for {g.course.name}">
            <p class="muted small">Try scores for work that isn't graded yet. Nothing here is saved.</p>
            {#each g.items as t, i (t.id)}
              {#if typeof t.score !== 'number'}
                <label class="wi"
                  ><span>{t.title} <span class="muted">({t.weight}%)</span></span>
                  <input
                    class="input num"
                    type="number"
                    min="0"
                    max="200"
                    placeholder="?"
                    value={imagined[g.course.id]?.[i] ?? ''}
                    oninput={(e) => {
                      const v = e.currentTarget.value === '' ? undefined : parseFloat(e.currentTarget.value);
                      imagined[g.course.id] = { ...(imagined[g.course.id] ?? {}), [i]: Number.isFinite(v) ? v : undefined };
                    }}
                    aria-label="Imagined score for {t.title}"
                  /></label
                >
              {/if}
            {/each}
            <div class="wi">
              <span>Extra item</span>
              <input
                class="input num"
                type="number"
                min="0"
                max="100"
                placeholder="wt %"
                value={extra[g.course.id]?.weight ?? ''}
                oninput={(e) => (extra[g.course.id] = { score: extra[g.course.id]?.score ?? '', weight: e.currentTarget.value })}
                aria-label="Extra item weight"
              />
              <input
                class="input num"
                type="number"
                min="0"
                max="200"
                placeholder="score"
                value={extra[g.course.id]?.score ?? ''}
                oninput={(e) => (extra[g.course.id] = { weight: extra[g.course.id]?.weight ?? '', score: e.currentTarget.value })}
                aria-label="Extra item score"
              />
            </div>
            <p class="result" role="status">
              {#if p.remainingWeight <= 0}
                Final grade: <strong>{p.floor.toFixed(1)}% {letterOn(p.floor, g.scale)}</strong>
              {:else if p.current !== null}
                Average so far: <strong>{p.current.toFixed(1)}% {letterOn(p.current, g.scale)}</strong>
                <span class="muted">· final between {p.floor.toFixed(0)}% and {p.ceiling.toFixed(0)}% with {p.remainingWeight}% left</span>
              {:else}
                Enter a score to see a projection.
              {/if}
            </p>
            <button
              class="btn sm ghost"
              onclick={() => {
                imagined[g.course.id] = {};
                extra[g.course.id] = { weight: '', score: '' };
              }}>Clear</button
            >
          </div>
        {/if}
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
  .gtools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
  }
  .scale {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-muted);
    margin-left: auto;
  }
  .scale .select {
    width: auto;
    padding: 4px 8px;
    font-size: 12px;
  }
  .custom {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
  }
  .custom .input {
    max-width: 320px;
  }
  .small {
    font-size: 12px;
  }
  .whatif {
    margin-top: 8px;
    padding: 8px 10px;
    border: 1px dashed var(--border);
    border-radius: 10px;
    display: grid;
    gap: 6px;
  }
  .wi {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .wi > span:first-child {
    flex: 1;
  }
  .result {
    margin: 4px 0;
    font-size: 14px;
  }
</style>
