// How your time estimates compare with the time you actually tracked.
import type { Task } from './types';

export interface EstimateAccuracy {
  n: number;
  medianRatio: number; // actual / estimate; 1.3 = tasks take 30% longer than estimated
  message: string;
}

export function estimateAccuracy(tasks: Task[]): EstimateAccuracy | null {
  const ratios = tasks
    .filter((t) => t.completedAt && t.estimateMin && t.estimateMin > 0 && t.timeSpentMin && t.timeSpentMin > 0)
    .map((t) => t.timeSpentMin! / t.estimateMin!)
    .sort((a, b) => a - b);
  if (ratios.length < 3) return null;
  const mid = Math.floor(ratios.length / 2);
  const median = ratios.length % 2 ? ratios[mid] : (ratios[mid - 1] + ratios[mid]) / 2;
  const pct = Math.round(Math.abs(median - 1) * 100);
  const message =
    pct < 10 ? 'Your estimates are spot on.' : median > 1 ? `Tasks usually take ${pct}% longer than you estimate.` : `Tasks usually take ${pct}% less time than you estimate.`;
  return { n: ratios.length, medianRatio: Math.round(median * 100) / 100, message };
}

/** Adjust a new estimate by your track record (only when there's enough history). */
export function calibrated(estimateMin: number, acc: EstimateAccuracy | null): number {
  if (!acc || acc.n < 5) return estimateMin;
  return Math.round((estimateMin * acc.medianRatio) / 5) * 5 || estimateMin;
}
