<script lang="ts">
  // Settings → Help: shortcuts, the welcome tour and what's new.
  import { store } from '../../lib/store.svelte';
  import { ui } from '../../lib/ui.svelte';
  import { t } from '../../lib/i18n/index.svelte';
</script>

<section class="card">
  <h2>{t('settings.help')}</h2>
  <div class="btns">
    <button class="btn" onclick={() => (ui.shortcuts = true)}>Keyboard shortcuts <span class="kbd">?</span></button>
    <button class="btn" onclick={() => store.updateSettings({ onboarded: false })}>Show welcome tour</button>
    <button class="btn" onclick={() => (ui.whatsNew = true)}>✨ What’s new</button>
  </div>
</section>

<style>
  section {
    margin-bottom: 12px;
  }
  h2 {
    font-size: 15px;
    margin: 0 0 10px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
    margin: 8px 0;
  }
</style>
