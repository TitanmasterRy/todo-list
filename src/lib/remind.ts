// Per-task reminder rules and when they fire. Rules are relative to the due date so they move with it.
import { addDaysKey, dueKey, fromKey, isDateOnly } from './dates';
import type { ReminderRule, Task } from './types';
import { intlLocale, t, type MessageKey } from './i18n/index.svelte';

// `label` follows the app language
const preset = (key: MessageKey, rule: ReminderRule) => ({
  rule,
  get label() {
    return t(key);
  },
});
export const REMINDER_PRESETS: { label: string; rule: ReminderRule }[] = [
  preset('remind.atDue', { before: 0 }),
  preset('remind.10min', { before: 10 }),
  preset('remind.30min', { before: 30 }),
  preset('remind.1h', { before: 60 }),
  preset('remind.3h', { before: 180 }),
  preset('remind.1day', { before: 1440 }),
  preset('remind.nightBefore', { nightBefore: true }),
  preset('remind.morningOf', { morningOf: true }),
];

export function ruleLabel(r: ReminderRule): string {
  if ('at' in r) return new Date(r.at).toLocaleString(intlLocale() === 'en' ? [] : intlLocale(), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return REMINDER_PRESETS.find((p) => JSON.stringify(p.rule) === JSON.stringify(r))?.label ?? ('before' in r ? t('remind.minBefore', { n: r.before }) : t('remind.reminder'));
}

export function ruleKey(r: ReminderRule): string {
  return JSON.stringify(r);
}

/** Due moment: the exact time, or 11:59 pm on the due day for date-only tasks (and 9 am as the "time" for before-rules). */
function dueMoment(t: Task): Date | null {
  if (!t.dueAt) return null;
  if (!isDateOnly(t.dueAt)) return new Date(t.dueAt);
  const d = fromKey(dueKey(t.dueAt));
  d.setHours(9, 0, 0, 0);
  return d;
}

/** When a rule fires for a task (null when it can't: no due date for a relative rule). */
export function fireTime(t: Task, r: ReminderRule): Date | null {
  if ('at' in r) return new Date(r.at);
  if (!t.dueAt) return null;
  const key = dueKey(t.dueAt);
  if ('nightBefore' in r) {
    const d = fromKey(addDaysKey(key, -1));
    d.setHours(20, 0, 0, 0);
    return d;
  }
  if ('morningOf' in r) {
    const d = fromKey(key);
    d.setHours(8, 0, 0, 0);
    return d;
  }
  const due = dueMoment(t);
  return due ? new Date(due.getTime() - r.before * 60_000) : null;
}

/** Reminders that should fire now: fire time passed within the last `graceMin` minutes and not already sent. */
export function dueReminders(tasks: Task[], now: Date, sent: Set<string>, graceMin = 10): { task: Task; rule: ReminderRule; key: string; at: Date }[] {
  const out: { task: Task; rule: ReminderRule; key: string; at: Date }[] = [];
  for (const t of tasks) {
    if (t.completedAt || !t.reminders?.length) continue;
    for (const r of t.reminders) {
      const at = fireTime(t, r);
      if (!at) continue;
      const key = `${t.id}:${t.dueAt ?? ''}:${ruleKey(r)}`;
      const delta = now.getTime() - at.getTime();
      if (delta >= 0 && delta <= graceMin * 60_000 && !sent.has(key)) out.push({ task: t, rule: r, key, at });
    }
  }
  return out;
}
