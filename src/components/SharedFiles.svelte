<script lang="ts">
  // Files shared into the app (phone share sheet → Homework To-Do): add PDFs to the Book reader, or make a task with them attached.
  import { fly } from 'svelte/transition';
  import { focusTrap } from '../lib/focusTrap';
  import { store } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { isPdf, titleForShare } from '../lib/share';
  import { formatBytes } from '../lib/attachments';
  import { t as tr } from '../lib/i18n/index.svelte';

  let { files, shared, onclose }: { files: File[]; shared: { title?: string; text?: string; url?: string }; onclose: () => void } = $props();
  // svelte-ignore state_referenced_locally
  let title = $state(titleForShare(files, shared));
  let busy = $state(false);
  const pdfs = $derived(files.filter(isPdf));

  async function toReader() {
    busy = true;
    try {
      const { addBook } = await import('../lib/library');
      let last = '';
      for (const f of pdfs) last = (await addBook(f)).id;
      ui.openBook = pdfs.length === 1 ? last : null;
      ui.toolsTab = 'reader';
      store.go('tools');
      toasts.push({ message: tr('shared.toReader', { count: pdfs.length }), kind: 'success', emoji: '📚' });
      onclose();
    } catch (e) {
      toasts.push({ message: tr('shared.pdfFailed'), detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    } finally {
      busy = false;
    }
  }
  async function toTask() {
    busy = true;
    try {
      const t = store.addTask({ title: title.trim() || tr('shared.file'), url: shared.url || undefined });
      const r = await store.attachFiles(t.id, files);
      toasts.push({ message: tr('toast.added', { title: t.title }), detail: tr('shared.attached', { count: r.added }), kind: 'success', emoji: '📎' });
      store.editingTaskId = t.id;
      onclose();
    } finally {
      busy = false;
    }
  }
</script>

<div class="modal-backdrop" onclick={onclose} onkeydown={(e) => e.key === 'Escape' && onclose()} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div use:focusTrap class="modal" role="dialog" aria-modal="true" aria-labelledby="sh-h" tabindex="-1" onclick={(e) => e.stopPropagation()} in:fly={{ y: 20, duration: 200 }}>
    <h2 id="sh-h">📥 {tr('shared.title')}</h2>
    <ul class="files">
      {#each files as f, i (i)}<li>{isPdf(f) ? '📕' : f.type.startsWith('image/') ? '🖼️' : '📄'} {f.name} <span class="muted">{formatBytes(f.size)}</span></li>{/each}
    </ul>
    <label class="lbl" for="sh-title">{tr('shared.task')}</label>
    <input id="sh-title" class="input" bind:value={title} />
    <div class="actions">
      <button class="btn" onclick={onclose} disabled={busy}>{tr('common.cancel')}</button>
      {#if pdfs.length}<button class="btn" onclick={toReader} disabled={busy}>📚 {tr('shared.openReader')}</button>{/if}
      <button class="btn primary" onclick={toTask} disabled={busy}>📎 {tr('shared.newTask', { count: files.length })}</button>
    </div>
  </div>
</div>

<style>
  .files {
    list-style: none;
    margin: 0 0 10px;
    padding: 0;
    display: grid;
    gap: 4px;
    font-size: 14px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 12px;
  }
  .lbl {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 4px;
  }
</style>
