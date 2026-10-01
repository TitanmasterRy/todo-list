<script lang="ts">
  // A bottom sheet for phones: slides up over a dimmed page, scrolls inside, closes on the backdrop, Escape or a
  // drag down on its handle. Focus stays inside and goes back where it was on close. On wide screens it's centered.
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { focusTrap } from '../lib/focusTrap';
  import { t } from '../lib/i18n/index.svelte';

  interface Props {
    title?: string;
    label?: string; // accessible name when there's no visible title
    onclose: () => void;
    children: Snippet;
    tall?: boolean; // let the sheet grow to most of the screen (long lists)
  }
  let { title, label, onclose, children, tall = false }: Props = $props();

  let closing = $state(false);
  let dragY = $state(0);
  let dragFrom: number | null = null;

  function close() {
    if (closing) return;
    closing = true;
    // let the slide-down play before the element goes away
    setTimeout(onclose, 160);
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  }
  // drag the handle down to dismiss
  function down(e: PointerEvent) {
    dragFrom = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (dragFrom === null) return;
    dragY = Math.max(0, e.clientY - dragFrom);
  }
  function up() {
    if (dragFrom === null) return;
    const far = dragY > 80;
    dragFrom = null;
    dragY = 0;
    if (far) close();
  }
  // the page behind doesn't scroll while the sheet is up
  onMount(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div class="sheet-backdrop" class:closing onclick={close} onkeydown={onKey}>
  <div
    class="sheet"
    class:closing
    class:tall
    role="dialog"
    aria-modal="true"
    aria-label={title ?? label}
    tabindex="-1"
    use:focusTrap
    style={dragY ? `transform: translateY(${dragY}px); transition: none` : ''}
    onclick={(e) => e.stopPropagation()}
  >
    <div class="grip" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} aria-hidden="true"><span></span></div>
    {#if title}
      <div class="head">
        <h2>{title}</h2>
        <button type="button" class="x" onclick={close} aria-label={t('common.close')}>×</button>
      </div>
    {/if}
    <div class="body">{@render children()}</div>
  </div>
</div>

<style>
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    z-index: 150;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: fade-in 160ms var(--ease) backwards;
  }
  .sheet-backdrop.closing {
    animation: fade-out 160ms var(--ease) forwards;
  }
  .sheet {
    width: 100%;
    max-height: calc(80dvh - env(safe-area-inset-top));
    display: flex;
    flex-direction: column;
    background: var(--bg-elev);
    border: 1px solid color-mix(in srgb, var(--accent) 25%, var(--border));
    border-bottom: none;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow-lg);
    padding-bottom: env(safe-area-inset-bottom);
    animation: sheet-in 260ms var(--spring) backwards;
    transition: transform 160ms var(--ease);
  }
  .sheet.tall {
    max-height: calc(92dvh - env(safe-area-inset-top));
  }
  .sheet.closing {
    transform: translateY(100%);
  }
  .grip {
    display: grid;
    place-items: center;
    padding: 10px 0 4px;
    touch-action: none;
    cursor: grab;
  }
  .grip span {
    width: 40px;
    height: 5px;
    border-radius: 3px;
    background: var(--border-strong);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 16px 6px;
  }
  .head h2 {
    flex: 1;
    margin: 0;
    font-size: 16px;
    font-weight: 800;
  }
  .x {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    font-size: 22px;
    color: var(--text-muted);
    background: var(--bg-elev-2);
  }
  .body {
    overflow-y: auto;
    padding: 4px 14px 14px;
    overscroll-behavior: contain;
  }
  @keyframes fade-out {
    to {
      opacity: 0;
    }
  }
  /* wide screens (keyboard shortcuts open these too): a centered card instead */
  @media (min-width: 721px) {
    .sheet-backdrop {
      align-items: center;
      padding: 24px;
    }
    .sheet {
      max-width: 480px;
      border-radius: var(--radius-lg);
      border-bottom: 1px solid color-mix(in srgb, var(--accent) 25%, var(--border));
      padding-bottom: 0;
    }
    .sheet.closing {
      transform: translateY(24px);
      opacity: 0;
    }
    .grip {
      display: none;
    }
    .head {
      padding-top: 14px;
    }
  }
</style>
