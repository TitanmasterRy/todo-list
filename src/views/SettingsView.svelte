<script lang="ts">
  import { store } from '../lib/store.svelte';
  import AccountPanel from '../components/AccountPanel.svelte';
  import ArcadeAdmin from '../components/ArcadeAdmin.svelte';
  import ThemePackSettings from '../components/settings/ThemePackSettings.svelte';
  import AppearanceSettings from '../components/settings/AppearanceSettings.svelte';
  import LanguageSettings from '../components/settings/LanguageSettings.svelte';
  import { t } from '../lib/i18n/index.svelte';
  import SoundSettings from '../components/settings/SoundSettings.svelte';
  import GoalsSettings from '../components/settings/GoalsSettings.svelte';
  import GamificationSettings from '../components/settings/GamificationSettings.svelte';
  import EconomySettings from '../components/settings/EconomySettings.svelte';
  import TaskEntrySettings from '../components/settings/TaskEntrySettings.svelte';
  import AiSettings from '../components/settings/AiSettings.svelte';
  import NotificationSettings from '../components/settings/NotificationSettings.svelte';
  import MusicAccountsSettings from '../components/settings/MusicAccountsSettings.svelte';
  import SchoologySettings from '../components/settings/SchoologySettings.svelte';
  import TemplateSettings from '../components/settings/TemplateSettings.svelte';
  import GistSettings from '../components/settings/GistSettings.svelte';
  import DataSettings from '../components/settings/DataSettings.svelte';
  import PrivacySettings from '../components/settings/PrivacySettings.svelte';
  import TrashSettings from '../components/settings/TrashSettings.svelte';
  import CollectionSettings from '../components/settings/CollectionSettings.svelte';
  import HelpSettings from '../components/settings/HelpSettings.svelte';

  // Each section is its own component under components/settings/, rendered in this order.
  const s = $derived(store.settings);
</script>

<div class="page">
  <header class="page-head"><h1>{t('nav.settings')}</h1></header>

  <ThemePackSettings />
  <AppearanceSettings />
  <LanguageSettings />
  <SoundSettings />
  <GoalsSettings />
  <GamificationSettings />
  <EconomySettings />
  {#if s.economyEnabled && s.arcadeAdmin}
    <ArcadeAdmin />
  {/if}
  <TaskEntrySettings />
  <AiSettings />
  <NotificationSettings />
  <MusicAccountsSettings />
  <SchoologySettings />
  <TemplateSettings />
  <AccountPanel />
  <GistSettings />
  <PrivacySettings />
  <DataSettings />
  <TrashSettings />
  <CollectionSettings />
  <HelpSettings />
</div>
