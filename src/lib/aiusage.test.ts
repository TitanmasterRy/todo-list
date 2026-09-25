import { describe, expect, it } from 'vitest';
import { addUsage, checkCap, estimateTokens, monthKey, monthTotal } from './aiusage';

describe('AI usage meter', () => {
  it('adds up per month and provider and keeps a year', () => {
    let u = addUsage({}, 'anthropic', { requests: 1, tokensIn: 100, tokensOut: 50 }, '2026-10');
    u = addUsage(u, 'anthropic', { requests: 1, tokensIn: 10, tokensOut: 5 }, '2026-10');
    u = addUsage(u, 'openai', { requests: 2, tokensIn: 1, tokensOut: 1 }, '2026-10');
    expect(u['2026-10'].anthropic).toEqual({ requests: 2, tokensIn: 110, tokensOut: 55 });
    expect(monthTotal(u, '2026-10')).toEqual({ requests: 4, tokensIn: 111, tokensOut: 56 });
    for (let m = 1; m <= 14; m++)
      u = addUsage(u, 'x', { requests: 1, tokensIn: 0, tokensOut: 0 }, `2027-${String(m).padStart(2, '0')}`.replace('2027-13', '2028-01').replace('2027-14', '2028-02'));
    expect(Object.keys(u)).toHaveLength(12);
  });
  it('estimates tokens and enforces the cap', () => {
    expect(estimateTokens('abcdefgh')).toBe(2);
    expect(monthKey(new Date(2026, 0, 5))).toBe('2026-01');
    const u = addUsage({}, 'openai', { requests: 5, tokensIn: 0, tokensOut: 0 });
    expect(() => checkCap(5, u)).toThrow(/limit \(5 requests\)/);
    expect(() => checkCap(6, u)).not.toThrow();
    expect(() => checkCap(0, u)).not.toThrow();
  });
});
