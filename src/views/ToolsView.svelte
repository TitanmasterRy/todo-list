<script lang="ts">
  import { store, byDueThenOrder } from '../lib/store.svelte';
  import { toasts } from '../lib/toast.svelte';
  import type { Task } from '../lib/types';
  import { addDaysKey, dueKey, diffDays, formatDue, formatMinutes, fromKey, DAY_SHORT, MONTH_SHORT } from '../lib/dates';
  import { letterGrade, neededOnRemaining, summarize } from '../lib/grades';
  import { buildICS } from '../lib/ics';
  import { downloadText } from '../lib/download';

  import CalculatorTool from '../components/tools/CalculatorTool.svelte';
  import GraphTool from '../components/tools/GraphTool.svelte';
  import NotecardsTool from '../components/tools/NotecardsTool.svelte';
  import TranscriptTool from '../components/tools/TranscriptTool.svelte';
  import StudyHelpTool from '../components/tools/StudyHelpTool.svelte';
  import { ui } from '../lib/ui.svelte';

  import ScanTool from '../components/tools/ScanTool.svelte';

  type Tab =
    'grades' | 'planner' | 'calendar' | 'reading' | 'calculator' | 'graph' | 'notecards' | 'study' | 'transcript' | 'scan' | 'reader' | 'code' | 'google' | 'quiz' | 'powerschool';
  type Group = 'plan' | 'grades' | 'study' | 'compute' | 'connect';
  let tab = $state<Tab>((ui.toolsTab as Tab) || 'planner');
  $effect(() => {
    ui.toolsTab = tab;
  });
  const tabs: { id: Tab; label: string; icon: string; group: Group }[] = [
    { id: 'planner', label: 'Plan my day', icon: '🗓️', group: 'plan' },
    { id: 'reading', label: 'Reading time', icon: '📖', group: 'plan' },
    { id: 'calendar', label: 'Calendar export', icon: '📆', group: 'plan' },
    { id: 'grades', label: 'Grade calculator', icon: '🎯', group: 'grades' },
    { id: 'transcript', label: 'Transcript', icon: '🎓', group: 'grades' },
    { id: 'powerschool', label: 'PowerSchool import', icon: '🏫', group: 'grades' },
    { id: 'notecards', label: 'Notecards', icon: '🃏', group: 'study' },
    { id: 'quiz', label: 'Quiz maker', icon: '🎮', group: 'study' },
    { id: 'scan', label: 'Scan paper', icon: '📷', group: 'study' },
    { id: 'reader', label: 'Book reader', icon: '📚', group: 'study' },
    { id: 'study', label: 'Study help', icon: '💡', group: 'study' },
    { id: 'calculator', label: 'Calculator', icon: '🧮', group: 'compute' },
    { id: 'graph', label: 'Graphing', icon: '📈', group: 'compute' },
    { id: 'code', label: 'Code editor', icon: '💻', group: 'compute' },
    { id: 'google', label: 'Google (Gmail, Classroom, Calendar, Drive)', icon: '🟢', group: 'connect' },
  ];
  const groups: { id: Group; label: string }[] = [
    { id: 'plan', label: 'Plan' },
    { id: 'grades', label: 'Grades' },
    { id: 'study', label: 'Study' },
    { id: 'compute', label: 'Compute' },
    { id: 'connect', label: 'Connect' },
  ];
  const currentGroup = $derived(tabs.find((t) => t.id === tab)?.group ?? 'plan');
  // follows the selected tab, and can also be set directly by the group buttons
  let group = $derived<Group>(currentGroup);

  // ---------- Planner ----------
  const capacity = $derived(store.settings.dailyCapacityMin || 180);
  const committed = $derived(store.todayEstimateMin);
  const unestimatedToday = $derived(store.todayTasks.filter((t) => !t.estimateMin).length);
  const week = $derived(
    Array.from({ length: 7 }, (_, i) => addDaysKey(store.today, i)).map((k) => {
      const tasks = store.openTasks.filter((t) => (t.dueAt && dueKey(t.dueAt) === k) || (t.pinnedDay === k && k === store.today && !(t.dueAt && dueKey(t.dueAt) <= k)));
      const min = tasks.reduce((a, t) => a + (t.estimateMin ?? 0), 0);
      return { key: k, tasks, min, over: min > capacity };
    }),
  );
  const candidates = $derived(
    store.openTasks.filter((t) => t.dueAt && dueKey(t.dueAt) > store.today && dueKey(t.dueAt) <= addDaysKey(store.today, 14) && t.pinnedDay !== store.today).sort(byDueThenOrder),
  );
  const planned = $derived(store.pinnedTodayTasks.filter((t) => t.dueAt));
  const remaining = $derived(capacity - committed);

  function setCapacity(e: Event) {
    const v = Math.max(15, Math.min(24 * 60, Number((e.target as HTMLInputElement).value) || 180));
    store.updateSettings({ dailyCapacityMin: v });
  }
  function autoFill() {
    let left = remaining;
    const ids: string[] = [];
    for (const t of candidates) {
      const est = t.estimateMin ?? 30;
      if (est <= left) {
        ids.push(t.id);
        left -= est;
      }
      if (left < 15) break;
    }
    if (!ids.length) {
      toasts.push({ message: 'Nothing fits in the remaining time', kind: 'info' });
      return;
    }
    store.bulkUpdate(ids, { pinnedDay: store.today }, `Planned ${ids.length} task${ids.length > 1 ? 's' : ''} for today`);
  }

  // ---------- Grades ----------
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

  // ---------- Reading ----------
  let mode = $state<'pages' | 'words'>('pages');
  let from = $state('');
  let to = $state('');
  let pages = $state('');
  let minPerPage = $state('3');
  let words = $state('');
  let wpm = $state('200');
  let readCourse = $state('');
  let readDue = $state('');
  let readTitle = $state('');
  const pageCount = $derived.by(() => {
    if (from && to) return Math.max(0, parseInt(to, 10) - parseInt(from, 10) + 1);
    return Math.max(0, parseInt(pages, 10) || 0);
  });
  const readMinutes = $derived(
    mode === 'pages' ? Math.round(pageCount * (parseFloat(minPerPage) || 0)) : Math.round((parseInt(words, 10) || 0) / Math.max(1, parseInt(wpm, 10) || 200)),
  );
  const pomodoros = $derived(Math.ceil(readMinutes / Math.max(1, store.settings.pomodoroWorkMin)));
  const suggestedTitle = $derived(from && to ? `Read pp. ${from}–${to}` : pageCount ? `Read ${pageCount} pages` : words ? 'Reading' : '');
  function createReading() {
    const title = readTitle.trim() || suggestedTitle;
    if (!title || !readMinutes) return;
    store.addTask({ title, courseId: readCourse || undefined, estimateMin: readMinutes, type: 'reading', dueAt: readDue || undefined, tags: ['reading'] });
    readTitle = '';
  }

  // ---------- Calendar ----------
  let includeDone = $state(false);
  let horizon = $state<'all' | '30' | '90'>('all');
  const calTasks = $derived(
    store.tasks.filter((t) => {
      if (!t.dueAt || t.archived) return false;
      if (!includeDone && t.completedAt) return false;
      if (horizon !== 'all' && dueKey(t.dueAt) > addDaysKey(store.today, Number(horizon))) return false;
      return true;
    }),
  );
  function exportICS() {
    downloadText('homework-todo.ics', buildICS(calTasks, store.courses), 'text/calendar');
    toasts.push({
      message: `Exported ${calTasks.length} event${calTasks.length === 1 ? '' : 's'}`,
      detail: 'Import homework-todo.ics into your calendar app.',
      kind: 'success',
      emoji: '📆',
    });
  }
  const dayLabel = (k: string) => {
    const d = fromKey(k);
    return `${DAY_SHORT[d.getDay()]} ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
  };
</script>

<div class="page">
  <header class="page-head">
    <div>
      <h1>Tools</h1>
      <div class="sub">Little helpers for planning, grades, reading and calendars.</div>
    </div>
  </header>

  <div class="groups" role="tablist" aria-label="Tool groups">
    {#each groups as g (g.id)}
      <button
        role="tab"
        aria-selected={group === g.id}
        class:on={group === g.id}
        onclick={() => {
          group = g.id;
          const first = tabs.find((t) => t.group === g.id);
          if (first && tabs.find((t) => t.id === tab)?.group !== g.id) tab = first.id;
        }}>{g.label}</button
      >
    {/each}
  </div>
  <div class="tabs" role="tablist" aria-label="Tools">
    {#each tabs.filter((t) => t.group === group) as t (t.id)}
      <button role="tab" aria-selected={tab === t.id} class:on={tab === t.id} onclick={() => (tab = t.id)}><span aria-hidden="true">{t.icon}</span> {t.label}</button>
    {/each}
  </div>

  {#if tab === 'planner'}
    <section class="card">
      <div class="row-head">
        <h2>Today’s capacity</h2>
        <label class="cap"
          >I can do <input class="input num" type="number" min="15" step="15" value={capacity} onchange={setCapacity} aria-label="Daily capacity in minutes" /> min of homework a day</label
        >
      </div>
      <div class="capbar" class:over={committed > capacity}>
        <div class="fill" style="width:{Math.min(100, (committed / capacity) * 100)}%"></div>
        <span class="lbl"
          >{formatMinutes(committed)} of {formatMinutes(capacity)}{committed > capacity
            ? ` · ${formatMinutes(committed - capacity)} over`
            : remaining > 0
              ? ` · ${formatMinutes(remaining)} free`
              : ' · full'}</span
        >
      </div>
      {#if unestimatedToday}
        <p class="help">
          {unestimatedToday} task{unestimatedToday > 1 ? 's' : ''} on today’s list {unestimatedToday > 1 ? 'have' : 'has'} no estimate, so the bar is optimistic. Add
          <code>~30m</code> style estimates for a truer picture.
        </p>
      {/if}
      <div class="week" aria-label="Next 7 days load">
        {#each week as d (d.key)}
          <div class="day" class:over={d.over} class:today={d.key === store.today} title="{formatMinutes(d.min)} on {dayLabel(d.key)}">
            <div class="bar"><div class="fill" style="height:{Math.min(100, (d.min / capacity) * 100)}%"></div></div>
            <span class="dl">{DAY_SHORT[fromKey(d.key).getDay()]}</span>
            <span class="dm">{d.min ? formatMinutes(d.min) : ''}</span>
          </div>
        {/each}
      </div>
      {#if week.some((d) => d.over)}
        <p class="warn">
          ⚠ {week
            .filter((d) => d.over)
            .map((d) => dayLabel(d.key))
            .join(', ')}
          {week.filter((d) => d.over).length > 1 ? 'are' : 'is'} over capacity. Pull some of that work into earlier days below.
        </p>
      {/if}
    </section>

    <section class="card">
      <div class="row-head">
        <h2>Pull work forward</h2>
        <button class="btn sm" onclick={autoFill} disabled={!candidates.length || remaining < 15}>Auto-fill free time</button>
      </div>
      <p class="help">Planning a task for today keeps its deadline. It shows up in Today under “Planned for today”.</p>
      {#if planned.length}
        <ul class="list">
          {#each planned as t (t.id)}
            <li>
              <span class="dot" style="background:{store.courseById(t.courseId)?.color ?? 'var(--border-strong)'}"></span>
              <span class="grow"
                >{t.title}
                <span class="muted">· due {formatDue(t.dueAt, store.now, store.settings.timeFormat)}{t.estimateMin ? ` · ${formatMinutes(t.estimateMin)}` : ''}</span></span
              >
              <button class="btn ghost sm" onclick={() => store.unpinToday(t.id)}>Remove</button>
            </li>
          {/each}
        </ul>
      {/if}
      {#if !candidates.length}
        <p class="muted">Nothing due in the next two weeks to pull forward.</p>
      {:else}
        <ul class="list">
          {#each candidates as t (t.id)}
            <li>
              <span class="dot" style="background:{store.courseById(t.courseId)?.color ?? 'var(--border-strong)'}"></span>
              <span class="grow"
                >{t.title}
                <span class="muted">· due {formatDue(t.dueAt, store.now, store.settings.timeFormat)}{t.estimateMin ? ` · ${formatMinutes(t.estimateMin)}` : ' · no estimate'}</span
                ></span
              >
              <button class="btn sm" onclick={() => store.pinToToday(t.id)}>+ Today</button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {:else if tab === 'grades'}
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
  {:else if tab === 'calculator'}
    <CalculatorTool />
  {:else if tab === 'graph'}
    <GraphTool />
  {:else if tab === 'notecards'}
    <NotecardsTool />
  {:else if tab === 'study'}
    <StudyHelpTool />
  {:else if tab === 'transcript'}
    <TranscriptTool />
  {:else if tab === 'scan'}
    <ScanTool />
  {:else if tab === 'reader'}
    {#await import('../components/tools/ReaderTool.svelte')}
      <div class="card muted">Loading reader…</div>
    {:then m}
      <m.default />
    {/await}
  {:else if tab === 'code'}
    {#await import('../components/tools/CodeTool.svelte')}
      <div class="card muted">Loading editor…</div>
    {:then m}
      <m.default />
    {/await}
  {:else if tab === 'google'}
    {#await import('../components/GoogleTools.svelte')}
      <div class="card muted">Loading…</div>
    {:then m}
      <m.default />
    {/await}
  {:else if tab === 'quiz'}
    {#await import('../components/tools/QuizMakerTool.svelte')}
      <div class="card muted">Loading…</div>
    {:then m}
      <m.default />
    {/await}
  {:else if tab === 'powerschool'}
    {#await import('../components/tools/PowerSchoolTool.svelte')}
      <div class="card muted">Loading…</div>
    {:then m}
      <m.default />
    {/await}
  {:else if tab === 'reading'}
    <section class="card">
      <h2>Reading time</h2>
      <p class="help">Estimate how long a reading will take, then create the task with the estimate filled in.</p>
      <div class="modes" role="tablist">
        <button role="tab" aria-selected={mode === 'pages'} class:on={mode === 'pages'} onclick={() => (mode = 'pages')}>Pages</button>
        <button role="tab" aria-selected={mode === 'words'} class:on={mode === 'words'} onclick={() => (mode = 'words')}>Words</button>
      </div>
      {#if mode === 'pages'}
        <div class="grid2">
          <label>From page <input class="input" type="number" min="1" bind:value={from} placeholder="112" /></label>
          <label>To page <input class="input" type="number" min="1" bind:value={to} placeholder="140" /></label>
          <label>or page count <input class="input" type="number" min="1" bind:value={pages} placeholder="28" disabled={!!(from && to)} /></label>
          <label
            >Minutes per page
            <select class="select" bind:value={minPerPage}>
              <option value="1.5">1.5 · novel / easy</option>
              <option value="2">2 · light textbook</option>
              <option value="3">3 · textbook</option>
              <option value="4">4 · dense textbook</option>
              <option value="6">6 · journal article, notes</option>
            </select>
          </label>
        </div>
      {:else}
        <div class="grid2">
          <label>Words <input class="input" type="number" min="1" bind:value={words} placeholder="5000" /></label>
          <label
            >Words per minute
            <select class="select" bind:value={wpm}>
              <option value="250">250 · skim</option>
              <option value="200">200 · normal</option>
              <option value="120">120 · study, taking notes</option>
            </select>
          </label>
        </div>
      {/if}
      <div class="result">
        <div class="big">{readMinutes ? formatMinutes(readMinutes) : '—'}</div>
        {#if readMinutes}<div class="muted">≈ {pomodoros} pomodoro{pomodoros === 1 ? '' : 's'} of {store.settings.pomodoroWorkMin} min</div>{/if}
      </div>
      <div class="grid2">
        <label>Title <input class="input" bind:value={readTitle} placeholder={suggestedTitle || 'Read chapter 4'} /></label>
        <label
          >Course
          <select class="select" bind:value={readCourse}>
            <option value="">None</option>
            {#each store.activeCourses as c (c.id)}<option value={c.id}>{c.emoji ?? ''} {c.name}</option>{/each}
          </select>
        </label>
        <label>Due <input class="input" type="date" bind:value={readDue} min={store.today} /></label>
      </div>
      <button class="btn primary" onclick={createReading} disabled={!readMinutes || !(readTitle.trim() || suggestedTitle)}>Create reading task</button>
    </section>
  {:else}
    <section class="card">
      <h2>Calendar export</h2>
      <p class="help">
        Download an <code>.ics</code> file of your due dates and import it into Google Calendar, Apple Calendar, or Outlook. Exams and quizzes get a reminder one day before. Re-export
        after changes; most calendars update events with the same id on re-import.
      </p>
      <div class="grid2">
        <label
          >Range
          <select class="select" bind:value={horizon}>
            <option value="30">Next 30 days</option>
            <option value="90">Next 90 days</option>
            <option value="all">Everything</option>
          </select>
        </label>
        <label class="check"><input type="checkbox" bind:checked={includeDone} /> Include completed tasks</label>
      </div>
      <p class="muted">{calTasks.length} event{calTasks.length === 1 ? '' : 's'} will be exported.</p>
      <button class="btn primary" onclick={exportICS} disabled={!calTasks.length}>Download homework-todo.ics</button>
      <details class="how">
        <summary>How to import</summary>
        <ul>
          <li><strong>Google Calendar:</strong> Settings → Import &amp; export → Import → choose the file and a calendar.</li>
          <li><strong>Apple Calendar:</strong> File → Import, or open the file on iPhone and tap Add All.</li>
          <li><strong>Outlook:</strong> File → Open &amp; Export → Import/Export → Import an iCalendar file.</li>
        </ul>
      </details>
    </section>
  {/if}
</div>

<style>
  .groups {
    display: flex;
    gap: 2px;
    background: var(--bg-elev-2);
    border-radius: 999px;
    padding: 3px;
    width: fit-content;
    max-width: 100%;
    overflow-x: auto;
    margin: 4px 0 8px;
  }
  .groups button {
    padding: 5px 14px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    white-space: nowrap;
  }
  .groups button.on {
    background: var(--bg-elev);
    color: var(--text);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
  .tabs {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    margin: 4px 0 12px;
  }
  .tabs button,
  .modes button {
    padding: 7px 12px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    border: 1px solid var(--border);
  }
  .tabs button.on,
  .modes button.on {
    background: color-mix(in srgb, var(--accent) 16%, transparent);
    color: var(--text);
    border-color: var(--accent);
  }
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
  .help code {
    font-family: var(--mono);
    font-size: 12px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  .warn {
    color: var(--warn);
    font-size: 13px;
  }
  .capbar {
    position: relative;
    height: 26px;
    background: var(--bg-elev-2);
    border-radius: 13px;
    overflow: hidden;
    margin: 10px 0 6px;
  }
  .capbar .fill {
    height: 100%;
    background: var(--accent);
    transition: width 400ms var(--ease);
  }
  .capbar.over .fill {
    background: var(--danger);
  }
  .capbar .lbl {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    mix-blend-mode: difference;
    color: #fff;
  }
  .week {
    display: flex;
    gap: 6px;
    margin-top: 10px;
  }
  .day {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    font-size: 11px;
    color: var(--text-muted);
  }
  .day .bar {
    width: 100%;
    height: 56px;
    background: var(--bg-elev-2);
    border-radius: 6px;
    display: flex;
    align-items: flex-end;
    overflow: hidden;
  }
  .day .fill {
    width: 100%;
    background: var(--accent);
    opacity: 0.75;
  }
  .day.over .fill {
    background: var(--danger);
    opacity: 1;
  }
  .day.today .dl {
    color: var(--accent);
    font-weight: 700;
  }
  .dm {
    min-height: 1.2em;
    font-size: 10px;
  }
  .list {
    list-style: none;
    margin: 0 0 8px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .list li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 8px;
    background: var(--bg-elev-2);
    font-size: 14px;
  }
  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--course);
  }
  .grow {
    flex: 1;
    min-width: 0;
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
    color: var(--danger);
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
    color: var(--accent);
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
    color: var(--success);
  }
  .bad {
    color: var(--danger);
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
  .modes {
    display: flex;
    gap: 4px;
    margin-bottom: 10px;
  }
  .grid2 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
    margin-bottom: 10px;
  }
  .grid2 label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
  }
  .grid2 label.check {
    flex-direction: row;
    align-items: center;
    align-self: end;
    padding-bottom: 8px;
  }
  .result {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin: 6px 0 12px;
  }
  .result .big {
    font-size: 32px;
    font-weight: 800;
  }
  .how {
    margin-top: 12px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .how ul {
    padding-left: 18px;
  }
</style>
