import { beforeEach, describe, expect, it, vi } from 'vitest';
import { soundContext } from '../../../lib/sounds';
import { play, type FactorySound } from './sfx';

vi.mock('../../../lib/sounds', () => ({ soundContext: vi.fn(() => null) }));

const SOUNDS: FactorySound[] = ['build', 'belt', 'dismantle', 'error', 'milestone', 'phase', 'launch', 'badge', 'alarm', 'coin', 'click'];

/** Just enough of an AudioContext to record what a sound schedules. */
function fakeContext() {
  const calls = { oscillators: 0, gains: 0, started: 0, noise: 0 };
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() });
  const node = () => {
    const n = { connect: vi.fn(() => n), start: vi.fn(() => calls.started++), stop: vi.fn(), type: '', buffer: null, frequency: param(), gain: param(), Q: param() };
    return n;
  };
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    createOscillator: vi.fn(() => (calls.oscillators++, node())),
    createGain: vi.fn(() => (calls.gains++, node())),
    createBufferSource: vi.fn(() => (calls.noise++, node())),
    createBiquadFilter: vi.fn(node),
    createBuffer: vi.fn((_ch: number, len: number, rate: number) => ({ sampleRate: rate, getChannelData: () => new Float32Array(len) })),
  };
  return { ctx: ctx as unknown as AudioContext, calls };
}

beforeEach(() => {
  vi.mocked(soundContext).mockReturnValue(null);
  // each sound rate-limits itself, so step the clock past every gap between plays
  vi.useFakeTimers({ toFake: ['performance'] });
  vi.advanceTimersByTime(5000);
});

describe('play', () => {
  it('is a no-op while sounds are off', () => {
    for (const name of SOUNDS) expect(() => play(name)).not.toThrow();
    expect(soundContext).toHaveBeenCalled();
  });

  it('schedules at least one oscillator for every sound', () => {
    for (const name of SOUNDS) {
      const { ctx, calls } = fakeContext();
      vi.mocked(soundContext).mockReturnValue(ctx);
      vi.advanceTimersByTime(1000);
      play(name);
      expect(calls.oscillators, name).toBeGreaterThanOrEqual(1);
      expect(calls.gains, name).toBeGreaterThanOrEqual(1);
      expect(calls.started, name).toBeGreaterThanOrEqual(1);
    }
  });

  it('gives the launch and the milestone their own shapes', () => {
    const a = fakeContext();
    vi.mocked(soundContext).mockReturnValue(a.ctx);
    play('milestone');
    expect(a.calls.oscillators).toBe(3); // the three-note arpeggio
    const b = fakeContext();
    vi.mocked(soundContext).mockReturnValue(b.ctx);
    play('launch');
    expect(b.calls.oscillators).toBeGreaterThan(3);
    expect(b.calls.noise).toBeGreaterThan(0);
  });

  it('swallows a broken context instead of throwing', () => {
    vi.mocked(soundContext).mockReturnValue({ currentTime: 0 } as unknown as AudioContext);
    expect(() => play('build')).not.toThrow();
  });
});
