import type { TaskType } from './types';

export interface AutoDescription {
  type: TaskType;
  notes: string;
  subtasks: string[];
  estimateMin: number;
  tags: string[];
  subject?: 'math' | 'science' | 'english' | 'history' | 'language' | 'cs' | 'art' | 'other';
}

type Subject = NonNullable<AutoDescription['subject']>;

export interface AutoDescribeContext {
  courseName?: string;
  type?: TaskType;
  estimateMin?: number;
}

const SUBJECT_KEYWORDS: [Subject, string[]][] = [
  ['cs', ['cs', 'computer', 'programming', 'coding', 'software', 'java', 'python']],
  ['math', ['calc', 'calculus', 'algebra', 'math', 'maths', 'geometry', 'stats', 'statistics', 'precalc', 'trig', 'trigonometry']],
  ['science', ['chem', 'chemistry', 'bio', 'biology', 'physics', 'science', 'anatomy', 'physiology', 'earth science', 'astronomy']],
  ['english', ['english', 'lit', 'literature', 'writing', 'composition', 'ela', 'rhetoric']],
  ['history', ['history', 'gov', 'government', 'econ', 'economics', 'social', 'civics', 'geography', 'apush', 'world']],
  ['language', ['spanish', 'french', 'latin', 'german', 'chinese', 'japanese', 'italian', 'mandarin', 'korean', 'arabic']],
  ['art', ['art', 'music', 'band', 'choir', 'orchestra', 'drawing', 'painting', 'theater', 'theatre', 'drama']],
];

const SUBJECT_TIPS: Partial<Record<Subject, string>> = {
  math: 'Show every step; check by plugging back in.',
  science: 'Track units through each step.',
  english: 'State your claim in one sentence first.',
  history: 'Note dates and causes → effects.',
  language: 'Say the vocabulary out loud.',
  cs: 'Run the smallest piece first.',
};

const BASE_ESTIMATE: Record<TaskType, number> = {
  reading: 45,
  homework: 60,
  quiz: 45,
  exam: 90,
  project: 120,
  other: 30,
};

/** Lowercase, collapse whitespace, normalise unicode dashes and strip most punctuation edges. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‒–—―]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokens: words with letters/digits, dots kept inside (so "pp." and "ch." survive as prefixes). */
function words(s: string): string[] {
  return normalize(s)
    .replace(/[^a-z0-9#.\-\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/^\.+|\.+$/g, ''))
    .filter(Boolean);
}

function hasWord(tokens: string[], ...targets: string[]): boolean {
  return tokens.some((t) => targets.includes(t));
}

function hasPhrase(text: string, ...phrases: string[]): boolean {
  const n = normalize(text).replace(/[^a-z0-9#.\-\s]/g, ' ').replace(/\s+/g, ' ');
  return phrases.some((p) => new RegExp(`(^|[^a-z0-9])${escapeRe(p)}([^a-z0-9]|$)`).test(n));
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function inferSubject(courseName?: string, title?: string): AutoDescription['subject'] {
  const sources = [courseName ?? '', title ?? ''];
  for (const src of sources) {
    if (!src.trim()) continue;
    const tokens = words(src);
    const text = normalize(src);
    for (const [subject, keys] of SUBJECT_KEYWORDS) {
      for (const k of keys) {
        if (k.includes(' ')) {
          if (hasPhrase(text, k)) return subject;
        } else if (tokens.includes(k)) {
          return subject;
        }
      }
    }
    // Prefix matches for common abbreviations ("Chem101", "Bio2", "AlgebraII")
    for (const [subject, keys] of SUBJECT_KEYWORDS) {
      for (const k of keys) {
        if (k.length >= 4 && tokens.some((t) => t.startsWith(k))) return subject;
      }
    }
  }
  return courseName?.trim() ? 'other' : undefined;
}

interface PageInfo {
  from: number;
  to: number;
  count: number;
  label: string; // e.g. "pp. 112–140"
}

/** Parse "pp. 12-40", "pages 12–40", "p. 55", "page 12 to 20". */
function parsePages(title: string): PageInfo | undefined {
  const t = normalize(title);
  const m = t.match(/\b(?:pp?\.?|pages?)\s*(\d{1,4})\s*(?:-|to|through)\s*(\d{1,4})\b/);
  if (m) {
    const from = parseInt(m[1], 10);
    const to = parseInt(m[2], 10);
    if (to >= from) return { from, to, count: to - from + 1, label: `pp. ${from}–${to}` };
  }
  const single = t.match(/\b(?:pp?\.?|pages?)\s*(\d{1,4})\b/);
  if (single) {
    const p = parseInt(single[1], 10);
    return { from: p, to: p, count: 1, label: `p. ${p}` };
  }
  return undefined;
}

interface ChapterInfo {
  label: string; // "chapter 6" or "chapters 3–4"
}

function parseChapter(title: string): ChapterInfo | undefined {
  const t = normalize(title);
  const range = t.match(/\b(?:ch(?:apters?)?\.?)\s*(\d{1,3})\s*(?:-|to|through|&|and)\s*(\d{1,3})\b/);
  if (range) return { label: `chapters ${range[1]}–${range[2]}` };
  const single = t.match(/\b(?:ch(?:apter)?\.?)\s*(\d{1,3})\b/);
  if (single) return { label: `chapter ${single[1]}` };
  return undefined;
}

interface ProblemInfo {
  count: number;
  label: string; // "problems 1–20" / "12 problems"
}

/** Parse "problems 1–20", "#1-15", "questions 3-9", "exercises 2, 4, 6", "20 problems". */
function parseProblems(title: string): ProblemInfo | undefined {
  const t = normalize(title);
  const range = t.match(
    /\b(?:problems?|questions?|exercises?|q|qs|nos?\.?|numbers?|#)\s*#?\s*(\d{1,3})\s*(?:-|to|through)\s*(\d{1,3})\b/,
  );
  if (range) {
    const from = parseInt(range[1], 10);
    const to = parseInt(range[2], 10);
    if (to >= from) return { count: to - from + 1, label: `problems ${from}–${to}` };
  }
  const hashRange = t.match(/#\s*(\d{1,3})\s*-\s*(\d{1,3})\b/);
  if (hashRange) {
    const from = parseInt(hashRange[1], 10);
    const to = parseInt(hashRange[2], 10);
    if (to >= from) return { count: to - from + 1, label: `problems ${from}–${to}` };
  }
  const bareRange = t.match(/\b(\d{1,3})\s*-\s*(\d{1,3})\b/);
  if (bareRange && !/\b(?:pp?\.?|pages?|ch(?:apter)?s?\.?)\s*\d/.test(t)) {
    const from = parseInt(bareRange[1], 10);
    const to = parseInt(bareRange[2], 10);
    if (to >= from && to - from < 200) return { count: to - from + 1, label: `problems ${from}–${to}` };
  }
  const list = t.match(/\b(?:problems?|questions?|exercises?)\s*#?\s*((?:\d{1,3}\s*,\s*)+\d{1,3})\b/);
  if (list) {
    const nums = list[1].split(',').map((s) => s.trim()).filter(Boolean);
    return { count: nums.length, label: `problems ${nums.join(', ')}` };
  }
  const countFirst = t.match(/\b(\d{1,3})\s+(?:problems?|questions?|exercises?)\b/);
  if (countFirst) {
    const n = parseInt(countFirst[1], 10);
    return { count: n, label: `${n} problems` };
  }
  return undefined;
}

type Kind = 'reading' | 'quiz' | 'exam' | 'project' | 'homework' | 'lab' | 'study' | 'other';

function detectKind(title: string): Kind {
  const tokens = words(title);
  const text = normalize(title);
  const isLabReport = hasPhrase(text, 'lab report', 'lab write-up', 'lab writeup');

  if (hasWord(tokens, 'quiz', 'quizzes')) return 'quiz';
  if (hasWord(tokens, 'test', 'exam', 'exams', 'midterm', 'midterms', 'final', 'finals')) return 'exam';
  if (
    isLabReport ||
    hasWord(tokens, 'essay', 'paper', 'report', 'draft', 'write', 'presentation', 'slides', 'project', 'speech', 'poster', 'outline')
  ) {
    return 'project';
  }
  if (hasWord(tokens, 'lab', 'labs')) return 'lab';
  if (
    hasWord(tokens, 'read', 'reading', 'chapter', 'chapters', 'ch', 'pages', 'page', 'pp', 'p', 'article', 'textbook', 'novel', 'book') ||
    /\bch\.?\s*\d/.test(text) ||
    /\bpp?\.?\s*\d/.test(text)
  ) {
    return 'reading';
  }
  if (
    hasPhrase(text, 'problem set') ||
    hasWord(tokens, 'pset', 'worksheet', 'exercises', 'exercise', 'problems', 'problem', 'hw', 'homework', 'practice', 'questions', 'question') ||
    /#\s*\d/.test(text) ||
    /\b\d{1,3}\s*-\s*\d{1,3}\b/.test(text)
  ) {
    return 'homework';
  }
  if (hasWord(tokens, 'study', 'review', 'flashcards', 'flashcard', 'memorize', 'revise')) return 'study';
  return 'other';
}

function kindToType(kind: Kind): TaskType {
  switch (kind) {
    case 'reading':
      return 'reading';
    case 'quiz':
      return 'quiz';
    case 'exam':
      return 'exam';
    case 'project':
      return 'project';
    case 'homework':
    case 'lab':
      return 'homework';
    default:
      return 'other';
  }
}

/** When the caller pins a type, pick the most compatible kind for step text. */
function kindForGivenType(type: TaskType, detected: Kind): Kind {
  switch (type) {
    case 'reading':
      return 'reading';
    case 'quiz':
      return 'quiz';
    case 'exam':
      return 'exam';
    case 'project':
      return 'project';
    case 'homework':
      return detected === 'lab' ? 'lab' : 'homework';
    case 'other':
      return detected === 'study' ? 'study' : 'other';
  }
}

function courseLabel(courseName?: string): string {
  const n = courseName?.trim();
  return n ? ` for ${n}` : '';
}

function cleanTitle(title: string): string {
  const t = title.replace(/\s+/g, ' ').trim();
  return t.length > 120 ? `${t.slice(0, 117).trimEnd()}…` : t;
}

export function autoDescribe(title: string, ctx: AutoDescribeContext = {}): AutoDescription {
  const detected = detectKind(title);
  const type: TaskType = ctx.type ?? kindToType(detected);
  const kind: Kind = ctx.type ? kindForGivenType(ctx.type, detected) : detected;
  const subject = inferSubject(ctx.courseName, title);
  const pages = parsePages(title);
  const chapter = parseChapter(title);
  const problems = parseProblems(title);
  const cn = courseLabel(ctx.courseName);
  const t = cleanTitle(title);

  let what: string;
  let plan: string;
  let tip: string;
  let subtasks: string[];
  const tags: string[] = [];
  let estimate = BASE_ESTIMATE[type];

  switch (kind) {
    case 'reading': {
      const target = pages ? pages.label : chapter ? chapter.label : t;
      what = `Reading${cn}: ${target}.`;
      plan = 'skim headings → read and annotate → 5-bullet summary.';
      tip = 'Read actively: turn each heading into a question, then answer it.';
      subtasks = [`Skim headings ${target === t ? 'first' : target}`, 'Read and annotate', 'Write 5 bullet summary'];
      tags.push('reading');
      if (pages) estimate = clamp(pages.count * 3, 15, 300);
      break;
    }
    case 'quiz':
    case 'exam': {
      const label = kind === 'quiz' ? 'Quiz prep' : 'Exam prep';
      what = `${label}${cn}: ${t}.`;
      plan = 'gather materials → notecards → self-test → review mistakes.';
      tip = 'Spaced practice beats cramming — split this across a few days.';
      subtasks = [
        'Gather notes, homework and past quizzes',
        'Make a notecard set of key terms and formulas',
        kind === 'quiz' ? 'Self-test with practice questions' : 'Do practice problems under timed conditions',
        'Review mistakes and re-test the weak spots',
        'Sleep well the night before',
      ];
      tags.push('study');
      break;
    }
    case 'project': {
      const text = normalize(title);
      const isSlides = hasWord(words(title), 'presentation', 'slides', 'poster', 'speech');
      const isLabReport = hasPhrase(text, 'lab report', 'lab write-up', 'lab writeup');
      what = `${isLabReport ? 'Lab report' : isSlides ? 'Presentation' : 'Writing'}${cn}: ${t}.`;
      plan = isSlides
        ? 'outline key points → build slides → rehearse → polish.'
        : 'outline and thesis → draft → revise → proofread and cite.';
      tip = isLabReport
        ? 'Write the results and analysis first; cite sources as you go.'
        : isSlides
          ? 'One idea per slide; rehearse out loud at least twice.'
          : 'Write the thesis first, then cite as you go.';
      subtasks = isSlides
        ? ['Outline the key points', 'Build the slides', 'Rehearse out loud', 'Polish visuals and timing']
        : isLabReport
          ? ['Organize data and figures', 'Draft results and analysis', 'Write intro, method and conclusion', 'Proofread and cite sources']
          : ['Write a one-sentence thesis and outline', 'Draft the full piece', 'Revise for structure and clarity', 'Proofread and add citations'];
      tags.push('writing');
      break;
    }
    case 'lab': {
      what = `Lab${cn}: ${t}.`;
      plan = 'pre-read procedure → run the lab → record data → clean up.';
      tip = 'Record data as you go; label every measurement with units.';
      subtasks = ['Pre-read the procedure and safety notes', 'Run the lab and record data', 'Check data for gaps or outliers', 'Clean up and file notes'];
      tags.push('lab');
      break;
    }
    case 'homework': {
      const target = problems ? problems.label : t;
      what = `Homework${cn}: ${target}.`;
      plan = 'do the problems → check answers → mark ones to ask about.';
      tip = 'Try each problem before looking at examples; note where you got stuck.';
      subtasks = [`Do ${problems ? problems.label : 'the problems'}`, 'Check answers', 'Mark the ones to ask about'];
      if (problems) estimate = clamp(problems.count * 4, 15, 300);
      break;
    }
    case 'study': {
      what = `Study session${cn}: ${t}.`;
      plan = 'pick the topics → active recall → fix the gaps.';
      tip = 'Quiz yourself from memory before rereading notes.';
      subtasks = ['List the topics to cover', 'Self-test from memory', 'Review what you missed'];
      tags.push('study');
      break;
    }
    default: {
      what = `Task${cn}: ${t}.`;
      plan = 'clarify what done looks like → do it → double-check.';
      tip = 'Break it into one concrete next step you can start now.';
      subtasks = ['Clarify what finished looks like', 'Do the work', 'Double-check and submit'];
      break;
    }
  }

  if (subject && SUBJECT_TIPS[subject]) {
    tip = SUBJECT_TIPS[subject] as string;
  }

  if (ctx.estimateMin !== undefined && ctx.estimateMin > 0) estimate = Math.round(ctx.estimateMin);

  const notes = [`${what}`, `**Plan:** ${plan}`, `**Tip:** ${tip}`].join('\n').slice(0, 400);

  return {
    type,
    notes,
    subtasks: subtasks.slice(0, 5),
    estimateMin: estimate,
    tags: tags.slice(0, 2),
    subject,
  };
}
