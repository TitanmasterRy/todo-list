<script lang="ts">
  // The Tree of Wisdom: grows a foot per feeding, wears the colors of the courses that fed it, changes with the
  // real season and time of day, and picks up residents and decorations at milestones (see TREE_MILESTONES).
  import { treeUnlocks, type Daylight, type Season } from '../../../lib/garden';

  let {
    height,
    leaves,
    season,
    daylight,
    pulse = 0,
  }: {
    height: number;
    leaves: string[];
    season: Season;
    daylight: Daylight;
    pulse?: number; // bumps on each feeding for the growth animation
  } = $props();

  const W = 640;
  const H = 440;
  const GROUND = 380;
  const TX = 330;
  const trunkH = $derived(60 + 250 * (1 - Math.exp(-height / 45)));
  const top = $derived(GROUND - trunkH);
  const spread = $derived(36 + trunkH * 0.36);
  const has = $derived(new Set(treeUnlocks(height).map((m) => m.feet)));
  const winter = $derived(season === 'winter');
  const night = $derived(daylight === 'night');
  const SEASON_LEAVES: Record<Season, string[]> = {
    spring: ['#8fd18f', '#f7b6d2', '#b5e7a0', '#ffd6e8'],
    summer: ['#3fa34d', '#5cb85c', '#7fd07f', '#2e8b57'],
    autumn: ['#e07b39', '#f4a261', '#c1440e', '#f7c948'],
    winter: ['#dfe9f3', '#c9d6e3'],
  };
  const SKY: Record<Daylight, [string, string]> = {
    dawn: ['#ffb88c', '#c3b1e1'],
    day: ['#7ec8ff', '#d9f1ff'],
    dusk: ['#ff9a5c', '#6a3d9a'],
    night: ['#0b1230', '#243a6b'],
  };
  // leaf clusters spiral out from the top of the trunk (a sunflower spiral, so they never overlap the same spot)
  const clusters = $derived.by(() => {
    const n = 5 + Math.min(26, Math.floor(height / 2));
    const base = SEASON_LEAVES[season];
    return Array.from({ length: n }, (_, i) => {
      const a = i * 2.39996;
      const d = spread * Math.sqrt(i / n);
      const course = leaves.length && i % 3 === 1 ? leaves[i % leaves.length] : undefined;
      return { x: TX + Math.cos(a) * d, y: top + 6 + Math.sin(a) * d * 0.75, r: 16 + ((i * 7) % 4) * 4 + trunkH * 0.07, fill: base[i % base.length], course, d: (i % 5) * 0.4 };
    });
  });
  const branches = $derived(
    Array.from({ length: Math.min(6, 1 + Math.floor(height / 5)) }, (_, i) => {
      const side = i % 2 ? 1 : -1;
      const y = top + 10 + i * (trunkH / 7);
      return `M${TX} ${y} q ${side * spread * 0.3} ${-8 - i * 2} ${side * spread * 0.7} ${-spread * 0.35}`;
    }),
  );
  const stars = Array.from({ length: 26 }, (_, i) => ({ x: (i * 97) % W, y: ((i * 61) % 180) + 10, r: 0.8 + (i % 3) * 0.5, d: (i % 7) * 0.5 }));
  const falling = $derived.by(() => {
    const kind = has.has(200) ? 'petal' : season === 'autumn' ? 'leaf' : winter ? 'snow' : season === 'spring' ? 'petal' : '';
    if (!kind) return [];
    return Array.from({ length: 12 }, (_, i) => ({
      kind,
      x: (i * 53 + 20) % W,
      d: i * 0.55,
      dur: 5 + (i % 4),
      fill: kind === 'snow' ? '#fff' : kind === 'leaf' ? SEASON_LEAVES.autumn[i % 4] : '#ffb3d1',
    }));
  });
  const fruit = $derived(clusters.filter((_, i) => i % 3 === 2).slice(0, 7));
  const fireflies = Array.from({ length: 9 }, (_, i) => ({ x: 120 + ((i * 71) % 400), y: 150 + ((i * 43) % 190), d: i * 0.37 }));
</script>

<svg viewBox="0 0 {W} {H}" class="tree-scene" data-daylight={daylight} data-season={season} aria-hidden="true">
  <defs>
    <linearGradient id="tw-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color={SKY[daylight][0]} /><stop offset="1" stop-color={SKY[daylight][1]} />
    </linearGradient>
    <linearGradient id="tw-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color={winter ? '#eef4fa' : season === 'autumn' ? '#a7c957' : '#6cc26c'} /><stop offset="1" stop-color={winter ? '#c9d6e3' : '#3f8f3a'} />
    </linearGradient>
    <linearGradient id="tw-trunk" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#5a3a1e" /><stop offset="0.5" stop-color="#8b5a2b" /><stop offset="1" stop-color="#4a2f18" />
    </linearGradient>
    <radialGradient id="tw-glow"><stop offset="0" stop-color="#fff2b3" stop-opacity="0.9" /><stop offset="1" stop-color="#ffd166" stop-opacity="0" /></radialGradient>
  </defs>
  <rect width={W} height={H} fill="url(#tw-sky)" />
  {#if night}
    {#each stars as s, i (i)}<circle cx={s.x} cy={s.y} r={s.r} fill="#fff" class="star" style="animation-delay:{s.d}s" />{/each}
  {/if}
  {#if daylight === 'day' || daylight === 'dawn'}
    <circle cx="90" cy="70" r="30" fill="#fff3a6" class="sun" />
    <circle cx="90" cy="70" r="56" fill="url(#tw-glow)" class="sun" />
  {:else if daylight === 'dusk'}
    <circle cx="560" cy="150" r="34" fill="#ffd166" opacity="0.9" />
  {/if}
  {#if has.has(100)}
    <g class="moon">
      <circle cx={TX + spread * 0.55} cy={top - 10} r="40" fill="url(#tw-glow)" />
      <circle cx={TX + spread * 0.55} cy={top - 10} r="18" fill="#fff7cc" />
      <circle cx={TX + spread * 0.55 - 7} cy={top - 14} r="16" fill={night ? '#16234a' : SKY[daylight][0]} opacity="0.95" />
    </g>
  {:else if night}
    <circle cx="560" cy="70" r="22" fill="#fff7cc" />
    <circle cx="551" cy="64" r="19" fill="#0e1738" />
  {/if}
  <!-- far hills and the ground -->
  <ellipse cx="120" cy={GROUND + 20} rx="260" ry="70" fill={winter ? '#d8e3ee' : '#4f9f4c'} opacity="0.8" />
  <ellipse cx="540" cy={GROUND + 30} rx="300" ry="80" fill={winter ? '#cfdae8' : '#57ad54'} opacity="0.8" />
  <rect x="0" y={GROUND} width={W} height={H - GROUND} fill="url(#tw-ground)" />
  {#each [110, 480] as cx, i (cx)}
    <g class="cloud" style="animation-delay:{i * -8}s" opacity={night ? 0.2 : 0.85}>
      <ellipse {cx} cy={70 + i * 30} rx="46" ry="14" fill="#fff" /><ellipse cx={cx - 30} cy={78 + i * 30} rx="28" ry="12" fill="#fff" /><ellipse
        cx={cx + 32}
        cy={78 + i * 30}
        rx="30"
        ry="11"
        fill="#fff"
      />
    </g>
  {/each}
  {#if has.has(75)}
    <!-- above the clouds: the hill top pokes through a cloud sea -->
    {#each [40, 170, 300, 430, 560] as cx, i (cx)}
      <g class="cloud" style="animation-delay:{i * -3}s">
        <ellipse {cx} cy={GROUND + 4} rx="80" ry="22" fill="#fff" opacity="0.92" />
        <ellipse cx={cx - 40} cy={GROUND + 10} rx="50" ry="18" fill="#fff" opacity="0.92" />
        <ellipse cx={cx + 45} cy={GROUND + 12} rx="55" ry="16" fill="#fff" opacity="0.92" />
      </g>
    {/each}
  {/if}

  {#key pulse}
    <g class="tree" class:pulse={pulse > 0} style="transform-origin: {TX}px {GROUND}px">
      <ellipse cx={TX} cy={GROUND + 4} rx={30 + trunkH * 0.15} ry="9" fill="rgba(0,0,0,0.18)" />
      {#each branches as d, i (i)}<path {d} fill="none" stroke="#5a3a1e" stroke-width={6 - i * 0.5} stroke-linecap="round" />{/each}
      <path d="M{TX - 20} {GROUND + 2} q -2 {-trunkH * 0.5} {12} {-trunkH} l 16 0 q 14 {trunkH * 0.5} 12 {trunkH} z" fill="url(#tw-trunk)" />
      <path d="M{TX - 30} {GROUND + 2} q 10 -14 12 -30 l 6 30 z M{TX + 30} {GROUND + 2} q -10 -14 -12 -30 l -6 30 z" fill="#5a3a1e" />
      <path d="M{TX - 6} {GROUND - 10} q -2 {-trunkH * 0.5} 4 {-trunkH * 0.85}" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="3" stroke-linecap="round" />
      {#if has.has(10)}
        <g transform="translate({TX - 22} {top + trunkH * 0.35})">
          <rect x="-9" y="0" width="18" height="16" rx="2" fill="#d9a066" stroke="#8b5a2b" />
          <path d="M-12 0 l 12 -10 l 12 10 z" fill="#b5651d" />
          <circle cx="0" cy="8" r="3.2" fill="#2b1a0e" />
        </g>
      {/if}
      {#if has.has(20)}
        <g transform="translate({TX - 70} {GROUND - trunkH * 0.42})" class="treehouse">
          <rect x="0" y="0" width="44" height="30" rx="3" fill="#c98a4b" stroke="#7a4a1e" />
          <path d="M-4 0 l 26 -16 l 26 16 z" fill="#8b3a3a" />
          <rect x="16" y="9" width="12" height="11" rx="1.5" fill={night ? '#ffe08a' : '#9bd3ff'} class:lit={night} />
          <rect x="-4" y="30" width="52" height="4" fill="#7a4a1e" />
          <path d="M44 32 l 20 -8" stroke="#7a4a1e" stroke-width="3" />
          <path d="M14 34 v 22 M24 34 v 22 M14 42 h10 M14 50 h10" stroke="#7a4a1e" stroke-width="2" fill="none" />
        </g>
      {/if}
      {#if !winter}
        {#each clusters as c, i (i)}
          <circle cx={c.x} cy={c.y} r={c.r} fill={c.course ? `color-mix(in srgb, ${c.course} 45%, ${c.fill})` : c.fill} class="leafy" style="animation-delay:{c.d}s" />
          <circle cx={c.x - c.r * 0.3} cy={c.y - c.r * 0.3} r={c.r * 0.45} fill="rgba(255,255,255,0.18)" />
        {/each}
      {:else}
        {#each clusters as c, i (i)}
          <path d="M{TX} {top + 10} Q {(TX + c.x) / 2} {(top + c.y) / 2 - 20} {c.x} {c.y}" fill="none" stroke="#5a3a1e" stroke-width="2.5" stroke-linecap="round" />
          <ellipse cx={c.x} cy={c.y - 3} rx={c.r * 0.35} ry="4" fill="#fff" />
        {/each}
      {/if}
      {#if has.has(30) && !winter}
        {#each fruit as f, i (i)}<circle cx={f.x + 6} cy={f.y + f.r * 0.5} r="6" fill="#e63946" stroke="#9b1c2a" class="fruit" style="animation-delay:{i * 0.3}s" />{/each}
      {/if}
      {#if has.has(15)}
        {#each [-0.6, 0, 0.6] as k, i (k)}
          <g transform="translate({TX + spread * k} {top + 20 + spread * 0.6})"
            ><g class="lantern" style="animation-delay:{i * 0.4}s">
              <line x1="0" y1="-16" x2="0" y2="0" stroke="#5a3a1e" stroke-width="1.5" />
              {#if night || daylight === 'dusk'}<circle cx="0" cy="9" r="16" fill="url(#tw-glow)" />{/if}
              <rect x="-6" y="0" width="12" height="16" rx="5" fill={night || daylight === 'dusk' ? '#ffb347' : '#ff7b54'} stroke="#8b2f00" />
            </g></g
          >
        {/each}
      {/if}
      {#if has.has(3)}
        <g transform="translate({TX - spread * 0.5} {top + 12 - spread * 0.2})"
          ><g class="bird">
            <ellipse cx="0" cy="0" rx="7" ry="5.5" fill="#3b82f6" />
            <circle cx="6" cy="-3" r="4" fill="#3b82f6" />
            <path d="M10 -3 l 5 1.5 l -5 1.5 z" fill="#f59e0b" />
            <circle cx="7" cy="-4" r="1" fill="#fff" />
            <path d="M-7 0 l -6 -4 l 0 6 z" fill="#2563eb" />
          </g></g
        >
      {/if}
      {#if has.has(50)}
        <text x={TX + spread * 0.25} y={top + 30} font-size="26" text-anchor="middle" class="owl">🦉</text>
      {/if}
      {#if has.has(6)}
        <g class="swing" style="transform-origin: {TX + spread * 0.62}px {top + 30}px">
          <line x1={TX + spread * 0.62 - 9} y1={top + 30} x2={TX + spread * 0.62 - 9} y2={top + 30 + trunkH * 0.55} stroke="#c9b27c" stroke-width="2" />
          <line x1={TX + spread * 0.62 + 9} y1={top + 30} x2={TX + spread * 0.62 + 9} y2={top + 30 + trunkH * 0.55} stroke="#c9b27c" stroke-width="2" />
          <rect x={TX + spread * 0.62 - 13} y={top + 30 + trunkH * 0.55} width="26" height="5" rx="2" fill="#8b5a2b" />
        </g>
      {/if}
      {#if has.has(150)}
        <g class="hammock">
          <line x1={TX + 12} y1={GROUND - 40} x2={TX + 120} y2={GROUND - 46} stroke="#5a3a1e" stroke-width="2" />
          <path d="M{TX + 12} {GROUND - 40} q 54 30 108 -6" fill="none" stroke="#f4a261" stroke-width="7" stroke-linecap="round" />
          <line x1={TX + 120} y1={GROUND - 46} x2={TX + 120} y2={GROUND} stroke="#5a3a1e" stroke-width="4" />
        </g>
      {/if}
    </g>
  {/key}
  {#if has.has(40) && night}
    {#each fireflies as f, i (i)}<circle cx={f.x} cy={f.y} r="2.2" fill="#e9ff70" class="firefly" style="animation-delay:{f.d}s" />{/each}
  {/if}
  {#each falling as f, i (i)}
    <ellipse
      cx={f.x}
      cy="-10"
      rx={f.kind === 'snow' ? 2.5 : 4}
      ry={f.kind === 'snow' ? 2.5 : 2.5}
      fill={f.fill}
      class="fall"
      style="animation-delay:{f.d}s; animation-duration:{f.dur}s"
      opacity="0.9"
    />
  {/each}
  <!-- the sign post -->
  <g transform="translate(92 {GROUND - 34})">
    <rect x="-2" y="10" width="5" height="34" fill="#8b5a2b" />
    <rect x="-40" y="-12" width="82" height="30" rx="5" fill="#d9a066" stroke="#7a4a1e" stroke-width="2" />
    <text x="1" y="9" text-anchor="middle" font-size="17" font-weight="900" fill="#3a2410">{height} ft</text>
  </g>
</svg>

<style>
  .tree-scene {
    display: block;
    width: 100%;
    border-radius: var(--radius);
  }
  .tree {
    transition: transform var(--dur-slow) var(--spring);
  }
  .tree.pulse {
    animation: tree-pulse 700ms var(--spring);
  }
  .leafy {
    transform-box: fill-box;
    transform-origin: center;
    animation: leaf-breathe 5s ease-in-out infinite;
  }
  .star {
    animation: twinkle 2.4s ease-in-out infinite;
  }
  .sun {
    transform-box: fill-box;
    transform-origin: center;
    animation: sun-breathe 6s ease-in-out infinite;
  }
  .cloud {
    animation: drift 18s ease-in-out infinite alternate;
  }
  .swing {
    animation: swing 3.2s ease-in-out infinite;
  }
  .bird {
    animation: hop 2.6s ease-in-out infinite;
  }
  .lantern {
    animation: swing 4s ease-in-out infinite;
    transform-box: fill-box;
    transform-origin: top center;
  }
  .fruit {
    transform-box: fill-box;
    transform-origin: center;
    animation: leaf-breathe 3s ease-in-out infinite;
  }
  .firefly {
    animation: firefly 2.8s ease-in-out infinite;
  }
  .owl {
    animation: hop 5s ease-in-out infinite;
  }
  .lit {
    filter: drop-shadow(0 0 6px #ffe08a);
  }
  .fall {
    animation: fall linear infinite;
  }
  @keyframes tree-pulse {
    0% {
      transform: scale(1);
    }
    40% {
      transform: scale(1.04, 1.07);
    }
    100% {
      transform: scale(1);
    }
  }
  @keyframes leaf-breathe {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }
  @keyframes twinkle {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 1;
    }
  }
  @keyframes sun-breathe {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.08);
    }
  }
  @keyframes drift {
    from {
      transform: translateX(-14px);
    }
    to {
      transform: translateX(14px);
    }
  }
  @keyframes swing {
    0%,
    100% {
      transform: rotate(-6deg);
    }
    50% {
      transform: rotate(6deg);
    }
  }
  @keyframes hop {
    0%,
    80%,
    100% {
      transform: translateY(0);
    }
    90% {
      transform: translateY(-5px);
    }
  }
  @keyframes firefly {
    0%,
    100% {
      opacity: 0;
      transform: translate(0, 0);
    }
    50% {
      opacity: 1;
      transform: translate(6px, -8px);
    }
  }
  @keyframes fall {
    0% {
      transform: translate(0, 0) rotate(0);
      opacity: 0;
    }
    10% {
      opacity: 0.9;
    }
    100% {
      transform: translate(30px, 450px) rotate(300deg);
      opacity: 0.6;
    }
  }
</style>
