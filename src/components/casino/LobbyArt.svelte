<script lang="ts">
  // Drawn lobby illustrations, one per game (generated art replaces them via casino/lobby/<id>.webp).
  import { SUIT_PATH } from './PlayingCard.svelte';
  import type { Suit } from '../../lib/casino/cards';

  interface Props {
    id: string;
  }
  let { id }: Props = $props();

  const BG: Record<string, [string, string]> = {
    tables: ['#1c9a57', '#07371e'],
    cards: ['#3a3fb0', '#120f3d'],
    slots: ['#c3263b', '#3a0710'],
    quick: ['#1a8ea0', '#082a3a'],
  };
  const CAT: Record<string, keyof typeof BG> = {
    blackjack: 'tables',
    roulette: 'tables',
    baccarat: 'tables',
    craps: 'tables',
    videopoker: 'cards',
    threecard: 'cards',
    letitride: 'cards',
    holdem: 'cards',
    hilo: 'cards',
    slots: 'slots',
    wheel: 'slots',
    plinko: 'slots',
    keno: 'quick',
    mines: 'quick',
    dice: 'quick',
    scratch: 'quick',
  };
  const bg = $derived(BG[CAT[id] ?? 'quick']);
  const RED = [32, 19, 21, 25, 34, 27, 36, 30, 23, 5, 16, 1, 14, 9, 18, 7, 12, 3];
  const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  function wedge(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
    const p = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
    return `M${p(r0, a0)} L${p(r1, a0)} A${r1},${r1} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${r0},${r0} 0 0 0 ${p(r0, a0)} Z`;
  }
  function cardsFor(g: string): [number, string, Suit, number][] {
    if (g === 'blackjack')
      return [
        [-9, 'A', '♠', 60],
        [9, 'K', '♥', 84],
      ];
    if (g === 'baccarat')
      return [
        [-14, '9', '♦', 48],
        [-4, '8', '♣', 64],
        [6, 'Q', '♥', 88],
        [16, '9', '♠', 104],
      ];
    if (g === 'threecard')
      return [
        [-14, 'Q', '♥', 58],
        [0, 'K', '♥', 80],
        [14, 'A', '♥', 102],
      ];
    return [[0, '7', '♣', 80]];
  }
  const WHEEL6 = [
    '#ffcf4a',
    '#4aa3ff',
    '#ffcf4a',
    '#b07cff',
    '#ffcf4a',
    '#4aa3ff',
    '#ffcf4a',
    '#3ddc97',
    '#ffcf4a',
    '#4aa3ff',
    '#ff7a59',
    '#ffcf4a',
    '#4aa3ff',
    '#b07cff',
    '#ffcf4a',
    '#1d1d24',
  ];
</script>

<svg viewBox="0 0 160 100" class="lobbyart" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="la-bg-{id}" cx="50%" cy="40%" r="75%">
      <stop offset="0" stop-color={bg[0]} />
      <stop offset="1" stop-color={bg[1]} />
    </radialGradient>
    <linearGradient id="la-gold-{id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff2b8" />
      <stop offset=".5" stop-color="#e7b84a" />
      <stop offset="1" stop-color="#9a6b12" />
    </linearGradient>
  </defs>
  <rect width="160" height="100" fill="url(#la-bg-{id})" />
  <g opacity=".22" fill="#fff">
    <circle cx="14" cy="14" r="1.2" /><circle cx="146" cy="20" r="1.4" /><circle cx="130" cy="84" r="1" /><circle cx="24" cy="80" r="1.3" /><circle cx="80" cy="8" r="1" />
  </g>

  {#if id === 'slots'}
    <rect x="42" y="14" width="70" height="78" rx="10" fill="#8f1224" stroke="url(#la-gold-{id})" stroke-width="3" />
    <rect x="50" y="8" width="54" height="14" rx="7" fill="#2a0508" stroke="url(#la-gold-{id})" stroke-width="2" />
    {#each [0, 1, 2, 3, 4, 5] as i (i)}<circle cx={57 + i * 8} cy="15" r="2" fill={i % 2 ? '#fff2b0' : '#ffb03a'} />{/each}
    <rect x="49" y="30" width="56" height="34" rx="4" fill="#fffaf0" />
    {#each [0, 1, 2] as i (i)}
      <rect x={51 + i * 18} y="32" width="16" height="30" rx="2" fill="url(#la-bg-{id})" opacity=".08" />
      <text x={59 + i * 18} y="55" text-anchor="middle" font-size="22" font-weight="900" fill="#d6132f" stroke="#7a0010" stroke-width=".8" font-family="Georgia,serif">7</text>
    {/each}
    <line x1="49" y1="47" x2="105" y2="47" stroke="#ffcf4a" stroke-width="1.2" opacity=".9" />
    <rect x="54" y="70" width="46" height="12" rx="6" fill="url(#la-gold-{id})" />
    <path d="M112 58 h8 v-34" stroke="#c9ced8" stroke-width="3" fill="none" stroke-linecap="round" />
    <circle cx="120" cy="22" r="6" fill="#e0203a" stroke="#7a0010" />
    <circle cx="118" cy="20" r="2" fill="#fff" opacity=".6" />
  {:else if id === 'roulette' || id === 'wheel'}
    {#if id === 'roulette'}
      <circle cx="80" cy="52" r="44" fill="#4a2a10" stroke="url(#la-gold-{id})" stroke-width="3" />
      {#each ORDER as n, i (i)}
        {@const a0 = ((i / 37) * 360 - 90) * (Math.PI / 180)}
        {@const a1 = (((i + 1) / 37) * 360 - 90) * (Math.PI / 180)}
        <path d={wedge(80, 52, 22, 38, a0, a1)} fill={n === 0 ? '#12a061' : RED.includes(n) ? '#c8102e' : '#16161b'} stroke="#e7b84a" stroke-width=".4" />
      {/each}
      <circle cx="80" cy="52" r="22" fill="#6b3f18" stroke="url(#la-gold-{id})" stroke-width="2" />
      <path d="M80 36 L83 49 L96 52 L83 55 L80 68 L77 55 L64 52 L77 49 Z" fill="url(#la-gold-{id})" />
      <circle cx="80" cy="52" r="4" fill="#fff2b8" />
      <circle cx="107" cy="30" r="3.4" fill="#fff" stroke="#bbb" stroke-width=".5" />
    {:else}
      <g transform="rotate(-8 80 54)">
        {#each WHEEL6 as c, i (i)}
          {@const a0 = ((i / 16) * 360 - 90) * (Math.PI / 180)}
          {@const a1 = (((i + 1) / 16) * 360 - 90) * (Math.PI / 180)}
          <path d={wedge(80, 54, 10, 40, a0, a1)} fill={c} stroke="#fff" stroke-width=".8" />
          <circle cx={80 + 42 * Math.cos(a0)} cy={54 + 42 * Math.sin(a0)} r="1.6" fill="url(#la-gold-{id})" />
        {/each}
      </g>
      <circle cx="80" cy="54" r="44" fill="none" stroke="url(#la-gold-{id})" stroke-width="3" />
      <circle cx="80" cy="54" r="11" fill="url(#la-gold-{id})" />
      <path d="M80 50 l1.3 3 3.2 .3 -2.4 2.1 .7 3.1 -2.8 -1.6 -2.8 1.6 .7 -3.1 -2.4 -2.1 3.2 -.3 Z" fill="#8a1020" />
      <path d="M74 4 L86 4 L80 16 Z" fill="#ffe39a" stroke="#9a6b12" />
    {/if}
  {:else if id === 'blackjack' || id === 'baccarat' || id === 'threecard' || id === 'hilo'}
    {#each cardsFor(id) as [rot, r, s, x], i (i)}
      <g transform="rotate({rot} {x} 90)">
        <rect x={x - 17} y="26" width="34" height="48" rx="4" fill="#fffdf6" stroke="#0003" />
        <text x={x - 11} y="37" text-anchor="middle" font-size="9" font-weight="800" font-family="Georgia,serif" fill={s === '♥' || s === '♦' ? '#cf1530' : '#17171d'}>{r}</text>
        <path d={SUIT_PATH[s]} transform="translate({x - 9} 44) scale(.18)" fill={s === '♥' || s === '♦' ? '#cf1530' : '#17171d'} />
      </g>
    {/each}
    {#if id === 'blackjack'}
      <text x="80" y="95" text-anchor="middle" font-size="9" font-weight="800" fill="#ffe39a" letter-spacing="2" font-family="Georgia,serif">BLACKJACK 3:2</text>
    {:else if id === 'baccarat'}
      <text x="56" y="20" text-anchor="middle" font-size="9" font-weight="800" fill="#9cd2ff" font-family="Georgia,serif">PLAYER</text>
      <text x="104" y="20" text-anchor="middle" font-size="9" font-weight="800" fill="#ffb3b3" font-family="Georgia,serif">BANKER</text>
    {:else if id === 'hilo'}
      <path d="M124 44 l12 -16 l12 16 h-7 v14 h-10 v-14 Z" fill="#3ddc84" stroke="#0b5" />
      <path d="M12 56 l12 16 l12 -16 h-7 v-14 h-10 v14 Z" fill="#ff5a6e" stroke="#a00" />
    {/if}
  {:else if id === 'videopoker'}
    <rect x="18" y="10" width="124" height="80" rx="10" fill="#15151c" stroke="url(#la-gold-{id})" stroke-width="2.5" />
    <rect x="26" y="17" width="108" height="64" rx="6" fill="#0a1a8a" />
    <text x="80" y="31" text-anchor="middle" font-size="9" font-weight="900" fill="#ffe14a" letter-spacing="1.5" font-family="system-ui,sans-serif">ROYAL FLUSH</text>
    {#each ['10', 'J', 'Q', 'K', 'A'] as r, i (i)}
      <rect x={31 + i * 20} y="38" width="18" height="26" rx="2" fill="#fff" />
      <text x={40 + i * 20} y="50" text-anchor="middle" font-size="8" font-weight="800" fill="#17171d" font-family="Georgia,serif">{r}</text>
      <path d={SUIT_PATH['♠']} transform="translate({35 + i * 20} 52) scale(.09)" fill="#17171d" />
      <text x={40 + i * 20} y="73" text-anchor="middle" font-size="5" font-weight="800" fill="#ffe14a">HELD</text>
    {/each}
    <rect x="26" y="17" width="108" height="64" rx="6" fill="url(#la-bg-{id})" opacity=".12" />
  {:else if id === 'craps' || id === 'dice'}
    {#snippet die(x: number, y: number, s: number, n: number)}
      <g transform="translate({x} {y})">
        <path d="M0 {s * 0.3} L{s * 0.5} 0 L{s} {s * 0.3} L{s * 0.5} {s * 0.6} Z" fill="#fff" />
        <path d="M0 {s * 0.3} L{s * 0.5} {s * 0.6} L{s * 0.5} {s * 1.2} L0 {s * 0.9} Z" fill="#d9d3c7" />
        <path d="M{s} {s * 0.3} L{s * 0.5} {s * 0.6} L{s * 0.5} {s * 1.2} L{s} {s * 0.9} Z" fill="#b9b1a3" />
        {#each n === 5 ? [0.25, 0.5, 0.75] : [0.5] as t, i (i)}
          <ellipse cx={s * (0.5 + (t - 0.5) * 0.7)} cy={s * 0.3} rx={s * 0.07} ry={s * 0.045} fill={id === 'craps' ? '#c8102e' : '#1b1b22'} />
        {/each}
        <circle cx={s * 0.25} cy={s * 0.62} r={s * 0.055} fill="#1b1b22" />
        <circle cx={s * 0.25} cy={s * 0.9} r={s * 0.055} fill="#1b1b22" />
        <circle cx={s * 0.75} cy={s * 0.62} r={s * 0.055} fill="#1b1b22" />
        <circle cx={s * 0.75} cy={s * 0.9} r={s * 0.055} fill="#1b1b22" />
      </g>
    {/snippet}
    {#if id === 'craps'}
      <path d="M8 88 Q80 56 152 88" stroke="#fff" stroke-width="1.5" fill="none" opacity=".6" />
      <text x="80" y="95" text-anchor="middle" font-size="8" font-weight="800" fill="#ffe39a" letter-spacing="2" font-family="Georgia,serif">PASS LINE</text>
      {@render die(38, 20, 36, 5)}
      {@render die(86, 30, 32, 1)}
    {:else}
      <rect x="16" y="70" width="128" height="10" rx="5" fill="#e0485a" />
      <rect x="16" y="70" width="70" height="10" rx="5" fill="#3ddc84" />
      <path d="M86 64 l5 -8 h-10 Z" fill="#fff" />
      <text x="86" y="92" text-anchor="middle" font-size="9" font-weight="900" fill="#fff">54.21</text>
      {@render die(58, 12, 40, 5)}
    {/if}
  {:else if id === 'plinko'}
    {#each Array.from({ length: 6 }, (_, r) => r) as r (r)}
      {#each Array.from({ length: r + 3 }, (_, i) => i) as i (i)}
        <circle cx={80 + (i - (r + 2) / 2) * 13} cy={14 + r * 11} r="2" fill="#fff" opacity=".85" />
      {/each}
    {/each}
    {#each ['#ff5a6e', '#ff9a3c', '#ffd24a', '#8be36f', '#ffd24a', '#ff9a3c', '#ff5a6e'] as c, i (i)}
      <rect x={80 + (i - 3.5) * 13 + 1} y="82" width="11" height="10" rx="2" fill={c} />
    {/each}
    <path d="M80 6 Q74 20 86 26 Q94 34 86 44" stroke="#ffd24a" stroke-width="3" fill="none" opacity=".35" stroke-linecap="round" />
    <circle cx="86" cy="46" r="5" fill="url(#la-gold-{id})" />
  {:else if id === 'keno'}
    {#each Array.from({ length: 20 }, (_, i) => i) as i (i)}
      {@const lit = [2, 7, 9, 13, 16].includes(i)}
      <circle cx={24 + (i % 5) * 16} cy={22 + Math.floor(i / 5) * 18} r="7" fill={lit ? '#ffd24a' : 'rgba(255,255,255,.18)'} />
      <text x={24 + (i % 5) * 16} y={25 + Math.floor(i / 5) * 18} text-anchor="middle" font-size="7" font-weight="800" fill={lit ? '#3a2600' : '#fff'}>{i + 1}</text>
    {/each}
    <circle cx="128" cy="46" r="24" fill="rgba(255,255,255,.12)" stroke="#bfe9ff" stroke-width="2" />
    {#each [[120, 52, '#ff5a6e'], [132, 56, '#ffd24a'], [126, 40, '#4aa3ff'], [138, 44, '#3ddc84'], [116, 42, '#b07cff']] as [x, y, c], i (i)}
      <circle cx={x} cy={y} r="5" fill={String(c)} />
    {/each}
    <circle cx="120" cy="36" r="6" fill="#fff" opacity=".25" />
  {:else if id === 'mines'}
    {#each Array.from({ length: 9 }, (_, i) => i) as i (i)}
      <rect x={44 + (i % 3) * 25} y={12 + Math.floor(i / 3) * 25} width="22" height="22" rx="4" fill={i === 4 ? '#0f6b58' : i === 8 ? '#6b0f1c' : '#2c3a5c'} stroke="#ffffff22" />
    {/each}
    <path d="M69 44 l7 -6 h10 l7 6 l-12 14 Z" fill="#5ef0d1" stroke="#fff" stroke-width=".8" />
    <path d="M69 44 h24 M76 38 l5 20 M86 38 l-5 20" stroke="#fff" stroke-width=".6" opacity=".7" />
    <circle cx="105" cy="75" r="7" fill="#1b1b22" />
    <path d="M109 69 l3 -4" stroke="#ffb03a" stroke-width="2" stroke-linecap="round" />
    <circle cx="113" cy="64" r="2" fill="#ffe14a" />
  {:else if id === 'scratch'}
    <g transform="rotate(-6 80 50)">
      <rect x="22" y="14" width="116" height="72" rx="6" fill="#fff7dd" stroke="url(#la-gold-{id})" stroke-width="3" />
      <text x="80" y="27" text-anchor="middle" font-size="9" font-weight="900" fill="#b8001f" font-family="Georgia,serif" letter-spacing="1.5">LUCKY 3</text>
      {#each Array.from({ length: 6 }, (_, i) => i) as i (i)}
        <rect x={32 + (i % 3) * 33} y={33 + Math.floor(i / 3) * 24} width="28" height="20" rx="3" fill={i < 3 ? '#fffdf5' : '#b9c0cc'} stroke="#0002" />
        {#if i < 3}<path d="M{46 + (i % 3) * 33} 36 l3 6 6 .8 -4.5 4 1.2 6 -5.7 -3 -5.7 3 1.2 -6 -4.5 -4 6 -.8 Z" fill="#ffc21a" stroke="#b37a00" stroke-width=".6" />{/if}
      {/each}
      <path d="M36 62 q12 -6 22 0 t22 0" stroke="#e4e8ef" stroke-width="3" fill="none" opacity=".8" />
    </g>
  {:else if id === 'letitride'}
    {#each ['1', '2', '$'] as l, i (i)}
      <circle cx={40 + i * 40} cy="58" r="17" fill="none" stroke="#ffe39a" stroke-width="2" stroke-dasharray="4 3" />
      <text x={40 + i * 40} y="64" text-anchor="middle" font-size="16" font-weight="900" fill="#ffe39a" font-family="Georgia,serif">{l}</text>
      <circle cx={40 + i * 40} cy="30" r="9" fill={['#c8102e', '#17853c', '#1c1c22'][i]} stroke="#fff" stroke-width="2.5" stroke-dasharray="3 3" />
    {/each}
  {:else if id === 'holdem'}
    <ellipse cx="80" cy="56" rx="72" ry="36" fill="#0f5e35" stroke="#5a3616" stroke-width="6" />
    <ellipse cx="80" cy="56" rx="72" ry="36" fill="none" stroke="url(#la-gold-{id})" stroke-width="1.5" />
    {#each ['A', 'K', 'Q', 'J', '10'] as r, i (i)}
      <rect x={37 + i * 18} y="42" width="16" height="23" rx="2" fill="#fffdf6" />
      <text x={45 + i * 18} y="53" text-anchor="middle" font-size="7" font-weight="800" font-family="Georgia,serif" fill={i % 2 ? '#cf1530' : '#17171d'}>{r}</text>
      <path d={SUIT_PATH[i % 2 ? '♥' : '♠']} transform="translate({41 + i * 18} 55) scale(.08)" fill={i % 2 ? '#cf1530' : '#17171d'} />
    {/each}
    {#each [[30, 26, '#7d68b8'], [80, 14, '#ee7f33'], [130, 26, '#9a6644']] as [x, y, c], i (i)}
      <circle cx={Number(x)} cy={Number(y)} r="8" fill={String(c)} stroke="#e7b84a" stroke-width="1.5" />
    {/each}
    <circle cx="80" cy="78" r="5" fill="#c8102e" stroke="#fff" stroke-dasharray="2 2" />
    <circle cx="88" cy="80" r="5" fill="#1c1c22" stroke="#fff" stroke-dasharray="2 2" />
  {/if}
</svg>

<style>
  .lobbyart {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
