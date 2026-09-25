// "What should I do now?": rank open tasks by how much doing them now helps.
import { dueKey, diffDays, isDateOnly, parseDue } from './dates';
import type { Priority, Task } from './types';

export interface Pick {
  task: Task;
  score: number;
  reasons: string[];
}

const PRIORITY_POINTS: Record<Priority, number> = { low: 0, normal: 10, high: 25, urgent: 40 };

/**
 * Score one task. Higher = do it sooner. Deadlines dominate (overdue > today > this week), then priority,
 * grade weight, exams/projects that need a head start, the day's frog, and whether it fits the time you have.
 */
export function scoreTask(t: Task, now: Date, opts: { today: string; minutesFree?: number; courseName?: (id?: string) => string | undefined } = { today: '' }): Pick {
  const reasons: string[] = [];
  let score = PRIORITY_POINTS[t.priority] ?? 10;
  if (t.priority === 'urgent' || t.priority === 'high') reasons.push(`${t.priority} priority`);

  if (t.dueAt) {
    const days = diffDays(opts.today, dueKey(t.dueAt));
    const due = isDateOnly(t.dueAt) ? null : parseDue(t.dueAt);
    const hoursLeft = due ? (due.getTime() - now.getTime()) / 3_600_000 : null;
    if (days < 0) {
      score += 70 + Math.min(20, -days * 4);
      reasons.push(days === -1 ? 'overdue since yesterday' : `overdue by ${-days} days`);
    } else if (days === 0) {
      score += hoursLeft !== null && hoursLeft < 3 ? 75 : 60;
      reasons.push(hoursLeft !== null && hoursLeft < 3 && hoursLeft > 0 ? `due in ${Math.max(1, Math.round(hoursLeft * 60))} min` : 'due today');
    } else if (days === 1) {
      score += 45;
      reasons.push('due tomorrow');
    } else if (days <= 7) {
      score += 35 - days * 3;
      reasons.push(`due in ${days} days`);
    } else {
      score += Math.max(0, 10 - (days - 7));
    }
    // big work needs a head start: exams and projects count as closer than they are
    if ((t.type === 'exam' || t.type === 'project') && days > 0 && days <= 10) {
      score += 12;
      reasons.push(t.type === 'exam' ? 'exam coming up: start studying' : 'project: get ahead');
    }
  } else if (t.pinnedDay === opts.today) {
    score += 30;
    reasons.push('planned for today');
  }

  if (t.weight && t.weight > 0) {
    score += Math.min(20, t.weight / 2);
    if (t.weight >= 15) reasons.push(`${t.weight}% of the grade`);
  }
  if (t.frog && t.frogDate === opts.today) {
    score += 25;
    reasons.push('your frog for today');
  }
  // tasks snoozed again and again: nudge them up a little
  if (t.deferredCount >= 2) {
    score += Math.min(12, t.deferredCount * 3);
    reasons.push(`snoozed ${t.deferredCount}×`);
  }
  // prefer something that fits the time you have left today
  if (opts.minutesFree !== undefined && t.estimateMin) {
    if (t.estimateMin <= opts.minutesFree) score += 5;
    else score -= 10;
  }
  // a partly done task is quicker to finish
  const done = t.subtasks.filter((s) => s.done).length;
  if (done && done < t.subtasks.length) {
    score += 6;
    reasons.push(`${done}/${t.subtasks.length} steps done`);
  }
  return { task: t, score, reasons };
}

/** Best tasks to do now, highest score first. */
export function whatNow(tasks: Task[], now: Date, opts: { today: string; minutesFree?: number; limit?: number }): Pick[] {
  return tasks
    .filter((t) => !t.completedAt && !t.archived)
    .map((t) => scoreTask(t, now, opts))
    .sort((a, b) => b.score - a.score || (a.task.dueAt ?? '9').localeCompare(b.task.dueAt ?? '9') || a.task.order - b.task.order)
    .slice(0, opts.limit ?? 3);
}
