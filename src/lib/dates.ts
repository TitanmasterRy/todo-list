// Date helpers. All "day keys" are local-time YYYY-MM-DD strings.
// User-facing formatters follow the app language: English keeps the hand-written short forms ("Tomorrow 8pm",
// "Oct 5"), other languages use Intl with the browser's region ("mañana 17:00", "5 oct").
import { intlLocale, locale, t } from './i18n/index.svelte';

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formats = new Map<string, Intl.DateTimeFormat>();
function dtf(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const id = `${intlLocale()}|${JSON.stringify(opts)}`;
  let f = formats.get(id);
  if (!f) formats.set(id, (f = new Intl.DateTimeFormat(intlLocale(), opts)));
  return f;
}
// any date with the wanted weekday (2026-01-04 was a Sunday)
const onWeekday = (dow: number) => new Date(2026, 0, 4 + dow);

/** Weekday name for 0 (Sunday) – 6 in the app language: "Mon" / "lun", or "Monday" / "lunes" with `long`. */
export function dayName(dow: number, width: 'short' | 'long' = 'short'): string {
  if (locale() === 'en') return (width === 'long' ? DAY_NAMES : DAY_SHORT)[dow];
  return dtf({ weekday: width }).format(onWeekday(dow));
}

/** Short month name for 0 – 11: "Oct" / "oct". */
export function monthName(month: number, width: 'short' | 'long' = 'short'): string {
  if (locale() === 'en' && width === 'short') return MONTH_SHORT[month];
  return dtf({ month: width }).format(new Date(2026, month, 1));
}

/** "Oct 5" / "5 oct" (with the year when it's not the current one). */
export function formatMonthDay(d: Date, now: Date = new Date()): string {
  const withYear = d.getFullYear() !== now.getFullYear();
  if (locale() === 'en') return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}${withYear ? ` ${d.getFullYear()}` : ''}`;
  return dtf(withYear ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' }).format(d);
}

/** "Monday, Oct 5" / "lunes, 5 oct". */
export function formatWeekdayDate(d: Date): string {
  if (locale() === 'en') return `${DAY_NAMES[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
  return dtf({ weekday: 'long', day: 'numeric', month: 'short' }).format(d);
}

export function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

/** Local YYYY-MM-DD for a Date. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(now: Date = new Date()): string {
  return dateKey(now);
}

export function isDateOnly(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso);
}

/** Parse a YYYY-MM-DD key into a local Date at midnight. */
export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Parse a dueAt (date-only or ISO datetime) into a local Date. Date-only means local midnight. */
export function parseDue(iso: string): Date {
  if (isDateOnly(iso)) return fromKey(iso);
  return new Date(iso);
}

/** Day key for a dueAt value. */
export function dueKey(iso: string): string {
  return isDateOnly(iso) ? iso : dateKey(new Date(iso));
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addDaysKey(key: string, n: number): string {
  return dateKey(addDays(fromKey(key), n));
}

export function diffDays(aKey: string, bKey: string): number {
  // whole days from a to b
  const a = fromKey(aKey).getTime();
  const b = fromKey(bKey).getTime();
  return Math.round((b - a) / 86400000);
}

/** Format local datetime as ISO without timezone shifting surprises (keeps local wall time, marks as ISO string w/ offset). */
export function toLocalISO(d: Date): string {
  return d.toISOString();
}

/** Combine a day key with hours/minutes into an ISO datetime string. */
export function combineDateTime(key: string, hours: number, minutes: number): string {
  const d = fromKey(key);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

/** Is the task overdue as of now? Date-only tasks are overdue only once the day has passed. */
export function isOverdue(dueAt: string | undefined, now: Date = new Date()): boolean {
  if (!dueAt) return false;
  if (isDateOnly(dueAt)) return dueAt < todayKey(now);
  return new Date(dueAt).getTime() < now.getTime();
}

export function isDueToday(dueAt: string | undefined, now: Date = new Date()): boolean {
  if (!dueAt) return false;
  return dueKey(dueAt) === todayKey(now);
}

export function isDueBefore(dueAt: string | undefined, key: string): boolean {
  if (!dueAt) return false;
  return dueKey(dueAt) < key;
}

/** Start of the week (as key) containing `key`, honoring weekStart (0 Sun / 1 Mon). */
export function startOfWeekKey(key: string, weekStart: 0 | 1 = 1): string {
  const d = fromKey(key);
  const dow = d.getDay();
  const diff = (dow - weekStart + 7) % 7;
  return dateKey(addDays(d, -diff));
}

export function endOfWeekKey(key: string, weekStart: 0 | 1 = 1): string {
  return addDaysKey(startOfWeekKey(key, weekStart), 6);
}

/** Next Saturday (or today if it's already the weekend? no: the coming Saturday; if today is Sat/Sun, the next Saturday). */
export function thisWeekendKey(now: Date = new Date()): string {
  const d = startOfDay(now);
  const dow = d.getDay();
  let diff = (6 - dow + 7) % 7;
  if (diff === 0) diff = 7; // today is Saturday -> next Saturday
  if (dow === 0) diff = 6; // Sunday -> next Saturday
  return dateKey(addDays(d, diff));
}

/** Next Monday. */
export function nextWeekKey(now: Date = new Date(), weekStart: 0 | 1 = 1): string {
  const d = startOfDay(now);
  const dow = d.getDay();
  let diff = (weekStart - dow + 7) % 7;
  if (diff === 0) diff = 7;
  return dateKey(addDays(d, diff));
}

export function formatTime(d: Date, timeFormat: '12h' | '24h' = '12h'): string {
  const h = d.getHours();
  const m = d.getMinutes();
  if (timeFormat === '24h') return `${pad(h)}:${pad(m)}`;
  if (locale() !== 'en') return dtf(m === 0 ? { hour: 'numeric', hour12: true } : { hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hh}${ampm}` : `${hh}:${pad(m)}${ampm}`;
}

/** Human label for a due value: "Today", "Tomorrow 8pm", "Mon", "Sep 21", "Yesterday", "3 days ago". */
export function formatDue(dueAt: string | undefined, now: Date = new Date(), timeFormat: '12h' | '24h' = '12h'): string {
  if (!dueAt) return '';
  const key = dueKey(dueAt);
  const today = todayKey(now);
  const delta = diffDays(today, key);
  let day: string;
  if (delta === 0) day = t('date.today');
  else if (delta === 1) day = t('date.tomorrow');
  else if (delta === -1) day = t('date.yesterday');
  else if (delta < -1 && delta > -7) day = locale() === 'en' ? `${-delta} days ago` : relativeDays(delta);
  else if (delta > 1 && delta < 7) day = dayName(fromKey(key).getDay());
  else day = formatMonthDay(fromKey(key), now);
  if (!isDateOnly(dueAt)) {
    day += ` ${formatTime(new Date(dueAt), timeFormat)}`;
  }
  return day;
}

export function formatDayHeading(key: string, now: Date = new Date()): string {
  const today = todayKey(now);
  const delta = diffDays(today, key);
  const d = fromKey(key);
  if (locale() !== 'en') {
    const md = dtf({ weekday: 'short', day: 'numeric', month: 'short' }).format(d);
    if (delta >= -1 && delta <= 1) return `${t(delta === 0 ? 'date.today' : delta === 1 ? 'date.tomorrow' : 'date.yesterday')} · ${md}`;
    return `${dayName(d.getDay(), 'long')} · ${dtf({ day: 'numeric', month: 'short' }).format(d)}`;
  }
  const md = `${DAY_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
  if (delta === 0) return `Today · ${md}`;
  if (delta === 1) return `Tomorrow · ${md}`;
  if (delta === -1) return `Yesterday · ${md}`;
  return `${DAY_NAMES[d.getDay()]} · ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

const relFormats = new Map<string, Intl.RelativeTimeFormat>();
/** "3 days ago" / "hace 3 días" / "en 2 días" via Intl.RelativeTimeFormat. */
export function relativeDays(delta: number): string {
  let f = relFormats.get(intlLocale());
  if (!f) relFormats.set(intlLocale(), (f = new Intl.RelativeTimeFormat(intlLocale(), { numeric: 'auto' })));
  return f.format(delta, 'day');
}

export function formatMinutes(min: number): string {
  if (!min) return t('duration.m', { m: 0 });
  if (min < 60) return t('duration.m', { m: min });
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? t('duration.hm', { h, m }) : t('duration.h', { h });
}

export function isoNow(): string {
  return new Date().toISOString();
}

/** Days ago as a key. */
export function daysAgoKey(n: number, now: Date = new Date()): string {
  return dateKey(addDays(startOfDay(now), -n));
}
