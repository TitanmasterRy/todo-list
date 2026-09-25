<script lang="ts">
  // Task editor → Files: attach photos, PDFs and documents. Files stay on this device.
  import { onDestroy } from 'svelte';
  import { store } from '../lib/store.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { ACCEPT, formatBytes, iconFor, MAX_ATTACHMENT_BYTES } from '../lib/attachments';

  let { taskId }: { taskId: string } = $props();

  const list = $derived(store.taskById(taskId)?.attachments ?? []);
  let urls = $state<Record<string, string | null>>({});
  let busy = $state(false);
  let over = $state(false);
  let fileInput: HTMLInputElement | undefined = $state();
  let cameraInput: HTMLInputElement | undefined = $state();

  // load a local URL per file (null = the file is on another device)
  $effect(() => {
    for (const a of list) {
      if (a.id in urls) continue;
      urls[a.id] = null;
      void store.attachmentUrl(a.id).then((u) => {
        if (u && destroyed) URL.revokeObjectURL(u);
        else urls[a.id] = u;
      });
    }
  });
  let destroyed = false;
  onDestroy(() => {
    destroyed = true;
    for (const u of Object.values(urls)) if (u) URL.revokeObjectURL(u);
  });

  async function add(files: FileList | File[] | null | undefined) {
    const arr = files ? [...files] : [];
    if (!arr.length) return;
    busy = true;
    try {
      const r = await store.attachFiles(taskId, arr);
      if (r.tooBig.length) toasts.push({ message: `Too big to attach: ${r.tooBig.join(', ')}`, detail: `Files can be up to ${formatBytes(MAX_ATTACHMENT_BYTES)}.`, kind: 'warn' });
    } catch (e) {
      toasts.push({ message: 'Couldn’t save the file', detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    } finally {
      busy = false;
    }
  }

  function remove(id: string) {
    const u = urls[id];
    if (u) URL.revokeObjectURL(u);
    delete urls[id];
    store.removeAttachment(taskId, id);
  }
</script>

<div
  class="field files"
  class:over
  role="group"
  aria-labelledby="ed-files-l"
  ondragover={(e) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    over = true;
  }}
  ondragleave={() => (over = false)}
  ondrop={(e) => {
    if (!e.dataTransfer?.files.length) return;
    e.preventDefault();
    over = false;
    void add(e.dataTransfer.files);
  }}
>
  <span class="lbl" id="ed-files-l">Files</span>
  {#if list.length}
    <ul>
      {#each list as a (a.id)}
        {@const url = urls[a.id]}
        <li>
          {#if url && a.type.startsWith('image/')}
            <img src={url} alt="" class="thumb" />
          {:else}
            <span class="icon" aria-hidden="true">{iconFor(a.type)}</span>
          {/if}
          <span class="name">
            {#if url}<a href={url} target="_blank" rel="noopener" download={a.type.startsWith('image/') || a.type === 'application/pdf' ? undefined : a.name}>{a.name}</a>
            {:else}{a.name}{/if}
            <small>{formatBytes(a.size)}{url ? '' : ' · on another device'}</small>
          </span>
          <button type="button" class="x" onclick={() => remove(a.id)} aria-label="Remove {a.name}">×</button>
        </li>
      {/each}
    </ul>
  {/if}
  <div class="addsub">
    <button type="button" class="btn sm" onclick={() => fileInput?.click()} disabled={busy}>📎 Attach file</button>
    <button type="button" class="btn sm ghost" onclick={() => cameraInput?.click()} disabled={busy}>📷 Photo</button>
    {#if busy}<span class="muted">Saving…</span>{:else}<span class="muted">or drop files here. Stored on this device only.</span>{/if}
  </div>
  <input
    bind:this={fileInput}
    type="file"
    multiple
    accept={ACCEPT}
    hidden
    aria-label="Attach files"
    onchange={(e) => {
      void add(e.currentTarget.files);
      e.currentTarget.value = '';
    }}
  />
  <input
    bind:this={cameraInput}
    type="file"
    accept="image/*"
    capture="environment"
    hidden
    aria-label="Take a photo"
    onchange={(e) => {
      void add(e.currentTarget.files);
      e.currentTarget.value = '';
    }}
  />
</div>

<style>
  .files {
    border-radius: var(--radius-sm, 8px);
    transition: background 0.15s;
  }
  .files.over {
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    outline: 2px dashed var(--accent);
    outline-offset: 2px;
  }
  ul {
    list-style: none;
    margin: 0 0 6px;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  li {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .thumb,
  .icon {
    width: 40px;
    height: 40px;
    border-radius: 6px;
    flex: none;
  }
  .thumb {
    object-fit: cover;
    border: 1px solid var(--border);
  }
  .icon {
    display: grid;
    place-items: center;
    font-size: 22px;
    background: var(--bg-sunken, var(--bg-elev));
  }
  .name {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    font-size: 13px;
    overflow: hidden;
  }
  .name a {
    color: var(--accent-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  small {
    color: var(--text-muted);
    font-size: 11px;
  }
  .x {
    color: var(--text-muted);
    font-size: 18px;
    padding: 0 6px;
  }
  .muted {
    font-size: 12px;
    color: var(--text-muted);
    align-self: center;
  }
</style>
