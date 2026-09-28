<script lang="ts" module>
  export type Who = 'tess' | 'lou' | 'sam' | 'you';
</script>

<script lang="ts">
  // Portraits for the casino crew (they deal the table games and play at the Hold'em table): Tess the owl, Lou the
  // fox and Sam the bear. Simple original shapes; generated portraits replace them via the art slots.
  import ArtImg from '../ArtImg.svelte';

  interface Props {
    who: Who;
    size?: number;
    label?: string;
  }
  let { who, size = 56, label }: Props = $props();
  const NAMES: Record<Who, string> = { tess: 'Tess', lou: 'Lou', sam: 'Sam', you: 'You' };
</script>

<span class="av" style="width:{size}px;height:{size}px" role="img" aria-label={label ?? NAMES[who]}>
  {#if who === 'you'}
    {@render drawn()}
  {:else}
    <ArtImg name="casino/dealer-{who}.webp" class="avimg">
      {#snippet fallback()}{@render drawn()}{/snippet}
    </ArtImg>
  {/if}
</span>

{#snippet drawn()}
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="31" fill={who === 'tess' ? '#2b2150' : who === 'lou' ? '#3a1d10' : who === 'sam' ? '#10283a' : '#1d2b4a'} />
    <circle cx="32" cy="32" r="26" fill={who === 'tess' ? '#3b2f6e' : who === 'lou' ? '#57301a' : who === 'sam' ? '#1b3d57' : '#2c4270'} opacity=".8" />
    {#if who === 'tess'}
      <!-- owl: tufts, feathered body, big eyes, bow tie -->
      <path d="M17 18 L23 27 L15 28 Z M47 18 L41 27 L49 28 Z" fill="#6f5aa8" />
      <ellipse cx="32" cy="38" rx="17" ry="18" fill="#7d68b8" />
      <ellipse cx="32" cy="44" rx="10" ry="10" fill="#b9a8e6" />
      <path d="M26 42 q3 2 6 0 q3 2 6 0 M26 47 q3 2 6 0 q3 2 6 0" stroke="#8e7bc9" stroke-width="1.2" fill="none" />
      <circle cx="24.5" cy="31" r="7.5" fill="#fff" />
      <circle cx="39.5" cy="31" r="7.5" fill="#fff" />
      <circle cx="24.5" cy="31" r="4.6" fill="#f2a516" />
      <circle cx="39.5" cy="31" r="4.6" fill="#f2a516" />
      <circle cx="25" cy="31.5" r="2.6" fill="#1a1030" />
      <circle cx="40" cy="31.5" r="2.6" fill="#1a1030" />
      <circle cx="23.6" cy="29.8" r="1" fill="#fff" />
      <circle cx="38.6" cy="29.8" r="1" fill="#fff" />
      <path d="M29.5 36 L34.5 36 L32 40.5 Z" fill="#f08a24" />
      <path d="M17 24 Q24 20 30 25 M47 24 Q40 20 34 25" stroke="#4f3f86" stroke-width="2" fill="none" stroke-linecap="round" />
      <path d="M26 56 L32 53.5 L38 56 L38 51 L32 53.5 L26 51 Z" fill="#d6203a" />
      <circle cx="32" cy="53.5" r="1.6" fill="#ffd76a" />
    {:else if who === 'lou'}
      <!-- fox: tall ears, pointed face, white cheeks, sly eyes, green visor -->
      <path d="M14 12 L27 24 L17 31 Z M50 12 L37 24 L47 31 Z" fill="#e6722a" />
      <path d="M17 17 L24 24 L19 28 Z M47 17 L40 24 L45 28 Z" fill="#3a1a0c" />
      <path d="M13 29 Q32 14 51 29 Q50 44 32 54 Q14 44 13 29 Z" fill="#ee7f33" />
      <path d="M13 29 Q20 42 32 54 Q22 46 22 38 Z M51 29 Q44 42 32 54 Q42 46 42 38 Z" fill="#fff3e6" />
      <path d="M21 33 q4 -3 8 0" stroke="#2a1206" stroke-width="2.4" fill="none" stroke-linecap="round" />
      <path d="M35 33 q4 -3 8 0" stroke="#2a1206" stroke-width="2.4" fill="none" stroke-linecap="round" />
      <ellipse cx="32" cy="47" rx="3.2" ry="2.4" fill="#1d0c04" />
      <path d="M28 50.5 q4 3 8 0" stroke="#7a3510" stroke-width="1.4" fill="none" stroke-linecap="round" />
      <path d="M17 24 Q32 13 47 24 L45 27 Q32 19 19 27 Z" fill="#1f8a55" />
      <path d="M19 27 Q32 19 45 27" stroke="#ffd76a" stroke-width="1.2" fill="none" />
    {:else if who === 'sam'}
      <!-- bear: round ears, muzzle, calm eyes, blue bow tie -->
      <circle cx="17" cy="19" r="7" fill="#8a5a3b" />
      <circle cx="47" cy="19" r="7" fill="#8a5a3b" />
      <circle cx="17" cy="19" r="3.6" fill="#d8a878" />
      <circle cx="47" cy="19" r="3.6" fill="#d8a878" />
      <circle cx="32" cy="33" r="18" fill="#9a6644" />
      <ellipse cx="32" cy="40" rx="9" ry="7" fill="#e3bb8e" />
      <ellipse cx="32" cy="37" rx="3.4" ry="2.4" fill="#2a170c" />
      <path d="M32 39.5 v3 M28.5 43.5 q3.5 2.5 7 0" stroke="#2a170c" stroke-width="1.4" fill="none" stroke-linecap="round" />
      <circle cx="25" cy="30" r="2.3" fill="#1c1008" />
      <circle cx="39" cy="30" r="2.3" fill="#1c1008" />
      <circle cx="24.3" cy="29.3" r=".8" fill="#fff" />
      <circle cx="38.3" cy="29.3" r=".8" fill="#fff" />
      <path d="M22 25.5 q3 -2 6 0 M36 25.5 q3 -2 6 0" stroke="#5c3a24" stroke-width="1.4" fill="none" stroke-linecap="round" />
      <path d="M25 56 L32 53 L39 56 L39 50 L32 53 L25 50 Z" fill="#2f7de1" />
      <circle cx="32" cy="53" r="1.6" fill="#ffd76a" />
    {:else}
      <!-- you: a friendly round face in the app's accent -->
      <circle cx="32" cy="30" r="15" fill="var(--accent, #6c5ce7)" />
      <path d="M13 58 Q32 36 51 58 Z" fill="var(--accent, #6c5ce7)" opacity=".85" />
      <circle cx="26.5" cy="28" r="2" fill="#fff" />
      <circle cx="37.5" cy="28" r="2" fill="#fff" />
      <path d="M25.5 34 q6.5 5 13 0" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" />
    {/if}
    <circle cx="32" cy="32" r="30.5" fill="none" stroke="#d9ab45" stroke-width="2.5" />
    <circle cx="32" cy="32" r="28.6" fill="none" stroke="#fff3c4" stroke-width=".6" opacity=".6" />
  </svg>
{/snippet}

<style>
  .av {
    display: inline-block;
    flex: none;
    border-radius: 50%;
    filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.4));
  }
  .av :global(svg),
  .av :global(.avimg) {
    width: 100%;
    height: 100%;
    display: block;
    border-radius: 50%;
    object-fit: cover;
  }
</style>
