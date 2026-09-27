// Virtual pet (Cute theme, Play → Pet). Fullness and happiness drift down in real time and go up when you feed it
// (a coin spend in the ledger, reason `pet:<food>`), pet it, or finish tasks. It never dies: at worst it's sleepy
// or sad until you come back. The state is computed from those events, so it's the same on every synced device.

export interface Food {
  id: string;
  name: string;
  emoji: string;
  price: number; // coins
  fill: number; // fullness it adds
  joy: number; // happiness it adds
}

export const FOODS: Food[] = [
  { id: 'kibble', name: 'Kibble', emoji: '🥣', price: 3, fill: 25, joy: 3 },
  { id: 'apple', name: 'Apple', emoji: '🍎', price: 5, fill: 20, joy: 8 },
  { id: 'fish', name: 'Fish', emoji: '🐟', price: 8, fill: 35, joy: 10 },
  { id: 'cupcake', name: 'Cupcake', emoji: '🧁', price: 12, fill: 15, joy: 25 },
];

export const SPECIES = [
  { id: 'cat', emoji: '🐱', name: 'Kitten', color: '#f6b26b' },
  { id: 'bunny', emoji: '🐰', name: 'Bunny', color: '#f4cccc' },
  { id: 'chick', emoji: '🐣', name: 'Chick', color: '#ffe599' },
  { id: 'frog', emoji: '🐸', name: 'Frog', color: '#93c47d' },
  { id: 'blob', emoji: '🫧', name: 'Blob', color: '#9fc5e8' },
] as const;
export type SpeciesId = (typeof SPECIES)[number]['id'];

/** Points lost per hour. From full it gets hungry in about half a day and sleepy after a day. */
export const DECAY = { fill: 3.5, joy: 2.5 };
export const START = { fill: 70, joy: 70 };
export const PET_JOY = 5; // a pat
export const TASK_JOY = 4; // it cheers when you finish homework
export const FULL_AT = 90; // won't eat above this

export type PetEvent = { at: number; kind: 'feed'; food: string } | { at: number; kind: 'pat' } | { at: number; kind: 'task' };

export type Mood = 'happy' | 'content' | 'hungry' | 'sad' | 'sleepy';

export interface PetState {
  fill: number; // 0–100
  joy: number; // 0–100
  mood: Mood;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function moodFor(fill: number, joy: number): Mood {
  if (fill < 20) return 'sleepy'; // too hungry to play: it naps until fed
  if (joy < 20) return 'sad';
  if (fill < 45) return 'hungry';
  if (fill >= 60 && joy >= 70) return 'happy';
  return 'content';
}

/** Replay the events since the pet was adopted (epoch ms) and decay to `now`. */
export function petState(events: PetEvent[], bornAt: number, now: number): PetState {
  let fill = START.fill;
  let joy = START.joy;
  let t = bornAt;
  const sorted = events.filter((e) => e.at >= bornAt && e.at <= now).sort((a, b) => a.at - b.at);
  const decay = (to: number) => {
    const h = Math.max(0, to - t) / 3_600_000;
    fill = clamp(fill - DECAY.fill * h);
    joy = clamp(joy - DECAY.joy * h);
    t = Math.max(t, to);
  };
  for (const e of sorted) {
    decay(e.at);
    if (e.kind === 'feed') {
      const f = FOODS.find((x) => x.id === e.food);
      if (f) {
        fill = clamp(fill + f.fill);
        joy = clamp(joy + f.joy);
      }
    } else joy = clamp(joy + (e.kind === 'pat' ? PET_JOY : TASK_JOY));
  }
  decay(now);
  return { fill: Math.round(fill), joy: Math.round(joy), mood: moodFor(fill, joy) };
}

/** Hours until fullness drops below the "hungry" line (0 if it already has). */
export function hoursUntilHungry(s: PetState): number {
  return Math.max(0, (s.fill - 45) / DECAY.fill);
}

export function canFeed(s: PetState): boolean {
  return s.fill < FULL_AT;
}

export const MOOD_TEXT: Record<Mood, string> = {
  happy: 'is bouncing with joy',
  content: 'is doing fine',
  hungry: 'is getting hungry',
  sad: 'misses you. A pat or a treat would help',
  sleepy: 'is too hungry to play and dozed off. Feed it to wake it up',
};
