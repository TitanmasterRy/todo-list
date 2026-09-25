<script lang="ts">
  import { onMount } from 'svelte';
  import { store, VIEWS } from './lib/store.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import TabBar from './components/TabBar.svelte';
  import Toasts from './components/Toasts.svelte';
  import TaskEditor from './components/TaskEditor.svelte';
  import TodayView from './views/TodayView.svelte';
  import UpcomingView from './views/UpcomingView.svelte';
  import CoursesView from './views/CoursesView.svelte';
  import InboxView from './views/InboxView.svelte';
  import FocusView from './views/FocusView.svelte';
  import StatsView from './views/StatsView.svelte';
  import SettingsView from './views/SettingsView.svelte';
  import ToolsView from './views/ToolsView.svelte';
  import SchoologyView from './views/SchoologyView.svelte';
  import { startSchoologySync } from './lib/schoologySync.svelte';
  import { startReminders } from './lib/reminders';
  import { startLocalBackup } from './lib/localBackup.svelte';
  import { init as initSpotify } from './lib/spotify.svelte';
  import FeedbackLayer from './components/FeedbackLayer.svelte';
  import Keyboard from './components/Keyboard.svelte';
  import CommandPalette from './components/CommandPalette.svelte';
  import ShortcutSheet from './components/ShortcutSheet.svelte';
  import Onboarding from './components/Onboarding.svelte';
  import DailyPrompts from './components/DailyPrompts.svelte';
  import BulkBar from './components/BulkBar.svelte';
  import { ui } from './lib/ui.svelte';
  import { startSync } from './lib/gist.svelte';
  import { startAccount } from './lib/account.svelte';

  onMount(() => {
    void store.init().then(() => {
      startSync();
      void startAccount();
      startSchoologySync();
      startReminders();
      void startLocalBackup();
      void initSpotify();
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
    return () => {
      mq.removeEventListener('change', apply);
      document.removeEventListener('visibilitychange', onVis);
    };
  });

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
    const shared = [params.get('title'), params.get('text'), params.get('url')].filter(Boolean).join(' ').trim();
    if (shared) {
      ui.quickAddPrefill = shared;
      window.history.replaceState({}, '', window.location.pathname);
    }
  });
</script>

<svelte:head>
  <title>{viewLabel ? `${viewLabel} · Homework To-Do` : 'Homework To-Do'}</title>
</svelte:head>

{#if !store.ready}
  <div class="loading" aria-busy="true">
    <div class="spinner"></div>
  </div>
{:else}
  <div class="shell">
    <Sidebar />
    <main class="main" id="main">
      {#if store.loadError}
        <div class="page"><div class="card">Could not open local storage: {store.loadError}</div></div>
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
        <StatsView />
      {:else if store.view === 'tools'}
        <ToolsView />
      {:else if store.view === 'schoology'}
        <SchoologyView />
      {:else if store.view === 'settings'}
        <SettingsView />
      {/if}
    </main>
    <TabBar />
  </div>
  <button class="fab" onclick={fab} aria-label="Add task">+</button>
  <BulkBar />
  <Toasts />
  <FeedbackLayer />
  <Keyboard />
  {#if store.editingTaskId}
    <TaskEditor taskId={store.editingTaskId} onclose={() => (store.editingTaskId = null)} />
  {/if}
  {#if ui.palette}
    <CommandPalette />
  {/if}
  {#if ui.shortcuts}
    <ShortcutSheet />
  {/if}
  <DailyPrompts />
  {#if !store.settings.onboarded}
    <Onboarding />
  {/if}
{/if}

<style>
  .loading {
    height: 100vh;
    display: grid;
    place-items: center;
  }
  .spinner {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
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
      margin-left: var(--sidebar-w);
    }
  }
  .fab {
    display: none;
    position: fixed;
    right: 16px;
    bottom: calc(var(--tabbar-h) + 16px + env(safe-area-inset-bottom));
    width: 54px;
    height: 54px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
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
