<script lang="ts">
  // Grade calculator: upcoming exams, weighted scores per course, and what you need on the rest.
  import { store, byDueThenOrder } from '../../lib/store.svelte';
  import type { Task } from '../../lib/types';
  import { dueKey, diffDays, formatDue } from '../../lib/dates';
  import { formatScale, GRADE_SCALES, gradeTimeline, letterOn, neededOnRemaining, nextLetter, parseScale, scaleFor, summarize, whatIf } from '../../lib/grades';
  import GradeTrend from '../GradeTrend.svelte';
  import type { Course } from '../../lib/types';
  import { hasKey, t, t as tr } from '../../lib/i18n/index.svelte';

  const scaleLabel = (sc: { id: string; label: string }) => {
    const k = `grades.scale.${sc.id}`;
    return hasKey(k) ? t(k) : sc.label;
  };

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
    store.updateTask(t.id, { score: v }, { undoable: true, label: tr('grades.scored', { title: t.title }) });
  }
  function setWeight(t: Task, e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    const v = raw === '' ? undefined : Math.max(0, Math.min(100, parseFloat(raw)));
    if (v === t.weight) return;
    store.updateTask(t.id, { weight: v }, { undoable: true, label: tr('grades.weighted', { title: t.title }) });
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
    {#each exams.slice(0, 6) as { t: ex, days } (ex.id)}
      <div class="exam card" class:soon={days <= 3}>
        <div class="days">{days === 0 ? t('date.today') : t('task.examDays', { count: days })}</div>
        <div class="et">{ex.type === 'exam' ? '📝' : '❓'} {ex.title}</div>
        <div class="muted">{store.courseById(ex.courseId)?.name ?? ''}{ex.weight ? ` · ${ex.weight}%` : ''}</div>
      </div>
    {/each}
  </div>
{/if}
<section class="card">
  <div class="row-head">
    <h2>{t('tools.grades')}</h2>
    <label class="cap"
      >{t('grades.target')} <input class="input num" type="number" min="1" max="100" value={target} onchange={setTarget} aria-label={t('grades.targetLabel')} /> %</label
    >
  </div>
  <p class="help">
    {t('grades.help')}
  </p>
  {#if !store.activeCourses.length}
    <p class="muted">{t('grades.addCourse')}</p>
  {/if}
  {#each gradeCourses as g (g.course.id)}
    <div class="course" style="--course:{g.course.color}">
      <div class="c-head">
        <span class="dot"></span>
        <strong>{g.course.emoji ?? ''} {g.course.name}</strong>
        {#if g.summary.current !== null}
          {@const up = nextLetter(g.summary.current, g.scale)}
          <span class="grade">{g.summary.current.toFixed(1)}% <span class="letter">{letterOn(g.summary.current, g.scale)}</span></span>
          {#if up}<span class="muted small">{t('grades.toNext', { n: (up.min - g.summary.current).toFixed(1), letter: up.letter })}</span>{/if}
        {:else}
          <span class="muted">{t('grades.noScores')}</span>
        {/if}
      </div>
      {#if g.items.length}
        <table>
          <thead><tr><th>{t('grades.item')}</th><th>{t('editor.weight')}</th><th>{t('editor.score')}</th></tr></thead>
          <tbody>
            {#each g.items as it (it.id)}
              <tr class:done={!!it.completedAt}>
                <td
                  ><button class="link-title" onclick={() => (store.editingTaskId = it.id)}>{it.title}</button>{#if it.dueAt}<span class="muted">
                      · {formatDue(it.dueAt, store.now)}</span
                    >{/if}</td
                >
                <td><input class="input num" type="number" min="0" max="100" value={it.weight ?? ''} onchange={(e) => setWeight(it, e)} aria-label={t('grades.weight')} /></td>
                <td
                  ><input
                    class="input num"
                    type="number"
                    min="0"
                    max="200"
                    step="0.5"
                    value={it.score ?? ''}
                    placeholder="—"
                    onchange={(e) => setScore(it, e)}
                    aria-label={t('grades.score')}
                  /></td
                >
              </tr>
            {/each}
          </tbody>
        </table>
        <div class="outlook">
          <span>{t('grades.graded', { done: g.summary.gradedWeight, total: g.summary.totalWeight })}</span>
          <span>{t('grades.range', { lo: g.summary.floor.toFixed(0), hi: g.summary.ceiling.toFixed(0) })}</span>
          {#if g.needed === null}
            <span class="ok">{t('grades.final', { pct: g.summary.floor.toFixed(1), letter: letterOn(g.summary.floor, g.scale) })}</span>
          {:else if g.needed <= 0}
            <span class="ok">✓ {t('grades.locked', { target })}</span>
          {:else if g.needed > 100}
            <span class="bad">{t('grades.outOfReach', { target, need: g.needed.toFixed(0), max: g.summary.ceiling.toFixed(0) })}</span>
          {:else}
            {@const parts = t('grades.need', { rest: g.summary.remainingWeight, target }).split('{need}')}
            <span class="need">{parts[0]}<strong>{g.needed.toFixed(1)}%</strong>{parts[1]}</span>
          {/if}
        </div>
        <div class="gtools">
          {#if g.timeline.length >= 2}
            <button class="btn sm ghost" aria-expanded={!!showTrend[g.course.id]} onclick={() => (showTrend[g.course.id] = !showTrend[g.course.id])}>📈 {t('grades.trend')}</button>
          {/if}
          <button class="btn sm ghost" aria-expanded={!!whatIfOpen[g.course.id]} onclick={() => (whatIfOpen[g.course.id] = !whatIfOpen[g.course.id])}
            >🔮 {t('grades.whatIf')}</button
          >
          <label class="scale"
            >{t('grades.scale')}
            <select
              class="select"
              value={g.course.gradeScale ?? 'plusminus'}
              onchange={(e) => setScale(g.course, e.currentTarget.value)}
              aria-label={t('grades.scaleFor', { name: g.course.name })}
            >
              {#each GRADE_SCALES as sc (sc.id)}<option value={sc.id}>{scaleLabel(sc)}</option>{/each}
              <option value="custom">{t('grades.custom')}</option>
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
              aria-label={t('grades.customFor', { name: g.course.name })}
              placeholder="A 94, B 85, C 75, D 65, F 0"
            />
            {#if scaleText[g.course.id] && !parseScale(scaleText[g.course.id])}<span class="bad small">{t('grades.customHelp')}</span>{/if}
          </div>
        {/if}
        {#if showTrend[g.course.id] && g.timeline.length >= 2}
          <GradeTrend points={g.timeline} color={g.course.color} {target} letter={(p) => letterOn(p, g.scale)} label={t('grades.trendOf', { name: g.course.name })} />
        {/if}
        {#if whatIfOpen[g.course.id]}
          {@const p = projection(g.course.id, g.items)}
          <div class="whatif" role="group" aria-label={t('grades.whatIfFor', { name: g.course.name })}>
            <p class="muted small">{t('grades.whatIfHelp')}</p>
            {#each g.items as it, i (it.id)}
              {#if typeof it.score !== 'number'}
                <label class="wi"
                  ><span>{it.title} <span class="muted">({it.weight}%)</span></span>
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
                    aria-label={t('grades.imagined', { title: it.title })}
                  /></label
                >
              {/if}
            {/each}
            <div class="wi">
              <span>{t('grades.extra')}</span>
              <input
                class="input num"
                type="number"
                min="0"
                max="100"
                placeholder={t('grades.wt')}
                value={extra[g.course.id]?.weight ?? ''}
                oninput={(e) => (extra[g.course.id] = { score: extra[g.course.id]?.score ?? '', weight: e.currentTarget.value })}
                aria-label={t('grades.extraWeight')}
              />
              <input
                class="input num"
                type="number"
                min="0"
                max="200"
                placeholder={t('grades.scorePh')}
                value={extra[g.course.id]?.score ?? ''}
                oninput={(e) => (extra[g.course.id] = { weight: extra[g.course.id]?.weight ?? '', score: e.currentTarget.value })}
                aria-label={t('grades.extraScore')}
              />
            </div>
            <p class="result" role="status">
              {#if p.remainingWeight <= 0}
                {t('grades.finalGrade')} <strong>{p.floor.toFixed(1)}% {letterOn(p.floor, g.scale)}</strong>
              {:else if p.current !== null}
                {t('grades.soFar')} <strong>{p.current.toFixed(1)}% {letterOn(p.current, g.scale)}</strong>
                <span class="muted">· {t('grades.between', { lo: p.floor.toFixed(0), hi: p.ceiling.toFixed(0), left: p.remainingWeight })}</span>
              {:else}
                {t('grades.enterScore')}
              {/if}
            </p>
            <button
              class="btn sm ghost"
              onclick={() => {
                imagined[g.course.id] = {};
                extra[g.course.id] = { weight: '', score: '' };
              }}>{t('inbox.clear')}</button
            >
          </div>
        {/if}
      {:else}
        <p class="muted">{t('grades.noItems')}</p>
      {/if}
    </div>
  {/each}
  {#if store.activeCourses.length}
    <form class="addg" onsubmit={addGraded}>
      <select class="select" bind:value={newGraded.courseId} aria-label={t('inbox.course')}>
        <option value="">{t('bulk.course')}</option>
        {#each store.activeCourses as c (c.id)}<option value={c.id}>{c.emoji ?? ''} {c.name}</option>{/each}
      </select>
      <input class="input" bind:value={newGraded.title} placeholder={t('grades.newPh')} aria-label={t('editor.title')} />
      <input class="input num" type="number" min="0" max="100" bind:value={newGraded.weight} placeholder={t('grades.wt')} aria-label={t('grades.weight')} />
      <button class="btn primary sm" type="submit" disabled={!newGraded.courseId || !newGraded.title.trim()}>{t('common.add')}</button>
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
