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
  .sub {
    color: var(--text-muted);
    font-size: 13px;
    margin: -4px 0 10px;
  }
  .md {
    font-size: 14px;
    max-height: 60vh;
    overflow: auto;
  }
  .md :global(li) {
    margin: 4px 0;
  }
</style>
