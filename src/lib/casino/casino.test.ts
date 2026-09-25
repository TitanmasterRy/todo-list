import { describe, expect, it } from 'vitest';
import { seeded, randInt, shuffle } from './rng';
import type { PlayingCard } from './cards';
import { slotsRtp, slotPayout, spinSlots } from './slots';
import { handValue, deal, hit, stand, doubleDown } from './blackjack';
import { wins, settleRoulette, color } from './roulette';
import { evaluatePoker, vpDeal, vpDraw } from './videopoker';
import { bankerDraws, bacTotal, playBaccarat, settleBaccarat } from './baccarat';
import { crapsRoll, fieldPayout } from './craps';
import {
  hiloMultiplier,
  dropPlinko,
  PLINKO_TABLE,
  PLINKO_ROWS,
  KENO_PAYS,
  KENO_NUMBERS,
  KENO_DRAWN,
  kenoMultiplier,
  minesMultiplier,
  diceMultiplier,
  diceWins,
  WHEEL_LAYOUT,
  WHEEL_SEGMENTS,
  makeScratchCard,
  SCRATCH_PRIZES,
} from './quick';

const c = (rank: number, suit: PlayingCard['suit'] = '♠'): PlayingCard => ({ rank, suit });
const comb = (n: number, k: number): number => (k < 0 || k > n ? 0 : k === 0 ? 1 : (comb(n - 1, k - 1) * n) / k);

describe('rng', () => {
  it('randInt stays in range and shuffle keeps elements', () => {
    const r = seeded(1);
    for (let i = 0; i < 1000; i++) {
      const n = randInt(7, r);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
    expect(shuffle([1, 2, 3, 4, 5], r).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('slots', () => {
  it('returns about 95% in theory', () => {
    expect(slotsRtp()).toBeGreaterThan(0.93);
    expect(slotsRtp()).toBeLessThan(0.97);
  });
  it('pays three of a kind and two cherries', () => {
    expect(slotPayout([5, 5, 5]).multiplier).toBe(500);
    expect(slotPayout([0, 3, 0]).multiplier).toBe(1);
    expect(slotPayout([1, 2, 3]).multiplier).toBe(0);
  });
  it('simulated return is close to theory', () => {
    const r = seeded(42);
    let paid = 0;
    const n = 200_000;
    for (let i = 0; i < n; i++) paid += spinSlots(r).multiplier;
    expect(paid / n).toBeGreaterThan(0.85);
    expect(paid / n).toBeLessThan(1.05);
  });
});

describe('blackjack', () => {
  it('counts aces soft and hard', () => {
    expect(handValue([c(14), c(13)]).total).toBe(21);
    expect(handValue([c(14), c(14), c(9)]).total).toBe(21);
    expect(handValue([c(14), c(6)])).toEqual({ total: 17, soft: true });
    expect(handValue([c(14), c(6), c(10)])).toEqual({ total: 17, soft: false });
  });
  it('plays a full round and pays sensibly', () => {
    const r = seeded(7);
    for (let i = 0; i < 500; i++) {
      let s = deal(10, undefined, r);
      if (s.phase === 'player') s = i % 3 === 0 ? doubleDown(s, r) : i % 3 === 1 ? stand(hit(s, r), r) : stand(s, r);
      expect(s.phase).toBe('done');
      expect([0, s.bet, s.bet * 2, 25]).toContain(s.payout);
      if (s.outcome !== 'bust' && s.outcome !== 'blackjack' && s.outcome !== 'lose' && s.outcome !== 'push') {
        expect(s.payout).toBe(s.bet * 2);
      }
    }
  });
});

describe('roulette', () => {
  it('zero loses outside bets', () => {
    expect(wins({ kind: 'red' }, 0)).toBe(false);
    expect(wins({ kind: 'even' }, 0)).toBe(false);
    expect(color(0)).toBe('green');
  });
  it('pays straight 35:1 and dozens 2:1', () => {
    expect(settleRoulette([{ bet: { kind: 'straight', n: 17 }, amount: 10 }], 17)).toBe(360);
    expect(settleRoulette([{ bet: { kind: 'dozen', d: 2 }, amount: 10 }], 13)).toBe(30);
    expect(settleRoulette([{ bet: { kind: 'column', c: 1 }, amount: 10 }], 34)).toBe(30);
    expect(settleRoulette([{ bet: { kind: 'black' }, amount: 10 }], 17)).toBe(20);
  });
});

describe('video poker', () => {
  it('ranks hands', () => {
    expect(evaluatePoker([c(10), c(11), c(12), c(13), c(14)])).toBe('royal');
    expect(evaluatePoker([c(14, '♥'), c(2), c(3), c(4), c(5)])).toBe('straight');
    expect(evaluatePoker([c(9), c(9, '♥'), c(9, '♦'), c(4), c(4, '♥')])).toBe('fullHouse');
    expect(evaluatePoker([c(11), c(11, '♥'), c(3), c(4, '♦'), c(8)])).toBe('jacksOrBetter');
    expect(evaluatePoker([c(10), c(10, '♥'), c(3), c(4, '♦'), c(8)])).toBe('nothing');
    expect(evaluatePoker([c(2), c(7), c(9), c(11), c(13)])).toBe('flush');
  });
  it('draw replaces only unheld cards', () => {
    const s = vpDeal(seeded(3));
    const held = { ...s, held: [true, false, true, false, false] };
    const d = vpDraw(held, 5);
    expect(d.hand[0]).toEqual(s.hand[0]);
    expect(d.hand[2]).toEqual(s.hand[2]);
    expect(d.phase).toBe('done');
  });
});

describe('baccarat', () => {
  it('follows the banker drawing table', () => {
    expect(bankerDraws(5, undefined)).toBe(true);
    expect(bankerDraws(6, undefined)).toBe(false);
    expect(bankerDraws(3, 8)).toBe(false);
    expect(bankerDraws(6, 6)).toBe(true);
    expect(bankerDraws(4, 1)).toBe(false);
  });
  it('totals mod 10 and settles bets', () => {
    expect(bacTotal([c(9), c(8)])).toBe(7);
    expect(settleBaccarat('banker', 100, 'banker')).toBe(195);
    expect(settleBaccarat('player', 100, 'tie')).toBe(100);
    expect(settleBaccarat('tie', 10, 'tie')).toBe(90);
    const r = playBaccarat(seeded(9));
    expect(r.player.length).toBeGreaterThanOrEqual(2);
  });
});

describe('craps', () => {
  it('handles come-out and point rolls', () => {
    const s = { point: null, passBet: 10, dontPassBet: 0, message: '' };
    expect(crapsRoll(s, [3, 4]).returned).toBe(20);
    expect(crapsRoll(s, [1, 1]).returned).toBe(0);
    const p = crapsRoll(s, [2, 2]);
    expect(p.state.point).toBe(4);
    expect(crapsRoll(p.state, [1, 3]).returned).toBe(20);
    expect(crapsRoll(p.state, [3, 4]).returned).toBe(0);
    expect(crapsRoll({ ...s, passBet: 0, dontPassBet: 10 }, [6, 6]).returned).toBe(10);
  });
  it('field bet', () => {
    expect(fieldPayout(12, 10)).toBe(40);
    expect(fieldPayout(7, 10)).toBe(0);
  });
});

describe('probability-priced games keep a 3% edge', () => {
  it('hi-lo', () => {
    expect(hiloMultiplier(14, 'higher')).toBe(0);
    expect(hiloMultiplier(8, 'higher') * (6 / 13)).toBeLessThanOrEqual(0.97);
  });
  it('mines', () => {
    expect(minesMultiplier(3, 0)).toBe(1);
    const p = (22 / 25) * (21 / 24);
    expect(minesMultiplier(3, 2) * p).toBeLessThanOrEqual(0.97);
    expect(minesMultiplier(3, 2) * p).toBeGreaterThan(0.96);
  });
  it('dice', () => {
    expect(diceMultiplier(50, 'under')).toBeCloseTo(1.94, 2);
    expect(diceWins(49.99, 50, 'under')).toBe(true);
    expect(diceWins(50, 50, 'over')).toBe(true);
  });
});

describe('plinko and keno return under 100%', () => {
  it('plinko tables', () => {
    for (const t of Object.values(PLINKO_TABLE)) {
      expect(t).toHaveLength(PLINKO_ROWS + 1);
      const rtp = t.reduce((s, m, k) => s + (m * comb(PLINKO_ROWS, k)) / 2 ** PLINKO_ROWS, 0);
      expect(rtp).toBeLessThan(1);
      expect(rtp).toBeGreaterThan(0.95);
    }
    const d = dropPlinko(seeded(5));
    expect(d.bucket).toBe(d.path.reduce((a, b) => a + b, 0));
  });
  it('keno paytables', () => {
    for (const [picks, table] of Object.entries(KENO_PAYS)) {
      const n = Number(picks);
      let rtp = 0;
      for (const [h, m] of Object.entries(table)) {
        const hits = Number(h);
        rtp += (m * comb(KENO_DRAWN, hits) * comb(KENO_NUMBERS - KENO_DRAWN, n - hits)) / comb(KENO_NUMBERS, n);
      }
      expect(rtp).toBeLessThan(0.97);
      expect(rtp).toBeGreaterThan(0.9);
    }
    expect(kenoMultiplier([1, 2], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual({ hits: 2, multiplier: 8.6 });
  });
});

describe('wheel and scratch', () => {
  it('wheel layout has 54 slots with the right counts', () => {
    expect(WHEEL_LAYOUT).toHaveLength(54);
    for (const s of WHEEL_SEGMENTS) expect(WHEEL_LAYOUT.filter((x) => x === s.id)).toHaveLength(s.count);
  });
  it('scratch cards: winners have exactly one triple, losers none', () => {
    const r = seeded(11);
    for (let i = 0; i < 2000; i++) {
      const { cells, mult } = makeScratchCard(r);
      expect(cells).toHaveLength(9);
      const counts = new Map<string, number>();
      for (const x of cells) counts.set(x, (counts.get(x) ?? 0) + 1);
      const triples = [...counts.values()].filter((n) => n >= 3).length;
      expect(triples).toBe(mult > 0 ? 1 : 0);
    }
    const total = SCRATCH_PRIZES.reduce((a, p) => a + p.weight, 0);
    const rtp = SCRATCH_PRIZES.reduce((a, p) => a + (p.mult * p.weight) / total, 0);
    expect(rtp).toBeLessThan(0.95);
  });
});
