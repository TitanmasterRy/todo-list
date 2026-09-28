<script lang="ts">
  // Settings → AI helper → usage this month (estimated tokens per provider) and an optional monthly request cap.
  import { store } from '../../lib/store.svelte';
  import { loadUsage, monthKey, monthTotal, type Usage } from '../../lib/aiusage';
  import { formatNumber, t } from '../../lib/i18n/index.svelte';

  let usage = $state<Usage>(loadUsage());
  const month = monthKey();
  const rows = $derived(Object.entries(usage[month] ?? {}).sort((a, b) => b[1].requests - a[1].requests));
  const total = $derived(monthTotal(usage));
  const cap = $derived(store.settings.aiMonthlyCap ?? 0);
  const fmt = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : formatNumber(n));
</script>

<div class="usage" aria-labelledby="ai-usage-h">
  <h3 id="ai-usage-h">{t('aiu.month')} <button class="link" onclick={() => (usage = loadUsage())}>{t('aiu.refresh')}</button></h3>
  {#if rows.length}
    <table>
      <thead><tr><th>{t('aiu.provider')}</th><th>{t('aiu.requests')}</th><th>{t('aiu.in')}</th><th>{t('aiu.out')}</th></tr></thead>
      <tbody>
        {#each rows as [p, r] (p)}<tr><td>{p}</td><td>{r.requests}</td><td>{fmt(r.tokensIn)}</td><td>{fmt(r.tokensOut)}</td></tr>{/each}
      </tbody>
    </table>
  {:else}
    <p class="muted">{t('aiu.none')}</p>
  {/if}
  {#if cap}
    <div
      class="meter"
      class:full={total.requests >= cap}
      role="meter"
      aria-valuemin="0"
      aria-valuemax={cap}
      aria-valuenow={Math.min(cap, total.requests)}
      aria-label={t('aiu.used')}
    >
      <span style="width:{Math.min(100, (total.requests / cap) * 100)}%"></span>
    </div>
    <p class="muted">{t('aiu.of', { n: total.requests, cap })}</p>
  {/if}
  <label class="row"
    >{t('aiu.limit')}
    <input
      class="input num"
      type="number"
      min="0"
      step="10"
      value={cap}
      onchange={(e) => store.updateSettings({ aiMonthlyCap: Math.max(0, Math.floor(Number(e.currentTarget.value) || 0)) })}
      aria-label={t('aiu.limitLabel')}
    /></label
  >
  <p class="muted">{t('aiu.help')}</p>
</div>

<style>
  .usage {
    border-top: 1px solid var(--border);
    margin-top: 10px;
    padding-top: 8px;
  }
  h3 {
    font-size: 14px;
    margin: 0 0 6px;
    display: flex;
    gap: 8px;
    align-items: baseline;
  }
  .link {
    font-size: 12px;
    color: var(--accent-text);
    padding: 0;
    font-weight: 400;
  }
  table {
    border-collapse: collapse;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
  th {
    text-align: start;
    font-weight: 500;
    font-size: 12px;
    color: var(--text-muted);
    padding: 2px 10px 2px 0;
  }
  td {
    padding: 2px 10px 2px 0;
    border-top: 1px solid var(--border);
  }
  tr {
    transition: background var(--dur);
  }
  tbody tr:hover {
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }
  .meter {
    height: 6px;
    border-radius: 3px;
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    overflow: hidden;
    max-width: 320px;
    margin-top: 8px;
  }
  .meter span {
    position: relative;
    display: block;
    height: 100%;
    border-radius: 3px;
    background: var(--grad-accent);
    box-shadow: 0 0 10px -2px var(--accent);
    overflow: hidden;
    transition: width 400ms var(--ease);
  }
  .meter span::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, 0.45) 50%, transparent 70%);
    background-size: 200% 100%;
    animation: shimmer 2.6s linear infinite;
  }
  .meter.full span {
    background: var(--danger, #e5484d);
    box-shadow: 0 0 10px -2px var(--danger);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    margin-top: 8px;
  }
  .num {
    width: 90px;
  }
  .muted {
    font-size: 12px;
    color: var(--text-muted);
    margin: 4px 0;
  }
</style>
