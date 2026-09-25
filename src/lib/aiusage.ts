// AI usage meter: requests and estimated tokens per provider per month (kept on this device), with an optional
// monthly request cap. Token counts are estimates (about 4 characters per token, images count as 1,000).
export interface UsageRow {
  requests: number;
  tokensIn: number;
  tokensOut: number;
}
export type Usage = Record<string, Record<string, UsageRow>>; // 'YYYY-MM' → provider → row

export const USAGE_KEY = 'homework-todo:ai-usage';
export const IMAGE_TOKENS = 1000;

export const monthKey = (d: Date = new Date()): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

export function loadUsage(): Usage {
  try {
    const u = JSON.parse(localStorage.getItem(USAGE_KEY) ?? '{}') as Usage;
    return u && typeof u === 'object' ? u : {};
  } catch {
    return {};
  }
}

export function addUsage(u: Usage, provider: string, row: UsageRow, month = monthKey()): Usage {
  const m = { ...(u[month] ?? {}) };
  const cur = m[provider] ?? { requests: 0, tokensIn: 0, tokensOut: 0 };
  m[provider] = { requests: cur.requests + row.requests, tokensIn: cur.tokensIn + row.tokensIn, tokensOut: cur.tokensOut + row.tokensOut };
  // keep the last 12 months
  const months = Object.keys({ ...u, [month]: m })
    .sort()
    .slice(-12);
  const next: Usage = {};
  for (const k of months) next[k] = k === month ? m : u[k];
  return next;
}

export function monthTotal(u: Usage, month = monthKey()): UsageRow {
  const rows = Object.values(u[month] ?? {});
  return rows.reduce((a, r) => ({ requests: a.requests + r.requests, tokensIn: a.tokensIn + r.tokensIn, tokensOut: a.tokensOut + r.tokensOut }), {
    requests: 0,
    tokensIn: 0,
    tokensOut: 0,
  });
}

/** Record one request (call after it succeeded). */
export function recordUsage(provider: string, promptText: string, images: number, reply: string): void {
  const next = addUsage(loadUsage(), provider, { requests: 1, tokensIn: estimateTokens(promptText) + images * IMAGE_TOKENS, tokensOut: estimateTokens(reply) });
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(next));
  } catch {
    /* not recorded */
  }
}

/** Throws a friendly error when this month's request cap (0 = none) is used up. */
export function checkCap(cap: number | undefined, u: Usage = loadUsage()): void {
  if (!cap || cap <= 0) return;
  const used = monthTotal(u).requests;
  if (used >= cap) throw new Error(`You've used this month's AI limit (${cap} requests). Raise it in Settings → AI helper, or wait until next month.`);
}
