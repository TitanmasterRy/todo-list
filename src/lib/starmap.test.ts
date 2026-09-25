import { describe, expect, it } from 'vitest';
import { addDaysKey } from './dates';
import { dayLabel, layoutStars, periodFor, shiftPeriod, starRadius, starSummary } from './starmap';

describe('periods', () => {
  it('a calendar year or a half year', () => {
    expect(periodFor('year', '2026-09-25')).toEqual({ kind: 'year', start: '2026-01-01', end: '2026-12-31', label: '2026' });
    expect(periodFor('semester', '2026-09-25')).toEqual({ kind: 'semester', start: '2026-07-01', end: '2026-12-31', label: 'Jul – Dec 2026' });
    expect(periodFor('semester', '2026-06-30')).toMatchObject({ start: '2026-01-01', end: '2026-06-30', label: 'Jan – Jun 2026' });
  });
  it('steps back and forward', () => {
    const s = periodFor('semester', '2026-02-10');
    expect(shiftPeriod(s, -1).label).toBe('Jul – Dec 2025');
    expect(shiftPeriod(s, 1).label).toBe('Jul – Dec 2026');
    expect(shiftPeriod(periodFor('year', '2026-02-10'), -1).label).toBe('2025');
  });
});

describe('layout', () => {
  const data = { '2026-03-01': 2, '2026-03-02': 1, '2026-03-03': 5, '2026-03-05': 1, '2026-03-31': 1, '2026-04-01': 3, '2025-12-31': 9 };
  const year = layoutStars(periodFor('year', '2026-06-01'), data, '2026-06-01');

  it('has one star per day, in order, lit when something was done', () => {
    expect(year.stars).toHaveLength(365);
    expect(year.stars[0].key).toBe('2026-01-01');
    expect(year.stars.at(-1)!.key).toBe('2026-12-31');
    year.stars.forEach((s, i) => i && expect(s.key).toBe(addDaysKey(year.stars[i - 1].key, 1)));
    expect(year.stars.filter((s) => s.lit).map((s) => s.key)).toEqual(['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-05', '2026-03-31', '2026-04-01']);
    expect(layoutStars(periodFor('year', '2028-01-01'), {}, '2028-01-01').stars).toHaveLength(366);
    expect(layoutStars(periodFor('semester', '2026-01-01'), {}, '2026-01-01').stars).toHaveLength(181);
  });
  it('joins only lit days in a row, across month lines too', () => {
    const keys = year.links.map(([a, b]) => `${year.stars[a].key}>${year.stars[b].key}`);
    expect(keys).toEqual(['2026-03-01>2026-03-02', '2026-03-02>2026-03-03', '2026-03-31>2026-04-01']);
  });
  it('keeps every star inside its month patch and on the map', () => {
    for (const s of year.stars) {
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(year.width);
      expect(s.y).toBeGreaterThan(0);
      expect(s.y).toBeLessThan(year.height);
    }
    expect(year.width).toBe(4 * 220);
    expect(year.height).toBe(3 * 170);
    expect(year.months.map((m) => m.label)).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m) => `${m} 2026`));
    expect(year.months[2]).toMatchObject({ days: 31, lit: 5, tasks: 10 });
  });
  it('snakes, so a month ends next to where the next one starts', () => {
    const at = (k: string) => year.stars.find((s) => s.key === k)!;
    const gap = (a: string, b: string) => Math.hypot(at(a).x - at(b).x, at(a).y - at(b).y);
    for (const [a, b] of [
      ['2026-01-31', '2026-02-01'],
      ['2026-04-30', '2026-05-01'],
      ['2026-08-31', '2026-09-01'],
    ])
      expect(gap(a, b)).toBeLessThan(200);
  });
  it('is the same sky every time, marks the future, sizes stars by count', () => {
    expect(layoutStars(periodFor('year', '2026-06-01'), data, '2026-06-01')).toEqual(year);
    expect(year.stars.find((s) => s.key === '2026-06-01')!.future).toBe(false);
    expect(year.stars.find((s) => s.key === '2026-06-02')!.future).toBe(true);
    expect(starRadius(0)).toBeLessThan(starRadius(1));
    expect(starRadius(1)).toBeLessThan(starRadius(5));
    expect(starRadius(500)).toBe(starRadius(1000)); // capped
  });
  it('sums up lit days, tasks and the longest run', () => {
    expect(starSummary(year)).toEqual({ lit: 6, tasks: 13, pastDays: 152, longest: 3, longestEnd: '2026-03-03' });
    expect(starSummary(layoutStars(periodFor('semester', '2026-06-01'), {}, '2026-06-01'))).toMatchObject({ lit: 0, longest: 0 });
  });
  it('labels days', () => {
    expect(dayLabel('2026-09-14')).toBe('Mon, Sep 14, 2026');
  });
});
