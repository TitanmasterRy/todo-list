<script lang="ts">
  // Completion checkbox: spring fill + particle burst. Fires onchange immediately so it never blocks input.
  import { store } from '../lib/store.svelte';
  import { playSound } from '../lib/sounds';

  interface Props {
    checked: boolean;
    color?: string;
    onchange: (checked: boolean) => void;
    label?: string;
    size?: number;
  }
  let { checked, color, onchange, label = 'Complete task', size = 22 }: Props = $props();

  let burst = $state(0);
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const particles = Array.from({ length: 10 }, (_, i) => ({ angle: (i / 10) * 360, dist: 18 + (i % 3) * 6, hue: (i * 36) % 360 }));

  function click(e: MouseEvent) {
    e.stopPropagation();
    const next = !checked;
    if (next) {
      burst++;
      playSound('pop');
    }
    onchange(next);
  }
</script>

<button
  class="cb"
  class:checked
  style="--c:{color ?? 'var(--accent)'}; --size:{size}px"
  role="checkbox"
  aria-checked={checked}
  aria-label={label}
  onclick={click}
  onkeydown={(e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      click(e as unknown as MouseEvent);
    }
  }}
>
  <span class="box">
    <svg viewBox="0 0 24 24" class="tick" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </span>
  {#if burst && !store.settings.reducedMotion && !prefersReduced}
    {#key burst}
      <span class="particles" aria-hidden="true">
        {#each particles as p}
          <i style="--a:{p.angle}deg; --d:{p.dist}px; --h:{p.hue}"></i>
        {/each}
      </span>
    {/key}
  {/if}
</button>

<style>
  .cb {
    position: relative;
    width: calc(var(--size) + 10px);
    height: calc(var(--size) + 10px);
    display: grid;
    place-items: center;
    flex-shrink: 0;
    border-radius: 50%;
  }
  .box {
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
    border: 2px solid color-mix(in srgb, var(--c) 60%, var(--border-strong));
    display: grid;
    place-items: center;
    background: transparent;
    transition:
      background 160ms var(--ease),
      border-color 160ms var(--ease),
      transform 320ms var(--spring);
    color: #fff;
  }
  .cb:hover .box {
    border-color: var(--c);
    background: color-mix(in srgb, var(--c) 15%, transparent);
  }
  .cb:active .box {
    transform: scale(0.85);
  }
  .checked .box {
    background: var(--c);
    border-color: var(--c);
    animation: spring-pop 420ms var(--spring);
  }
  .tick {
    width: 70%;
    height: 70%;
    stroke-dasharray: 24;
    stroke-dashoffset: 24;
    opacity: 0;
  }
  .checked .tick {
    animation: draw 260ms 60ms var(--ease) forwards;
  }
  @keyframes spring-pop {
    0% {
      transform: scale(0.8);
    }
    55% {
      transform: scale(1.22);
    }
    100% {
      transform: scale(1);
    }
  }
  @keyframes draw {
    to {
      stroke-dashoffset: 0;
      opacity: 1;
    }
  }
  .particles {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .particles i {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 6px;
    height: 6px;
    margin: -3px;
    border-radius: 50%;
    background: hsl(var(--h) 90% 65%);
    animation: fly 520ms var(--ease) forwards;
    transform: rotate(var(--a)) translateX(0) scale(1);
  }
  @keyframes fly {
    0% {
      transform: rotate(var(--a)) translateX(4px) scale(1);
      opacity: 1;
    }
    100% {
      transform: rotate(var(--a)) translateX(var(--d)) scale(0.2);
      opacity: 0;
    }
  }
</style>
