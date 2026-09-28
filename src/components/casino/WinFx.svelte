<script lang="ts" module>
  export type WinTier = 'win' | 'big' | 'mega' | 'epic';
  /** Win size by multiple of the stake: big from 10×, mega from 25×, epic from 100×. */
  export function winTier(won: number, bet: number): WinTier {
    const m = bet > 0 ? won / bet : 0;
    return m >= 100 ? 'epic' : m >= 25 ? 'mega' : m >= 10 ? 'big' : 'win';
  }
</script>

<script lang="ts">
  // Win feedback over a table: the payout counting up, a burst of gold, and for big wins a banner, a flash and a
  // shake. Decorative (the result text next to it is what screen readers get); gentle and quick on a loss.
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import ArtImg from '../ArtImg.svelte';
  import { dur, reduced, shake } from './fx';
  import { sfx } from './sfx';

  interface Burst {
    id: number;
    tier: WinTier;
    parts: { a: number; d: number; s: number; delay: number; kind: number }[];
  }
  let shown = $state<Burst | null>(null);
  let root = $state<HTMLElement>();
  const count = new Tween(0, { easing: cubicOut });
  let id = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const LABEL: Record<WinTier, string> = { win: 'Win', big: 'Big win', mega: 'Mega win', epic: 'Jackpot' };

  /** Celebrate a round's result: `won` is the total returned (0 on a loss), `bet` the stake. */
  export function show(won: number, bet: number): void {
    if (timer) clearTimeout(timer);
    if (won <= bet) {
      shown = null;
      if (won === 0) sfx('lose');
      return;
    }
    const tier = winTier(won, bet);
    const big = tier !== 'win';
    sfx(big ? 'bigwin' : 'win');
    const n = reduced() ? 0 : big ? 42 : 18;
    shown = {
      id: ++id,
      tier,
      parts: Array.from({ length: n }, () => ({
        a: Math.random() * 360,
        d: (big ? 110 : 70) + Math.random() * (big ? 150 : 70),
        s: 6 + Math.random() * (big ? 10 : 6),
        delay: Math.random() * (big ? 260 : 120),
        kind: Math.floor(Math.random() * 3),
      })),
    };
    count.set(0, { duration: 0 });
    void count.set(won - bet, { duration: dur(big ? 1500 : 700) });
    if (big) shake(root?.parentElement, tier === 'big' ? 4 : 7);
    timer = setTimeout(() => (shown = null), big ? 2800 : 1500);
  }
  export function clear(): void {
    if (timer) clearTimeout(timer);
    shown = null;
  }
</script>

<div class="winfx" bind:this={root} aria-hidden="true">
  {#if shown}
    {#key shown.id}
      <div class="wrap {shown.tier}">
        {#if shown.tier !== 'win'}
          <div class="flash"></div>
          <div class="rays"></div>
        {/if}
        <div class="burst">
          {#each shown.parts as p, i (i)}
            <span class="p k{p.kind}" style="--a:{p.a}deg;--d:{p.d}px;--s:{p.s}px;--delay:{p.delay}ms"></span>
          {/each}
        </div>
        <div class="plate">
          {#if shown.tier !== 'win'}
            <ArtImg name="casino/big-win.webp" class="bannerimg">
              {#snippet fallback()}
                <div class="ribbon"><span>{LABEL[shown!.tier]}</span></div>
              {/snippet}
            </ArtImg>
          {/if}
          <div class="amount">+{Math.round(count.current).toLocaleString()}</div>
        </div>
      </div>
    {/key}
  {/if}
</div>

<style>
  .winfx {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 5;
    overflow: hidden;
    border-radius: inherit;
  }
  .wrap {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
  }
  .flash {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% 50%, rgba(255, 244, 200, 0.85), rgba(255, 210, 90, 0.25) 45%, transparent 75%);
    animation: flash 700ms ease-out forwards;
  }
  @keyframes flash {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
  .rays {
    position: absolute;
    width: 160%;
    aspect-ratio: 1;
    background: repeating-conic-gradient(from 0deg, rgba(255, 215, 106, 0.2) 0deg 8deg, transparent 8deg 20deg);
    mask-image: radial-gradient(circle, #000 0%, transparent 60%);
    animation:
      spin 6s linear infinite,
      fadeout 2.8s ease-in forwards;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes fadeout {
    0%,
    70% {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
  .burst {
    position: absolute;
    left: 50%;
    top: 50%;
  }
  .p {
    position: absolute;
    width: var(--s);
    height: var(--s);
    margin: calc(var(--s) / -2);
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #fff7d1, #ffd24a 45%, #c98a0b);
    box-shadow: 0 0 8px rgba(255, 200, 60, 0.8);
    animation: fly 1100ms cubic-bezier(0.1, 0.7, 0.3, 1) var(--delay) both;
  }
  .p.k1 {
    border-radius: 2px;
    transform: rotate(45deg);
    background: linear-gradient(135deg, #fffbe6, #ffd24a);
  }
  .p.k2 {
    width: calc(var(--s) * 0.5);
    height: calc(var(--s) * 0.5);
    background: #fff;
    box-shadow: 0 0 10px 3px rgba(255, 240, 180, 0.9);
  }
  @keyframes fly {
    0% {
      transform: rotate(var(--a)) translateX(0) scale(0.4);
      opacity: 0;
    }
    12% {
      opacity: 1;
    }
    100% {
      transform: rotate(var(--a)) translateX(var(--d)) translateY(30px) scale(1);
      opacity: 0;
    }
  }
  .plate {
    position: relative;
    display: grid;
    justify-items: center;
    gap: 2px;
    animation: pop 480ms cubic-bezier(0.3, 1.6, 0.5, 1) both;
  }
  .wrap.win .plate {
    animation:
      pop 380ms cubic-bezier(0.3, 1.6, 0.5, 1) both,
      fadeout 1.5s ease-in forwards;
  }
  @keyframes pop {
    from {
      transform: scale(0.3);
      opacity: 0;
    }
  }
  .amount {
    font-size: clamp(30px, 7vw, 54px);
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.01em;
    background: linear-gradient(180deg, #fffbe8 0%, #ffe07a 40%, #e9a916 60%, #fff0b0 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    filter: drop-shadow(0 3px 0 #6b4200) drop-shadow(0 0 18px rgba(255, 190, 40, 0.7));
  }
  .wrap.win .amount {
    font-size: clamp(26px, 5.5vw, 40px);
  }
  .ribbon {
    position: relative;
    padding: 6px 30px;
    background: linear-gradient(180deg, #d4202f, #8c0c18);
    border: 2px solid #ffd76a;
    border-radius: 6px;
    box-shadow:
      0 6px 18px rgba(0, 0, 0, 0.45),
      inset 0 1px 0 rgba(255, 255, 255, 0.35);
    transform: rotate(-3deg);
  }
  .ribbon span {
    font-size: clamp(18px, 4vw, 28px);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #fff4c9;
    text-shadow:
      0 2px 0 #6b0710,
      0 0 12px rgba(255, 220, 120, 0.8);
  }
  .mega .ribbon,
  .epic .ribbon {
    background: linear-gradient(180deg, #7b2ff2, #3d0f8a);
  }
  .epic .ribbon {
    background: linear-gradient(90deg, #ff3d6e, #ffb800, #3ddc84, #2db4ff, #b44dff);
  }
  :global(.bannerimg) {
    width: min(320px, 70%);
    height: auto;
  }
</style>
