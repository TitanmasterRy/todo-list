import { randInt, type Rng, cryptoRng } from './rng';

export function rollDice(rng: Rng = cryptoRng): [number, number] {
  return [randInt(6, rng) + 1, randInt(6, rng) + 1];
}

export interface CrapsState {
  point: number | null; // null = come-out roll
  passBet: number;
  dontPassBet: number;
  last?: [number, number];
  message: string;
}

export interface CrapsRoll {
  state: CrapsState;
  returned: number; // chips returned to the player this roll (stake + win)
  resolved: boolean; // line bets settled this roll
}

/** Apply a roll to the pass / don't pass bets. Don't pass bars 12 on the come-out. */
export function crapsRoll(s: CrapsState, dice: [number, number]): CrapsRoll {
  const sum = dice[0] + dice[1];
  const pass = s.passBet;
  const dont = s.dontPassBet;
  if (s.point === null) {
    if (sum === 7 || sum === 11) return done(s, dice, pass * 2, `${sum}: natural! Pass wins.`);
    if (sum === 2 || sum === 3) return done(s, dice, dont * 2, `${sum}: craps. Don't pass wins.`);
    if (sum === 12) return done(s, dice, dont, `12: craps. Pass loses, don't pass pushes.`);
    return { state: { ...s, point: sum, last: dice, message: `Point is ${sum}. Roll it again before a 7.` }, returned: 0, resolved: false };
  }
  if (sum === s.point) return done(s, dice, pass * 2, `${sum}: point made! Pass wins.`);
  if (sum === 7) return done(s, dice, dont * 2, `Seven out. Don't pass wins.`);
  return { state: { ...s, last: dice, message: `${sum}. Point is still ${s.point}.` }, returned: 0, resolved: false };
}

function done(s: CrapsState, dice: [number, number], returned: number, message: string): CrapsRoll {
  return { state: { point: null, passBet: 0, dontPassBet: 0, last: dice, message }, returned, resolved: true };
}

/** One-roll field bet: 3, 4, 9, 10, 11 pay 1:1; 2 pays 2:1; 12 pays 3:1. Returns total returned. */
export function fieldPayout(sum: number, amount: number): number {
  if (sum === 2) return amount * 3;
  if (sum === 12) return amount * 4;
  if ([3, 4, 9, 10, 11].includes(sum)) return amount * 2;
  return 0;
}
