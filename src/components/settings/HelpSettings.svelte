<script lang="ts">
  // Settings → Help: shortcuts and the welcome tour.
  import { store } from '../../lib/store.svelte';
  import { ui } from '../../lib/ui.svelte';
</script>

<section class="card">
  <h2>Help</h2>
  <div class="btns">
    <button class="btn" onclick={() => (ui.shortcuts = true)}>Keyboard shortcuts <span class="kbd">?</span></button>
    <button class="btn" onclick={() => store.updateSettings({ onboarded: false })}>Show welcome tour</button>
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
