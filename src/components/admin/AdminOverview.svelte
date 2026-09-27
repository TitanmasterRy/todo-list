<script lang="ts">
  // Admin → Overview: what's stored on this device, the build, sync and the service worker at a glance.
  import { onMount } from 'svelte';
  import { store } from '../../lib/store.svelte';
  import { economy } from '../../lib/economy.svelte';
  import { account } from '../../lib/account.svelte';
  import { sync } from '../../lib/gist.svelte';
  import { pwa } from '../../lib/pwa.svelte';
  import { loadUsage, monthTotal } from '../../lib/aiusage';
  import { site } from '../../lib/site.svelte';
  import { errorLog } from '../../lib/errlog';

  let storage = $state<{ usage?: number; quota?: number; persisted?: boolean }>({});
  let sw = $state('checking…');
  onMount(async () => {
    try {
      const est = await navigator.storage?.estimate?.();
      storage = { usage: est?.usage, quota: est?.quota, persisted: await navigator.storage?.persisted?.() };
    } catch {
      /* not supported */
    }
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      sw = reg ? (reg.active ? `active · scope ${reg.scope}` : 'installing') : 'not registered';
    } catch {
      sw = 'not available';
    }
  });

  const mb = (n?: number) => (n === undefined ? '—' : `${(n / 1024 / 1024).toFixed(1)} MB`);
  const ai = monthTotal(loadUsage());
  const rows = $derived([
    ['Tasks', `${store.openTasks.length} open · ${store.completedTasks.length} done · ${store.tombstones.length} tombstones`],
    ['Courses', `${store.activeCourses.length} active · ${store.courses.length} total`],
    ['Notecards', `${store.cards.length} cards in ${store.decks.length} decks`],
    ['Templates / day notes', `${store.templates.length} / ${store.dayNotes.length}`],
    ['Ledger', `${store.ledger.length} entries · 🪙 ${economy.wallet.coins} · 🎰 ${economy.wallet.chips} · 🎟️ ${economy.wallet.vouchers}`],
    ['Level / XP', `Level ${store.stats.level} · ${store.stats.xp} XP · streak ${store.streak} (best ${store.stats.streak.best})`],
    ['Storage', `${mb(storage.usage)} of ${mb(storage.quota)}${storage.persisted ? ' · persistent' : ''}`],
    ['Build', `${__CHANGELOG_HEAD__} · base ${import.meta.env.BASE_URL} · ${import.meta.env.MODE}`],
    ['Service worker', `${sw}${pwa.offlineReady ? ' · offline ready' : ''}`],
    ['Account sync', `${account.status}${account.email ? ` (${account.email})` : ''}${account.lastSyncAt ? ` · last ${new Date(account.lastSyncAt).toLocaleString()}` : ''}`],
    ['Gist sync', `${sync.status}${sync.lastSyncAt ? ` · last ${new Date(sync.lastSyncAt).toLocaleString()}` : ''}${sync.lastError ? ` · ${sync.lastError}` : ''}`],
    ['AI this month', `${ai.requests} requests · ~${Math.round((ai.tokensIn + ai.tokensOut) / 1000)}k tokens`],
    [
      'Site switches',
      Object.entries(site.config.flags)
        .map(([k, v]) => `${k} ${v ? 'on' : 'off'}`)
        .join(', ') || 'all on',
    ],
    ['Errors this session', String(errorLog.length)],
  ]);
</script>

<section class="card">
  <h3>This device</h3>
  <table>
    <tbody>
      {#each rows as [k, v] (k)}
        <tr><th scope="row">{k}</th><td>{v}</td></tr>
      {/each}
    </tbody>
  </table>
</section>

<style>
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th {
    text-align: left;
    font-weight: 500;
    color: var(--text-muted);
    padding: 5px 8px 5px 0;
    white-space: nowrap;
    vertical-align: top;
  }
  td {
    padding: 5px 0;
    word-break: break-word;
  }
  tr + tr > * {
    border-top: 1px solid var(--border);
  }
  h3 {
    margin: 0 0 8px;
    font-size: 15px;
  }
</style>
