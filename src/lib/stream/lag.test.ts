import { describe, expect, it } from 'vitest';
import { LagMeter } from './lag';

function meter(threshold = 200) {
  let now = 0;
  const reports: number[] = [];
  const m = new LagMeter(
    (ms) => reports.push(ms),
    threshold,
    () => now,
  );
  /** a clock notice stamped `t` arriving at `at` (the gateway's clock runs 50 s ahead of ours here) */
  const arrive = (at: number, t: number) => {
    now = at;
    m.sample(t + 50_000);
  };
  return { m, reports, arrive };
}

describe('LagMeter', () => {
  it('reads the backlog against the quickest delivery seen, whatever the clocks say', () => {
    const { m, reports, arrive } = meter();
    // 40 ms on the way with empty buffers
    for (let t = 0; t <= 1000; t += 100) arrive(t + 40, t);
    expect(m.behind).toBe(0);
    // then notices take 150 ms: 110 ms of backlog, under the threshold
    arrive(1250, 1100);
    expect(m.behind).toBe(110);
    expect(reports).toEqual([]);
  });

  it('reports a backlog only once it has lasted, and stays quiet while the skip takes effect', () => {
    const { reports, arrive } = meter();
    arrive(40, 0);
    // a big keyframe: one notice 300 ms late, then back to normal; not a backlog
    arrive(400, 100);
    arrive(240, 200);
    expect(reports).toEqual([]);
    // a real backlog: half a second behind and growing
    arrive(840, 300);
    arrive(1000, 400);
    expect(reports).toEqual([]);
    arrive(1200, 500);
    expect(reports).toEqual([660]);
    // still reading high while the gateway pauses: no second report for the same backlog
    arrive(1500, 600);
    arrive(1900, 700);
    expect(reports).toHaveLength(1);
  });

  it('calls the network congested after three skips in fifteen seconds', () => {
    const { m, arrive } = meter();
    arrive(40, 0);
    let at = 1000;
    for (let k = 0; k < 3; k++) {
      expect(m.congested()).toBe(false);
      // 600 ms behind for long enough to report, then the pause and its quiet time pass
      arrive(at, at - 600);
      arrive(at + 400, at - 200);
      at += 2500;
    }
    expect(m.congested()).toBe(true);
    arrive(at + 20_000, at + 20_000 - 40);
    expect(m.congested()).toBe(false);
  });

  it('ignores a stamp that is not a number', () => {
    const { m } = meter();
    m.sample(Number.NaN);
    expect(m.behind).toBeNull();
  });
});
