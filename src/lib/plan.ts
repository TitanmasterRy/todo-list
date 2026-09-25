// Work-back planning: split a big task into dated milestones, or space study sessions before an exam.
import { addDaysKey, diffDays } from './dates';
import type { TaskType } from './types';

export interface MilestoneStep {
  title: string;
  /** Share of the available time this step takes (relative, any scale). */
  weight: number;
  estimateMin?: number;
}

export const MILESTONE_TEMPLATES: { id: string; label: string; types: (TaskType | '')[]; steps: MilestoneStep[] }[] = [
  {
    id: 'essay',
    label: 'Essay / paper',
    types: ['homework'],
    steps: [
      { title: 'Pick a topic and research', weight: 3, estimateMin: 60 },
      { title: 'Outline', weight: 1, estimateMin: 30 },
      { title: 'First draft', weight: 3, estimateMin: 90 },
      { title: 'Revise and edit', weight: 2, estimateMin: 45 },
      { title: 'Final proofread and citations', weight: 1, estimateMin: 20 },
    ],
  },
  {
    id: 'project',
    label: 'Project',
    types: ['project', ''],
    steps: [
      { title: 'Plan and gather materials', weight: 1, estimateMin: 30 },
      { title: 'Build the first half', weight: 3, estimateMin: 90 },
      { title: 'Build the second half', weight: 3, estimateMin: 90 },
      { title: 'Polish and check the rubric', weight: 1, estimateMin: 45 },
    ],
  },
  {
    id: 'presentation',
    label: 'Presentation',
    types: [],
    steps: [
      { title: 'Research and key points', weight: 2, estimateMin: 45 },
      { title: 'Make the slides', weight: 2, estimateMin: 60 },
      { title: 'Rehearse out loud', weight: 1, estimateMin: 30 },
    ],
  },
  {
    id: 'reading',
    label: 'Long reading',
    types: ['reading'],
    steps: [
      { title: 'Read the first third', weight: 1, estimateMin: 45 },
      { title: 'Read the middle third', weight: 1, estimateMin: 45 },
      { title: 'Read the last third and take notes', weight: 1, estimateMin: 60 },
    ],
  },
  {
    id: 'lab',
    label: 'Lab report',
    types: [],
    steps: [
      { title: 'Organize data and make graphs', weight: 1, estimateMin: 45 },
      { title: 'Write methods and results', weight: 2, estimateMin: 60 },
      { title: 'Write discussion and conclusion', weight: 2, estimateMin: 60 },
      { title: 'Proofread', weight: 1, estimateMin: 20 },
    ],
  },
];

/** The template that fits a task type best. */
export function templateForType(type: TaskType | '' | undefined): (typeof MILESTONE_TEMPLATES)[number] {
  return MILESTONE_TEMPLATES.find((t) => t.types.includes(type ?? '')) ?? MILESTONE_TEMPLATES[1];
}

/**
 * Spread steps over the days from `startKey` to the day before `dueKey`, in proportion to their weights.
 * Each step lands on the day its share of the time ends, so heavier steps get more days before them.
 * With no room (due today or tomorrow) everything lands on the last available day.
 */
export function spreadDates(startKey: string, dueKey: string, weights: number[]): string[] {
  if (!weights.length) return [];
  const room = diffDays(startKey, dueKey); // days from start to due
  if (room <= 0) return weights.map(() => (room < 0 ? startKey : dueKey));
  const span = room - 1; // last usable day is the day before it's due
  const w = weights.map((x) => Math.max(0, x) || 0);
  const total = w.reduce((a, x) => a + x, 0);
  let acc = 0;
  return w.map((x) => {
    acc += total ? x : 1;
    // the step's end point: rounded up so the first steps don't all pile onto the start day
    const day = Math.min(span, Math.max(0, Math.ceil((acc / (total || w.length)) * (span + 1)) - 1));
    return addDaysKey(startKey, day);
  });
}

export interface PlannedStep {
  title: string;
  dateKey: string;
  estimateMin?: number;
}

/** Milestones for a task, dated working back from its due day. */
export function planMilestones(steps: MilestoneStep[], todayKey: string, dueKey: string): PlannedStep[] {
  const clean = steps.filter((s) => s.title.trim());
  const dates = spreadDates(
    todayKey,
    dueKey,
    clean.map((s) => s.weight),
  );
  return clean.map((s, i) => ({ title: s.title.trim(), dateKey: dates[i], estimateMin: s.estimateMin }));
}

/** Spaced-review offsets (days before the exam). Sessions before today are dropped. */
export const EXAM_OFFSETS = [10, 7, 4, 2, 1];

/**
 * Study sessions for an exam: spaced out, closer together near the day. Always at least one session
 * (today) when the exam is today or later; none when it has passed.
 */
export function examSessions(todayKey: string, examKey: string, offsets: number[] = EXAM_OFFSETS): string[] {
  const until = diffDays(todayKey, examKey);
  if (until < 0) return [];
  const days = [...new Set(offsets.filter((o) => o >= 1 && o <= until).map((o) => addDaysKey(examKey, -o)))].sort();
  return days.length ? days : [todayKey];
}
