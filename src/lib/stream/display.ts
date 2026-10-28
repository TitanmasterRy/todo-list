// What to ask the PC for: this screen's size in device pixels and its refresh rate, so Apollo's virtual display
// (SudoVDA) matches the guest screen exactly. Also the user's stream settings, saved on this device.

export const MAX_W = 4096;
export const MAX_H = 2304;

export interface Size {
  width: number;
  height: number;
}

/** The screen in device pixels, rounded to even numbers and scaled down (keeping its shape) to what H.264 allows. */
export function nativeSize(cssW: number, cssH: number, dpr: number): Size {
  let w = Math.round(cssW * (dpr || 1));
  let h = Math.round(cssH * (dpr || 1));
  const k = Math.min(1, MAX_W / w, MAX_H / h);
  w = Math.round(w * k);
  h = Math.round(h * k);
  return { width: Math.max(320, w & ~1), height: Math.max(240, h & ~1) };
}

const RATES = [24, 30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 170, 175, 180, 200, 240];

/** The nearest common refresh rate to a measured one. */
export function snapRate(hz: number): number {
  if (!Number.isFinite(hz) || hz <= 0) return 60;
  return RATES.reduce((best, r) => (Math.abs(r - hz) < Math.abs(best - hz) ? r : best), 60);
}

/** Measure the display's refresh rate from requestAnimationFrame (median frame time over `frames` frames). */
export function measureRefreshRate(raf: (cb: FrameRequestCallback) => number = requestAnimationFrame, frames = 40): Promise<number> {
  return new Promise((resolve) => {
    const times: number[] = [];
    const step = (t: number) => {
      times.push(t);
      if (times.length <= frames) raf(step);
      else {
        const gaps = times
          .slice(1)
          .map((x, i) => x - times[i])
          .sort((a, b) => a - b);
        resolve(snapRate(1000 / gaps[Math.floor(gaps.length / 2)]));
      }
    };
    raf(step);
  });
}

/** kbps for a size and rate: about 20 Mbps at 1080p60, scaled by pixels per second (the gateway's default too). */
export function suggestBitrate(width: number, height: number, fps: number): number {
  const k = Math.round(((width * height * fps) / (1920 * 1080 * 60)) * 20_000);
  return Math.min(80_000, Math.max(5_000, k));
}

export interface StreamPrefs {
  /** 'native' = this screen; otherwise the width/height below */
  size: 'native' | 'custom';
  width: number;
  height: number;
  /** 0 = this screen's refresh rate */
  fps: number;
  /** kbps, 0 = automatic */
  bitrate: number;
  transport: 'auto' | 'webrtc' | 'ws';
  stats: boolean;
}

export const PREFS_KEY = 'homework-todo:stream';
export const DEFAULT_PREFS: StreamPrefs = { size: 'native', width: 1920, height: 1080, fps: 0, bitrate: 0, transport: 'auto', stats: false };

export function parsePrefs(raw: string | null): StreamPrefs {
  let o: Partial<StreamPrefs> = {};
  try {
    o = raw ? JSON.parse(raw) : {};
  } catch {
    /* defaults */
  }
  const num = (x: unknown, lo: number, hi: number, d: number) => (typeof x === 'number' && x >= lo && x <= hi ? Math.round(x) : d);
  return {
    size: o.size === 'custom' ? 'custom' : 'native',
    width: num(o.width, 320, MAX_W, 1920) & ~1,
    height: num(o.height, 240, MAX_H, 1080) & ~1,
    fps: o.fps === 0 ? 0 : num(o.fps, 24, 240, 0),
    bitrate: o.bitrate === 0 ? 0 : num(o.bitrate, 1_000, 150_000, 0),
    transport: o.transport === 'webrtc' || o.transport === 'ws' ? o.transport : 'auto',
    stats: o.stats === true,
  };
}

/** What to ask the gateway for, from the saved settings and this screen. */
export function streamRequest(prefs: StreamPrefs, screen: Size, rate: number): { width: number; height: number; fps: number; bitrate: number } {
  const size = prefs.size === 'custom' ? { width: prefs.width, height: prefs.height } : screen;
  const fps = prefs.fps || rate || 60;
  return { ...size, fps, bitrate: prefs.bitrate || suggestBitrate(size.width, size.height, fps) };
}
