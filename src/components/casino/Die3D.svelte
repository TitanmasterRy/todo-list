<script lang="ts">
  // A CSS 3D die. Bump `rolls` to throw it: it tumbles across and lands showing `value`.
  import { reduced } from './fx';

  interface Props {
    value: number;
    rolls: number;
    size?: number;
    color?: 'ivory' | 'red';
    /** thrown in from this many px to the right */
    from?: number;
    delay?: number;
  }
  let { value, rolls, size = 64, color = 'ivory', from = 160, delay = 0 }: Props = $props();
  // (from and delay shape the throw)

  // cube rotation that brings each face to the front
  const FACE: Record<number, [number, number]> = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };
  const PIPS: Record<number, number[]> = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const SIDES: [number, string][] = [
    [1, 'translateZ(var(--h))'],
    [6, 'rotateY(180deg) translateZ(var(--h))'],
    [3, 'rotateY(90deg) translateZ(var(--h))'],
    [4, 'rotateY(-90deg) translateZ(var(--h))'],
    [2, 'rotateX(90deg) translateZ(var(--h))'],
    [5, 'rotateX(-90deg) translateZ(var(--h))'],
  ];
  let el = $state<HTMLElement>();
  // the throw: in from the side, a bounce, and settle
  $effect(() => {
    if (!rolls || !el || reduced() || typeof el.animate !== 'function') return;
    const s = size;
    el.animate(
      [
        { transform: `translate(${from}px, ${-s * 1.4}px)` },
        { transform: `translate(${from * 0.35}px, 0)`, offset: 0.45 },
        { transform: `translate(${from * 0.15}px, ${-s * 0.35}px)`, offset: 0.62 },
        { transform: 'translate(0, 0)', offset: 0.8 },
        { transform: `translate(-2px, ${-s * 0.06}px)`, offset: 0.9 },
        { transform: 'translate(0, 0)' },
      ],
      { duration: 900, delay, easing: 'cubic-bezier(0.25, 0.7, 0.35, 1)', fill: 'backwards' },
    );
  });
  const jitter = $derived(((rolls * 37) % 11) - 5);
  const rot = $derived.by(() => {
    const [x, y] = FACE[value] ?? FACE[1];
    const turns = reduced() ? 0 : rolls;
    return `rotateZ(${jitter}deg) rotateX(${x + turns * 720}deg) rotateY(${y + turns * 360}deg)`;
  });
</script>

<span class="toss" bind:this={el} style="--s:{size}px;--delay:{delay}ms" aria-hidden="true">
  <span class="shadow"></span>
  <span class="cube {color}" style="transform:{rot}">
    {#each SIDES as [n, t] (n)}
      <span class="side" style="transform:{t}">
        {#each Array.from({ length: 9 }, (_, i) => i) as i (i)}<i class:on={PIPS[n].includes(i)}></i>{/each}
      </span>
    {/each}
  </span>
</span>

<style>
  .toss {
    --h: calc(var(--s) / 2);
    position: relative;
    display: inline-block;
    width: var(--s);
    height: var(--s);
    perspective: 600px;
  }
  .shadow {
    position: absolute;
    left: 8%;
    right: 8%;
    bottom: -12%;
    height: 22%;
    border-radius: 50%;
    background: radial-gradient(ellipse, rgba(0, 0, 0, 0.5), transparent 70%);
  }
  .cube {
    position: absolute;
    inset: 0;
    transform-style: preserve-3d;
    transition: transform 900ms cubic-bezier(0.2, 0.75, 0.3, 1) var(--delay);
  }
  .side {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
    padding: 14%;
    gap: 4%;
    border-radius: 18%;
    background: radial-gradient(circle at 30% 25%, #ffffff, #f3eee2 55%, #d8d0bf);
    box-shadow:
      inset 0 0 0 1px rgba(0, 0, 0, 0.12),
      inset 0 -4px 8px rgba(0, 0, 0, 0.12);
    backface-visibility: hidden;
  }
  .red .side {
    background: radial-gradient(circle at 30% 25%, #ff6b7f, #d6123a 55%, #8a0a22);
    box-shadow:
      inset 0 0 0 1px rgba(0, 0, 0, 0.2),
      inset 0 -4px 8px rgba(0, 0, 0, 0.25);
  }
  i {
    border-radius: 50%;
    align-self: center;
    justify-self: center;
    width: 82%;
    height: 82%;
  }
  i.on {
    background: radial-gradient(circle at 40% 35%, #444, #111);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6);
  }
  .red i.on {
    background: radial-gradient(circle at 40% 35%, #fff, #e8e2d4);
  }
</style>
