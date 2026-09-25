// Syllabus box: find due dates in pasted syllabus / schedule text, without AI.
// Each line with a date becomes a suggested task; a line with a date range that mentions a break becomes a break.
import { dateKey, diffDays } from './dates';
import type { TaskType } from './types';

export interface FoundItem {
  kind: 'task';
  title: string;
  dateKey: string;
  type: TaskType;
  line: string;
}
export interface FoundBreak {
  kind: 'break';
  name: string;
  from: string;
  to: string;
  line: string;
}
export type Found = FoundItem | FoundBreak;

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
const WEEKDAY = '(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day|nesday|sday|urday|rsday)?\\.?,?';
// one pattern per format; each captures enough to build a date
const PATTERNS: { re: RegExp; numeric?: boolean; parse: (m: RegExpExecArray, dayFirst: boolean) => { y?: number; mo: number; d: number } | null }[] = [
  // 2026-10-14
  { re: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, parse: (m) => ({ y: +m[1], mo: +m[2] - 1, d: +m[3] }) },
  // Oct 14, October 14th 2026, Sept. 3
  {
    re: new RegExp(`\\b${MON}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, 'gi'),
    parse: (m) => ({ mo: MONTHS[m[1].toLowerCase().slice(0, 3)], d: +m[2], y: m[3] ? +m[3] : undefined }),
  },
  // 14 Oct, 3rd of September
  {
    re: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MON}(?:,?\\s+(\\d{4}))?\\b`, 'gi'),
    parse: (m) => ({ mo: MONTHS[m[2].toLowerCase().slice(0, 3)], d: +m[1], y: m[3] ? +m[3] : undefined }),
  },
  // 10/14, 10/14/26, 10-14-2026 (or 14/10 with dayFirst)
  {
    re: /\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?\b/g,
    numeric: true,
    parse: (m, dayFirst) => {
      const a = +m[1];
      const b = +m[2];
      const [mo, d] = dayFirst ? [b, a] : [a, b];
      if (mo < 1 || mo > 12) return null;
      const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : undefined;
      return { mo: mo - 1, d, y };
    },
  },
];

function valid(y: number, mo: number, d: number): boolean {
  const dt = new Date(y, mo, d);
  return dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d;
}

/** A date without a year lands in the school year around `today`: from ~2 months back to ~10 months ahead. */
function inferYear(mo: number, d: number, today: string): string | null {
  const y = +today.slice(0, 4);
  for (const yy of [y, y + 1, y - 1]) {
    if (!valid(yy, mo, d)) continue;
    const k = dateKey(new Date(yy, mo, d));
    const delta = diffDays(today, k);
    if (delta >= -60 && delta <= 305) return k;
  }
  return valid(y, mo, d) ? dateKey(new Date(y, mo, d)) : null;
}

interface Hit {
  key: string;
  start: number;
  end: number;
}

/** Every date in a line, in order, with where it sits. */
export function datesIn(line: string, today: string, dayFirst = false): Hit[] {
  const hits: Hit[] = [];
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(line))) {
      const start = m.index;
      const end = start + m[0].length;
      if (hits.some((h) => start < h.end && end > h.start)) continue; // already matched by an earlier format
      const r = p.parse(m, dayFirst);
      if (!r || r.mo === undefined || Number.isNaN(r.mo) || r.d < 1 || r.d > 31) continue;
      // "8/10 pts" is a score, not a date
      if (p.numeric && /^\s*(?:pts|points|%)/i.test(line.slice(end))) continue;
      const key = r.y !== undefined ? (valid(r.y, r.mo, r.d) ? dateKey(new Date(r.y, r.mo, r.d)) : null) : inferYear(r.mo, r.d, today);
      if (key) hits.push({ key, start, end });
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}

export function guessType(title: string): TaskType {
  const t = title.toLowerCase();
  if (/\b(midterm|final exam|final|exam|test|assessment)\b/.test(t)) return 'exam';
  if (/\bquiz(zes)?\b/.test(t)) return 'quiz';
  if (/\b(project|presentation|poster|portfolio)\b/.test(t)) return 'project';
  if (/\b(read|reading|chapter|ch\.|pages|pp\.)\b/.test(t)) return 'reading';
  return 'homework';
}

const BREAK_RE = /\b(break|holiday|vacation|recess|no school|no class(es)?|day off|thanksgiving|winter break|spring break)\b/i;

/** Clean the date and filler out of a line to get a title. */
function titleFrom(line: string, hits: Hit[]): string {
  let t = line;
  for (const h of [...hits].sort((a, b) => b.start - a.start)) t = t.slice(0, h.start) + ' ' + t.slice(h.end);
  t = t
    .replace(new RegExp(`\\b${WEEKDAY}`, 'gi'), ' ')
    .replace(/^\s*(?:[-*•·▪◦]|\d+[.)])\s+/, '') // list bullets
    .replace(/\b(due|due date|deadline)\b\s*[:-]?/gi, ' ')
    .replace(/\bweek\s+\d+\b/gi, ' ')
    .replace(/\(\s*\)|\[\s*\]/g, ' ')
    .replace(/\s*[:|]\s*|\s+[-–—,]+\s+|^\s*[-–—,]+|[-–—,]+\s*$/g, ' – ') // separators, but not dashes inside words or ranges (101–130)
    .replace(/\s+/g, ' ')
    .replace(/^[\s–]+|[\s–]+$/g, '');
  return t.length > 140 ? t.slice(0, 138) + '…' : t;
}

export function extractSyllabus(text: string, opts: { today: string; dayFirst?: boolean }): Found[] {
  const out: Found[] = [];
  const seen = new Set<string>();
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line || line.length > 400) continue;
    const hits = datesIn(line, opts.today, opts.dayFirst);
    if (!hits.length) continue;
    const title = titleFrom(line, hits);
    if (hits.length >= 2 && BREAK_RE.test(line)) {
      const [a, b] = [hits[0].key, hits[hits.length - 1].key].sort();
      if (diffDays(a, b) <= 21) {
        out.push({ kind: 'break', name: title.replace(/\s*–\s*/g, ' ').trim() || 'Break', from: a, to: b, line });
        continue;
      }
    }
    if (hits.length === 1 && BREAK_RE.test(line) && !/\b(due|quiz|test|exam|essay|project)\b/i.test(line)) {
      out.push({ kind: 'break', name: title.replace(/\s*–\s*/g, ' ').trim() || 'Day off', from: hits[0].key, to: hits[0].key, line });
      continue;
    }
    if (!title || title.length < 2 || /^[\d\s–]+$/.test(title)) continue;
    // a range of dates for one thing ("Oct 6–10 group project") is due at the end
    const key = hits[hits.length - 1].key;
    const dedupe = `${key}|${title.toLowerCase()}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({ kind: 'task', title, dateKey: key, type: guessType(title), line });
  }
  return out;
}

/** Items in the past (before today) are usually already done; the UI leaves them unchecked. */
export function isPast(f: Found, today: string): boolean {
  return (f.kind === 'task' ? f.dateKey : f.to) < today;
}
