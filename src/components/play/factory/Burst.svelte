<script lang="ts">
  // A short CSS particle burst for Orebelt: bump `trigger` to fire 6–10 sparks from a point inside the parent
  // (which must be position: relative). Draws nothing when motion is reduced.
  import { untrack } from 'svelte';
  import { motionOk, type BurstKind } from './controller.svelte';

  interface Props {
    trigger: number;
    kind?: BurstKind;
    /** Origin in px inside the parent; the parent's centre when left out. */
    x?: number;
    y?: number;
    /** How far the sparks fly, in px. */
    size?: number;
  }
  let { trigger, kind = 'build', x, y, size = 40 }: Props = $props();

  const PALETTE: Record<BurstKind, string[]> = {
    build: ['#f2b632', '#e0701a', '#fff1c2', '#ffb35c'],
    dismantle: ['#8f9aa6', '#5b6470', '#c3cad2', '#e0701a'],
    milestone: ['#14a3b1', '#f2b632', '#8fe7ef', '#ffffff'],
    deliver: ['#e0701a', '#f2b632', '#14a3b1', '#ffffff', '#b15fd6'],
  };
  interface Spark {
    id: number;
    dx: number;
    dy: number;
    c: string;
    d: number;
    r: number;
    sq: boolean;
  }
  let sparks = $state<Spark[]>([]);
  let timer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    if (!trigger) return;
    untrack(() => {
      if (!motionOk()) return;
      const n = 6 + Math.floor(Math.random() * 5);
      const colors = PALETTE[kind];
      sparks = Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
        const dist = size * (0.55 + Math.random() * 0.7);
        return {
          id: trigger * 16 + i,
          dx: Math.cos(a) * dist,
          dy: Math.sin(a) * dist - size * 0.25,
          c: colors[i % colors.length],
          d: 0.45 + Math.random() * 0.35,
          r: 3 + Math.random() * 3,
          sq: i % 3 === 0,
        };
      });
      clearTimeout(timer);
      timer = setTimeout(() => (sparks = []), 900);
    });
    return () => clearTimeout(timer);
  });
</script>

<span class="burst" style:left={x === undefined ? '50%' : `${x}px`} style:top={y === undefined ? '50%' : `${y}px`} aria-hidden="true">
  {#if sparks.length}
    {#key trigger}<b class="ring" style="--s: {size}px; --c: {PALETTE[kind][0]}"></b>{/key}
  {/if}
  {#each sparks as p (p.id)}
    <i class:sq={p.sq} style="--dx: {p.dx.toFixed(1)}px; --dy: {p.dy.toFixed(1)}px; --c: {p.c}; --d: {p.d.toFixed(2)}s; --r: {p.r.toFixed(1)}px"></i>
  {/each}
</span>

<style>
  .burst {
    position: absolute;
    width: 0;
    height: 0;
    pointer-events: none;
    z-index: 6;
  }
  i,
  .ring {
    position: absolute;
    left: 0;
    top: 0;
    border-radius: 50%;
  }
  i {
    width: var(--r);
    height: var(--r);
    margin: calc(var(--r) / -2) 0 0 calc(var(--r) / -2);
    background: var(--c);
    box-shadow: 0 0 6px var(--c);
    animation: ob-spark var(--d) cubic-bezier(0.1, 0.7, 0.3, 1) forwards;
  }
  i.sq {
    border-radius: 1px;
  }
  .ring {
    width: var(--s);
    height: var(--s);
    margin: calc(var(--s) / -2) 0 0 calc(var(--s) / -2);
    border: 2px solid var(--c);
    opacity: 0.8;
    animation: ob-ring 0.5s ease-out forwards;
  }
  @keyframes ob-spark {
    from {
      transform: translate(0, 0) scale(1);
      opacity: 1;
    }
    to {
      transform: translate(var(--dx), var(--dy)) scale(0.2);
      opacity: 0;
    }
  }
  @keyframes ob-ring {
    from {
      transform: scale(0.2);
      opacity: 0.9;
    }
    to {
      transform: scale(1.4);
      opacity: 0;
    }
  }
</style>
