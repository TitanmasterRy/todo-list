// Turn Gmail messages into homework suggestions. Pure functions, no network — see google.svelte.ts for the API side.
import { parseQuickAdd } from './parser';
import { matchCourseName } from './schoology';

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string; // ISO
  snippet: string;
  url: string; // link to the thread in Gmail
}

export type Confidence = 'high' | 'medium' | 'low';

export interface Suggestion {
  messageId: string;
  title: string;
  dueAt?: string; // 'YYYY-MM-DD' or ISO datetime
  courseId?: string;
  confidence: Confidence;
  reason: string;
  url: string;
}

const KEYWORDS = [
  'assignment', 'homework', 'hw', 'due', 'quiz', 'test', 'exam', 'midterm', 'final', 'project', 'essay', 'paper', 'lab',
  'worksheet', 'reading', 'read', 'chapter', 'submit', 'submission', 'problem set', 'pset', 'deadline', 'turn in', 'packet',
];
const NOISE = ['newsletter', 'unsubscribe', 'digest', 'sale', '% off', 'webinar', 'promo', 'receipt', 'order confirmation', 'invoice'];

const DAY = 'sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?';
const MONTH = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const DATE_TOKEN =
  `(?:today|tonight|tomorrow|tmrw|next\\s+(?:week|${DAY})|(?:this\\s+)?(?:${DAY})|\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?|\\d{4}-\\d{2}-\\d{2}` +
  `|(?:${MONTH})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?|\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH}))`;
const TIME_TAIL = `((?:[ ,]+(?:at\\s+)?(?:\\d{1,2}(?::\\d{2})?\\s?(?:am|pm)|noon|midnight))?)`;
const DUE_RE = new RegExp(
  `\\b(?:due|deadline|submit(?:ted)?|turn(?:ed)?\\s+in|hand(?:ed)?\\s+in|finish(?:ed)?|complete(?:d)?)(?:\\s*(?:date|is|on|by|before|:|-|–))*\\s*\\b(${DATE_TOKEN})\\b${TIME_TAIL}`,
  'i',
);
const BY_RE = new RegExp(`\\bby\\s+\\b(${DATE_TOKEN})\\b${TIME_TAIL}`, 'i');
const CLASSROOM_SUBJECT = /^(new assignment|assignment|new question|due (?:tomorrow|today|soon)|reminder|missing work)\s*:\s*["“]?(.+?)["”]?\s*$/i;

interface DueHit {
  dueAt: string;
  fragment: string; // the text that produced the date, e.g. "due Friday"
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** "due Friday", "by 9/20", "Due Sep 18, 11:59 PM" → a due value via the quick-add parser. */
function explicitDue(text: string, now: Date): DueHit | undefined {
  for (const re of [DUE_RE, BY_RE]) {
    const m = re.exec(text);
    if (!m) continue;
    const fragment = `${m[1]} ${m[2] ?? ''}`.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    const parsed = parseQuickAdd(fragment, { now });
    if (parsed.dueAt) return { dueAt: parsed.dueAt, fragment: m[0].trim() };
  }
  return undefined;
}

/** Any date the quick-add parser can find in the text (less trustworthy than an explicit "due …"). */
function looseDue(text: string, now: Date): { dueAt: string; title: string } | undefined {
  const parsed = parseQuickAdd(text.replace(/,/g, ' '), { now });
  return parsed.dueAt ? { dueAt: parsed.dueAt, title: parsed.title } : undefined;
}

/** Strip Re:/Fwd: and leading [brackets]; returns the bracket contents for course matching. */
export function cleanSubject(raw: string): { title: string; brackets: string[] } {
  let s = raw.replace(/\s+/g, ' ').trim();
  const brackets: string[] = [];
  for (let guard = 0; guard < 10; guard++) {
    const re = /^(?:re|fwd?|fw|aw|wg)\s*:\s*/i.exec(s);
    if (re) {
      s = s.slice(re[0].length);
      continue;
    }
    const br = /^\[([^\]]*)\]\s*/.exec(s);
    if (br) {
      if (br[1].trim()) brackets.push(br[1].trim());
      s = s.slice(br[0].length);
      continue;
    }
    break;
  }
  return { title: s.trim(), brackets };
}

function tidyTitle(s: string): string {
  let t = s
    .replace(/^(?:homework|hw|assignment|reminder|action required|important|fyi)\s*[:\-–]\s*/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–:,;(]+|[\s\-–:,;(]+$/g, '')
    .trim();
  for (let guard = 0; guard < 3; guard++) {
    const next = t.replace(/\s+(?:for|on|by|due|at|until|before|is|the|this|next|and)$/i, '').trim();
    if (next === t) break;
    t = next;
  }
  t = t.replace(/^["“']+|["”']+$/g, '').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

function keywordsIn(text: string): string[] {
  const t = text.toLowerCase();
  return KEYWORDS.filter((k) => new RegExp(`\\b${escapeRe(k)}\\b`).test(t));
}

function findCourse(texts: string[], brackets: string[], courses: { id: string; name: string }[]): { id: string; how: string } | undefined {
  for (const b of brackets) {
    const id = matchCourseName(b, courses);
    if (id) return { id, how: `[${b}]` };
  }
  const hay = texts.join(' \n ').toLowerCase();
  const usable = courses.filter((c) => c.name.trim().length >= 3);
  for (const c of usable) {
    if (new RegExp(`\\b${escapeRe(c.name.toLowerCase())}`).test(hay)) return { id: c.id, how: c.name };
  }
  const normHay = hay.replace(/[^a-z0-9]+/g, ' ');
  for (const c of usable) {
    const n = c.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (n.length >= 3 && new RegExp(`\\b${escapeRe(n)}`).test(normHay)) return { id: c.id, how: c.name };
  }
  const byFirstWord = usable.filter((c) => {
    const w = c.name.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    return w.length >= 4 && new RegExp(`\\b${escapeRe(w)}`).test(hay);
  });
  if (byFirstWord.length === 1) return { id: byFirstWord[0].id, how: byFirstWord[0].name };
  return undefined;
}

const RANK: Record<Confidence, number> = { high: 0, medium: 1, low: 2 };

function lower(c: Confidence): Confidence {
  return c === 'high' ? 'medium' : 'low';
}

/**
 * Pick out messages that look like assignments. Google Classroom notifications are trusted;
 * other mail is scored by assignment words in the subject/snippet plus an extractable due date.
 */
export function extractAssignmentsFromMail(messages: GmailMessage[], courses: { id: string; name: string }[], now: Date): Suggestion[] {
  const out: Suggestion[] = [];
  for (const msg of messages) {
    const { title: subject, brackets } = cleanSubject(msg.subject ?? '');
    const snippet = (msg.snippet ?? '').replace(/\s+/g, ' ').trim();
    const from = msg.from ?? '';
    const reasons: string[] = [];
    let title = '';
    let dueAt: string | undefined;
    let confidence: Confidence;

    const isClassroom = /classroom\.google\.com/i.test(from);
    const cm = isClassroom ? CLASSROOM_SUBJECT.exec(subject) : null;

    if (cm) {
      title = tidyTitle(cm[2]);
      confidence = 'high';
      reasons.push('Google Classroom notification');
      const hit = explicitDue(snippet, now) ?? explicitDue(subject, now);
      if (hit) {
        dueAt = hit.dueAt;
        reasons.push(hit.fragment);
      } else if (/^due (tomorrow|today)/i.test(subject)) {
        const loose = looseDue(subject.split(':')[0], now);
        if (loose) {
          dueAt = loose.dueAt;
          reasons.push(subject.split(':')[0].toLowerCase());
        }
      }
    } else {
      const subjKw = keywordsIn(subject);
      const snipKw = keywordsIn(snippet).filter((k) => !subjKw.includes(k));
      if (!subjKw.length && !snipKw.length) continue;
      const hay = `${subject} ${snippet} ${from}`.toLowerCase();
      const noisy = NOISE.some((n) => hay.includes(n));
      if (noisy && !subjKw.length) continue;

      let explicit = explicitDue(subject, now);
      let stripFrom: 'subject' | 'none' = explicit ? 'subject' : 'none';
      if (!explicit) explicit = explicitDue(snippet, now);
      let looseTitle: string | undefined;
      if (explicit) {
        dueAt = explicit.dueAt;
        reasons.push(explicit.fragment);
      } else {
        const loose = looseDue(subject, now) ?? (subjKw.length ? looseDue(snippet, now) : undefined);
        if (loose) {
          dueAt = loose.dueAt;
          reasons.push('date mentioned');
          if (loose.title !== subject && subject.includes(loose.title.split(' ')[0] ?? '')) looseTitle = loose.title;
        }
      }

      let raw = subject;
      if (explicit && stripFrom === 'subject') raw = raw.replace(explicit.fragment, ' ');
      else if (looseTitle && looseDue(subject, now)) raw = looseTitle;
      title = tidyTitle(raw);
      if (!title) title = tidyTitle(snippet.slice(0, 60));
      if (!title) continue;

      if (subjKw.length) reasons.unshift(`${subjKw.map((k) => `“${k}”`).join(', ')} in subject`);
      else reasons.unshift(`${snipKw.map((k) => `“${k}”`).join(', ')} in text`);

      if (subjKw.length && dueAt) confidence = 'high';
      else if (subjKw.length) confidence = 'medium';
      else if (explicit) confidence = 'medium';
      else confidence = 'low';
      if (noisy) {
        confidence = lower(confidence);
        reasons.push('looks like a newsletter');
      }
      if (isClassroom) confidence = confidence === 'high' ? 'medium' : confidence;
    }

    const course = findCourse([subject, from, snippet], brackets, courses);
    if (course) reasons.push(`course ${course.how}`);

    out.push({
      messageId: msg.id,
      title,
      dueAt,
      courseId: course?.id,
      confidence,
      reason: reasons.join(' · '),
      url: msg.url,
    });
  }

  // Same assignment mentioned in several messages: keep the best one.
  const seen = new Map<string, Suggestion>();
  for (const s of out) {
    const key = `${s.title.toLowerCase()}|${s.dueAt ?? ''}`;
    const prev = seen.get(key);
    if (!prev || RANK[s.confidence] < RANK[prev.confidence]) seen.set(key, s);
  }
  const dates = new Map(messages.map((m) => [m.id, m.date ?? '']));
  return [...seen.values()].sort((a, b) => {
    if (RANK[a.confidence] !== RANK[b.confidence]) return RANK[a.confidence] - RANK[b.confidence];
    if (!!a.dueAt !== !!b.dueAt) return a.dueAt ? -1 : 1;
    if (a.dueAt && b.dueAt && a.dueAt !== b.dueAt) return a.dueAt < b.dueAt ? -1 : 1;
    return (dates.get(b.messageId) ?? '').localeCompare(dates.get(a.messageId) ?? '');
  });
}
