<script lang="ts">
  // Play → Arcade → ➕ Add a game: drop an .html, .js or .zip (or a whole folder, or several files), paste code, or
  // paste a link. It's bundled into one page (lib/gamebundle.ts), previewed, and saved to this browser's arcade.
  // With a parent PIN set, adding a game asks for it.
  import { fly } from 'svelte/transition';
  import { unzipSync } from 'fflate';
  import { focusTrap } from '../../lib/focusTrap';
  import { arcade } from '../../lib/arcade.svelte';
  import { slugify } from '../../lib/arcade';
  import { bundleGame, gameEmbedUrl, looksLikeHtml, titleFromHtml, titleFromUrl, wrapScript, type InFile } from '../../lib/gamebundle';
  import { checkPin } from '../../lib/parental';
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import type { ArcadeGame } from '../../lib/types';
  import GamePlayer from './GamePlayer.svelte';

  let { onclose }: { onclose: () => void } = $props();

  let mode = $state<'files' | 'code' | 'link'>('files');
  let html = $state('');
  let url = $state('');
  let code = $state('');
  let title = $state('');
  let emoji = $state('🎮');
  let cost = $state(1);
  let minutes = $state(0);
  let note = $state('');
  let error = $state('');
  let dragging = $state(false);
  let busy = $state(false);
  let preview = $state<ArcadeGame | null>(null);
  let pin = $state('');

  const EMOJIS = ['🎮', '🕹️', '👾', '🚀', '🏎️', '⚽', '🧩', '🐍', '🧱', '🎯', '🃏', '🐉', '🔫', '🏰', '🌍', '🎵'];
  const locked = $derived(!!store.settings.parentPinHash);
  const ready = $derived(mode === 'link' ? !!gameEmbedUrl(url) : !!html);

  async function readFiles(list: File[], paths?: string[]) {
    error = note = '';
    busy = true;
    try {
      const inputs: InFile[] = [];
      for (const [i, file] of list.entries()) {
        const data = new Uint8Array(await file.arrayBuffer());
        if (/\.zip$/i.test(file.name)) {
          for (const [name, d] of Object.entries(unzipSync(data))) if (!name.endsWith('/')) inputs.push({ name, data: d });
        } else inputs.push({ name: paths?.[i] || file.name, data });
      }
      const out = bundleGame(inputs);
      html = out.html;
      if (!title) title = out.title;
      note = out.missing.length
        ? `Couldn't find ${out.missing.slice(0, 5).join(', ')}${out.missing.length > 5 ? '…' : ''}. If the game needs them, add them too (or drop the whole folder).`
        : '';
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      html = '';
    } finally {
      busy = false;
    }
  }

  function onPick(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])];
    void readFiles(
      files,
      files.map((f) => f.webkitRelativePath || f.name),
    );
    input.value = '';
  }

  // drag and drop: files, or a whole folder (via the entries API)
  async function walk(entry: FileSystemEntry, path: string, out: { file: File; path: string }[]) {
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
      out.push({ file, path: path + entry.name });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      let batch: FileSystemEntry[];
      do {
        batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        for (const child of batch) await walk(child, `${path}${entry.name}/`, out);
      } while (batch.length);
    }
  }
  async function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    mode = 'files';
    const items = [...(e.dataTransfer?.items ?? [])];
    const entries = items.map((i) => i.webkitGetAsEntry?.()).filter((x): x is FileSystemEntry => !!x);
    if (entries.length) {
      const out: { file: File; path: string }[] = [];
      for (const en of entries) await walk(en, '', out);
      await readFiles(
        out.map((o) => o.file),
        out.map((o) => o.path),
      );
    } else await readFiles([...(e.dataTransfer?.files ?? [])]);
    // a dropped link
    const link = e.dataTransfer?.getData('text/uri-list') || '';
    if (!items.some((i) => i.kind === 'file') && gameEmbedUrl(link)) {
      mode = 'link';
      url = link;
    }
  }

  function fromCode() {
    error = '';
    const c = code.trim();
    if (!c) {
      html = '';
      return;
    }
    html = looksLikeHtml(c) ? c : wrapScript(c, title || 'My game', /^\s*(import|export)\s/m.test(c));
    if (!title) title = titleFromHtml(html) || 'My game';
  }

  function onUrl() {
    const u = gameEmbedUrl(url);
    error = url.trim() && !u ? 'Use an https:// link.' : '';
    if (u && !title) title = titleFromUrl(u);
  }

  function build(): ArcadeGame | null {
    const t = title.trim() || 'My game';
    let id = slugify(t) || 'game';
    // don't overwrite another game with the same name
    const taken = new Set(arcade.games.map((g) => g.id));
    for (let n = 2; taken.has(id); n++) id = `${slugify(t)}-${n}`;
    const base = { id, title: t.slice(0, 60), emoji: emoji || '🎮', cost: Math.max(0, Math.min(99, Math.round(cost))), minutes: minutes || undefined, local: true };
    if (mode === 'link') {
      const u = gameEmbedUrl(url);
      return u ? { ...base, url: u } : null;
    }
    return html ? { ...base, html } : null;
  }

  async function save() {
    const g = build();
    if (!g) return;
    if (locked && !(await checkPin(pin, store.settings.parentPinHash))) {
      error = 'The parent PIN is needed to add games.';
      return;
    }
    await arcade.saveLocal(g);
    toasts.push({ message: `Added “${g.title}” to your arcade`, detail: g.cost ? `${g.cost} 🎟️ per play` : 'Free to play', kind: 'success', emoji: g.emoji });
    onclose();
  }
</script>

<div class="modal-backdrop" onkeydown={(e) => e.key === 'Escape' && !preview && onclose()} role="presentation">
  <div
    use:focusTrap
    class="modal add"
    class:drag={dragging}
    role="dialog"
    aria-modal="true"
    aria-labelledby="add-h"
    tabindex="-1"
    in:fly={{ y: 20, duration: 200 }}
    ondragover={(e) => {
      e.preventDefault();
      dragging = true;
    }}
    ondragleave={() => (dragging = false)}
    ondrop={(e) => void onDrop(e)}
  >
    <h2 id="add-h">➕ Add a game</h2>
    <div class="cz-seg seg" role="tablist" aria-label="How to add it">
      <button role="tab" aria-selected={mode === 'files'} class:on={mode === 'files'} onclick={() => (mode = 'files')}>📁 Files</button>
      <button role="tab" aria-selected={mode === 'code'} class:on={mode === 'code'} onclick={() => (mode = 'code')}>⌨️ Paste code</button>
      <button role="tab" aria-selected={mode === 'link'} class:on={mode === 'link'} onclick={() => (mode = 'link')}>🔗 Link</button>
    </div>

    {#if mode === 'files'}
      <div class="drop">
        <div class="big">📦</div>
        <p><strong>Drop a game here</strong>: an <code>.html</code> file, a <code>.js</code> file, a <code>.zip</code>, or a whole folder.</p>
        <div class="row center">
          <label class="btn sm primary"
            >Choose files<input
              type="file"
              multiple
              accept=".html,.htm,.js,.mjs,.zip,.css,.json,image/*,audio/*,font/*,.wasm"
              onchange={onPick}
              hidden
              aria-label="Game files"
            /></label
          >
          <label class="btn sm">Choose a folder<input type="file" webkitdirectory multiple onchange={onPick} hidden aria-label="Game folder" /></label>
        </div>
        <p class="muted">Scripts, styles, pictures and sounds next to the page are packed in, so the game works offline.</p>
      </div>
    {:else if mode === 'code'}
      <textarea
        class="input mono"
        rows="9"
        bind:value={code}
        oninput={fromCode}
        spellcheck="false"
        aria-label="Game code"
        placeholder={'Paste a whole HTML page, or just JavaScript.\nJavaScript gets a full-screen <canvas id="game"> to draw on:\n\nconst c = document.getElementById("game").getContext("2d");\nc.fillStyle = "tomato"; c.fillRect(50, 50, 100, 100);'}
      ></textarea>
    {:else}
      <input class="input" bind:value={url} oninput={onUrl} placeholder="https://… (itch.io, Scratch, CodePen, Replit, your own site…)" aria-label="Game link" />
      <p class="muted">
        Any https link works if the site allows being shown inside other apps. Scratch, CodePen, JSFiddle, Replit and Khan Academy links are turned into their embed versions
        automatically.
      </p>
    {/if}

    {#if busy}<p class="muted" role="status">Packing…</p>{/if}
    {#if error}<p class="err" role="alert">{error}</p>{/if}
    {#if note}<p class="warn">{note}</p>{/if}

    {#if ready}
      <div class="details">
        <div class="row">
          <input class="input grow" bind:value={title} placeholder="Name" aria-label="Game name" maxlength="60" />
          <select class="select em" bind:value={emoji} aria-label="Icon"
            >{#each EMOJIS as e (e)}<option value={e}>{e}</option>{/each}</select
          >
        </div>
        <div class="row">
          <label>Cost <input class="input num" type="number" min="0" max="99" bind:value={cost} /> 🎟️ per play</label>
          <label>Time limit <input class="input num" type="number" min="0" max="240" bind:value={minutes} /> min (0 = none)</label>
        </div>
        {#if locked}<input class="input" type="password" bind:value={pin} placeholder="Parent PIN" aria-label="Parent PIN" inputmode="numeric" />{/if}
      </div>
    {/if}

    <div class="actions">
      <button class="btn ghost" onclick={onclose}>Cancel</button>
      <button
        class="btn"
        disabled={!ready}
        onclick={() => {
          const g = build();
          if (g) preview = { ...g, cost: 0, minutes: undefined };
        }}>Try it</button
      >
      <button class="btn primary" disabled={!ready || (locked && !pin)} onclick={() => void save()}>Add to my arcade</button>
    </div>
  </div>
</div>

{#if preview}
  <GamePlayer game={preview} preview onclose={() => (preview = null)} />
{/if}

<style>
  .add {
    width: min(560px, 96vw);
  }
  .add.drag {
    outline: 3px dashed var(--accent);
    outline-offset: -8px;
  }
  h2 {
    margin: 0 0 10px;
    font-size: 17px;
  }
  .seg {
    margin-bottom: 10px;
  }
  .drop {
    border: 2px dashed var(--border-strong);
    border-radius: var(--radius);
    padding: 16px;
    text-align: center;
  }
  .big {
    font-size: 34px;
  }
  .drop p {
    margin: 6px 0;
  }
  .muted {
    color: var(--text-muted);
    font-size: 12px;
  }
  .warn {
    color: var(--warn-text);
    font-size: 13px;
  }
  .err {
    color: var(--danger-text);
    font-size: 13px;
  }
  code,
  .mono {
    font-family: var(--mono);
    font-size: 12px;
  }
  textarea {
    width: 100%;
    resize: vertical;
  }
  .details {
    margin-top: 10px;
    display: grid;
    gap: 8px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .row.center {
    justify-content: center;
  }
  .row label {
    display: flex;
    gap: 4px;
    align-items: center;
    font-size: 13px;
    color: var(--text-muted);
  }
  .grow {
    flex: 1;
    min-width: 160px;
  }
  .em {
    width: 70px;
  }
  .num {
    width: 64px;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }
</style>
