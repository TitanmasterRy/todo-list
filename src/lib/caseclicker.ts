// Rules for Crate Rush (public/games/craterush.html), the arcade's crate-opening clicker.
// The game page is one self-contained file, so it carries a plain-JS copy of this module between its
// `logic:start` / `logic:end` markers (regenerate it with `node scripts/sync-craterush.mjs`);
// caseclicker.test.ts runs the same checks against both copies so they can't drift apart.
//
// Money is plain dollars. Every random choice takes an rng (mulberry32), so a seed replays the same drops.
// State changes happen in place on a State object; the page only draws it.

export type Rng = () => number;

export const SAVE_VERSION = 1;
export const INVENTORY_MAX = 2000;
/** Chance that a drop is a Tracked item (it counts your clicks while it's in the showcase). */
export const TRACKED_CHANCE = 0.1;
export const TRACKED_MULT = 1.5;
/** A Lucky key gives this many openings, each with this chance to move the drop up one rarity. */
export const LUCKY_PACK = 5;
export const LUCKY_BUMP = 0.35;
export const TRADE_UP_COUNT = 10;
/** Chance that a trade-up skips a rarity. */
export const TRADE_UP_JUMP = 0.05;
/** Upgrader: chance = EDGE × stake / target, never above MAX. */
export const UPGRADE_EDGE = 0.9;
export const UPGRADE_MAX = 0.8;
export const UPGRADE_STEPS = [1.5, 2, 3, 5, 10, 25];
export const OFFLINE_CAP = 4 * 3600;
export const OFFLINE_RATE = 0.5;
export const OFFLINE_MIN = 60;
export const BOOST_MS = 10 * 60 * 1000;
/** Completing a collection pays this many crate prices and adds a permanent income bonus. */
export const COLLECTION_REWARD = 25;
export const COLLECTION_BONUS = 0.05;
export const ACH_BONUS = 0.02;
export const STAR_BONUS = 0.1;
/** Rebirth stars: floor(sqrt(earned this run / REBIRTH_UNIT)). */
export const REBIRTH_UNIT = 1e6;
export const GRIP_BASE = 10;
export const GRIP_GROWTH = 1.16;
export const SYNERGY_BASE = 2000;
export const SYNERGY_GROWTH = 6;
export const SYNERGY_MAX = 10;
/** Each Synergy level adds this share of income per second to every click. */
export const SYNERGY_PCT = 0.01;
export const GEN_GROWTH = 1.15;
/** Owning this many of one income source doubles its output (each step). */
export const MILESTONES = [25, 50, 100, 150, 200, 250, 300, 400, 500];
export const SCORE_MAX = 999999999999;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const round2 = (x: number) => Math.round(x * 100) / 100;

// ---------- rarities, wear, items ----------
export interface Rarity {
  id: string;
  name: string;
  color: string;
  /** Chance per crate opening. */
  odds: number;
  /** Item value as a share of its crate's price. */
  mult: number;
}
export const RARITIES: Rarity[] = [
  { id: 'common', name: 'Common', color: '#b4bfcc', odds: 0.6, mult: 0.05 },
  { id: 'uncommon', name: 'Uncommon', color: '#7dd3fc', odds: 0.25, mult: 0.22 },
  { id: 'rare', name: 'Rare', color: '#3b82f6', odds: 0.1, mult: 1 },
  { id: 'epic', name: 'Epic', color: '#a855f7', odds: 0.035, mult: 4 },
  { id: 'legendary', name: 'Legendary', color: '#ec4899', odds: 0.011, mult: 15 },
  { id: 'mythic', name: 'Mythic', color: '#ef4444', odds: 0.0032, mult: 50 },
  { id: 'exotic', name: 'Exotic', color: '#fbbf24', odds: 0.0008, mult: 200 },
];
export const EXOTIC = RARITIES.length - 1;

export interface Wear {
  id: string;
  name: string;
  short: string;
  /** Upper bound of the wear value (exclusive); the lower bound is the previous tier's max. */
  max: number;
  /** Chance of this tier on a drop. */
  weight: number;
  mult: number;
}
export const WEARS: Wear[] = [
  { id: 'pristine', name: 'Pristine', short: 'PR', max: 0.07, weight: 0.03, mult: 1.5 },
  { id: 'polished', name: 'Polished', short: 'PO', max: 0.15, weight: 0.24, mult: 1.15 },
  { id: 'scuffed', name: 'Scuffed', short: 'SC', max: 0.38, weight: 0.33, mult: 1 },
  { id: 'weathered', name: 'Weathered', short: 'WE', max: 0.45, weight: 0.24, mult: 0.85 },
  { id: 'wrecked', name: 'Wrecked', short: 'WR', max: 1, weight: 0.16, mult: 0.7 },
];
/** Wear below this is "Flawless" and worth half as much again. */
export const FLAWLESS = 0.01;
/** Pattern seeds below this are "Prime" patterns, worth double. */
export const PRIME_SEEDS = 5;

export const KINDS: Record<string, string> = {
  blaster: 'Pulse Blaster',
  rifle: 'Rail Rifle',
  blade: 'Arc Blade',
  gloves: 'Nova Gloves',
  board: 'Hover Board',
  synth: 'Synth Keyboard',
  helmet: 'Visor Helm',
  drone: 'Drone Pal',
  sticker: 'Sticker',
  fox: 'Byte Fox',
  kicks: 'Grav Kicks',
  cans: 'Bass Cans',
};

export interface Crate {
  id: string;
  name: string;
  price: number;
  /** Box colours: main, dark, glow. */
  colors: string[];
  glyph: string;
}
export interface ItemDef {
  i: number;
  crate: number;
  rarity: number;
  kind: string;
  name: string;
  finish: string;
  colors: string[];
  base: number;
}
// [rarity, kind, name, finish, colours] per crate. Every crate has items at every rarity.
type Row = [number, string, string, string, string];
const CRATE_DATA: [string, string, number, string, string, Row[]][] = [
  [
    'neon',
    'Neon Alley',
    10,
    '#ff3cac #2b1055 #22d3ee',
    'bolt',
    [
      [0, 'blaster', 'Street Primer', 'solid', '#6b7280 #374151 #9ca3af'],
      [0, 'sticker', 'Glow Tag', 'solid', '#db2777 #831843 #f9a8d4'],
      [0, 'kicks', 'Asphalt', 'carbon', '#374151 #1f2937 #6b7280'],
      [1, 'rifle', 'Night Shift', 'stripes', '#1e3a8a #0f172a #38bdf8'],
      [1, 'cans', 'Bubblegum', 'fade', '#f9a8d4 #c084fc #fbcfe8'],
      [1, 'board', 'Tag Runner', 'camo', '#0e7490 #164e63 #f472b6'],
      [2, 'blade', 'Neon Drift', 'fade', '#22d3ee #a855f7 #f472b6'],
      [2, 'gloves', 'Arcade Grip', 'hex', '#111827 #ec4899 #22d3ee'],
      [3, 'synth', 'Laser Grid', 'circuit', '#0b1020 #f0abfc #22d3ee'],
      [3, 'fox', 'Pixel Pup', 'glitter', '#7c3aed #ec4899 #fde68a'],
      [4, 'blaster', 'Hyperwave', 'waves', '#ff3cac #784ba0 #2b86c5'],
      [5, 'helmet', 'Midnight Racer', 'holo', '#0f172a #ff00cc #00e5ff'],
      [6, 'blade', 'Neon Sovereign', 'gilded', '#fbbf24 #ff4fd8 #fff3b0'],
    ],
  ],
  [
    'circuit',
    'Circuit Storm',
    75,
    '#10b981 #052e16 #a3e635',
    'chip',
    [
      [0, 'drone', 'Solder Gray', 'carbon', '#4b5563 #374151 #9ca3af'],
      [0, 'blaster', 'Breadboard', 'circuit', '#14532d #052e16 #86efac'],
      [0, 'sticker', 'Byte Me', 'solid', '#059669 #064e3b #6ee7b7'],
      [1, 'kicks', 'Static', 'glitter', '#0f766e #134e4a #5eead4'],
      [1, 'synth', 'Terminal', 'stripes', '#022c22 #10b981 #a7f3d0'],
      [1, 'gloves', 'Jumper Wire', 'camo', '#166534 #1e293b #facc15'],
      [2, 'rifle', 'Voltage', 'circuit', '#052e16 #22c55e #bef264'],
      [2, 'cans', 'Overclock', 'hex', '#064e3b #34d399 #fef08a'],
      [3, 'board', 'Thunderhead', 'waves', '#0f172a #38bdf8 #a3e635'],
      [3, 'blade', 'Motherboard', 'circuit', '#022c22 #2dd4bf #fde047'],
      [4, 'helmet', 'Stormcaller', 'marble', '#0c4a6e #a3e635 #e0f2fe'],
      [5, 'fox', 'Ghost in the Wire', 'holo', '#022c22 #00ff9d #00b3ff'],
      [6, 'gloves', 'Lightning Crown', 'gilded', '#fde047 #22c55e #fffbe0'],
    ],
  ],
  [
    'frost',
    'Frostbyte',
    500,
    '#38bdf8 #0c2a4a #e0f2fe',
    'flake',
    [
      [0, 'kicks', 'Slush', 'camo', '#94a3b8 #cbd5e1 #64748b'],
      [0, 'helmet', 'Overcast', 'solid', '#64748b #334155 #cbd5e1'],
      [0, 'blaster', 'Frost Primer', 'carbon', '#334155 #1e293b #94a3b8'],
      [1, 'board', 'Snowdrift', 'marble', '#e2e8f0 #94a3b8 #f8fafc'],
      [1, 'sticker', 'Polar Pal', 'solid', '#7dd3fc #0369a1 #f0f9ff'],
      [1, 'rifle', 'Tundra', 'camo', '#e2e8f0 #94a3b8 #475569'],
      [2, 'gloves', 'Glacier', 'crystal', '#0ea5e9 #e0f2fe #1e3a8a'],
      [2, 'drone', 'Icicle', 'fade', '#e0f2fe #38bdf8 #1d4ed8'],
      [3, 'blade', 'Permafrost', 'crystal', '#bae6fd #0284c7 #f0f9ff'],
      [3, 'cans', 'Whiteout', 'glitter', '#f8fafc #bae6fd #94a3b8'],
      [4, 'synth', 'Ice Palace', 'marble', '#e0f2fe #7dd3fc #1e40af'],
      [5, 'blaster', 'Absolute Zero', 'holo', '#e0f2fe #38bdf8 #6366f1'],
      [6, 'blade', 'Frost Monarch', 'gilded', '#fde68a #7dd3fc #fffbeb'],
    ],
  ],
  [
    'solar',
    'Solar Flare',
    3500,
    '#f97316 #431407 #fde047',
    'sun',
    [
      [0, 'sticker', 'Sunburn', 'solid', '#d97706 #78350f #fbbf24'],
      [0, 'drone', 'Rust Bucket', 'camo', '#92400e #451a03 #d97706'],
      [0, 'board', 'Dune', 'stripes', '#d6a55c #92400e #fde68a'],
      [1, 'blaster', 'Ember', 'fade', '#f97316 #b91c1c #fde047'],
      [1, 'kicks', 'Heatwave', 'waves', '#f59e0b #dc2626 #fef3c7'],
      [1, 'helmet', 'Sandstorm', 'camo', '#d6a55c #78350f #fbbf24'],
      [2, 'rifle', 'Magma Vein', 'marble', '#1c1917 #f97316 #fde047'],
      [2, 'fox', 'Firecracker', 'glitter', '#dc2626 #f59e0b #fef08a'],
      [3, 'gloves', 'Flare Up', 'flame', '#7f1d1d #f97316 #fde047'],
      [3, 'synth', 'Corona', 'hex', '#451a03 #f59e0b #fef3c7'],
      [4, 'blade', 'Supernova', 'flame', '#450a0a #ef4444 #fbbf24'],
      [5, 'cans', 'Phoenix Song', 'holo', '#7f1d1d #ff7a00 #ffe066'],
      [6, 'blaster', 'Sunforged', 'gilded', '#fde047 #f97316 #fff7cc'],
    ],
  ],
  [
    'jungle',
    'Jungle Ruins',
    25000,
    '#65a30d #1a2e05 #facc15',
    'leaf',
    [
      [0, 'gloves', 'Moss', 'camo', '#3f6212 #1a2e05 #65a30d'],
      [0, 'helmet', 'Bark', 'stripes', '#57534e #292524 #a8a29e'],
      [0, 'sticker', 'Leaf Stamp', 'solid', '#4d7c0f #365314 #bef264'],
      [1, 'blade', 'Vine Wrap', 'stripes', '#166534 #14532d #86efac'],
      [1, 'synth', 'Temple Stone', 'marble', '#78716c #44403c #d6d3d1'],
      [1, 'drone', 'Canopy', 'camo', '#15803d #3f6212 #a16207'],
      [2, 'board', 'Tiger Lily', 'tiger', '#ea580c #1c1917 #fdba74'],
      [2, 'kicks', 'Emerald Idol', 'crystal', '#064e3b #10b981 #d1fae5'],
      [3, 'rifle', 'Jade Serpent', 'hex', '#065f46 #34d399 #fde68a'],
      [3, 'cans', 'Relic Hunter', 'waves', '#713f12 #ca8a04 #fef3c7'],
      [4, 'fox', 'Spirit Jaguar', 'tiger', '#facc15 #1c1917 #10b981'],
      [5, 'gloves', 'Lost Emperor', 'marble', '#14532d #fbbf24 #022c22'],
      [6, 'fox', 'Golden Idol', 'gilded', '#fcd34d #b45309 #fef9c3'],
    ],
  ],
  [
    'void',
    'Deep Void',
    180000,
    '#8b5cf6 #0b0620 #f0abfc',
    'ring',
    [
      [0, 'rifle', 'Dark Matter', 'carbon', '#1e1b4b #0f0a1f #4c1d95'],
      [0, 'kicks', 'Eclipse', 'solid', '#312e81 #1e1b4b #6366f1'],
      [0, 'cans', 'Hush', 'stripes', '#27272a #18181b #52525b'],
      [1, 'drone', 'Nebula Dust', 'glitter', '#4c1d95 #1e1b4b #c4b5fd'],
      [1, 'blaster', 'Event Horizon', 'fade', '#000000 #7c3aed #f0abfc'],
      [1, 'helmet', 'Gravity Well', 'waves', '#1e1b4b #6d28d9 #a78bfa'],
      [2, 'board', 'Starfield', 'galaxy', '#0b0620 #6d28d9 #f0abfc'],
      [2, 'sticker', 'Void Eye', 'crystal', '#2e1065 #a855f7 #f5d0fe'],
      [3, 'gloves', 'Singularity', 'galaxy', '#030014 #8b5cf6 #22d3ee'],
      [3, 'synth', 'Quasar', 'waves', '#1e1b4b #e879f9 #67e8f9'],
      [4, 'blade', 'Nightfall', 'galaxy', '#020010 #7c3aed #f0abfc'],
      [5, 'rifle', 'Black Hole Sun', 'flame', '#000000 #9333ea #fb923c'],
      [6, 'helmet', 'Void Emperor', 'gilded', '#fbbf24 #7c3aed #fde68a'],
    ],
  ],
  [
    'aurora',
    'Aurora Prime',
    1300000,
    '#2dd4bf #042f2e #c084fc',
    'wave',
    [
      [0, 'blaster', 'Polar Night', 'solid', '#1e293b #0f172a #475569'],
      [0, 'kicks', 'Tundra Trek', 'camo', '#334155 #0f766e #94a3b8'],
      [0, 'drone', 'Snow Owl', 'carbon', '#e2e8f0 #94a3b8 #f8fafc'],
      [1, 'cans', 'Lumen', 'fade', '#2dd4bf #6366f1 #ccfbf1'],
      [1, 'board', 'Borealis', 'waves', '#0f766e #22d3ee #a78bfa'],
      [1, 'sticker', 'Starlight', 'glitter', '#1e1b4b #fef08a #a5b4fc'],
      [2, 'synth', 'Night Sky', 'galaxy', '#020617 #22d3ee #a78bfa'],
      [2, 'helmet', 'Prism', 'crystal', '#a5f3fc #c4b5fd #fbcfe8'],
      [3, 'rifle', 'Dancing Lights', 'holo', '#022c22 #34d399 #e879f9'],
      [3, 'fox', 'Aurora Fox', 'fade', '#34d399 #818cf8 #f9a8d4'],
      [4, 'gloves', 'Spectrum', 'holo', '#0ea5e9 #a855f7 #22c55e'],
      [5, 'board', 'Solar Wind', 'holo', '#10b981 #f472b6 #fde047'],
      [6, 'blade', 'Aurora Crown', 'gilded', '#fde68a #34d399 #f5d0fe'],
    ],
  ],
  [
    'celestial',
    'Celestial Vault',
    10000000,
    '#fde68a #3b2a05 #ffffff',
    'crown',
    [
      [0, 'sticker', 'Stardust', 'glitter', '#94a3b8 #e2e8f0 #fef9c3'],
      [0, 'helmet', 'Moonstone', 'marble', '#cbd5e1 #94a3b8 #f1f5f9'],
      [0, 'gloves', 'Silver Lining', 'fade', '#94a3b8 #e2e8f0 #475569'],
      [1, 'kicks', 'Comet Tail', 'fade', '#f8fafc #93c5fd #fde68a'],
      [1, 'rifle', 'Constellation', 'galaxy', '#0f172a #fef3c7 #93c5fd'],
      [1, 'cans', 'Halo', 'solid', '#fef3c7 #f59e0b #fffbeb'],
      [2, 'drone', 'Seraph', 'crystal', '#fffbeb #fcd34d #e0e7ff'],
      [2, 'blaster', 'Pearl', 'marble', '#fdf4ff #e9d5ff #fef3c7'],
      [3, 'synth', 'Heavenly Chord', 'holo', '#fef3c7 #c4b5fd #99f6e4'],
      [3, 'board', 'Stargazer', 'galaxy', '#0c0a2a #fde68a #f0abfc'],
      [4, 'fox', 'Celestial Kitsune', 'glitter', '#fef3c7 #f0abfc #fbbf24'],
      [5, 'helmet', 'Divine Light', 'holo', '#fffbeb #fbbf24 #f472b6'],
      [6, 'rifle', 'Starforge Relic', 'gilded', '#fff7cc #fbbf24 #fffdf2'],
    ],
  ],
];
/** Items of the same rarity in a crate are worth a little more or less than each other. */
const JITTER = [0.9, 1, 1.15];

export const CRATES: Crate[] = CRATE_DATA.map(([id, name, price, colors, glyph]) => ({ id, name, price, colors: colors.split(' '), glyph }));
export const ITEMS: ItemDef[] = [];
CRATE_DATA.forEach(([, , price, , , rows], crate) =>
  rows.forEach(([rarity, kind, name, finish, colors], j) =>
    ITEMS.push({ i: ITEMS.length, crate, rarity, kind, name, finish, colors: colors.split(' '), base: round2(price * RARITIES[rarity].mult * JITTER[j % 3]) }),
  ),
);

export const itemName = (d: number) => `${KINDS[ITEMS[d].kind]} · ${ITEMS[d].name}`;

/** An owned item. d: ItemDef index, w: wear 0–1, s: pattern seed 0–999, t: Tracked click count or -1, l: 1 when locked. */
export interface Item {
  u: number;
  d: number;
  w: number;
  s: number;
  t: number;
  l: number;
}

export function rollRarity(rng: Rng, lucky = false): number {
  const x = rng();
  let r = EXOTIC;
  let acc = 0;
  for (let i = 0; i < RARITIES.length; i++) {
    acc += RARITIES[i].odds;
    if (x < acc) {
      r = i;
      break;
    }
  }
  if (lucky && r < EXOTIC && rng() < LUCKY_BUMP) r++;
  return r;
}

export function wearTier(w: number): number {
  for (let i = 0; i < WEARS.length; i++) if (w < WEARS[i].max) return i;
  return WEARS.length - 1;
}

export function rollWear(rng: Rng): number {
  let x = rng();
  let t = WEARS.length - 1;
  for (let i = 0; i < WEARS.length; i++) {
    if (x < WEARS[i].weight) {
      t = i;
      break;
    }
    x -= WEARS[i].weight;
  }
  const lo = t ? WEARS[t - 1].max : 0;
  return Math.floor((lo + rng() * (WEARS[t].max - lo)) * 1e4) / 1e4;
}

/** Value multiplier for a wear: the tier's, up to 10% more at the clean end of the tier, ×1.5 when Flawless. */
export function wearMult(w: number): number {
  const t = wearTier(w);
  const lo = t ? WEARS[t - 1].max : 0;
  const pos = Math.min(1, Math.max(0, (w - lo) / (WEARS[t].max - lo)));
  return WEARS[t].mult * (1 + 0.1 * (1 - pos)) * (w < FLAWLESS ? 1.5 : 1);
}

export function itemValue(it: Item): number {
  const m = wearMult(it.w) * (it.t >= 0 ? TRACKED_MULT : 1) * (it.s < PRIME_SEEDS ? 2 : 1);
  return Math.max(0.01, round2(ITEMS[it.d].base * m));
}

export function crateDefs(crate: number, rarity: number): number[] {
  return ITEMS.filter((x) => x.crate === crate && x.rarity === rarity).map((x) => x.i);
}

function pickDef(rng: Rng, crate: number, rarity: number): number {
  let r = rarity;
  let pool = crateDefs(crate, r);
  while (!pool.length && r > 0) pool = crateDefs(crate, --r);
  return pool[Math.floor(rng() * pool.length)];
}

export function rollItem(rng: Rng, crate: number, lucky = false): Item {
  const d = pickDef(rng, crate, rollRarity(rng, lucky));
  const w = rollWear(rng);
  const s = Math.floor(rng() * 1000);
  const t = rng() < TRACKED_CHANCE ? 0 : -1;
  return { u: 0, d, w, s, t, l: 0 };
}

/** Item definitions for the opening reel: filler rolled with the real odds, and the winner at `at`. */
export function reelStrip(rng: Rng, crate: number, winner: number, len = 60, at = 50): number[] {
  const out: number[] = [];
  for (let k = 0; k < len; k++) out.push(k === at ? winner : pickDef(rng, crate, rollRarity(rng)));
  return out;
}

// ---------- trade-up and upgrader ----------
/** Why a set of items can't be traded up, or '' when it can. */
export function tradeUpProblem(items: Item[]): string {
  if (items.length !== TRADE_UP_COUNT) return `Pick ${TRADE_UP_COUNT} items`;
  const r = ITEMS[items[0].d].rarity;
  if (r >= EXOTIC) return 'Exotics are already the top';
  if (items.some((x) => ITEMS[x.d].rarity !== r)) return 'All items must be the same rarity';
  if (items.some((x) => x.l)) return 'Unlock the items first';
  return '';
}

/** Every possible trade-up result with its chance (the rarity above, or two above now and then). */
export function tradeUpOutcomes(items: Item[]): { d: number; chance: number }[] {
  if (tradeUpProblem(items)) return [];
  const r = ITEMS[items[0].d].rarity;
  const odds = new Map<number, number>();
  for (const x of items) {
    const crate = ITEMS[x.d].crate;
    const jump = r + 2 <= EXOTIC ? TRADE_UP_JUMP : 0;
    for (const [rr, p] of [
      [r + 1, 1 - jump],
      [r + 2, jump],
    ]) {
      if (!p) continue;
      const pool = crateDefs(crate, rr);
      for (const d of pool) odds.set(d, (odds.get(d) || 0) + p / pool.length / items.length);
    }
  }
  return [...odds].map(([d, chance]) => ({ d, chance })).sort((a, b) => ITEMS[b.d].base - ITEMS[a.d].base);
}

/** 10 items of one rarity → 1 of the next, from one of the inputs' crates (more inputs, better chance); wear is their average. */
export function tradeUp(rng: Rng, items: Item[]): Item | null {
  if (tradeUpProblem(items)) return null;
  const r = ITEMS[items[0].d].rarity;
  const crate = ITEMS[items[Math.floor(rng() * items.length)].d].crate;
  let out = r + 1;
  if (out < EXOTIC && rng() < TRADE_UP_JUMP) out++;
  const d = pickDef(rng, crate, out);
  const w = Math.floor((items.reduce((a, x) => a + x.w, 0) / items.length) * 1e4) / 1e4;
  const s = Math.floor(rng() * 1000);
  return { u: 0, d, w, s, t: items.every((x) => x.t >= 0) ? 0 : -1, l: 0 };
}

export function upgradeChance(stake: number, target: number): number {
  if (!(stake > 0) || !(target > 0)) return 0;
  return Math.min(UPGRADE_MAX, (UPGRADE_EDGE * stake) / target);
}

/** Up to six items worth about 1.5× … 25× the stake, cheapest first. */
export function upgradeTargets(rng: Rng, stake: number): Item[] {
  const out: Item[] = [];
  for (const m of UPGRADE_STEPS) {
    const goal = stake * m;
    let best = 0;
    let bestErr = Infinity;
    const near: number[] = [];
    for (const def of ITEMS) {
      const err = Math.abs(Math.log(def.base / goal));
      if (err < 0.35) near.push(def.i);
      if (err < bestErr) {
        bestErr = err;
        best = def.i;
      }
    }
    const d = near.length ? near[Math.floor(rng() * near.length)] : best;
    let pick: Item | null = null;
    for (let k = 0; k < 6; k++) {
      const it = { u: 0, d, w: rollWear(rng), s: 5 + Math.floor(rng() * 995), t: -1, l: 0 };
      if (!pick || Math.abs(itemValue(it) - goal) < Math.abs(itemValue(pick) - goal)) pick = it;
    }
    if (pick && itemValue(pick) > stake * 1.05 && !out.some((o) => o.d === pick.d)) out.push(pick);
  }
  return out.sort((a, b) => itemValue(a) - itemValue(b));
}

// ---------- income ----------
export interface Generator {
  id: string;
  name: string;
  cost: number;
  ips: number;
}
export const GENERATORS: Generator[] = [
  { id: 'bot', name: 'Scrap Bot', cost: 15, ips: 0.3 },
  { id: 'courier', name: 'Crate Courier', cost: 120, ips: 2 },
  { id: 'stall', name: 'Market Stall', cost: 1300, ips: 12 },
  { id: 'hub', name: 'Trade Hub', cost: 14000, ips: 70 },
  { id: 'auction', name: 'Auction House', cost: 160000, ips: 420 },
  { id: 'forge', name: 'Skin Forge', cost: 2000000, ips: 2600 },
  { id: 'orbital', name: 'Orbital Exchange', cost: 30000000, ips: 17000 },
  { id: 'mint', name: 'Quantum Mint', cost: 500000000, ips: 120000 },
];

export interface Stats {
  clicks: number;
  clickEarned: number;
  opened: number;
  earned: number;
  spent: number;
  sold: number;
  tradeups: number;
  upWins: number;
  upLosses: number;
  /** Items obtained per rarity. */
  byRarity: number[];
  best: Item | null;
  tracked: number;
  flawless: number;
  prime: number;
  offline: number;
}
export interface State {
  v: number;
  cash: number;
  /** Earned since the last rebirth (sets the stars a rebirth gives). */
  runEarned: number;
  grip: number;
  syn: number;
  gens: number[];
  inv: Item[];
  uid: number;
  /** Times each item definition was found (kept through rebirths). */
  book: number[];
  claimed: number[];
  ach: string[];
  stats: Stats;
  stars: number;
  rebirths: number;
  showcase: number;
  luck: number;
  boostUntil: number;
  lastSeen: number;
  /** Power-up purchase ids already applied (so a repeated confirmation does nothing). */
  bought: string[];
  sound: boolean;
  fast: boolean;
  started: number;
}

export function newState(now: number): State {
  return {
    v: SAVE_VERSION,
    cash: 0,
    runEarned: 0,
    grip: 0,
    syn: 0,
    gens: GENERATORS.map(() => 0),
    inv: [],
    uid: 1,
    book: ITEMS.map(() => 0),
    claimed: [],
    ach: [],
    stats: {
      clicks: 0,
      clickEarned: 0,
      opened: 0,
      earned: 0,
      spent: 0,
      sold: 0,
      tradeups: 0,
      upWins: 0,
      upLosses: 0,
      byRarity: RARITIES.map(() => 0),
      best: null,
      tracked: 0,
      flawless: 0,
      prime: 0,
      offline: 0,
    },
    stars: 0,
    rebirths: 0,
    showcase: 0,
    luck: 0,
    boostUntil: 0,
    lastSeen: now,
    bought: [],
    sound: true,
    fast: false,
    started: now,
  };
}

export function milestoneMult(owned: number): number {
  return Math.pow(2, MILESTONES.filter((m) => owned >= m).length);
}
export function genOutput(i: number, owned: number): number {
  return GENERATORS[i].ips * owned * milestoneMult(owned);
}
export function genCost(i: number, owned: number): number {
  return Math.ceil(GENERATORS[i].cost * Math.pow(GEN_GROWTH, owned));
}
export function genBulkCost(i: number, owned: number, n: number): number {
  let sum = 0;
  for (let k = 0; k < n; k++) sum += genCost(i, owned + k);
  return sum;
}
/** How many more of income source i the cash buys (up to 1000). */
export function genAffordable(i: number, owned: number, cash: number): number {
  let n = 0;
  let left = cash;
  while (n < 1000) {
    const c = genCost(i, owned + n);
    if (c > left) break;
    left -= c;
    n++;
  }
  return n;
}
export const gripCost = (level: number) => Math.ceil(GRIP_BASE * Math.pow(GRIP_GROWTH, level));
export const synergyCost = (level: number) => SYNERGY_BASE * Math.pow(SYNERGY_GROWTH, level);

export function collectionDone(st: State, crate: number): boolean {
  return ITEMS.every((x) => x.crate !== crate || st.book[x.i] > 0);
}
export function globalMult(st: State, now: number, boost = true): number {
  return (1 + STAR_BONUS * st.stars) * (1 + ACH_BONUS * st.ach.length) * (1 + COLLECTION_BONUS * st.claimed.length) * (boost && st.boostUntil > now ? 2 : 1);
}
export function incomePerSec(st: State, now: number, boost = true): number {
  let sum = 0;
  for (let i = 0; i < GENERATORS.length; i++) sum += genOutput(i, st.gens[i]);
  return sum * globalMult(st, now, boost);
}
export function showcaseItem(st: State): Item | null {
  return (st.showcase && st.inv.find((x) => x.u === st.showcase)) || null;
}
/** The showcased item adds 4% per rarity step to clicks (Common +4% … Exotic +28%). */
export function showcaseMult(st: State): number {
  const it = showcaseItem(st);
  return it ? 1 + 0.04 * (ITEMS[it.d].rarity + 1) : 1;
}
export function clickValue(st: State, now: number, boost = true): number {
  const base = (1 + st.grip) * Math.pow(2, Math.floor(st.grip / 25));
  return Math.max(0.01, round2(base * showcaseMult(st) * globalMult(st, now, boost) + incomePerSec(st, now, boost) * SYNERGY_PCT * st.syn));
}

export function earn(st: State, amount: number): void {
  st.cash += amount;
  st.runEarned += amount;
  st.stats.earned += amount;
}

export function click(st: State, now: number): number {
  const v = clickValue(st, now);
  earn(st, v);
  st.stats.clicks++;
  st.stats.clickEarned += v;
  const sc = showcaseItem(st);
  if (sc && sc.t >= 0) sc.t++;
  return v;
}

/** Passive income for dt seconds. */
export function tick(st: State, dt: number, now: number): number {
  const v = incomePerSec(st, now) * Math.max(0, dt);
  earn(st, v);
  st.lastSeen = now;
  return v;
}

export function offlineEarnings(ips: number, awaySec: number): { seconds: number; cash: number } {
  if (!(awaySec >= OFFLINE_MIN) || !(ips > 0)) return { seconds: 0, cash: 0 };
  const seconds = Math.floor(Math.min(awaySec, OFFLINE_CAP));
  return { seconds, cash: round2(ips * seconds * OFFLINE_RATE) };
}

/** Pays what the income sources made while the game was closed (half rate, 4 hours at most). */
export function applyOffline(st: State, now: number): { seconds: number; cash: number } {
  const r = offlineEarnings(incomePerSec(st, now, false), (now - st.lastSeen) / 1000);
  if (r.cash > 0) {
    earn(st, r.cash);
    st.stats.offline += r.cash;
  }
  st.lastSeen = now;
  return r;
}

export function buyGen(st: State, i: number, n: number): boolean {
  if (!GENERATORS[i] || n < 1) return false;
  const cost = genBulkCost(i, st.gens[i], n);
  if (cost > st.cash) return false;
  st.cash -= cost;
  st.gens[i] += n;
  return true;
}
export function buyGrip(st: State): boolean {
  const cost = gripCost(st.grip);
  if (cost > st.cash) return false;
  st.cash -= cost;
  st.grip++;
  return true;
}
export function buySynergy(st: State): boolean {
  const cost = synergyCost(st.syn);
  if (st.syn >= SYNERGY_MAX || cost > st.cash) return false;
  st.cash -= cost;
  st.syn++;
  return true;
}

// ---------- items in the state ----------
function addItem(st: State, it: Item): Item {
  it.u = st.uid++;
  st.inv.push(it);
  st.book[it.d]++;
  st.stats.byRarity[ITEMS[it.d].rarity]++;
  if (it.t >= 0) st.stats.tracked++;
  if (it.w < FLAWLESS) st.stats.flawless++;
  if (it.s < PRIME_SEEDS) st.stats.prime++;
  if (!st.stats.best || itemValue(it) > itemValue(st.stats.best)) st.stats.best = { ...it };
  return it;
}

/** Buys and opens n crates. Null when the cash or inventory space isn't there. */
export function openCrates(st: State, rng: Rng, crate: number, n: number): Item[] | null {
  const c = CRATES[crate];
  if (!c || n < 1 || c.price * n > st.cash || st.inv.length + n > INVENTORY_MAX) return null;
  st.cash -= c.price * n;
  st.stats.spent += c.price * n;
  const out: Item[] = [];
  for (let k = 0; k < n; k++) {
    const lucky = st.luck > 0;
    if (lucky) st.luck--;
    out.push(addItem(st, rollItem(rng, crate, lucky)));
    st.stats.opened++;
  }
  return out;
}

/** Sells the items (locked ones are skipped); returns the cash made. */
export function sellItems(st: State, uids: number[]): number {
  const set = new Set(uids);
  let total = 0;
  st.inv = st.inv.filter((x) => {
    if (!set.has(x.u) || x.l) return true;
    total += itemValue(x);
    if (x.u === st.showcase) st.showcase = 0;
    return false;
  });
  total = round2(total);
  st.cash += total;
  st.stats.sold += total;
  return total;
}

/** Every copy of an item beyond the most valuable one (never locked or showcased items). */
export function duplicates(st: State): number[] {
  const safe = (x: Item) => x.l === 1 || x.u === st.showcase;
  // the copy to keep: the most valuable, and on a tie one that's locked or showcased anyway
  const keep = new Map<number, Item>();
  for (const x of st.inv) {
    const k = keep.get(x.d);
    if (!k || itemValue(x) > itemValue(k) || (itemValue(x) === itemValue(k) && safe(x) && !safe(k))) keep.set(x.d, x);
  }
  return st.inv.filter((x) => !safe(x) && keep.get(x.d) !== x).map((x) => x.u);
}

function takeItems(st: State, uids: number[]): Item[] | null {
  const items = uids.map((u) => st.inv.find((x) => x.u === u));
  if (items.some((x) => !x) || new Set(uids).size !== uids.length) return null;
  return items as Item[];
}

export function doTradeUp(st: State, rng: Rng, uids: number[]): Item | null {
  const items = takeItems(st, uids);
  if (!items) return null;
  const out = tradeUp(rng, items);
  if (!out) return null;
  st.inv = st.inv.filter((x) => !uids.includes(x.u));
  if (uids.includes(st.showcase)) st.showcase = 0;
  st.stats.tradeups++;
  return addItem(st, out);
}

/** Stakes an item on a target: roll < chance wins the target, otherwise the stake is gone. */
export function doUpgrade(st: State, rng: Rng, uid: number, target: Item): { win: boolean; roll: number; chance: number; item: Item | null } | null {
  const it = st.inv.find((x) => x.u === uid);
  if (!it || it.l || !ITEMS[target.d]) return null;
  const chance = upgradeChance(itemValue(it), itemValue(target));
  if (!chance) return null;
  const roll = rng();
  st.inv = st.inv.filter((x) => x !== it);
  if (st.showcase === uid) st.showcase = 0;
  const win = roll < chance;
  if (win) st.stats.upWins++;
  else st.stats.upLosses++;
  return { win, roll, chance, item: win ? addItem(st, { u: 0, d: target.d, w: target.w, s: target.s, t: target.t, l: 0 }) : null };
}

export function claimCollection(st: State, crate: number): number {
  if (!CRATES[crate] || st.claimed.includes(crate) || !collectionDone(st, crate)) return 0;
  st.claimed.push(crate);
  const cash = CRATES[crate].price * COLLECTION_REWARD;
  earn(st, cash);
  return cash;
}

export const starsFor = (runEarned: number) => Math.floor(Math.sqrt(Math.max(0, runEarned) / REBIRTH_UNIT));

/** Trades this run's cash, upgrades and items for stars (+10% income each). Keeps the book, trophies, stats and power-ups. */
export function rebirth(st: State): number {
  const gain = starsFor(st.runEarned);
  if (gain < 1) return 0;
  st.stars += gain;
  st.rebirths++;
  st.cash = 0;
  st.runEarned = 0;
  st.grip = 0;
  st.syn = 0;
  st.gens = GENERATORS.map(() => 0);
  st.inv = [];
  st.showcase = 0;
  return gain;
}

export const inventoryValue = (st: State) => round2(st.inv.reduce((a, x) => a + itemValue(x), 0));
export const scoreOf = (st: State) => Math.min(SCORE_MAX, Math.floor(st.stats.earned));

// ---------- coin power-ups ----------
export const POWERUPS: Record<string, { label: string; cost: number }> = {
  lucky: { label: `Lucky key (next ${LUCKY_PACK} crates)`, cost: 5 },
  cash: { label: 'Cash crate', cost: 5 },
  boost: { label: 'Double income for 10 minutes', cost: 8 },
};
/** A Cash crate pays about 10 minutes of income plus 100 clicks (at least $100). */
export function cashCrateAmount(st: State, now: number): number {
  return round2(Math.max(100, incomePerSec(st, now, false) * 600 + clickValue(st, now, false) * 100));
}
/** Applies a confirmed power-up once per purchase id; returns false for unknown kinds or repeated ids. */
export function applyPowerup(st: State, kind: string, id: string, now: number): boolean {
  if (!POWERUPS[kind] || !id || st.bought.includes(id)) return false;
  if (kind === 'lucky') st.luck += LUCKY_PACK;
  else if (kind === 'cash') earn(st, cashCrateAmount(st, now));
  else st.boostUntil = Math.max(now, st.boostUntil) + BOOST_MS;
  st.bought.push(id);
  if (st.bought.length > 50) st.bought.splice(0, st.bought.length - 50);
  return true;
}

// ---------- achievements ----------
export interface Achievement {
  id: string;
  name: string;
  desc: string;
  test: (st: State) => boolean;
}
const owned = (st: State) => st.gens.reduce((a, b) => a + b, 0);
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'click1', name: 'First tap', desc: 'Click the big button', test: (s) => s.stats.clicks >= 1 },
  { id: 'click1k', name: 'Clicker', desc: 'Click 1,000 times', test: (s) => s.stats.clicks >= 1000 },
  { id: 'click10k', name: 'Finger of steel', desc: 'Click 10,000 times', test: (s) => s.stats.clicks >= 10000 },
  { id: 'open1', name: 'Unboxer', desc: 'Open your first crate', test: (s) => s.stats.opened >= 1 },
  { id: 'open100', name: 'Crate collector', desc: 'Open 100 crates', test: (s) => s.stats.opened >= 100 },
  { id: 'open1k', name: 'Crate legend', desc: 'Open 1,000 crates', test: (s) => s.stats.opened >= 1000 },
  { id: 'rare', name: 'Feeling blue', desc: 'Get a Rare item', test: (s) => s.stats.byRarity[2] > 0 },
  { id: 'epic', name: 'Purple patch', desc: 'Get an Epic item', test: (s) => s.stats.byRarity[3] > 0 },
  { id: 'legendary', name: 'Pink panic', desc: 'Get a Legendary item', test: (s) => s.stats.byRarity[4] > 0 },
  { id: 'mythic', name: 'Seeing red', desc: 'Get a Mythic item', test: (s) => s.stats.byRarity[5] > 0 },
  { id: 'exotic', name: 'Solid gold', desc: 'Get an Exotic item', test: (s) => s.stats.byRarity[6] > 0 },
  { id: 'earn1k', name: 'Pocket money', desc: 'Earn $1,000 in total', test: (s) => s.stats.earned >= 1e3 },
  { id: 'earn1m', name: 'Millionaire', desc: 'Earn $1M in total', test: (s) => s.stats.earned >= 1e6 },
  { id: 'earn1b', name: 'Billionaire', desc: 'Earn $1B in total', test: (s) => s.stats.earned >= 1e9 },
  { id: 'gen10', name: 'Automation', desc: 'Own 10 income sources', test: (s) => owned(s) >= 10 },
  { id: 'gen100', name: 'Tycoon', desc: 'Own 100 income sources', test: (s) => owned(s) >= 100 },
  { id: 'grip25', name: 'Iron grip', desc: 'Raise Power Grip to level 25', test: (s) => s.grip >= 25 },
  { id: 'book1', name: 'Curator', desc: 'Complete a collection', test: (s) => s.claimed.length >= 1 },
  { id: 'book4', name: 'Museum', desc: 'Complete 4 collections', test: (s) => s.claimed.length >= 4 },
  { id: 'trade1', name: 'Contractor', desc: 'Complete a trade-up', test: (s) => s.stats.tradeups >= 1 },
  { id: 'upg1', name: 'Risk taker', desc: 'Win an upgrade', test: (s) => s.stats.upWins >= 1 },
  { id: 'tracked', name: 'On the record', desc: 'Get a Tracked item', test: (s) => s.stats.tracked > 0 },
  { id: 'flawless', name: 'Flawless', desc: 'Get an item with wear under 0.01', test: (s) => s.stats.flawless > 0 },
  { id: 'prime', name: 'Prime pattern', desc: 'Get a pattern seed from 0 to 4', test: (s) => s.stats.prime > 0 },
  { id: 'hoard', name: 'Hoarder', desc: 'Hold 100 items at once', test: (s) => s.inv.length >= 100 },
  { id: 'sell1k', name: 'Merchant', desc: 'Sell $1,000 of items', test: (s) => s.stats.sold >= 1000 },
  { id: 'rebirth', name: 'Born again', desc: 'Rebirth once', test: (s) => s.rebirths >= 1 },
];
/** Unlocks any achievements now earned; returns the new ids. */
export function checkAchievements(st: State): string[] {
  const fresh = ACHIEVEMENTS.filter((a) => !st.ach.includes(a.id) && a.test(st)).map((a) => a.id);
  st.ach.push(...fresh);
  return fresh;
}

// ---------- saves ----------
const num = (x: unknown, def: number, min = 0, max = Number.MAX_VALUE) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : def);
const int = (x: unknown, def: number, min = 0, max = Number.MAX_SAFE_INTEGER) => Math.floor(num(x, def, min, max));

function cleanItem(x: unknown): Item | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const d = o.d;
  if (typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d >= ITEMS.length) return null;
  return { u: int(o.u, 0), d, w: num(o.w, 0.5, 0, 0.9999), s: int(o.s, 500, 0, 999), t: int(o.t, -1, -1), l: o.l ? 1 : 0 };
}

/** Steps from older save versions to the next one (none yet: version 1 is the first). */
const MIGRATIONS: Record<number, (o: Record<string, unknown>) => Record<string, unknown>> = {};

/** A State from a save string or object: upgrades older versions, repairs bad fields, and starts fresh on garbage. */
export function migrateSave(raw: unknown, now: number): State {
  let data: unknown = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }
  const st = newState(now);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return st;
  let o = data as Record<string, unknown>;
  for (let v = int(o.v, 0); v < SAVE_VERSION && MIGRATIONS[v]; v++) o = MIGRATIONS[v](o);
  st.cash = num(o.cash, 0);
  st.runEarned = num(o.runEarned, 0);
  st.grip = int(o.grip, 0, 0, 100000);
  st.syn = int(o.syn, 0, 0, SYNERGY_MAX);
  const list = (x: unknown) => (Array.isArray(x) ? x : []);
  st.gens = GENERATORS.map((_, i) => int(list(o.gens)[i], 0, 0, 100000));
  const seen = new Set<number>();
  for (const x of list(o.inv)) {
    const it = cleanItem(x);
    if (!it || st.inv.length >= INVENTORY_MAX) continue;
    if (!it.u || seen.has(it.u)) it.u = 0;
    else seen.add(it.u);
    st.inv.push(it);
  }
  st.uid = Math.max(int(o.uid, 1, 1), ...st.inv.map((x) => x.u + 1));
  for (const it of st.inv) if (!it.u) it.u = st.uid++;
  st.book = ITEMS.map((_, i) => int(list(o.book)[i], 0));
  st.claimed = [...new Set(list(o.claimed).filter((c): c is number => Number.isInteger(c) && c >= 0 && c < CRATES.length))];
  st.ach = [...new Set(list(o.ach).filter((a): a is string => ACHIEVEMENTS.some((x) => x.id === a)))];
  const s = (o.stats && typeof o.stats === 'object' ? o.stats : {}) as Record<string, unknown>;
  for (const k of ['clicks', 'clickEarned', 'opened', 'earned', 'spent', 'sold', 'tradeups', 'upWins', 'upLosses', 'tracked', 'flawless', 'prime', 'offline'] as const)
    st.stats[k] = num(s[k], 0);
  st.stats.byRarity = RARITIES.map((_, i) => int(list(s.byRarity)[i], 0));
  st.stats.best = cleanItem(s.best);
  st.stars = int(o.stars, 0);
  st.rebirths = int(o.rebirths, 0);
  st.showcase = st.inv.some((x) => x.u === o.showcase) ? (o.showcase as number) : 0;
  st.luck = int(o.luck, 0, 0, 1000);
  st.boostUntil = num(o.boostUntil, 0);
  st.lastSeen = num(o.lastSeen, now, 0, now);
  st.bought = list(o.bought)
    .filter((b): b is string => typeof b === 'string')
    .slice(-50);
  st.sound = o.sound !== false;
  st.fast = o.fast === true;
  st.started = num(o.started, now, 0, now);
  return st;
}
