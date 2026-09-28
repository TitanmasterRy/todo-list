// Orebelt sound effects: tiny WebAudio synths with an industrial flavour (clanks, buzzes, swells), no files.
// Silent unless the app's sounds are on (Settings).
import { soundContext } from '../../../lib/sounds';

export type FactorySound = 'build' | 'belt' | 'dismantle' | 'error' | 'milestone' | 'phase' | 'launch' | 'badge' | 'alarm' | 'coin' | 'click';

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
/** A burst of filtered noise: the metal-on-metal part of a clank. */
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

/** A metallic hit: a detuned pair with a fast pitch drop plus a noise burst. */
function clank(c: AudioContext, f: number, at = 0, gain = 0.5): void {
  hiss(c, 0.05, { gain: 0.18, type: 'bandpass', freq: f * 6, q: 1.5, at });
  tones(
    c,
    [
      { f: f * 2.2, at, dur: 0.09, to: f, type: 'square', gain },
      { f: f * 3.1, at: at + 0.005, dur: 0.06, to: f * 1.5, type: 'triangle', gain: gain * 0.6 },
    ],
    0.14,
  );
}

const arpeggio = (c: AudioContext, notes: number[], step: number, dur: number, type: OscillatorType = 'triangle', master = 0.16) =>
  tones(
    c,
    notes.map((f, i) => ({ f, at: i * step, dur, type, gain: 0.5 })),
    master,
  );

const SFX: Record<FactorySound, (c: AudioContext) => void> = {
  build: (c) => {
    clank(c, 180);
    clank(c, 240, 0.09, 0.35);
  },
  belt: (c) => {
    hiss(c, 0.08, { gain: 0.1, type: 'bandpass', freq: 1200, q: 0.8 });
    tones(c, [{ f: 320, dur: 0.07, to: 480, type: 'triangle', gain: 0.35 }], 0.1);
  },
  dismantle: (c) => {
    clank(c, 220, 0, 0.4);
    tones(c, [{ f: 300, at: 0.06, dur: 0.22, to: 90, type: 'sawtooth', gain: 0.3 }], 0.1);
    hiss(c, 0.2, { gain: 0.12, type: 'lowpass', freq: 900, at: 0.05 });
  },
  error: (c) =>
    tones(
      c,
      [
        { f: 180, dur: 0.1, type: 'square', gain: 0.3 },
        { f: 140, at: 0.11, dur: 0.16, type: 'square', gain: 0.3 },
      ],
      0.1,
    ),
  milestone: (c) => arpeggio(c, [523, 659, 784], 0.09, 0.3),
  phase: (c) => {
    arpeggio(c, [392, 523, 659, 784], 0.09, 0.35, 'square', 0.1);
    tones(c, [{ f: 784, at: 0.36, dur: 0.7, type: 'triangle', gain: 0.5 }], 0.14);
    clank(c, 160, 0.38, 0.4);
  },
  launch: (c) => {
    // the rumble builds, then the chord lands with a burst of static
    tones(c, [{ f: 55, dur: 1.4, to: 440, type: 'sawtooth', gain: 0.5 }], 0.16);
    hiss(c, 1.2, { gain: 0.2, type: 'lowpass', freq: 400, q: 0.3 });
    tones(
      c,
      [
        { f: 523, at: 1.2, dur: 1.2, type: 'triangle', gain: 0.5 },
        { f: 659, at: 1.2, dur: 1.2, type: 'triangle', gain: 0.4 },
        { f: 784, at: 1.2, dur: 1.2, type: 'triangle', gain: 0.35 },
        { f: 1047, at: 1.3, dur: 1.1, type: 'triangle', gain: 0.3 },
      ],
      0.14,
    );
    for (let i = 0; i < 6; i++) hiss(c, 0.05, { gain: 0.12, freq: 3500, at: 1.2 + i * 0.08 });
  },
  badge: (c) =>
    tones(
      c,
      [
        { f: 784, dur: 0.12, type: 'triangle', gain: 0.5 },
        { f: 1175, at: 0.1, dur: 0.35, type: 'triangle', gain: 0.45 },
      ],
      0.16,
    ),
  alarm: (c) =>
    // two detuned squares beat against each other: the low buzz of a brownout
    tones(
      c,
      [
        { f: 110, dur: 0.35, type: 'square', gain: 0.3 },
        { f: 113, dur: 0.35, type: 'square', gain: 0.3 },
        { f: 110, at: 0.45, dur: 0.35, type: 'square', gain: 0.3 },
        { f: 113, at: 0.45, dur: 0.35, type: 'square', gain: 0.3 },
      ],
      0.08,
    ),
  coin: (c) =>
    tones(
      c,
      [
        { f: 1568, dur: 0.06, type: 'square', gain: 0.35 },
        { f: 2093, at: 0.06, dur: 0.25, type: 'square', gain: 0.35 },
      ],
      0.08,
    ),
  click: (c) => tones(c, [{ f: 1200, dur: 0.02, type: 'square', gain: 0.25 }], 0.06),
};

const last: Partial<Record<FactorySound, number>> = {};
/** Minimum gap between repeats (ms), so a drag of belts or clicks doesn't pile up. */
const GAP: Partial<Record<FactorySound, number>> = { belt: 40, click: 30, alarm: 900, error: 120 };

/** Play a factory effect. Does nothing while sounds are off. */
export function play(name: FactorySound): void {
  const c = soundContext();
  if (!c) return;
  const now = performance.now();
  const since = now - (last[name] ?? -Infinity);
  const gap = GAP[name];
  if (gap && since >= 0 && since < gap) return;
  last[name] = now;
  try {
    SFX[name](c);
  } catch {
    /* audio is decorative */
  }
}
