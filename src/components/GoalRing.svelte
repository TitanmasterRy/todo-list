<script lang="ts">
  import { t } from '../lib/i18n/index.svelte';
  interface Props {
    value: number;
    goal: number;
    size?: number;
    stroke?: number;
    label?: boolean;
  }
  let { value, goal, size = 52, stroke = 6, label = true }: Props = $props();
  const r = $derived((size - stroke) / 2);
  const c = $derived(2 * Math.PI * r);
  const pct = $derived(Math.min(1, goal > 0 ? value / goal : 0));
  const closed = $derived(pct >= 1);
</script>

<div class="ring" class:closed style="width:{size}px;height:{size}px" role="img" aria-label={t('goal.ring', { value, count: goal })}>
  <svg viewBox="0 0 {size} {size}" width={size} height={size}>
    <defs>
      <linearGradient id="ring-grad-{size}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="var(--accent)" />
        <stop offset="1" stop-color="var(--accent-2)" />
      </linearGradient>
    </defs>
    <circle cx={size / 2} cy={size / 2} {r} fill="none" stroke="var(--border)" stroke-width={stroke} />
    <circle
      class="fg"
      cx={size / 2}
      cy={size / 2}
      {r}
      fill="none"
      stroke="url(#ring-grad-{size})"
      stroke-width={stroke}
      stroke-linecap="round"
      stroke-dasharray={c}
      stroke-dashoffset={c * (1 - pct)}
      transform="rotate(-90 {size / 2} {size / 2})"
    />
  </svg>
  {#if label}
    <span class="lbl">{closed ? '✓' : `${value}/${goal}`}</span>
  {/if}
</div>

<style>
  .ring {
    position: relative;
    display: inline-grid;
    place-items: center;
  }
  svg {
    position: absolute;
    inset: 0;
    overflow: visible;
  }
  .fg {
    transition: stroke-dashoffset 700ms var(--spring);
    filter: drop-shadow(0 0 4px color-mix(in srgb, var(--accent) 45%, transparent));
  }
  .closed .fg {
    filter: drop-shadow(0 0 8px var(--accent));
  }
  .closed {
    animation: bump 600ms var(--spring);
  }
  .lbl {
    font-size: 12px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .closed .lbl {
    color: var(--accent-text);
    font-size: 17px;
  }
</style>
