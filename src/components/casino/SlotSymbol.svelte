<script lang="ts">
  // One reel symbol: art (casino/slots/<id>.webp) when dropped in; drawn SVG for the classic pack; else the theme emoji.
  import ArtImg from '../ArtImg.svelte';
  import { SLOT_SYMBOL_IDS, SLOT_SYMBOLS } from '../../lib/casino/slots';

  interface Props {
    theme: string;
    index: number;
  }
  let { theme, index }: Props = $props();
  const pack = $derived(SLOT_SYMBOLS[theme] ? theme : 'classic');
  const id = $derived(SLOT_SYMBOL_IDS[pack][index]);
</script>

<ArtImg name="casino/slots/{id}.webp" class="symimg">
  {#snippet fallback()}
    {#if pack === 'classic'}
      <svg viewBox="0 0 100 100" class="sym" aria-hidden="true">
        {#if index === 0}
          <path d="M50 14 Q44 36 30 58 M50 14 Q60 38 70 62" stroke="#2f7d32" stroke-width="4.5" fill="none" stroke-linecap="round" />
          <path d="M50 14 Q66 6 80 16 Q66 26 50 14 Z" fill="#43a047" stroke="#1b5e20" stroke-width="1.5" />
          <circle cx="30" cy="68" r="19" fill="#d7102b" stroke="#7a0010" stroke-width="2" />
          <circle cx="70" cy="70" r="19" fill="#e0142f" stroke="#7a0010" stroke-width="2" />
          <ellipse cx="23" cy="61" rx="6" ry="4" fill="#fff" opacity=".6" transform="rotate(-30 23 61)" />
          <ellipse cx="63" cy="63" rx="6" ry="4" fill="#fff" opacity=".6" transform="rotate(-30 63 63)" />
        {:else if index === 1}
          <path d="M12 52 Q14 24 50 20 Q86 24 88 52 Q86 80 50 84 Q14 80 12 52 Z" fill="#ffd52e" stroke="#b58900" stroke-width="2.5" />
          <path d="M12 52 l-6 -2 l6 -4 M88 52 l6 2 l-6 4" fill="#ffd52e" stroke="#b58900" stroke-width="2" />
          <ellipse cx="38" cy="38" rx="14" ry="7" fill="#fff" opacity=".55" transform="rotate(-20 38 38)" />
          <path d="M30 66 Q50 76 72 64" stroke="#e6b800" stroke-width="2" fill="none" />
        {:else if index === 2}
          <path d="M50 12 Q58 12 58 20 Q78 26 80 56 L86 72 L14 72 L20 56 Q22 26 42 20 Q42 12 50 12 Z" fill="#f4c542" stroke="#9a6b12" stroke-width="2.5" />
          <path d="M14 72 L86 72 L84 78 L16 78 Z" fill="#c9951c" stroke="#9a6b12" stroke-width="2" />
          <circle cx="50" cy="84" r="8" fill="#e0a41f" stroke="#9a6b12" stroke-width="2" />
          <path d="M32 34 Q30 50 30 62" stroke="#fff" stroke-width="5" opacity=".55" fill="none" stroke-linecap="round" />
        {:else if index === 3}
          {#each [0, 90, 180, 270] as r (r)}
            <path d="M50 50 C38 40 30 26 38 18 C44 12 50 18 50 24 C50 18 56 12 62 18 C70 26 62 40 50 50 Z" fill="#2eb85c" stroke="#136b31" stroke-width="2" transform="rotate({r + 45} 50 50)" />
          {/each}
          <path d="M50 52 Q56 72 66 86" stroke="#136b31" stroke-width="4" fill="none" stroke-linecap="round" />
          <circle cx="50" cy="50" r="4" fill="#9ff0b8" />
        {:else if index === 4}
          <path d="M20 38 L34 18 H66 L80 38 L50 86 Z" fill="#42b8ff" stroke="#0b5b9a" stroke-width="2.5" />
          <path d="M20 38 H80 M34 18 L42 38 L50 86 L58 38 L66 18 M42 38 L50 18 L58 38" stroke="#0b5b9a" stroke-width="1.5" fill="none" />
          <path d="M34 18 L42 38 L20 38 Z" fill="#a8e2ff" opacity=".8" />
          <path d="M58 38 L80 38 L50 86 Z" fill="#1f8fe0" opacity=".7" />
          <circle cx="36" cy="26" r="3" fill="#fff" />
        {:else}
          <text x="50" y="82" text-anchor="middle" font-family="Impact,'Arial Black',sans-serif" font-weight="900" font-size="86" fill="#e3132f" stroke="#ffd24a" stroke-width="4" paint-order="stroke"
            >7</text
          >
          <text x="50" y="82" text-anchor="middle" font-family="Impact,'Arial Black',sans-serif" font-weight="900" font-size="86" fill="none" stroke="#7a0010" stroke-width="1.2">7</text>
        {/if}
      </svg>
    {:else}
      <span class="emo" aria-hidden="true">{SLOT_SYMBOLS[pack][index]}</span>
    {/if}
  {/snippet}
</ArtImg>

<style>
  .sym,
  :global(.symimg) {
    width: 78%;
    height: 78%;
    display: block;
    object-fit: contain;
    filter: drop-shadow(0 3px 2px rgba(0, 0, 0, 0.25));
  }
  .emo {
    font-size: calc(var(--cell, 90px) * 0.56);
    line-height: 1;
    filter: drop-shadow(0 3px 2px rgba(0, 0, 0, 0.25));
  }
</style>
