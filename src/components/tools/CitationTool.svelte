<script lang="ts">
  import { citationHTML, citationText, formatCitation, lookup, sortKey, splitName, type CitationStyle, type Source, type SourceType } from '../../lib/citations';
  import { toasts } from '../../lib/toast.svelte';
  import { uid } from '../../lib/id';

  const KEY = 'homework-todo:citations';
  type Saved = Source & { id: string };
  let list = $state<Saved[]>(
    (() => {
      try {
        return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Saved[];
      } catch {
        return [];
      }
    })(),
  );
  let style = $state<CitationStyle>('mla');
  let query = $state('');
  let busy = $state(false);
  let draft = $state<Source>(blank('website'));
  let authorsText = $state('');

  function blank(type: SourceType): Source {
    return { type, authors: [], title: '', accessed: new Date().toISOString().slice(0, 10) };
  }
  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }
  async function find() {
    if (!query.trim()) return;
    busy = true;
    try {
      const s = await lookup(query);
      draft = { ...blank(s.type), ...s };
      authorsText = s.authors.map((a) => [a.given, a.family].filter(Boolean).join(' ')).join('; ');
      toasts.push({ message: s.title ? `Found “${s.title.slice(0, 60)}”` : 'Filled in what we could', detail: 'Check the details, then add it.', kind: 'success' });
    } catch (e) {
      toasts.push({ message: 'Lookup failed', detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    } finally {
      busy = false;
    }
  }
  const current = $derived<Source>({
    ...draft,
    authors: authorsText
      .split(';')
      .map((a) => a.trim())
      .filter(Boolean)
      .map(splitName),
  });
  function add() {
    if (!current.title.trim()) return toasts.push({ message: 'Add a title first', kind: 'warn' });
    list = [...list, { ...$state.snapshot(current), id: uid('cite') } as Saved];
    persist();
    draft = blank(draft.type);
    authorsText = '';
    query = '';
  }
  function remove(id: string) {
    list = list.filter((s) => s.id !== id);
    persist();
  }
  const sorted = $derived([...list].sort((a, b) => sortKey(a).localeCompare(sortKey(b))));
  const heading = $derived(style === 'mla' ? 'Works Cited' : style === 'apa' ? 'References' : 'Bibliography');
  async function copyAll() {
    const html = `<p><b>${heading}</b></p>` + sorted.map((s) => `<p style="padding-left:0.5in;text-indent:-0.5in">${citationHTML(formatCitation(s, style))}</p>`).join('');
    const text = `${heading}\n\n` + sorted.map((s) => citationText(formatCitation(s, style))).join('\n\n');
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
    } catch {
      await navigator.clipboard.writeText(text);
    }
    toasts.push({ message: `Copied ${heading}`, detail: 'Paste into Google Docs or Word: italics are kept.', kind: 'success' });
  }
</script>

<section class="card">
  <h2>Citation generator</h2>
  <div class="cz-seg" role="radiogroup" aria-label="Style">
    {#each [['mla', 'MLA 9'], ['apa', 'APA 7'], ['chicago', 'Chicago']] as [id, label] (id)}
      <button role="radio" aria-checked={style === id} class:on={style === id} onclick={() => (style = id as CitationStyle)}>{label}</button>
    {/each}
  </div>
  <form
    class="find"
    onsubmit={(e) => {
      e.preventDefault();
      void find();
    }}
  >
    <input class="input" bind:value={query} placeholder="Paste a DOI, ISBN or web address" aria-label="DOI, ISBN or URL" />
    <button class="btn" type="submit" disabled={busy}>{busy ? 'Looking up…' : 'Look up'}</button>
  </form>

  <div class="form">
    <select class="select" bind:value={draft.type} aria-label="Source type">
      <option value="website">Web page</option>
      <option value="article">Journal article</option>
      <option value="book">Book</option>
    </select>
    <input class="input wide" bind:value={authorsText} placeholder="Authors: First Last; First Last" aria-label="Authors" />
    <input class="input wide" bind:value={draft.title} placeholder="Title" aria-label="Title" />
    {#if draft.type !== 'book'}<input class="input" bind:value={draft.container} placeholder={draft.type === 'article' ? 'Journal' : 'Website name'} aria-label="Container" />{/if}
    <input class="input" bind:value={draft.publisher} placeholder="Publisher" aria-label="Publisher" />
    {#if draft.type === 'book'}<input class="input" bind:value={draft.place} placeholder="City (Chicago)" aria-label="City" />{/if}
    <input class="input sm" bind:value={draft.year} placeholder="Year" aria-label="Year" />
    {#if draft.type === 'article'}
      <input class="input sm" bind:value={draft.volume} placeholder="Vol." aria-label="Volume" />
      <input class="input sm" bind:value={draft.issue} placeholder="No." aria-label="Issue" />
      <input class="input sm" bind:value={draft.pages} placeholder="Pages" aria-label="Pages" />
    {/if}
    <input class="input wide" bind:value={draft.url} placeholder="URL (or DOI below)" aria-label="URL" />
    <input class="input" bind:value={draft.doi} placeholder="DOI" aria-label="DOI" />
    {#if draft.type === 'website'}<label class="acc">Accessed <input class="input" type="date" bind:value={draft.accessed} /></label>{/if}
  </div>
  {#if current.title}
    <p class="preview">{@html citationHTML(formatCitation(current, style))}</p>
  {/if}
  <div class="btns"><button class="btn primary" onclick={add}>Add to list</button></div>

  {#if sorted.length}
    <h3>{heading} <span class="muted">({sorted.length})</span></h3>
    <ol class="cites">
      {#each sorted as s (s.id)}
        <li>
          <span class="c">{@html citationHTML(formatCitation(s, style))}</span><button class="btn ghost sm" onclick={() => remove(s.id)} aria-label="Remove citation">✕</button>
        </li>
      {/each}
    </ol>
    <div class="btns"><button class="btn" onclick={() => void copyAll()}>Copy {heading}</button></div>
  {/if}
  <p class="help">Lookups use Crossref (DOIs) and Open Library (ISBNs). Always double-check against your teacher's style guide.</p>
</section>

<style>
  h2 {
    font-size: 16px;
    margin: 0 0 8px;
  }
  h3 {
    font-size: 15px;
    margin: 16px 0 6px;
  }
  .find {
    display: flex;
    gap: 8px;
    margin: 10px 0;
  }
  .find .input {
    flex: 1;
  }
  .form {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .form .input {
    flex: 1 1 160px;
  }
  .form .wide {
    flex: 2 1 280px;
  }
  .form .sm {
    flex: 0 1 80px;
  }
  .acc {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 13px;
    color: var(--text-muted);
  }
  .preview {
    background: var(--bg-elev-2);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
    font-family: 'Times New Roman', Georgia, serif;
    font-size: 15px;
  }
  .cites {
    padding-left: 0;
    list-style: none;
  }
  .cites li {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    padding: 6px 0;
    border-top: 1px solid var(--border);
  }
  .c {
    flex: 1;
    padding-left: 2em;
    text-indent: -2em;
    font-family: 'Times New Roman', Georgia, serif;
    font-size: 15px;
  }
  .btns {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
  .help,
  .muted {
    font-size: 13px;
    color: var(--text-muted);
  }
</style>
