<script lang="ts">
  // Scan: photograph or upload paper (worksheets, notes, textbook pages) → text that keeps its structure.
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { renderMarkdown } from '../../lib/markdown';
  import { imageToDataUrl } from '../../lib/ai-providers';
  import { aiAvailable, aiSupportsVision, answerKey, makeNotecards, summarizeNotes, transcribeImages, currentProvider } from '../../lib/ai';

  interface Shot { id: number; dataUrl: string; name: string }
  let shots = $state<Shot[]>([]);
  let text = $state('');
  let result = $state('');
  let resultTitle = $state('');
  let busy = $state<'' | 'ocr' | 'ai' | 'key' | 'cards' | 'summary'>('');
  let progress = $state('');
  let view = $state<'edit' | 'preview'>('edit');
  let hint = $state('');
  let showWork = $state(true);
  let courseId = $state('');
  let deckId = $state('');
  let n = 0;
  let camInput: HTMLInputElement | undefined = $state();
  let fileInput: HTMLInputElement | undefined = $state();

  async function addFiles(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue;
      try {
        const dataUrl = await imageToDataUrl(f, 1800);
        shots = [...shots, { id: ++n, dataUrl, name: f.name }];
      } catch (e) {
        toasts.push({ message: `Could not read ${f.name}`, kind: 'warn' });
      }
    }
  }
  function remove(id: number) {
    shots = shots.filter((s) => s.id !== id);
  }

  /** Free, on-device OCR (plain text, no formatting). Loads Tesseract on first use. */
  async function runOCR() {
    if (!shots.length) return;
    busy = 'ocr';
    progress = 'Loading OCR engine (first time ~5 MB)…';
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          progress = `${m.status} ${Math.round((m.progress || 0) * 100)}%`;
        },
      });
      const parts: string[] = [];
      for (const s of shots) {
        const { data } = await worker.recognize(s.dataUrl);
        parts.push(data.text.trim());
      }
      await worker.terminate();
      text = parts.join('\n\n---\n\n');
      toasts.push({ message: 'Text extracted', detail: 'On-device OCR keeps line breaks but not layout. Use AI transcription for tables, math and structure.', kind: 'success', emoji: '📄' });
    } catch (e) {
      toasts.push({ message: 'OCR failed', detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    } finally {
      busy = '';
      progress = '';
    }
  }

  async function runAI() {
    if (!shots.length) return;
    busy = 'ai';
    progress = `Reading ${shots.length} image${shots.length > 1 ? 's' : ''} with ${currentProvider()}…`;
    try {
      text = await transcribeImages(shots.map((s) => ({ dataUrl: s.dataUrl })), hint || (courseId ? `Course: ${store.courseById(courseId)?.name}` : undefined));
      toasts.push({ message: 'Transcribed', detail: 'Check for [unreadable] spots, then copy or make an answer key.', kind: 'success', emoji: '✨' });
    } catch (e) {
      toasts.push({ message: 'Transcription failed', detail: e instanceof Error ? e.message : String(e), kind: 'warn', timeout: 9000 });
    } finally {
      busy = '';
      progress = '';
    }
  }

  async function makeKey() {
    if (!text.trim()) return;
    busy = 'key';
    try {
      result = await answerKey(text, { showWork, courseName: store.courseById(courseId)?.name });
      resultTitle = 'Answer key';
    } catch (e) {
      toasts.push({ message: 'Could not make an answer key', detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    } finally {
      busy = '';
    }
  }
  async function makeSummary() {
    if (!text.trim()) return;
    busy = 'summary';
    try {
      result = await summarizeNotes(text);
      resultTitle = 'Study sheet';
    } catch (e) {
      toasts.push({ message: 'Could not summarize', detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    } finally {
      busy = '';
    }
  }
  async function makeCards() {
    if (!text.trim()) return;
    busy = 'cards';
    try {
      const cards = await makeNotecards(text, 12);
      let deck = deckId ? store.decks.find((d) => d.id === deckId) : undefined;
      if (!deck) deck = store.addDeck(`Scan ${new Date().toLocaleDateString()}`, courseId || undefined);
      const added = store.addCards(deck.id, cards);
      toasts.push({ message: `${added.length} notecards added to “${deck.name}”`, kind: 'success', emoji: '🃏' });
    } catch (e) {
      toasts.push({ message: 'Could not make cards', detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    } finally {
      busy = '';
    }
  }
  async function copy(s: string) {
    try {
      await navigator.clipboard.writeText(s);
      toasts.push({ message: 'Copied', kind: 'success', timeout: 1500 });
    } catch {
      toasts.push({ message: 'Copy failed; select the text and copy manually', kind: 'warn' });
    }
  }
  function createTask() {
    const firstLine = text.split('\n').map((l) => l.replace(/^#+\s*/, '').trim()).find(Boolean) ?? 'Scanned worksheet';
    store.addTask({ title: firstLine.slice(0, 120), notes: text.slice(0, 5000), courseId: courseId || undefined, source: 'scan' } as never, { describe: false });
    toasts.push({ message: 'Task created from the scan', kind: 'success' });
  }
  function download(name: string, body: string) {
    const blob = new Blob([body], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  }
  function onPaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const it of Array.from(items)) if (it.type.startsWith('image/')) {
      const f = it.getAsFile();
      if (f) files.push(f);
    }
    if (files.length) {
      e.preventDefault();
      const dt = new DataTransfer();
      files.forEach((f) => dt.items.add(f));
      void addFiles(dt.files);
    }
  }
</script>

<svelte:window onpaste={onPaste} />

<section class="card scan">
  <h2>Scan paper → text</h2>
  <p class="help">Take a photo of a worksheet, notes or a textbook page. <strong>AI transcription</strong> keeps headings, numbering, tables and math; <strong>on-device OCR</strong> is free and private but plain text. Then copy it, make an answer key, a study sheet, or notecards.</p>
  <div class="btns">
    <button class="btn primary" onclick={() => camInput?.click()}>📷 Take photo</button>
    <button class="btn" onclick={() => fileInput?.click()}>Upload images</button>
    <span class="muted">or paste a screenshot (Ctrl+V)</span>
    <input type="file" accept="image/*" capture="environment" class="visually-hidden" bind:this={camInput} onchange={(e) => addFiles((e.target as HTMLInputElement).files)} aria-label="Take photo" />
    <input type="file" accept="image/*" multiple class="visually-hidden" bind:this={fileInput} onchange={(e) => addFiles((e.target as HTMLInputElement).files)} aria-label="Upload images" />
  </div>
  {#if shots.length}
    <div class="shots">
      {#each shots as s (s.id)}
        <div class="shot"><img src={s.dataUrl} alt={s.name} /><button class="x" onclick={() => remove(s.id)} aria-label="Remove image">×</button></div>
      {/each}
    </div>
    <div class="grid2">
      <label>Course <select class="select" bind:value={courseId}><option value="">None</option>{#each store.activeCourses as c (c.id)}<option value={c.id}>{c.emoji ?? ''} {c.name}</option>{/each}</select></label>
      <label>Hint for the AI (optional) <input class="input" bind:value={hint} placeholder="e.g. chemistry worksheet, keep the table" /></label>
    </div>
    <div class="btns">
      <button class="btn primary" onclick={runAI} disabled={!!busy || !aiAvailable() || !aiSupportsVision()} title={!aiAvailable() ? 'Add an AI key in Settings' : !aiSupportsVision() ? 'Pick a vision-capable model in Settings' : ''}>{busy === 'ai' ? 'Reading…' : '✨ Transcribe with AI (keeps formatting)'}</button>
      <button class="btn" onclick={runOCR} disabled={!!busy}>{busy === 'ocr' ? 'Reading…' : '🔒 Free on-device OCR'}</button>
      {#if progress}<span class="muted">{progress}</span>{/if}
    </div>
    {#if !aiAvailable()}<p class="help">No AI key yet. Free options: Google Gemini or Groq keys in Settings → AI helper (both have free tiers and read photos).</p>{:else if !aiSupportsVision()}<p class="help">The selected model can’t read images. In Settings → AI helper pick a model marked “vision” (e.g. Gemini Flash, Llama 4 Scout, Claude).</p>{/if}
  {/if}

  {#if text}
    <div class="row-head">
      <div class="modes"><button class:on={view === 'edit'} onclick={() => (view = 'edit')}>Edit</button><button class:on={view === 'preview'} onclick={() => (view = 'preview')}>Preview</button></div>
      <div class="btns">
        <button class="btn sm" onclick={() => copy(text)}>Copy text</button>
        <button class="btn sm" onclick={() => download('scan.md', text)}>Download .md</button>
        <button class="btn sm" onclick={createTask}>Create task</button>
      </div>
    </div>
    {#if view === 'edit'}
      <textarea class="textarea mono" bind:value={text} rows="14" spellcheck="false"></textarea>
    {:else}
      <div class="preview">{@html renderMarkdown(text)}</div>
    {/if}
    <div class="actions">
      <label class="check"><input type="checkbox" bind:checked={showWork} /> show work in the answer key</label>
      <button class="btn" onclick={makeKey} disabled={!!busy || !aiAvailable()}>{busy === 'key' ? 'Working…' : '🔑 Make answer key'}</button>
      <button class="btn" onclick={makeSummary} disabled={!!busy || !aiAvailable()}>{busy === 'summary' ? 'Working…' : '📝 Study sheet'}</button>
      <select class="select" bind:value={deckId} aria-label="Deck for notecards"><option value="">New deck</option>{#each store.decks as d (d.id)}<option value={d.id}>{d.name}</option>{/each}</select>
      <button class="btn" onclick={makeCards} disabled={!!busy || !aiAvailable()}>{busy === 'cards' ? 'Working…' : '🃏 Make notecards'}</button>
    </div>
  {/if}

  {#if result}
    <div class="result">
      <div class="row-head">
        <h3>{resultTitle}</h3>
        <div class="btns"><button class="btn sm" onclick={() => copy(result)}>Copy</button><button class="btn sm" onclick={() => download(`${resultTitle.toLowerCase().replace(/\s+/g, '-')}.md`, result)}>Download</button><button class="btn ghost sm" onclick={() => (result = '')}>Close</button></div>
      </div>
      <div class="preview">{@html renderMarkdown(result)}</div>
    </div>
  {/if}
</section>

<style>
  h2 { font-size: 16px; margin: 0 0 6px; }
  h3 { font-size: 14px; margin: 0; }
  .help, .muted { font-size: 13px; color: var(--text-muted); }
  .btns { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 8px 0; }
  .shots { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
  .shot { position: relative; width: 110px; height: 140px; border-radius: 10px; overflow: hidden; border: 1px solid var(--border); background: var(--bg-elev-2); }
  .shot img { width: 100%; height: 100%; object-fit: cover; }
  .shot .x { position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; border-radius: 50%; background: rgba(0,0,0,0.6); color: #fff; font-size: 14px; }
  .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin: 8px 0; }
  .grid2 label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: var(--text-muted); }
  .row-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
  .modes { display: flex; gap: 2px; background: var(--bg-elev-2); border-radius: 999px; padding: 3px; }
  .modes button { padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; color: var(--text-muted); }
  .modes button.on { background: var(--bg-elev); color: var(--text); }
  .textarea.mono { font-family: var(--mono); font-size: 13px; min-height: 240px; margin-top: 6px; }
  .preview { margin-top: 6px; padding: 12px; background: var(--bg-elev-2); border-radius: 10px; font-size: 14px; overflow-x: auto; }
  .preview :global(table) { border-collapse: collapse; }
  .preview :global(td), .preview :global(th) { border: 1px solid var(--border); padding: 4px 8px; }
  .preview :global(p) { margin: 0 0 8px; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
  .actions .select { width: auto; }
  .check { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-muted); }
  .result { margin-top: 14px; border-top: 1px solid var(--border); padding-top: 10px; }
</style>
