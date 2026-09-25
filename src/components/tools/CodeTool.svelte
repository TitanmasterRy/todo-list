<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { EditorView, basicSetup } from 'codemirror';
  import { Compartment, EditorState, Prec, type Extension } from '@codemirror/state';
  import { keymap } from '@codemirror/view';
  import { indentUnit } from '@codemirror/language';
  import { indentWithTab } from '@codemirror/commands';
  import { oneDark } from '@codemirror/theme-one-dark';

  import { LANGUAGES, deleteSnippet, languageExt, languageLabel, listSnippets, newSnippet, saveSnippet, type Snippet, type SnippetLanguage } from '../../lib/snippets';
  import { CSS_SAMPLE_HTML, ONECOMPILER_URLS, canRun, runHTML, runJavaScript, runPython } from '../../lib/coderunner';
  import { downloadText } from '../../lib/download';
  import SandboxFrame from '../SandboxFrame.svelte';
  import { toasts } from '../../lib/toast.svelte';

  // ---------- snippets ----------
  let snippets = $state<Snippet[]>([]);
  let selectedId = $state<string | null>(null);
  let newLang = $state<SnippetLanguage>('javascript');
  let renamingId = $state<string | null>(null);
  let renameValue = $state('');
  let renameInput: HTMLInputElement | undefined = $state();
  const selected = $derived(snippets.find((s) => s.id === selectedId) ?? null);
  const runnable = $derived(selected ? canRun(selected.language) : false);

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let dirtyId: string | null = null;

  function flushSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = undefined;
    if (!dirtyId) return;
    const s = snippets.find((x) => x.id === dirtyId);
    dirtyId = null;
    if (s) saveSnippet($state.snapshot(s));
  }
  function scheduleSave(id: string) {
    if (dirtyId && dirtyId !== id) flushSave();
    dirtyId = id;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 500);
  }

  function create() {
    flushSave();
    const s = saveSnippet(newSnippet(newLang));
    snippets = [s, ...snippets];
    select(s.id);
  }
  function select(id: string) {
    if (id === selectedId) return;
    flushSave();
    selectedId = id;
    clearOutput();
  }
  function startRename(s: Snippet) {
    renamingId = s.id;
    renameValue = s.name;
    setTimeout(() => renameInput?.select(), 0);
  }
  function commitRename() {
    if (!renamingId) return;
    const s = snippets.find((x) => x.id === renamingId);
    const name = renameValue.trim();
    if (s && name && name !== s.name) {
      s.name = name;
      saveSnippet($state.snapshot(s));
    }
    renamingId = null;
  }
  function renameKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename();
    } else if (e.key === 'Escape') {
      renamingId = null;
    }
  }
  function remove(s: Snippet) {
    if (!confirm(`Delete “${s.name}”? This can’t be undone.`)) return;
    if (dirtyId === s.id) {
      dirtyId = null;
      if (saveTimer) clearTimeout(saveTimer);
    }
    deleteSnippet(s.id);
    const i = snippets.findIndex((x) => x.id === s.id);
    snippets = snippets.filter((x) => x.id !== s.id);
    if (selectedId === s.id) {
      selectedId = snippets[Math.min(i, snippets.length - 1)]?.id ?? null;
      clearOutput();
    }
  }
  function setLanguage(lang: SnippetLanguage) {
    if (!selected || selected.language === lang) return;
    selected.language = lang;
    scheduleSave(selected.id);
    clearOutput();
  }

  // ---------- editor ----------
  let editorEl: HTMLDivElement | undefined = $state();
  let view: EditorView | undefined;
  let loadedId: string | null = null;
  let loadedLang: SnippetLanguage | null = null;
  const langComp = new Compartment();
  const themeComp = new Compartment();

  // Language packages load on first use, so opening the editor doesn't download all six.
  const langCache = new Map<SnippetLanguage, Extension>();
  async function langExt(l: SnippetLanguage): Promise<Extension> {
    const hit = langCache.get(l);
    if (hit) return hit;
    const unit = indentUnit.of(l === 'python' ? '    ' : '  ');
    let ext: Extension;
    switch (l) {
      case 'javascript':
        ext = (await import('@codemirror/lang-javascript')).javascript();
        break;
      case 'typescript':
        ext = (await import('@codemirror/lang-javascript')).javascript({ typescript: true });
        break;
      case 'python':
        ext = (await import('@codemirror/lang-python')).python();
        break;
      case 'html':
        ext = (await import('@codemirror/lang-html')).html();
        break;
      case 'css':
        ext = (await import('@codemirror/lang-css')).css();
        break;
      case 'java':
        ext = (await import('@codemirror/lang-java')).java();
        break;
      case 'cpp':
        ext = (await import('@codemirror/lang-cpp')).cpp();
        break;
    }
    const full = [ext, unit];
    langCache.set(l, full);
    return full;
  }
  /** Load a language and apply it if it's still the one being edited. */
  function applyLang(l: SnippetLanguage) {
    void langExt(l).then((ext) => {
      if (view && loadedLang === l) view.dispatch({ effects: langComp.reconfigure(ext) });
    });
  }
  function isDark(): boolean {
    const root = document.documentElement;
    const t = root.dataset.theme;
    return t === 'dark' || (t !== 'light' && root.classList.contains('force-dark'));
  }
  const lightTheme = EditorView.theme(
    {
      '&': { backgroundColor: 'var(--bg-elev)', color: 'var(--text)' },
      '.cm-gutters': { backgroundColor: 'var(--bg-elev-2)', color: 'var(--text-faint)', borderRight: '1px solid var(--border)' },
      '.cm-activeLineGutter': { backgroundColor: 'var(--bg-hover)' },
      '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--accent) 6%, transparent)' },
    },
    { dark: false },
  );
  const baseTheme = EditorView.theme({
    '&': { fontSize: '13.5px', height: '100%' },
    '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.5' },
    '.cm-content': { padding: '8px 0' },
    '&.cm-focused': { outline: 'none' },
  });
  function themeExt(): Extension {
    return isDark() ? oneDark : lightTheme;
  }

  function loadIntoEditor() {
    if (!view) return;
    const s = untrack(() => selected);
    if (!s) {
      if (loadedId !== null) {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '' } });
        loadedId = null;
        loadedLang = null;
      }
      return;
    }
    const langChanged = s.language !== loadedLang;
    if (s.id !== loadedId) {
      loadedId = s.id;
      loadedLang = s.language;
      view.setState(
        EditorState.create({
          doc: s.code,
          extensions: extensions(),
        }),
      );
      applyLang(s.language);
    } else if (langChanged) {
      loadedLang = s.language;
      applyLang(s.language);
    }
  }
  function extensions(): Extension[] {
    return [
      basicSetup,
      baseTheme,
      EditorView.lineWrapping,
      EditorState.tabSize.of(2),
      keymap.of([indentWithTab]),
      Prec.highest(
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              void run();
              return true;
            },
          },
        ]),
      ),
      langComp.of([]),
      themeComp.of(themeExt()),
      EditorView.updateListener.of((u) => {
        if (!u.docChanged || !loadedId) return;
        const s = snippets.find((x) => x.id === loadedId);
        if (!s) return;
        s.code = u.state.doc.toString();
        scheduleSave(s.id);
      }),
    ];
  }

  onMount(() => {
    const stored = listSnippets();
    if (stored.length) {
      snippets = stored;
    } else {
      const s = saveSnippet(newSnippet('javascript'));
      snippets = [s];
    }
    selectedId = snippets[0]?.id ?? null;

    view = new EditorView({ parent: editorEl, state: EditorState.create({ doc: '', extensions: extensions() }) });
    loadIntoEditor();

    const mo = new MutationObserver(() => {
      view?.dispatch({ effects: themeComp.reconfigure(themeExt()) });
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });

    return () => {
      flushSave();
      mo.disconnect();
      view?.destroy();
      view = undefined;
    };
  });

  $effect(() => {
    // Re-load when the selection or its language changes (not on every keystroke).
    void selected?.id;
    void selected?.language;
    untrack(loadIntoEditor);
  });

  // ---------- run ----------
  let running = $state(false);
  let status = $state('');
  let output = $state<string[]>([]);
  let error = $state('');
  let ms = $state<number | null>(null);
  let previewDoc = $state('');
  let ran = $state(false);

  function clearOutput() {
    output = [];
    error = '';
    ms = null;
    previewDoc = '';
    status = '';
    ran = false;
  }
  async function run() {
    const s = selected;
    if (!s || running) return;
    flushSave();
    if (!canRun(s.language)) {
      toasts.push({ message: `Run isn’t available for ${languageLabel(s.language)} in the browser`, detail: 'Use the editor for notes and copy to your IDE.', kind: 'info' });
      return;
    }
    clearOutput();
    ran = true;
    running = true;
    try {
      if (s.language === 'html') {
        previewDoc = runHTML(s.code);
        ms = 0;
      } else if (s.language === 'css') {
        previewDoc = runHTML(CSS_SAMPLE_HTML, s.code);
        ms = 0;
      } else if (s.language === 'python') {
        const r = await runPython(s.code, { onStatus: (t) => (status = t) });
        output = r.output;
        error = r.error ?? '';
        ms = r.ms;
      } else {
        const r = await runJavaScript(s.code);
        output = r.output;
        error = r.error ?? '';
        ms = r.ms;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      running = false;
      status = '';
    }
  }
  async function copyCode() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.code);
      toasts.push({ message: 'Code copied', kind: 'success' });
    } catch {
      toasts.push({ message: 'Couldn’t copy', detail: 'Select the code and copy it manually.', kind: 'warn' });
    }
  }
  const MIME: Record<SnippetLanguage, string> = {
    javascript: 'text/javascript',
    typescript: 'text/plain',
    python: 'text/x-python',
    html: 'text/html',
    css: 'text/css',
    java: 'text/x-java-source',
    cpp: 'text/x-c++src',
  };
  function download() {
    if (!selected) return;
    flushSave();
    const base =
      selected.name
        .trim()
        .replace(/[^\w.-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'snippet';
    const filename = `${base}.${languageExt(selected.language)}`;
    downloadText(filename, selected.code, MIME[selected.language]);
    toasts.push({ message: `Downloaded ${filename}`, kind: 'success' });
  }
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
</script>

<section class="card code">
  <div class="head">
    <h2>Code</h2>
    <div class="new">
      <select class="select" bind:value={newLang} aria-label="Language for new snippet">
        {#each LANGUAGES as l (l.id)}<option value={l.id}>{l.label}</option>{/each}
      </select>
      <button class="btn primary sm" onclick={create}>+ New</button>
    </div>
  </div>

  <div class="layout">
    <aside class="side">
      {#if !snippets.length}
        <p class="muted">No snippets yet. Pick a language and press New.</p>
      {:else}
        <ul class="list" role="listbox" aria-label="Snippets">
          {#each snippets as s (s.id)}
            <li class:on={s.id === selectedId}>
              {#if renamingId === s.id}
                <input class="input rename" bind:this={renameInput} bind:value={renameValue} onkeydown={renameKey} onblur={commitRename} aria-label="Snippet name" />
              {:else}
                <button
                  class="pick"
                  role="option"
                  aria-selected={s.id === selectedId}
                  onclick={() => select(s.id)}
                  ondblclick={() => startRename(s)}
                  title="Double-click to rename"
                >
                  <span class="nm">{s.name}</span>
                  <span class="chip lang">{languageLabel(s.language)}</span>
                </button>
                <button class="btn ghost icon" onclick={() => startRename(s)} aria-label="Rename {s.name}" title="Rename">✎</button>
                <button class="btn ghost icon" onclick={() => remove(s)} aria-label="Delete {s.name}" title="Delete">🗑</button>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </aside>

    <div class="main">
      <div class="bar">
        {#if selected}
          <select
            class="select lang-sel"
            value={selected.language}
            onchange={(e) => setLanguage((e.target as HTMLSelectElement).value as SnippetLanguage)}
            aria-label="Snippet language"
          >
            {#each LANGUAGES as l (l.id)}<option value={l.id}>{l.label}</option>{/each}
          </select>
        {/if}
        <button class="btn primary sm" onclick={run} disabled={!selected || !runnable || running} title="{isMac ? '⌘' : 'Ctrl'}+Enter">
          {running ? 'Running…' : 'Run ▶'}
        </button>
        <button class="btn sm" onclick={copyCode} disabled={!selected}>Copy code</button>
        <button class="btn sm" onclick={download} disabled={!selected}>Download</button>
        <span class="hint muted">{isMac ? '⌘' : 'Ctrl'}+Enter runs</span>
      </div>

      {#if selected?.language === 'typescript'}
        <p class="note">TypeScript runs here as plain JavaScript: type annotations aren’t stripped, so keep to JS-compatible syntax when you press Run.</p>
      {/if}
      {#if selected && !runnable}
        <p class="note">
          Run isn’t available for Java/C++ in the browser; use the editor for notes and copy to your IDE.
          <a class="ext" href={ONECOMPILER_URLS[selected.language]} target="_blank" rel="noopener noreferrer">Open in OneCompiler ↗</a>
          <span class="muted">(nothing is sent automatically; paste your code there)</span>
        </p>
      {/if}

      <div class="editor" bind:this={editorEl} class:hidden={!selected}></div>
      {#if !selected}
        <p class="muted empty">Select or create a snippet to start editing.</p>
      {/if}

      {#if status}
        <p class="status" aria-live="polite"><span class="spin" aria-hidden="true"></span> {status}</p>
      {/if}

      {#if ran && (previewDoc || output.length || error || ms !== null)}
        <div class="out">
          <div class="out-head">
            <span>{previewDoc ? 'Preview' : 'Output'}</span>
            {#if ms !== null && !previewDoc}<span class="muted">{ms} ms</span>{/if}
          </div>
          {#if previewDoc}
            {#key previewDoc}<SandboxFrame class="preview" sandbox="allow-scripts" html={previewDoc} title="HTML preview" />{/key}
          {:else}
            <pre class="console" aria-live="polite">{#if !output.length && !error}<span class="muted">(no output)</span>{/if}{#each output as line, i (i)}<span
                  class="line"
                  class:err={line.startsWith('✖ ')}
                  class:warn={line.startsWith('⚠ ')}
                  class:val={line.startsWith('→ ')}>{line}</span
                >{/each}{#if error}<span class="line err">{error}</span>{/if}</pre>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</section>

<style>
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  h2 {
    font-size: 16px;
    margin: 0;
  }
  .new {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .new .select {
    width: auto;
    padding: 5px 8px;
    font-size: 13px;
  }
  .layout {
    display: grid;
    grid-template-columns: 200px minmax(0, 1fr);
    gap: 12px;
  }
  .side {
    min-width: 0;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 60vh;
    overflow-y: auto;
  }
  .list li {
    display: flex;
    align-items: center;
    gap: 2px;
    border-radius: 8px;
  }
  .list li.on {
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }
  .list li:not(.on):hover {
    background: var(--bg-hover);
  }
  .pick {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    text-align: left;
    color: var(--text);
    font-size: 13px;
    border-radius: 8px;
  }
  .pick .nm {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chip.lang {
    font-size: 10px;
    padding: 0 6px;
  }
  .list li .btn.icon {
    width: 26px;
    height: 26px;
    padding: 0;
    font-size: 12px;
    opacity: 0;
  }
  .list li:hover .btn.icon,
  .list li.on .btn.icon,
  .list li .btn.icon:focus-visible {
    opacity: 1;
  }
  .rename {
    padding: 4px 8px;
    font-size: 13px;
  }
  .main {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .lang-sel {
    width: auto;
    padding: 5px 8px;
    font-size: 13px;
  }
  .hint {
    margin-left: auto;
    font-size: 12px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  .note {
    margin: 0;
    font-size: 13px;
    color: var(--text-muted);
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--bg-elev-2);
  }
  .ext {
    color: var(--accent-text);
    font-weight: 600;
    margin-left: 4px;
  }
  .editor {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
    height: 320px;
    resize: vertical;
    min-height: 120px;
  }
  .editor.hidden {
    display: none;
  }
  .editor :global(.cm-editor) {
    height: 100%;
  }
  .empty {
    margin: 0;
    padding: 20px;
    text-align: center;
  }
  .status {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 13px;
    color: var(--text-muted);
  }
  .spin {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid var(--border-strong);
    border-top-color: var(--accent);
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .out {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }
  .out-head {
    display: flex;
    justify-content: space-between;
    padding: 4px 10px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
    background: var(--bg-elev-2);
    border-bottom: 1px solid var(--border);
  }
  .console {
    margin: 0;
    padding: 8px 10px;
    font-family: var(--mono);
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 260px;
    overflow: auto;
    background: var(--bg-elev-2);
  }
  .line {
    display: block;
  }
  .line.err {
    color: var(--danger-text);
  }
  .line.warn {
    color: var(--warn-text);
  }
  .line.val {
    color: var(--text-muted);
  }
  .out :global(.preview) {
    display: block;
    width: 100%;
    height: 320px;
    border: 0;
    background: #fff;
  }
  @media (max-width: 720px) {
    .layout {
      grid-template-columns: 1fr;
    }
    .list {
      flex-direction: row;
      flex-wrap: wrap;
      max-height: none;
    }
    .list li {
      flex: 1 1 160px;
    }
    .list li .btn.icon {
      opacity: 1;
    }
  }
</style>
