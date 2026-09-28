<script lang="ts">
  // Scan: photograph or upload paper (worksheets, notes, textbook pages) → text that keeps its structure.
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { renderMarkdown } from '../../lib/markdown';
  import { imageToDataUrl } from '../../lib/ai-providers';
  import { aiAvailable, aiSupportsVision, answerKey, makeNotecards, summarizeNotes, transcribeImages, currentProvider } from '../../lib/ai';
  import { formatDate } from '../../lib/dates';
  import { t } from '../../lib/i18n/index.svelte';

  interface Shot {
    id: number;
    dataUrl: string;
    name: string;
  }
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
        toasts.push({ message: t('scan.readFailed', { name: f.name }), kind: 'warn' });
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
    progress = t('scan.loadingOcr');
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
      toasts.push({
        message: t('scan.extracted'),
        detail: t('scan.extractedDetail'),
        kind: 'success',
        emoji: '📄',
      });
    } catch (e) {
      toasts.push({ message: t('scan.ocrFailed'), detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    } finally {
      busy = '';
      progress = '';
    }
  }

  async function runAI() {
    if (!shots.length) return;
    busy = 'ai';
    progress = t('scan.reading', { count: shots.length, provider: currentProvider() });
    try {
      text = await transcribeImages(
        shots.map((s) => ({ dataUrl: s.dataUrl })),
        hint || (courseId ? `Course: ${store.courseById(courseId)?.name}` : undefined),
      );
      toasts.push({ message: t('scan.transcribed'), detail: t('scan.transcribedDetail'), kind: 'success', emoji: '✨' });
    } catch (e) {
      toasts.push({ message: t('scan.transFailed'), detail: e instanceof Error ? e.message : String(e), kind: 'warn', timeout: 9000 });
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
      resultTitle = t('quiz.answerKey');
    } catch (e) {
      toasts.push({ message: t('scan.keyFailed'), detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    } finally {
      busy = '';
    }
  }
  async function makeSummary() {
    if (!text.trim()) return;
    busy = 'summary';
    try {
      result = await summarizeNotes(text);
      resultTitle = t('scan.sheet');
    } catch (e) {
      toasts.push({ message: t('scan.sumFailed'), detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
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
      if (!deck) deck = store.addDeck(t('scan.deck', { date: formatDate(new Date()) }), courseId || undefined);
      const added = store.addCards(deck.id, cards);
      toasts.push({ message: t('cards.addedTo', { count: added.length, deck: deck.name }), kind: 'success', emoji: '🃏' });
    } catch (e) {
      toasts.push({ message: t('cards.genFailed'), detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    } finally {
      busy = '';
    }
  }
  async function copy(s: string) {
    try {
      await navigator.clipboard.writeText(s);
      toasts.push({ message: t('scan.copied'), kind: 'success', timeout: 1500 });
    } catch {
      toasts.push({ message: t('scan.copyFailed'), kind: 'warn' });
    }
  }
  function createTask() {
    const firstLine =
      text
        .split('\n')
        .map((l) => l.replace(/^#+\s*/, '').trim())
        .find(Boolean) ?? t('scan.worksheet');
    store.addTask({ title: firstLine.slice(0, 120), notes: text.slice(0, 5000), courseId: courseId || undefined, source: 'scan' } as never, { describe: false });
    toasts.push({ message: t('scan.taskCreated'), kind: 'success' });
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
    for (const it of Array.from(items))
      if (it.type.startsWith('image/')) {
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
  <h2>{t('scan.title')}</h2>
  <p class="help">
    {t('scan.help')}
  </p>
  <div class="btns">
    <button class="btn primary" onclick={() => camInput?.click()}>📷 {t('scan.photo')}</button>
    <button class="btn" onclick={() => fileInput?.click()}>{t('scan.upload')}</button>
    <span class="muted">{t('scan.paste')}</span>
    <input
      type="file"
      accept="image/*"
      capture="environment"
      class="visually-hidden"
      bind:this={camInput}
      onchange={(e) => addFiles((e.target as HTMLInputElement).files)}
      aria-label={t('scan.photo')}
    />
    <input
      type="file"
      accept="image/*"
      multiple
      class="visually-hidden"
      bind:this={fileInput}
      onchange={(e) => addFiles((e.target as HTMLInputElement).files)}
      aria-label={t('scan.upload')}
    />
  </div>
  {#if shots.length}
    <div class="shots">
      {#each shots as s (s.id)}
        <div class="shot"><img src={s.dataUrl} alt={s.name} /><button class="x" onclick={() => remove(s.id)} aria-label={t('scan.remove')}>×</button></div>
      {/each}
    </div>
    <div class="grid2">
      <label
        >{t('inbox.course')}
        <select class="select" bind:value={courseId}
          ><option value="">{t('common.none')}</option>{#each store.activeCourses as c (c.id)}<option value={c.id}>{c.emoji ?? ''} {c.name}</option>{/each}</select
        ></label
      >
      <label>{t('scan.hint')} <input class="input" bind:value={hint} placeholder={t('scan.hintPh')} /></label>
    </div>
    <div class="btns">
      <button
        class="btn primary"
        onclick={runAI}
        disabled={!!busy || !aiAvailable() || !aiSupportsVision()}
        title={!aiAvailable() ? t('scan.needKey') : !aiSupportsVision() ? t('scan.needVision') : ''}>{busy === 'ai' ? t('syl.reading') : t('scan.ai')}</button
      >
      <button class="btn" onclick={runOCR} disabled={!!busy}>{busy === 'ocr' ? t('syl.reading') : t('scan.ocr')}</button>
      {#if progress}<span class="muted">{progress}</span>{/if}
    </div>
    {#if !aiAvailable()}<p class="help">
        {t('scan.noKey')}
      </p>{:else if !aiSupportsVision()}<p class="help">
        {t('scan.noVision')}
      </p>{/if}
  {/if}

  {#if text}
    <div class="row-head">
      <div class="modes">
        <button class:on={view === 'edit'} onclick={() => (view = 'edit')}>{t('common.edit')}</button><button class:on={view === 'preview'} onclick={() => (view = 'preview')}
          >{t('scan.preview')}</button
        >
      </div>
      <div class="btns">
        <button class="btn sm" onclick={() => copy(text)}>{t('scan.copyText')}</button>
        <button class="btn sm" onclick={() => download('scan.md', text)}>{t('scan.downloadMd')}</button>
        <button class="btn sm" onclick={createTask}>{t('scan.createTask')}</button>
      </div>
    </div>
    {#if view === 'edit'}
      <textarea class="textarea mono" bind:value={text} rows="14" spellcheck="false"></textarea>
    {:else}
      <div class="preview">{@html renderMarkdown(text)}</div>
    {/if}
    <div class="actions">
      <label class="check"><input type="checkbox" bind:checked={showWork} /> {t('scan.showWork')}</label>
      <button class="btn" onclick={makeKey} disabled={!!busy || !aiAvailable()}>{busy === 'key' ? t('scan.working') : t('scan.makeKey')}</button>
      <button class="btn" onclick={makeSummary} disabled={!!busy || !aiAvailable()}>{busy === 'summary' ? t('scan.working') : `📝 ${t('scan.sheet')}`}</button>
      <select class="select" bind:value={deckId} aria-label={t('scan.deckFor')}
        ><option value="">{t('scan.newDeck')}</option>{#each store.decks as d (d.id)}<option value={d.id}>{d.name}</option>{/each}</select
      >
      <button class="btn" onclick={makeCards} disabled={!!busy || !aiAvailable()}>{busy === 'cards' ? t('scan.working') : t('scan.makeCards')}</button>
    </div>
  {/if}

  {#if result}
    <div class="result">
      <div class="row-head">
        <h3>{resultTitle}</h3>
        <div class="btns">
          <button class="btn sm" onclick={() => copy(result)}>{t('card.copy')}</button><button
            class="btn sm"
            onclick={() => download(`${resultTitle.toLowerCase().replace(/\s+/g, '-')}.md`, result)}>{t('prompt.download')}</button
          ><button class="btn ghost sm" onclick={() => (result = '')}>{t('common.close')}</button>
        </div>
      </div>
      <div class="preview">{@html renderMarkdown(result)}</div>
    </div>
  {/if}
</section>

<style>
  h2 {
    font-size: 16px;
    margin: 0 0 6px;
  }
  h3 {
    font-size: 14px;
    margin: 0;
  }
  .help,
  .muted {
    font-size: 13px;
    color: var(--text-muted);
  }
  .btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
    margin: 8px 0;
  }
  .shots {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin: 8px 0;
  }
  .shot {
    position: relative;
    width: 110px;
    height: 140px;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid var(--border);
    background: var(--bg-elev-2);
  }
  .shot img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .shot .x {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    font-size: 14px;
  }
  .grid2 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 10px;
    margin: 8px 0;
  }
  .grid2 label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
  }
  .row-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 12px;
  }
  .modes {
    display: flex;
    gap: 2px;
    background: var(--bg-elev-2);
    border-radius: 999px;
    padding: 3px;
  }
  .modes button {
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
  }
  .modes button.on {
    background: var(--bg-elev);
    color: var(--text);
  }
  .textarea.mono {
    font-family: var(--mono);
    font-size: 13px;
    min-height: 240px;
    margin-top: 6px;
  }
  .preview {
    margin-top: 6px;
    padding: 12px;
    background: var(--bg-elev-2);
    border-radius: 10px;
    font-size: 14px;
    overflow-x: auto;
  }
  .preview :global(table) {
    border-collapse: collapse;
  }
  .preview :global(td),
  .preview :global(th) {
    border: 1px solid var(--border);
    padding: 4px 8px;
  }
  .preview :global(p) {
    margin: 0 0 8px;
  }
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
    margin-top: 10px;
  }
  .actions .select {
    width: auto;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .result {
    margin-top: 14px;
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }
</style>
