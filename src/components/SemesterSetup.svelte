<script lang="ts">
  import { focusTrap } from '../lib/focusTrap';
  import { store } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { COURSE_COLORS, COURSE_EMOJIS } from '../lib/colors';
  import { t } from '../lib/i18n/index.svelte';

  interface Row {
    name: string;
    emoji: string;
    color: string;
  }
  const presets: Row[] = $derived([
    { name: t('study.math'), emoji: '📐', color: COURSE_COLORS[1] },
    { name: t('study.science'), emoji: '🧪', color: COURSE_COLORS[3] },
    { name: t('sem.english'), emoji: '✍️', color: COURSE_COLORS[5] },
    { name: t('sem.history'), emoji: '🏛️', color: COURSE_COLORS[6] },
    { name: t('sem.language'), emoji: '🗣️', color: COURSE_COLORS[8] },
    { name: t('study.cs'), emoji: '💻', color: COURSE_COLORS[0] },
  ]);
  let rows = $state<Row[]>(
    Array.from({ length: 4 }, (_, i) => ({ name: '', emoji: COURSE_EMOJIS[i % COURSE_EMOJIS.length], color: COURSE_COLORS[(i * 3) % COURSE_COLORS.length] })),
  );
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
    toasts.push({ message: t('sem.created', { count: valid.length }), kind: 'success', emoji: '🎓' });
    ui.semesterSetup = false;
    store.go('courses', { courseId: null });
  }
  function close() {
    ui.semesterSetup = false;
  }
</script>

<div class="modal-backdrop" onclick={close} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <form use:focusTrap class="modal setup" aria-label={t('courses.semesterSetup')} onclick={(e) => e.stopPropagation()} onsubmit={create}>
    <h2>🎓 {t('courses.semesterSetup')}</h2>
    <p class="muted">{t('sem.help')}</p>
    <div class="presets">
      {#each presets as p}
        <button type="button" class="chip" style="border-color:{p.color}" onclick={() => usePreset(p)}>{p.emoji} {p.name}</button>
      {/each}
    </div>
    <div class="rows">
      {#each rows as r, i (i)}
        <div class="row">
          <input class="input em" bind:value={r.emoji} aria-label={t('friends.emoji')} maxlength="4" />
          {#if i === 0}
            <input class="input" bind:this={first} bind:value={r.name} placeholder={t('sem.name')} aria-label={t('sem.name')} />
          {:else}
            <input class="input" bind:value={r.name} placeholder={t('sem.name')} aria-label={t('sem.name')} />
          {/if}
          <input type="color" bind:value={r.color} aria-label={t('ce.color')} class="color" />
          <button type="button" class="btn ghost sm icon" aria-label={t('sem.removeRow')} onclick={() => (rows = rows.filter((_, j) => j !== i))}>×</button>
        </div>
      {/each}
    </div>
    <button type="button" class="btn ghost sm" onclick={addRow}>{t('sem.addRow')}</button>
    <details class="paste">
      <summary>{t('sem.paste')}</summary>
      <textarea class="textarea" bind:value={paste} placeholder={t('sem.pastePh')}></textarea>
      <button type="button" class="btn sm" onclick={fromPaste}>{t('sem.fill')}</button>
    </details>
    <div class="actions">
      <button type="button" class="btn" onclick={close}>{t('common.cancel')}</button>
      <button type="submit" class="btn primary" disabled={!rows.some((r) => r.name.trim())}>{t('sem.create', { count: rows.filter((r) => r.name.trim()).length })}</button>
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
    animation: rise-in 300ms var(--ease) backwards;
  }
  .presets .chip:hover {
    transform: translateY(-2px) scale(1.04);
    color: var(--text);
    background: var(--bg-hover);
    box-shadow: 0 6px 16px -8px currentColor;
  }
  .presets .chip:active {
    transform: scale(0.96);
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
    animation: rise-in 260ms var(--ease) backwards;
  }
  .color {
    border-radius: 50%;
    transition: transform var(--dur) var(--spring);
  }
  .color:hover {
    transform: scale(1.15);
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
