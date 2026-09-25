<script lang="ts">
  import { fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { toasts } from '../lib/toast.svelte';
  import { t as tr } from '../lib/i18n/index.svelte';
</script>

<div class="toasts" aria-live="polite" aria-relevant="additions">
  {#each toasts.items as t (t.id)}
    <div
      class="toast {t.kind}"
      class:combo={(t.combo ?? 0) > 0}
      style="--combo:{Math.min(10, t.combo ?? 0)}"
      in:fly={{ y: 20, duration: 220 }}
      out:fly={{ y: 10, duration: 160 }}
      animate:flip={{ duration: 200 }}
      role="status"
    >
      {#if t.emoji}<span class="emoji">{t.emoji}</span>{/if}
      <div class="body">
        <div class="msg">{t.message}</div>
        {#if t.detail}<div class="detail">{t.detail}</div>{/if}
      </div>
      {#if t.action}
        <button class="btn sm act" onclick={t.action.onClick}>{t.action.label}</button>
      {/if}
      <button class="x" onclick={() => toasts.dismiss(t.id)} aria-label={tr('common.dismiss')}>×</button>
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 200;
    width: min(440px, calc(100vw - 24px));
    pointer-events: none;
  }
  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border-strong);
    border-radius: 12px;
    padding: 10px 12px;
    box-shadow: var(--shadow);
    font-size: 14px;
  }
  .toast.success {
    border-color: color-mix(in srgb, var(--success) 50%, transparent);
  }
  .toast.warn {
    border-color: color-mix(in srgb, var(--warn) 50%, transparent);
  }
  .toast.xp {
    border-color: color-mix(in srgb, var(--accent) calc(40% + var(--combo) * 6%), transparent);
    box-shadow:
      var(--shadow),
      0 0 calc(var(--combo) * 4px) color-mix(in srgb, var(--accent) calc(var(--combo) * 8%), transparent);
    transform: scale(calc(1 + var(--combo) * 0.01));
  }
  .toast.levelup {
    background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 35%, var(--bg-elev-2)), var(--bg-elev-2));
    border-color: var(--accent);
  }
  .toast.badge {
    border-color: var(--warn);
  }
  .emoji {
    font-size: 22px;
  }
  .body {
    flex: 1;
    min-width: 0;
  }
  .msg {
    font-weight: 600;
  }
  .detail {
    color: var(--text-muted);
    font-size: 13px;
  }
  .x {
    color: var(--text-faint);
    font-size: 18px;
    padding: 0 4px;
  }
  @media (max-width: 720px) {
    .toasts {
      bottom: calc(var(--tabbar-h) + 12px + env(safe-area-inset-bottom));
    }
  }
</style>
