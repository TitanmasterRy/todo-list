import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import * as ts from './blockpuzzle';
import type { Board, Piece, Shape } from './blockpuzzle';

// The game page carries its own plain-JS copy of the rules (it has to be one self-contained file).
// Pull that copy out and run every test against both, so the two can't drift apart.
const html = readFileSync(new URL('../../public/games/glowgrid.html', import.meta.url), 'utf8');
const inline = /\/\* logic:start[^\n]*\n([\s\S]*?)\/\* logic:end \*\//.exec(html)?.[1];
const NAMES = Object.keys(ts);
const page = runInNewContext(`${inline}\n;({ ${NAMES.join(', ')} })`) as typeof ts;

/** Board from 8 strings: '.' empty, a digit is a block of that colour. */
const grid = (...rows: string[]): Board =>
  rows
    .join('')
    .split('')
    .map((ch) => (ch === '.' ? 0 : Number(ch)));

describe('the page copy of the rules', () => {
  it('is present and exports the same things', () => {
    expect(inline).toBeTruthy();
    for (const k of NAMES) expect(typeof (page as Record<string, unknown>)[k], k).toBe(typeof (ts as Record<string, unknown>)[k]);
  });
  it('deals the same pieces and plays out the same game from a seed', () => {
    for (const seed of [1, 42, 2026]) {
      const play = (m: typeof ts) => {
        const rng = m.mulberry32(seed);
        let board = m.emptyBoard();
        let combo = 0;
        let score = 0;
        const log: string[] = [];
        for (let turn = 0; turn < 40; turn++) {
          const hand = m.deal(rng, board);
          for (const p of hand) {
            const spot = m.fits(board, p.shape)[0];
            if (!spot) continue;
            const r = m.place(board, p, spot[0], spot[1], combo);
            board = r.board;
            combo = r.combo;
            score += r.points;
            log.push(`${p.shape.id}:${p.color}@${spot}=${r.points}`);
          }
          if (m.isGameOver(board, hand)) break;
        }
        return { log, score, board };
      };
      expect(JSON.parse(JSON.stringify(play(page)))).toEqual(play(ts));
    }
  });
  it('has the same shapes and constants', () => {
    expect(JSON.parse(JSON.stringify(page.SHAPES))).toEqual(ts.SHAPES);
    expect([page.SIZE, page.COLORS, page.LINE_POINTS, page.BOARD_CLEAR_POINTS, page.BOMB_POINTS]).toEqual([
      ts.SIZE,
      ts.COLORS,
      ts.LINE_POINTS,
      ts.BOARD_CLEAR_POINTS,
      ts.BOMB_POINTS,
    ]);
    expect(JSON.parse(JSON.stringify(page.POWERUPS))).toEqual(ts.POWERUPS);
  });
});

describe.each([
  ['blockpuzzle.ts', ts],
  ['glowgrid.html', page],
])('rules (%s)', (_name, m) => {
  const shape = (id: string): Shape => m.SHAPES.find((s) => s.id === id)!;
  const piece = (id: string, color = 3): Piece => ({ shape: shape(id), color });

  it('defines every shape once, within 5×5, with its own footprint', () => {
    const ids = new Set(m.SHAPES.map((s) => s.id));
    expect(ids.size).toBe(m.SHAPES.length);
    const footprints = new Set(m.SHAPES.map((s) => JSON.stringify(s.cells)));
    expect(footprints.size).toBe(m.SHAPES.length);
    for (const s of m.SHAPES) {
      expect(s.w).toBeLessThanOrEqual(5);
      expect(s.h).toBeLessThanOrEqual(5);
      expect(s.weight).toBeGreaterThan(0);
      expect(Math.max(...s.cells.map((c) => c[0]))).toBe(s.h - 1);
      expect(Math.max(...s.cells.map((c) => c[1]))).toBe(s.w - 1);
    }
    expect(shape('l5a').cells).toHaveLength(5);
    expect(shape('o3').cells).toHaveLength(9);
  });

  it('checks fit against edges and blocks', () => {
    const b = grid('........', '..1.....', '........', '........', '........', '........', '........', '........');
    expect(m.canPlace(b, shape('o2'), 0, 0)).toBe(true);
    expect(m.canPlace(b, shape('o2'), 0, 1)).toBe(false); // covers the block at 1,2
    expect(m.canPlace(b, shape('i5h'), 0, 3)).toBe(true);
    expect(m.canPlace(b, shape('i5h'), 0, 4)).toBe(false); // off the right edge
    expect(m.canPlace(b, shape('i3v'), 6, 0)).toBe(false); // off the bottom
    expect(m.canPlace(b, shape('dot'), -1, 0)).toBe(false);
    // an L's empty corner can sit over a block
    expect(m.canPlace(b, shape('v3a'), 0, 1)).toBe(true);
    expect(m.canPlace(b, shape('v3d'), 0, 1)).toBe(false);
    expect(m.fits(m.emptyBoard(), shape('o3'))).toHaveLength(36);
  });

  it('finds full rows and columns, and previews what a drop would clear', () => {
    const b = grid('1111111.', '1.......', '1.......', '1.......', '1.......', '1.......', '1.......', '........');
    expect(m.fullLines(b)).toEqual({ rows: [], cols: [] });
    expect(m.previewClears(b, shape('dot'), 0, 7)).toEqual({ rows: [0], cols: [] });
    expect(m.previewClears(b, shape('dot'), 7, 0)).toEqual({ rows: [], cols: [0] });
    expect(m.previewClears(b, shape('dot'), 5, 5)).toEqual({ rows: [], cols: [] });
    expect(m.previewClears(b, shape('dot'), 0, 0)).toEqual({ rows: [], cols: [] }); // doesn't fit
  });

  it('scores blocks, lines, multi-line clears and combos', () => {
    expect(m.scoreFor(4, 0, 0, false).total).toBe(4);
    expect(m.scoreFor(1, 1, 1, false).total).toBe(1 + 20);
    expect(m.scoreFor(3, 2, 1, false).total).toBe(3 + 60);
    expect(m.scoreFor(3, 3, 1, false).lines).toBe(120);
    expect(m.scoreFor(3, 1, 3, false).lines).toBe(60); // combo x3 triples it
    expect(m.scoreFor(2, 1, 1, true)).toEqual({ blocks: 2, lines: 20, boardClear: 300, total: 322 });
  });

  it('places a piece, clears a row and a column at once, and counts the combo', () => {
    const b = grid('.1111111', '1.......', '1.......', '1.......', '1.......', '1.......', '1.......', '12......');
    const r = m.place(b, piece('dot', 5), 0, 0, 0);
    expect(r.rows).toEqual([0]);
    expect(r.cols).toEqual([0]);
    expect(r.lines).toBe(2);
    expect(r.combo).toBe(1);
    expect(r.cleared).toHaveLength(15);
    expect(r.board.filter(Boolean)).toHaveLength(1); // the 2 at 7,1 is left
    expect(r.boardClear).toBe(false);
    expect(r.points).toBe(1 + 60);
    // the input board is untouched
    expect(b[1]).toBe(1);
    // next clearing placement continues the streak; a non-clearing one ends it
    const r2 = m.place(grid('.1111111', ...Array(7).fill('........')), piece('dot'), 0, 0, 2);
    expect(r2.combo).toBe(3);
    expect(r2.points).toBe(1 + 20 * 3 + 300);
    expect(r2.boardClear).toBe(true);
    expect(m.place(m.emptyBoard(), piece('o2'), 3, 3, 4).combo).toBe(0);
    expect(() => m.place(b, piece('o2'), 0, 0, 0)).toThrow();
  });

  it('ends the game only when no remaining piece fits', () => {
    // a checkerboard: nothing bigger than a single block fits
    const b = grid(...Array.from({ length: 8 }, (_, r) => (r % 2 ? '.1.1.1.1' : '1.1.1.1.')));
    expect(m.isGameOver(b, [piece('i2h'), piece('o2'), null])).toBe(true);
    expect(m.isGameOver(b, [piece('i2h'), null, piece('dot')])).toBe(false);
    expect(m.isGameOver(b, [null, null, null])).toBe(true);
    expect(m.isGameOver(m.emptyBoard(), [piece('o3')])).toBe(false);
  });

  it('deals three seeded pieces, with a fitting one whenever the board allows', () => {
    const a = m.deal(m.mulberry32(9), m.emptyBoard());
    const b = m.deal(m.mulberry32(9), m.emptyBoard());
    expect(a.map((p) => p.shape.id)).toEqual(b.map((p) => p.shape.id));
    expect(a).toHaveLength(3);
    for (const p of a) {
      expect(p.color).toBeGreaterThanOrEqual(1);
      expect(p.color).toBeLessThanOrEqual(m.COLORS);
    }
    // a board with a single hole: redraws until a single block turns up (or gives up after DEAL_TRIES)
    const holey = grid('.1111111', ...Array(7).fill('11111111'));
    let fitting = 0;
    let single = 0;
    for (let seed = 0; seed < 200; seed++) {
      if (!m.isGameOver(holey, m.deal(m.mulberry32(seed), holey))) fitting++;
      const rng = m.mulberry32(seed);
      if ([0, 1, 2].some(() => m.randomShape(rng).id === 'dot')) single++;
    }
    // a single draw finds the one-block piece ~10% of the time; redrawing gets it most of the time
    expect(single).toBeLessThan(40);
    expect(fitting).toBeGreaterThan(120);
  });

  it('draws shapes roughly by weight', () => {
    const rng = m.mulberry32(5);
    const n: Record<string, number> = {};
    for (let i = 0; i < 20000; i++) {
      const id = m.randomShape(rng).id;
      n[id] = (n[id] ?? 0) + 1;
    }
    expect(Object.keys(n)).toHaveLength(m.SHAPES.length);
    expect(n.o2 / n.l4a).toBeGreaterThan(2);
    expect(n.o2 / n.l4a).toBeLessThan(4);
  });

  describe('power-ups', () => {
    it('builds buy requests the app accepts', () => {
      for (const kind of ['reroll', 'undo', 'bomb', 'continue'] as const) {
        const req = m.buyRequest(kind, 12);
        expect(req.type).toBe('hwtodo:buy');
        expect(req.id).toMatch(/^[a-z0-9-]{1,40}$/);
        expect(req.label.length).toBeLessThanOrEqual(60);
        expect(Number.isInteger(req.cost) && req.cost >= 1 && req.cost <= 50).toBe(true);
      }
      expect(m.buyRequest('reroll', 3)).toEqual({ type: 'hwtodo:buy', id: 'reroll-3', label: 'Reroll pieces', cost: 5 });
      expect(m.buyRequest('undo', 1).id).not.toBe(m.buyRequest('undo', 2).id);
      expect([m.POWERUPS.reroll.cost, m.POWERUPS.undo.cost, m.POWERUPS.bomb.cost, m.POWERUPS.continue.cost]).toEqual([5, 5, 10, 15]);
    });

    it('a bomb empties the 3×3 around it, cut off at the edges, and scores what it destroys', () => {
      expect(m.bombArea(4, 4)).toEqual([27, 28, 29, 35, 36, 37, 43, 44, 45]);
      expect(m.bombArea(0, 0)).toEqual([0, 1, 8, 9]);
      expect(m.bombArea(7, 3)).toHaveLength(6);
      const b = grid('11111111', '11111111', '11111111', '........', '........', '........', '........', '.......4');
      const r = m.detonate(b, 1, 1);
      expect(r.cleared).toEqual([0, 1, 2, 8, 9, 10, 16, 17, 18]);
      expect(r.points).toBe(9 * m.BOMB_POINTS);
      expect(r.board.slice(0, 8)).toEqual([0, 0, 0, 1, 1, 1, 1, 1]);
      expect(b[0]).toBe(1);
      // it can land on an empty spot, and only counts real blocks
      const r2 = m.detonate(b, 7, 7);
      expect(r2.cleared).toEqual([63]);
      expect(r2.points).toBe(m.BOMB_POINTS);
      expect(m.detonate(m.emptyBoard(), 3, 3).points).toBe(0);
      expect(() => m.detonate(b, 8, 0)).toThrow();
    });

    it('continue clears the three most-filled rows', () => {
      const b = grid('1.......', '1111111.', '11......', '1111....', '........', '111111..', '11111...', '1.......');
      expect(m.mostFilledRows(b)).toEqual([1, 5, 6]);
      const r = m.continueClear(b);
      expect(r.rows).toEqual([1, 5, 6]);
      expect(r.cleared).toHaveLength(7 + 6 + 5);
      expect(r.board.filter(Boolean)).toHaveLength(1 + 2 + 4 + 1);
      // ties go to the upper rows
      expect(m.mostFilledRows(m.emptyBoard())).toEqual([0, 1, 2]);
      // afterwards a stuck board has room again
      const stuck = grid(...Array.from({ length: 8 }, (_, i) => (i % 2 ? '.1.1.1.1' : '1.1.1.1.')));
      expect(m.isGameOver(stuck, [piece('o2')])).toBe(true);
      expect(m.isGameOver(m.continueClear(stuck).board, [piece('i3h')])).toBe(false);
    });

    it('undo snapshots are independent copies that restore the state before a move', () => {
      const hand = [piece('o2'), piece('dot'), null];
      const before = { board: m.emptyBoard(), hand, combo: 2, score: 40 };
      const snap = m.snapshot(before);
      const r = m.place(before.board, hand[0]!, 0, 0, before.combo);
      hand[0] = null;
      expect(r.board.filter(Boolean)).toHaveLength(4);
      expect(snap.board.every((v) => v === 0)).toBe(true);
      expect(snap.hand[0]?.shape.id).toBe('o2');
      expect(snap).toEqual({ board: m.emptyBoard(), hand: [piece('o2'), piece('dot'), null], combo: 2, score: 40 });
    });
  });
});
