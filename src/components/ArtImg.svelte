<script lang="ts">
  // An art slot: the generated image when public/art/manifest.json lists it, else the drawn fallback.
  import type { Snippet } from 'svelte';
  import { artUrl } from '../lib/art.svelte';

  interface Props {
    name: string;
    alt?: string;
    class?: string;
    fallback?: Snippet;
  }
  let { name, alt = '', class: cls = '', fallback }: Props = $props();
  const url = $derived(artUrl(name));
  let failed = $state<string | null>(null);
</script>

{#if url && failed !== url}
  <img src={url} {alt} class={cls} draggable="false" decoding="async" onerror={() => (failed = url)} />
{:else if fallback}
  {@render fallback()}
{/if}
