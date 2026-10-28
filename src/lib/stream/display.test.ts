import { describe, expect, it } from 'vitest';
import { measureRefreshRate, nativeSize, parsePrefs, snapRate, streamRequest, suggestBitrate } from './display';

describe('display', () => {
  it('asks for the screen in device pixels, within H.264 limits', () => {
    expect(nativeSize(1440, 900, 2)).toEqual({ width: 2880, height: 1800 });
    expect(nativeSize(1366, 768, 1)).toEqual({ width: 1366, height: 768 });
    expect(nativeSize(1707, 1067, 1.5)).toEqual({ width: 2560, height: 1600 });
    expect(nativeSize(2560, 1440, 2)).toEqual({ width: 4096, height: 2304 });
    expect(nativeSize(393, 852, 2.75)).toEqual({ width: 1062, height: 2304 });
  });

  it('snaps measured refresh rates', () => {
    expect(snapRate(59.94)).toBe(60);
    expect(snapRate(143.2)).toBe(144);
    expect(snapRate(NaN)).toBe(60);
  });

  it('measures the rate from animation frames', async () => {
    let t = 0;
    const raf = (cb: FrameRequestCallback) => {
      t += 1000 / 120;
      queueMicrotask(() => cb(t));
      return 0;
    };
    expect(await measureRefreshRate(raf, 10)).toBe(120);
  });

  it('suggests bitrates like the gateway', () => {
    expect(suggestBitrate(1920, 1080, 60)).toBe(20_000);
    expect(suggestBitrate(2880, 1800, 120)).toBe(80_000);
    expect(suggestBitrate(1280, 720, 30)).toBe(5_000);
  });

  it('reads saved settings defensively', () => {
    expect(parsePrefs(null)).toMatchObject({ size: 'native', fps: 0, bitrate: 0, transport: 'auto' });
    expect(parsePrefs('{"size":"custom","width":1921,"height":99999,"fps":500,"transport":"x"}')).toMatchObject({
      size: 'custom',
      width: 1920,
      height: 1080,
      fps: 0,
      transport: 'auto',
    });
    expect(parsePrefs('nope').size).toBe('native');
  });

  it('builds the request from settings and the screen', () => {
    const prefs = parsePrefs(null);
    expect(streamRequest(prefs, { width: 2880, height: 1800 }, 120)).toEqual({ width: 2880, height: 1800, fps: 120, bitrate: 80_000 });
    expect(streamRequest({ ...prefs, size: 'custom', width: 1280, height: 720, fps: 60, bitrate: 9000 }, { width: 2880, height: 1800 }, 120)).toEqual({
      width: 1280,
      height: 720,
      fps: 60,
      bitrate: 9000,
    });
  });
});
