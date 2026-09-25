import { weighted, type Rng, cryptoRng } from './rng';

/** Symbol weights on every reel, most common first. Index 0 is the "cherry" (two of them pay back the bet). */
export const SLOT_WEIGHTS = [30, 22, 16, 12, 8, 4];
/** Three-of-a-kind payouts (× bet) per symbol index. */
export const SLOT_PAY3 = [6, 12, 25, 50, 120, 500];
export const SLOT_PAY_TWO_CHERRIES = 1;

/** Reel symbols per theme pack, same order as the weights. */
export const SLOT_SYMBOLS: Record<string, string[]> = {
  classic: ['🍒', '🍋', '🔔', '🍀', '💎', '7️⃣'],
  sleek: ['◆', '●', '▲', '■', '★', '✦'],
  cute: ['🍓', '🧁', '🐱', '🐰', '🦄', '🌈'],
  arcade: ['🍒', '👾', '🕹️', '💰', '👑', '🏆'],
  nature: ['🍃', '🌻', '🍄', '🐝', '🦋', '🌳'],
  space: ['☄️', '🌙', '🪐', '🛸', '🚀', '🌌'],
  paper: ['✏️', '📎', '📐', '📓', '📜', '🖋️'],
};

export interface SlotResult {
  reels: [number, number, number];
  multiplier: number;
  line: string; // human description
}

export function spinSlots(rng: Rng = cryptoRng): SlotResult {
  const reels = [weighted(SLOT_WEIGHTS, rng), weighted(SLOT_WEIGHTS, rng), weighted(SLOT_WEIGHTS, rng)] as [number, number, number];
  return { reels, ...slotPayout(reels) };
}

export function slotPayout(reels: [number, number, number]): { multiplier: number; line: string } {
  const [a, b, c] = reels;
  if (a === b && b === c) return { multiplier: SLOT_PAY3[a], line: 'Three of a kind' };
  const cherries = reels.filter((r) => r === 0).length;
  if (cherries === 2) return { multiplier: SLOT_PAY_TWO_CHERRIES, line: 'Two cherries' };
  return { multiplier: 0, line: '' };
}

/** Theoretical return to player (for the "house edge" label). */
export function slotsRtp(): number {
  const t = SLOT_WEIGHTS.reduce((x, y) => x + y, 0);
  const p = SLOT_WEIGHTS.map((w) => w / t);
  const three = p.reduce((s, pi, i) => s + pi ** 3 * SLOT_PAY3[i], 0);
  const two = 3 * p[0] ** 2 * (1 - p[0]) * SLOT_PAY_TWO_CHERRIES;
  return three + two;
}
