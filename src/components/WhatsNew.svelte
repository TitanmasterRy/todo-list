<script lang="ts">
  // "What's new" dialog: the newest changelog section (loaded on demand, rendered as markdown).
  import { fly } from 'svelte/transition';
  import { focusTrap } from '../lib/focusTrap';
  import { ui } from '../lib/ui.svelte';
  import { renderMarkdown } from '../lib/markdown';
  import { latestSection } from '../lib/whatsnew';
  import changelog from '../../CHANGELOG.md?raw';

  const section = latestSection(changelog);
  const close = () => (ui.whatsNew = false);
</script>

<div class="modal-backdrop" onclick={close} onkeydown={(e) => e.key === 'Escape' && close()} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div use:focusTrap class="modal" role="dialog" aria-modal="true" aria-labelledby="wn-h" tabindex="-1" onclick={(e) => e.stopPropagation()} in:fly={{ y: 20, duration: 250 }}>
    <h2 id="wn-h">✨ What’s new</h2>
    {#if section}
      <p class="sub">{section.title}</p>
      <div class="md">{@html renderMarkdown(section.body)}</div>
    {/if}
    <div class="actions"><button class="btn primary" onclick={close}>Nice</button></div>
  </div>
</div>

<style>
  .modal {
    background: radial-gradient(70% 40% at 50% 0%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 70%), var(--bg-elev);
  }
  .sub {
    display: inline-block;
    color: var(--accent-text);
    font-size: 12px;
    font-weight: 700;
    margin: -4px 0 10px;
    padding: 2px 10px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    box-shadow: 0 0 12px -4px var(--accent);
  }
  .md {
    font-size: 14px;
    max-height: 60vh;
    overflow: auto;
  }
  .md :global(li) {
    margin: 4px 0;
    animation: rise-in 360ms var(--ease) backwards;
  }
  .md :global(li:nth-child(2)) {
    animation-delay: 40ms;
  }
  .md :global(li:nth-child(3)) {
    animation-delay: 80ms;
  }
  .md :global(li:nth-child(4)) {
    animation-delay: 120ms;
  }
  .md :global(li:nth-child(n + 5)) {
    animation-delay: 160ms;
  }
  .md :global(li::marker) {
    color: var(--accent-text);
  }
</style>
