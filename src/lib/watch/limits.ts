// Play → Watch: the optional homework rules (all off by default, set in Settings → Economy behind the parent PIN).
//  - "Watch time costs vouchers": one voucher buys N minutes of watch time (kept as a balance until used).
//  - "Finish today's ring first": nothing plays until the day's goal is done.
//  - A daily limit in minutes, counted like the casino's.
//  - A study-break reminder after N minutes in one sitting.
import { addCasinoMinutes, casinoMinutesLeft } from '../parental';

export interface WatchRules {
  /** minutes one voucher buys (0 = watching is free) */
  voucherMin: number;
  ringFirst: boolean;
  /** minutes per day (0 = no limit) */
  dailyLimitMin: number;
  /** remind after this many minutes in one sitting (0 = off) */
  breakMin: number;
}

export interface WatchUsage {
  /** minutes watched per day, two weeks kept */
  byDay: Record<string, number>;
  /** paid minutes left (voucher mode) */
  creditMin: number;
}

export type WatchGate = { ok: true; minutesLeft: number } | { ok: false; reason: 'ring' | 'limit' | 'voucher'; minutesLeft: number };

export const NO_RULES: WatchRules = { voucherMin: 0, ringFirst: false, dailyLimitMin: 0, breakMin: 0 };

/** Minutes of watching left right now (Infinity when nothing limits it). */
export function watchMinutesLeft(rules: WatchRules, usage: WatchUsage, today: string): number {
  const daily = casinoMinutesLeft(rules.dailyLimitMin, usage.byDay, today);
  const paid = rules.voucherMin > 0 ? Math.max(0, usage.creditMin) : Infinity;
  return Math.min(daily, paid);
}

/** May something play now, and if not, why. The daily limit wins over vouchers (buying more wouldn't help). */
export function watchGate(rules: WatchRules, usage: WatchUsage, today: string, ringClosed: boolean): WatchGate {
  const minutesLeft = watchMinutesLeft(rules, usage, today);
  if (rules.ringFirst && !ringClosed) return { ok: false, reason: 'ring', minutesLeft };
  if (casinoMinutesLeft(rules.dailyLimitMin, usage.byDay, today) <= 0) return { ok: false, reason: 'limit', minutesLeft };
  if (rules.voucherMin > 0 && usage.creditMin <= 0) return { ok: false, reason: 'voucher', minutesLeft };
  return { ok: true, minutesLeft };
}

/** Does anything need counting while watching? (Otherwise nothing is written every minute.) */
export function countsTime(rules: WatchRules): boolean {
  return rules.voucherMin > 0 || rules.dailyLimitMin > 0;
}

/** One more minute watched: add it to today and take it off the paid balance. */
export function tickWatch(rules: WatchRules, usage: WatchUsage, today: string, minutes = 1): WatchUsage {
  return {
    byDay: rules.dailyLimitMin > 0 ? addCasinoMinutes(usage.byDay, today, minutes) : usage.byDay,
    creditMin: rules.voucherMin > 0 ? Math.max(0, usage.creditMin - minutes) : usage.creditMin,
  };
}

/** A voucher was spent: add its minutes to the balance. */
export function buyWatchTime(rules: WatchRules, usage: WatchUsage, vouchers = 1): WatchUsage {
  return { ...usage, creditMin: Math.max(0, usage.creditMin) + Math.max(0, rules.voucherMin) * vouchers };
}

/** Time for the study-break reminder? (Once per sitting.) */
export function breakDue(rules: WatchRules, watchedMs: number, reminded: boolean): boolean {
  return rules.breakMin > 0 && !reminded && watchedMs >= rules.breakMin * 60_000;
}

/** Short lines describing the rules in force, for the Watch tab. */
export function describeRules(rules: WatchRules, usage: WatchUsage, today: string): string[] {
  const out: string[] = [];
  if (rules.ringFirst) out.push("Finish today's ring first");
  if (rules.voucherMin > 0) out.push(`1 🎟️ = ${rules.voucherMin} min (${Math.max(0, usage.creditMin)} min paid for)`);
  if (rules.dailyLimitMin > 0) out.push(`${casinoMinutesLeft(rules.dailyLimitMin, usage.byDay, today)} of ${rules.dailyLimitMin} min left today`);
  if (rules.breakMin > 0) out.push(`Study-break reminder after ${rules.breakMin} min`);
  return out;
}
