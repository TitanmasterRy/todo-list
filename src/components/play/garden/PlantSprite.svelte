<svelte:options namespace="svg" />

<script lang="ts">
  // One garden plant, drawn at the soil line (0,0), growing upward. Buds get a sleepy face, full-grown flowers a
  // proper one that blinks and dances when they're happy. The petals take the course color (`--c`).
  import { GROWN, type PotPlant } from '../../../lib/garden';

  let { plant, dance = false }: { plant: PotPlant; dance?: boolean } = $props();
  const STEM = [14, 28, 42, 56];
  const h = $derived(STEM[plant.stage]);
  const hy = $derived(-(h + 8)); // flower head center
  const ring = (n: number, r: number, off = 0) =>
    Array.from({ length: n }, (_, i) => ({
      a: (i / n) * 360 + off,
      x: Math.cos(((i / n) * 360 + off) * (Math.PI / 180)) * r,
      y: Math.sin(((i / n) * 360 + off) * (Math.PI / 180)) * r,
    }));
  const petalTint = $derived(plant.kind === 'sunflower' ? '#f7c948' : plant.color);
</script>

{#key plant.stage}
  <g class="plant" class:dance data-stage={plant.stage} data-kind={plant.kind} style="--c:{petalTint}">
    <g class="sway" style="--d:{(plant.tended % 5) * 0.6}s">
      <!-- stem and leaves -->
      <path d="M0 0 q -3 {-h / 2} 0 {-h}" class="stem" />
      {#if plant.stage === 0}
        <ellipse cx="-7" cy={-h + 2} rx="7" ry="4" transform="rotate(-25 -7 {-h + 2})" class="leaf" />
        <ellipse cx="7" cy={-h + 2} rx="7" ry="4" transform="rotate(25 7 {-h + 2})" class="leaf light" />
      {:else}
        <ellipse cx="-9" cy={-h * 0.4} rx={7 + plant.stage} ry={4 + plant.stage * 0.6} transform="rotate(-30 -9 {-h * 0.4})" class="leaf" />
        <ellipse cx="9" cy={-h * 0.6} rx={7 + plant.stage} ry={4 + plant.stage * 0.6} transform="rotate(30 9 {-h * 0.6})" class="leaf light" />
        {#if plant.stage >= 2}
          <ellipse cx="-8" cy={-h * 0.75} rx="7" ry="3.6" transform="rotate(-35 -8 {-h * 0.75})" class="leaf light" />
          <ellipse cx="8" cy={-h * 0.25} rx="7" ry="3.6" transform="rotate(35 8 {-h * 0.25})" class="leaf" />
        {/if}
      {/if}

      {#if plant.stage === 1}
        <ellipse cx="0" cy={-h - 4} rx="5" ry="7" class="petal dark" />
        <path d="M-3 {-h - 8} q 3 -3 6 0" class="petal light" />
      {:else if plant.stage === 2}
        <!-- a bud, dozing until it opens -->
        <ellipse cx="0" cy={-h - 6} rx="8" ry="11" class="petal dark" />
        <path d="M-5 {-h - 14} q 5 -6 10 0 q -5 3 -10 0" class="petal light" />
        <g class="face">
          <path d="M-6 {-h - 5} q 3 2.5 6 0 M0 {-h - 5} q 3 2.5 6 0" class="lid" />
          <path d="M-2 {-h} q 2 1.5 4 0" class="mouth" />
        </g>
      {:else if plant.stage === GROWN}
        {#if plant.kind === 'daisy'}
          {#each ring(8, 11) as p (p.a)}<ellipse cx={p.x} cy={hy + p.y} rx="5" ry="8.5" transform="rotate({p.a + 90} {p.x} {hy + p.y})" class="petal light" />{/each}
          <circle cx="0" cy={hy} r="8" class="center" />
        {:else if plant.kind === 'sunflower'}
          {#each ring(14, 13) as p (p.a)}<ellipse cx={p.x} cy={hy + p.y} rx="4" ry="9" transform="rotate({p.a + 90} {p.x} {hy + p.y})" class="petal" />{/each}
          <circle cx="0" cy={hy} r="10" fill="#6b4226" stroke="#4a2d18" stroke-width="1" />
          <circle cx="0" cy={hy} r="6" fill="#8a5a33" opacity="0.6" />
        {:else if plant.kind === 'tulip'}
          <path d="M-13 {hy - 8} q 0 22 13 22 q 13 0 13 -22 l -6 6 l -7 -12 l -7 12 z" class="petal" />
          <path d="M-6 {hy - 8} q -2 14 6 14 q 8 0 6 -14 z" class="petal light" opacity="0.6" />
        {:else if plant.kind === 'rose'}
          {#each ring(6, 8) as p (p.a)}<ellipse cx={p.x} cy={hy + p.y} rx="7" ry="9" transform="rotate({p.a} {p.x} {hy + p.y})" class="petal dark" />{/each}
          {#each ring(5, 5, 20) as p (p.a)}<ellipse cx={p.x} cy={hy + p.y} rx="6" ry="7" transform="rotate({p.a} {p.x} {hy + p.y})" class="petal" />{/each}
          <circle cx="0" cy={hy} r="6.5" class="petal light" />
        {:else if plant.kind === 'bluebell'}
          <path d="M0 {hy - 12} q -12 2 -14 10" class="stem thin" />
          <path d="M0 {hy - 12} q 12 2 14 10" class="stem thin" />
          {#each [-14, 0, 14] as dx (dx)}
            {@const by = hy + (dx ? 0 : 3)}
            <path d="M{dx - 6} {by - 6} q 6 -12 12 0 q 0 8 -3 10 l -3 -3 l -3 3 q -3 -2 -3 -10 z" class="petal {dx ? 'dark' : ''}" />
          {/each}
        {:else}
          <!-- lily: six pointed petals -->
          {#each ring(6, 4, -90) as p (p.a)}
            <path d="M0 0 q 7 -6 4 -18 q -4 -4 -8 0 q -3 12 4 18 z" transform="translate({p.x} {hy + p.y}) rotate({p.a + 90})" class="petal light tipped" />
          {/each}
          <circle cx="0" cy={hy} r="6" class="center" />
        {/if}
        <!-- the face -->
        <g class="face" transform="translate(0 {hy + (plant.kind === 'bluebell' ? 4 : 0)})">
          <g class="eyes">
            <circle cx="-4.2" cy="-1.5" r="3.2" fill="#fff" /><circle cx="4.2" cy="-1.5" r="3.2" fill="#fff" />
            <circle cx="-3.6" cy="-1.2" r="1.8" fill="#2b2b2b" /><circle cx="4.8" cy="-1.2" r="1.8" fill="#2b2b2b" />
            <circle cx="-3" cy="-1.9" r="0.7" fill="#fff" /><circle cx="5.4" cy="-1.9" r="0.7" fill="#fff" />
          </g>
          <path d="M-3.5 2.8 q 3.5 4 7 0" class="mouth" />
          <ellipse cx="-7" cy="2.5" rx="2" ry="1.2" fill="#ff8fb8" opacity="0.7" /><ellipse cx="7" cy="2.5" rx="2" ry="1.2" fill="#ff8fb8" opacity="0.7" />
        </g>
      {/if}
      {#if plant.shiny}
        <g class="shine" aria-hidden="true">
          <path d="M-16 {hy + 4} l 1.5 -4 l 1.5 4 l 4 1.5 l -4 1.5 l -1.5 4 l -1.5 -4 l -4 -1.5 z" fill="#ffe08a" />
          <path d="M14 {hy - 10} l 1.2 -3 l 1.2 3 l 3 1.2 l -3 1.2 l -1.2 3 l -1.2 -3 l -3 -1.2 z" fill="#fff6c4" style="animation-delay: 0.7s" />
          <path d="M10 {-h / 3} l 1 -2.6 l 1 2.6 l 2.6 1 l -2.6 1 l -1 2.6 l -1 -2.6 l -2.6 -1 z" fill="#ffe08a" style="animation-delay: 1.3s" />
        </g>
      {/if}
    </g>
  </g>
{/key}

<style>
  .plant {
    transform-box: fill-box;
    transform-origin: bottom center;
    animation: grow 520ms var(--spring);
  }
  .sway {
    transform-box: fill-box;
    transform-origin: bottom center;
    animation: sway 4.4s ease-in-out infinite;
    animation-delay: var(--d, 0s);
  }
  .dance .sway {
    animation: dance 0.45s ease-in-out 2;
  }
  .stem {
    stroke: #3f8f3a;
    stroke-width: 3.6;
    fill: none;
    stroke-linecap: round;
  }
  .stem.thin {
    stroke-width: 2;
  }
  .leaf {
    fill: #4cae4c;
    stroke: #2f7a2c;
    stroke-width: 0.8;
  }
  .leaf.light {
    fill: #6cc96a;
  }
  .petal {
    fill: var(--c);
    stroke: rgba(0, 0, 0, 0.22);
    stroke-width: 0.8;
  }
  .petal.light {
    fill: color-mix(in srgb, var(--c) 62%, white);
  }
  .petal.dark {
    fill: color-mix(in srgb, var(--c) 72%, black);
  }
  .petal.tipped {
    stroke: color-mix(in srgb, var(--c) 60%, black);
    stroke-width: 1.2;
  }
  .center {
    fill: #ffd54a;
    stroke: #d19a1a;
    stroke-width: 1;
  }
  .mouth,
  .lid {
    fill: none;
    stroke: #2b2b2b;
    stroke-width: 1.4;
    stroke-linecap: round;
  }
  .eyes {
    transform-box: fill-box;
    transform-origin: center;
    animation: blink 4.6s ease-in-out infinite;
  }
  .shine path {
    transform-box: fill-box;
    transform-origin: center;
    animation: twinkle 1.8s ease-in-out infinite;
  }
  @keyframes grow {
    from {
      transform: scale(0.5);
      opacity: 0.3;
    }
  }
  @keyframes sway {
    0%,
    100% {
      transform: rotate(-2.5deg);
    }
    50% {
      transform: rotate(2.5deg) translateY(-1px);
    }
  }
  @keyframes dance {
    0%,
    100% {
      transform: rotate(0) scale(1);
    }
    25% {
      transform: rotate(-12deg) scale(1.08, 0.94) translateY(-2px);
    }
    75% {
      transform: rotate(12deg) scale(1.08, 0.94) translateY(-2px);
    }
  }
  @keyframes blink {
    0%,
    94%,
    100% {
      transform: scaleY(1);
    }
    97% {
      transform: scaleY(0.08);
    }
  }
  @keyframes twinkle {
    0%,
    100% {
      transform: scale(0.6) rotate(0);
      opacity: 0.5;
    }
    50% {
      transform: scale(1.15) rotate(45deg);
      opacity: 1;
    }
  }
</style>
