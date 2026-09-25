// Weighted grade math for a course.
export interface GradeItem {
  weight: number; // percent of the course
  score?: number; // percent earned, undefined = not graded yet
}

export interface GradeSummary {
  totalWeight: number; // 100, or more if the entered weights exceed 100
  gradedWeight: number; // weight of items with a score
  remainingWeight: number; // weight still to be earned
  earned: number; // points already banked out of totalWeight
  current: number | null; // average on graded work, null if nothing graded
  floor: number; // final grade if every remaining item scored 0
  ceiling: number; // final grade if every remaining item scored 100
}

export function summarize(items: GradeItem[]): GradeSummary {
  const valid = items.filter((i) => i.weight > 0);
  const sum = valid.reduce((a, i) => a + i.weight, 0);
  const totalWeight = Math.max(100, sum);
  const graded = valid.filter((i) => typeof i.score === 'number');
  const gradedWeight = graded.reduce((a, i) => a + i.weight, 0);
  const earned = graded.reduce((a, i) => a + (i.score! / 100) * i.weight, 0);
  const remainingWeight = totalWeight - gradedWeight;
  const current = gradedWeight > 0 ? (earned / gradedWeight) * 100 : null;
  return {
    totalWeight,
    gradedWeight,
    remainingWeight,
    earned,
    current,
    floor: (earned / totalWeight) * 100,
    ceiling: ((earned + remainingWeight) / totalWeight) * 100,
  };
}

/** Average needed on all remaining weight to finish with `target` %. null when nothing remains. */
export function neededOnRemaining(items: GradeItem[], target: number): number | null {
  const s = summarize(items);
  if (s.remainingWeight <= 0) return null;
  return (((target / 100) * s.totalWeight - s.earned) / s.remainingWeight) * 100;
}

export function letterGrade(pct: number): string {
  if (pct >= 93) return 'A';
  if (pct >= 90) return 'A−';
  if (pct >= 87) return 'B+';
  if (pct >= 83) return 'B';
  if (pct >= 80) return 'B−';
  if (pct >= 77) return 'C+';
  if (pct >= 73) return 'C';
  if (pct >= 70) return 'C−';
  if (pct >= 67) return 'D+';
  if (pct >= 60) return 'D';
  return 'F';
}

// ---------- letter scales ----------
export interface ScaleStep {
  letter: string;
  min: number; // lowest percent that earns this letter
}

export const GRADE_SCALES: { id: string; label: string; steps: ScaleStep[] }[] = [
  {
    id: 'plusminus',
    label: 'A–F with + / − (93/90/87…)',
    steps: [
      { letter: 'A', min: 93 },
      { letter: 'A−', min: 90 },
      { letter: 'B+', min: 87 },
      { letter: 'B', min: 83 },
      { letter: 'B−', min: 80 },
      { letter: 'C+', min: 77 },
      { letter: 'C', min: 73 },
      { letter: 'C−', min: 70 },
      { letter: 'D+', min: 67 },
      { letter: 'D', min: 60 },
      { letter: 'F', min: 0 },
    ],
  },
  {
    id: 'ten',
    label: 'A–F, 10-point (90/80/70/60)',
    steps: [
      { letter: 'A', min: 90 },
      { letter: 'B', min: 80 },
      { letter: 'C', min: 70 },
      { letter: 'D', min: 60 },
      { letter: 'F', min: 0 },
    ],
  },
  {
    id: 'seven',
    label: 'A–F, 7-point (93/85/77/70)',
    steps: [
      { letter: 'A', min: 93 },
      { letter: 'B', min: 85 },
      { letter: 'C', min: 77 },
      { letter: 'D', min: 70 },
      { letter: 'F', min: 0 },
    ],
  },
  {
    id: 'passfail',
    label: 'Pass / fail (70)',
    steps: [
      { letter: 'Pass', min: 70 },
      { letter: 'Fail', min: 0 },
    ],
  },
];

/** "A 94, B 85, C 75, D 65, F 0" (or one per line) → steps, highest first. Returns null if it doesn't parse. */
export function parseScale(text: string): ScaleStep[] | null {
  const parts = text
    .split(/[,;\n]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const steps: ScaleStep[] = [];
  for (const p of parts) {
    const m = p.match(/^(.+?)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%?$/);
    if (!m) return null;
    steps.push({ letter: m[1].trim(), min: Number(m[2]) });
  }
  if (!steps.length) return null;
  steps.sort((a, b) => b.min - a.min);
  return steps;
}

export function formatScale(steps: ScaleStep[]): string {
  return steps.map((s) => `${s.letter} ${s.min}`).join(', ');
}

/** The steps for a course: its custom scale, a named preset, or the default +/− scale. */
export function scaleFor(course: { gradeScale?: string; customScale?: ScaleStep[] } | undefined): ScaleStep[] {
  if (course?.gradeScale === 'custom' && course.customScale?.length) return course.customScale;
  return (GRADE_SCALES.find((s) => s.id === course?.gradeScale) ?? GRADE_SCALES[0]).steps;
}

/** Letter for a percent on a scale (below every step: the lowest letter). */
export function letterOn(pct: number, steps: ScaleStep[]): string {
  const sorted = [...steps].sort((a, b) => b.min - a.min);
  return (sorted.find((s) => pct >= s.min) ?? sorted[sorted.length - 1])?.letter ?? '';
}

/** The percent needed for the next letter up, or null at the top. */
export function nextLetter(pct: number, steps: ScaleStep[]): { letter: string; min: number } | null {
  const up = [...steps].sort((a, b) => a.min - b.min).find((s) => s.min > pct);
  return up ? { letter: up.letter, min: up.min } : null;
}

// ---------- trend ----------
export interface TimelineItem {
  id: string;
  title: string;
  date: string; // ISO or YYYY-MM-DD
  weight: number;
  score: number;
}

/** Scores in date order with the weighted course average after each one. */
export function gradeTimeline(items: TimelineItem[]): (TimelineItem & { average: number })[] {
  const sorted = items.filter((i) => i.weight > 0 && Number.isFinite(i.score)).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let w = 0;
  let pts = 0;
  return sorted.map((i) => {
    w += i.weight;
    pts += i.weight * i.score;
    return { ...i, average: pts / w };
  });
}

// ---------- what if ----------
/** Fill in imagined scores (by item index) and imagined extra items, then summarize. */
export function whatIf(items: GradeItem[], imagined: Record<number, number | undefined>, extra: GradeItem[] = []): GradeSummary {
  return summarize([...items.map((it, i) => (typeof it.score !== 'number' && typeof imagined[i] === 'number' ? { ...it, score: imagined[i] } : it)), ...extra]);
}
