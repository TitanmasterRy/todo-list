<script lang="ts">
  // Tools → Syllabus box: paste a syllabus or class schedule, check the dates it found, add them as tasks
  // (and breaks). Works without AI; "Use AI" helps with messy layouts when a key is set.
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { TASK_TYPES, type TaskType } from '../../lib/types';
  import { extractSyllabus, isPast, type Found } from '../../lib/syllabus';
  import { DAY_SHORT, fromKey, MONTH_SHORT } from '../../lib/dates';

  let text = $state('');
  let courseId = $state(store.activeCourses[0]?.id ?? '');
  let dayFirst = $state(false);
  let rows = $state<(Found & { on: boolean })[]>([]);
  let searched = $state(false);
  let aiBusy = $state(false);
  let aiOk = $state(false);
  let visionOk = $state(false);
  void import('../../lib/ai').then((m) => {
    aiOk = m.aiAvailable();
    visionOk = aiOk && m.aiSupportsVision();
  });
  let photoBusy = $state('');

  /** A photo of the board or a handout: AI reads it straight into rows when it can see images, else on-device OCR fills the text box. */
  async function fromPhoto(e: Event) {
    const files = [...((e.currentTarget as HTMLInputElement).files ?? [])].filter((f) => f.type.startsWith('image/'));
    (e.currentTarget as HTMLInputElement).value = '';
    if (!files.length) return;
    try {
      const { imageToDataUrl } = await import('../../lib/ai-providers');
      const images = await Promise.all(files.map(async (f) => ({ dataUrl: await imageToDataUrl(f, 1800) })));
      if (visionOk) {
        photoBusy = 'Reading the photo…';
        const { extractSyllabusAI } = await import('../../lib/ai');
        rows = (await extractSyllabusAI('Read the photo(s): a whiteboard, syllabus or assignment sheet.', store.today, images)).map((f) => ({ ...f, on: !isPast(f, store.today) }));
        searched = true;
        return;
      }
      photoBusy = 'Loading on-device text recognition (first time ~5 MB)…';
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      const parts: string[] = [];
      for (const img of images) {
        photoBusy = `Reading photo ${parts.length + 1} of ${images.length}…`;
        parts.push((await worker.recognize(img.dataUrl)).data.text.trim());
      }
      await worker.terminate();
      text = [text.trim(), ...parts].filter(Boolean).join('\n');
      find();
    } catch (err) {
      toasts.push({ message: 'Couldn’t read the photo', detail: err instanceof Error ? err.message : String(err), kind: 'warn' });
    } finally {
      photoBusy = '';
    }
  }

  function find() {
    rows = extractSyllabus(text, { today: store.today, dayFirst }).map((f) => ({ ...f, on: !isPast(f, store.today) }));
    searched = true;
  }
  async function findWithAI() {
    aiBusy = true;
    try {
      const { extractSyllabusAI } = await import('../../lib/ai');
      rows = (await extractSyllabusAI(text, store.today)).map((f) => ({ ...f, on: !isPast(f, store.today) }));
      searched = true;
    } catch (e) {
      toasts.push({ message: 'AI couldn’t read that', detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    } finally {
      aiBusy = false;
    }
  }
  async function openFile(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    if (f) text = await f.text();
    (e.currentTarget as HTMLInputElement).value = '';
  }

  const chosen = $derived(rows.filter((r) => r.on));
  const nTasks = $derived(chosen.filter((r) => r.kind === 'task').length);
  const nBreaks = $derived(chosen.filter((r) => r.kind === 'break').length);
  const day = (k: string) => `${DAY_SHORT[fromKey(k).getDay()]} ${MONTH_SHORT[fromKey(k).getMonth()]} ${fromKey(k).getDate()}`;

  function addAll() {
    const tasks = chosen.filter((r): r is Extract<typeof r, { kind: 'task' }> => r.kind === 'task');
    // skip ones already in the list (same course, day and title)
    const exists = (t: { title: string; dateKey: string }) =>
      store.tasks.some((x) => x.courseId === (courseId || undefined) && x.dueAt?.slice(0, 10) === t.dateKey && x.title.toLowerCase() === t.title.toLowerCase());
    const fresh = tasks.filter((t) => !exists(t));
    if (fresh.length) store.addTasks(fresh.map((t) => ({ title: t.title, dueAt: t.dateKey, type: t.type, courseId: courseId || undefined })));
    for (const b of chosen) if (b.kind === 'break') store.addBreak(b.from, b.to, b.name);
    toasts.push({
      message: `Added ${fresh.length} task${fresh.length === 1 ? '' : 's'}${nBreaks ? ` and ${nBreaks} break${nBreaks === 1 ? '' : 's'}` : ''}`,
      detail: tasks.length > fresh.length ? `${tasks.length - fresh.length} were already on your list.` : undefined,
      kind: 'success',
      emoji: '📋',
    });
    rows = [];
    searched = false;
    text = '';
  }
</script>

<section class="card">
  <h2>📋 Syllabus box</h2>
  <p class="help">
    Paste a syllabus, course calendar or assignment list, or snap a photo of the board. Every line with a date becomes a task you can check before adding; breaks become Break mode
    days.
  </p>
  <textarea
    class="input"
    rows="8"
    bind:value={text}
    placeholder={'Sep 14 – Read chapter 4\n9/18 Quiz: Unit 1\nOct 14 Midterm exam\nNov 23–27 Thanksgiving break'}
    aria-label="Syllabus text"
  ></textarea>
  <div class="row">
    <label class="file btn sm ghost">📄 Open a .txt file<input type="file" accept=".txt,.md,.csv,text/plain" onchange={openFile} hidden /></label>
    <label class="file btn sm ghost" title={visionOk ? 'AI reads the photo' : 'Text recognition on this device'}
      >📷 Photo of the board<input type="file" accept="image/*" capture="environment" multiple onchange={fromPhoto} hidden aria-label="Photo of the board or a handout" /></label
    >
    <select class="select" bind:value={courseId} aria-label="Course for these tasks">
      <option value="">No course</option>
      {#each store.activeCourses as c (c.id)}<option value={c.id}>{c.emoji ? c.emoji + ' ' : ''}{c.name}</option>{/each}
    </select>
    <label class="chk"><input type="checkbox" bind:checked={dayFirst} /> Dates are day/month</label>
    <span class="grow"></span>
    {#if aiOk}<button class="btn sm" onclick={findWithAI} disabled={!text.trim() || aiBusy}>{aiBusy ? 'Reading…' : '✨ Use AI'}</button>{/if}
    <button class="btn sm primary" onclick={find} disabled={!text.trim()}>Find dates</button>
  </div>

  {#if photoBusy}<p class="muted" role="status">{photoBusy}</p>{/if}
  {#if searched}
    {#if !rows.length}
      <p class="muted">No dates found. Dates like “Sep 30”, “9/30” or “2026-09-30” work best, one item per line.</p>
    {:else}
      <table>
        <thead><tr><th><span class="sr">Add</span></th><th>Date</th><th>What</th><th>Type</th></tr></thead>
        <tbody>
          {#each rows as r, i (i)}
            <tr class:off={!r.on}>
              <td><input type="checkbox" bind:checked={r.on} aria-label="Add {r.kind === 'task' ? r.title : r.name}" /></td>
              {#if r.kind === 'task'}
                <td><input class="input date" type="date" bind:value={r.dateKey} aria-label="Date for {r.title}" /></td>
                <td><input class="input" bind:value={r.title} aria-label="Title" /></td>
                <td>
                  <select class="select" bind:value={r.type} aria-label="Type for {r.title}">
                    {#each TASK_TYPES as t (t)}<option value={t as TaskType}>{t}</option>{/each}
                  </select>
                </td>
              {:else}
                <td class="nowrap">{day(r.from)}{r.to !== r.from ? ` – ${day(r.to)}` : ''}</td>
                <td>🏖️ {r.name}</td>
                <td class="muted">break</td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="muted">Past dates start unchecked.</p>
      <div class="row">
        <span class="grow"></span>
        <button class="btn primary" onclick={addAll} disabled={!chosen.length}
          >Add {nTasks} task{nTasks === 1 ? '' : 's'}{nBreaks ? ` + ${nBreaks} break${nBreaks === 1 ? '' : 's'}` : ''}</button
        >
      </div>
    {/if}
  {/if}
</section>

<style>
  h2 {
    font-size: 16px;
    margin: 0 0 6px;
  }
  .help,
  .muted {
    font-size: 13px;
    color: var(--text-muted);
    margin: 6px 0;
  }
  textarea {
    width: 100%;
    font-family: inherit;
    resize: vertical;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 8px 0;
    font-size: 13px;
  }
  .row .select {
    width: auto;
  }
  .grow {
    flex: 1;
  }
  .chk {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--text-muted);
  }
  .file {
    cursor: pointer;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    margin-top: 8px;
  }
  th {
    text-align: left;
    font-weight: 500;
    font-size: 12px;
    color: var(--text-muted);
    padding: 4px;
  }
  td {
    padding: 3px 4px;
    border-top: 1px solid var(--border);
  }
  td .input,
  td .select {
    padding: 4px 6px;
    font-size: 13px;
    width: 100%;
  }
  .date {
    min-width: 140px;
  }
  tr.off td:not(:first-child) {
    opacity: 0.5;
  }
  .nowrap {
    white-space: nowrap;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
</style>
