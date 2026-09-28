// Zen garden (Nature theme, Play → Garden), in the spirit of the classic one: pots on a patio, plants that ask
// for water, fertilizer, bug spray or music, coins that drop when a plant is happy, a snail that collects them,
// and a Tree of Wisdom fed a foot at a time. Supplies come from schoolwork (every finished task drops a care pack)
// or the garden shop (coins). The garden itself lives on this device (localStorage); coins go through the ledger.
// Everything here is pure and unit-tested; the component only holds timers and animations.

export const POTS = 32; // 8 × 4, like the original patio
export const KINDS = ['daisy', 'tulip', 'sunflower', 'rose', 'bluebell', 'lily'] as const;
export type PlantKind = (typeof KINDS)[number];
export const STAGES = ['sprout', 'small', 'medium', 'grown'] as const;
export const GROWN = STAGES.length - 1; // 3 bags of fertilizer to full size
export const NEEDS = ['water', 'fertilizer', 'spray', 'music'] as const;
export type Need = (typeof NEEDS)[number];
export const NEED_EMOJI: Record<Need, string> = { water: '💧', fertilizer: '🌱', spray: '🐛', music: '🎵' };
export const NEED_TEXT: Record<Need, string> = { water: 'wants water', fertilizer: 'wants fertilizer', spray: 'has bugs', music: 'wants music' };

/** Real-time pacing: a plant rests after growing, and full-grown plants get thirsty a few times a day. */
export const GROW_REST_MS = 15 * 60_000;
export const GROWN_REST_MS = 3 * 3_600_000;
export const SNAIL_AWAKE_MS = 60 * 60_000; // one chocolate keeps Stinky awake an hour
export const MEADOW_MAX = 240;

/** Coins a happy plant drops. Shiny plants double it. Capped per day so homework stays the way to earn. */
export const COINS: Record<Need, number> = { water: 1, fertilizer: 2, spray: 1, music: 1 };
export const GROWN_BONUS = 5;
export const GARDEN_DAILY_MAX = 30;
export const SHINY_ONE_IN = 8;

export type SupplyId = 'fertilizer' | 'spray' | 'treeFood' | 'chocolate';
export type ToolId = 'phonograph' | 'goldenCan';
export interface ShopEntry {
  id: SupplyId | ToolId;
  name: string;
  emoji: string;
  price: number;
  blurb: string;
  tool?: boolean; // bought once, kept forever (ledger item)
}
export const GARDEN_SHOP: ShopEntry[] = [
  { id: 'fertilizer', name: 'Fertilizer', emoji: '🌱', price: 4, blurb: 'One bag grows a plant a size' },
  { id: 'spray', name: 'Bug spray', emoji: '🧴', price: 5, blurb: 'Shoos the bugs off a plant' },
  { id: 'chocolate', name: 'Chocolate', emoji: '🍫', price: 8, blurb: 'Keeps Stinky awake for an hour' },
  { id: 'treeFood', name: 'Tree food', emoji: '🍯', price: 6, blurb: 'One foot for the Tree of Wisdom' },
  { id: 'phonograph', name: 'Phonograph', emoji: '📻', price: 25, blurb: 'Plays music for plants that ask', tool: true },
  { id: 'goldenCan', name: 'Golden watering can', emoji: '🏺', price: 40, blurb: 'Waters every thirsty plant at once', tool: true },
];
export const LEDGER_REASON = 'garden'; // coins the garden pays
export const shopReason = (id: ShopEntry['id']) => `garden:${id}`;

export interface Completion {
  id: string;
  at: string; // ISO completedAt
  color?: string; // course color
  course?: string; // course name
}

export interface Seed {
  id: string;
  kind: PlantKind;
  color: string;
  course?: string;
  shiny: boolean;
}

export interface PotPlant extends Seed {
  stage: number; // 0 sprout … GROWN
  plantedAt: number;
  need: Need | null;
  needAt: number; // when the need appeared, or when the next one is due while resting
  tended: number; // needs met so far (drives the need sequence)
  grownAt?: number;
}

export interface Supplies {
  seeds: number;
  fertilizer: number;
  spray: number;
  treeFood: number;
  chocolate: number;
}

export interface GardenSave {
  v: 1;
  pots: (PotPlant | null)[];
  used: Supplies;
  meadow: { kind: PlantKind; color: string }[];
  tree: { height: number; leaves: string[] };
  snail: { awakeUntil: number };
}

const DEFAULT_COLOR = '#e06666';

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  // a final mix so the low bits (what `% n` reads) vary between similar strings
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return h >>> 0;
}

export function emptyGarden(): GardenSave {
  return {
    v: 1,
    pots: Array.from({ length: POTS }, () => null),
    used: { seeds: 0, fertilizer: 0, spray: 0, treeFood: 0, chocolate: 0 },
    meadow: [],
    tree: { height: 0, leaves: [] },
    snail: { awakeUntil: 0 },
  };
}

// ---------- supplies from schoolwork ----------
/** Seed packets in completion order: each finished task is one, colored by its course. Every 8th is shiny. */
export function seedsFrom(completions: Completion[]): Seed[] {
  return [...completions]
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1))
    .map((c) => ({ id: c.id, kind: KINDS[hash(c.id) % KINDS.length], color: c.color || DEFAULT_COLOR, course: c.course, shiny: hash(`shiny:${c.id}`) % SHINY_ONE_IN === 0 }));
}

/** What `n` finished tasks have dropped: a seed, a bag of fertilizer and tree food each, bug spray every third. */
export function dropsFor(n: number): Supplies {
  return { seeds: n, fertilizer: n, spray: Math.floor(n / 3), treeFood: n, chocolate: 0 };
}

/** What's in the shed now: drops plus shop purchases, minus what's been used (never below zero). */
export function supplies(dropped: Supplies, bought: Partial<Supplies>, used: Supplies): Supplies {
  const out = { ...dropped };
  for (const k of Object.keys(out) as (keyof Supplies)[]) out[k] = Math.max(0, out[k] + (bought[k] ?? 0) - used[k]);
  return out;
}

// ---------- the pots ----------
export function plant(g: GardenSave, pot: number, seed: Seed, now: number): GardenSave {
  if (pot < 0 || pot >= POTS || g.pots[pot]) return g;
  const pots = [...g.pots];
  pots[pot] = { ...seed, stage: 0, plantedAt: now, need: 'water', needAt: now, tended: 0 };
  return { ...g, pots, used: { ...g.used, seeds: g.used.seeds + 1 } };
}

/** The need a resting plant surfaces next: growing plants mostly want water, sometimes bugs or music first. */
export function nextNeed(p: PotPlant): Need {
  if (p.stage >= GROWN) return 'water';
  const r = hash(`${p.id}:${p.tended}`) % 6;
  return r === 0 ? 'spray' : r === 1 ? 'music' : 'water';
}

/** Surface needs that are due. */
export function wake(g: GardenSave, now: number): GardenSave {
  let changed = false;
  const pots = g.pots.map((p) => {
    if (!p || p.need || now < p.needAt) return p;
    changed = true;
    return { ...p, need: nextNeed(p), needAt: now };
  });
  return changed ? { ...g, pots } : g;
}

export interface Tended {
  garden: GardenSave;
  ok: boolean;
  coins: number; // before the daily cap
  grew: boolean;
  grown: boolean; // reached full size just now
}

/** Meet a plant's need with `tool`. Supplies are counted by the caller; this only moves the plant along. */
export function tend(g: GardenSave, pot: number, tool: Need, now: number): Tended {
  const p = g.pots[pot];
  const no = { garden: g, ok: false, coins: 0, grew: false, grown: false };
  if (!p || p.need !== tool) return no;
  let next: PotPlant = { ...p, tended: p.tended + 1 };
  let coins = COINS[tool];
  let grew = false;
  let grown = false;
  if (tool === 'fertilizer') {
    grew = true;
    next.stage = Math.min(GROWN, p.stage + 1);
    if (next.stage === GROWN) {
      grown = true;
      next.grownAt = now;
      coins += GROWN_BONUS;
    }
    next = { ...next, need: null, needAt: now + (grown ? GROWN_REST_MS : GROW_REST_MS) };
  } else if (tool === 'water' && p.stage < GROWN) {
    next = { ...next, need: 'fertilizer', needAt: now }; // a watered sprout is ready to grow
  } else if (tool === 'water') {
    next = { ...next, need: null, needAt: now + GROWN_REST_MS };
  } else {
    next = { ...next, need: 'water', needAt: now }; // bugs shooed or song played: thirsty now
  }
  if (p.shiny) coins *= 2;
  const pots = [...g.pots];
  pots[pot] = next;
  const used = { ...g.used };
  if (tool === 'fertilizer') used.fertilizer++;
  if (tool === 'spray') used.spray++;
  return { garden: { ...g, pots, used }, ok: true, coins, grew, grown };
}

/** Wheel a full-grown plant off to the meadow, freeing its pot. */
export function toMeadow(g: GardenSave, pot: number): GardenSave {
  const p = g.pots[pot];
  if (!p || p.stage < GROWN) return g;
  const pots = [...g.pots];
  pots[pot] = null;
  return { ...g, pots, meadow: [...g.meadow, { kind: p.kind, color: p.color }].slice(-MEADOW_MAX) };
}

/** Coins the garden may still pay today. */
export function coinsLeftToday(paidToday: number): number {
  return Math.max(0, GARDEN_DAILY_MAX - paidToday);
}

export function feedSnail(g: GardenSave, now: number): GardenSave {
  return { ...g, used: { ...g.used, chocolate: g.used.chocolate + 1 }, snail: { awakeUntil: Math.max(now, g.snail.awakeUntil) + SNAIL_AWAKE_MS } };
}

export const snailAwake = (g: GardenSave, now: number) => g.snail.awakeUntil > now;

/** Pots that are thirsty right now (the golden can waters them all). */
export function thirsty(g: GardenSave): number[] {
  return g.pots.flatMap((p, i) => (p?.need === 'water' ? [i] : []));
}

// ---------- the Tree of Wisdom ----------
/** Feed the tree a foot's worth. `leaf` is the course color of the task that grew the food (gold when bought). */
export function feedTree(g: GardenSave, leaf: string): GardenSave {
  return { ...g, used: { ...g.used, treeFood: g.used.treeFood + 1 }, tree: { height: g.tree.height + 1, leaves: [...g.tree.leaves, leaf].slice(-24) } };
}

export interface TreeMilestone {
  feet: number;
  unlock: string; // what appears in the tree
  emoji: string;
}
export const TREE_MILESTONES: TreeMilestone[] = [
  { feet: 3, unlock: 'A bird moves in', emoji: '🐦' },
  { feet: 6, unlock: 'A rope swing', emoji: '🪢' },
  { feet: 10, unlock: 'A birdhouse', emoji: '🏠' },
  { feet: 15, unlock: 'Paper lanterns', emoji: '🏮' },
  { feet: 20, unlock: 'A treehouse', emoji: '🛖' },
  { feet: 30, unlock: 'Fruit', emoji: '🍎' },
  { feet: 40, unlock: 'Fireflies at night', emoji: '✨' },
  { feet: 50, unlock: 'An owl', emoji: '🦉' },
  { feet: 75, unlock: 'Above the clouds', emoji: '☁️' },
  { feet: 100, unlock: 'The moon in the branches', emoji: '🌙' },
  { feet: 150, unlock: 'A hammock', emoji: '🛏️' },
  { feet: 200, unlock: 'Its own weather: petals fall all year', emoji: '🌸' },
];

export function treeUnlocks(height: number): TreeMilestone[] {
  return TREE_MILESTONES.filter((m) => height >= m.feet);
}
export function nextMilestone(height: number): TreeMilestone | undefined {
  return TREE_MILESTONES.find((m) => height < m.feet);
}

/** Study wisdom, one line per foot; milestones have their own. */
export const WISDOM: string[] = [
  'Start with the ugliest task. Everything after it feels easy.',
  'Twenty-five minutes of real focus beats two hours of almost.',
  'Write the first sentence badly. You can fix bad; you cannot fix blank.',
  'Read the question twice before you answer it once.',
  'A plant grows a little every day. So does a grade.',
  'Put the phone in another room. Roots grow best in quiet soil.',
  'Sleep is when the tree sorts its leaves. Do not skip it before a test.',
  'Explain it to the snail. If Stinky gets it, you get it.',
  'Break big work into small pots. Fill one pot at a time.',
  'The best time to start was yesterday. The second best is this minute.',
  'Tested yourself and got it wrong? Good. Now it will stick.',
  'Space it out: three short reviews beat one long cram.',
  'Ask the question you are embarrassed to ask. Everyone else has it too.',
  'Water the work you are avoiding. It is usually the one that matters.',
  'A finished rough draft is worth more than a perfect outline.',
  'Take the break before you need it, not after you have crashed.',
  'Handwrite the hard parts. The hand remembers what the eye skims.',
  'One chapter a day for a week is a whole book.',
  'When stuck, change the room, the pen or the problem. Not all three.',
  'Do the reading before class and the class becomes the review.',
  'Bugs on a plant are just a job for the spray. Mistakes are just a job for you.',
  'Your streak is not the point. The point is who you become keeping it.',
  'Turn the last thing you learned into a question. Answer it tomorrow.',
  'Late work handed in still beats work never handed in.',
  'Teach a friend and you learn it twice.',
  'Tidy desk, tidy mind. A little. Mostly tidy desk.',
  'Eat something before the exam. Brains run on breakfast.',
  'The tree does not compare itself to the fence. Grow at your pace.',
  'Set a timer for ten minutes. Most days, you will not want to stop.',
  'Write down what you will do next before you close the book.',
  'Cross things off on paper. The ink is the reward.',
  'Two minutes or less? Do it now.',
  'Big exam? Plan backwards from the date, one small session at a time.',
  'Confused is what learning feels like from the inside.',
  'Check your answers as if a rival wrote them.',
  'Sunflowers follow the light. Follow the deadline.',
  'A little bit every day is a magic trick that works.',
  'Read your essay out loud. Your ears catch what your eyes forgive.',
  'Rest is part of the work, not the opposite of it.',
  'You do not need to feel ready. You need to begin.',
];

export function wisdomFor(height: number, done: number): string {
  const m = TREE_MILESTONES.find((x) => x.feet === height);
  if (m) return `${m.unlock}! The tree remembers: ${done} task${done === 1 ? '' : 's'} finished since it was a seed.`;
  return WISDOM[(height - 1 + WISDOM.length) % WISDOM.length];
}

// ---------- scenery ----------
export type Daylight = 'dawn' | 'day' | 'dusk' | 'night';
export function daylight(hour: number): Daylight {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export function seasonOf(month: number): Season {
  // month 0–11
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

// ---------- saving ----------
export const SAVE_KEY = 'homework-todo:garden';
type Store = Pick<Storage, 'getItem' | 'setItem'>;

const isKind = (k: unknown): k is PlantKind => KINDS.includes(k as PlantKind);
const isNeed = (n: unknown): n is Need => NEEDS.includes(n as Need);
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, d = '') => (typeof v === 'string' ? v.slice(0, 80) : d);

function cleanPlant(p: unknown): PotPlant | null {
  if (!p || typeof p !== 'object') return null;
  const o = p as Record<string, unknown>;
  if (!isKind(o.kind) || typeof o.id !== 'string') return null;
  return {
    id: o.id.slice(0, 80),
    kind: o.kind,
    color: str(o.color, DEFAULT_COLOR),
    course: typeof o.course === 'string' ? o.course.slice(0, 80) : undefined,
    shiny: o.shiny === true,
    stage: Math.max(0, Math.min(GROWN, Math.floor(num(o.stage)))),
    plantedAt: num(o.plantedAt),
    need: isNeed(o.need) ? o.need : null,
    needAt: num(o.needAt),
    tended: Math.max(0, Math.floor(num(o.tended))),
    grownAt: typeof o.grownAt === 'number' ? o.grownAt : undefined,
  };
}

/** Read the save, tolerating anything odd in it. */
export function parseGarden(text: string | null | undefined): GardenSave {
  const g = emptyGarden();
  if (!text) return g;
  try {
    const o = JSON.parse(text) as Record<string, unknown>;
    if (!o || typeof o !== 'object') return g;
    if (Array.isArray(o.pots)) for (let i = 0; i < POTS; i++) g.pots[i] = cleanPlant(o.pots[i]);
    const used = (o.used ?? {}) as Record<string, unknown>;
    for (const k of Object.keys(g.used) as (keyof Supplies)[]) g.used[k] = Math.max(0, Math.floor(num(used[k])));
    if (Array.isArray(o.meadow))
      g.meadow = o.meadow
        .filter((m): m is { kind: PlantKind; color: string } => !!m && typeof m === 'object' && isKind((m as { kind?: unknown }).kind))
        .map((m) => ({ kind: m.kind, color: str(m.color, DEFAULT_COLOR) }))
        .slice(-MEADOW_MAX);
    const tree = (o.tree ?? {}) as Record<string, unknown>;
    g.tree = {
      height: Math.max(0, Math.floor(num(tree.height))),
      leaves: Array.isArray(tree.leaves) ? tree.leaves.filter((x): x is string => typeof x === 'string').slice(-24) : [],
    };
    const snail = (o.snail ?? {}) as Record<string, unknown>;
    g.snail = { awakeUntil: num(snail.awakeUntil) };
  } catch {
    /* a broken save starts the garden over */
  }
  return g;
}

export function loadGarden(storage: Pick<Storage, 'getItem'> | undefined): GardenSave {
  try {
    return parseGarden(storage?.getItem(SAVE_KEY));
  } catch {
    return emptyGarden();
  }
}

export function saveGarden(storage: Store | undefined, g: GardenSave): void {
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify(g));
  } catch {
    /* storage full or blocked: the garden just won't remember this visit */
  }
}
