<script lang="ts">
  import { store, byDueThenOrder } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import type { Course, Task } from '../lib/types';
  import { dueKey, formatMinutes, endOfWeekKey } from '../lib/dates';
  import QuickAdd from '../components/QuickAdd.svelte';
  import TaskItem from '../components/TaskItem.svelte';
  import Sortable from '../components/Sortable.svelte';
  const loadCourseEditor = () => import('../components/CourseEditor.svelte');
  const loadBoard = () => import('../components/KanbanBoard.svelte');

  const live = (t: Task) => !t.completedAt || store.lingering.has(t.id);
  const weekEnd = $derived(endOfWeekKey(store.today, store.settings.weekStart));
  const course = $derived(store.courseFilter ? store.courseById(store.courseFilter) : undefined);

  function tasksFor(c: Course): Task[] {
    return store.tasks.filter((t) => t.courseId === c.id && live(t)).sort(byDueThenOrder);
  }
  function workload(c: Course): number {
    return store.openTasks.filter((t) => t.courseId === c.id).reduce((a, t) => a + (t.estimateMin ?? 0), 0);
  }
  function dueThisWeek(c: Course): number {
    return store.openTasks.filter((t) => t.courseId === c.id && t.dueAt && dueKey(t.dueAt) <= weekEnd).length;
  }
  function overdueCount(c: Course): number {
    return store.openTasks.filter((t) => t.courseId === c.id && t.dueAt && dueKey(t.dueAt) < store.today).length;
  }
  const courseTasks = $derived(course ? tasksFor(course) : []);
  const courseDone = $derived(
    course ? store.tasks.filter((t) => t.courseId === course.id && t.completedAt && !store.lingering.has(t.id)).sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1)) : [],
  );
  let showDone = $state(false);
  const board = $derived(store.settings.courseLayout === 'board');
  const allCourseTasks = $derived(course ? store.tasks.filter((t) => t.courseId === course.id) : []);
  const archivedCourses = $derived(store.courses.filter((c) => c.archived));
  let showArchived = $state(false);
</script>

<div class="page wide">
  {#if course}
    <header class="page-head" style="--course:{course.color}">
      <button class="btn ghost sm" onclick={() => store.go('courses', { courseId: null })}>← All courses</button>
      <div class="course-title">
        <span class="dot"></span>
        <h1>{course.emoji ? course.emoji + ' ' : ''}{course.name}</h1>
      </div>
      <div class="grow"></div>
      <div class="seg" role="radiogroup" aria-label="Layout">
        <button role="radio" aria-checked={!board} class:on={!board} onclick={() => store.updateSettings({ courseLayout: 'list' })}>☰ List</button>
        <button role="radio" aria-checked={board} class:on={board} onclick={() => store.updateSettings({ courseLayout: 'board' })}>▦ Board</button>
      </div>
      <button class="btn sm" onclick={() => (ui.courseEditor = course.id)}>Edit</button>
    </header>
    <div class="workload">
      <span><strong>{formatMinutes(workload(course))}</strong> of work</span>
      <span class="sep">·</span>
      <span><strong>{dueThisWeek(course)}</strong> due this week</span>
      {#if overdueCount(course)}
        <span class="sep">·</span>
        <span class="over"><strong>{overdueCount(course)}</strong> overdue</span>
      {/if}
      <span class="sep">·</span>
      <span><strong>{courseDone.length}</strong> done</span>
    </div>
    <QuickAdd defaultCourseId={course.id} placeholder="Add a task to {course.name}…" autofocus />
    {#if board}
      <div style="--course:{course.color}">{#await loadBoard() then m}<m.default tasks={allCourseTasks} />{/await}</div>
    {:else}
      <div class="section-title"><span>Open</span><span class="count">{courseTasks.length}</span></div>
      <Sortable items={courseTasks} group="course" onreorder={(ids) => store.reorder(ids)}>
        {#snippet item(task)}
          <TaskItem {task} showCourse={false} listIds={courseTasks.map((t) => t.id)} dragHandle />
        {/snippet}
      </Sortable>
      {#if !courseTasks.length}
        <div class="empty">
          <div class="big">🎓</div>
          <h3>All clear</h3>
          <p>No open tasks for this course.</p>
        </div>
      {/if}
      {#if courseDone.length}
        <button class="section-title toggle" onclick={() => (showDone = !showDone)} aria-expanded={showDone}>
          <span>Completed</span><span class="count">{courseDone.length}</span><span class="spacer"></span><span class="hint">{showDone ? 'Hide' : 'Show'}</span>
        </button>
        {#if showDone}
          <div class="task-list">
            {#each courseDone.slice(0, 50) as task (task.id)}
              <TaskItem {task} showCourse={false} compact />
            {/each}
          </div>
        {/if}
      {/if}
    {/if}
  {:else}
    <header class="page-head">
      <div>
        <h1>Courses</h1>
        <div class="sub">One column per course. Workload is the sum of estimates on open tasks.</div>
      </div>
      <div class="grow"></div>
      <button class="btn sm" onclick={() => (ui.semesterSetup = true)}>Semester setup</button>
      <button class="btn primary sm" onclick={() => (ui.courseEditor = 'new')}>+ New course</button>
    </header>
    {#if !store.activeCourses.length}
      <div class="empty">
        <div class="big">📚</div>
        <h3>No courses yet</h3>
        <p>Create courses to group tasks and see workload per class. Try “Semester setup” to add several at once.</p>
      </div>
    {/if}
    <div class="grid">
      {#each store.activeCourses as c (c.id)}
        {@const tasks = tasksFor(c)}
        <section class="col card" style="--course:{c.color}" aria-label={c.name}>
          <header class="col-head">
            <button class="col-title" onclick={() => store.go('courses', { courseId: c.id })}>
              <span class="dot"></span>
              <span class="name">{c.emoji ? c.emoji + ' ' : ''}{c.name}</span>
            </button>
            <button class="btn ghost sm icon" aria-label="Edit course" onclick={() => (ui.courseEditor = c.id)}>✎</button>
          </header>
          <div class="col-stats">
            <span title="Total estimated minutes on open tasks">⏱ {formatMinutes(workload(c))}</span>
            <span title="Due this week">📅 {dueThisWeek(c)} this week</span>
            {#if overdueCount(c)}<span class="over">⚠ {overdueCount(c)}</span>{/if}
          </div>
          <div class="col-tasks">
            {#each tasks.slice(0, 8) as task (task.id)}
              <TaskItem {task} showCourse={false} compact />
            {/each}
            {#if tasks.length > 8}
              <button class="more" onclick={() => store.go('courses', { courseId: c.id })}>+{tasks.length - 8} more</button>
            {/if}
            {#if !tasks.length}
              <div class="nothing">Nothing open</div>
            {/if}
          </div>
        </section>
      {/each}
    </div>
    {#if archivedCourses.length}
      <button class="section-title toggle" onclick={() => (showArchived = !showArchived)} aria-expanded={showArchived}>
        <span>Archived</span><span class="count">{archivedCourses.length}</span>
      </button>
      {#if showArchived}
        <div class="archived">
          {#each archivedCourses as c (c.id)}
            <button class="chip" onclick={() => (ui.courseEditor = c.id)}>{c.emoji ?? ''} {c.name}</button>
          {/each}
        </div>
      {/if}
    {/if}
  {/if}
</div>

{#if ui.courseEditor}
  {#await loadCourseEditor() then m}<m.default />{/await}
{/if}

<style>
  .page.wide {
    max-width: 1100px;
  }
  .course-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--course);
    flex-shrink: 0;
  }
  .workload {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    font-size: 13px;
    color: var(--text-muted);
    margin: 0 0 12px;
  }
  .workload strong {
    color: var(--text);
  }
  .sep {
    color: var(--text-faint);
  }
  .over {
    color: var(--overdue);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
    margin-top: 8px;
  }
  .col {
    padding: 12px;
    border-top: 3px solid var(--course);
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 160px;
  }
  .col-head {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .col-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 16px;
    flex: 1;
    text-align: left;
    color: var(--text);
  }
  .col-stats {
    display: flex;
    gap: 10px;
    font-size: 12px;
    color: var(--text-muted);
    flex-wrap: wrap;
  }
  .col-tasks {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .more {
    color: var(--accent-text);
    font-size: 13px;
    text-align: left;
    padding: 4px;
  }
  .nothing {
    color: var(--text-faint);
    font-size: 13px;
    padding: 8px 4px;
  }
  .toggle {
    width: 100%;
    text-align: left;
  }
  .hint {
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    color: var(--text-faint);
  }
  .archived {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .seg {
    display: inline-flex;
    gap: 2px;
    background: var(--bg-sunken, var(--bg-elev));
    border-radius: 8px;
    padding: 2px;
  }
  .seg button {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .seg button.on {
    background: var(--bg-elev);
    color: var(--text);
    font-weight: 600;
  }
</style>
