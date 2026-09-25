// Star map (Play → Star map): every day you finished a task lights a star; days in a row join into constellations.
// Pure layout: each month is a patch of sky with its days on a wandering trail. Patches run in a snake (left to right,
// then back), so the last day of a month always sits next to the first day of the next.
import { addDaysKey, DAY_SHORT, fromKey, MONTH_SHORT } from './dates';
import { seeded } from './casino/rng';

export type PeriodKind = 'year' | 'semester';

export interface Period {
  kind: PeriodKind;
  start: string; // day keys, inclusive
  end: string;
  label: string;
}

/** The calendar year, or the half year (Jan–Jun, Jul–Dec), holding `day`. */
export function periodFor(kind: PeriodKind, day: string): Period {
  const [y, m] = day.split('-').map(Number);
  if (kind === 'year') return { kind, start: `${y}-01-01`, end: `${y}-12-31`, label: String(y) };
  const first = m <= 6;
  return { kind, start: `${y}-${first ? '01' : '07'}-01`, end: `${y}-${first ? '06-30' : '12-31'}`, label: `${first ? 'Jan – Jun' : 'Jul – Dec'} ${y}` };
}

/** The period before (-1) or after (+1). */
export function shiftPeriod(p: Period, dir: 1 | -1): Period {
  return periodFor(p.kind, dir < 0 ? addDaysKey(p.start, -1) : addDaysKey(p.end, 1));
}

export interface Star {
  key: string;
  x: number;
  y: number;
  r: number;
  count: number;
  lit: boolean;
  future: boolean;
}

export interface MonthPatch {
  label: string;
  x: number; // label position
  y: number;
  days: number;
  lit: number;
  tasks: number;
}

export interface StarMap {
  width: number;
  height: number;
  stars: Star[]; // one per day, in date order
  links: [number, number][]; // indexes of lit days in a row
  months: MonthPatch[];
}

export const PATCH_W = 220;
export const PATCH_H = 170;
const PAD = 22;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Star size grows with the day's count, gently. */
export const starRadius = (count: number): number => (count > 0 ? 2.4 + Math.min(3.2, Math.sqrt(count) * 0.9) : 1.1);

export function layoutStars(period: Period, data: Record<string, number>, today: string): StarMap {
  const cols = period.kind === 'year' ? 4 : 3;
  const stars: Star[] = [];
  const months: MonthPatch[] = [];
  let key = period.start;
  for (let m = 0; key <= period.end; m++) {
    const d0 = fromKey(key);
    const monthKeys: string[] = [];
    for (const month = d0.getMonth(); key <= period.end && fromKey(key).getMonth() === month; key = addDaysKey(key, 1)) monthKeys.push(key);
    const row = Math.floor(m / cols);
    const col = row % 2 === 0 ? m % cols : cols - 1 - (m % cols);
    const reverse = row % 2 === 1;
    const ox = col * PATCH_W;
    const oy = row * PATCH_H;
    // a trail with two random waves, the same every time for a given month
    const rng = seeded(hash(monthKeys[0]));
    const [p1, p2, f1, f2] = [rng() * Math.PI * 2, rng() * Math.PI * 2, 0.8 + rng() * 0.8, 2 + rng() * 1.5];
    const mid = oy + PATCH_H / 2 + 8;
    monthKeys.forEach((k, i) => {
      const t = monthKeys.length > 1 ? i / (monthKeys.length - 1) : 0.5;
      const along = PAD + t * (PATCH_W - PAD * 2);
      const x = ox + (reverse ? PATCH_W - along : along) + (rng() - 0.5) * 8;
      const y = mid + Math.sin(p1 + t * f1 * Math.PI * 2) * PATCH_H * 0.22 + Math.sin(p2 + t * f2 * Math.PI * 2) * PATCH_H * 0.08 + (rng() - 0.5) * 12;
      const count = data[k] ?? 0;
      stars.push({ key: k, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, r: starRadius(count), count, lit: count > 0, future: k > today });
    });
    const lit = monthKeys.filter((k) => (data[k] ?? 0) > 0);
    months.push({
      label: `${MONTH_SHORT[d0.getMonth()]} ${d0.getFullYear()}`,
      x: ox + 12,
      y: oy + 20,
      days: monthKeys.length,
      lit: lit.length,
      tasks: lit.reduce((a, k) => a + data[k], 0),
    });
  }
  const links: [number, number][] = [];
  for (let i = 1; i < stars.length; i++) if (stars[i].lit && stars[i - 1].lit) links.push([i - 1, i]);
  const rows = Math.ceil(months.length / cols);
  return { width: cols * PATCH_W, height: rows * PATCH_H, stars, links, months };
}

export interface StarSummary {
  lit: number;
  tasks: number;
  pastDays: number; // days so far (today included)
  longest: number; // most lit days in a row
  longestEnd?: string;
}

export function starSummary(map: Pick<StarMap, 'stars'>): StarSummary {
  let run = 0;
  let longest = 0;
  let longestEnd: string | undefined;
  let lit = 0;
  let tasks = 0;
  for (const s of map.stars) {
    run = s.lit ? run + 1 : 0;
    if (run > longest) [longest, longestEnd] = [run, s.key];
    if (s.lit) {
      lit++;
      tasks += s.count;
    }
  }
  return { lit, tasks, pastDays: map.stars.filter((s) => !s.future).length, longest, longestEnd };
}

/** "Tue, Sep 14, 2026" */
export function dayLabel(key: string): string {
  const d = fromKey(key);
  return `${DAY_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
