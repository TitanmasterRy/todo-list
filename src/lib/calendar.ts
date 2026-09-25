// Month grid math for the calendar view.
import { addDaysKey, dateKey } from './dates';

/** 6 weeks × 7 days of date keys covering the month of `monthKey` (YYYY-MM-01), starting on weekStart. */
export function monthGrid(year: number, month: number, weekStart: 0 | 1): string[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() - weekStart + 7) % 7;
  const start = addDaysKey(dateKey(first), -offset);
  return Array.from({ length: 42 }, (_, i) => addDaysKey(start, i));
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}
