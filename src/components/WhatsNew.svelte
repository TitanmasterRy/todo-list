<script lang="ts">
  // Patch notes: every changelog section, newest first. Opens by itself after an update with the ones this device
  // missed expanded and marked New (see DailyPrompts); Settings → Help opens it any time.
  import { fly } from 'svelte/transition';
  import { focusTrap } from '../lib/focusTrap';
  import { ui } from '../lib/ui.svelte';
  import { renderMarkdown } from '../lib/markdown';
  import { allSections, unseenCount } from '../lib/whatsnew';
  import { t } from '../lib/i18n/index.svelte';
  import changelog from '../../CHANGELOG.md?raw';

  const sections = allSections(changelog);
  const unseen = ui.whatsNewSince ? unseenCount(sections, ui.whatsNewSince) : 0;
  let showAll = $state(false);
  const shown = $derived(showAll ? sections : sections.slice(0, Math.max(unseen, 1) + 2));
  const close = () => {
    ui.whatsNew = false;
    ui.whatsNewSince = '';
  };
</script>

<div class="modal-backdrop" onclick={close} onkeydown={(e) => e.key === 'Escape' && close()} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    use:focusTrap
    class="modal notes"
    role="dialog"
    aria-modal="true"
    aria-labelledby="wn-h"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    in:fly={{ y: 20, duration: 250 }}
  >
    <header>
      <h2 id="wn-h">📜 {t('patch.title')}</h2>
      {#if unseen}<p class="sub">{t('patch.newCount', { count: unseen })}</p>{/if}
    </header>
    <div class="list">
      {#each shown as s, i (s.title)}
        <details class="note" class:new={i < unseen} open={i < Math.max(unseen, 1)}>
          <summary>
            <span class="title">{s.title}</span>
            {#if i < unseen}<span class="badge">{t('patch.new')}</span>{:else if i === 0}<span class="badge latest">{t('patch.latest')}</span>{/if}
          </summary>
          <div class="md">{@html renderMarkdown(s.body)}</div>
        </details>
      {/each}
      {#if !showAll && shown.length < sections.length}
        <button class="btn ghost sm more" onclick={() => (showAll = true)}>{t('patch.older', { count: sections.length - shown.length })}</button>
      {/if}
    </div>
    <div class="actions"><button class="btn primary" onclick={close}>{t('patch.gotIt')}</button></div>
  </div>
</div>

<style>
  .notes {
    width: min(620px, 96vw);
    max-height: 88vh;
    display: flex;
    flex-direction: column;
  }
  header h2 {
    margin: 0;
  }
  .sub {
    color: var(--accent-text);
    font-size: 13px;
    font-weight: 600;
    margin: 4px 0 0;
  }
  .list {
    overflow: auto;
    margin: 12px 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
  }
  .note {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 8px 12px;
    background: var(--bg-elev);
  }
  .note.new {
    border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 25%, transparent);
  }
  summary {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 14px;
    list-style: none;
  }
  summary::before {
    content: '▸';
    color: var(--text-muted);
    transition: transform var(--dur);
  }
  details[open] > summary::before {
    transform: rotate(90deg);
  }
  .title {
    flex: 1;
  }
  .badge {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--accent-contrast, #fff);
  }
  .badge.latest {
    background: var(--bg-hover);
    color: var(--text-muted);
  }
  .md {
    font-size: 14px;
    margin-top: 6px;
  }
  .md :global(li) {
    margin: 4px 0;
  }
  .more {
    align-self: center;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
