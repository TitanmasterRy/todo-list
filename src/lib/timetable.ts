// School timetable: bell schedules, A/B (or 1–4) rotation days, class meetings, and "what's on now".
// Pure functions over a SchoolSchedule; breaks (Settings → Break mode) and "no school" overrides skip days.
import { addDaysKey, dateKey, fromKey } from './dates';
import { uid } from './id';
import type { AttendanceMark, BellPeriod, BellSchedule, BreakRange, ClassMeeting, SchoolSchedule } from './types';

export function emptySchedule(): SchoolSchedule {
  return {
    updatedAt: new Date(0).toISOString(),
    bells: [defaultBell()],
    schoolDays: [1, 2, 3, 4, 5],
    rotation: [],
    overrides: {},
    classes: [],
  };
}

/** A typical 7-period day to start from. */
export function defaultBell(): BellSchedule {
  const times: [string, string, string][] = [
    ['Period 1', '08:00', '08:50'],
    ['Period 2', '08:55', '09:45'],
    ['Period 3', '09:50', '10:40'],
    ['Period 4', '10:45', '11:35'],
    ['Lunch', '11:35', '12:10'],
    ['Period 5', '12:15', '13:05'],
    ['Period 6', '13:10', '14:00'],
    ['Period 7', '14:05', '14:55'],
  ];
  return { id: uid('bell'), name: 'Regular', periods: times.map(([name, start, end]) => ({ id: uid('per'), name, start, end })) };
}

function inBreak(key: string, breaks: BreakRange[] | undefined): boolean {
  return !!breaks?.some((b) => !b.deleted && b.from <= key && key <= b.to);
}

export function isSchoolDay(s: SchoolSchedule, key: string, breaks?: BreakRange[]): boolean {
  if (s.overrides[key]?.noSchool) return false;
  if (!s.schoolDays.includes(fromKey(key).getDay())) return false;
  return !inBreak(key, breaks);
}

/** Today's rotation label ("A"), counted in school days from the start day or the latest forced day before it. */
export function rotationDay(s: SchoolSchedule, key: string, breaks?: BreakRange[]): string | undefined {
  if (!s.rotation.length || !isSchoolDay(s, key, breaks)) return undefined;
  const forced = s.overrides[key]?.rotation;
  if (forced && s.rotation.includes(forced)) return forced;
  // anchors: the start day and every forced day. Count from the latest one on or before `key`,
  // or back from the earliest one when `key` comes before all of them.
  const anchors = Object.entries(s.overrides)
    .filter(([, o]) => o.rotation && s.rotation.includes(o.rotation))
    .map(([k, o]) => ({ key: k, label: o.rotation! }));
  if (s.rotationStart) anchors.push({ key: s.rotationStart, label: s.rotation[0] });
  anchors.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const anchor = [...anchors].reverse().find((a) => a.key <= key) ?? anchors[0];
  if (!anchor) return undefined;
  let n = 0;
  if (anchor.key <= key) {
    for (let k = addDaysKey(anchor.key, 1); k <= key; k = addDaysKey(k, 1)) if (isSchoolDay(s, k, breaks)) n++;
  } else {
    for (let k = key; k < anchor.key; k = addDaysKey(k, 1)) if (isSchoolDay(s, k, breaks)) n--;
  }
  const len = s.rotation.length;
  return s.rotation[(((s.rotation.indexOf(anchor.label) + n) % len) + len) % len];
}

/** The bell schedule for a day: a one-day override, then a weekday rule, then the regular one. */
export function bellFor(s: SchoolSchedule, key: string): BellSchedule | undefined {
  const id = s.overrides[key]?.bellId ?? s.weekdayBells?.[fromKey(key).getDay()];
  return s.bells.find((b) => b.id === id) ?? s.bells[0];
}

/** Find a meeting's period in a given bell: same id, or the same name on another bell ("Period 3" on early release). */
function periodIn(s: SchoolSchedule, bell: BellSchedule, periodId: string): BellPeriod | undefined {
  const direct = bell.periods.find((p) => p.id === periodId);
  if (direct) return direct;
  const name = s.bells
    .flatMap((b) => b.periods)
    .find((p) => p.id === periodId)
    ?.name.trim()
    .toLowerCase();
  return name ? bell.periods.find((p) => p.name.trim().toLowerCase() === name) : undefined;
}

export interface Slot {
  period: BellPeriod;
  meetings: ClassMeeting[];
}

/** Every period of the day in order, with the classes that meet in it. Empty on days without school. */
export function daySlots(s: SchoolSchedule, key: string, breaks?: BreakRange[]): Slot[] {
  if (!isSchoolDay(s, key, breaks)) return [];
  const bell = bellFor(s, key);
  if (!bell) return [];
  const rot = rotationDay(s, key, breaks);
  const dow = fromKey(key).getDay();
  const slots: Slot[] = [...bell.periods].sort((a, b) => (a.start < b.start ? -1 : 1)).map((period) => ({ period, meetings: [] }));
  for (const m of s.classes) {
    if (m.rotationDays?.length && (!rot || !m.rotationDays.includes(rot))) continue;
    if (m.weekdays?.length && !m.weekdays.includes(dow)) continue;
    const p = periodIn(s, bell, m.periodId);
    const slot = p && slots.find((x) => x.period.id === p.id);
    if (slot) slot.meetings.push(m);
  }
  return slots;
}

function hm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function minutesBetween(a: string, b: string): number {
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  return bh * 60 + bm - (ah * 60 + am);
}

export interface NowInfo {
  rotation?: string;
  current?: Slot;
  minutesLeft?: number;
  next?: Slot;
  minutesUntilNext?: number;
  /** School's out for the day (or no school today). */
  done: boolean;
  schoolDay: boolean;
}

/** What's happening at `now`: the current period, time left, and what's next. */
export function whatsNow(s: SchoolSchedule, now: Date, breaks?: BreakRange[]): NowInfo {
  const key = dateKey(now);
  const slots = daySlots(s, key, breaks);
  const t = hm(now);
  if (!slots.length) return { done: true, schoolDay: false };
  const current = slots.find((x) => x.period.start <= t && t < x.period.end);
  const next = slots.find((x) => x.period.start > t);
  return {
    rotation: rotationDay(s, key, breaks),
    current,
    minutesLeft: current ? minutesBetween(t, current.period.end) : undefined,
    next,
    minutesUntilNext: next ? minutesBetween(t, next.period.start) : undefined,
    done: !current && !next,
    schoolDay: true,
  };
}

/** The next day (after `fromKey`) this course meets, with that period's start time. Searches up to `maxDays` ahead. */
export function nextMeeting(s: SchoolSchedule, courseId: string, fromKey: string, breaks?: BreakRange[], maxDays = 60): { key: string; start: string } | undefined {
  if (!s.classes.some((m) => m.courseId === courseId)) return undefined;
  for (let i = 1, k = addDaysKey(fromKey, 1); i <= maxDays; i++, k = addDaysKey(k, 1)) {
    const slot = daySlots(s, k, breaks).find((x) => x.meetings.some((m) => m.courseId === courseId));
    if (slot) return { key: k, start: slot.period.start };
  }
  return undefined;
}

/** "HH:MM" as 12- or 24-hour text. */
export function formatHM(t: string, format: '12h' | '24h' = '12h'): string {
  if (format === '24h') return t;
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/** Check a bell schedule for mistakes the editor should point out. */
export function bellProblems(b: BellSchedule): string[] {
  const out: string[] = [];
  const sorted = [...b.periods].sort((x, y) => (x.start < y.start ? -1 : 1));
  for (const p of sorted) {
    if (!/^\d\d:\d\d$/.test(p.start) || !/^\d\d:\d\d$/.test(p.end)) out.push(`${p.name || 'A period'} needs a start and end time.`);
    else if (p.end <= p.start) out.push(`${p.name || 'A period'} ends before it starts.`);
  }
  for (let i = 1; i < sorted.length; i++) if (sorted[i].start < sorted[i - 1].end) out.push(`${sorted[i - 1].name} and ${sorted[i].name} overlap.`);
  return out;
}

// ---------- attendance ----------
export const ATTENDANCE: { id: AttendanceMark; label: string; emoji: string }[] = [
  { id: 'present', label: 'Present', emoji: '✓' },
  { id: 'late', label: 'Late', emoji: '⏰' },
  { id: 'absent', label: 'Absent', emoji: '✗' },
  { id: 'excused', label: 'Excused', emoji: '📝' },
];

export interface AttendanceSummary {
  courseId: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  /** Share of counted classes you were there for (late counts as there; excused doesn't count either way). */
  rate: number | null;
}

/** Totals per course from the marks (unmarked classes aren't counted). */
export function attendanceSummary(s: SchoolSchedule): AttendanceSummary[] {
  const byCourse = new Map<string, AttendanceSummary>();
  const courseOf = new Map(s.classes.map((m) => [m.id, m.courseId]));
  for (const marks of Object.values(s.attendance ?? {})) {
    for (const [meetingId, mark] of Object.entries(marks)) {
      const courseId = courseOf.get(meetingId);
      if (!courseId) continue;
      const row = byCourse.get(courseId) ?? { courseId, present: 0, late: 0, absent: 0, excused: 0, rate: null };
      row[mark]++;
      byCourse.set(courseId, row);
    }
  }
  for (const r of byCourse.values()) {
    const counted = r.present + r.late + r.absent;
    r.rate = counted ? (r.present + r.late) / counted : null;
  }
  return [...byCourse.values()];
}

/** Class meetings on recent school days (newest first), for marking attendance after the fact. */
export function recentMeetings(s: SchoolSchedule, today: string, days = 14, breaks?: BreakRange[]): { key: string; slot: Slot; meeting: ClassMeeting }[] {
  const out: { key: string; slot: Slot; meeting: ClassMeeting }[] = [];
  for (let i = 0, k = today; i < days; i++, k = addDaysKey(k, -1)) {
    for (const slot of daySlots(s, k, breaks)) for (const meeting of slot.meetings) out.push({ key: k, slot, meeting });
  }
  return out;
}
