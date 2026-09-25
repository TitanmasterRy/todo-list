import { describe, expect, it } from 'vitest';
import type { Card } from './types';
import { canCrossword, cellNumbers, crosswordEntries, generateCrossword, isSolved, toAnswer, wordAt, wordCells, type ClueEntry, type Crossword } from './crossword';

const card = (id: string, front: string, back: string): Card => ({ id, deckId: 'd', front, back, box: 1, due: '2026-01-01', reps: 0, lapses: 0, createdAt: '', updatedAt: '' });
const entries = (words: string[]): ClueEntry[] => words.map((w, i) => ({ id: `e${i}`, answer: w, clue: `clue ${w}` }));

const VOCAB = ['NUCLEUS', 'MITOCHONDRIA', 'RIBOSOME', 'CELL', 'MEMBRANE', 'CHLOROPLAST', 'VACUOLE', 'CYTOPLASM', 'LYSOSOME', 'GOLGI', 'ENZYME', 'PROTEIN', 'OSMOSIS', 'DIFFUSION'];

/** Every problem with a finished grid: wrong letters, words touching, runs of letters that aren't words, numbering. */
function problems(cw: Crossword): string[] {
  const out: string[] = [];
  const letter = (r: number, c: number) => (r >= 0 && c >= 0 && r < cw.rows && c < cw.cols ? cw.cells[r][c] : null);
  // each word reads correctly from the grid, and nothing continues past either end
  for (const w of cw.words) {
    const read = wordCells(w)
      .map(([r, c]) => letter(r, c) ?? '.')
      .join('');
    if (read !== w.answer) out.push(`${w.num} ${w.dir} reads ${read}, not ${w.answer}`);
    const [dr, dc] = w.dir === 'across' ? [0, 1] : [1, 0];
    if (letter(w.row - dr, w.col - dc) || letter(w.row + dr * w.answer.length, w.col + dc * w.answer.length)) out.push(`${w.answer} runs into another letter`);
  }
  // every run of 2+ letters in a row or column is exactly one placed word (so no side-by-side nonsense)
  for (const dir of ['across', 'down'] as const) {
    const lines = dir === 'across' ? cw.rows : cw.cols;
    const len = dir === 'across' ? cw.cols : cw.rows;
    for (let a = 0; a < lines; a++) {
      let start = -1;
      for (let b = 0; b <= len; b++) {
        const ch = b < len ? (dir === 'across' ? letter(a, b) : letter(b, a)) : null;
        if (ch && start < 0) start = b;
        if (!ch && start >= 0) {
          if (b - start >= 2) {
            const [r, c] = dir === 'across' ? [a, start] : [start, a];
            const w = cw.words.find((x) => x.dir === dir && x.row === r && x.col === c && x.answer.length === b - start);
            if (!w) out.push(`stray ${dir} run at ${r},${c}`);
          }
          start = -1;
        }
      }
    }
  }
  // every letter square belongs to a word
  for (let r = 0; r < cw.rows; r++) for (let c = 0; c < cw.cols; c++) if (cw.cells[r][c] && !wordAt(cw, r, c, 'across') && !wordAt(cw, r, c, 'down')) out.push(`orphan ${r},${c}`);
  // numbers go 1, 2, 3… in reading order, shared by an across and a down that start on the same square
  const starts = [...new Set(cw.words.map((w) => w.row * 1000 + w.col))].sort((a, b) => a - b);
  for (const w of cw.words) if (w.num !== starts.indexOf(w.row * 1000 + w.col) + 1) out.push(`${w.answer} numbered ${w.num}`);
  const order = cw.words.map((w) => `${w.num}${w.dir}`);
  const sorted = [...cw.words].sort((a, b) => a.num - b.num || (a.dir === 'across' ? -1 : 1)).map((w) => `${w.num}${w.dir}`);
  if (order.join() !== sorted.join()) out.push('clues out of order');
  // one connected puzzle
  if (cw.words.length > 1) {
    const seen = new Set([0]);
    const queue = [0];
    while (queue.length) {
      const i = queue.pop()!;
      const mine = new Set(wordCells(cw.words[i]).map(([r, c]) => `${r},${c}`));
      cw.words.forEach((w, j) => {
        if (!seen.has(j) && wordCells(w).some(([r, c]) => mine.has(`${r},${c}`))) {
          seen.add(j);
          queue.push(j);
        }
      });
    }
    if (seen.size !== cw.words.length) out.push('not connected');
  }
  return out;
}

describe('picking answers', () => {
  it('keeps letters only, uppercased, accents dropped', () => {
    expect(toAnswer('búho')).toBe('BUHO');
    expect(toAnswer("  rock 'n' roll ")).toBe('ROCKNROLL');
    expect(toAnswer('cell membrane')).toBe('CELLMEMBRANE');
    expect(toAnswer('x-ray')).toBe('XRAY');
  });
  it('rejects long, short, numeric and non-Latin sides', () => {
    expect(toAnswer('the powerhouse of the cell')).toBeNull(); // too many words
    expect(toAnswer('electroencephalography')).toBeNull(); // 22 letters
    expect(toAnswer('ox')).toBeNull();
    expect(toAnswer('H2O')).toBeNull();
    expect(toAnswer('1945')).toBeNull();
    expect(toAnswer('猫')).toBeNull();
    expect(toAnswer('to eat (verb)')).toBeNull();
    expect(toAnswer('')).toBeNull();
  });
  it('uses the back when it is a short term, the front when the back is a definition', () => {
    const got = crosswordEntries([
      card('a', 'cat', 'gato'),
      card('b', 'Mitochondria', 'Organelle that makes most of the cell’s ATP'),
      card('c', 'The [...] holds DNA.', 'nucleus\n\nThe nucleus holds DNA.'),
    ]);
    expect(got).toEqual([
      { id: 'a', answer: 'GATO', clue: 'cat' },
      { id: 'b', answer: 'MITOCHONDRIA', clue: 'Organelle that makes most of the cell’s ATP' },
      { id: 'c', answer: 'NUCLEUS', clue: 'The [...] holds DNA.' },
    ]);
  });
  it('blanks the answer out of its clue, skips duplicates, same-both-sides and cards that fit neither way', () => {
    const got = crosswordEntries([
      card('a', 'Osmosis', 'Osmosis is water moving across a membrane'),
      card('b', 'osmosis (again)', 'osmosis'),
      card('c', 'taxi', 'taxi'),
      card('d', 'What year did WW2 end?', '1945'),
      card('e', 'Cat', 'category of things'), // "cat" inside "category" is left alone
    ]);
    expect(got).toEqual([
      { id: 'a', answer: 'OSMOSIS', clue: '___ is water moving across a membrane' },
      { id: 'e', answer: 'CAT', clue: 'category of things' },
    ]);
  });
  it('needs five usable cards', () => {
    const cards = ['uno', 'dos', 'tres', 'cuatro'].map((w, i) => card(`c${i}`, `${i + 1}`, w));
    expect(canCrossword(cards)).toBe(false);
    expect(canCrossword([...cards, card('x', '5', 'cinco')])).toBe(true);
    expect(canCrossword([...cards, card('x', 'H2O', 'what you drink every single day')])).toBe(false);
    expect(canCrossword([...cards, card('x', 'five', '5')])).toBe(true); // the front is the answer then
  });
});

describe('layout', () => {
  it('is valid for many seeds and word lists', () => {
    const lists = [
      VOCAB,
      ['GATO', 'PERRO', 'VACA', 'GALLINA', 'CERDO', 'BUHO', 'CABALLO', 'OVEJA', 'RATON', 'CONEJO'],
      ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF'],
    ];
    for (const list of lists) {
      for (let seed = 1; seed <= 40; seed++) {
        const cw = generateCrossword(entries(list), seed);
        expect(problems(cw), `seed ${seed}`).toEqual([]);
        expect(cw.words.length + cw.skipped.length).toBe(list.length);
        expect(cw.rows).toBeLessThanOrEqual(17);
        expect(cw.cols).toBeLessThanOrEqual(17);
      }
    }
  });
  it('crosses words that share letters and places most of a normal vocab list', () => {
    const cw = generateCrossword(entries(VOCAB), 7);
    expect(cw.words.length).toBeGreaterThanOrEqual(10);
    const across = cw.words.filter((w) => w.dir === 'across').length;
    expect(across).toBeGreaterThan(0);
    expect(across).toBeLessThan(cw.words.length);
  });
  it('is the same puzzle for the same seed, and usually a different one for another', () => {
    const a = generateCrossword(entries(VOCAB), 42);
    expect(generateCrossword(entries(VOCAB), 42)).toEqual(a);
    const layouts = new Set(Array.from({ length: 8 }, (_, s) => JSON.stringify(generateCrossword(entries(VOCAB), s + 1).cells)));
    expect(layouts.size).toBeGreaterThan(1);
  });
  it('skips words that share no letters with the rest', () => {
    const cw = generateCrossword(entries(['ABCD', 'CDEF', 'XYZZY']), 1);
    expect(cw.words.map((w) => w.answer).sort()).toEqual(['ABCD', 'CDEF']);
    expect(cw.skipped.map((s) => s.answer)).toEqual(['XYZZY']);
    expect(problems(cw)).toEqual([]);
  });
  it('caps the word count and grid size', () => {
    const cw = generateCrossword(entries(VOCAB), 3, { maxWords: 5 });
    expect(cw.words).toHaveLength(5);
    expect(problems(cw)).toEqual([]);
    const small = generateCrossword(entries(VOCAB), 3, { maxSize: 12 });
    expect(Math.max(small.rows, small.cols)).toBeLessThanOrEqual(12);
    expect(small.words.some((w) => w.answer === 'MITOCHONDRIA' || w.answer === 'CHLOROPLAST')).toBe(true);
    expect(problems(small)).toEqual([]);
  });
  it('handles an empty or one-word list', () => {
    expect(generateCrossword([], 1)).toEqual({ rows: 0, cols: 0, cells: [], words: [], skipped: [] });
    const one = generateCrossword(entries(['SOLO']), 1);
    expect(one.rows).toBe(1);
    expect(one.words[0]).toMatchObject({ num: 1, dir: 'across', row: 0, col: 0 });
  });
});

describe('playing helpers', () => {
  const cw = generateCrossword(entries(VOCAB), 5);
  it('finds the word through a square in each direction', () => {
    for (const w of cw.words) for (const [r, c] of wordCells(w)) expect(wordAt(cw, r, c, w.dir)).toBe(w);
    const nums = cellNumbers(cw);
    for (const w of cw.words) expect(nums.get(`${w.row},${w.col}`)).toBe(w.num);
  });
  it('knows when a word is filled in right', () => {
    const fill = cw.cells.map((row) => row.map(() => ''));
    const w = cw.words[0];
    expect(isSolved(w, fill)).toBe(false);
    wordCells(w).forEach(([r, c], i) => (fill[r][c] = w.answer[i]));
    expect(isSolved(w, fill)).toBe(true);
    const [r, c] = wordCells(w)[1];
    fill[r][c] = 'Q';
    expect(isSolved(w, fill)).toBe(false);
  });
});
