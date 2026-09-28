// Casino sound effects: tiny WebAudio synths (no files). Silent unless the app's sounds are on (Settings).
import { soundContext } from '../../lib/sounds';

export type Sfx =
  'chip' | 'chips' | 'deal' | 'flip' | 'reel' | 'spin' | 'tick' | 'peg' | 'win' | 'bigwin' | 'lose' | 'dice' | 'ball' | 'gem' | 'boom' | 'scratch' | 'pop' | 'tease' | 'click';

interface Tone {
  f: number;
  at?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  to?: number;
}

function tones(c: AudioContext, list: Tone[], master = 0.18): void {
  const t0 = c.currentTime + 0.005;
  const out = c.createGain();
  out.gain.value = master;
  out.connect(c.destination);
  for (const n of list) {
    const at = t0 + (n.at ?? 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = n.type ?? 'sine';
    o.frequency.setValueAtTime(n.f, at);
    if (n.to) o.frequency.exponentialRampToValueAtTime(n.to, at + n.dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(n.gain ?? 0.6, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + n.dur);
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + n.dur + 0.03);
  }
}

let noiseBuf: AudioBuffer | null = null;
function hiss(c: AudioContext, dur: number, o: { gain?: number; type?: BiquadFilterType; freq?: number; q?: number; at?: number } = {}): void {
  if (!noiseBuf || noiseBuf.sampleRate !== c.sampleRate) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const at = c.currentTime + 0.005 + (o.at ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = o.type ?? 'highpass';
  f.frequency.value = o.freq ?? 2000;
  f.Q.value = o.q ?? 0.8;
  const g = c.createGain();
  g.gain.setValueAtTime(o.gain ?? 0.2, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(at, Math.random() * 0.5);
  src.stop(at + dur + 0.02);
}

const last: Partial<Record<Sfx, number>> = {};
/** Minimum gap between repeats (ms), so fast ticks don't pile up. */
const GAP: Partial<Record<Sfx, number>> = { tick: 28, peg: 22, scratch: 60, chip: 40, dice: 60 };

const SFX: Record<Sfx, (c: AudioContext, v: number) => void> = {
  chip: (c) => {
    hiss(c, 0.035, { gain: 0.16, freq: 3500 });
    tones(c, [
      { f: 2400 + Math.random() * 300, dur: 0.04, type: 'triangle', gain: 0.35 },
      { f: 3300, at: 0.018, dur: 0.035, type: 'triangle', gain: 0.25 },
    ]);
  },
  chips: (c) => {
    for (let i = 0; i < 5; i++) {
      hiss(c, 0.03, { gain: 0.12, freq: 3200, at: i * 0.045 + Math.random() * 0.02 });
      tones(c, [{ f: 2200 + Math.random() * 900, at: i * 0.045, dur: 0.035, type: 'triangle', gain: 0.25 }], 0.14);
    }
  },
  deal: (c) => hiss(c, 0.09, { gain: 0.22, type: 'bandpass', freq: 3800, q: 0.6 }),
  flip: (c) => {
    hiss(c, 0.05, { gain: 0.2, type: 'bandpass', freq: 2600, q: 1 });
    tones(c, [{ f: 900, at: 0.03, dur: 0.03, type: 'triangle', gain: 0.25 }], 0.12);
  },
  reel: (c, v) => {
    tones(c, [{ f: 150 + v * 20, dur: 0.12, to: 70, type: 'sine', gain: 0.9 }], 0.22);
    hiss(c, 0.05, { gain: 0.12, type: 'lowpass', freq: 1400 });
  },
  spin: (c) => {
    hiss(c, 0.45, { gain: 0.08, type: 'bandpass', freq: 900, q: 0.5 });
    tones(c, [{ f: 220, dur: 0.35, to: 660, type: 'triangle', gain: 0.25 }], 0.12);
  },
  tick: (c, v) => tones(c, [{ f: 1700 + v * 60, dur: 0.025, type: 'square', gain: 0.3 }], 0.06),
  peg: (c, v) => tones(c, [{ f: 900 + v * 90, dur: 0.05, type: 'triangle', gain: 0.4 }], 0.08),
  win: (c) =>
    tones(
      c,
      [523, 659, 784, 1047].map((f, i) => ({ f, at: i * 0.07, dur: 0.28, type: 'triangle' as OscillatorType, gain: 0.5 })),
      0.16,
    ),
  bigwin: (c) => {
    tones(
      c,
      [
        ...[392, 523, 659, 784, 1047, 1319].map((f, i) => ({ f, at: i * 0.08, dur: 0.3, type: 'square' as OscillatorType, gain: 0.22 })),
        { f: 1047, at: 0.5, dur: 0.9, type: 'triangle', gain: 0.5 },
        { f: 1319, at: 0.5, dur: 0.9, type: 'triangle', gain: 0.4 },
        { f: 1568, at: 0.5, dur: 0.9, type: 'triangle', gain: 0.35 },
      ],
      0.14,
    );
    for (let i = 0; i < 8; i++) hiss(c, 0.04, { gain: 0.1, freq: 4000, at: 0.5 + i * 0.07 });
  },
  lose: (c) =>
    tones(
      c,
      [
        { f: 392, dur: 0.14, gain: 0.35 },
        { f: 311, at: 0.1, dur: 0.22, gain: 0.3 },
      ],
      0.1,
    ),
  dice: (c) => {
    for (let i = 0; i < 6; i++) {
      const at = i * 0.05 + Math.random() * 0.03;
      hiss(c, 0.025, { gain: 0.25, type: 'bandpass', freq: 1800 + Math.random() * 1500, q: 2, at });
    }
  },
  ball: (c) => {
    hiss(c, 0.03, { gain: 0.2, type: 'bandpass', freq: 5000, q: 3 });
    tones(c, [{ f: 3000 + Math.random() * 800, dur: 0.03, type: 'triangle', gain: 0.3 }], 0.1);
  },
  gem: (c, v) =>
    tones(
      c,
      [
        { f: 1320 * (1 + v * 0.06), dur: 0.2, type: 'sine', gain: 0.5 },
        { f: 1980 * (1 + v * 0.06), at: 0.05, dur: 0.3, type: 'sine', gain: 0.35 },
      ],
      0.14,
    ),
  boom: (c) => {
    hiss(c, 0.7, { gain: 0.5, type: 'lowpass', freq: 700, q: 0.3 });
    tones(c, [{ f: 140, dur: 0.6, to: 35, type: 'sine', gain: 1 }], 0.3);
  },
  scratch: (c) => hiss(c, 0.06, { gain: 0.08, type: 'bandpass', freq: 2400 + Math.random() * 1200, q: 1.5 }),
  pop: (c, v) => tones(c, [{ f: 500 + v * 40, dur: 0.1, to: 900 + v * 60, type: 'sine', gain: 0.5 }], 0.14),
  tease: (c, v) => tones(c, [{ f: 500 + v * 70, dur: 0.08, type: 'triangle', gain: 0.4 }], 0.1),
  click: (c) => tones(c, [{ f: 1200, dur: 0.02, type: 'square', gain: 0.25 }], 0.06),
};

/** Play a casino effect. `v` varies the pitch (reel index, peg row, streak …). */
export function sfx(name: Sfx, v = 0): void {
  const c = soundContext();
  if (!c) return;
  const now = performance.now();
  if (now - (last[name] ?? 0) < (GAP[name] ?? 0)) return;
  last[name] = now;
  try {
    SFX[name](c, v);
  } catch {
    /* audio is decorative */
  }
}
