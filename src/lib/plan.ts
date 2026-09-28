// Work-back planning: split a big task into dated milestones, or space study sessions before an exam.
import { addDaysKey, diffDays } from './dates';
import type { TaskType } from './types';
import { t as tr, type MessageKey } from './i18n/index.svelte';

export interface MilestoneStep {
  title: string;
  /** Share of the available time this step takes (relative, any scale). */
  weight: number;
  estimateMin?: number;
}

// labels and step titles follow the app language (read when a template is loaded)
const step = (key: MessageKey, weight: number, estimateMin: number): MilestoneStep => ({
  get title() {
    return tr(key);
  },
  weight,
  estimateMin,
});
export const MILESTONE_TEMPLATES: { id: string; label: string; types: (TaskType | '')[]; steps: MilestoneStep[] }[] = [
  {
    id: 'essay',
    get label() {
      return tr('plan.tpl.essay');
    },
    types: ['homework'],
    steps: [step('plan.essay.1', 3, 60), step('plan.essay.2', 1, 30), step('plan.essay.3', 3, 90), step('plan.essay.4', 2, 45), step('plan.essay.5', 1, 20)],
  },
  {
    id: 'project',
    get label() {
      return tr('plan.tpl.project');
    },
    types: ['project', ''],
    steps: [step('plan.project.1', 1, 30), step('plan.project.2', 3, 90), step('plan.project.3', 3, 90), step('plan.project.4', 1, 45)],
  },
  {
    id: 'presentation',
    get label() {
      return tr('plan.tpl.presentation');
    },
    types: [],
    steps: [step('plan.presentation.1', 2, 45), step('plan.presentation.2', 2, 60), step('plan.presentation.3', 1, 30)],
  },
  {
    id: 'reading',
    get label() {
      return tr('plan.tpl.reading');
    },
    types: ['reading'],
    steps: [step('plan.reading.1', 1, 45), step('plan.reading.2', 1, 45), step('plan.reading.3', 1, 60)],
  },
  {
    id: 'lab',
    get label() {
      return tr('plan.tpl.lab');
    },
    types: [],
    steps: [step('plan.lab.1', 1, 45), step('plan.lab.2', 2, 60), step('plan.lab.3', 2, 60), step('plan.lab.4', 1, 20)],
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
