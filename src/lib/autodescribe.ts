import type { TaskType } from './types';
import { locale, t as tr, type MessageKey } from './i18n/index.svelte';

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

// Spanish course names (accents folded), checked first when the app is in Spanish
const SUBJECT_KEYWORDS_ES: [Subject, string[]][] = [
  ['cs', ['informatica', 'programacion', 'computacion', 'tecnologia']],
  ['math', ['matematicas', 'mates', 'mate', 'calculo', 'geometria', 'estadistica', 'trigonometria', 'algebra']],
  ['science', ['quimica', 'biologia', 'fisica', 'ciencias', 'anatomia', 'astronomia', 'geologia']],
  ['english', ['lengua', 'literatura', 'castellano', 'redaccion']],
  ['history', ['historia', 'geografia', 'economia', 'sociales', 'civica', 'filosofia']],
  ['language', ['ingles', 'frances', 'aleman', 'latin', 'italiano', 'chino', 'japones', 'portugues', 'coreano', 'arabe']],
  ['art', ['arte', 'musica', 'dibujo', 'plastica', 'teatro', 'danza']],
];

// Spanish titles: fold accents and map common Spanish words to the English ones the parsers below understand
const ES_TO_EN: [RegExp, string][] = [
  [/\bdel? (\d+) al (\d+)\b/g, '$1 to $2'],
  [/(\d) a la (\d)/g, '$1 to $2'],
  [/(\d) a (\d)/g, '$1 to $2'],
  [/(\d) y (\d)/g, '$1 and $2'],
  [/\binformes? de laboratorio\b/g, 'lab report'],
  [/\bpracticas? de laboratorio\b/g, 'lab'],
  [/\blaboratorios?\b/g, 'lab'],
  [/\bhojas? de ejercicios\b/g, 'worksheet'],
  [/\bfichas?\b/g, 'worksheet'],
  [/\blibros? de texto\b/g, 'textbook'],
  [/\bexamen(es)?\b/g, 'exam'],
  [/\bparcial(es)?\b/g, 'midterm'],
  [/\b(pruebas?|controles|control|cuestionarios?)\b/g, 'quiz'],
  [/\b(ensayos?|redaccion|redacciones)\b/g, 'essay'],
  [/\btrabajos?\b/g, 'paper'],
  [/\binformes?\b/g, 'report'],
  [/\bborradores?\b/g, 'draft'],
  [/\b(escribir|redactar)\b/g, 'write'],
  [/\b(presentacion|presentaciones|exposicion|exposiciones)\b/g, 'presentation'],
  [/\bdiapositivas\b/g, 'slides'],
  [/\bproyectos?\b/g, 'project'],
  [/\bdiscursos?\b/g, 'speech'],
  [/\b(cartel|carteles|mural|murales)\b/g, 'poster'],
  [/\besquemas?\b/g, 'outline'],
  [/\bleer\b/g, 'read'],
  [/\blecturas?\b/g, 'reading'],
  [/\bcapitulos\b/g, 'chapters'],
  [/\bcapitulo\b/g, 'chapter'],
  [/\bcaps?\b\.?/g, 'ch.'],
  [/\bpaginas\b/g, 'pages'],
  [/\bpagina\b/g, 'page'],
  [/\bpags\b\.?/g, 'pp.'],
  [/\bpag\b\.?/g, 'p.'],
  [/\barticulos?\b/g, 'article'],
  [/\blibros?\b/g, 'book'],
  [/\bnovelas?\b/g, 'novel'],
  [/\bproblemas\b/g, 'problems'],
  [/\bproblema\b/g, 'problem'],
  [/\bejercicios\b/g, 'exercises'],
  [/\bejercicio\b/g, 'exercise'],
  [/\bpreguntas\b/g, 'questions'],
  [/\bpregunta\b/g, 'question'],
  [/\b(tareas?|deberes)\b/g, 'homework'],
  [/\bpracticar\b/g, 'practice'],
  [/\bestudiar\b/g, 'study'],
  [/\b(repasar|repaso)\b/g, 'review'],
  [/\btarjetas\b/g, 'flashcards'],
  [/\bmemorizar\b/g, 'memorize'],
];
const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
/** The text the parsers read: unchanged in English; in Spanish, folded and mapped to the English keywords. */
function forParsing(s: string): string {
  if (locale() !== 'es') return s;
  let out = fold(s);
  for (const [re, en] of ES_TO_EN) out = out.replace(re, en);
  return out;
}

// steps, plans and tips are in the app language (en.ts / es.ts, auto.*)
const SUBJECT_TIPS: Partial<Record<Subject, MessageKey>> = {
  math: 'auto.tip.math',
  science: 'auto.tip.science',
  english: 'auto.tip.english',
  history: 'auto.tip.history',
  language: 'auto.tip.language',
  cs: 'auto.tip.cs',
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
  const n = normalize(text)
    .replace(/[^a-z0-9#.\-\s]/g, ' ')
    .replace(/\s+/g, ' ');
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
    if (locale() === 'es') {
      const folded = fold(src).split(/[^a-z0-9]+/);
      for (const [subject, keys] of SUBJECT_KEYWORDS_ES) if (keys.some((k) => folded.includes(k))) return subject;
    }
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
    if (to >= from) return { from, to, count: to - from + 1, label: tr('auto.pp', { from, to }) };
  }
  const single = t.match(/\b(?:pp?\.?|pages?)\s*(\d{1,4})\b/);
  if (single) {
    const p = parseInt(single[1], 10);
    return { from: p, to: p, count: 1, label: tr('auto.p', { p }) };
  }
  return undefined;
}

interface ChapterInfo {
  label: string; // "chapter 6" or "chapters 3–4"
}

function parseChapter(title: string): ChapterInfo | undefined {
  const t = normalize(title);
  const range = t.match(/\b(?:ch(?:apters?)?\.?)\s*(\d{1,3})\s*(?:-|to|through|&|and)\s*(\d{1,3})\b/);
  if (range) return { label: tr('auto.chapters', { a: range[1], b: range[2] }) };
  const single = t.match(/\b(?:ch(?:apter)?\.?)\s*(\d{1,3})\b/);
  if (single) return { label: tr('auto.chapter', { n: single[1] }) };
  return undefined;
}

interface ProblemInfo {
  count: number;
  label: string; // "problems 1–20" / "12 problems"
}

/** Parse "problems 1–20", "#1-15", "questions 3-9", "exercises 2, 4, 6", "20 problems". */
function parseProblems(title: string): ProblemInfo | undefined {
  const t = normalize(title);
  const range = t.match(/\b(?:problems?|questions?|exercises?|q|qs|nos?\.?|numbers?|#)\s*#?\s*(\d{1,3})\s*(?:-|to|through)\s*(\d{1,3})\b/);
  if (range) {
    const from = parseInt(range[1], 10);
    const to = parseInt(range[2], 10);
    if (to >= from) return { count: to - from + 1, label: tr('auto.problems', { from, to }) };
  }
  const hashRange = t.match(/#\s*(\d{1,3})\s*-\s*(\d{1,3})\b/);
  if (hashRange) {
    const from = parseInt(hashRange[1], 10);
    const to = parseInt(hashRange[2], 10);
    if (to >= from) return { count: to - from + 1, label: tr('auto.problems', { from, to }) };
  }
  const bareRange = t.match(/\b(\d{1,3})\s*-\s*(\d{1,3})\b/);
  if (bareRange && !/\b(?:pp?\.?|pages?|ch(?:apter)?s?\.?)\s*\d/.test(t)) {
    const from = parseInt(bareRange[1], 10);
    const to = parseInt(bareRange[2], 10);
    if (to >= from && to - from < 200) return { count: to - from + 1, label: tr('auto.problems', { from, to }) };
  }
  const list = t.match(/\b(?:problems?|questions?|exercises?)\s*#?\s*((?:\d{1,3}\s*,\s*)+\d{1,3})\b/);
  if (list) {
    const nums = list[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return { count: nums.length, label: tr('auto.problemList', { list: nums.join(', ') }) };
  }
  const countFirst = t.match(/\b(\d{1,3})\s+(?:problems?|questions?|exercises?)\b/);
  if (countFirst) {
    const n = parseInt(countFirst[1], 10);
    return { count: n, label: tr('auto.nProblems', { n }) };
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
  if (isLabReport || hasWord(tokens, 'essay', 'paper', 'report', 'draft', 'write', 'presentation', 'slides', 'project', 'speech', 'poster', 'outline')) {
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
  return n ? tr('auto.for', { name: n }) : '';
}

function cleanTitle(title: string): string {
  const t = title.replace(/\s+/g, ' ').trim();
  return t.length > 120 ? `${t.slice(0, 117).trimEnd()}…` : t;
}

export function autoDescribe(title: string, ctx: AutoDescribeContext = {}): AutoDescription {
  const parsed = forParsing(title);
  const detected = detectKind(parsed);
  const type: TaskType = ctx.type ?? kindToType(detected);
  const kind: Kind = ctx.type ? kindForGivenType(ctx.type, detected) : detected;
  const subject = inferSubject(ctx.courseName, title);
  const pages = parsePages(parsed);
  const chapter = parseChapter(parsed);
  const problems = parseProblems(parsed);
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
      what = tr('auto.line', { label: tr('auto.l.reading'), cn, title: target });
      plan = tr('auto.read.plan');
      tip = tr('auto.read.tip');
      subtasks = [target === t ? tr('auto.read.skimFirst') : tr('auto.read.skim', { target }), tr('auto.read.2'), tr('auto.read.3')];
      tags.push('reading');
      if (pages) estimate = clamp(pages.count * 3, 15, 300);
      break;
    }
    case 'quiz':
    case 'exam': {
      const label = kind === 'quiz' ? tr('auto.l.quiz') : tr('auto.l.exam');
      what = tr('auto.line', { label, cn, title: t });
      plan = tr('auto.exam.plan');
      tip = tr('auto.exam.tip');
      subtasks = [tr('auto.exam.1'), tr('auto.exam.2'), kind === 'quiz' ? tr('auto.exam.3quiz') : tr('auto.exam.3exam'), tr('auto.exam.4'), tr('auto.exam.5')];
      tags.push('study');
      break;
    }
    case 'project': {
      const text = normalize(parsed);
      const isSlides = hasWord(words(parsed), 'presentation', 'slides', 'poster', 'speech');
      const isLabReport = hasPhrase(text, 'lab report', 'lab write-up', 'lab writeup');
      what = tr('auto.line', { label: isLabReport ? tr('auto.l.labReport') : isSlides ? tr('auto.l.presentation') : tr('auto.l.writing'), cn, title: t });
      plan = isSlides ? tr('auto.slides.plan') : tr('auto.writing.plan');
      tip = isLabReport ? tr('auto.labReport.tip') : isSlides ? tr('auto.slides.tip') : tr('auto.writing.tip');
      subtasks = isSlides
        ? [tr('auto.slides.1'), tr('auto.slides.2'), tr('auto.slides.3'), tr('auto.slides.4')]
        : isLabReport
          ? [tr('auto.labReport.1'), tr('auto.labReport.2'), tr('auto.labReport.3'), tr('auto.labReport.4')]
          : [tr('auto.writing.1'), tr('auto.writing.2'), tr('auto.writing.3'), tr('auto.writing.4')];
      tags.push('writing');
      break;
    }
    case 'lab': {
      what = tr('auto.line', { label: tr('auto.l.lab'), cn, title: t });
      plan = tr('auto.lab.plan');
      tip = tr('auto.lab.tip');
      subtasks = [tr('auto.lab.1'), tr('auto.lab.2'), tr('auto.lab.3'), tr('auto.lab.4')];
      tags.push('lab');
      break;
    }
    case 'homework': {
      const target = problems ? problems.label : t;
      what = tr('auto.line', { label: tr('auto.l.homework'), cn, title: target });
      plan = tr('auto.hw.plan');
      tip = tr('auto.hw.tip');
      subtasks = [tr('auto.hw.do', { what: problems ? problems.label : tr('auto.hw.theProblems') }), tr('auto.hw.2'), tr('auto.hw.3')];
      if (problems) estimate = clamp(problems.count * 4, 15, 300);
      break;
    }
    case 'study': {
      what = tr('auto.line', { label: tr('auto.l.study'), cn, title: t });
      plan = tr('auto.study.plan');
      tip = tr('auto.study.tip');
      subtasks = [tr('auto.study.1'), tr('auto.study.2'), tr('auto.study.3')];
      tags.push('study');
      break;
    }
    default: {
      what = tr('auto.line', { label: tr('auto.l.task'), cn, title: t });
      plan = tr('auto.other.plan');
      tip = tr('auto.other.tip');
      subtasks = [tr('auto.other.1'), tr('auto.other.2'), tr('auto.other.3')];
      break;
    }
  }

  if (subject && SUBJECT_TIPS[subject]) {
    tip = tr(SUBJECT_TIPS[subject] as MessageKey);
  }

  if (ctx.estimateMin !== undefined && ctx.estimateMin > 0) estimate = Math.round(ctx.estimateMin);

  const notes = [`${what}`, tr('auto.plan', { plan }), tr('auto.tip', { tip })].join('\n').slice(0, 400);

  return {
    type,
    notes,
    subtasks: subtasks.slice(0, 5),
    estimateMin: estimate,
    tags: tags.slice(0, 2),
    subject,
  };
}
