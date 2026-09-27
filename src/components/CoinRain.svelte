<script lang="ts">
  // Coin rain for big payouts (a casino win of 10× or more, a level-up). Loaded the first time it's needed.
  // Decorative only: nothing when reduced motion is on (app setting or the OS) or confetti is switched off.
  import { store } from '../lib/store.svelte';

  interface Props {
    tick: number; // bump to start a new shower
  }
  let { tick }: Props = $props();

  interface Coin {
    id: number;
    x: number; // vw
    delay: number; // ms
    dur: number; // ms
    size: number; // px
    spin: number; // turns
    e: string;
  }
  let coins = $state<Coin[]>([]);
  let nextId = 1;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function allowed(): boolean {
    if (store.settings.celebrations === false || store.settings.reducedMotion) return false;
    return !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function shower() {
    if (!allowed()) return;
    const wave: Coin[] = Array.from({ length: 36 }, (_, i) => ({
      id: nextId++,
      x: Math.random() * 96 + 2,
      delay: Math.random() * 700,
      dur: 1300 + Math.random() * 900,
      size: 20 + Math.random() * 16,
      spin: 1 + Math.random() * 2,
      e: i % 9 === 0 ? '💰' : i % 7 === 0 ? '✨' : '🪙',
    }));
    coins = [...coins, ...wave].slice(-90);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => (coins = []), 2800);
  }

  let last = 0;
  $effect(() => {
    if (tick !== last) {
      last = tick;
      if (tick > 0) shower();
    }
    return () => timer && clearTimeout(timer);
  });
</script>

{#if coins.length}
  <div class="rain" aria-hidden="true" data-coin-rain>
    {#each coins as c (c.id)}
      <span class="coin" style="left:{c.x}vw;font-size:{c.size}px;animation-delay:{c.delay}ms;animation-duration:{c.dur}ms;--spin:{c.spin}turn">{c.e}</span>
    {/each}
  </div>
{/if}

<style>
  .rain {
    position: fixed;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 510;
  }
  .coin {
    position: absolute;
    top: -48px;
    animation-name: fall;
    animation-timing-function: cubic-bezier(0.35, 0.05, 0.6, 1);
    animation-fill-mode: both;
    will-change: transform, opacity;
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.25));
  }
  @keyframes fall {
    0% {
      transform: translateY(0) rotateY(0);
      opacity: 0;
    }
    10% {
      opacity: 1;
    }
    85% {
      opacity: 1;
    }
    100% {
      transform: translateY(calc(100vh + 60px)) rotateY(var(--spin));
      opacity: 0;
    }
  }
  :global(:root.reduced-motion) .rain {
    display: none;
  }
</style>
