import { describe, expect, it } from 'vitest';
import { newDeck, type PlayingCard, type Suit } from './cards';
import { seeded, shuffle } from './rng';
import { compareHands, describeHand, evalHand, HAND_CATS, straightHigh, type HandCat } from './poker';
import { ANTE_BONUS, dealerQualifies, evalThree, PAIR_PLUS, shouldPlay, tcDeal, tcFinish, tcSettle, TC_CATS, type TcCat } from './threecard';
import { lirDeal, lirDecide, lirHand, lirReturned, rideFirst, rideSecond } from './letitride';
import { act, botDecide, chipsInPlay, createTable, equity, legal, sidePots, startHand, type HoldemState } from './holdem';

/** "As Kh 10d" → cards */
const h = (s: string): PlayingCard[] =>
  s.split(/\s+/).map((t) => {
    const suit = ({ s: '♠', h: '♥', d: '♦', c: '♣' } as Record<string, Suit>)[t.slice(-1)];
    const r = t.slice(0, -1);
    const rank = ({ A: 14, K: 13, Q: 12, J: 11 } as Record<string, number>)[r] ?? Number(r);
    return { rank, suit };
  });

function* combos<T>(arr: T[], k: number, start = 0, acc: T[] = []): Generator<T[]> {
  if (acc.length === k) {
    yield acc;
    return;
  }
  for (let i = start; i <= arr.length - (k - acc.length); i++) yield* combos(arr, k, i + 1, [...acc, arr[i]]);
}

describe('poker hand evaluation', () => {
  it('counts every five-card hand into the textbook frequencies', () => {
    const deck = newDeck();
    const counts: Record<string, number> = {};
    // iterative 5-loop for speed (2,598,960 hands)
    for (let a = 0; a < 52; a++)
      for (let b = a + 1; b < 52; b++)
        for (let c = b + 1; c < 52; c++)
          for (let d = c + 1; d < 52; d++)
            for (let e = d + 1; e < 52; e++) {
              const cat = evalHand([deck[a], deck[b], deck[c], deck[d], deck[e]]).cat;
              counts[cat] = (counts[cat] ?? 0) + 1;
            }
    expect(counts).toEqual({
      straightFlush: 40,
      four: 624,
      fullHouse: 3744,
      flush: 5108,
      straight: 10200,
      three: 54912,
      twoPair: 123552,
      pair: 1098240,
      high: 1302540,
    } satisfies Record<HandCat, number>);
  }, 60_000);

  it('picks the best five of seven cards', () => {
    const r = seeded(99);
    for (let i = 0; i < 3000; i++) {
      const seven = shuffle(newDeck(), r).slice(0, 7);
      const best = Math.max(...[...combos(seven, 5)].map((five) => evalHand(five).score));
      expect(evalHand(seven).score).toBe(best);
    }
  });

  it('ranks tricky hands', () => {
    expect(straightHigh((1 << 14) | (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5))).toBe(5);
    expect(evalHand(h('As 2d 3c 4h 5s')).ranks).toEqual([5]); // the wheel
    expect(compareHands(h('2s 3d 4c 5h 6s'), h('As 2d 3c 4h 5s'))).toBeGreaterThan(0);
    expect(compareHands(h('10s Jd Qc Kh As'), h('9s 10d Jc Qh Ks'))).toBeGreaterThan(0);
    expect(evalHand(h('Ks Kd Kc 2h 2s 2d 9c'))).toMatchObject({ cat: 'fullHouse', ranks: [13, 2] });
    expect(evalHand(h('Ks Kd 5c 5h 3s 3d Ac'))).toMatchObject({ cat: 'twoPair', ranks: [13, 5, 14] });
    expect(evalHand(h('Ks Kd 5c 5h 3s 3d 4c'))).toMatchObject({ cat: 'twoPair', ranks: [13, 5, 4] });
    expect(evalHand(h('2s 5s 9s Js Ks 3s 10d')).ranks).toEqual([13, 11, 9, 5, 3]);
    expect(evalHand(h('9h 10h Jh Qh Kh Ah 2c')).cat).toBe('straightFlush');
    expect(evalHand(h('9h 10h Jh Qh Kd 2h 3h'))).toMatchObject({ cat: 'flush' });
    expect(compareHands(h('As Ad 9c 8h 7s'), h('Ah Ac 9d 8s 6c'))).toBeGreaterThan(0); // kicker
    expect(compareHands(h('As Ad 9c 8h 7s'), h('Ah Ac 9d 8s 7c'))).toBe(0); // split
    expect(describeHand(evalHand(h('10s Js Qs Ks As')))).toBe('Royal flush');
    expect(describeHand(evalHand(h('Qs Qd 4c 4h 4s')))).toBe('Full house, fours over queens');
    expect(HAND_CATS).toHaveLength(9);
  });
});

describe('three card poker', () => {
  it('counts all 22,100 hands into the standard frequencies', () => {
    const counts: Record<string, number> = {};
    for (const three of combos(newDeck(), 3)) {
      const cat = evalThree(three).cat;
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    expect(counts).toEqual({ straightFlush: 48, three: 52, straight: 720, flush: 1096, pair: 3744, high: 16440 } satisfies Record<TcCat, number>);
    expect(TC_CATS.indexOf('straight')).toBeGreaterThan(TC_CATS.indexOf('flush'));
  });

  it('Pair Plus returns about 97.7% (exact, full-pay 40/30/6/4/1)', () => {
    let paid = 0;
    let n = 0;
    for (const three of combos(newDeck(), 3)) {
      const m = PAIR_PLUS[evalThree(three).cat];
      paid += m > 0 ? m + 1 : 0;
      n++;
    }
    expect(paid / n).toBeCloseTo(0.9768, 3);
  });

  it('ranks A-2-3 as the lowest straight and A-K-Q the highest', () => {
    expect(evalThree(h('As 2d 3c'))).toMatchObject({ cat: 'straight' });
    expect(evalThree(h('2s 3d 4c')).score).toBeGreaterThan(evalThree(h('As 2d 3c')).score);
    expect(evalThree(h('Qs Kd Ac')).score).toBeGreaterThan(evalThree(h('Js Qd Kc')).score);
    expect(evalThree(h('Ks Ad 2c')).cat).toBe('high'); // no wrap-around
    expect(evalThree(h('9s 9d Kc')).score).toBeGreaterThan(evalThree(h('9h 9c Qc')).score);
  });

  it('plays Q-6-4 or better and qualifies the dealer with queen high', () => {
    expect(shouldPlay(h('Qs 6d 4c'))).toBe(true);
    expect(shouldPlay(h('Qs 6d 3c'))).toBe(false);
    expect(shouldPlay(h('Qs 5d 4c'))).toBe(false);
    expect(shouldPlay(h('Ks 3d 2c'))).toBe(true);
    expect(shouldPlay(h('Js 10d 8c'))).toBe(false);
    expect(shouldPlay(h('2s 2d 3c'))).toBe(true);
    expect(dealerQualifies(evalThree(h('Qs 3d 2c')))).toBe(true);
    expect(dealerQualifies(evalThree(h('Js 10d 8c')))).toBe(false);
  });

  it('settles ante, play, bonus and pair plus', () => {
    const bets = { ante: 10, pairPlus: 5 };
    // dealer doesn't qualify: ante wins, play pushes
    expect(tcSettle(h('Ks 9d 4c'), h('Js 8d 3c'), bets, true)).toMatchObject({ outcome: 'noQualify', ante: 20, play: 10, pairPlus: 0, total: 30 });
    // straight beats the dealer's pair: ante + play win, ante bonus 1:1, pair plus 6:1
    expect(tcSettle(h('4s 5d 6c'), h('Qs Qd 3c'), bets, true)).toMatchObject({ outcome: 'win', ante: 20, play: 20, bonus: 10, pairPlus: 35, total: 85 });
    // trips lose to nothing here but the bonus and pair plus still pay when the dealer wins with a straight flush
    expect(tcSettle(h('7s 7d 7c'), h('Qh Kh Ah'), bets, true)).toMatchObject({ outcome: 'lose', ante: 0, play: 0, bonus: 40, pairPlus: 155 });
    expect(tcSettle(h('As Kd 9c'), h('Ah Kc 9d'), bets, true)).toMatchObject({ outcome: 'push', total: 20 });
    expect(tcSettle(h('9s 4d 2c'), h('Ah Kc 9d'), bets, false)).toMatchObject({ outcome: 'fold', total: 0 });
    expect(ANTE_BONUS.straightFlush).toBe(5);
    const r = tcFinish(tcDeal(bets, seeded(1)), true);
    expect(r.phase).toBe('done');
    expect(r.result!.total).toBeGreaterThanOrEqual(0);
  });

  it('Ante/Play returns about 98% of the money wagered with Q-6-4 strategy (simulated)', () => {
    const r = seeded(2024);
    let wagered = 0;
    let returned = 0;
    let anteNet = 0;
    const n = 300_000;
    for (let i = 0; i < n; i++) {
      const d = tcDeal({ ante: 1, pairPlus: 0 }, r);
      const play = shouldPlay(d.player);
      const res = tcSettle(d.player, d.dealer, d.bets, play);
      wagered += play ? 2 : 1;
      returned += res.total;
      anteNet += res.total - (play ? 2 : 1);
    }
    // house edge ≈ 3.37% of the ante, 2.0% of the total wagered
    expect(anteNet / n).toBeGreaterThan(-0.05);
    expect(anteNet / n).toBeLessThan(-0.015);
    expect(returned / wagered).toBeGreaterThan(0.96);
    expect(returned / wagered).toBeLessThan(0.995);
  }, 60_000);
});

describe('let it ride', () => {
  it('classifies paying hands', () => {
    expect(lirHand(evalHand(h('10s 10d 3c 4h 8s')))).toBe('tensOrBetter');
    expect(lirHand(evalHand(h('9s 9d 3c 4h 8s')))).toBe('nothing');
    expect(lirHand(evalHand(h('10s Js Qs Ks As')))).toBe('royal');
    expect(lirHand(evalHand(h('2s 3s 4s 5s 6s')))).toBe('straightFlush');
  });

  it('follows the basic strategy', () => {
    expect(rideFirst(h('10s 10d 3c'))).toBe(true);
    expect(rideFirst(h('9s 9d 3c'))).toBe(false);
    expect(rideFirst(h('Js Qs Ks'))).toBe(true); // three to a royal
    expect(rideFirst(h('5s 6s 7s'))).toBe(true);
    expect(rideFirst(h('2s 3s 4s'))).toBe(false);
    expect(rideFirst(h('As 2s 3s'))).toBe(false);
    expect(rideFirst(h('8s 9s Js'))).toBe(true); // one gap, a high card
    expect(rideFirst(h('5s 6s 8s'))).toBe(false); // one gap, no high card
    expect(rideFirst(h('8s 10s Qs'))).toBe(true); // two gaps, two high cards
    expect(rideFirst(h('7s 9s Js'))).toBe(false);
    expect(rideSecond(h('2s 7s 9s Ks'))).toBe(true); // four to a flush
    expect(rideSecond(h('5s 6d 7c 8h'))).toBe(true); // outside straight
    expect(rideSecond(h('10s Jd Qc Ah'))).toBe(true); // inside, four high cards
    expect(rideSecond(h('5s 6d 7c 9h'))).toBe(false);
    expect(rideSecond(h('Js Qd Kc Ah'))).toBe(true);
    expect(rideSecond(h('As 2d 3c 4h'))).toBe(false);
  });

  it('returns pulled bets and pays only what rides', () => {
    let r = lirDeal(10, seeded(5));
    r = lirDecide(r, false);
    expect(r.step).toBe(2);
    r = lirDecide(r, true);
    expect(r.step).toBe('done');
    expect(lirReturned(r)).toBe(10);
    const m = r.payout / 20;
    expect([0, 2, 3, 4, 6, 9, 12, 51, 201, 1001]).toContain(m);
  });

  it('returns about 97% of the money wagered with the basic strategy (simulated)', () => {
    const r = seeded(77);
    let wagered = 0;
    let returned = 0;
    const n = 400_000;
    for (let i = 0; i < n; i++) {
      let d = lirDeal(1, r);
      d = lirDecide(d, rideFirst(d.player));
      d = lirDecide(d, rideSecond([...d.player, d.community[0]]));
      wagered += d.riding.filter(Boolean).length;
      returned += d.payout;
    }
    expect(returned / wagered).toBeGreaterThan(0.93);
    expect(returned / wagered).toBeLessThan(0.995);
  }, 60_000);
});

describe("texas hold'em", () => {
  it('builds side pots from what each seat put in', () => {
    const seat = (total: number, folded = false) => ({ total, folded, inHand: true });
    expect(sidePots([seat(50), seat(100), seat(100)])).toEqual([
      { amount: 150, eligible: [0, 1, 2] },
      { amount: 100, eligible: [1, 2] },
    ]);
    // a folded seat pays into the pots it reached but can't win them
    expect(sidePots([seat(30, true), seat(100), seat(60)])).toEqual([
      { amount: 150, eligible: [1, 2] },
      { amount: 40, eligible: [1] },
    ]);
    expect(sidePots([seat(20), seat(20)])).toEqual([{ amount: 40, eligible: [0, 1] }]);
  });

  it('posts blinds heads-up with the dealer on the small blind, acting first before the flop', () => {
    const t = startHand(createTable({ you: { name: 'Me', emoji: '🙂', stack: 200 }, bots: 1 }), seeded(3));
    expect(t.dealer).toBe(0);
    expect(t.seats[0].bet).toBe(5);
    expect(t.seats[1].bet).toBe(10);
    expect(t.toAct).toBe(0);
    expect(legal(t)).toMatchObject({ toCall: 5, canCall: true, canRaise: true, raiseTo: 20 });
    // call, then the big blind checks: the flop comes and the big blind acts first
    let s = act(t, 'call');
    expect(s.toAct).toBe(1);
    s = act(s, 'check');
    expect(s.street).toBe('flop');
    expect(s.board).toHaveLength(3);
    expect(s.toAct).toBe(1);
    expect(legal(s).raiseTo).toBe(10);
  });

  it('caps a betting round at four bets and uses big bets on the turn', () => {
    let s = startHand(createTable({ you: { name: 'Me', emoji: '🙂', stack: 500 }, bots: 1, botStack: 500 }), seeded(8));
    s = act(s, 'raise'); // 20
    s = act(s, 'raise'); // 30
    s = act(s, 'raise'); // 40: four bets including the blind
    expect(legal(s).canRaise).toBe(false);
    s = act(s, 'raise'); // becomes a call
    expect(s.street).toBe('flop');
    s = act(s, 'check');
    s = act(s, 'check');
    expect(s.street).toBe('turn');
    expect(legal(s).raiseTo).toBe(20);
  });

  it('ends a hand when everyone else folds', () => {
    let s = startHand(createTable({ you: { name: 'Me', emoji: '🙂', stack: 200 }, bots: 2 }), seeded(4));
    const before = s.seats.reduce((a, x) => a + x.stack + x.total, 0);
    while (!s.over) s = act(s, s.toAct === 0 ? 'raise' : 'fold');
    expect(s.winners).toHaveLength(1);
    expect(s.winners[0].seat).toBe(0);
    expect(s.rake).toBe(0); // no flop, no drop
    expect(chipsInPlay(s)).toBe(before);
  });

  it('splits a pot when the board plays', () => {
    let s = startHand(createTable({ you: { name: 'Me', emoji: '🙂', stack: 200 }, bots: 1 }), seeded(1));
    s = { ...s, deck: [...h('2c 10s Js Qs 3c Ks 4c As'), ...s.deck] }; // burn, flop, burn, turn, burn, river
    s.seats = s.seats.map((x, i) => ({ ...x, hole: i === 0 ? h('2d 3d') : h('4h 5h') }));
    s = act(s, 'call');
    while (!s.over) s = act(s, 'check');
    expect(s.showdown).toBe(true);
    expect(s.winners.map((w) => w.amount).sort((a, b) => a - b)).toEqual([9, 10]); // 20 - rake 1, odd chip to the first seat after the dealer
    expect(s.winners.every((w) => w.hand === 'Royal flush')).toBe(true);
  });

  it('bots only look at their own cards', () => {
    const base = startHand(createTable({ you: { name: 'Me', emoji: '🙂', stack: 200 }, bots: 2 }), seeded(12));
    const a = { ...base, toAct: 1 } as HoldemState;
    const b = { ...a, seats: a.seats.map((x, i) => (i === 1 ? x : { ...x, hole: h('As Ah') })) };
    expect(botDecide(a, seeded(5), 100)).toEqual(botDecide(b, seeded(5), 100));
  });

  it('estimates equity sensibly', () => {
    const r = seeded(31);
    expect(equity(h('As Ah'), [], 1, r, 2000)).toBeGreaterThan(0.8);
    expect(equity(h('7c 2d'), [], 1, r, 2000)).toBeLessThan(0.4);
    expect(equity(h('As Ah'), [], 3, r, 2000)).toBeLessThan(equity(h('As Ah'), [], 1, r, 2000));
    expect(equity(h('As Ks'), h('Qs Js 10s'), 2, r, 200)).toBe(1); // a royal flush can't lose
  });

  it('plays hundreds of bot-vs-bot hands without losing a chip', () => {
    const r = seeded(2026);
    let s = createTable({ you: { name: 'Me', emoji: '🙂', stack: 2000 }, bots: 3 });
    let rake = 0;
    for (let hand = 0; hand < 300 && s.seats[0].stack > 0; hand++) {
      const rebuys = s.seats.filter((x) => x.bot !== null && x.stack < s.small).length;
      const before = chipsInPlay(s) + rebuys * s.botStack - s.seats.filter((x) => x.bot !== null && x.stack < s.small).reduce((a, x) => a + x.stack, 0);
      s = startHand(s, r);
      expect(chipsInPlay(s)).toBe(before);
      let steps = 0;
      while (!s.over) {
        s = act(s, botDecide(s, r, 40).action);
        expect(s.seats.every((x) => x.stack >= 0)).toBe(true);
        expect(++steps).toBeLessThan(80);
      }
      rake += s.rake;
      expect(chipsInPlay(s) + s.rake).toBe(before);
      expect(s.rake).toBeLessThanOrEqual(2 * s.small);
    }
    expect(rake).toBeGreaterThan(0);
  });
});
