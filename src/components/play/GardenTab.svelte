<script lang="ts">
  // Play → Garden (Nature theme): a zen garden after the classic one. Every finished task drops a care pack (a seed
  // packet, fertilizer, tree food, bug spray every third). Plant the seeds in the pots, meet what each plant asks for
  // (water, fertilizer, bug spray, music) and it grows a size per bag of fertilizer, dancing and dropping a coin each
  // time it's happy (capped per day). Stinky the snail collects coins while chocolate keeps him awake, and the Tree of
  // Wisdom grows a foot per feeding. The garden is saved on this device; coins and purchases go through the ledger.
  import { onDestroy } from 'svelte';
  import { store } from '../../lib/store.svelte';
  import { economy } from '../../lib/economy.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { playSound } from '../../lib/sounds';
  import { owned } from '../../lib/economy';
  import { todayKey } from '../../lib/dates';
  import {
    coinsLeftToday,
    daylight,
    dropsFor,
    feedSnail,
    feedTree,
    GARDEN_DAILY_MAX,
    GARDEN_SHOP,
    GROWN,
    LEDGER_REASON,
    loadGarden,
    NEED_EMOJI,
    NEED_TEXT,
    nextMilestone,
    plant as plantSeedIn,
    POTS,
    saveGarden,
    seasonOf,
    seedsFrom,
    shopReason,
    snailAwake,
    supplies,
    tend,
    thirsty,
    toMeadow,
    treeUnlocks,
    wake,
    wisdomFor,
    type GardenSave,
    type Need,
    type PotPlant,
    type ShopEntry,
  } from '../../lib/garden';
  import PlantSprite from './garden/PlantSprite.svelte';
  import WisdomTree from './garden/WisdomTree.svelte';

  const ls = (): Storage | undefined => {
    try {
      return localStorage;
    } catch {
      return undefined;
    }
  };
  let garden = $state<GardenSave>(wake(loadGarden(ls()), Date.now()));
  function persist() {
    saveGarden(ls(), $state.snapshot(garden) as GardenSave);
  }

  // ---------- supplies: drops from finished tasks + shop purchases − what's been used ----------
  const completions = $derived(
    store.tasks
      .filter((t) => t.completedAt)
      .map((t) => {
        const c = store.courseById(t.courseId);
        return { id: t.id, at: t.completedAt!, color: c?.color, course: c?.name };
      }),
  );
  const seeds = $derived(seedsFrom(completions));
  const bought = $derived.by(() => {
    const n: Record<string, number> = {};
    for (const e of store.ledger) if (e.currency === 'coins' && e.reason.startsWith('garden:')) n[e.reason.slice(7)] = (n[e.reason.slice(7)] ?? 0) + 1;
    return n;
  });
  const shed = $derived(supplies(dropsFor(seeds.length), bought, garden.used));
  const nextSeed = $derived(shed.seeds > 0 ? seeds[garden.used.seeds] : undefined);
  const hasPhonograph = $derived(owned(store.ledger, 'garden-phonograph') > 0);
  const hasGoldenCan = $derived(owned(store.ledger, 'garden-goldenCan') > 0);
  const paidToday = $derived(
    store.ledger.filter((e) => e.reason === LEDGER_REASON && e.currency === 'coins' && todayKey(new Date(e.at)) === store.today).reduce((a, e) => a + e.amount, 0),
  );
  const grownCount = $derived(garden.pots.filter((p) => p?.stage === GROWN).length);
  const planted = $derived(garden.pots.filter(Boolean).length);
  const awake = $derived(snailAwake(garden, store.now.getTime()));
  const light = $derived(daylight(store.now.getHours()));
  const season = $derived(seasonOf(store.now.getMonth()));

  // needs surface over real time (the store clock ticks every 30 s)
  $effect(() => {
    void store.now;
    const w = wake(garden, Date.now());
    if (w !== garden) {
      garden = w;
      persist();
    }
  });

  // ---------- the scene ----------
  let narrow = $state(false);
  $effect(() => {
    const mq = matchMedia('(max-width: 600px)');
    const f = () => (narrow = mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  });
  const cols = $derived(narrow ? 4 : 8);
  const rows = $derived(POTS / cols);
  const CW = 100;
  const CH = 132;
  const SKY = 112;
  const FOOT = 30;
  const W = $derived(cols * CW);
  const H = $derived(SKY + rows * CH + FOOT);
  const potX = (i: number) => (i % cols) * CW + CW / 2;
  const potY = (i: number) => SKY + Math.floor(i / cols) * CH + 104; // the soil line
  const PLANT_SCALE = 1.3;
  const SKY_COLORS = { dawn: ['#ffc09f', '#d4c1ec'], day: ['#8fd3ff', '#e3f6ff'], dusk: ['#ff9e6d', '#7b4fa3'], night: ['#0d1533', '#2b3f6e'] } as const;
  const KIND_NAME = { daisy: 'Daisy', tulip: 'Tulip', sunflower: 'Sunflower', rose: 'Rose', bluebell: 'Bluebell', lily: 'Lily' };
  const STAGE_TEXT = ['a sprout', 'small', 'medium', 'full-grown'];
  const name = (p: PotPlant) => `${p.shiny ? 'Shiny ' : ''}${KIND_NAME[p.kind]}${p.course ? ` from ${p.course}` : ''}`;
  const describe = (p: PotPlant) => `${name(p)}, ${STAGE_TEXT[p.stage]}, ${p.need ? NEED_TEXT[p.need] : 'resting'}`;
  const restLeft = (p: PotPlant) => Math.max(1, Math.round((p.needAt - store.now.getTime()) / 60_000));

  type Tool = 'auto' | Need | 'seed' | 'barrow';
  let tool = $state<Tool>('auto');
  let view = $state<'patio' | 'tree'>('patio');
  let reaction = $state('');
  let dancing = $state<Record<number, number>>({});
  let shaking = $state<number | null>(null);
  let hoverPot = $state<number | null>(null);
  interface Fx {
    id: number;
    pot: number;
    kind: 'water' | 'fert' | 'spray' | 'music' | 'sparkle' | 'pop';
    text?: string;
  }
  let fx = $state<Fx[]>([]);
  interface Coin {
    id: string;
    pot: number;
    amount: number;
    slot: number; // coins from the same pot fan out along the patio
    gone?: boolean;
  }
  let coins = $state<Coin[]>([]);
  let fxId = 1;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (f: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.delete(t);
      f();
    }, ms);
    timers.add(t);
  };
  function burst(pot: number, kind: Fx['kind'], text?: string) {
    const id = fxId++;
    fx = [...fx, { id, pot, kind, text }];
    later(() => (fx = fx.filter((x) => x.id !== id)), kind === 'pop' ? 1100 : 900);
  }
  function dance(pot: number) {
    dancing = { ...dancing, [pot]: (dancing[pot] ?? 0) + 1 };
    later(() => {
      const d = { ...dancing };
      delete d[pot];
      dancing = d;
    }, 950);
  }
  function shake(pot: number) {
    shaking = pot;
    later(() => (shaking = null), 500);
  }

  // ---------- coins: dropped by happy plants, tapped (or collected by Stinky) into the wallet ----------
  const pending = $derived(coins.filter((c) => !c.gone).reduce((a, c) => a + c.amount, 0));
  const jarLeft = $derived(coinsLeftToday(paidToday + pending));
  function drop(pot: number, amount: number) {
    const value = Math.min(amount, jarLeft);
    if (value <= 0) {
      burst(pot, 'sparkle');
      return;
    }
    const id = `${Date.now().toString(36)}-${pot}-${fxId++}`;
    const slot = coins.filter((c) => c.pot === pot && !c.gone).length;
    coins = [...coins, { id, pot, amount: value, slot }];
    if (awake) later(() => collect(id, true), 2200);
  }
  function collect(id: string, bySnail = false) {
    const c = coins.find((x) => x.id === id && !x.gone);
    if (!c) return;
    coins = coins.map((x) => (x.id === id ? { ...x, gone: true } : x));
    later(() => (coins = coins.filter((x) => x.id !== id)), 700);
    economy.earn(c.amount, LEDGER_REASON, id);
    burst(c.pot, 'pop', `+${c.amount} 🪙`);
    playSound('pop');
    if (bySnail) reaction = `Stinky slurped up ${c.amount} coin${c.amount === 1 ? '' : 's'} 🐌`;
  }
  onDestroy(() => {
    // nothing is lost by leaving: whatever's still on the patio goes straight to the wallet
    for (const c of coins) if (!c.gone) economy.earn(c.amount, LEDGER_REASON, c.id);
    for (const t of timers) clearTimeout(t);
  });

  // ---------- tending ----------
  function potClick(i: number) {
    const p = garden.pots[i];
    if (!p) {
      if (tool === 'auto' || tool === 'seed') plantHere(i);
      else reaction = 'An empty pot. Tap it with a seed packet to plant one.';
      return;
    }
    if (tool === 'seed') {
      reaction = `That pot has ${name(p)} in it already.`;
      shake(i);
      return;
    }
    if (tool === 'barrow') {
      if (p.stage < GROWN) {
        reaction = `${name(p)} isn't full-grown yet: only grown plants ride the wheelbarrow.`;
        shake(i);
        return;
      }
      garden = toMeadow(garden, i);
      persist();
      playSound('pop');
      reaction = `${name(p)} is off to the meadow 🌾`;
      return;
    }
    if (!p.need) {
      reaction = `${name(p)} is resting. It'll want something in about ${restLeft(p)} min.`;
      dance(i);
      return;
    }
    const use = tool === 'auto' ? p.need : tool;
    if (use !== p.need) {
      reaction = `${name(p)} ${NEED_TEXT[p.need]} ${NEED_EMOJI[p.need]}`;
      shake(i);
      return;
    }
    apply(i, p.need);
  }
  function apply(i: number, need: Need): boolean {
    const p = garden.pots[i]!;
    if (need === 'fertilizer' && shed.fertilizer <= 0) {
      reaction = 'Out of fertilizer. Finish a task for a bag, or buy one in the garden shop.';
      shake(i);
      return false;
    }
    if (need === 'spray' && shed.spray <= 0) {
      reaction = 'Out of bug spray. Every third finished task drops one, or buy some in the garden shop.';
      shake(i);
      return false;
    }
    if (need === 'music' && !hasPhonograph) {
      reaction = `${name(p)} wants music. The phonograph is in the garden shop.`;
      shake(i);
      return false;
    }
    const r = tend(garden, i, need, Date.now());
    if (!r.ok) return false;
    garden = r.garden;
    persist();
    burst(i, need === 'fertilizer' ? 'fert' : need);
    dance(i);
    drop(i, r.coins);
    if (r.grown) {
      burst(i, 'sparkle');
      playSound('badge');
      toasts.push({ message: `${name(p)} is full-grown!`, detail: 'It drops a coin every time you water it now.', kind: 'success', emoji: '🌼' });
      reaction = `${name(p)} opened up! 🌼`;
    } else {
      playSound('pop');
      reaction =
        need === 'water'
          ? `${name(p)} drinks up 💧`
          : need === 'fertilizer'
            ? `${name(p)} grew a size 🌱`
            : need === 'spray'
              ? `Bugs shooed off ${name(p)} 🧴`
              : `${name(p)} hums along 🎵`;
    }
    return true;
  }
  function plantHere(i: number) {
    if (!nextSeed) {
      reaction = 'No seed packets left. Every finished task drops one.';
      return;
    }
    const seed = nextSeed;
    garden = plantSeedIn(garden, i, seed, Date.now());
    persist();
    playSound('pop');
    burst(i, 'fert');
    reaction = `Planted a ${seed.shiny ? 'shiny ' : ''}${KIND_NAME[seed.kind].toLowerCase()}${seed.course ? ` from ${seed.course}` : ''}. It's thirsty!`;
  }
  function waterAll() {
    const pots = thirsty(garden);
    if (!pots.length) {
      reaction = 'Nobody is thirsty right now.';
      return;
    }
    for (const i of pots) apply(i, 'water');
    reaction = `The golden can watered ${pots.length} plant${pots.length === 1 ? '' : 's'} 🏺`;
  }
  function feedStinky() {
    if (shed.chocolate <= 0) {
      reaction = awake ? 'Stinky is awake and on coin duty 🐌' : 'Stinky is asleep. A bar of chocolate (garden shop) wakes him for an hour.';
      return;
    }
    garden = feedSnail(garden, Date.now());
    persist();
    playSound('pop');
    reaction = 'Stinky munches the chocolate and gets to work 🍫🐌';
    for (const c of coins) if (!c.gone) later(() => collect(c.id, true), 1200);
  }
  function pick(t: Tool) {
    tool = tool === t ? 'auto' : t;
  }
  function buy(item: ShopEntry) {
    if (economy.wallet.coins < item.price) {
      toasts.push({ message: `Needs ${item.price} coins`, detail: 'Finish a task to earn more.', kind: 'warn', emoji: '🪙' });
      return;
    }
    const reason = shopReason(item.id);
    store.addLedger(
      item.tool
        ? [
            { currency: 'coins', amount: -item.price, reason },
            { currency: `item:garden-${item.id}`, amount: 1, reason },
          ]
        : [{ currency: 'coins', amount: -item.price, reason }],
    );
    playSound('pop');
    reaction = `Bought ${item.name.toLowerCase()} ${item.emoji}`;
  }

  // ---------- the tree ----------
  let wisdom = $state('');
  let treePulse = $state(0);
  const milestone = $derived(nextMilestone(garden.tree.height));
  function feedTheTree() {
    if (shed.treeFood <= 0) {
      wisdom = 'The tree is hungry. Every finished task drops tree food, and the garden shop sells it.';
      return;
    }
    const leaf = seeds[garden.used.treeFood]?.color ?? '#f5c542';
    garden = feedTree(garden, leaf);
    persist();
    treePulse++;
    const h = garden.tree.height;
    wisdom = wisdomFor(h, seeds.length);
    const m = treeUnlocks(h).find((x) => x.feet === h);
    if (m) {
      playSound('badge');
      toasts.push({ message: `The tree is ${h} ft tall`, detail: m.unlock, kind: 'badge', emoji: m.emoji, timeout: 5000 });
    } else playSound('pop');
  }
  const coinX = (c: Coin) => potX(c.pot) + 26 - (c.slot % 3) * 26;
  const coinY = (c: Coin) => potY(c.pot) + 12 + Math.floor(c.slot / 3) * 8;
  const bubbleY = (p: PotPlant) => -([20, 32, 48, 64][p.stage] * PLANT_SCALE + 6); // beside the head
</script>

<p class="summary" data-garden-summary>
  <strong
    >{#key seeds.length}<span class="grad-text bump">{seeds.length}</span>{/key}</strong
  >
  task{seeds.length === 1 ? '' : 's'} finished ·
  <strong
    >{#key grownCount}<span class="gold-text bump">{grownCount}</span>{/key}</strong
  >
  full-grown{#if garden.meadow.length}
    · {garden.meadow.length} in the meadow{/if}
  · tree {garden.tree.height} ft
</p>

<div class="switch" role="group" aria-label="Garden view">
  <button class="btn sm" class:primary={view === 'patio'} aria-pressed={view === 'patio'} onclick={() => (view = 'patio')}>🪴 Patio</button>
  <button class="btn sm" class:primary={view === 'tree'} aria-pressed={view === 'tree'} onclick={() => (view = 'tree')}>🌳 Tree of Wisdom</button>
</div>

{#if view === 'patio'}
  <div class="card scene-card" data-daylight={light}>
    <svg viewBox="0 0 {W} {H}" class="scene" role="group" aria-label="Garden patio: {planted} of {POTS} pots planted">
      <defs>
        <linearGradient id="gd-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color={SKY_COLORS[light][0]} /><stop offset="1" stop-color={SKY_COLORS[light][1]} />
        </linearGradient>
        <pattern id="gd-tiles" width="50" height="34" patternUnits="userSpaceOnUse">
          <rect width="50" height="34" fill="#c9825a" />
          <rect x="1" y="1" width="48" height="32" rx="3" fill="#d99367" />
          <rect x="1" y="1" width="48" height="10" rx="3" fill="rgba(255,255,255,0.12)" />
        </pattern>
        <linearGradient id="gd-pot" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#a0522d" /><stop offset="0.45" stop-color="#d2691e" /><stop offset="1" stop-color="#8b4513" />
        </linearGradient>
        <linearGradient id="gd-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffe08a" /><stop offset="0.5" stop-color="#f5c542" /><stop offset="1" stop-color="#c58a12" />
        </linearGradient>
        <radialGradient id="gd-sun"
          ><stop offset="0" stop-color="#fff5b8" /><stop offset="0.5" stop-color="#ffd166" stop-opacity="0.6" /><stop
            offset="1"
            stop-color="#ffd166"
            stop-opacity="0"
          /></radialGradient
        >
      </defs>
      <!-- sky, sun or moon, clouds, bushes and a picket fence -->
      <rect width={W} height={SKY} fill="url(#gd-sky)" />
      {#if light === 'night'}
        {#each Array.from({ length: 18 }, (_, i) => i) as i (i)}<circle
            cx={(i * 131 + 17) % W}
            cy={((i * 37) % 60) + 6}
            r={0.8 + (i % 3) * 0.5}
            fill="#fff"
            class="star"
            style="animation-delay:{(i % 5) * 0.4}s"
          />{/each}
        <circle cx={W - 70} cy="34" r="16" fill="#fff7cc" /><circle cx={W - 77} cy="30" r="14" fill="#1a2447" />
      {:else}
        <circle cx={W - 80} cy="30" r="60" fill="url(#gd-sun)" class="sun" />
        <circle cx={W - 80} cy="30" r="20" fill="#fff3a6" class="sun" />
      {/if}
      {#each [0.15, 0.5] as k, i (k)}
        <g class="cloud" style="animation-delay:{i * -7}s" opacity={light === 'night' ? 0.25 : 0.9}>
          <ellipse cx={W * k} cy="34" rx="34" ry="12" fill="#fff" /><ellipse cx={W * k - 22} cy="40" rx="22" ry="10" fill="#fff" /><ellipse
            cx={W * k + 24}
            cy="40"
            rx="24"
            ry="9"
            fill="#fff"
          />
        </g>
      {/each}
      {#each Array.from({ length: Math.ceil(W / 70) }, (_, i) => i) as i (i)}<ellipse
          cx={i * 70 + 30}
          cy={SKY - 40}
          rx="42"
          ry="20"
          fill={light === 'night' ? '#1f5a2e' : '#3f9a45'}
        />{/each}
      <rect x="0" y={SKY - 34} width={W} height="4" fill="#e8e2d0" />
      <rect x="0" y={SKY - 14} width={W} height="4" fill="#e8e2d0" />
      {#each Array.from({ length: Math.floor(W / 20) }, (_, i) => i) as i (i)}
        <path d="M{i * 20 + 4} {SKY} v -44 l 6 -7 l 6 7 v 44 z" fill={i % 2 ? '#f7f3e8' : '#ece6d6'} stroke="#cfc6ad" stroke-width="0.6" />
      {/each}
      <!-- the patio -->
      <rect x="0" y={SKY} width={W} height={H - SKY} fill="url(#gd-tiles)" />
      <rect x="0" y={SKY} width={W} height={H - SKY} fill={light === 'night' ? 'rgba(10,16,48,0.45)' : light === 'dusk' ? 'rgba(120,40,90,0.18)' : 'rgba(0,0,0,0)'} />

      {#each Array.from({ length: POTS }, (_, i) => i) as i (i)}
        {@const p = garden.pots[i]}
        {@const cx = potX(i)}
        {@const cy = potY(i)}
        <g class="pot" class:shaking={shaking === i} class:hover={hoverPot === i} aria-hidden="true">
          <ellipse {cx} cy={cy + 30} rx="30" ry="6" fill="rgba(0,0,0,0.22)" />
          <path d="M{cx - 25} {cy + 2} l 4 28 h 42 l 4 -28 z" fill="url(#gd-pot)" />
          <rect
            x={cx - 29}
            y={cy - 6}
            width="58"
            height="9"
            rx="2"
            fill={p?.shiny ? 'url(#gd-gold)' : '#b5541f'}
            stroke={p?.shiny ? '#a97300' : 'rgba(0,0,0,0.25)'}
            stroke-width="0.8"
          />
          <ellipse {cx} cy={cy - 1} rx="24" ry="5" fill="#5b3a21" />
          <ellipse {cx} cy={cy - 2} rx="20" ry="3" fill="#6f4a2a" />
          {#if !p}
            <text x={cx} y={cy - 14} text-anchor="middle" font-size="12" class="hint">{nextSeed ? '🌰 plant' : ''}</text>
          {:else}
            <g transform="translate({cx} {cy - 2})">
              <g transform="scale({PLANT_SCALE})"><PlantSprite plant={p} dance={!!dancing[i]} /></g>
              {#if p.need === 'spray'}
                {#each [-10, 6] as dx, k (dx)}<g transform="translate({dx} {-18 - k * 12})"
                    ><g class="bug" style="animation-delay:{k * 0.6}s"><ellipse rx="3.4" ry="2.4" fill="#2b2b2b" /><circle cx="2.6" cy="-0.6" r="0.6" fill="#fff" /></g></g
                  >{/each}
              {/if}
              {#if p.need}
                <g transform="translate(30 {bubbleY(p)})"
                  ><g class="bubble">
                    <path
                      d="M-14 -13 h 28 a 6 6 0 0 1 6 6 v 14 a 6 6 0 0 1 -6 6 h -12 l -6 6 v -6 h -10 a 6 6 0 0 1 -6 -6 v -14 a 6 6 0 0 1 6 -6 z"
                      fill="#fff"
                      stroke="rgba(0,0,0,0.2)"
                    />
                    <text x="0" y="6" text-anchor="middle" font-size="15">{NEED_EMOJI[p.need]}</text>
                  </g></g
                >
              {/if}
            </g>
          {/if}
        </g>
      {/each}

      <!-- effects: water, fertilizer sparkle, spray puffs, notes, coin pops -->
      {#each fx as f (f.id)}
        {@const cx = potX(f.pot)}
        {@const cy = potY(f.pot)}
        <g class="fx" transform="translate({cx} {cy})" pointer-events="none">
          {#if f.kind === 'water'}
            <g class="can"><path d="M-30 -80 h 20 v 14 h -20 z M-10 -76 l 12 6 M-30 -74 a 6 6 0 0 0 -8 6" fill="#4ea8de" stroke="#1d6fa3" stroke-width="2" /></g>
            {#each [-12, -6, 0, 6, 12] as dx, k (dx)}<path d="M{dx} -60 q 3 4 0 8 q -3 -4 0 -8" fill="#5fb8ff" class="drop" style="animation-delay:{k * 0.08}s" />{/each}
          {:else if f.kind === 'fert'}
            {#each [-14, -5, 4, 13] as dx, k (dx)}<circle cx={dx} cy="-10" r="3" fill="#7be27b" class="rise" style="animation-delay:{k * 0.1}s" />{/each}
          {:else if f.kind === 'spray'}
            {#each [-12, 0, 12] as dx, k (dx)}<circle cx={dx} cy="-30" r="8" fill="#fff" opacity="0.8" class="puff" style="animation-delay:{k * 0.08}s" />{/each}
          {:else if f.kind === 'music'}
            {#each ['♪', '♫', '♪'] as n, k (k)}<text x={-14 + k * 14} y="-40" font-size="16" fill="#6c5ce7" class="rise" style="animation-delay:{k * 0.15}s">{n}</text>{/each}
          {:else if f.kind === 'sparkle'}
            {#each Array.from({ length: 8 }, (_, k) => k) as k (k)}
              <g transform="translate(0 -40)"
                ><path
                  d="M0 -6 l 1.6 -4.4 l 1.6 4.4 l 4.4 1.6 l -4.4 1.6 l -1.6 4.4 l -1.6 -4.4 l -4.4 -1.6 z"
                  fill="#ffe08a"
                  class="spark"
                  style="--a:{k * 45}deg; animation-delay:{k * 0.04}s"
                /></g
              >
            {/each}
          {:else}
            <text x="0" y="-70" text-anchor="middle" font-size="16" font-weight="900" fill="#3a2a00" stroke="#ffe08a" stroke-width="3" paint-order="stroke" class="rise"
              >{f.text}</text
            >
          {/if}
        </g>
      {/each}

      <!-- coins waiting to be tapped -->
      {#each coins as c (c.id)}
        <g class="coin" transform="translate({coinX(c)} {coinY(c)})" aria-hidden="true">
          <g class="coin-body" class:gone={c.gone}>
            <g class="spin">
              <circle r="11" fill="url(#gd-gold)" stroke="#a97300" stroke-width="1.5" />
              <circle r="7" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1.2" />
              <text y="4.5" text-anchor="middle" font-size="11" font-weight="900" fill="#7a4e00">{c.amount > 1 ? c.amount : '★'}</text>
            </g>
          </g>
        </g>
      {/each}

      <!-- Stinky the snail -->
      <g class="snail" style="--travel:{W - 90}px" transform="translate(30 {H - 10})" aria-hidden="true">
        <g class="snail-body" class:awake>
          <ellipse cx="12" cy="1" rx="22" ry="3" fill="rgba(0,0,0,0.2)" />
          <path d="M-8 0 q 6 -14 30 -8 q 8 2 6 8 z" fill="#c9b458" stroke="#8c7a2b" />
          <circle cx="4" cy="-14" r="13" fill="#b5651d" stroke="#6b3a10" stroke-width="1.5" />
          <path d="M4 -14 m -8 0 a 8 8 0 1 1 8 8 a 5 5 0 1 1 5 -5 a 2.5 2.5 0 1 1 -2.5 -2.5" fill="none" stroke="#6b3a10" stroke-width="1.6" />
          <line x1="22" y1="-8" x2="27" y2="-20" stroke="#8c7a2b" stroke-width="2" /><line x1="26" y1="-8" x2="32" y2="-18" stroke="#8c7a2b" stroke-width="2" />
          {#if awake}
            <circle cx="27" cy="-21" r="3" fill="#fff" /><circle cx="32" cy="-19" r="3" fill="#fff" />
            <circle cx="27.6" cy="-21" r="1.4" fill="#2b2b2b" /><circle cx="32.6" cy="-19" r="1.4" fill="#2b2b2b" />
          {:else}
            <path d="M24 -21 q 3 2 6 0 M29 -19 q 3 2 6 0" stroke="#2b2b2b" stroke-width="1.4" fill="none" stroke-linecap="round" />
            <text x="34" y="-30" font-size="11" font-weight="700" fill="#5b6270" class="zzz">z z</text>
          {/if}
        </g>
      </g>

      <!-- hit areas on top: still while the art underneath sways, spins and crawls -->
      {#each Array.from({ length: POTS }, (_, i) => i) as i (i)}
        {@const p = garden.pots[i]}
        <rect
          class="hit"
          x={potX(i) - CW / 2}
          y={potY(i) - 104}
          width={CW}
          height={CH}
          rx="10"
          role="button"
          tabindex="0"
          aria-label="Pot {i + 1}: {p ? describe(p) : 'empty'}"
          onclick={() => potClick(i)}
          onpointerenter={() => (hoverPot = i)}
          onpointerleave={() => (hoverPot = null)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              potClick(i);
            }
          }}
        />
      {/each}
      {#each coins.filter((c) => !c.gone) as c (c.id)}
        <circle
          class="hit"
          cx={coinX(c)}
          cy={coinY(c)}
          r="16"
          role="button"
          tabindex="0"
          aria-label="Collect {c.amount} coin{c.amount === 1 ? '' : 's'}"
          onclick={() => collect(c.id)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              collect(c.id);
            }
          }}
        />
      {/each}
      <rect
        class="hit"
        x="0"
        y={H - FOOT}
        width={W}
        height={FOOT}
        role="button"
        tabindex="0"
        aria-label="Stinky the snail, {awake ? 'awake and collecting coins' : 'asleep'}. Chocolate: {shed.chocolate}"
        onclick={feedStinky}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            feedStinky();
          }
        }}
      />
    </svg>
  </div>
  <p class="react" aria-live="polite" data-garden-reaction>
    {#key reaction}<span class="rise-in">{reaction}</span>{/key}
  </p>

  <section class="card">
    <h3>Tools <span class="muted">tap a pot to do what it needs, or pick a tool first</span></h3>
    <div class="toolbar" role="group" aria-label="Garden tools">
      <button class="tool" class:on={tool === 'seed'} aria-pressed={tool === 'seed'} onclick={() => pick('seed')} aria-label="Seed packets: {shed.seeds}">
        <span class="te" aria-hidden="true">🌰</span><span>Seed packets</span><span class="n" data-seeds>{shed.seeds}</span>
      </button>
      <button class="tool" class:on={tool === 'water'} aria-pressed={tool === 'water'} onclick={() => pick('water')} aria-label="Watering can">
        <span class="te" aria-hidden="true">🚿</span><span>Watering can</span><span class="n">∞</span>
      </button>
      <button class="tool" class:on={tool === 'fertilizer'} aria-pressed={tool === 'fertilizer'} onclick={() => pick('fertilizer')} aria-label="Fertilizer: {shed.fertilizer}">
        <span class="te" aria-hidden="true">🌱</span><span>Fertilizer</span><span class="n" data-fertilizer>{shed.fertilizer}</span>
      </button>
      <button class="tool" class:on={tool === 'spray'} aria-pressed={tool === 'spray'} onclick={() => pick('spray')} aria-label="Bug spray: {shed.spray}">
        <span class="te" aria-hidden="true">🧴</span><span>Bug spray</span><span class="n">{shed.spray}</span>
      </button>
      <button
        class="tool"
        class:on={tool === 'music'}
        aria-pressed={tool === 'music'}
        onclick={() => pick('music')}
        aria-label="Phonograph{hasPhonograph ? '' : ', not owned'}"
        disabled={!hasPhonograph}
      >
        <span class="te" aria-hidden="true">📻</span><span>Phonograph</span><span class="n">{hasPhonograph ? '♪' : '🔒'}</span>
      </button>
      <button
        class="tool"
        class:on={tool === 'barrow'}
        aria-pressed={tool === 'barrow'}
        onclick={() => pick('barrow')}
        aria-label="Wheelbarrow: move a full-grown plant to the meadow"
      >
        <span class="te" aria-hidden="true">🛒</span><span>Wheelbarrow</span><span class="n">{grownCount}</span>
      </button>
      <button class="tool" onclick={feedStinky} aria-label="Chocolate for Stinky: {shed.chocolate}">
        <span class="te" aria-hidden="true">🍫</span><span>Chocolate</span><span class="n">{shed.chocolate}</span>
      </button>
      {#if hasGoldenCan}
        <button class="tool gold" onclick={waterAll} aria-label="Golden watering can: water every thirsty plant">
          <span class="te" aria-hidden="true">🏺</span><span>Water all</span><span class="n">{thirsty(garden).length}</span>
        </button>
      {/if}
    </div>
    <div class="jar">
      <span>Coin jar today</span>
      <span class="bar" role="progressbar" aria-label="Garden coins today" aria-valuemin="0" aria-valuemax={GARDEN_DAILY_MAX} aria-valuenow={paidToday}
        ><span class="fill" style="width:{(Math.min(GARDEN_DAILY_MAX, paidToday) / GARDEN_DAILY_MAX) * 100}%"></span></span
      >
      <span class="num"
        >{#key paidToday}<span class="bump">{paidToday}</span>{/key} / {GARDEN_DAILY_MAX}</span
      >
    </div>
  </section>

  <section class="card">
    <h3>Garden shop <span class="muted">coins from schoolwork</span></h3>
    <div class="shop">
      {#each GARDEN_SHOP as item (item.id)}
        {@const have = item.tool && (item.id === 'phonograph' ? hasPhonograph : hasGoldenCan)}
        <button
          class="tool buy"
          class:owned={have}
          onclick={() => buy(item)}
          disabled={have || economy.wallet.coins < item.price}
          aria-label="Buy {item.name} for {item.price} coins"
        >
          <span class="te" aria-hidden="true">{item.emoji}</span>
          <span class="name">{item.name}</span>
          <span class="muted">{item.blurb}</span>
          <span class="price">{have ? 'Owned ✓' : `${item.price} 🪙`}</span>
        </button>
      {/each}
    </div>
  </section>

  {#if garden.meadow.length}
    <section class="card">
      <h3>The meadow <span class="muted">{garden.meadow.length} plant{garden.meadow.length === 1 ? '' : 's'} retired here</span></h3>
      <svg viewBox="0 0 {Math.max(300, Math.min(garden.meadow.length, 40) * 26 + 20)} 110" class="meadow" role="img" aria-label="{garden.meadow.length} plants in the meadow">
        <rect width="100%" height="110" rx="10" fill="#7bc47f" opacity="0.35" />
        {#each garden.meadow.slice(-40) as m, i (i)}
          <g transform="translate({20 + i * 26} {102 - (i % 3) * 6})">
            <PlantSprite plant={{ id: `m${i}`, kind: m.kind, color: m.color, shiny: false, stage: GROWN, plantedAt: 0, need: null, needAt: 0, tended: i }} />
          </g>
        {/each}
      </svg>
    </section>
  {/if}
{:else}
  <div class="card scene-card tree-card" data-daylight={light}>
    <WisdomTree height={garden.tree.height} leaves={garden.tree.leaves} {season} daylight={light} pulse={treePulse} />
  </div>
  <section class="card tree-panel">
    <div class="tree-head">
      <div>
        <h3>The Tree of Wisdom</h3>
        <p class="muted">
          {#key garden.tree.height}<strong class="ft bump" data-tree-height>{garden.tree.height} ft</strong>{/key}
          {#if milestone}
            · {milestone.feet - garden.tree.height} more to go for {milestone.unlock.toLowerCase()} {milestone.emoji}{:else}· as tall as a tree gets{/if}
        </p>
      </div>
      <button class="btn primary feed" onclick={feedTheTree} disabled={shed.treeFood <= 0} aria-label="Feed the tree (tree food: {shed.treeFood})"
        >🍯 Feed the tree <span class="n">{shed.treeFood}</span></button
      >
    </div>
    <p class="wisdom" aria-live="polite" data-wisdom>
      {#key wisdom}<span class="rise-in"
          >{wisdom ||
            (garden.tree.height
              ? 'Feed the tree and it shares a thought.'
              : 'A seedling on a hill. Every finished task drops tree food; each feeding is a foot of growth and a line of wisdom.')}</span
        >{/key}
    </p>
    <ul class="milestones">
      {#each treeUnlocks(garden.tree.height) as m (m.feet)}<li class="got">{m.emoji} {m.unlock} <span class="muted">{m.feet} ft</span></li>{/each}
      {#if milestone}<li class="next">{milestone.emoji} {milestone.unlock} <span class="muted">at {milestone.feet} ft</span></li>{/if}
    </ul>
  </section>
{/if}

<p class="muted foot">
  Every finished task drops a seed packet, a bag of fertilizer and tree food; every third one drops bug spray. Plants grow a size per bag and drop coins when they're happy (up to {GARDEN_DAILY_MAX}
  a day). Undoing a completion takes its care pack back. The garden is saved on this device; coins and the shop go through your wallet. The Nature theme's arcade game is Fishing.
</p>

<style>
  .summary {
    margin: 0 0 10px;
    font-variant-numeric: tabular-nums;
  }
  .summary strong {
    font-size: 18px;
    font-weight: 900;
  }
  .switch {
    display: flex;
    gap: 6px;
    margin-bottom: 10px;
  }
  /* the scene: a card whose glow follows the time of day */
  .scene-card {
    position: relative;
    padding: 6px;
    overflow: hidden;
    margin-bottom: 8px;
    --sky: #8fd3ff;
    border-color: color-mix(in srgb, var(--sky) 45%, var(--border));
    box-shadow:
      var(--shadow-sm),
      0 0 40px -12px color-mix(in srgb, var(--sky) 70%, transparent);
    animation: pop-in var(--dur-slow) var(--spring) backwards;
  }
  .scene-card[data-daylight='dawn'] {
    --sky: #ffb88c;
  }
  .scene-card[data-daylight='dusk'] {
    --sky: #ff9a5c;
  }
  .scene-card[data-daylight='night'] {
    --sky: #4c6ed6;
  }
  .scene {
    display: block;
    width: 100%;
    border-radius: var(--radius);
    user-select: none;
    -webkit-user-select: none;
  }
  .sun {
    transform-box: fill-box;
    transform-origin: center;
    animation: sun-breathe 6s ease-in-out infinite;
  }
  .star {
    animation: twinkle 2.4s ease-in-out infinite;
  }
  .cloud {
    animation: drift 16s ease-in-out infinite alternate;
  }
  .hit {
    fill: transparent;
    cursor: pointer;
    outline: none;
  }
  .hit:focus-visible {
    stroke: var(--accent);
    stroke-width: 3;
  }
  .pot.hover path {
    filter: brightness(1.12);
  }
  .pot.shaking {
    animation: shake 0.45s;
  }
  .hint {
    fill: rgba(255, 255, 255, 0.9);
    font-weight: 800;
    paint-order: stroke;
    stroke: rgba(0, 0, 0, 0.35);
    stroke-width: 2px;
    animation: float 2.4s ease-in-out infinite;
  }
  .bubble {
    animation: bob 1.8s ease-in-out infinite;
  }
  .bug {
    animation: crawl 1.6s ease-in-out infinite alternate;
  }
  /* effects */
  .drop {
    animation: drop 0.7s ease-in forwards;
  }
  .can {
    transform-box: fill-box;
    transform-origin: right center;
    animation: tip 0.8s ease-in-out forwards;
  }
  .rise {
    animation: rise 0.9s ease-out forwards;
  }
  .puff {
    transform-box: fill-box;
    transform-origin: center;
    animation: puff 0.8s ease-out forwards;
  }
  .spark {
    transform-box: fill-box;
    transform-origin: center;
    animation: spark 0.85s ease-out forwards;
  }
  /* coins bounce out of the pot, spin while they wait, and fly up when taken */
  .coin {
    filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.35)) drop-shadow(0 0 8px rgba(255, 224, 138, 0.7));
  }
  .coin-body {
    transform-box: fill-box;
    transform-origin: center;
    animation: coin-drop 0.6s var(--spring);
  }
  .coin .spin {
    transform-box: fill-box;
    transform-origin: center;
    animation: coin-spin 1.4s linear infinite;
  }
  .coin-body.gone {
    animation: coin-take 0.65s ease-in forwards;
    pointer-events: none;
  }
  .snail-body.awake {
    animation: crawl-patio 26s linear infinite alternate;
  }
  .zzz {
    animation: float 2.4s ease-in-out infinite;
  }
  .react {
    min-height: 18px;
    font-size: 13px;
    font-weight: 700;
    margin: 0 0 10px;
    color: var(--accent-text);
  }
  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 10px;
    font-size: 15px;
    font-weight: 800;
    flex-wrap: wrap;
  }
  h3::before {
    content: '';
    width: 4px;
    height: 16px;
    border-radius: 2px;
    background: var(--grad-accent);
    box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 50%, transparent);
    flex-shrink: 0;
  }
  h3 .muted {
    font-weight: 500;
  }
  .card {
    margin-bottom: 10px;
  }
  /* chunky tool tiles with an emoji badge; the picked tool glows */
  .toolbar,
  .shop {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
    gap: 8px;
  }
  .shop {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
  .tool {
    display: grid;
    justify-items: start;
    gap: 2px;
    text-align: start;
    height: auto;
    padding: 10px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    color: var(--text);
    font-weight: 700;
    font-size: 13px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--bg-hover) 55%, var(--bg-elev)), var(--bg-elev));
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow-sm);
    white-space: normal;
    transition:
      transform var(--dur) var(--spring),
      box-shadow var(--dur),
      border-color var(--dur);
  }
  .tool:not(:disabled):hover {
    border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
    transform: translateY(-2px);
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow),
      var(--glow);
  }
  .tool:not(:disabled):hover .te {
    transform: scale(1.2) rotate(-8deg);
  }
  .tool:not(:disabled):active {
    transform: translateY(0) scale(0.97);
  }
  .tool.on {
    border-color: var(--accent);
    box-shadow:
      inset 0 0 0 1px var(--accent),
      var(--glow-strong);
  }
  .tool.gold {
    background: var(--grad-gold);
    color: #3a2a00;
  }
  .tool:disabled {
    opacity: 0.6;
  }
  .tool.owned {
    background: color-mix(in srgb, var(--gold) 18%, var(--bg-elev));
    border-color: color-mix(in srgb, var(--gold) 50%, var(--border));
    opacity: 1;
  }
  .te {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 11px;
    font-size: 22px;
    margin-bottom: 2px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 24%, transparent), color-mix(in srgb, var(--accent-2) 10%, transparent));
    border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
    filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.25));
    transition: transform var(--dur-slow) var(--spring);
  }
  .tool .n {
    font-variant-numeric: tabular-nums;
    font-weight: 900;
    color: var(--accent-text);
  }
  .tool .price {
    font-weight: 900;
    color: var(--accent-text);
  }
  .tool.owned .price {
    color: var(--warn-text);
  }
  .tool .muted {
    font-weight: 500;
  }
  .jar {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 10px;
    align-items: center;
    margin-top: 12px;
    font-size: 13px;
    font-weight: 700;
  }
  .bar {
    height: 12px;
    border-radius: 999px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
    overflow: hidden;
  }
  .fill {
    position: relative;
    display: block;
    height: 100%;
    border-radius: 999px;
    background: var(--grad-gold);
    box-shadow: 0 0 12px -2px rgba(245, 197, 66, 0.8);
    transition: width var(--dur-slow) var(--spring);
  }
  .fill::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.45) 50%, transparent 100%);
    background-size: 200% 100%;
    animation: shimmer 2.6s linear infinite;
  }
  .num {
    font-variant-numeric: tabular-nums;
    font-weight: 900;
  }
  .meadow {
    display: block;
    width: 100%;
    max-height: 160px;
  }
  .tree-card {
    padding: 0;
  }
  .tree-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .tree-head h3 {
    margin-bottom: 4px;
  }
  .tree-head p {
    margin: 0;
  }
  .ft {
    font-size: 20px;
    font-weight: 900;
    color: var(--success-text);
  }
  .feed {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    animation: glow-pulse 2.4s ease-in-out infinite;
  }
  .feed:disabled {
    animation: none;
  }
  .feed .n {
    padding: 1px 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.25);
    font-variant-numeric: tabular-nums;
  }
  /* wisdom on a parchment strip */
  .wisdom {
    margin: 12px 0;
    padding: 12px 14px;
    border-radius: var(--radius);
    border: 1px solid color-mix(in srgb, var(--gold) 45%, var(--border));
    background: linear-gradient(180deg, color-mix(in srgb, var(--gold) 14%, var(--bg-elev)), var(--bg-elev));
    font-weight: 600;
    font-style: italic;
    min-height: 44px;
  }
  .milestones {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    font-size: 12px;
  }
  .milestones li {
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--bg-elev-2);
  }
  .milestones .got {
    border-color: color-mix(in srgb, var(--gold) 55%, var(--border));
    background: color-mix(in srgb, var(--gold) 16%, var(--bg-elev));
  }
  .milestones .next {
    border-style: dashed;
    color: var(--text-muted);
  }
  .muted {
    color: var(--text-muted);
    font-size: 12px;
  }
  .foot {
    margin-top: 4px;
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
  @keyframes twinkle {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 1;
    }
  }
  @keyframes drift {
    from {
      transform: translateX(-16px);
    }
    to {
      transform: translateX(16px);
    }
  }
  @keyframes bob {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-4px);
    }
  }
  @keyframes crawl {
    from {
      transform: translateX(-6px);
    }
    to {
      transform: translateX(6px);
    }
  }
  @keyframes drop {
    from {
      transform: translateY(0);
      opacity: 1;
    }
    to {
      transform: translateY(58px);
      opacity: 0;
    }
  }
  @keyframes tip {
    0% {
      transform: rotate(0) translateY(-10px);
      opacity: 0;
    }
    30% {
      transform: rotate(-25deg);
      opacity: 1;
    }
    100% {
      transform: rotate(-30deg);
      opacity: 0;
    }
  }
  @keyframes rise {
    from {
      transform: translateY(0);
      opacity: 1;
    }
    to {
      transform: translateY(-40px);
      opacity: 0;
    }
  }
  @keyframes puff {
    from {
      transform: scale(0.4);
      opacity: 0.9;
    }
    to {
      transform: scale(2.2);
      opacity: 0;
    }
  }
  @keyframes spark {
    from {
      transform: rotate(var(--a)) translateY(0) scale(0.4);
      opacity: 1;
    }
    to {
      transform: rotate(var(--a)) translateY(-34px) scale(1.2);
      opacity: 0;
    }
  }
  @keyframes coin-drop {
    0% {
      transform: translateY(-30px) scale(0.4);
      opacity: 0;
    }
    60% {
      transform: translateY(4px) scale(1.1);
    }
    100% {
      transform: none;
      opacity: 1;
    }
  }
  @keyframes coin-spin {
    0% {
      transform: scaleX(1);
    }
    50% {
      transform: scaleX(0.15);
    }
    100% {
      transform: scaleX(1);
    }
  }
  @keyframes coin-take {
    to {
      transform: translateY(-50px) scale(0.3);
      opacity: 0;
    }
  }
  @keyframes crawl-patio {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(var(--travel));
    }
  }
</style>
