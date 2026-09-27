// Garden (Nature theme, Play → Garden): every finished task is a growth step. Plants take turns: the first four
// completions grow the first plant from sprout to bloom, the next four the second, and so on, twelve plants to a bed.
// Each plant takes the color of the course whose task planted it. Pure, so it's unit-tested.

export const STAGES = ['seed', 'sprout', 'leaves', 'bud', 'bloom'] as const;
export type Stage = (typeof STAGES)[number];
export const STEPS_PER_PLANT = STAGES.length - 1; // 4 completions to bloom
export const BED_SIZE = 12;
export const KINDS = ['daisy', 'tulip', 'sunflower', 'rose', 'bluebell'] as const;
export type PlantKind = (typeof KINDS)[number];

export interface Completion {
  id: string;
  at: string; // ISO completedAt
  color?: string; // course color
  course?: string; // course name
}

export interface Plant {
  index: number; // across all beds
  stage: number; // 0 seed … 4 bloom
  kind: PlantKind;
  color: string;
  course?: string;
  plantedAt?: string;
}

export interface Garden {
  beds: Plant[][]; // each BED_SIZE long; the last one ends with the seed waiting to sprout
  steps: number; // completions counted
  blooms: number;
}

const DEFAULT_COLOR = '#e06666';

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function buildGarden(completions: Completion[]): Garden {
  const sorted = [...completions].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1));
  const plants: Plant[] = [];
  for (let i = 0; i < sorted.length; i += STEPS_PER_PLANT) {
    const first = sorted[i];
    plants.push({
      index: plants.length,
      stage: Math.min(STEPS_PER_PLANT, sorted.length - i),
      kind: KINDS[hash(first.id) % KINDS.length],
      color: first.color || DEFAULT_COLOR,
      course: first.course,
      plantedAt: first.at,
    });
  }
  // the next plant waits as a seed (the next finished task sprouts it)
  if (!plants.length || plants[plants.length - 1].stage === STEPS_PER_PLANT)
    plants.push({ index: plants.length, stage: 0, kind: KINDS[plants.length % KINDS.length], color: DEFAULT_COLOR });
  const beds: Plant[][] = [];
  for (let i = 0; i < plants.length; i += BED_SIZE) beds.push(plants.slice(i, i + BED_SIZE));
  return { beds, steps: sorted.length, blooms: plants.filter((p) => p.stage === STEPS_PER_PLANT).length };
}

/** "3 more tasks until it blooms". */
export function stepsToBloom(p: Plant): number {
  return STEPS_PER_PLANT - p.stage;
}
