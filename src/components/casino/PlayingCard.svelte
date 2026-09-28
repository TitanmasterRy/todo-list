<script lang="ts" module>
  import type { Suit } from '../../lib/casino/cards';

  const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  /** Suit shapes in a 100×100 box. */
  export const SUIT_PATH: Record<Suit, string> = {
    '♥': 'M50 90C22 68 4 50 10 30C15 12 40 8 50 28C60 8 85 12 90 30C96 50 78 68 50 90Z',
    '♦': 'M50 4C60 22 74 38 90 50C74 62 60 78 50 96C40 78 26 62 10 50C26 38 40 22 50 4Z',
    '♠': 'M50 6C62 28 94 40 90 64C87 80 66 84 55 72C57 84 62 92 70 96L30 96C38 92 43 84 45 72C34 84 13 80 10 64C6 40 38 28 50 6Z',
    '♣': `${circle(50, 30, 19)}${circle(29, 58, 19)}${circle(71, 58, 19)}${circle(50, 52, 10)}M45 55C45 78 40 88 30 96L70 96C60 88 55 78 55 55Z`,
  };
  // pip positions on a 100×140 face; f = upside down (bottom half)
  const C1 = 32;
  const C3 = 68;
  export const PIPS: Record<number, [number, number, boolean?][]> = {
    2: [
      [50, 26],
      [50, 114, true],
    ],
    3: [
      [50, 26],
      [50, 70],
      [50, 114, true],
    ],
    4: [
      [C1, 26],
      [C3, 26],
      [C1, 114, true],
      [C3, 114, true],
    ],
    5: [
      [C1, 26],
      [C3, 26],
      [50, 70],
      [C1, 114, true],
      [C3, 114, true],
    ],
    6: [
      [C1, 26],
      [C3, 26],
      [C1, 70],
      [C3, 70],
      [C1, 114, true],
      [C3, 114, true],
    ],
    7: [
      [C1, 26],
      [C3, 26],
      [50, 48],
      [C1, 70],
      [C3, 70],
      [C1, 114, true],
      [C3, 114, true],
    ],
    8: [
      [C1, 26],
      [C3, 26],
      [50, 48],
      [C1, 70],
      [C3, 70],
      [50, 92, true],
      [C1, 114, true],
      [C3, 114, true],
    ],
    9: [
      [C1, 26],
      [C3, 26],
      [C1, 55],
      [C3, 55],
      [50, 70],
      [C1, 85, true],
      [C3, 85, true],
      [C1, 114, true],
      [C3, 114, true],
    ],
    10: [
      [C1, 26],
      [C3, 26],
      [50, 41],
      [C1, 55],
      [C3, 55],
      [C1, 85, true],
      [C3, 85, true],
      [50, 99, true],
      [C1, 114, true],
      [C3, 114, true],
    ],
  };
  export function pipTransform(x: number, y: number, s: number, flip = false): string {
    return `${flip ? `rotate(180 ${x} ${y}) ` : ''}translate(${x - s / 2} ${y - s / 2}) scale(${s / 100})`;
  }
</script>

<script lang="ts">
  // A playing card: crisp SVG faces (pips, simple geometric court cards), a patterned back (or the card-back art),
  // dealt flying in from the shoe and turned over with a 3D flip. The label always tells the truth: a face-down
  // card is "Face-down card" even while it is still turning.
  import { onMount, untrack } from 'svelte';
  import type { PlayingCard } from '../../lib/casino/cards';
  import { isRed, rankLabel } from '../../lib/casino/cards';
  import ArtImg from '../ArtImg.svelte';
  import { reduced } from './fx';
  import { sfx } from './sfx';

  interface Props {
    card?: PlayingCard;
    hidden?: boolean;
    held?: boolean;
    small?: boolean;
    /** ms before this card is dealt (to stagger a hand) */
    delay?: number;
    /** fly in from the shoe when it first appears */
    deal?: boolean;
    win?: boolean;
    /** ms before a face-down card turns over later on (to stagger a reveal) */
    flipDelay?: number;
  }
  let { card, hidden = false, held = false, small = false, delay = 0, deal = true, win = false, flipDelay = 40 }: Props = $props();

  const down = $derived(hidden || !card);
  const tilt = (Math.random() - 0.5) * 3.2;
  const animate = !reduced();
  let faceUp = $state(false);
  let first = true;

  $effect(() => {
    const d = down;
    const firstRun = first;
    first = false;
    if (d) {
      faceUp = false;
      return;
    }
    if (untrack(() => faceUp)) return;
    const ms = untrack(() => (!animate ? 0 : firstRun && deal ? delay + 340 : flipDelay));
    if (!ms) {
      faceUp = true;
      return;
    }
    const t = setTimeout(() => {
      faceUp = true;
      sfx('flip');
    }, ms);
    return () => clearTimeout(t);
  });
  onMount(() => {
    if (!animate || !deal) return;
    const t = setTimeout(() => sfx('deal'), delay);
    return () => clearTimeout(t);
  });

  const red = $derived(!!card && isRed(card));
  const ink = $derived(red ? '#cf1530' : '#17171d');
  const robe = $derived(red ? '#c3122e' : '#1f3f8f');
  const trim = $derived(red ? '#1f3f8f' : '#c3122e');
</script>

<div
  class="pc"
  class:small
  class:held
  class:win
  class:dealt={deal && animate}
  style="--d:{delay}ms;--tilt:{tilt}deg"
  role="img"
  aria-label={down ? 'Face-down card' : `${rankLabel(card!.rank)} of ${card!.suit}`}
>
  <div class="inner" class:up={faceUp && !down}>
    <div class="face front" aria-hidden="true">
      {#if card}{@render face(card)}{/if}
    </div>
    <div class="face back" aria-hidden="true">
      <ArtImg name="casino/card-back.webp" class="backimg">
        {#snippet fallback()}
          <svg viewBox="0 0 100 140" class="backsvg">
            <rect x="7" y="7" width="86" height="126" rx="6" fill="none" stroke="#e7c36a" stroke-width="1.6" />
            <rect x="11" y="11" width="78" height="118" rx="4" fill="none" stroke="#e7c36a" stroke-width=".7" opacity=".7" />
            <g transform="translate(50 70)">
              <circle r="21" fill="#7d0f22" stroke="#e7c36a" stroke-width="1.6" />
              <path d="M0 -15 L4 -4 L15 0 L4 4 L0 15 L-4 4 L-15 0 L-4 -4 Z" fill="#f3d27c" />
              <circle r="3.2" fill="#7d0f22" stroke="#f3d27c" stroke-width="1" />
            </g>
          </svg>
        {/snippet}
      </ArtImg>
    </div>
  </div>
  {#if held}<span class="h" aria-hidden="true">HELD</span>{/if}
</div>

{#snippet pip(x: number, y: number, s: number, flip: boolean, suit: Suit)}
  <path d={SUIT_PATH[suit]} transform={pipTransform(x, y, s, flip)} />
{/snippet}

{#snippet court(c: PlayingCard)}
  <g>
    <!-- one half of a two-headed court figure; drawn again upside down -->
    {#if c.rank === 12}<path d="M37 49 Q36 32 50 30 Q64 32 63 49 L60 60 L40 60 Z" fill="#6b3a1e" />{/if}
    <path d="M28 70 L32 57 Q50 49 68 57 L72 70 Z" fill={robe} />
    <path d="M36 58 Q50 66 64 58" stroke="#e7b84a" stroke-width="3" fill="none" />
    <path d="M44 57 L50 70 L56 57" fill={trim} opacity=".9" />
    <circle cx="50" cy="43" r="9.5" fill="#f5d4ae" />
    <circle cx="46.5" cy="42" r="1.1" fill="#2a1a10" />
    <circle cx="53.5" cy="42" r="1.1" fill="#2a1a10" />
    <path d="M47 46.5 q3 2 6 0" stroke="#a0522d" stroke-width="1" fill="none" stroke-linecap="round" />
    {#if c.rank === 13}
      <path d="M41 50 Q50 60 59 50 Q56 55 50 55.5 Q44 55 41 50 Z" fill="#8a5a2b" />
      <path d="M39 35 L40 24 L45 30 L50 21 L55 30 L60 24 L61 35 Z" fill="#e7b84a" stroke="#9a6b12" stroke-width=".8" />
      <circle cx="50" cy="28" r="1.6" fill={trim} />
    {:else if c.rank === 12}
      <path d="M40 35 Q50 27 60 35 L58 31 L54 33 L50 27 L46 33 L42 31 Z" fill="#e7b84a" stroke="#9a6b12" stroke-width=".8" />
      <circle cx="50" cy="31" r="1.4" fill={trim} />
    {:else}
      <path d="M39 38 Q41 28 50 28 Q59 28 61 38 Z" fill={trim} />
      <path d="M59 31 Q66 24 68 17" stroke="#e7b84a" stroke-width="2" fill="none" stroke-linecap="round" />
    {/if}
    <g fill={ink} transform={pipTransform(50, 64, 9)}><path d={SUIT_PATH[c.suit]} /></g>
  </g>
{/snippet}

{#snippet face(c: PlayingCard)}
  <svg viewBox="0 0 100 140">
    <g fill={ink}>
      <text x="12" y="23" text-anchor="middle" class="rk" font-size={c.rank === 10 ? 17 : 20}>{rankLabel(c.rank)}</text>
      {@render pip(12, 33, 11, false, c.suit)}
      <g transform="rotate(180 50 70)">
        <text x="12" y="23" text-anchor="middle" class="rk" font-size={c.rank === 10 ? 17 : 20}>{rankLabel(c.rank)}</text>
        {@render pip(12, 33, 11, false, c.suit)}
      </g>
      {#if c.rank === 14}
        {#if c.suit === '♠'}<circle cx="50" cy="70" r="27" fill="none" stroke={ink} stroke-width="1" opacity=".35" />{/if}
        {@render pip(50, 70, c.suit === '♠' ? 40 : 34, false, c.suit)}
      {:else if c.rank <= 10}
        {#each PIPS[c.rank] as [x, y, f], i (i)}{@render pip(x, y, 19, !!f, c.suit)}{/each}
      {/if}
    </g>
    {#if c.rank >= 11 && c.rank <= 13}
      <rect x="22" y="16" width="56" height="108" rx="4" fill="#fff6e4" stroke={ink} stroke-width="1.2" />
      <svg x="22" y="16" width="56" height="108" viewBox="22 16 56 108">
        {@render court(c)}
        <g transform="rotate(180 50 70)">{@render court(c)}</g>
      </svg>
      <line x1="22" y1="70" x2="78" y2="70" stroke="#e7b84a" stroke-width="1.2" />
      <rect x="24.5" y="18.5" width="51" height="103" rx="3" fill="none" stroke="#e7b84a" stroke-width="1" />
    {/if}
  </svg>
{/snippet}

<style>
  .pc {
    --w: var(--cw, clamp(50px, 15vw, 66px));
    width: var(--w);
    height: calc(var(--w) * 1.4);
    position: relative;
    flex: none;
    perspective: 700px;
    transform: rotate(var(--tilt));
    user-select: none;
    transition: transform 220ms var(--spring);
  }
  .pc.small {
    --w: var(--cw-small, 44px);
  }
  .pc.dealt {
    animation: deal 420ms cubic-bezier(0.2, 0.8, 0.25, 1) var(--d) backwards;
  }
  @keyframes deal {
    from {
      transform: translate(var(--from-x, 180px), var(--from-y, -150px)) rotate(-28deg) scale(0.85);
      opacity: 0;
    }
    30% {
      opacity: 1;
    }
  }
  .inner {
    position: absolute;
    inset: 0;
    transform-style: preserve-3d;
    transform: rotateY(180deg);
    transition: transform 420ms cubic-bezier(0.3, 1.25, 0.5, 1);
  }
  .inner.up {
    transform: rotateY(0deg);
  }
  .face {
    position: absolute;
    inset: 0;
    border-radius: calc(var(--w) * 0.1);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    overflow: hidden;
    box-shadow:
      0 1px 1px rgba(0, 0, 0, 0.25),
      0 4px 10px rgba(0, 0, 0, 0.35);
  }
  .front {
    background: linear-gradient(160deg, #ffffff 0%, #fbf8f1 60%, #f1ece0 100%);
    border: 1px solid rgba(0, 0, 0, 0.18);
  }
  .front :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
  .front :global(.rk) {
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
  }
  .back {
    transform: rotateY(180deg);
    background:
      repeating-linear-gradient(45deg, rgba(255, 220, 140, 0.16) 0 1.5px, transparent 1.5px 7px),
      repeating-linear-gradient(-45deg, rgba(255, 220, 140, 0.16) 0 1.5px, transparent 1.5px 7px), radial-gradient(circle at 50% 40%, #b01e37, #6d0d1e);
    border: calc(var(--w) * 0.05) solid #fbf7ee;
  }
  .back :global(.backsvg),
  .back :global(.backimg) {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }
  .held {
    transform: translateY(-10px) rotate(0deg);
  }
  .held .face {
    box-shadow:
      0 0 0 3px #ffd76a,
      0 0 18px 4px rgba(255, 210, 90, 0.7),
      0 10px 16px rgba(0, 0, 0, 0.4);
  }
  .win .face {
    box-shadow:
      0 0 0 2px #ffd76a,
      0 0 16px 3px rgba(255, 210, 90, 0.75);
  }
  .pc.win {
    animation: glow 1.2s ease-in-out 2;
  }
  @keyframes glow {
    50% {
      transform: translateY(-6px) rotate(var(--tilt));
    }
  }
  .h {
    position: absolute;
    bottom: -20px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 11px;
    font-weight: 900;
    color: #1a1200;
    background: linear-gradient(180deg, #ffe58a, #e8b420);
    padding: 1px 8px;
    border-radius: 4px;
    letter-spacing: 0.1em;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }
</style>
