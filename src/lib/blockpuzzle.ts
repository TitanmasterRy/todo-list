// Rules for Glow Grid (public/games/glowgrid.html), the arcade's block-placement puzzle.
// The game page is a single self-contained file, so it carries a plain-JS copy of these rules between
// its `logic:start` / `logic:end` markers; blockpuzzle.test.ts runs the same tests against both copies.
//
// An 8×8 board; three pieces are offered at a time and are placed as they are (no rotation). Full rows and
// columns clear. Points: 1 per block placed, plus 10·L·(L+1) for clearing L lines at once, times the combo
// streak (consecutive placements that clear), plus a bonus when the whole board is left empty.

export const SIZE = 8;
export const COLORS = 8;
export const LINE_POINTS = 10;
export const BOARD_CLEAR_POINTS = 300;
/** How many times deal() redraws a hand in which nothing fits before giving up. */
export const DEAL_TRIES = 12;

/** Board cells row by row: 0 is empty, 1..COLORS is a block of that colour. */
export type Board = number[];
export interface Shape {
  id: string;
  /** [row, col] offsets from the shape's top-left corner. */
  cells: [number, number][];
  w: number;
  h: number;
  /** Relative chance of being dealt. */
  weight: number;
}
export interface Piece {
  shape: Shape;
  color: number;
}
export interface PlaceResult {
  board: Board;
  rows: number[];
  cols: number[];
  /** Indexes of the cells that were emptied by the clear. */
  cleared: number[];
  lines: number;
  /** The streak after this placement: 0 when nothing cleared. */
  combo: number;
  boardClear: boolean;
  points: number;
  breakdown: { blocks: number; lines: number; boardClear: number };
}

export function parseShape(id: string, weight: number, rows: string[]): Shape {
  const cells: [number, number][] = [];
  rows.forEach((line, r) => [...line].forEach((ch, c) => ch === '#' && cells.push([r, c])));
  return { id, cells, w: Math.max(...rows.map((l) => l.length)), h: rows.length, weight };
}

const DEFS: [string, number, string[]][] = [
  ['dot', 2, ['#']],
  ['i2h', 3, ['##']],
  ['i2v', 3, ['#', '#']],
  ['i3h', 3, ['###']],
  ['i3v', 3, ['#', '#', '#']],
  ['i4h', 2, ['####']],
  ['i4v', 2, ['#', '#', '#', '#']],
  ['i5h', 1.5, ['#####']],
  ['i5v', 1.5, ['#', '#', '#', '#', '#']],
  ['o2', 3, ['##', '##']],
  ['o3', 1.2, ['###', '###', '###']],
  ['r23', 1.5, ['###', '###']],
  ['r32', 1.5, ['##', '##', '##']],
  ['v3a', 2, ['##', '#.']],
  ['v3b', 2, ['##', '.#']],
  ['v3c', 2, ['#.', '##']],
  ['v3d', 2, ['.#', '##']],
  ['t4u', 1.2, ['###', '.#.']],
  ['t4d', 1.2, ['.#.', '###']],
  ['t4l', 1.2, ['#.', '##', '#.']],
  ['t4r', 1.2, ['.#', '##', '.#']],
  ['l4a', 1, ['#.', '#.', '##']],
  ['l4b', 1, ['.#', '.#', '##']],
  ['l4c', 1, ['##', '#.', '#.']],
  ['l4d', 1, ['##', '.#', '.#']],
  ['l4e', 1, ['###', '#..']],
  ['l4f', 1, ['###', '..#']],
  ['l4g', 1, ['#..', '###']],
  ['l4h', 1, ['..#', '###']],
  ['s4h', 1, ['.##', '##.']],
  ['z4h', 1, ['##.', '.##']],
  ['s4v', 1, ['#.', '##', '.#']],
  ['z4v', 1, ['.#', '##', '#.']],
  ['l5a', 1, ['###', '#..', '#..']],
  ['l5b', 1, ['###', '..#', '..#']],
  ['l5c', 1, ['#..', '#..', '###']],
  ['l5d', 1, ['..#', '..#', '###']],
];
export const SHAPES: Shape[] = DEFS.map(([id, weight, rows]) => parseShape(id, weight, rows));
const TOTAL_WEIGHT = SHAPES.reduce((a, s) => a + s.weight, 0);

export const emptyBoard = (): Board => new Array(SIZE * SIZE).fill(0);

export function canPlace(board: Board, shape: Shape, row: number, col: number): boolean {
  if (row < 0 || col < 0 || row + shape.h > SIZE || col + shape.w > SIZE) return false;
  return shape.cells.every(([r, c]) => board[(row + r) * SIZE + col + c] === 0);
}

/** Every [row, col] where the shape fits, top-left first. */
export function fits(board: Board, shape: Shape): [number, number][] {
  const out: [number, number][] = [];
  for (let r = 0; r + shape.h <= SIZE; r++) for (let c = 0; c + shape.w <= SIZE; c++) if (canPlace(board, shape, r, c)) out.push([r, c]);
  return out;
}

export function fitsAnywhere(board: Board, shape: Shape): boolean {
  for (let r = 0; r + shape.h <= SIZE; r++) for (let c = 0; c + shape.w <= SIZE; c++) if (canPlace(board, shape, r, c)) return true;
  return false;
}

/** Full rows and columns of a board. */
export function fullLines(board: Board): { rows: number[]; cols: number[] } {
  const rows: number[] = [];
  const cols: number[] = [];
  for (let i = 0; i < SIZE; i++) {
    let row = true;
    let col = true;
    for (let j = 0; j < SIZE; j++) {
      if (!board[i * SIZE + j]) row = false;
      if (!board[j * SIZE + i]) col = false;
    }
    if (row) rows.push(i);
    if (col) cols.push(i);
  }
  return { rows, cols };
}

/** The rows and columns that would clear if the shape were dropped at row, col (none when it doesn't fit). */
export function previewClears(board: Board, shape: Shape, row: number, col: number): { rows: number[]; cols: number[] } {
  if (!canPlace(board, shape, row, col)) return { rows: [], cols: [] };
  const b = board.slice();
  for (const [r, c] of shape.cells) b[(row + r) * SIZE + col + c] = 1;
  return fullLines(b);
}

/** Points for one placement. `combo` is the streak including this placement (1 = first clear in a row). */
export function scoreFor(blocks: number, lines: number, combo: number, boardClear: boolean): PlaceResult['breakdown'] & { total: number } {
  const lineScore = lines ? LINE_POINTS * lines * (lines + 1) * Math.max(1, combo) : 0;
  const clearScore = boardClear ? BOARD_CLEAR_POINTS : 0;
  return { blocks, lines: lineScore, boardClear: clearScore, total: blocks + lineScore + clearScore };
}

/** Drop a piece; `combo` is the streak before this placement. Throws if it doesn't fit. */
export function place(board: Board, piece: Piece, row: number, col: number, combo: number): PlaceResult {
  if (!canPlace(board, piece.shape, row, col)) throw new Error(`${piece.shape.id} does not fit at ${row},${col}`);
  const b = board.slice();
  for (const [r, c] of piece.shape.cells) b[(row + r) * SIZE + col + c] = piece.color;
  const { rows, cols } = fullLines(b);
  const set = new Set<number>();
  for (const r of rows) for (let c = 0; c < SIZE; c++) set.add(r * SIZE + c);
  for (const c of cols) for (let r = 0; r < SIZE; r++) set.add(r * SIZE + c);
  const cleared = [...set].sort((x, y) => x - y);
  for (const i of cleared) b[i] = 0;
  const lines = rows.length + cols.length;
  const nextCombo = lines ? combo + 1 : 0;
  const boardClear = lines > 0 && b.every((v) => v === 0);
  const s = scoreFor(piece.shape.cells.length, lines, nextCombo, boardClear);
  return { board: b, rows, cols, cleared, lines, combo: nextCombo, boardClear, points: s.total, breakdown: { blocks: s.blocks, lines: s.lines, boardClear: s.boardClear } };
}

/** True when none of the pieces still in hand (nulls are already placed) fits anywhere. */
export function isGameOver(board: Board, hand: (Piece | null)[]): boolean {
  return !hand.some((p) => p && fitsAnywhere(board, p.shape));
}

/** Small seeded random number generator (mulberry32), so a game can be replayed from its seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomShape(rng: () => number): Shape {
  let x = rng() * TOTAL_WEIGHT;
  for (const s of SHAPES) if ((x -= s.weight) < 0) return s;
  return SHAPES[SHAPES.length - 1];
}

/** Three new pieces. Redraws a few times so at least one of them fits, when the board allows it. */
export function deal(rng: () => number, board: Board): Piece[] {
  let hand: Piece[] = [];
  for (let t = 0; t < DEAL_TRIES; t++) {
    hand = [0, 1, 2].map(() => ({ shape: randomShape(rng), color: 1 + Math.floor(rng() * COLORS) }));
    if (!isGameOver(board, hand)) break;
  }
  return hand;
}

// ---------- power-ups (bought with the app's coins over postMessage) ----------

export type PowerUp = 'reroll' | 'undo' | 'bomb' | 'continue';
export const POWERUPS: Record<PowerUp, { cost: number; label: string }> = {
  reroll: { cost: 5, label: 'Reroll pieces' },
  undo: { cost: 5, label: 'Undo last move' },
  bomb: { cost: 10, label: 'Bomb: clear a 3x3 area' },
  continue: { cost: 15, label: 'Continue: clear 3 rows' },
};
/** Points per block a bomb destroys. */
export const BOMB_POINTS = 2;

/** The message a game posts to ask the app to spend coins. `n` makes the id unique per request. */
export function buyRequest(kind: PowerUp, n: number): { type: 'hwtodo:buy'; id: string; label: string; cost: number } {
  const { cost, label } = POWERUPS[kind];
  return { type: 'hwtodo:buy', id: `${kind}-${n}`.slice(0, 40), label: label.slice(0, 60), cost };
}

/** Cells of the 3×3 square centred on row, col (cut off at the edges). */
export function bombArea(row: number, col: number): number[] {
  const out: number[] = [];
  for (let r = row - 1; r <= row + 1; r++) for (let c = col - 1; c <= col + 1; c++) if (r >= 0 && c >= 0 && r < SIZE && c < SIZE) out.push(r * SIZE + c);
  return out;
}

/** A bomb can go on any cell, empty or not; it empties the 3×3 around it. */
export function detonate(board: Board, row: number, col: number): { board: Board; cleared: number[]; points: number } {
  if (row < 0 || col < 0 || row >= SIZE || col >= SIZE) throw new Error(`bomb off the board at ${row},${col}`);
  const b = board.slice();
  const cleared = bombArea(row, col).filter((i) => b[i]);
  for (const i of cleared) b[i] = 0;
  return { board: b, cleared, points: cleared.length * BOMB_POINTS };
}

/** The n rows with the most blocks (ties go to the upper row), top to bottom. */
export function mostFilledRows(board: Board, n = 3): number[] {
  const count = (r: number) => board.slice(r * SIZE, r * SIZE + SIZE).filter(Boolean).length;
  return [...Array(SIZE).keys()]
    .sort((a, b) => count(b) - count(a) || a - b)
    .slice(0, n)
    .sort((a, b) => a - b);
}

/** "Continue" after game over: empty the three most-filled rows. */
export function continueClear(board: Board): { board: Board; rows: number[]; cleared: number[] } {
  const rows = mostFilledRows(board, 3);
  const b = board.slice();
  const cleared: number[] = [];
  for (const r of rows)
    for (let c = 0; c < SIZE; c++) {
      const i = r * SIZE + c;
      if (!b[i]) continue;
      cleared.push(i);
      b[i] = 0;
    }
  return { board: b, rows, cleared: cleared.sort((x, y) => x - y) };
}

/** What "undo" puts back: the state just before the last placement. */
export interface Snapshot {
  board: Board;
  hand: (Piece | null)[];
  combo: number;
  score: number;
}
export const snapshot = (s: Snapshot): Snapshot => ({ board: s.board.slice(), hand: s.hand.slice(), combo: s.combo, score: s.score });
