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
  return ((target / 100) * s.totalWeight - s.earned) / s.remainingWeight * 100;
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
