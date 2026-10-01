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
  // On phones a chip row at the top jumps to a section (the page is long); each section is wrapped with an id.
  const sections = $derived([
    { id: 'theme', label: t('settings.themePack') },
    { id: 'appearance', label: t('settings.appearance') },
    { id: 'language', label: t('settings.language') },
    { id: 'sounds', label: t('settings.sounds') },
    { id: 'goals', label: t('settings.goals') },
    { id: 'gamification', label: t('settings.gamification') },
    { id: 'economy', label: t('settings.economy') },
    { id: 'adding', label: t('settings.adding') },
    { id: 'ai', label: t('settings.ai') },
    { id: 'notifications', label: t('settings.notifications') },
    { id: 'music', label: t('settings.music') },
    { id: 'schoology', label: t('settings.schoology') },
    { id: 'templates', label: t('settings.templates') },
    { id: 'account', label: t('settings.account') },
    { id: 'gist', label: t('settings.gist') },
    { id: 'privacy', label: t('settings.privacy') },
    { id: 'data', label: t('settings.data') },
    { id: 'trash', label: t('settings.trash') },
    { id: 'collection', label: t('settings.collection') },
    { id: 'help', label: t('settings.help') },
  ]);
  function jump(id: string) {
    document.getElementById(`s-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
</script>

<div class="page settings">
  <header class="page-head"><h1>{t('nav.settings')}</h1></header>
  <nav class="jump" aria-label={t('settings.jump')}>
    {#each sections as s (s.id)}<button class="chip" onclick={() => jump(s.id)}>{s.label}</button>{/each}
  </nav>

  <div id="s-theme"><ThemePackSettings /></div>
  <div id="s-appearance"><AppearanceSettings /></div>
  <div id="s-language"><LanguageSettings /></div>
  <div id="s-sounds"><SoundSettings /></div>
  <div id="s-goals"><GoalsSettings /></div>
  <div id="s-gamification"><GamificationSettings /></div>
  <div id="s-economy"><EconomySettings /></div>
  <div id="s-adding"><TaskEntrySettings /></div>
  <div id="s-ai"><AiSettings /></div>
  <div id="s-notifications"><NotificationSettings /></div>
  <div id="s-music"><MusicAccountsSettings /></div>
  <div id="s-schoology"><SchoologySettings /></div>
  <div id="s-templates"><TemplateSettings /></div>
  <div id="s-account"><AccountPanel /></div>
  <div id="s-gist"><GistSettings /></div>
  <div id="s-privacy"><PrivacySettings /></div>
  <div id="s-data"><DataSettings /></div>
  <div id="s-trash"><TrashSettings /></div>
  <div id="s-collection"><CollectionSettings /></div>
  <div id="s-help"><HelpSettings /></div>
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
  .jump {
    display: none;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    margin: -4px -12px 12px;
    padding: 4px 12px;
    scroll-padding-inline: 12px;
  }
  .jump::-webkit-scrollbar {
    display: none;
  }
  .jump .chip {
    flex-shrink: 0;
    white-space: nowrap;
    cursor: pointer;
    padding: 7px 12px;
    font-size: 13px;
  }
  [id^='s-'] {
    scroll-margin-top: calc(8px + env(safe-area-inset-top));
  }
  @media (max-width: 720px) {
    .jump {
      display: flex;
    }
  }
</style>
