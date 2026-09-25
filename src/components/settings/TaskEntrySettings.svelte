<script lang="ts">
  // Settings → Adding tasks: auto-describe.
  import { store } from '../../lib/store.svelte';
  import { set } from './settings';
  const s = $derived(store.settings);
</script>

<section class="card">
  <h2>Adding tasks</h2>
  <div class="row">
    <label for="autod">Auto-describe new tasks (plan, steps, estimate)</label>
    <input id="autod" type="checkbox" class="switch" checked={s.autoDescribe} onchange={(e) => set('autoDescribe', (e.target as HTMLInputElement).checked)} />
  </div>
  <p class="help">
    Works offline from the task title and course. Toggle it per task with the “auto plan” chip under quick add. Paste several lines into quick add to create one task per line; tap
    🎤 to dictate.
  </p>
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
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    border-top: 1px solid var(--border);
    font-size: 14px;
  }
  .row label {
    color: var(--text);
  }
  .switch {
    width: 40px;
    height: 22px;
    appearance: none;
    background: var(--border-strong);
    border-radius: 999px;
    position: relative;
    cursor: pointer;
    transition: background var(--dur);
    flex-shrink: 0;
  }
  .switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    transition: transform var(--dur) var(--spring);
  }
  .switch:checked {
    background: var(--accent);
  }
  .switch:checked::after {
    transform: translateX(18px);
  }
  .help {
    font-size: 13px;
    color: var(--text-muted);
    margin: 6px 0;
  }
</style>
