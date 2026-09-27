import { describe, expect, it } from 'vitest';
import { swipeDecision, swipeOffset, swipeThreshold } from './swipe';

describe('swipe', () => {
  it('needs 35% of the row, clamped to 64–120 px', () => {
    expect(swipeThreshold(100)).toBe(64);
    expect(swipeThreshold(300)).toBe(105);
    expect(swipeThreshold(1000)).toBe(120);
  });
  it('decides by direction once past the threshold', () => {
    expect(swipeDecision(110, 300)).toBe('right');
    expect(swipeDecision(-110, 300)).toBe('left');
    expect(swipeDecision(60, 300)).toBeNull();
    expect(swipeDecision(-104, 300)).toBeNull();
  });
  it('slows the row down past the threshold and caps it', () => {
    expect(swipeOffset(50, 300)).toBe(50);
    expect(swipeOffset(205, 300)).toBeCloseTo(105 + 100 * 0.35);
    expect(swipeOffset(-2000, 300)).toBe(-180);
  });
});
