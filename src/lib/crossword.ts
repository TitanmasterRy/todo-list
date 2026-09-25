// Crossword from a notecard deck (Play → Study games). Pure: picks an answer side for each card, lays the words out
// greedily (most crossings wins, same seed → same puzzle) and numbers the clues in reading order.
import type { Card } from './types';
import { answerText } from './studygames';
import { seeded, shuffle, type Rng } from './casino/rng';

export const CROSSWORD_MIN_CARDS = 5;
export const CROSSWORD_MAX_WORDS = 16;
export const MIN_ANSWER = 3;
export const MAX_ANSWER = 15;
export const MAX_GRID = 17; // rows and columns, so the grid still fits a phone
export const REVEAL_PENALTY_MS = 10_000; // each revealed letter adds this to your time

export type Dir = 'across' | 'down';

export interface ClueEntry {
  id: string; // card id
  answer: string; // A–Z only
  clue: string;
}

export interface PlacedWord extends ClueEntry {
  row: number;
  col: number;
  dir: Dir;
  num: number;
}

export interface Crossword {
  rows: number;
  cols: number;
  cells: (string | null)[][]; // solution letters, null = black square
  words: PlacedWord[]; // sorted by number, across before down
  skipped: ClueEntry[]; // usable cards that didn't cross anything
}

/** A card side as a crossword answer: at most three words of Latin letters (accents dropped), 3–15 letters. Null if it doesn't fit. */
export function toAnswer(text: string): string | null {
  const up = text.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().trim();
  if (!up || /[^A-Z\s'’.-]/.test(up) || up.split(/[\s-]+/).filter(Boolean).length > 3) return null;
  const letters = up.replace(/[^A-Z]/g, '');
  return letters.length >= MIN_ANSWER && letters.length <= MAX_ANSWER ? letters : null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * One entry per card that fits. The back is the answer when it's a short term (vocab: "cat → gato"); when the back is a
 * definition, the front becomes the answer and the definition the clue. The answer is blanked out of its own clue.
 */
export function crosswordEntries(cards: Card[]): ClueEntry[] {
  const out: ClueEntry[] = [];
  const seen = new Set<string>();
  for (const c of cards) {
    const front = c.front.trim();
    const back = answerText(c);
    let [side, clue] = [back, front];
    let answer = toAnswer(back);
    if (!answer || !front) [answer, side, clue] = [toAnswer(front), front, back];
    if (!answer || !clue || seen.has(answer) || toAnswer(clue) === answer) continue;
    seen.add(answer);
    out.push({ id: c.id, answer, clue: clue.replace(new RegExp(`(?<!\\p{L})${escapeRe(side)}(?!\\p{L})`, 'giu'), '___') });
  }
  return out;
}

export const canCrossword = (cards: Card[]): boolean => crosswordEntries(cards).length >= CROSSWORD_MIN_CARDS;

// ---------- layout ----------

interface Cell {
  ch: string;
  across: boolean;
  down: boolean;
}
type Board = Map<string, Cell>;
const at = (r: number, c: number) => `${r},${c}`;
const step = (dir: Dir): [number, number] => (dir === 'across' ? [0, 1] : [1, 0]);

/**
 * Crossings if `word` can go at (r, c): no letter clashes, no running along another word, nothing touching the ends,
 * and no new letter beside another word (which would spell nonsense). -1 when it can't.
 */
function fits(board: Board, word: string, r: number, c: number, dir: Dir): number {
  const [dr, dc] = step(dir);
  if (board.has(at(r - dr, c - dc)) || board.has(at(r + dr * word.length, c + dc * word.length))) return -1;
  let cross = 0;
  for (let i = 0; i < word.length; i++) {
    const rr = r + dr * i;
    const cc = c + dc * i;
    const cell = board.get(at(rr, cc));
    if (cell) {
      if (cell.ch !== word[i] || cell[dir]) return -1;
      cross++;
    } else if (board.has(at(rr + dc, cc + dr)) || board.has(at(rr - dc, cc - dr))) return -1;
  }
  return cross;
}

interface Layout {
  placed: (ClueEntry & { row: number; col: number; dir: Dir })[];
  crossings: number;
  box: { r0: number; r1: number; c0: number; c1: number };
}

function layout(order: ClueEntry[], rng: Rng, maxWords: number, maxSize: number): Layout {
  const board: Board = new Map();
  const box = { r0: 0, r1: 0, c0: 0, c1: order[0].answer.length - 1 };
  const placed: Layout['placed'] = [];
  let crossings = 0;
  const put = (e: ClueEntry, row: number, col: number, dir: Dir) => {
    const [dr, dc] = step(dir);
    for (let i = 0; i < e.answer.length; i++) {
      const k = at(row + dr * i, col + dc * i);
      const cell = board.get(k) ?? { ch: e.answer[i], across: false, down: false };
      cell[dir] = true;
      board.set(k, cell);
    }
    placed.push({ ...e, row, col, dir });
  };
  put(order[0], 0, 0, 'across');
  let pending = order.slice(1);
  // keep sweeping: a word that crosses nothing yet may fit once others are down
  for (let progress = true; progress && pending.length && placed.length < maxWords;) {
    progress = false;
    for (const e of [...pending]) {
      if (placed.length >= maxWords) break;
      let best: { r: number; c: number; dir: Dir; cross: number; score: number } | null = null;
      const tried = new Set<string>();
      for (const [k, cell] of board) {
        const [r, c] = k.split(',').map(Number);
        for (let i = 0; i < e.answer.length; i++) {
          if (e.answer[i] !== cell.ch) continue;
          for (const dir of ['across', 'down'] as Dir[]) {
            if (cell[dir]) continue;
            const [sr, sc] = dir === 'across' ? [r, c - i] : [r - i, c];
            const id = `${sr},${sc},${dir}`;
            if (tried.has(id)) continue;
            tried.add(id);
            const cross = fits(board, e.answer, sr, sc, dir);
            if (cross < 1) continue;
            const [dr, dc] = step(dir);
            const r0 = Math.min(box.r0, sr);
            const r1 = Math.max(box.r1, sr + dr * (e.answer.length - 1));
            const c0 = Math.min(box.c0, sc);
            const c1 = Math.max(box.c1, sc + dc * (e.answer.length - 1));
            const h = r1 - r0 + 1;
            const w = c1 - c0 + 1;
            if (h > maxSize || w > maxSize) continue;
            // crossings first, then a small, squarish grid; the random bit breaks ties
            const score = cross * 1000 - w * h - Math.abs(w - h) * 4 + rng();
            if (!best || score > best.score) best = { r: sr, c: sc, dir, cross, score };
          }
        }
      }
      if (!best) continue;
      put(e, best.r, best.c, best.dir);
      const [dr, dc] = step(best.dir);
      box.r0 = Math.min(box.r0, best.r);
      box.r1 = Math.max(box.r1, best.r + dr * (e.answer.length - 1));
      box.c0 = Math.min(box.c0, best.c);
      box.c1 = Math.max(box.c1, best.c + dc * (e.answer.length - 1));
      crossings += best.cross;
      pending = pending.filter((p) => p !== e);
      progress = true;
    }
  }
  return { placed, crossings, box };
}

/** Lay out a crossword. Several shuffled attempts; the one placing the most words (then most crossings, then smallest) wins. */
export function generateCrossword(entries: ClueEntry[], seed = 1, opts: { maxWords?: number; attempts?: number; maxSize?: number } = {}): Crossword {
  const { maxWords = CROSSWORD_MAX_WORDS, attempts = 12, maxSize = MAX_GRID } = opts;
  if (!entries.length) return { rows: 0, cols: 0, cells: [], words: [], skipped: [] };
  const rng = seeded(seed);
  const pool = shuffle(entries, rng).slice(0, maxWords * 2);
  let best: Layout | null = null;
  for (let a = 0; a < attempts; a++) {
    // longest words first (they have the most letters to cross); later attempts jiggle the order
    const jitter = new Map(pool.map((e) => [e, a === 0 ? 0 : rng() * 4]));
    const order = [...pool].sort((x, y) => y.answer.length + jitter.get(y)! - (x.answer.length + jitter.get(x)!));
    const l = layout(order, rng, maxWords, maxSize);
    const area = (l.box.r1 - l.box.r0 + 1) * (l.box.c1 - l.box.c0 + 1);
    const bestArea = best ? (best.box.r1 - best.box.r0 + 1) * (best.box.c1 - best.box.c0 + 1) : 0;
    if (
      !best ||
      l.placed.length > best.placed.length ||
      (l.placed.length === best.placed.length && (l.crossings > best.crossings || (l.crossings === best.crossings && area < bestArea)))
    )
      best = l;
  }
  const { placed, box } = best!;
  const rows = box.r1 - box.r0 + 1;
  const cols = box.c1 - box.c0 + 1;
  const cells: (string | null)[][] = Array.from({ length: rows }, () => Array<string | null>(cols).fill(null));
  const shifted = placed.map((p) => ({ ...p, row: p.row - box.r0, col: p.col - box.c0 }));
  for (const w of shifted) {
    const [dr, dc] = step(w.dir);
    for (let i = 0; i < w.answer.length; i++) cells[w.row + dr * i][w.col + dc * i] = w.answer[i];
  }
  // number the squares that start a word, left to right, top to bottom
  const nums = new Map<string, number>();
  let n = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (shifted.some((w) => w.row === r && w.col === c)) nums.set(at(r, c), ++n);
  const words = shifted.map((w) => ({ ...w, num: nums.get(at(w.row, w.col))! })).sort((a, b) => a.num - b.num || (a.dir === b.dir ? 0 : a.dir === 'across' ? -1 : 1));
  const ids = new Set(placed.map((p) => p.id));
  return { rows, cols, cells, words, skipped: entries.filter((e) => !ids.has(e.id)) };
}

// ---------- playing ----------

/** The squares of a word, first letter first. */
export function wordCells(w: Pick<PlacedWord, 'row' | 'col' | 'dir' | 'answer'>): [number, number][] {
  const [dr, dc] = step(w.dir);
  return Array.from({ length: w.answer.length }, (_, i) => [w.row + dr * i, w.col + dc * i]);
}

/** The word running `dir` through a square, if any. */
export function wordAt(cw: Crossword, r: number, c: number, dir: Dir): PlacedWord | undefined {
  return cw.words.find((w) => w.dir === dir && wordCells(w).some(([rr, cc]) => rr === r && cc === c));
}

/** Square numbers for the grid ("r,c" → number). */
export function cellNumbers(cw: Crossword): Map<string, number> {
  return new Map(cw.words.map((w) => [at(w.row, w.col), w.num]));
}

export const isSolved = (w: PlacedWord, fill: string[][]): boolean => wordCells(w).every(([r, c], i) => fill[r]?.[c] === w.answer[i]);
