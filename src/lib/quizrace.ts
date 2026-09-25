// Quiz race (Play → Study games): a timed multiple-choice run against a ghost of your best run on the same deck or quiz set.
// The ghost is just the times of that run's right answers, so its progress at any moment is "how many had it got by now".
import type { Card } from './types';
import type { QuizSet } from './quizmaker';
import { isComplete } from './quizmaker';
import { canBattle, pickChoices, playableCards, type Choice } from './studygames';
import { shuffle, type Rng } from './casino/rng';

const rand: Rng = Math.random;

export const RACE_LENGTH = 10; // questions per race; bigger decks get a random 10
export const RACE_MIN_QUIZ = 3; // usable quiz-set questions
export const GHOSTS_KEY = 'homework-todo:race-ghosts';

export interface RaceQuestion {
  id: string;
  prompt: string;
  image?: string;
  choices: Choice[];
}

export const canRaceDeck = canBattle;

/** Questions from a deck: each card's front with its answer and three distractors, as in boss battle. */
export function raceFromCards(cards: Card[], rng: Rng = rand, n = RACE_LENGTH): RaceQuestion[] {
  const pool = playableCards(cards);
  return shuffle(pool, rng)
    .slice(0, n)
    .map((c) => ({ id: c.id, prompt: c.front, image: c.frontImage, choices: pickChoices(c, pool, rng) }));
}

/** Quiz-maker questions as choices. Multiple choice and true/false keep their options; short answers borrow other answers in the set. */
export function quizQuestions(set: Pick<QuizSet, 'questions'>, rng: Rng = rand): RaceQuestion[] {
  const qs = set.questions.filter(isComplete);
  const answers = [...new Set(qs.filter((q) => q.type === 'short' || q.type === 'fill').map((q) => q.answer!.trim()))];
  const out: RaceQuestion[] = [];
  for (const q of qs) {
    let choices: Choice[];
    if (q.type === 'mc' || q.type === 'tf') {
      const opts = q.options.map((text, i) => ({ id: `${q.id}:${i}`, text: text.trim(), correct: q.correct.includes(i) })).filter((o) => o.text);
      choices = q.type === 'tf' ? opts : shuffle(opts, rng);
    } else {
      const right = q.answer!.trim();
      const wrong = shuffle(
        answers.filter((a) => a.toLowerCase() !== right.toLowerCase()),
        rng,
      ).slice(0, 3);
      if (wrong.length < 2) continue;
      choices = shuffle(
        [right, ...wrong].map((text, i) => ({ id: `${q.id}:${i}`, text, correct: i === 0 })),
        rng,
      );
    }
    if (choices.length >= 2 && choices.some((c) => c.correct)) out.push({ id: q.id, prompt: q.prompt, choices });
  }
  return out;
}

export const canRaceQuiz = (set: Pick<QuizSet, 'questions'>): boolean => quizQuestions(set).length >= RACE_MIN_QUIZ;

export function raceFromQuiz(set: Pick<QuizSet, 'questions'>, rng: Rng = rand, n = RACE_LENGTH): RaceQuestion[] {
  return shuffle(quizQuestions(set, rng), rng).slice(0, n);
}

// ---------- ghosts ----------

export interface Ghost {
  hits: number[]; // ms from the start to each right answer, ascending
  total: number; // ms to finish the race
  n: number; // questions in that race
  at: string; // when it was run (ISO)
}

export type Ghosts = Record<string, Ghost>;

/** How many right answers the ghost had after `elapsed` ms. */
export function ghostProgress(ghost: Pick<Ghost, 'hits'> | undefined, elapsed: number): number {
  if (!ghost) return 0;
  let n = 0;
  while (n < ghost.hits.length && ghost.hits[n] <= elapsed) n++;
  return n;
}

/** More right answers wins; a tie goes to whoever finished first. */
export function beats(run: Pick<Ghost, 'hits' | 'total'>, ghost: Pick<Ghost, 'hits' | 'total'> | undefined): boolean {
  if (!ghost) return true;
  return run.hits.length > ghost.hits.length || (run.hits.length === ghost.hits.length && run.total < ghost.total);
}

/** Keep the run as the new ghost if it beats the stored one. */
export function recordRun(ghosts: Ghosts, key: string, run: Ghost): { ghosts: Ghosts; saved: boolean } {
  if (!beats(run, ghosts[key])) return { ghosts, saved: false };
  return { ghosts: { ...ghosts, [key]: { ...run, hits: [...run.hits].sort((a, b) => a - b) } }, saved: true };
}

export function loadGhosts(): Ghosts {
  try {
    const g = JSON.parse(localStorage.getItem(GHOSTS_KEY) ?? '{}') as Ghosts;
    return g && typeof g === 'object' ? g : {};
  } catch {
    return {};
  }
}

export function saveGhosts(ghosts: Ghosts): void {
  try {
    localStorage.setItem(GHOSTS_KEY, JSON.stringify(ghosts));
  } catch {
    /* ignore */
  }
}

/** "3 ahead", "2 behind", "neck and neck" */
export function gapText(you: number, ghost: number): string {
  const d = you - ghost;
  return d === 0 ? 'neck and neck' : `${Math.abs(d)} ${d > 0 ? 'ahead' : 'behind'}`;
}
