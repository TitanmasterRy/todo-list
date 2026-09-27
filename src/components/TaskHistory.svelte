<script lang="ts">
  // Task editor → History: the task's recent edits (lib/history.ts), newest first.
  import { store } from '../lib/store.svelte';
  import { hasKey, t } from '../lib/i18n/index.svelte';
  import type { HistoryEntry } from '../lib/history';

  let { history }: { history: HistoryEntry[] } = $props();

  const rows = $derived([...history].reverse());

  function label(f: string): string {
    const key = `history.${f}`;
    return hasKey(key) ? t(key) : f;
  }
  function value(f: string, v: string | undefined): string {
    if (v === undefined) return '—';
    if (f === 'courseId') return store.courseById(v)?.name ?? '—';
    if (f === 'dueAt' || f === 'completedAt') {
      const d = v.length === 10 ? new Date(`${v}T12:00`) : new Date(v);
      return Number.isNaN(d.getTime())
        ? v
        : v.length === 10
          ? d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
          : d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
    return v;
  }
  function what(e: HistoryEntry): string {
    if (e.f === 'completedAt') return e.to ? t('history.completed') : t('history.reopened');
    if (e.f === 'notes' || e.f === 'title') return e.to ? `${label(e.f)}: “${e.to}”` : `${label(e.f)}: —`;
    return `${label(e.f)}: ${value(e.f, e.from)} → ${value(e.f, e.to)}`;
  }
  const when = (at: string) => new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
</script>

<details class="field hist">
  <summary>{t('history.heading', { count: history.length })}</summary>
  <ul>
    {#each rows as e (e.at + e.f)}
      <li><span class="when">{when(e.at)}</span> {what(e)}</li>
    {/each}
  </ul>
</details>

<style>
  .hist summary {
    cursor: pointer;
    font-size: 13px;
    color: var(--text-muted);
  }
  ul {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
    font-size: 13px;
    max-height: 220px;
    overflow: auto;
  }
  li {
    padding: 3px 0;
    border-top: 1px solid var(--border);
    overflow-wrap: anywhere;
  }
  .when {
    color: var(--text-muted);
    font-size: 12px;
    margin-right: 6px;
    white-space: nowrap;
  }
</style>
