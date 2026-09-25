// Practice tests: take a Quiz maker set in the app like a real test, get it graded, and track scores over time.
import type { Question, QuizSet } from './quizmaker';

export type Response = number[] | string | undefined;

/** Lowercase, no accents or punctuation, single spaces, no leading "a/an/the". */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.\-\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(a|an|the) /, '')
    .replace(/\.$/, '');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** Every accepted answer: "photosynthesis / photo-synthesis" or "; " or " | " list alternatives. */
export function acceptedAnswers(answer: string): string[] {
  return answer
    .split(/\s*(?:\/|;|\|)\s*/)
    .map(normalize)
    .filter(Boolean);
}

/** Forgiving short-answer check: exact after normalizing, same number, or a small typo on longer words. */
export function shortAnswerCorrect(response: string, answer: string): boolean {
  const r = normalize(response);
  if (!r) return false;
  for (const a of acceptedAnswers(answer)) {
    if (r === a) return true;
    const rn = Number(r.replace(/,/g, ''));
    const an = Number(a.replace(/,/g, ''));
    if (Number.isFinite(rn) && Number.isFinite(an) && r !== '' && Math.abs(rn - an) <= Math.max(1e-9, Math.abs(an) * 1e-6)) return true;
    const allowed = a.length >= 10 ? 2 : a.length >= 5 ? 1 : 0;
    if (allowed && !/\d/.test(a) && levenshtein(r, a) <= allowed) return true;
  }
  return false;
}

export function isCorrect(q: Question, response: Response): boolean {
  if (q.type === 'short' || q.type === 'fill') return typeof response === 'string' && shortAnswerCorrect(response, q.answer ?? '');
  if (!Array.isArray(response)) return false;
  const want = [...q.correct].sort().join(',');
  return [...new Set(response)].sort().join(',') === want;
}

export const pointsOf = (q: Question): number => (q.points && q.points > 0 ? q.points : 1);

export interface Graded {
  earned: number;
  total: number;
  pct: number;
  results: { id: string; correct: boolean; points: number }[];
}

/** Grade every question; `overrides` marks short answers the student counts as right (or wrong). */
export function gradeTest(questions: Question[], responses: Record<string, Response>, overrides: Record<string, boolean> = {}): Graded {
  let earned = 0;
  let total = 0;
  const results = questions.map((q) => {
    const correct = overrides[q.id] ?? isCorrect(q, responses[q.id]);
    const points = pointsOf(q);
    total += points;
    if (correct) earned += points;
    return { id: q.id, correct, points };
  });
  return { earned, total, pct: total ? Math.round((earned / total) * 1000) / 10 : 0, results };
}

export function answered(q: Question, r: Response): boolean {
  return typeof r === 'string' ? r.trim().length > 0 : Array.isArray(r) && r.length > 0;
}

/** Questions a set can actually be tested on (a prompt and an answer). */
export function testable(set: Pick<QuizSet, 'questions'>): Question[] {
  return set.questions.filter((q) => q.prompt.trim() && (q.type === 'short' || q.type === 'fill' ? (q.answer ?? '').trim() : q.options.length >= 2 && q.correct.length));
}

// ---------- history ----------
export interface Attempt {
  at: string;
  pct: number;
  earned: number;
  total: number;
  ms: number;
  missed: string[]; // question ids
}
export const ATTEMPTS_KEY = 'homework-todo:practice-attempts';
const MAX_ATTEMPTS = 50;

export function loadAttempts(): Record<string, Attempt[]> {
  try {
    const v = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) ?? '{}') as Record<string, Attempt[]>;
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export function addAttempt(all: Record<string, Attempt[]>, setId: string, a: Attempt): Record<string, Attempt[]> {
  const next = { ...all, [setId]: [...(all[setId] ?? []), a].slice(-MAX_ATTEMPTS) };
  try {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked: keep it for this session */
  }
  return next;
}

export function summaryOf(list: Attempt[] | undefined): { last?: number; best?: number; count: number; trend?: number } {
  if (!list?.length) return { count: 0 };
  const last = list[list.length - 1].pct;
  const best = Math.max(...list.map((a) => a.pct));
  const trend = list.length >= 2 ? last - list[list.length - 2].pct : undefined;
  return { last, best, count: list.length, trend };
}
