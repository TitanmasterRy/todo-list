<script lang="ts">
  import { onMount } from 'svelte';
  import { store, VIEWS } from './lib/store.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import TabBar from './components/TabBar.svelte';
  import Toasts from './components/Toasts.svelte';
  import TodayView from './views/TodayView.svelte';
  import UpcomingView from './views/UpcomingView.svelte';
  import CoursesView from './views/CoursesView.svelte';
  import InboxView from './views/InboxView.svelte';
  import FocusView from './views/FocusView.svelte';
  import LazyView from './components/LazyView.svelte';
  // less-used views load on first visit (keeps the first download small)
  const loadStats = () => import('./views/StatsView.svelte');
  const loadTools = () => import('./views/ToolsView.svelte');
  const loadSchoology = () => import('./views/SchoologyView.svelte');
  const loadSettings = () => import('./views/SettingsView.svelte');
  const loadPlay = () => import('./views/PlayView.svelte');
  import { startReminders } from './lib/reminders';
  import { startLocalBackup } from './lib/localBackup.svelte';
  import FeedbackLayer from './components/FeedbackLayer.svelte';
  import Keyboard from './components/Keyboard.svelte';
  // dialogs load the first time they open
  const loadEditor = () => import('./components/TaskEditor.svelte');
  const loadShared = () => import('./components/SharedFiles.svelte');
  let sharedFiles = $state<{ files: File[]; info: { title?: string; text?: string; url?: string } } | null>(null);
  const loadPalette = () => import('./components/CommandPalette.svelte');
  const loadShortcuts = () => import('./components/ShortcutSheet.svelte');
  const loadOnboarding = () => import('./components/Onboarding.svelte');
  const loadUnlock = () => import('./components/UnlockDialog.svelte');
  const loadAdmin = () => import('./components/admin/AdminPanel.svelte');
  const loadShareTasks = () => import('./components/ShareTasks.svelte');
  const loadReceiveTasks = () => import('./components/ReceiveTasks.svelte');
  import { site } from './lib/site.svelte';
  const loadRain = () => import('./components/CoinRain.svelte');
  import { hasSecret, promptAtStartup, vault } from './lib/secrets.svelte';
  import DailyPrompts from './components/DailyPrompts.svelte';
  import BulkBar from './components/BulkBar.svelte';
  import { ui } from './lib/ui.svelte';
  import { startAccount } from './lib/account.svelte';
  import { economy, startEconomy } from './lib/economy.svelte';
  import { startSocial } from './lib/social/links';
  import CoinPops from './components/CoinPops.svelte';
  import { t } from './lib/i18n/index.svelte';

  onMount(() => {
    void store.init().then(() => {
      promptAtStartup();
      startEconomy();
      void import('./lib/gist.svelte').then((m) => m.startSync());
      void startAccount();
      // Schoology and Gist sync load right after the first render (they watch for setup done later, too)
      void import('./lib/schoologySync.svelte').then((m) => m.startSchoologySync());
      // Canvas feed sync (its code loads only when a feed is connected)
      if (hasSecret('canvasFeedUrl')) void import('./lib/canvasSync.svelte').then((m) => m.startCanvasSync());
      startReminders();
      void startLocalBackup();
      startSocial();
      void site.load();
      // Spotify's code loads only when it's connected or we're coming back from its sign-in page
      if (hasSecret('spotifyRefreshToken') || new URLSearchParams(location.search).has('code')) void import('./lib/spotify.svelte').then((m) => m.init());
    });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.classList.toggle('force-dark', mq.matches);
      if (store.ready) store.applyTheme();
    };
    apply();
    mq.addEventListener('change', apply);
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        store.now = new Date();
        const k = store.now.toISOString();
        void k;
      }
    };
    document.addEventListener('visibilitychange', onVis);
    // the hidden admin panel: Ctrl+Alt+Shift+A (or ?admin in the address)
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.shiftKey && e.code === 'KeyA') {
        e.preventDefault();
        ui.admin = true;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      mq.removeEventListener('change', apply);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('keydown', onKey);
    };
  });

  const announcement = $derived(site.announcement(store.today));
  const viewLabel = $derived(VIEWS.find((v) => v.id === store.view)?.label ?? '');
  const listViews = ['today', 'upcoming', 'courses', 'inbox'];
  function fab() {
    if (!listViews.includes(store.view)) store.go('today');
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('[data-quick-add]');
      el?.scrollIntoView({ block: 'center' });
      el?.focus();
    }, 50);
  }
  onMount(() => {
    // PWA share target / deep link: ?title=… (&text=…&url=…) prefills quick add.
    const params = new URLSearchParams(window.location.search);
    // group projects: a #tasks=… link (the code stays in the hash, so it never reaches the web host)
    const takeTasks = () => {
      const code = /[#&]tasks=([A-Za-z0-9_-]+)/.exec(location.hash)?.[1];
      if (!code) return;
      ui.receivedTasks = code;
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
    };
    takeTasks();
    window.addEventListener('hashchange', takeTasks);
    if (params.has('admin')) {
      ui.admin = true;
      window.history.replaceState({}, '', window.location.pathname);
    }
    // home-screen shortcuts: ?view=today|focus|play (&new=1 focuses quick add)
    const view = params.get('view');
    if (view && VIEWS.some((v) => v.id === view)) {
      store.go(view as (typeof VIEWS)[number]['id']);
      if (params.get('new')) setTimeout(fab, 300);
      window.history.replaceState({}, '', window.location.pathname);
    }
    // files shared from another app (the service worker parked them): ask what to do with them
    if (params.has('shared')) {
      const info = { title: params.get('title') ?? undefined, text: params.get('text') ?? undefined, url: params.get('url') ?? undefined };
      window.history.replaceState({}, '', window.location.pathname);
      void import('./lib/share').then(async (m) => {
        const files = await m.takeSharedFiles();
        if (files.length) sharedFiles = { files, info };
      });
      return;
    }
    const shared = [params.get('title'), params.get('text'), params.get('url')].filter(Boolean).join(' ').trim();
    if (shared) {
      ui.quickAddPrefill = shared;
      window.history.replaceState({}, '', window.location.pathname);
    }
  });
</script>

<svelte:head>
  <title>{viewLabel ? `${viewLabel} · ${t('app.title')}` : t('app.title')}</title>
</svelte:head>

{#if !store.ready}
  <div class="loading" aria-busy="true">
    <div class="sk-side skeleton"></div>
    <div class="sk-main">
      <div class="skeleton sk-title"></div>
      {#each [0, 1, 2, 3, 4] as i (i)}<div class="skeleton sk-row" style="opacity:{1 - i * 0.15}"></div>{/each}
    </div>
  </div>
{:else}
  <div class="shell">
    <Sidebar />
    <main class="main" id="main">
      {#if announcement}
        <div class="announce {announcement.level}" role="status">
          <span>{announcement.level === 'party' ? '🎉' : announcement.level === 'warn' ? '⚠️' : '📣'}</span>
          <span class="grow">{announcement.text}</span>
          {#if announcement.link}<a href={announcement.link} target="_blank" rel="noopener noreferrer">{t('app.announcementMore')}</a>{/if}
          <button class="btn ghost sm icon" aria-label={t('app.dismiss')} onclick={() => site.dismiss(announcement.id)}>×</button>
        </div>
      {/if}
      {#if store.loadError}
        <div class="page"><div class="card">{t('app.storageError', { error: store.loadError })}</div></div>
      {/if}
      {#if store.view === 'today'}
        <TodayView />
      {:else if store.view === 'upcoming'}
        <UpcomingView />
      {:else if store.view === 'courses'}
        <CoursesView />
      {:else if store.view === 'inbox'}
        <InboxView />
      {:else if store.view === 'focus'}
        <FocusView />
      {:else if store.view === 'stats'}
        <LazyView load={loadStats} />
      {:else if store.view === 'tools'}
        <LazyView load={loadTools} />
      {:else if store.view === 'schoology'}
        <LazyView load={loadSchoology} />
      {:else if store.view === 'play' && store.settings.economyEnabled}
        <LazyView load={loadPlay} />
      {:else if store.view === 'settings'}
        <LazyView load={loadSettings} />
      {/if}
    </main>
    <TabBar />
  </div>
  <button class="fab" onclick={fab} aria-label={t('app.addTask')}>+</button>
  <BulkBar />
  <Toasts />
  <FeedbackLayer />
  <CoinPops />
  {#if economy.rain}
    {#await loadRain() then m}<m.default tick={economy.rain} />{/await}
  {/if}
  <Keyboard />
  {#if store.editingTaskId}
    {#await loadEditor() then m}
      {#if store.editingTaskId}<m.default taskId={store.editingTaskId} onclose={() => (store.editingTaskId = null)} />{/if}
    {/await}
  {/if}
  {#if ui.palette}
    {#await loadPalette() then m}<m.default />{/await}
  {/if}
  {#if sharedFiles}
    {#await loadShared() then m}<m.default files={sharedFiles.files} shared={sharedFiles.info} onclose={() => (sharedFiles = null)} />{/await}
  {/if}
  {#if ui.shortcuts}
    {#await loadShortcuts() then m}<m.default />{/await}
  {/if}
  <DailyPrompts />
  {#if !store.settings.onboarded}
    {#await loadOnboarding() then m}<m.default />{/await}
  {/if}
  {#if vault.prompt}
    {#await loadUnlock() then m}<m.default />{/await}
  {/if}
  {#if ui.shareTasks}
    {#await loadShareTasks() then m}<m.default ids={ui.shareTasks} onclose={() => (ui.shareTasks = null)} />{/await}
  {/if}
  {#if ui.receivedTasks}
    {#await loadReceiveTasks() then m}<m.default code={ui.receivedTasks} onclose={() => (ui.receivedTasks = null)} />{/await}
  {/if}
  {#if ui.admin}
    {#await loadAdmin() then m}<m.default onclose={() => (ui.admin = false)} />{/await}
  {/if}
{/if}

<style>
  .announce {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 8px 12px 0;
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 14px;
    background: var(--bg-elev);
    border: 1px solid var(--border);
  }
  .announce.warn {
    border-color: var(--warn);
  }
  .announce.party {
    border-color: var(--accent);
  }
  .announce .grow {
    flex: 1;
  }
  .loading {
    height: 100vh;
    display: flex;
    gap: 24px;
    padding: 16px;
  }
  .sk-side {
    width: calc(var(--sidebar-w) - 32px);
    border-radius: var(--radius);
  }
  .sk-main {
    flex: 1;
    max-width: 760px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 12px;
  }
  .sk-title {
    width: 40%;
    height: 28px;
    margin-bottom: 12px;
  }
  .sk-row {
    height: 52px;
    border-radius: var(--radius);
  }
  @media (max-width: 760px) {
    .sk-side {
      display: none;
    }
  }
  .shell {
    display: flex;
    min-height: 100vh;
  }
  .main {
    flex: 1;
    min-width: 0;
  }
  @media (min-width: 721px) {
    .main {
      margin-inline-start: var(--sidebar-w);
    }
  }
  .fab {
    display: none;
    position: fixed;
    inset-inline-end: 16px;
    bottom: calc(var(--tabbar-h) + 16px + env(safe-area-inset-bottom));
    width: 54px;
    height: 54px;
    border-radius: 50%;
    background: var(--accent);
    color: var(--accent-contrast, #fff);
    font-size: 30px;
    line-height: 1;
    box-shadow: 0 8px 24px color-mix(in srgb, var(--accent) 45%, transparent);
    z-index: 30;
  }
  .fab:active {
    transform: scale(0.94);
  }
  @media (max-width: 720px) {
    .fab {
      display: grid;
      place-items: center;
    }
  }
</style>
