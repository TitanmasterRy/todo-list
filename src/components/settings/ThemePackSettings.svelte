<script lang="ts">
  // Settings → Theme pack.
  import ThemePicker from '../ThemePicker.svelte';
</script>

<section class="card">
  <h2>Theme pack</h2>
  <p class="help">Each pack changes colors, corners, the completion sound, the particles that fly out of the checkbox, and the confetti.</p>
  <ThemePicker />
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
  .help {
    font-size: 13px;
    color: var(--text-muted);
    margin: 6px 0;
  }
</style>
