<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { store } from '../../lib/store.svelte';
  import { ui } from '../../lib/ui.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { aiAvailable, explain, makeNotecards } from '../../lib/ai';
  import { renderMarkdown } from '../../lib/markdown';
  import { uid } from '../../lib/id';
  import { addBook, addHighlight, deleteBook, deleteHighlight, estimateUsage, formatBytes, getBook, listBooks, listHighlights, requestPersistentStorage, updateBook, type BookMeta, type Highlight, type LibraryFile } from '../../lib/library';
  import PdfViewer from './PdfViewer.svelte';

  const POMODORO_SEC = 25 * 60;
  const NEW_DECK = '__new__';

  // ---------- library ----------
  let books = $state<BookMeta[]>([]);
  let loadingList = $state(true);
  let adding = $state(false);
  let addCourse = $state('');
  let usage = $state<{ usage: number; quota: number } | null>(null);
  let persistResult = $state<string | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);

  // ---------- reader ----------
  let book = $state<LibraryFile | null>(null);
  let page = $state(1);
  let pageCount = $state(0);
  let zoom = $state(1);
  let jump = $state('');
  let highlights = $state<Highlight[]>([]);
  let showHighlights = $state(false);
  let elapsed = $state(0);
  let timer: ReturnType<typeof setInterval> | undefined;

  // ---------- selection ----------
  let sel = $state<{ text: string; page: number } | null>(null);
  let cardForm = $state(false);
  let cardFront = $state('');
  let cardBack = $state('');
  let deckChoice = $state<string>(NEW_DECK);
  let explaining = $state(false);
  let explanation = $state<string | null>(null);
  let makingCards = $state(false);

  const bookmarked = $derived(!!book && book.bookmarks.includes(page));
  const clock = $derived(`${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`);
  const courseColor = (courseId?: string) => store.courseById(courseId)?.color ?? 'var(--border-strong)';

  $effect(() => {
    ui.captureKeys = !!book;
  });
  onMount(() => {
    void refreshList();
    void refreshUsage();
  });
  onDestroy(() => {
    ui.captureKeys = false;
    stopTimer();
  });

  async function refreshList() {
    try {
      books = await listBooks();
    } catch (e) {
      toasts.push({ message: 'Could not open the library', detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    } finally {
      loadingList = false;
    }
  }
  async function refreshUsage() {
    usage = await estimateUsage();
  }

  async function onFiles(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []).filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    input.value = '';
    if (!files.length) return;
    adding = true;
    let added = 0;
    let dupes = 0;
    try {
      const before = new Set(books.map((b) => b.id));
      for (const f of files) {
        const entry = await addBook(f, addCourse || undefined);
        if (before.has(entry.id)) dupes++;
        else added++;
      }
      await refreshList();
      await refreshUsage();
      toasts.push({
        message: added ? `Added ${added} PDF${added === 1 ? '' : 's'}` : 'Already in your library',
        detail: dupes && added ? `${dupes} already there` : undefined,
        kind: added ? 'success' : 'info',
        emoji: added ? '📚' : undefined,
      });
    } catch (e) {
      toasts.push({ message: 'Could not add the file', detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    } finally {
      adding = false;
    }
  }

  async function remove(b: BookMeta) {
    try {
      await deleteBook(b.id);
      books = books.filter((x) => x.id !== b.id);
      toasts.push({ message: `Removed “${b.name}”`, kind: 'info' });
      void refreshUsage();
    } catch (e) {
      toasts.push({ message: 'Could not delete', detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    }
  }

  async function keepData() {
    const ok = await requestPersistentStorage();
    persistResult = ok ? 'Your library is marked persistent; the browser won’t clear it to free space.' : 'The browser didn’t grant persistent storage. Installing the app or bookmarking it usually helps.';
    toasts.push({ message: ok ? 'Data will be kept' : 'Not granted', kind: ok ? 'success' : 'warn' });
  }

  // ---------- open / close ----------
  async function open(b: BookMeta) {
    try {
      const full = await getBook(b.id);
      if (!full) {
        toasts.push({ message: 'That file is gone from this browser', kind: 'warn' });
        await refreshList();
        return;
      }
      book = full;
      page = Math.max(1, full.lastPage || 1);
      pageCount = full.pageCount ?? 0;
      zoom = 1;
      sel = null;
      cardForm = false;
      explanation = null;
      showHighlights = false;
      highlights = await listHighlights(full.id);
      startTimer();
    } catch (e) {
      toasts.push({ message: 'Could not open', detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    }
  }
  function close() {
    stopTimer();
    book = null;
    sel = null;
    explanation = null;
    void refreshList();
  }
  function startTimer() {
    stopTimer();
    elapsed = 0;
    timer = setInterval(() => {
      elapsed++;
      if (elapsed % POMODORO_SEC === 0) {
        store.recordPomodoro();
        toasts.push({ message: 'Reading pomodoro done', detail: `${elapsed / 60} minutes in “${book?.name ?? 'your book'}”. Take a short break.`, kind: 'success', emoji: '🍅' });
      }
    }, 1000);
  }
  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = undefined;
  }

  // ---------- paging ----------
  function onPage(n: number, count: number) {
    if (!book) return;
    if (count !== pageCount) pageCount = count;
    if (n !== page) page = n;
    const patch: Partial<LibraryFile> = { lastPage: n };
    if (book.pageCount !== count) patch.pageCount = count;
    book = { ...book, ...patch };
    void updateBook(book.id, patch);
  }
  function go(n: number) {
    if (!book) return;
    const max = pageCount || Number.MAX_SAFE_INTEGER;
    const next = Math.min(max, Math.max(1, n));
    if (next === page) return;
    sel = null;
    onPage(next, pageCount);
  }
  function jumpTo(e: Event) {
    e.preventDefault();
    const n = parseInt(jump, 10);
    if (n) go(n);
    jump = '';
  }
  function setZoom(z: number) {
    zoom = Math.min(3, Math.max(0.5, Math.round(z * 10) / 10));
  }
  async function toggleBookmark() {
    if (!book) return;
    const has = book.bookmarks.includes(page);
    const bookmarks = has ? book.bookmarks.filter((p) => p !== page) : [...book.bookmarks, page].sort((a, b) => a - b);
    book = { ...book, bookmarks };
    await updateBook(book.id, { bookmarks });
    toasts.push({ message: has ? `Bookmark removed from page ${page}` : `Page ${page} bookmarked`, kind: 'info', timeout: 1500 });
  }

  // ---------- selection actions ----------
  function onSelect(text: string, p: number) {
    sel = { text, page: p };
    cardForm = false;
    explanation = null;
  }
  async function copySel() {
    if (!sel) return;
    try {
      await navigator.clipboard.writeText(sel.text);
      toasts.push({ message: 'Copied', kind: 'success', timeout: 1200 });
    } catch {
      toasts.push({ message: 'Clipboard blocked; select and press Ctrl/Cmd+C', kind: 'warn' });
    }
  }
  function openCardForm() {
    if (!sel) return;
    cardFront = sel.text.slice(0, 200);
    cardBack = '';
    cardForm = true;
  }
  function resolveDeck(): string {
    if (!book) throw new Error('No book open');
    if (deckChoice !== NEW_DECK) {
      const d = store.decks.find((x) => x.id === deckChoice);
      if (d) return d.id;
    }
    const existing = store.decks.find((d) => d.name === book!.name);
    if (existing) {
      deckChoice = existing.id;
      return existing.id;
    }
    const d = store.addDeck(book.name, book.courseId);
    deckChoice = d.id;
    return d.id;
  }
  function saveCard(e: Event) {
    e.preventDefault();
    if (!cardFront.trim() || !cardBack.trim()) return;
    const deckId = resolveDeck();
    const added = store.addCards(deckId, [{ front: cardFront, back: cardBack }]);
    toasts.push({ message: added.length ? 'Notecard added' : 'Nothing added', detail: added.length ? `In “${store.decks.find((d) => d.id === deckId)?.name ?? 'deck'}”` : undefined, kind: added.length ? 'success' : 'warn', emoji: added.length ? '🃏' : undefined });
    cardForm = false;
    sel = null;
  }
  async function saveHighlight() {
    if (!sel || !book) return;
    const h: Highlight = { id: uid('hl'), fileId: book.id, page: sel.page, text: sel.text, createdAt: new Date().toISOString() };
    await addHighlight(h);
    highlights = [...highlights, h].sort((a, b) => a.page - b.page || a.createdAt.localeCompare(b.createdAt));
    toasts.push({ message: 'Highlight saved', kind: 'success', timeout: 1500, emoji: '🖍️' });
    sel = null;
  }
  async function removeHighlight(h: Highlight) {
    await deleteHighlight(h.id);
    highlights = highlights.filter((x) => x.id !== h.id);
  }
  async function explainSel() {
    if (!sel || !book) return;
    explaining = true;
    explanation = null;
    try {
      explanation = await explain(sel.text, { topic: book.name });
    } catch (e) {
      toasts.push({ message: 'Could not explain', detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    } finally {
      explaining = false;
    }
  }
  async function cardsFromHighlights() {
    if (!book || !highlights.length) return;
    makingCards = true;
    try {
      let items: { front: string; back: string }[];
      if (aiAvailable()) {
        const joined = highlights.map((h) => `(p. ${h.page}) ${h.text}`).join('\n\n');
        items = await makeNotecards(joined, Math.min(20, Math.max(4, highlights.length)));
      } else {
        items = highlights.map((h) => ({ front: h.text.length > 80 ? h.text.slice(0, 80) + '…' : h.text, back: h.text }));
      }
      const deckId = resolveDeck();
      const added = store.addCards(deckId, items);
      toasts.push({ message: `Added ${added.length} card${added.length === 1 ? '' : 's'}`, detail: `In “${store.decks.find((d) => d.id === deckId)?.name ?? 'deck'}”`, kind: added.length ? 'success' : 'warn', emoji: '🃏' });
    } catch (e) {
      toasts.push({ message: 'Could not make cards', detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    } finally {
      makingCards = false;
    }
  }

  // ---------- keyboard ----------
  function onKey(e: KeyboardEvent) {
    if (!book || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(page - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(page + 1);
    } else if (e.key === 'b') {
      e.preventDefault();
      void toggleBookmark();
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      setZoom(zoom + 0.1);
    } else if (e.key === '-') {
      e.preventDefault();
      setZoom(zoom - 0.1);
    } else if (e.key === 'Escape' && sel) {
      sel = null;
      cardForm = false;
    }
  }
</script>

<svelte:window onkeydown={onKey} />

{#if !book}
  <section class="card">
    <h2>Reader</h2>
    <p class="help">Keep textbooks and readings here, pick up where you left off, and turn what you read into highlights and notecards. <strong>Files stay in this browser only; nothing is uploaded.</strong></p>
    <div class="addrow">
      <input type="file" accept=".pdf,application/pdf" multiple hidden bind:this={fileInput} onchange={onFiles} />
      <button class="btn primary" onclick={() => fileInput?.click()} disabled={adding}>{adding ? 'Adding…' : '+ Add PDF'}</button>
      <select class="select" bind:value={addCourse} aria-label="Course for new files">
        <option value="">No course</option>
        {#each store.activeCourses as c (c.id)}<option value={c.id}>{c.emoji ?? ''} {c.name}</option>{/each}
      </select>
    </div>
    {#if loadingList}
      <p class="muted">Loading…</p>
    {:else if !books.length}
      <p class="muted">No PDFs yet. Add a textbook chapter, a packet, or an article.</p>
    {:else}
      <ul class="books">
        {#each books as b (b.id)}
          <li>
            <button class="book" onclick={() => open(b)}>
              <span class="dot" style="background:{courseColor(b.courseId)}"></span>
              <span class="name">{b.name}</span>
              <span class="meta">{formatBytes(b.size)}{b.pageCount ? ` · page ${b.lastPage}/${b.pageCount}` : b.lastPage > 1 ? ` · page ${b.lastPage}` : ''}{b.bookmarks.length ? ` · ${b.bookmarks.length} ★` : ''}</span>
              {#if b.pageCount}
                <span class="prog"><span class="fill" style="width:{Math.min(100, (b.lastPage / b.pageCount) * 100)}%"></span></span>
              {/if}
            </button>
            <button class="btn ghost sm icon" aria-label="Delete {b.name}" onclick={() => remove(b)}>×</button>
          </li>
        {/each}
      </ul>
    {/if}
    <div class="storage">
      <span class="muted">{usage ? `Using ${formatBytes(usage.usage)}${usage.quota ? ` of ${formatBytes(usage.quota)}` : ''} in this browser.` : 'Storage usage unavailable.'}</span>
      <button class="btn sm" onclick={keepData}>Keep my data</button>
    </div>
    {#if persistResult}<p class="muted small">{persistResult}</p>{/if}
  </section>
{:else}
  <section class="card reader">
    <div class="toolbar">
      <button class="btn ghost sm" onclick={close}>← Library</button>
      <span class="title" title={book.name}>{book.name}</span>
      <span class="timer" title="Reading timer">⏱ {clock}</span>
      <div class="group">
        <button class="btn sm icon" onclick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous page">‹</button>
        <form class="jump" onsubmit={jumpTo}>
          <input class="input pg" type="number" min="1" max={pageCount || undefined} bind:value={jump} placeholder={String(page)} aria-label="Go to page" />
          <span class="muted">/ {pageCount || '…'}</span>
        </form>
        <button class="btn sm icon" onclick={() => go(page + 1)} disabled={!!pageCount && page >= pageCount} aria-label="Next page">›</button>
      </div>
      <div class="group">
        <button class="btn sm icon" onclick={() => setZoom(zoom - 0.1)} disabled={zoom <= 0.5} aria-label="Zoom out">−</button>
        <span class="muted zoom">{Math.round(zoom * 100)}%</span>
        <button class="btn sm icon" onclick={() => setZoom(zoom + 0.1)} disabled={zoom >= 3} aria-label="Zoom in">+</button>
      </div>
      <button class="btn sm icon" class:star={bookmarked} onclick={toggleBookmark} aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this page'} aria-pressed={bookmarked}>{bookmarked ? '★' : '☆'}</button>
      <button class="btn sm" class:on={showHighlights} onclick={() => (showHighlights = !showHighlights)}>Highlights{highlights.length ? ` (${highlights.length})` : ''}</button>
    </div>
    {#if book.bookmarks.length}
      <div class="bookmarks">
        <span class="muted">Bookmarks:</span>
        {#each book.bookmarks as p (p)}
          <button class="chip" class:on={p === page} onclick={() => go(p)}>p. {p}</button>
        {/each}
      </div>
    {/if}

    {#if sel}
      <div class="popover" in:fly={{ y: -6, duration: 160 }}>
        <span class="snippet" title={sel.text}>“{sel.text.length > 60 ? sel.text.slice(0, 60) + '…' : sel.text}”</span>
        <div class="acts">
          <button class="btn sm" onclick={copySel}>Copy</button>
          <button class="btn sm" onclick={openCardForm}>Make notecard</button>
          <button class="btn sm" onclick={saveHighlight}>Save highlight</button>
          {#if aiAvailable()}<button class="btn sm" onclick={explainSel} disabled={explaining}>{explaining ? 'Thinking…' : '✨ Explain'}</button>{/if}
          <button class="btn ghost sm icon" onclick={() => { sel = null; cardForm = false; explanation = null; }} aria-label="Dismiss">×</button>
        </div>
        {#if cardForm}
          <form class="cardform" onsubmit={saveCard}>
            <input class="input" bind:value={cardFront} maxlength="200" placeholder="Front (term or question)" aria-label="Front" />
            <input class="input" bind:value={cardBack} placeholder="Back (definition or answer)" aria-label="Back" />
            <select class="select" bind:value={deckChoice} aria-label="Deck">
              <option value={NEW_DECK}>New deck named “{book.name}”</option>
              {#each store.decks as d (d.id)}<option value={d.id}>{d.name}</option>{/each}
            </select>
            <button class="btn primary sm" type="submit" disabled={!cardFront.trim() || !cardBack.trim()}>Add card</button>
          </form>
        {/if}
      </div>
    {/if}

    {#if showHighlights}
      <div class="hl-panel">
        <div class="hl-head">
          <strong>Highlights</strong>
          <button class="btn sm" onclick={cardsFromHighlights} disabled={!highlights.length || makingCards}>{makingCards ? 'Making…' : aiAvailable() ? '✨ Make cards from all highlights' : 'Make cards from all highlights'}</button>
        </div>
        {#if !highlights.length}
          <p class="muted">Select text on a page and choose “Save highlight”.</p>
        {:else}
          <ul class="hls">
            {#each highlights as h (h.id)}
              <li>
                <button class="pagelink" onclick={() => go(h.page)}>p. {h.page}</button>
                <span class="hltext">{h.text}</span>
                <button class="btn ghost sm icon" aria-label="Delete highlight" onclick={() => removeHighlight(h)}>×</button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}

    <div class="stage">
      <PdfViewer blob={book.blob} {page} {zoom} onpage={onPage} onselect={onSelect} />
    </div>

    {#if explanation !== null}
      <div class="explain" in:fly={{ y: 8, duration: 200 }}>
        <div class="hl-head">
          <strong>✨ Explanation</strong>
          <button class="btn ghost sm icon" onclick={() => (explanation = null)} aria-label="Close explanation">×</button>
        </div>
        <div class="md">{@html renderMarkdown(explanation)}</div>
      </div>
    {/if}
    <p class="muted small keys">← → pages · b bookmark · + − zoom · select text for actions</p>
  </section>
{/if}

<style>
  h2 { font-size: 16px; margin: 0 0 8px; }
  .help, .muted { font-size: 13px; color: var(--text-muted); font-weight: 400; }
  .help { margin: 0 0 10px; }
  .small { font-size: 12px; }
  .addrow { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; align-items: center; }
  .addrow .select { width: auto; }
  .books { list-style: none; margin: 0 0 10px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .books li { display: flex; align-items: center; gap: 4px; }
  .book { flex: 1; min-width: 0; display: grid; grid-template-columns: 12px 1fr; gap: 4px 10px; align-items: center; padding: 10px 12px; border-radius: 10px; background: var(--bg-elev-2); text-align: left; color: var(--text); }
  .book:hover { background: var(--bg-hover); }
  .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .meta { grid-column: 2; font-size: 12px; color: var(--text-muted); }
  .prog { grid-column: 2; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
  .prog .fill { display: block; height: 100%; background: var(--accent); }
  .storage { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; border-top: 1px solid var(--border); padding-top: 10px; }

  .reader { padding: 12px; }
  .toolbar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
  .title { flex: 1 1 140px; min-width: 0; font-weight: 600; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .timer { font-size: 12px; color: var(--text-muted); font-variant-numeric: tabular-nums; }
  .group { display: inline-flex; align-items: center; gap: 4px; }
  .jump { display: inline-flex; align-items: center; gap: 4px; }
  .input.pg { width: 58px; padding: 4px 6px; font-size: 13px; text-align: center; -moz-appearance: textfield; appearance: textfield; }
  .zoom { min-width: 40px; text-align: center; font-variant-numeric: tabular-nums; }
  .btn.star { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 50%, transparent); }
  .btn.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); }
  .bookmarks { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; margin-bottom: 8px; }
  .chip { padding: 2px 8px; border-radius: 999px; font-size: 12px; background: var(--bg-elev-2); border: 1px solid var(--border); color: var(--text-muted); }
  .chip.on { border-color: var(--accent); color: var(--text); }

  .popover { position: sticky; top: 8px; z-index: 5; margin-bottom: 8px; padding: 8px 10px; border-radius: 10px; background: var(--bg-elev-2); border: 1px solid var(--border-strong); box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 6px; }
  .snippet { font-size: 12px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .acts { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
  .cardform { display: grid; grid-template-columns: 1fr 1fr auto auto; gap: 6px; }
  .cardform .select { width: auto; max-width: 200px; }

  .hl-panel, .explain { margin-bottom: 8px; padding: 10px 12px; border-radius: 10px; background: var(--bg-elev-2); border: 1px solid var(--border); }
  .hl-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; font-size: 14px; }
  .hls { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .hls li { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: start; font-size: 13px; padding: 4px 0; border-top: 1px solid var(--border); }
  .pagelink { color: var(--accent); font-weight: 600; font-size: 12px; white-space: nowrap; padding-top: 2px; }
  .hltext { color: var(--text); line-height: 1.4; }
  .explain { margin-top: 8px; }
  .md { font-size: 14px; line-height: 1.5; }
  .md :global(p) { margin: 0 0 8px; }
  .md :global(h3), .md :global(h4), .md :global(h5) { margin: 10px 0 4px; font-size: 14px; }
  .md :global(ul), .md :global(ol) { margin: 0 0 8px; padding-left: 20px; }
  .md :global(code) { font-family: var(--mono); font-size: 12px; background: var(--bg-elev); padding: 1px 4px; border-radius: 4px; }

  .stage { position: relative; width: 100%; max-width: 100%; }
  .keys { margin: 8px 0 0; text-align: center; }
  @media (max-width: 600px) {
    .cardform { grid-template-columns: 1fr; }
    .cardform .select { max-width: none; width: 100%; }
    .keys { display: none; }
  }
</style>
