<script lang="ts">
  // SemesterSetup: implemented in phase 9.
  import { ui } from '../lib/ui.svelte';
</script>
<button class="visually-hidden" onclick={() => (ui.weeklyReview = false, ui.semesterSetup = false)}>close</button>
