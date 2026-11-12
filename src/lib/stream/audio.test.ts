import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_EXTRA_S, OpusPlayer } from './audio';

describe('OpusPlayer', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('drops packets after a burst instead of letting the sound fall behind the picture', () => {
    const starts: number[] = [];
    vi.stubGlobal(
      'AudioContext',
      class {
        currentTime = 0;
        state = 'running';
        destination = {};
        createGain() {
          return { gain: { value: 1 }, connect() {} };
        }
        createBuffer(_ch: number, frames: number, rate: number) {
          return { duration: frames / rate, copyToChannel() {} };
        }
        createBufferSource() {
          return { buffer: null, connect() {}, start: (at: number) => starts.push(at) };
        }
        close() {}
      },
    );
    const p = new OpusPlayer(60);
    // 10 ms packets: 480 frames at 48 kHz
    const packet = () => ({ numberOfChannels: 2, numberOfFrames: 480, sampleRate: 48_000, copyTo() {}, close() {} });
    const play = (p as unknown as { play: (a: ReturnType<typeof packet>) => void }).play.bind(p);
    // a stall, then a second of sound arrives at once
    for (let k = 0; k < 100; k++) play(packet());
    // the first is scheduled 60 ms ahead; no more than MAX_EXTRA_S beyond that is ever queued
    expect(starts[0]).toBeCloseTo(0.06);
    expect(Math.max(...starts)).toBeLessThanOrEqual(0.06 + MAX_EXTRA_S + 0.01);
    expect(starts.length).toBeLessThan(100);
    p.close();
  });
});
