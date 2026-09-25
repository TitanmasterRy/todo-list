<script lang="ts">
  // Reading time: estimate a reading from pages or words, then create the task with the estimate.
  import { store } from '../../lib/store.svelte';
  import { formatMinutes } from '../../lib/dates';

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
</script>

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

<style>
  .modes button {
    padding: 7px 12px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    border: 1px solid var(--border);
  }
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
  .help {
    font-size: 13px;
    color: var(--text-muted);
    margin: 4px 0 10px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
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
</style>
