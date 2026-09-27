<script lang="ts">
  // Admin → Data: browse, edit and delete raw records in this browser's IndexedDB and localStorage.
  // Edits go straight to storage; reload the app afterwards so it reads them (it keeps its own copy in memory).
  import { onMount } from 'svelte';
  import type { IDBPDatabase } from 'idb';
  import { getDB } from '../../lib/storage';
  import { parseEditedRecord, recordLabel, type RecordKey } from '../../lib/admin';
  import { downloadText } from '../../lib/download';
  import { toasts } from '../../lib/toast.svelte';

  // attachments hold file blobs, which JSON can't show or round-trip
  const READ_ONLY = new Set(['attachments']);
  const PAGE = 200;

  let db: IDBPDatabase | undefined;
  let stores = $state<{ name: string; count: number; keyPath: string | null }[]>([]);
  let current = $state('');
  let keys = $state<RecordKey[]>([]);
  let labels = $state<string[]>([]);
  let total = $state(0);
  let query = $state('');
  let picked = $state<RecordKey | null>(null);
  let editor = $state('');
  let error = $state('');
  let dirty = $state(false);
  let mode = $state<'idb' | 'local'>('idb');
  let localKeys = $state<{ key: string; size: number }[]>([]);
  let localPicked = $state('');

  onMount(async () => {
    db = (await getDB()) as unknown as IDBPDatabase;
    await refreshStores();
    refreshLocal();
  });

  async function refreshStores() {
    if (!db) return;
    const out = [];
    for (const name of [...db.objectStoreNames]) {
      const tx = db.transaction(name);
      out.push({ name, count: await tx.store.count(), keyPath: typeof tx.store.keyPath === 'string' ? tx.store.keyPath : null });
    }
    stores = out;
  }

  async function open(name: string) {
    if (!db) return;
    current = name;
    picked = null;
    editor = error = '';
    const tx = db.transaction(name);
    total = await tx.store.count();
    const ks = await tx.store.getAllKeys(undefined, 5000);
    const vals = READ_ONLY.has(name) ? [] : await tx.store.getAll(undefined, 5000);
    const q = query.trim().toLowerCase();
    const rows = ks.map((k, i) => ({ k, label: READ_ONLY.has(name) ? '' : recordLabel(vals[i]), raw: q ? JSON.stringify(vals[i] ?? '').toLowerCase() : '' }));
    const hit = q ? rows.filter((r) => String(r.k).toLowerCase().includes(q) || r.raw.includes(q)) : rows;
    keys = hit.slice(0, PAGE).map((r) => r.k);
    labels = hit.slice(0, PAGE).map((r) => r.label);
  }

  async function pick(k: RecordKey) {
    if (!db) return;
    picked = k;
    error = '';
    const v = await db.get(current, k);
    editor = READ_ONLY.has(current) ? describeBlob(v) : JSON.stringify(v, null, 2);
  }

  function describeBlob(v: unknown): string {
    const o = (v ?? {}) as Record<string, unknown>;
    const blob = o.blob instanceof Blob ? o.blob : undefined;
    return JSON.stringify({ ...o, blob: blob ? `<${blob.type || 'file'}, ${blob.size} bytes>` : o.blob }, null, 2);
  }

  const keyPath = $derived(stores.find((s) => s.name === current)?.keyPath ?? null);

  async function save() {
    if (!db || picked === null) return;
    const r = parseEditedRecord(editor, keyPath, picked);
    if (!r.ok) {
      error = r.error;
      return;
    }
    if (keyPath) await db.put(current, r.value);
    else await db.put(current, r.value, picked);
    dirty = true;
    toasts.push({ message: 'Saved to storage', detail: 'Reload the app to see it.', kind: 'success' });
    await open(current);
  }

  async function remove() {
    if (!db || picked === null) return;
    if (!confirm(`Delete ${current} record “${String(picked)}”? This can't be undone, and a synced copy may bring it back.`)) return;
    await db.delete(current, picked);
    dirty = true;
    await refreshStores();
    await open(current);
  }

  async function exportStore() {
    if (!db || !current || READ_ONLY.has(current)) return;
    const tx = db.transaction(current);
    const ks = await tx.store.getAllKeys();
    const vals = await tx.store.getAll();
    const data = keyPath ? vals : ks.map((k, i) => ({ key: k, value: vals[i] }));
    downloadText(`${current}.json`, JSON.stringify(data, null, 2), 'application/json');
  }

  async function clearStore() {
    if (!db || !current) return;
    if (prompt(`Type "${current}" to delete every record in it.`) !== current) return;
    await db.clear(current);
    dirty = true;
    await refreshStores();
    await open(current);
  }

  function refreshLocal() {
    const out: { key: string; size: number }[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) out.push({ key, size: (localStorage.getItem(key) ?? '').length });
      }
    } catch {
      /* blocked */
    }
    localKeys = out.sort((a, b) => a.key.localeCompare(b.key));
  }

  function pickLocal(key: string) {
    localPicked = key;
    error = '';
    const raw = localStorage.getItem(key) ?? '';
    try {
      editor = JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      editor = raw;
    }
  }

  function saveLocal() {
    if (!localPicked) return;
    let value = editor;
    try {
      value = JSON.stringify(JSON.parse(editor));
    } catch {
      /* plain text value */
    }
    localStorage.setItem(localPicked, value);
    dirty = true;
    refreshLocal();
    toasts.push({ message: 'Saved', detail: 'Reload the app to see it.', kind: 'success' });
  }

  function removeLocal() {
    if (!localPicked || !confirm(`Delete localStorage “${localPicked}”?`)) return;
    localStorage.removeItem(localPicked);
    localPicked = '';
    editor = '';
    dirty = true;
    refreshLocal();
  }
</script>

<div class="top">
  <div class="cz-seg seg">
    <button class:on={mode === 'idb'} onclick={() => ((mode = 'idb'), (editor = ''))}>IndexedDB</button>
    <button class:on={mode === 'local'} onclick={() => ((mode = 'local'), (editor = ''))}>localStorage</button>
  </div>
  {#if dirty}<button class="btn primary sm" onclick={() => location.reload()}>Reload the app to apply</button>{/if}
</div>
<p class="muted">Changes here skip the app's checks. Export a backup first (Settings → Data) if you're unsure.</p>

{#if mode === 'idb'}
  <div class="stores">
    {#each stores as s (s.name)}
      <button class="btn sm" class:primary={current === s.name} onclick={() => void open(s.name)}>{s.name} <span class="n">{s.count}</span></button>
    {/each}
  </div>
  {#if current}
    <div class="row">
      <input class="input grow" bind:value={query} placeholder="Search keys and contents" aria-label="Search records" onkeydown={(e) => e.key === 'Enter' && void open(current)} />
      <button class="btn sm" onclick={() => void open(current)}>Search</button>
      <button class="btn ghost sm" onclick={() => void exportStore()} disabled={READ_ONLY.has(current)}>Export {current}.json</button>
      <button class="btn ghost sm danger" onclick={() => void clearStore()}>Clear store</button>
    </div>
    <div class="split">
      <ul class="keys" aria-label="Records">
        {#each keys as k, i (String(k))}
          <li><button class:on={picked === k} onclick={() => void pick(k)}><code>{String(k)}</code> <span class="muted">{labels[i]}</span></button></li>
        {/each}
        {#if total > keys.length}<li class="muted">Showing {keys.length} of {total}. Search to narrow it down.</li>{/if}
      </ul>
      <div class="edit">
        {#if picked !== null}
          <textarea class="input mono" bind:value={editor} readonly={READ_ONLY.has(current)} aria-label="Record JSON" spellcheck="false"></textarea>
          {#if error}<p class="err" role="alert">{error}</p>{/if}
          <div class="row">
            {#if !READ_ONLY.has(current)}<button class="btn primary sm" onclick={() => void save()}>Save record</button>{/if}
            <button class="btn ghost sm danger" onclick={() => void remove()}>Delete record</button>
          </div>
        {:else}
          <p class="muted">Pick a record.</p>
        {/if}
      </div>
    </div>
  {/if}
{:else}
  <div class="split">
    <ul class="keys" aria-label="localStorage keys">
      {#each localKeys as k (k.key)}
        <li><button class:on={localPicked === k.key} onclick={() => pickLocal(k.key)}><code>{k.key}</code> <span class="muted">{k.size.toLocaleString()} chars</span></button></li>
      {/each}
    </ul>
    <div class="edit">
      {#if localPicked}
        <textarea class="input mono" bind:value={editor} aria-label="Value" spellcheck="false"></textarea>
        <div class="row">
          <button class="btn primary sm" onclick={saveLocal}>Save</button>
          <button class="btn ghost sm danger" onclick={removeLocal}>Delete</button>
        </div>
      {:else}
        <p class="muted">Pick a key.</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .top {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  }
  .muted {
    color: var(--text-muted);
    font-size: 12px;
  }
  .stores {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 8px 0;
  }
  .n {
    opacity: 0.7;
    font-size: 11px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin: 8px 0;
  }
  .grow {
    flex: 1;
    min-width: 160px;
  }
  .split {
    display: grid;
    grid-template-columns: minmax(200px, 1fr) 2fr;
    gap: 10px;
  }
  @media (max-width: 700px) {
    .split {
      grid-template-columns: 1fr;
    }
  }
  .keys {
    list-style: none;
    padding: 0;
    margin: 0;
    max-height: 50vh;
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }
  .keys li + li {
    border-top: 1px solid var(--border);
  }
  .keys button {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: 0;
    color: var(--text);
    padding: 5px 8px;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .keys button.on {
    background: var(--bg-hover);
  }
  code,
  .mono {
    font-family: var(--mono);
    font-size: 12px;
  }
  textarea {
    width: 100%;
    min-height: 40vh;
    resize: vertical;
  }
  .err {
    color: var(--danger-text);
    font-size: 13px;
  }
</style>
