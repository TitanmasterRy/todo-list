<script lang="ts">
  // Hand-drawn SVG art for Orebelt's buildings and items. Decorative: callers label things in text.
  import { ITEM, type BuildingId, type ItemId } from '../../../lib/factory/data';

  interface Props {
    building?: BuildingId;
    item?: ItemId;
    size?: number;
  }
  let { building, item, size = 24 }: Props = $props();

  const def = $derived(item ? ITEM[item] : undefined);
  const c = $derived(def?.color ?? '#999');
  const mk = $derived(building === 'miner2' ? 2 : building === 'miner3' ? 3 : 1);
  const O = '#1b1f24'; // outline
  const ST = '#5b6470'; // steel
  const OR = '#e0701a'; // safety orange
  const TL = '#14a3b1'; // teal
  const HZ = '#f2b632'; // hazard yellow
</script>

{#snippet stripes(x: number, y: number, w: number, h: number)}
  <rect {x} {y} width={w} height={h} rx="1" fill="#2a2f36" />
  {#each Array.from({ length: Math.floor(w / 8) }) as _, i}
    <path d="M{x + 2 + i * 8} {y + h}l{h * 0.6} -{h}h3l-{h * 0.6} {h}z" fill={HZ} />
  {/each}
{/snippet}

{#if building}
  <svg class="fi" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    {#if building === 'camp'}
      {@render stripes(5, 37, 38, 6)}
      <path d="M9 37V25a15 12 0 0 1 30 0v12z" fill="#7d8896" stroke={O} stroke-width="1.5" />
      <path d="M9 30h30" stroke={O} stroke-width="1" opacity=".5" />
      <rect x="21" y="22" width="11" height="6" rx="1.5" fill={TL} stroke={O} />
      <rect x="13" y="29" width="5" height="8" fill="#4a525d" stroke={O} />
      <path d="M34 16V5" stroke={O} stroke-width="2" />
      <circle cx="34" cy="5" r="2.5" fill={OR} />
      <path d="M29 9a7 7 0 0 1 10 0" stroke={TL} stroke-width="1.5" fill="none" />
    {:else if building === 'miner1' || building === 'miner2' || building === 'miner3'}
      {@render stripes(7, 38, 34, 5)}
      <path d="M13 38 22 9h4l9 29" stroke={OR} stroke-width="3" fill="none" stroke-linejoin="round" />
      <path d="M16 29h16M19 19h10" stroke={OR} stroke-width="2" />
      <rect x="23" y="17" width="2.5" height="15" fill="#8f9aa6" />
      <path d="M20 31h8l-4 10z" fill="#c3cad2" stroke={O} />
      <rect x="17" y="8" width="14" height="9" rx="1.5" fill={ST} stroke={O} />
      {#each Array.from({ length: mk }) as _, i}
        <path d="M{19.5 + i * 3.5} 10.5l2 2-2 2" stroke={TL} stroke-width="1.6" fill="none" />
      {/each}
    {:else if building === 'pump'}
      {@render stripes(5, 38, 38, 5)}
      <path d="M18 38l6-19 6 19" stroke={ST} stroke-width="3" fill="none" />
      <path d="M8 21 40 14" stroke={OR} stroke-width="4" stroke-linecap="round" />
      <path d="M5 16h6l1 10H6z" fill={OR} stroke={O} />
      <path d="M9 26v12" stroke="#8f9aa6" stroke-width="1.5" />
      <circle cx="37" cy="27" r="5" fill="#3b3f45" stroke={O} />
      <circle cx="24" cy="18" r="2" fill={TL} />
    {:else if building === 'smelter'}
      {@render stripes(7, 39, 34, 4)}
      <rect x="30" y="4" width="6" height="12" fill="#4a525d" stroke={O} />
      <rect x="10" y="16" width="28" height="23" rx="2" fill={ST} stroke={O} />
      <rect x="8" y="13" width="32" height="4" rx="1" fill="#2a2f36" />
      <rect x="16" y="24" width="16" height="11" rx="3" fill="#ff8a2a" stroke={O} />
      <rect x="19" y="27" width="10" height="5" rx="2" fill="#ffd166" />
    {:else if building === 'foundry'}
      {@render stripes(4, 39, 40, 4)}
      <rect x="8" y="5" width="6" height="14" fill="#4a525d" stroke={O} />
      <rect x="34" y="7" width="6" height="12" fill="#4a525d" stroke={O} />
      <rect x="5" y="18" width="38" height="21" rx="2" fill={ST} stroke={O} />
      <rect x="10" y="25" width="11" height="9" rx="2" fill="#ff8a2a" stroke={O} />
      <rect x="27" y="25" width="11" height="9" rx="2" fill="#ff8a2a" stroke={O} />
      <path d="M5 21h38" stroke={OR} stroke-width="2" />
    {:else if building === 'constructor'}
      {@render stripes(7, 39, 34, 4)}
      <rect x="8" y="19" width="32" height="20" rx="2" fill={ST} stroke={O} />
      <rect x="14" y="7" width="20" height="10" rx="1.5" fill={OR} stroke={O} />
      <rect x="22" y="17" width="4" height="9" fill="#c3cad2" stroke={O} />
      <rect x="8" y="31" width="32" height="4" fill="#2a2f36" />
      <rect x="17" y="28" width="14" height="3" fill="#b8c0c9" stroke={O} stroke-width=".8" />
    {:else if building === 'assembler'}
      {@render stripes(5, 39, 38, 4)}
      <rect x="6" y="22" width="36" height="17" rx="2" fill={ST} stroke={O} />
      <path d="M10 22V11l9 6" stroke={OR} stroke-width="3" fill="none" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M38 22V11l-9 6" stroke={OR} stroke-width="3" fill="none" stroke-linejoin="round" stroke-linecap="round" />
      <circle cx="20" cy="18" r="2" fill={TL} />
      <circle cx="28" cy="18" r="2" fill={TL} />
      <rect x="18" y="28" width="12" height="6" rx="1" fill="#7e8a96" stroke={O} />
    {:else if building === 'manufacturer'}
      {@render stripes(3, 39, 42, 4)}
      <rect x="4" y="13" width="40" height="26" rx="2" fill={ST} stroke={O} />
      <rect x="8" y="8" width="8" height="5" fill="#4a525d" />
      <rect x="20" y="8" width="8" height="5" fill="#4a525d" />
      <circle cx="16" cy="27" r="7" fill="none" stroke={OR} stroke-width="4" stroke-dasharray="3 2" />
      <circle cx="16" cy="27" r="3" fill={OR} />
      <rect x="27" y="19" width="13" height="9" rx="1" fill={TL} stroke={O} />
      <path d="M29 31h9M29 34h9" stroke="#2a2f36" stroke-width="1.5" />
    {:else if building === 'refinery'}
      {@render stripes(3, 39, 42, 4)}
      <rect x="5" y="18" width="12" height="21" rx="6" fill="#8f9aa6" stroke={O} />
      <rect x="21" y="5" width="8" height="34" fill={ST} stroke={O} />
      <path d="M21 12h8M21 20h8M21 28h8" stroke={OR} stroke-width="2" />
      <rect x="33" y="22" width="10" height="17" rx="5" fill="#8f9aa6" stroke={O} />
      <path d="M17 24h4M29 27h4" stroke={OR} stroke-width="2.5" />
      <circle cx="25" cy="5" r="2" fill="#ffd166" />
    {:else if building === 'biomassBurner'}
      {@render stripes(9, 39, 30, 4)}
      <rect x="12" y="17" width="24" height="22" rx="4" fill={ST} stroke={O} />
      <circle cx="24" cy="28" r="6" fill="#ff8a2a" stroke={O} />
      <path d="M24 32c-3-2-2-5 0-8 2 3 3 6 0 8z" fill="#ffd166" />
      <path d="M17 17c0-6 5-9 10-9-1 5-4 9-10 9z" fill="#5fa84b" stroke={O} stroke-width=".8" />
      <path d="M33 11l-3 5h3l-2 4" stroke={TL} stroke-width="1.6" fill="none" />
    {:else if building === 'coalGenerator'}
      {@render stripes(3, 39, 42, 4)}
      <rect x="4" y="19" width="28" height="20" rx="2" fill={ST} stroke={O} />
      <rect x="34" y="5" width="8" height="34" fill="#4a525d" stroke={O} />
      <rect x="34" y="11" width="8" height="4" fill={HZ} />
      <path d="M20 22l-6 9h5l-3 7 8-10h-5l3-6z" fill={TL} stroke={O} stroke-width=".8" />
    {:else if building === 'fuelGenerator'}
      {@render stripes(3, 39, 42, 4)}
      <rect x="6" y="13" width="36" height="26" rx="7" fill={ST} stroke={O} />
      <path d="M6 20h36M6 32h36" stroke={OR} stroke-width="2.5" />
      <rect x="20" y="8" width="8" height="5" rx="1" fill="#d44b3a" stroke={O} />
      <path d="M26 17l-6 9h5l-3 7 8-10h-5l3-6z" fill={HZ} stroke={O} stroke-width=".8" />
    {:else if building === 'storage'}
      {@render stripes(7, 39, 34, 4)}
      <rect x="11" y="10" width="26" height="29" rx="4" fill="#7d8896" stroke={O} />
      <path d="M11 17h26M11 24h26M11 31h26" stroke="#4a525d" stroke-width="1.5" />
      <path d="M11 13a13 6 0 0 1 26 0" fill="#8f9aa6" stroke={O} />
      <rect x="20" y="27" width="8" height="8" rx="1" fill={OR} stroke={O} />
      <rect x="22" y="29" width="4" height="2" fill={HZ} />
      <rect x="15" y="4" width="4" height="7" fill="#4a525d" stroke={O} />
    {:else if building === 'loader'}
      {@render stripes(7, 39, 34, 4)}
      <path d="M8 8h26l-6 16H14z" fill={ST} stroke={O} stroke-linejoin="round" />
      <path d="M8 11h26" stroke={OR} stroke-width="2" />
      <rect x="18" y="24" width="6" height="8" fill="#4a525d" stroke={O} />
      <rect x="6" y="32" width="26" height="7" rx="1.5" fill="#2a2f36" stroke={O} />
      <path d="M10 35.5h18" stroke="#4a525d" stroke-width="2" stroke-dasharray="2 2" />
      <path d="M32 29h7l4 6.5-4 6.5h-7z" fill={TL} stroke={O} stroke-linejoin="round" />
      <path d="M34 35.5h5" stroke="#0e1013" stroke-width="1.6" />
    {:else if building === 'blender'}
      {@render stripes(5, 39, 38, 4)}
      <path d="M10 14h28l-3 25H13z" fill={ST} stroke={O} stroke-linejoin="round" />
      <rect x="8" y="10" width="32" height="5" rx="1.5" fill="#4a525d" stroke={O} />
      <path d="M14 24h20l-1 10H15z" fill={TL} opacity=".55" />
      <path d="M24 4v24" stroke="#c3cad2" stroke-width="2.5" />
      <path d="M18 28c2-4 10-4 12 0-2 4-10 4-12 0z" fill="#c3cad2" stroke={O} stroke-width=".8" />
      <rect x="20" y="2" width="8" height="5" rx="1" fill={OR} stroke={O} />
      <circle cx="17" cy="21" r="1.5" fill="#fff" opacity=".5" />
      <circle cx="31" cy="19" r="1" fill="#fff" opacity=".5" />
    {:else if building === 'nuclearPlant'}
      {@render stripes(3, 39, 42, 4)}
      <path d="M12 39c2-14-1-24 3-33h12c4 9 1 19 3 33z" fill="#8f9aa6" stroke={O} stroke-linejoin="round" />
      <path d="M15 6h12" stroke={O} stroke-width="1.5" />
      <path d="M14 22h14M13 30h16" stroke="#6c7782" stroke-width="1" />
      <ellipse cx="21" cy="6" rx="6" ry="2" fill="#c8f06a" opacity=".85" />
      <path d="M17 4c1-3 7-3 8 0" fill="none" stroke="#c8f06a" stroke-width="1.5" opacity=".7" />
      <path d="M32 39V30a6 6 0 0 1 12 0v9z" fill="#4a525d" stroke={O} />
      <circle cx="38" cy="30" r="2" fill="#7bc043" />
      <path d="M36 26l2-3 2 3" fill="none" stroke={HZ} stroke-width="1.2" />
    {:else if building === 'depot'}
      {@render stripes(5, 39, 38, 4)}
      <rect x="6" y="15" width="36" height="24" rx="1.5" fill={OR} stroke={O} />
      <path d="M12 17v20M18 17v20M24 17v20M30 17v20M36 17v20" stroke="#b85a12" stroke-width="1.5" />
      <rect x="15" y="22" width="18" height="7" rx="1" fill={TL} stroke={O} />
      <path d="M6 15l4-5h28l4 5" fill="#c55f14" stroke={O} />
    {/if}
  </svg>
{:else if def}
  <svg class="fi" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    {#if def.shape === 'ore'}
      <path d="M4 16l3-8 7-3 6 5-1 8-8 2z" fill={c} stroke={O} stroke-width="1.2" stroke-linejoin="round" />
      <path d="M8 9l5-2 1 5-5 1z" fill="#fff" opacity=".22" />
    {:else if def.shape === 'leaf'}
      <path d="M5 19C5 10 11 5 20 4c0 9-5 15-15 15z" fill={c} stroke={O} stroke-width="1.2" />
      <path d="M6 18 16 8" stroke={O} stroke-width="1" opacity=".6" />
    {:else if def.shape === 'drop'}
      <path d="M12 3s-7 8-7 12a7 7 0 0 0 14 0c0-4-7-12-7-12z" fill={c} stroke={O} stroke-width="1.2" />
      <path d="M9 14a3 3 0 0 0 2 4" stroke="#fff" stroke-width="1.2" fill="none" opacity=".5" />
    {:else if def.shape === 'ingot'}
      <path d="M3 17l3-7h12l3 7z" fill={c} stroke={O} stroke-width="1.2" stroke-linejoin="round" />
      <path d="M6 10l2-3h8l2 3z" fill={c} stroke={O} stroke-width="1.2" stroke-linejoin="round" />
      <path d="M8 7h8" stroke="#fff" opacity=".4" />
    {:else if def.shape === 'plate'}
      <rect x="4" y="5" width="16" height="14" rx="1.5" fill={c} stroke={O} stroke-width="1.2" />
      <circle cx="7" cy="8" r="1" fill={O} />
      <circle cx="17" cy="8" r="1" fill={O} />
      <circle cx="7" cy="16" r="1" fill={O} />
      <circle cx="17" cy="16" r="1" fill={O} />
    {:else if def.shape === 'rod'}
      <path d="M5 19 19 5" stroke={O} stroke-width="5" stroke-linecap="round" />
      <path d="M5 19 19 5" stroke={c} stroke-width="3" stroke-linecap="round" />
    {:else if def.shape === 'screw'}
      <rect x="7" y="3" width="10" height="4" rx="1" fill={c} stroke={O} stroke-width="1.2" />
      <path d="M10 7h4v11l-2 3-2-3z" fill={c} stroke={O} stroke-width="1.2" />
      <path d="M10 10l4 1M10 13l4 1M10 16l4 1" stroke={O} stroke-width="1" />
    {:else if def.shape === 'coil'}
      <circle cx="12" cy="12" r="7.5" fill="none" stroke={O} stroke-width="5" />
      <circle cx="12" cy="12" r="7.5" fill="none" stroke={c} stroke-width="3" />
      <circle cx="12" cy="12" r="2.5" fill="#2a2f36" />
    {:else if def.shape === 'cable'}
      <path d="M3 16c4-9 7 5 11-4s5-6 7-6" stroke={O} stroke-width="5" fill="none" stroke-linecap="round" />
      <path d="M3 16c4-9 7 5 11-4s5-6 7-6" stroke={c === '#3d4550' ? '#56606b' : c} stroke-width="3" fill="none" stroke-linecap="round" />
      <path d="M20 6h2" stroke="#e08a4c" stroke-width="3" />
    {:else if def.shape === 'block'}
      <path d="M12 3l8 4v10l-8 4-8-4V7z" fill={c} stroke={O} stroke-width="1.2" stroke-linejoin="round" />
      <path d="M4 7l8 4 8-4M12 11v10" stroke={O} stroke-width="1" fill="none" />
    {:else if def.shape === 'beam'}
      <path d="M4 5h16v3h-6v8h6v3H4v-3h6V8H4z" fill={c} stroke={O} stroke-width="1.2" stroke-linejoin="round" />
    {:else if def.shape === 'pipe'}
      <rect x="4" y="8" width="16" height="8" fill={c} stroke={O} stroke-width="1.2" />
      <ellipse cx="20" cy="12" rx="2" ry="4" fill="#2a2f36" stroke={O} stroke-width="1.2" />
      <path d="M5 10h13" stroke="#fff" opacity=".3" />
    {:else if def.shape === 'frame'}
      <rect x="4" y="4" width="16" height="16" rx="1" fill="none" stroke={O} stroke-width="5" />
      <rect x="4" y="4" width="16" height="16" rx="1" fill="none" stroke={c} stroke-width="3" />
      <path d="M5 5l14 14M19 5 5 19" stroke={c} stroke-width="2" />
    {:else if def.shape === 'rotor'}
      <path d="M12 12 12 3a4 4 0 0 1 4 4zM12 12l8 5a4 4 0 0 1-5 2zM12 12l-8 4a4 4 0 0 1 0-6z" fill={c} stroke={O} stroke-width="1.2" stroke-linejoin="round" />
      <circle cx="12" cy="12" r="2.5" fill="#2a2f36" stroke={O} />
    {:else if def.shape === 'stator'}
      <circle cx="12" cy="12" r="8" fill={c} stroke={O} stroke-width="1.2" />
      <circle cx="12" cy="12" r="4" fill="#2a2f36" />
      <path d="M12 4v3M12 17v3M4 12h3M17 12h3" stroke={O} stroke-width="1.5" />
    {:else if def.shape === 'motor'}
      <rect x="4" y="7" width="13" height="11" rx="2" fill={c} stroke={O} stroke-width="1.2" />
      <path d="M7 7v11M10 7v11M13 7v11" stroke={O} stroke-width="1" opacity=".6" />
      <rect x="17" y="11" width="4" height="3" fill="#c3cad2" stroke={O} />
      <rect x="6" y="18" width="9" height="2" fill="#2a2f36" />
    {:else if def.shape === 'pellet'}
      <circle cx="8" cy="15" r="4" fill={c} stroke={O} stroke-width="1.2" />
      <circle cx="16" cy="15" r="4" fill={c} stroke={O} stroke-width="1.2" />
      <circle cx="12" cy="8" r="4" fill={c} stroke={O} stroke-width="1.2" />
    {:else if def.shape === 'canister'}
      <rect x="6" y="6" width="12" height="15" rx="1.5" fill={c} stroke={O} stroke-width="1.2" />
      <path d="M9 6V3h6v3" fill="none" stroke={O} stroke-width="1.5" />
      <path d="M9 10l6 7M15 10l-6 7" stroke={O} stroke-width="1" opacity=".6" />
    {:else if def.shape === 'crystal'}
      <path d="M12 2l5 6-5 14-5-14z" fill={c} stroke={O} stroke-width="1.2" stroke-linejoin="round" />
      <path d="M7 8h10M12 2v20" stroke="#fff" stroke-width=".8" opacity=".5" />
    {:else if def.shape === 'powder'}
      <path d="M3 19c2-6 5-10 9-10s7 4 9 10z" fill={c} stroke={O} stroke-width="1.2" />
      <circle cx="10" cy="6" r="1" fill={c} />
      <circle cx="15" cy="5" r="1" fill={c} />
    {:else if def.shape === 'chip'}
      <rect x="5" y="5" width="14" height="14" rx="1.5" fill={c} stroke={O} stroke-width="1.2" />
      <path d="M8 2v3M12 2v3M16 2v3M8 19v3M12 19v3M16 19v3M2 8h3M2 12h3M2 16h3M19 8h3M19 12h3M19 16h3" stroke={O} stroke-width="1.2" />
      <rect x="9" y="9" width="6" height="6" fill="#ffd166" />
    {:else if def.shape === 'box'}
      <rect x="3" y="4" width="18" height="13" rx="1.5" fill="#2a2f36" stroke={O} stroke-width="1.2" />
      <rect x="5" y="6" width="14" height="9" fill={c} />
      <path d="M9 17v3h6v-3M7 21h10" stroke={O} stroke-width="1.5" fill="none" />
    {/if}
  </svg>
{/if}

<style>
  .fi {
    display: inline-block;
    vertical-align: middle;
    flex: none;
  }
</style>
