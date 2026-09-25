<script lang="ts">
  import { focusTrap } from '../lib/focusTrap';
  import { store } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { COURSE_COLORS, COURSE_EMOJIS } from '../lib/colors';

  interface Row {
    name: string;
    emoji: string;
    color: string;
  }
  const presets: Row[] = [
    { name: 'Math', emoji: '📐', color: COURSE_COLORS[1] },
    { name: 'Science', emoji: '🧪', color: COURSE_COLORS[3] },
    { name: 'English', emoji: '✍️', color: COURSE_COLORS[5] },
    { name: 'History', emoji: '🏛️', color: COURSE_COLORS[6] },
    { name: 'Language', emoji: '🗣️', color: COURSE_COLORS[8] },
    { name: 'CS', emoji: '💻', color: COURSE_COLORS[0] },
  ];
  let rows = $state<Row[]>(Array.from({ length: 4 }, (_, i) => ({ name: '', emoji: COURSE_EMOJIS[i % COURSE_EMOJIS.length], color: COURSE_COLORS[(i * 3) % COURSE_COLORS.length] })));
  let paste = $state('');
  let first: HTMLInputElement | undefined = $state();
  $effect(() => first?.focus());

  function addRow() {
    const i = rows.length;
    rows = [...rows, { name: '', emoji: COURSE_EMOJIS[i % COURSE_EMOJIS.length], color: COURSE_COLORS[(i * 3) % COURSE_COLORS.length] }];
  }
  function usePreset(p: Row) {
    const empty = rows.findIndex((r) => !r.name.trim());
    const row = { ...p };
    if (empty === -1) rows = [...rows, row];
    else rows = rows.map((r, i) => (i === empty ? row : r));
  }
  function fromPaste() {
    const names = paste
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!names.length) return;
    rows = names.map((name, i) => ({ name, emoji: COURSE_EMOJIS[i % COURSE_EMOJIS.length], color: COURSE_COLORS[(i * 3) % COURSE_COLORS.length] }));
    paste = '';
  }
  function create(e: Event) {
    e.preventDefault();
    const valid = rows.filter((r) => r.name.trim());
    if (!valid.length) return;
    for (const r of valid) store.addCourse({ name: r.name.trim(), color: r.color, emoji: r.emoji || undefined });
    toasts.push({ message: `Created ${valid.length} course${valid.length > 1 ? 's' : ''}`, kind: 'success', emoji: '🎓' });
    ui.semesterSetup = false;
    store.go('courses', { courseId: null });
  }
  function close() {
    ui.semesterSetup = false;
  }
</script>

<div class="modal-backdrop" onclick={close} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <form use:focusTrap class="modal setup" aria-label="Semester setup" onclick={(e) => e.stopPropagation()} onsubmit={create}>
    <h2>🎓 Semester setup</h2>
    <p class="muted">Add all your courses at once. Pick a color and emoji for each so they’re easy to spot.</p>
    <div class="presets">
      {#each presets as p}
        <button type="button" class="chip" style="border-color:{p.color}" onclick={() => usePreset(p)}>{p.emoji} {p.name}</button>
      {/each}
    </div>
    <div class="rows">
      {#each rows as r, i (i)}
        <div class="row">
          <input class="input em" bind:value={r.emoji} aria-label="Emoji" maxlength="4" />
          {#if i === 0}
            <input class="input" bind:this={first} bind:value={r.name} placeholder="Course name" aria-label="Course name" />
          {:else}
            <input class="input" bind:value={r.name} placeholder="Course name" aria-label="Course name" />
          {/if}
          <input type="color" bind:value={r.color} aria-label="Color" class="color" />
          <button type="button" class="btn ghost sm icon" aria-label="Remove row" onclick={() => (rows = rows.filter((_, j) => j !== i))}>×</button>
        </div>
      {/each}
    </div>
    <button type="button" class="btn ghost sm" onclick={addRow}>+ Add row</button>
    <details class="paste">
      <summary>Paste a list instead</summary>
      <textarea class="textarea" bind:value={paste} placeholder="One course per line, or comma separated"></textarea>
      <button type="button" class="btn sm" onclick={fromPaste}>Fill rows</button>
    </details>
    <div class="actions">
      <button type="button" class="btn" onclick={close}>Cancel</button>
      <button type="submit" class="btn primary" disabled={!rows.some((r) => r.name.trim())}>Create {rows.filter((r) => r.name.trim()).length || ''} course{rows.filter((r) => r.name.trim()).length === 1 ? '' : 's'}</button>
    </div>
  </form>
</div>

<style>
  .setup {
    max-width: 520px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 14px;
    margin: 0 0 10px;
  }
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
  }
  .presets .chip {
    cursor: pointer;
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 8px;
  }
  .row {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .em {
    width: 52px;
    text-align: center;
    flex: none;
  }
  .color {
    width: 34px;
    height: 34px;
    border: none;
    padding: 0;
    background: none;
    flex: none;
  }
  .paste {
    margin: 10px 0;
    font-size: 13px;
    color: var(--text-muted);
  }
  .paste .textarea {
    margin: 8px 0 6px;
    min-height: 60px;
  }
</style>
