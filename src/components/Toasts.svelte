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
    position: relative;
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--glass);
    backdrop-filter: blur(14px) saturate(1.3);
    -webkit-backdrop-filter: blur(14px) saturate(1.3);
    border: 1px solid var(--border-strong);
    border-radius: 14px;
    padding: 10px 12px 10px 16px;
    box-shadow: var(--shadow-lg);
    font-size: 14px;
    overflow: hidden;
    --tone: var(--border-strong);
  }
  /* a glowing color bar on the leading edge says what kind of news this is */
  .toast::before {
    content: '';
    position: absolute;
    inset-inline-start: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: var(--tone);
    box-shadow: 0 0 12px var(--tone);
  }
  .toast.success {
    --tone: var(--success);
    border-color: color-mix(in srgb, var(--success) 45%, var(--border));
  }
  .toast.warn {
    --tone: var(--warn);
    border-color: color-mix(in srgb, var(--warn) 50%, var(--border));
  }
  .toast.info {
    --tone: var(--info);
  }
  .toast.xp {
    --tone: var(--accent);
    border-color: color-mix(in srgb, var(--accent) calc(40% + var(--combo) * 6%), var(--border));
    box-shadow:
      var(--shadow-lg),
      0 0 calc(var(--combo) * 6px) color-mix(in srgb, var(--accent) calc(var(--combo) * 8%), transparent);
    transform: scale(calc(1 + var(--combo) * 0.012));
  }
  .toast.xp::before {
    background: var(--grad-accent);
  }
  .toast.combo .emoji {
    animation: wiggle 500ms var(--spring);
  }
  .toast.levelup {
    --tone: var(--accent-2);
    background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 35%, var(--bg-elev-2)), color-mix(in srgb, var(--accent-2) 18%, var(--bg-elev-2)));
    border-color: var(--accent);
  }
  .toast.badge {
    --tone: var(--gold);
    border-color: color-mix(in srgb, var(--gold) 60%, var(--border));
  }
  .emoji {
    font-size: 24px;
    filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.25));
    animation: bump 480ms var(--spring);
  }
  .body {
    flex: 1;
    min-width: 0;
  }
  .msg {
    font-weight: 700;
  }
  .detail {
    color: var(--text-muted);
    font-size: 13px;
  }
  .x {
    color: var(--text-faint);
    font-size: 18px;
    padding: 0 4px;
    border-radius: 6px;
  }
  .x:hover {
    color: var(--text);
    background: var(--bg-hover);
  }
  @media (max-width: 720px) {
    /* sits left of the + button; only the two newest show, so the list underneath stays usable */
    .toasts {
      bottom: calc(var(--tabbar-h) + 12px + env(safe-area-inset-bottom));
      left: 12px;
      transform: none;
      width: calc(100vw - 88px);
    }
    .toast:nth-last-child(n + 3) {
      display: none;
    }
    .toast {
      padding: 8px 10px 8px 14px;
      font-size: 13px;
    }
  }
</style>
