<script lang="ts">
  // Stats → Share my week: a square image of this week's numbers to post or send. No task titles are ever on it.
  import { fly } from 'svelte/transition';
  import { focusTrap } from '../lib/focusTrap';
  import { store } from '../lib/store.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { drawStatCard, weekSummary } from '../lib/statcard';
  import { t } from '../lib/i18n/index.svelte';

  let { onclose }: { onclose: () => void } = $props();
  const NAME_KEY = 'homework-todo:card-name';
  let name = $state(readName());
  let showCourses = $state(false);
  let canvas: HTMLCanvasElement | undefined = $state();

  function readName(): string {
    try {
      return localStorage.getItem(NAME_KEY) ?? '';
    } catch {
      return '';
    }
  }
  const summary = $derived(weekSummary(store.stats, store.tasks, store.courses, store.today, store.streak, store.settings.dailyGoal));
  $effect(() => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#6c5ce7';
    drawStatCard(ctx, summary, { accent, name: name.trim().slice(0, 24) || undefined, showCourses });
    try {
      localStorage.setItem(NAME_KEY, name.trim());
    } catch {
      /* not remembered */
    }
  });

  const blob = () => new Promise<Blob | null>((res) => (canvas ? canvas.toBlob(res, 'image/png') : res(null)));
  const file = async () => {
    const b = await blob();
    return b ? new File([b], `my-week-${store.today}.png`, { type: 'image/png' }) : null;
  };
  const canShareFiles = typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [new File([''], 'x.png', { type: 'image/png' })] });

  async function share() {
    const f = await file();
    if (!f) return;
    try {
      await navigator.share({ files: [f], title: t('card.title') });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toasts.push({ message: t('card.shareFailed'), detail: (e as Error).message, kind: 'warn' });
    }
  }
  async function download() {
    const f = await file();
    if (!f) return;
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copy() {
    const b = await blob();
    if (!b) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
      toasts.push({ message: t('card.copied'), kind: 'success', emoji: '📋' });
    } catch {
      toasts.push({ message: t('card.noCopy'), kind: 'warn' });
    }
  }
</script>

<div class="modal-backdrop" onclick={onclose} onkeydown={(e) => e.key === 'Escape' && onclose()} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div use:focusTrap class="modal" role="dialog" aria-modal="true" aria-labelledby="sc-h" tabindex="-1" onclick={(e) => e.stopPropagation()} in:fly={{ y: 20, duration: 200 }}>
    <h2 id="sc-h">{t('stats.share')}</h2>
    <canvas bind:this={canvas} width="1080" height="1080">{t('card.alt', { count: summary.done, streak: summary.streak, ring: summary.ringDays, xp: summary.xp })}</canvas>
    <div class="opts">
      <input class="input" bind:value={name} placeholder={t('card.namePh')} aria-label={t('card.name')} maxlength="24" />
      <label class="chk"><input type="checkbox" bind:checked={showCourses} /> {t('card.showCourses')}</label>
    </div>
    <p class="muted">{t('card.privacy')}</p>
    <div class="actions">
      <button class="btn" onclick={onclose}>{t('common.close')}</button>
      <button class="btn" onclick={copy}>{t('card.copy')}</button>
      <button class="btn" onclick={download}>{t('prompt.download')}</button>
      {#if canShareFiles}<button class="btn primary" onclick={share}>{t('card.share')}</button>{/if}
    </div>
  </div>
</div>

<style>
  canvas {
    width: 100%;
    max-width: 420px;
    aspect-ratio: 1;
    height: auto;
    display: block;
    margin: 0 auto 10px;
    border-radius: 14px;
    box-shadow:
      var(--shadow-lg),
      0 0 40px -12px color-mix(in srgb, var(--accent) 60%, transparent);
    animation: pop-in var(--dur-slow) var(--spring) backwards;
    transition: transform var(--dur-slow) var(--spring);
  }
  canvas:hover {
    transform: translateY(-3px) rotate(-0.5deg);
  }
  .opts {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }
  .opts .input {
    flex: 1 1 180px;
  }
  .chk {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }
  .muted {
    font-size: 12px;
    color: var(--text-muted);
    margin: 8px 0;
  }
</style>
