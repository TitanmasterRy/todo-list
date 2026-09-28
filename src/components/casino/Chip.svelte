<script lang="ts">
  // One casino chip seen from above: the chip art for its denomination when dropped in, else the drawn SVG.
  import ArtImg from '../ArtImg.svelte';
  import { artUrl } from '../../lib/art.svelte';
  import { chipArt, chipLabel, chipSvg } from './chips';

  interface Props {
    value: number;
    size?: number;
    class?: string;
  }
  let { value, size = 36, class: cls = '' }: Props = $props();
  const art = $derived(chipArt(value));
  const hasArt = $derived(!!artUrl(art.name));
</script>

<span class="cz-chip {cls}" class:art={hasArt} style="width:{size}px;height:{size}px;--fs:{Math.round(size * 0.3)}px" aria-hidden="true">
  <ArtImg name={art.name} class={art.tint ? 'cz-tint10' : ''}>
    {#snippet fallback()}{@html chipSvg(value)}{/snippet}
  </ArtImg>
  <span class="v">{chipLabel(value)}</span>
</span>

<style>
  .cz-chip {
    position: relative;
    display: inline-grid;
    place-items: center;
    flex: none;
    border-radius: 50%;
  }
  .cz-chip :global(svg),
  .cz-chip :global(img) {
    width: 100%;
    height: 100%;
    display: block;
    grid-area: 1 / 1;
  }
  .v {
    display: none;
    grid-area: 1 / 1;
    font-weight: 900;
    font-size: var(--fs);
    color: #222;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.6);
  }
  .cz-chip.art .v {
    display: block;
  }
</style>
