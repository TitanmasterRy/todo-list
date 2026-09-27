<script lang="ts">
  // Renders a view that's split into its own chunk, so it downloads the first time it's opened.
  import type { Component } from 'svelte';

  interface Props {
    load: () => Promise<{ default: Component }>;
  }
  let { load }: Props = $props();
</script>

{#await load()}
  <div class="page" aria-busy="true">
    <div class="skeleton head"></div>
    {#each [0, 1, 2] as i (i)}<div class="skeleton card-sk"></div>{/each}
  </div>
{:then m}
  <m.default />
{:catch e}
  <div class="page">
    <div class="card">
      Couldn't load this view{navigator.onLine ? '' : ' while offline'}: {e instanceof Error ? e.message : String(e)}
      <button class="btn sm" onclick={() => location.reload()}>Reload</button>
    </div>
  </div>
{/await}

<style>
  .head {
    width: 30%;
    height: 28px;
    margin: 8px 0 20px;
  }
  .card-sk {
    height: 120px;
    margin-bottom: 12px;
    border-radius: var(--radius);
  }
</style>
