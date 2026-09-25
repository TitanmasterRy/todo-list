// Transcript math: letter grades, GPA points, weighted GPA across courses.
import { letterGrade } from './grades';

export const GPA_POINTS: Record<string, number> = {
  A: 4.0,
  'A−': 3.7,
  'B+': 3.3,
  B: 3.0,
  'B−': 2.7,
  'C+': 2.3,
  C: 2.0,
  'C−': 1.7,
  'D+': 1.3,
  D: 1.0,
  F: 0,
};

export function pointsFor(pct: number): number {
  return GPA_POINTS[letterGrade(pct)] ?? 0;
}

export interface TranscriptRow {
  courseId: string;
  name: string;
  term: string;
  credits: number;
  grade: number | null; // percent, null if nothing graded
  letter: string | null;
  points: number | null;
}

export function gpa(rows: TranscriptRow[]): { gpa: number | null; credits: number; gradedCredits: number } {
  const graded = rows.filter((r) => r.points !== null && r.credits > 0);
  const gradedCredits = graded.reduce((a, r) => a + r.credits, 0);
  const credits = rows.reduce((a, r) => a + r.credits, 0);
  if (!gradedCredits) return { gpa: null, credits, gradedCredits: 0 };
  const total = graded.reduce((a, r) => a + r.points! * r.credits, 0);
  return { gpa: Math.round((total / gradedCredits) * 100) / 100, credits, gradedCredits };
}

export function groupByTerm(rows: TranscriptRow[]): { term: string; rows: TranscriptRow[] }[] {
  const m = new Map<string, TranscriptRow[]>();
  for (const r of rows) {
    const k = r.term || 'Current term';
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r);
  }
  return [...m.entries()].map(([term, rows]) => ({ term, rows }));
}

export function transcriptCSV(rows: TranscriptRow[]): string {
  const esc = (s: string | number | null) => (s === null ? '' : `"${String(s).replace(/"/g, '""')}"`);
  const lines = ['Term,Course,Credits,Grade %,Letter,Points'];
  for (const r of rows) lines.push([r.term, r.name, r.credits, r.grade === null ? null : r.grade.toFixed(1), r.letter, r.points].map(esc).join(','));
  return lines.join('\n') + '\n';
}
