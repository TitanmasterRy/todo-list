import { afterEach, describe, expect, it } from 'vitest';
import { framesJanky, liteEffects, noteJank, resetJank, sawJank, weakDevice } from './effects';

afterEach(resetJank);

describe('weakDevice', () => {
  it('is weak on little memory, few cores or data saver', () => {
    expect(weakDevice({ memoryGb: 2 })).toBe(true);
    expect(weakDevice({ cores: 2 })).toBe(true);
    expect(weakDevice({ saveData: true })).toBe(true);
  });
  it('is fine on a normal laptop or when nothing is reported', () => {
    expect(weakDevice({ memoryGb: 8, cores: 8 })).toBe(false);
    expect(weakDevice({})).toBe(false);
  });
});

describe('liteEffects', () => {
  it('follows an explicit setting', () => {
    expect(liteEffects('lite', { memoryGb: 16 })).toBe(true);
    expect(liteEffects('full', { memoryGb: 1 }, true)).toBe(false);
  });
  it('auto picks lite on a weak device or after jank', () => {
    expect(liteEffects('auto', { memoryGb: 8 })).toBe(false);
    expect(liteEffects(undefined, { cores: 2 })).toBe(true);
    expect(liteEffects('auto', {}, true)).toBe(true);
  });
});

describe('framesJanky', () => {
  it('needs enough frames to judge', () => {
    expect(framesJanky(Array(10).fill(50))).toBe(false);
  });
  it('flags a run where a quarter of the frames missed the budget', () => {
    const smooth = Array(40).fill(16);
    expect(framesJanky(smooth)).toBe(false);
    const rough = [...Array(30).fill(16), ...Array(10).fill(40)];
    expect(framesJanky(rough)).toBe(true);
  });
});

describe('noteJank', () => {
  it('remembers a stutter for the session', () => {
    expect(sawJank()).toBe(false);
    noteJank(false);
    expect(sawJank()).toBe(false);
    noteJank(true);
    expect(sawJank()).toBe(true);
  });
});
