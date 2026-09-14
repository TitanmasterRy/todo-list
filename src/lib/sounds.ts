// Tiny WebAudio synth: three sound packs, no external files, lazy AudioContext.
import type { SoundPack } from './types';

export type SoundName = 'pop' | 'levelup' | 'badge' | 'ring' | 'undo' | 'tick' | 'timerDone';

let ctx: AudioContext | null = null;
let enabled = false;
let pack: SoundPack = 'soft';

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function configureSounds(opts: { enabled: boolean; pack: SoundPack }): void {
  enabled = opts.enabled;
  pack = opts.pack;
}

/** Unlock audio on the first user gesture (mobile browsers). */
export function primeAudio(): void {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  const g = c.createGain();
  g.gain.value = 0.0001;
  const o = c.createOscillator();
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.01);
}

interface Note {
  freq: number;
  at: number; // seconds offset
  dur: number;
  type?: OscillatorType;
  gain?: number;
  slideTo?: number;
}

function play(notes: Note[], master = 0.25): void {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const out = c.createGain();
  out.gain.value = master;
  out.connect(c.destination);
  for (const n of notes) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = n.type ?? 'sine';
    o.frequency.setValueAtTime(n.freq, t0 + n.at);
    if (n.slideTo) o.frequency.exponentialRampToValueAtTime(n.slideTo, t0 + n.at + n.dur);
    const peak = n.gain ?? 1;
    g.gain.setValueAtTime(0.0001, t0 + n.at);
    g.gain.exponentialRampToValueAtTime(peak, t0 + n.at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
    o.connect(g).connect(out);
    o.start(t0 + n.at);
    o.stop(t0 + n.at + n.dur + 0.02);
  }
}

function noise(dur: number, gain = 0.3, hp = 2000): void {
  const c = getCtx();
  if (!c) return;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(c.destination);
  src.start();
}

const PACKS: Record<SoundPack, Record<SoundName, () => void>> = {
  soft: {
    pop: () => play([{ freq: 660, at: 0, dur: 0.12, slideTo: 990, gain: 0.8 }], 0.2),
    levelup: () =>
      play(
        [
          { freq: 523, at: 0, dur: 0.15 },
          { freq: 659, at: 0.12, dur: 0.15 },
          { freq: 784, at: 0.24, dur: 0.2 },
          { freq: 1047, at: 0.38, dur: 0.4 },
        ],
        0.22,
      ),
    badge: () =>
      play(
        [
          { freq: 784, at: 0, dur: 0.12 },
          { freq: 1047, at: 0.1, dur: 0.3 },
        ],
        0.2,
      ),
    ring: () =>
      play(
        [
          { freq: 523, at: 0, dur: 0.3 },
          { freq: 659, at: 0.1, dur: 0.3 },
          { freq: 784, at: 0.2, dur: 0.5 },
        ],
        0.22,
      ),
    undo: () => play([{ freq: 660, at: 0, dur: 0.12, slideTo: 440, gain: 0.6 }], 0.15),
    tick: () => play([{ freq: 880, at: 0, dur: 0.04, gain: 0.4 }], 0.08),
    timerDone: () =>
      play(
        [
          { freq: 880, at: 0, dur: 0.2 },
          { freq: 880, at: 0.3, dur: 0.2 },
          { freq: 1175, at: 0.6, dur: 0.5 },
        ],
        0.22,
      ),
  },
  click: {
    pop: () => {
      noise(0.03, 0.25, 3000);
      play([{ freq: 1200, at: 0, dur: 0.04, type: 'square', gain: 0.3 }], 0.15);
    },
    levelup: () =>
      play(
        [
          { freq: 440, at: 0, dur: 0.08, type: 'square', gain: 0.4 },
          { freq: 554, at: 0.08, dur: 0.08, type: 'square', gain: 0.4 },
          { freq: 659, at: 0.16, dur: 0.08, type: 'square', gain: 0.4 },
          { freq: 880, at: 0.24, dur: 0.25, type: 'square', gain: 0.4 },
        ],
        0.18,
      ),
    badge: () =>
      play(
        [
          { freq: 988, at: 0, dur: 0.06, type: 'square', gain: 0.4 },
          { freq: 1319, at: 0.07, dur: 0.2, type: 'square', gain: 0.4 },
        ],
        0.18,
      ),
    ring: () =>
      play(
        [
          { freq: 659, at: 0, dur: 0.1, type: 'triangle' },
          { freq: 988, at: 0.1, dur: 0.1, type: 'triangle' },
          { freq: 1319, at: 0.2, dur: 0.4, type: 'triangle' },
        ],
        0.2,
      ),
    undo: () => play([{ freq: 400, at: 0, dur: 0.06, type: 'square', gain: 0.3 }], 0.12),
    tick: () => noise(0.015, 0.2, 4000),
    timerDone: () =>
      play(
        [
          { freq: 1000, at: 0, dur: 0.1, type: 'square', gain: 0.3 },
          { freq: 1000, at: 0.2, dur: 0.1, type: 'square', gain: 0.3 },
          { freq: 1000, at: 0.4, dur: 0.3, type: 'square', gain: 0.3 },
        ],
        0.18,
      ),
  },
  arcade: {
    pop: () =>
      play(
        [
          { freq: 440, at: 0, dur: 0.06, type: 'square', gain: 0.5 },
          { freq: 880, at: 0.06, dur: 0.1, type: 'square', gain: 0.5, slideTo: 1760 },
        ],
        0.15,
      ),
    levelup: () =>
      play(
        [
          { freq: 262, at: 0, dur: 0.1, type: 'square', gain: 0.5 },
          { freq: 330, at: 0.1, dur: 0.1, type: 'square', gain: 0.5 },
          { freq: 392, at: 0.2, dur: 0.1, type: 'square', gain: 0.5 },
          { freq: 523, at: 0.3, dur: 0.1, type: 'square', gain: 0.5 },
          { freq: 659, at: 0.4, dur: 0.1, type: 'square', gain: 0.5 },
          { freq: 784, at: 0.5, dur: 0.1, type: 'square', gain: 0.5 },
          { freq: 1047, at: 0.6, dur: 0.5, type: 'square', gain: 0.5 },
        ],
        0.16,
      ),
    badge: () =>
      play(
        [
          { freq: 523, at: 0, dur: 0.08, type: 'sawtooth', gain: 0.4 },
          { freq: 784, at: 0.08, dur: 0.08, type: 'sawtooth', gain: 0.4 },
          { freq: 1047, at: 0.16, dur: 0.3, type: 'sawtooth', gain: 0.4 },
        ],
        0.14,
      ),
    ring: () =>
      play(
        [
          { freq: 392, at: 0, dur: 0.12, type: 'square', gain: 0.5 },
          { freq: 523, at: 0.12, dur: 0.12, type: 'square', gain: 0.5 },
          { freq: 659, at: 0.24, dur: 0.12, type: 'square', gain: 0.5 },
          { freq: 784, at: 0.36, dur: 0.5, type: 'square', gain: 0.5 },
        ],
        0.16,
      ),
    undo: () => play([{ freq: 600, at: 0, dur: 0.15, type: 'square', gain: 0.4, slideTo: 200 }], 0.12),
    tick: () => play([{ freq: 1500, at: 0, dur: 0.03, type: 'square', gain: 0.3 }], 0.06),
    timerDone: () =>
      play(
        [
          { freq: 880, at: 0, dur: 0.15, type: 'square', gain: 0.4 },
          { freq: 1109, at: 0.15, dur: 0.15, type: 'square', gain: 0.4 },
          { freq: 1319, at: 0.3, dur: 0.5, type: 'square', gain: 0.4 },
        ],
        0.16,
      ),
  },
};

export function playSound(name: SoundName, force = false): void {
  if (!enabled && !force) return;
  try {
    PACKS[pack][name]();
  } catch (e) {
    console.warn('sound failed', e);
  }
}

/** Preview a pack regardless of the mute setting. */
export function previewPack(p: SoundPack): void {
  const prev = pack;
  pack = p;
  try {
    PACKS[p].pop();
  } finally {
    pack = prev;
  }
}
