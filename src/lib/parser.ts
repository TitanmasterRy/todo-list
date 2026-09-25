import type { Priority, Recurrence, TaskType } from './types';
import { addDays, combineDateTime, dateKey, startOfDay, startOfWeekKey, addDaysKey, fromKey } from './dates';

export interface ParserCourse {
  id: string;
  name: string;
}

export interface ParserContext {
  now?: Date;
  courses?: ParserCourse[];
  templates?: string[];
  weekStart?: 0 | 1;
}

export interface ParsedChip {
  kind: 'due' | 'course' | 'tag' | 'priority' | 'estimate' | 'recurrence' | 'template' | 'type';
  label: string;
}

export interface ParsedQuickAdd {
  title: string;
  dueAt?: string; // date-only key or ISO datetime
  dueKey?: string;
  hasTime: boolean;
  courseId?: string;
  courseName?: string;
  tags: string[];
  priority?: Priority;
  estimateMin?: number;
  recurrence?: Recurrence;
  template?: string;
  type?: TaskType;
  chips: ParsedChip[];
}

const DAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};
const DAY_RE = 'sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?';
const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};
const MONTH_RE = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABEL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Match a `#word` against course names: exact (normalized) first, then unique prefix of length ≥ 3. */
export function matchCourse(word: string, courses: ParserCourse[]): ParserCourse | undefined {
  const n = normalizeName(word);
  if (!n) return undefined;
  const exact = courses.find((c) => normalizeName(c.name) === n);
  if (exact) return exact;
  if (n.length < 3) return undefined;
  const prefix = courses.filter((c) => normalizeName(c.name).startsWith(n));
  if (prefix.length === 1) return prefix[0];
  // also allow matching the first word of a course name ("calc" -> "Calc II")
  const firstWord = courses.filter((c) => normalizeName(c.name.split(/\s+/)[0]) === n);
  if (firstWord.length === 1) return firstWord[0];
  return undefined;
}

function nextWeekday(from: Date, dow: number, includeToday: boolean): Date {
  const d = startOfDay(from);
  let diff = (dow - d.getDay() + 7) % 7;
  if (diff === 0 && !includeToday) diff = 7;
  return addDays(d, diff);
}

export function parseQuickAdd(input: string, ctx: ParserContext = {}): ParsedQuickAdd {
  const now = ctx.now ?? new Date();
  const courses = ctx.courses ?? [];
  const weekStart = ctx.weekStart ?? 1;
  let text = ` ${input.replace(/\s+/g, ' ')} `;
  const chips: ParsedChip[] = [];
  const out: ParsedQuickAdd = { title: '', tags: [], hasTime: false, chips };

  const take = (re: RegExp, fn: (m: RegExpExecArray) => void) => {
    let m: RegExpExecArray | null;
    let guard = 0;
    while ((m = re.exec(text)) && guard++ < 20) {
      fn(m);
      text = text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length);
      re.lastIndex = 0;
    }
  };

  // template: @name
  take(/(?:^|\s)@([\w-]+)(?=\s)/i, (m) => {
    out.template = m[1].toLowerCase();
    chips.push({ kind: 'template', label: `@${m[1]}` });
  });

  // priority: !high
  take(/(?:^|\s)!(low|normal|med|medium|high|urgent|p[1-4])(?=\s)/i, (m) => {
    const v = m[1].toLowerCase();
    const map: Record<string, Priority> = { low: 'low', normal: 'normal', med: 'normal', medium: 'normal', high: 'high', urgent: 'urgent', p4: 'low', p3: 'normal', p2: 'high', p1: 'urgent' };
    out.priority = map[v];
    chips.push({ kind: 'priority', label: `!${out.priority}` });
  });

  // estimate: ~45m ~2h ~1h30m ~90
  take(/(?:^|\s)~(\d+(?:\.\d+)?)(h|hr|hrs|m|min|mins)?(?:\s?(\d+)m)?(?=\s)/i, (m) => {
    const n = parseFloat(m[1]);
    const unit = (m[2] ?? 'm').toLowerCase();
    let min = unit.startsWith('h') ? Math.round(n * 60) : Math.round(n);
    if (m[3]) min += parseInt(m[3], 10);
    if (min > 0) {
      out.estimateMin = min;
      chips.push({ kind: 'estimate', label: `⏱ ${min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}` : `${min}m`}` });
    }
  });

  // type:exam
  take(/(?:^|\s)type:(homework|reading|exam|project|quiz|other)(?=\s)/i, (m) => {
    out.type = m[1].toLowerCase() as TaskType;
    chips.push({ kind: 'type', label: out.type });
  });

  // #course or #tag
  take(/(?:^|\s)#([\w-]+)(?=\s)/i, (m) => {
    const word = m[1];
    const course = !out.courseId ? matchCourse(word, courses) : undefined;
    if (course) {
      out.courseId = course.id;
      out.courseName = course.name;
      chips.push({ kind: 'course', label: course.name });
    } else {
      const tag = word.toLowerCase();
      if (!out.tags.includes(tag)) out.tags.push(tag);
      chips.push({ kind: 'tag', label: `#${tag}` });
    }
  });

  // recurrence (before dates so weekday names aren't eaten)
  take(/(?:^|\s)(every day|daily)(?=\s)/i, () => {
    out.recurrence = { kind: 'daily' };
    chips.push({ kind: 'recurrence', label: '🔁 every day' });
  });
  take(/(?:^|\s)(weekdays|every weekday)(?=\s)/i, () => {
    out.recurrence = { kind: 'weekdays' };
    chips.push({ kind: 'recurrence', label: '🔁 weekdays' });
  });
  take(/(?:^|\s)every (\d+) days?(?=\s)/i, (m) => {
    out.recurrence = { kind: 'everyNDays', n: parseInt(m[1], 10) };
    chips.push({ kind: 'recurrence', label: `🔁 every ${m[1]} days` });
  });
  take(/(?:^|\s)every other day(?=\s)/i, () => {
    out.recurrence = { kind: 'everyNDays', n: 2 };
    chips.push({ kind: 'recurrence', label: '🔁 every 2 days' });
  });
  take(new RegExp(`(?:^|\\s)every ((?:(?:${DAY_RE})(?:,?\\s|,))*(?:${DAY_RE}))(?=\\s)`, 'i'), (m) => {
    const days = m[1]
      .toLowerCase()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((d) => DAYS[d])
      .filter((d) => d !== undefined);
    const uniq = Array.from(new Set(days)).sort();
    out.recurrence = { kind: 'weekly', days: uniq };
    chips.push({ kind: 'recurrence', label: `🔁 every ${uniq.map((d) => DAY_LABEL[d]).join(' ')}` });
  });
  take(/(?:^|\s)(every week|weekly)(?=\s)/i, () => {
    out.recurrence = { kind: 'weekly' };
    chips.push({ kind: 'recurrence', label: '🔁 weekly' });
  });

  // dates
  let dueDate: Date | undefined;
  const setDate = (d: Date) => {
    dueDate = startOfDay(d);
  };
  take(/(?:^|\s)(today|tonight)(?=\s)/i, () => setDate(now));
  take(/(?:^|\s)(tomorrow|tmrw|tmr)(?=\s)/i, () => setDate(addDays(now, 1)));
  take(/(?:^|\s)(yesterday)(?=\s)/i, () => setDate(addDays(now, -1)));
  take(/(?:^|\s)next week(?=\s)/i, () => setDate(fromKey(addDaysKey(startOfWeekKey(dateKey(now), weekStart), 7))));
  take(new RegExp(`(?:^|\\s)next (${DAY_RE})(?=\\s)`, 'i'), (m) => {
    const dow = DAYS[m[1].toLowerCase()];
    const nextWeekStart = fromKey(addDaysKey(startOfWeekKey(dateKey(now), weekStart), 7));
    setDate(nextWeekday(nextWeekStart, dow, true));
  });
  take(/(?:^|\s)in (\d+) (days?|weeks?)(?=\s)/i, (m) => {
    const n = parseInt(m[1], 10);
    setDate(addDays(now, m[2].startsWith('week') ? n * 7 : n));
  });
  take(new RegExp(`(?:^|\\s)(?:on |this |due )?(${DAY_RE})(?=\\s)`, 'i'), (m) => {
    const dow = DAYS[m[1].toLowerCase()];
    setDate(nextWeekday(now, dow, true));
  });
  take(/(?:^|\s)(\d{4})-(\d{2})-(\d{2})(?=\s)/, (m) => {
    setDate(new Date(+m[1], +m[2] - 1, +m[3]));
  });
  take(/(?:^|\s)(?:on |due )?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s)/, (m) => {
    const month = +m[1] - 1;
    const day = +m[2];
    let year = m[3] ? +m[3] : now.getFullYear();
    if (m[3] && m[3].length === 2) year += 2000;
    let d = new Date(year, month, day);
    if (!m[3] && d.getTime() < startOfDay(now).getTime() - 86400000 * 30) d = new Date(year + 1, month, day);
    setDate(d);
  });
  take(new RegExp(`(?:^|\\s)(?:on |due )?(${MONTH_RE}) (\\d{1,2})(?:st|nd|rd|th)?(?:,? (\\d{4}))?(?=\\s)`, 'i'), (m) => {
    const month = MONTHS[m[1].toLowerCase().slice(0, 3)] ?? MONTHS[m[1].toLowerCase()];
    const day = +m[2];
    const year = m[3] ? +m[3] : now.getFullYear();
    let d = new Date(year, month, day);
    if (!m[3] && d.getTime() < startOfDay(now).getTime() - 86400000 * 30) d = new Date(year + 1, month, day);
    setDate(d);
  });
  take(new RegExp(`(?:^|\\s)(?:on |due )?(\\d{1,2})(?:st|nd|rd|th)? (${MONTH_RE})(?:,? (\\d{4}))?(?=\\s)`, 'i'), (m) => {
    const month = MONTHS[m[2].toLowerCase().slice(0, 3)] ?? MONTHS[m[2].toLowerCase()];
    const day = +m[1];
    const year = m[3] ? +m[3] : now.getFullYear();
    let d = new Date(year, month, day);
    if (!m[3] && d.getTime() < startOfDay(now).getTime() - 86400000 * 30) d = new Date(year + 1, month, day);
    setDate(d);
  });

  // time: 8pm, 8:30pm, at 20:00, noon, midnight
  let hours: number | undefined;
  let minutes = 0;
  take(/(?:^|\s)(?:at |@ )?(\d{1,2})(?::(\d{2}))?\s?(am|pm)(?=\s)/i, (m) => {
    let h = +m[1] % 12;
    if (m[3].toLowerCase() === 'pm') h += 12;
    hours = h;
    minutes = m[2] ? +m[2] : 0;
  });
  take(/(?:^|\s)(?:at )(\d{1,2}):(\d{2})(?=\s)/i, (m) => {
    hours = +m[1];
    minutes = +m[2];
  });
  take(/(?:^|\s)(\d{1,2}):(\d{2})(?=\s)/, (m) => {
    if (+m[1] < 24 && +m[2] < 60) {
      hours = +m[1];
      minutes = +m[2];
    }
  });
  take(/(?:^|\s)(?:at )?(noon|midnight)(?=\s)/i, (m) => {
    hours = m[1].toLowerCase() === 'noon' ? 12 : 0;
    minutes = 0;
  });

  if (hours !== undefined && !dueDate) {
    // time without a date: today, or tomorrow if that time already passed
    const candidate = new Date(now);
    candidate.setHours(hours, minutes, 0, 0);
    dueDate = startOfDay(candidate.getTime() < now.getTime() ? addDays(now, 1) : now);
  }
  if (dueDate) {
    const key = dateKey(dueDate);
    out.dueKey = key;
    if (hours !== undefined) {
      out.dueAt = combineDateTime(key, hours, minutes);
      out.hasTime = true;
    } else {
      out.dueAt = key;
    }
    chips.push({ kind: 'due', label: `📅 ${describeDateKey(key, now)}${hours !== undefined ? ` ${formatHM(hours, minutes)}` : ''}` });
  }

  out.title = text.replace(/\s+/g, ' ').trim();
  return out;
}

function formatHM(h: number, m: number): string {
  const ampm = h >= 12 ? 'pm' : 'am';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hh}:${String(m).padStart(2, '0')}${ampm}` : `${hh}${ampm}`;
}

export function describeDateKey(key: string, now: Date): string {
  const today = dateKey(now);
  if (key === today) return 'Today';
  if (key === dateKey(addDays(now, 1))) return 'Tomorrow';
  const d = fromKey(key);
  const diff = Math.round((d.getTime() - startOfDay(now).getTime()) / 86400000);
  if (diff > 1 && diff < 7) return DAY_LABEL[d.getDay()];
  return `${DAY_LABEL[d.getDay()]} ${MONTH_LABEL[d.getMonth()]} ${d.getDate()}`;
}
