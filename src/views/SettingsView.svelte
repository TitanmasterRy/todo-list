<script lang="ts">
  import AccountPanel from '../components/AccountPanel.svelte';
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
</script>

<div class="page settings">
  <header class="page-head"><h1>{t('nav.settings')}</h1></header>

  <ThemePackSettings />
  <AppearanceSettings />
  <LanguageSettings />
  <SoundSettings />
  <GoalsSettings />
  <GamificationSettings />
  <EconomySettings />
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

<style>
  /* Every section is its own component with its own scoped styles; the shared look (card headings with a gradient
     bar, glowing switches, staggered entrance) is applied here from the page so it stays consistent. */
  .settings :global(section.card) {
    position: relative;
    overflow: hidden;
    animation: rise-in 360ms var(--ease) backwards;
    transition:
      border-color var(--dur),
      box-shadow var(--dur-slow) var(--ease);
  }
  .settings :global(section.card:nth-child(2)) {
    animation-delay: 40ms;
  }
  .settings :global(section.card:nth-child(3)) {
    animation-delay: 80ms;
  }
  .settings :global(section.card:nth-child(4)) {
    animation-delay: 120ms;
  }
  .settings :global(section.card:nth-child(5)) {
    animation-delay: 160ms;
  }
  .settings :global(section.card:nth-child(n + 6)) {
    animation-delay: 200ms;
  }
  .settings :global(section.card:hover) {
    border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow-sm),
      0 0 30px -14px color-mix(in srgb, var(--accent) 55%, transparent);
  }
  .settings :global(section.card > h2) {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }
  .settings :global(section.card > h2::before) {
    content: '';
    width: 4px;
    height: 15px;
    border-radius: 2px;
    background: var(--grad-accent);
    box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 50%, transparent);
    flex-shrink: 0;
  }
  .settings :global(section.card .row) {
    transition: background var(--dur);
    border-radius: var(--radius-sm);
  }
  .settings :global(.switch) {
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
    transition:
      background var(--dur),
      box-shadow var(--dur);
  }
  .settings :global(.switch::after) {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  }
  .settings :global(.switch:hover) {
    box-shadow:
      inset 0 1px 2px rgba(0, 0, 0, 0.2),
      0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent);
  }
  .settings :global(.switch:checked) {
    background: var(--grad-accent);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.25),
      0 0 14px -2px color-mix(in srgb, var(--accent) 70%, transparent);
  }
  .settings :global(.switch:checked:hover) {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.25),
      0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent),
      0 0 18px -2px color-mix(in srgb, var(--accent) 80%, transparent);
  }
  .settings :global(.input.num) {
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
</style>
