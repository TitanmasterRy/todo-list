// Texas Hold'em against 1–3 bots, fixed-limit. Blinds are half a small bet and one small bet; bets and raises are one
// small bet before the flop and on the flop, one big bet (2×) on the turn and river, capped at four bets a round.
// Fixed-limit keeps a hand's swing small and the bots' choices simple (fold, call or raise, no sizing). The table takes a
// 5% rake from pots that reach the flop (max one big bet), like a real card room. Pure: every function returns a new state.
import { newDeck, shuffledDeck, type PlayingCard } from './cards';
import { describeHand, evalHand } from './poker';
import { type Rng, cryptoRng, randInt } from './rng';

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface BotStyle {
  name: string;
  emoji: string;
  /** × pot odds needed to call: above 1 is tight, below 1 loose */
  tight: number;
  /** equity relative to a fair share (1 = average) needed to bet or raise */
  aggr: number;
  /** chance to bet or float without the hand for it */
  bluff: number;
  blurb: string;
}

export const BOTS: BotStyle[] = [
  { name: 'Tess', emoji: '🦉', tight: 1.2, aggr: 1.45, bluff: 0.03, blurb: 'tight, bets her good hands' },
  { name: 'Lou', emoji: '🦊', tight: 0.8, aggr: 1.8, bluff: 0.12, blurb: 'loose, loves a bluff' },
  { name: 'Sam', emoji: '🐻', tight: 1.0, aggr: 1.6, bluff: 0.05, blurb: 'steady, plays the odds' },
];

export interface Seat {
  name: string;
  emoji: string;
  bot: number | null; // index into BOTS, null for you
  stack: number;
  hole: PlayingCard[];
  bet: number; // put in on this street
  total: number; // put in this hand
  inHand: boolean;
  folded: boolean;
  allIn: boolean;
  acted: boolean;
}

export interface Winner {
  seat: number;
  amount: number;
  hand?: string;
}

export interface HoldemState {
  seats: Seat[];
  deck: PlayingCard[];
  board: PlayingCard[];
  street: Street;
  dealer: number;
  toAct: number; // -1 once the hand is over
  currentBet: number;
  raises: number; // bets this round (the big blind counts as one)
  small: number; // the small bet; the big bet is twice this
  botStack: number; // bots that bust rebuy for this
  handNo: number;
  over: boolean;
  showdown: boolean; // cards were shown
  winners: Winner[];
  rake: number;
  log: string[];
}

export const RAKE = 0.05;
export const CAP = 4;

export interface TableOptions {
  you: { name: string; emoji: string; stack: number };
  bots: number; // 1–3
  small?: number;
  botStack?: number;
}

export function createTable(o: TableOptions): HoldemState {
  const small = o.small ?? 10;
  const botStack = o.botStack ?? 20 * small;
  const n = Math.max(1, Math.min(3, Math.floor(o.bots)));
  const seat = (name: string, emoji: string, bot: number | null, stack: number): Seat => ({
    name,
    emoji,
    bot,
    stack,
    hole: [],
    bet: 0,
    total: 0,
    inHand: false,
    folded: false,
    allIn: false,
    acted: false,
  });
  const seats = [seat(o.you.name, o.you.emoji, null, o.you.stack), ...BOTS.slice(0, n).map((b, i) => seat(b.name, b.emoji, i, botStack))];
  return {
    seats,
    deck: [],
    board: [],
    street: 'preflop',
    dealer: seats.length - 1, // the first hand deals from you
    toAct: -1,
    currentBet: 0,
    raises: 0,
    small,
    botStack,
    handNo: 0,
    over: true,
    showdown: false,
    winners: [],
    rake: 0,
    log: [],
  };
}

function clone(s: HoldemState): HoldemState {
  return { ...s, seats: s.seats.map((x) => ({ ...x, hole: [...x.hole] })), deck: [...s.deck], board: [...s.board], winners: [...s.winners], log: [...s.log] };
}

const canAct = (x: Seat) => x.inHand && !x.folded && !x.allIn;
const live = (x: Seat) => x.inHand && !x.folded;

function nextSeat(s: HoldemState, from: number, ok: (x: Seat) => boolean): number {
  for (let i = 1; i <= s.seats.length; i++) {
    const j = (from + i) % s.seats.length;
    if (ok(s.seats[j])) return j;
  }
  return -1;
}

export function pot(s: HoldemState): number {
  return s.seats.reduce((a, x) => a + x.total, 0);
}

/** The bet size for the current street. */
export function betSize(s: HoldemState): number {
  return s.street === 'turn' || s.street === 'river' ? s.small * 2 : s.small;
}

function put(seat: Seat, amount: number): number {
  const n = Math.max(0, Math.min(seat.stack, amount));
  seat.stack -= n;
  seat.bet += n;
  seat.total += n;
  if (seat.stack === 0) seat.allIn = true;
  return n;
}

/** Deal a new hand. Bots that are out of chips rebuy; you need chips to be dealt in. */
export function startHand(prev: HoldemState, rng: Rng = cryptoRng): HoldemState {
  const s = clone(prev);
  s.log = [];
  for (const x of s.seats) {
    if (x.bot !== null && x.stack < s.small) {
      x.stack = s.botStack;
      s.log.push(`${x.name} buys back in for ${s.botStack}.`);
    }
    Object.assign(x, { hole: [], bet: 0, total: 0, inHand: x.stack > 0, folded: false, allIn: false, acted: false });
  }
  if (s.seats.filter((x) => x.inHand).length < 2 || !s.seats[0].inHand) return prev;
  s.handNo++;
  s.deck = shuffledDeck(1, rng);
  s.board = [];
  s.street = 'preflop';
  s.over = false;
  s.showdown = false;
  s.winners = [];
  s.rake = 0;
  s.dealer = nextSeat(s, s.dealer, (x) => x.inHand);
  const headsUp = s.seats.filter((x) => x.inHand).length === 2;
  const sb = headsUp ? s.dealer : nextSeat(s, s.dealer, (x) => x.inHand);
  const bb = nextSeat(s, sb, (x) => x.inHand);
  put(s.seats[sb], Math.floor(s.small / 2));
  put(s.seats[bb], s.small);
  s.log.push(`${s.seats[sb].name} posts ${Math.floor(s.small / 2)}, ${s.seats[bb].name} posts ${s.small}.`);
  for (let round = 0; round < 2; round++) {
    let i = sb;
    for (let k = 0; k < s.seats.length; k++) {
      if (s.seats[i].inHand) s.seats[i].hole.push(s.deck.shift()!);
      i = (i + 1) % s.seats.length;
    }
  }
  s.currentBet = s.small;
  s.raises = 1;
  s.toAct = nextSeat(s, bb, canAct);
  if (s.toAct < 0 || roundDone(s)) return advance(s);
  return s;
}

export interface Legal {
  toCall: number;
  canCheck: boolean;
  canCall: boolean;
  canRaise: boolean;
  raiseTo: number; // total bet on this street after a bet or raise
}

export function legal(s: HoldemState): Legal {
  const x = s.seats[s.toAct];
  if (!x || s.over) return { toCall: 0, canCheck: false, canCall: false, canRaise: false, raiseTo: 0 };
  const toCall = Math.max(0, s.currentBet - x.bet);
  const others = s.seats.some((o, i) => i !== s.toAct && canAct(o));
  return {
    toCall: Math.min(toCall, x.stack),
    canCheck: toCall === 0,
    canCall: toCall > 0,
    canRaise: s.raises < CAP && x.stack > toCall && others,
    raiseTo: s.currentBet + betSize(s),
  };
}

export type Action = 'fold' | 'check' | 'call' | 'raise';

function roundDone(s: HoldemState): boolean {
  return s.seats.every((x) => !canAct(x) || (x.acted && x.bet === s.currentBet));
}

/** Apply your or a bot's action for the seat whose turn it is. Illegal actions become the nearest legal one. */
export function act(prev: HoldemState, action: Action): HoldemState {
  if (prev.over || prev.toAct < 0) return prev;
  const s = clone(prev);
  const x = s.seats[s.toAct];
  const l = legal(prev);
  if (action === 'raise' && !l.canRaise) action = l.canCall ? 'call' : 'check';
  if (action === 'call' && !l.canCall) action = 'check';
  if (action === 'check' && !l.canCheck) action = 'fold';
  x.acted = true;
  if (action === 'fold') {
    x.folded = true;
    s.log.push(`${x.name} folds.`);
  } else if (action === 'check') s.log.push(`${x.name} checks.`);
  else if (action === 'call') {
    const n = put(x, s.currentBet - x.bet);
    s.log.push(`${x.name} calls ${n}${x.allIn ? ' (all in)' : ''}.`);
  } else {
    const was = s.currentBet;
    put(x, l.raiseTo - x.bet);
    if (x.bet > s.currentBet) {
      s.currentBet = x.bet;
      s.raises++;
      for (const o of s.seats) if (o !== x && canAct(o)) o.acted = false;
    }
    s.log.push(`${x.name} ${was === 0 ? 'bets' : 'raises to'} ${x.bet}${x.allIn ? ' (all in)' : ''}.`);
  }
  if (s.seats.filter(live).length === 1) return finishUncontested(s);
  if (roundDone(s)) return advance(s);
  s.toAct = nextSeat(s, s.toAct, canAct);
  return s;
}

/** Deal the next street (or run the board out when nobody can bet), ending in a showdown after the river. */
function advance(s: HoldemState): HoldemState {
  for (;;) {
    for (const x of s.seats) {
      x.bet = 0;
      x.acted = false;
    }
    s.currentBet = 0;
    s.raises = 0;
    if (s.street === 'river') return finishShowdown(s);
    s.deck.shift(); // burn
    if (s.street === 'preflop') {
      s.board.push(...s.deck.splice(0, 3));
      s.street = 'flop';
    } else {
      s.board.push(s.deck.shift()!);
      s.street = s.street === 'flop' ? 'turn' : 'river';
    }
    if (s.seats.filter(canAct).length >= 2) {
      s.toAct = nextSeat(s, s.dealer, canAct);
      return s;
    }
  }
}

function takeRake(s: HoldemState, total: number): number {
  if (s.board.length < 3) return 0; // no flop, no drop
  return Math.min(Math.floor(total * RAKE), s.small * 2);
}

function finishUncontested(s: HoldemState): HoldemState {
  const total = pot(s);
  const i = s.seats.findIndex(live);
  s.rake = takeRake(s, total);
  const amount = total - s.rake;
  s.seats[i].stack += amount;
  s.winners = [{ seat: i, amount }];
  s.log.push(`${s.seats[i].name} wins ${amount}.`);
  return end(s);
}

function end(s: HoldemState): HoldemState {
  for (const x of s.seats) {
    x.bet = 0;
    x.acted = false;
  }
  s.over = true;
  s.toAct = -1;
  s.street = s.showdown ? 'showdown' : s.street;
  return s;
}

export interface SidePot {
  amount: number;
  eligible: number[];
}

/** Main pot and side pots from what each seat put in (folded seats pay in but can't win). */
export function sidePots(seats: Pick<Seat, 'total' | 'folded' | 'inHand'>[]): SidePot[] {
  const levels = [...new Set(seats.map((x) => x.total).filter((t) => t > 0))].sort((a, b) => a - b);
  const pots: SidePot[] = [];
  let prev = 0;
  for (const level of levels) {
    const amount = seats.reduce((a, x) => a + Math.max(0, Math.min(x.total, level) - prev), 0);
    const eligible = seats.flatMap((x, i) => (x.inHand && !x.folded && x.total >= level ? [i] : []));
    const last = pots[pots.length - 1];
    if (last && (eligible.length === 0 || last.eligible.join() === eligible.join())) last.amount += amount;
    else pots.push({ amount, eligible });
    prev = level;
  }
  return pots;
}

function finishShowdown(s: HoldemState): HoldemState {
  s.showdown = true;
  const values = s.seats.map((x) => (live(x) ? evalHand([...x.hole, ...s.board]) : null));
  const pots = sidePots(s.seats);
  const total = pot(s);
  s.rake = takeRake(s, total);
  if (pots.length) pots[0].amount -= s.rake;
  const won = new Map<number, number>();
  for (const p of pots) {
    if (!p.eligible.length) p.eligible = s.seats.flatMap((x, i) => (live(x) ? [i] : []));
    const best = Math.max(...p.eligible.map((i) => values[i]!.score));
    // odd chips go to the first winner after the dealer
    const order = p.eligible
      .filter((i) => values[i]!.score === best)
      .sort((a, b) => ((a - s.dealer + s.seats.length - 1) % s.seats.length) - ((b - s.dealer + s.seats.length - 1) % s.seats.length));
    const share = Math.floor(p.amount / order.length);
    order.forEach((i, k) => won.set(i, (won.get(i) ?? 0) + share + (k === 0 ? p.amount - share * order.length : 0)));
  }
  s.winners = [...won.entries()].map(([seat, amount]) => ({ seat, amount, hand: describeHand(values[seat]!) }));
  for (const w of s.winners) {
    s.seats[w.seat].stack += w.amount;
    s.log.push(`${s.seats[w.seat].name} wins ${w.amount} with ${w.hand!.toLowerCase()}.`);
  }
  return end(s);
}

// ---------- bots ----------

/** Monte Carlo chance to win (ties count as a share) against `opponents` random hands. Uses only what the seat can see. */
export function equity(hole: PlayingCard[], board: PlayingCard[], opponents: number, rng: Rng = cryptoRng, iters = 200): number {
  const seen = new Set([...hole, ...board].map((c) => `${c.rank}${c.suit}`));
  const deck = newDeck().filter((c) => !seen.has(`${c.rank}${c.suit}`));
  const need = 5 - board.length + opponents * 2;
  let wins = 0;
  for (let it = 0; it < iters; it++) {
    // partial Fisher–Yates: the first `need` cards become a random draw
    for (let i = 0; i < need; i++) {
      const j = i + randInt(deck.length - i, rng);
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const fullBoard = [...board, ...deck.slice(0, 5 - board.length)];
    const mine = evalHand([...hole, ...fullBoard]).score;
    let best = 0;
    let ties = 0;
    let beaten = false;
    for (let o = 0; o < opponents; o++) {
      const off = 5 - board.length + o * 2;
      const v = evalHand([deck[off], deck[off + 1], ...fullBoard]).score;
      if (v > mine) {
        beaten = true;
        break;
      }
      if (v === mine) ties++;
      best = Math.max(best, v);
    }
    if (!beaten) wins += 1 / (ties + 1);
  }
  return wins / iters;
}

export interface BotChoice {
  action: Action;
  equity: number;
  potOdds: number;
}

/**
 * A simple, sensible bot: estimate equity against the players still in, compare it with the pot odds for a call,
 * and bet or raise when it's well above a fair share. Each bot's style moves those thresholds a little, and it
 * sometimes bluffs. It never looks at anyone else's cards.
 */
export function botDecide(s: HoldemState, rng: Rng = cryptoRng, iters = 200): BotChoice {
  const x = s.seats[s.toAct];
  const style = BOTS[x.bot ?? 2];
  const l = legal(s);
  const opponents = s.seats.filter((o, i) => i !== s.toAct && live(o)).length;
  const e = equity(x.hole, s.board, opponents, rng, iters);
  const potNow = pot(s);
  const potOdds = l.toCall > 0 ? l.toCall / (potNow + l.toCall) : 0;
  const rel = e * (opponents + 1);
  const late = s.street === 'turn' || s.street === 'river';
  let action: Action;
  if (l.canCheck) {
    if (l.canRaise && (rel >= style.aggr || (s.street !== 'preflop' && rng() < style.bluff))) action = 'raise';
    else action = 'check';
  } else if (l.canRaise && rel >= style.aggr + 0.4 && s.raises < CAP) action = 'raise';
  else if (e >= potOdds * style.tight) action = 'call';
  else if (!late && rng() < style.bluff / 2) action = 'call';
  else action = 'fold';
  return { action, equity: e, potOdds };
}

/** Every chip at the table: stacks plus the pot while a hand is running. Only the rake (and bot rebuys) change it. */
export function chipsInPlay(s: HoldemState): number {
  return s.seats.reduce((a, x) => a + x.stack + (s.over ? 0 : x.total), 0);
}
