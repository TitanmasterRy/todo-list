// Orebelt achievements: checked against the whole state after anything happens; each one earned pays a shard.
import { BUILDING, PHASES } from './data';
import type { FactoryState } from './state';

/** The fields achievements read; FactoryState carries them once the save shape lands. */
export type AchState = FactoryState & {
  ach: string[];
  madeTotal: number;
  lifetime: { launches: number; contracts: number; relaunches: number };
  runs: number;
  sectors: string[];
};

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  test: (s: AchState) => boolean;
}

export const ACH_SHARDS = 1;

const machines = (s: AchState) => s.buildings.filter((b) => b.type !== 'camp').length;
const generatorMw = (s: AchState) => s.buildings.reduce((a, b) => a + (BUILDING[b.type]?.gen?.mw ?? 0), 0);
// storage and loaders may not be in BuildingId yet, so compare by name
const hasType = (s: AchState, types: string[]) => s.buildings.some((b) => types.includes(b.type as string));

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'belt1', name: 'Hooked up', desc: 'Lay your first belt', emoji: '🔗', test: (s) => s.belts.length >= 1 },
  { id: 'belt50', name: 'Spaghetti', desc: 'Have 50 belts running', emoji: '🍝', test: (s) => s.belts.length >= 50 },
  { id: 'machines10', name: 'Assembly line', desc: 'Build 10 machines', emoji: '🏭', test: (s) => machines(s) >= 10 },
  { id: 'power100', name: 'Grid', desc: 'Place 100 MW of generators', emoji: '⚡', test: (s) => generatorMw(s) >= 100 },
  { id: 'overclock', name: 'Red line', desc: 'Overclock a building', emoji: '🔥', test: (s) => s.buildings.some((b) => b.clock > 1) },
  { id: 'alt1', name: 'Blueprint', desc: 'Research an alternate recipe', emoji: '📐', test: (s) => s.research.length >= 1 },
  { id: 'made1k', name: 'Production', desc: 'Make 1,000 items', emoji: '📦', test: (s) => s.madeTotal >= 1e3 },
  { id: 'made10k', name: 'Mass production', desc: 'Make 10,000 items', emoji: '🚚', test: (s) => s.madeTotal >= 1e4 },
  { id: 'made100k', name: 'Industrialist', desc: 'Make 100,000 items', emoji: '🏗️', test: (s) => s.madeTotal >= 1e5 },
  { id: 'tier3', name: 'Heavy industry', desc: 'Reach tier 3', emoji: '🛢️', test: (s) => s.phase >= 3 },
  { id: 'launched', name: 'Launched', desc: 'Finish the Launch Tower', emoji: '🚀', test: (s) => s.phase >= PHASES.length },
  { id: 'relaunch', name: 'Again, but faster', desc: 'Relaunch once', emoji: '🔁', test: (s) => s.runs >= 1 },
  { id: 'contracts5', name: 'Reliable supplier', desc: 'Fill 5 contracts', emoji: '📋', test: (s) => s.lifetime.contracts >= 5 },
  { id: 'sectors3', name: 'Surveyor', desc: 'Survey 3 sectors', emoji: '🧭', test: (s) => s.sectors.length >= 3 },
  { id: 'storage', name: 'Warehousing', desc: 'Build a storage or a loader', emoji: '🗄️', test: (s) => hasType(s, ['storage', 'loader']) },
];
export const ACHIEVEMENT: Record<string, Achievement> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

/** Unlocks any achievements now earned, pays a shard for each and returns the new ones (for a toast). */
export function checkAchievements(s: AchState): Achievement[] {
  const fresh = ACHIEVEMENTS.filter((a) => !s.ach.includes(a.id) && a.test(s));
  s.ach.push(...fresh.map((a) => a.id));
  s.shards += fresh.length * ACH_SHARDS;
  return fresh;
}

export function earnedAchievements(s: Pick<AchState, 'ach'>): Achievement[] {
  return ACHIEVEMENTS.filter((a) => s.ach.includes(a.id));
}
