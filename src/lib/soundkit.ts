// The sound vocabulary, kept apart from WebAudio so it can be tested. Every sound is a short pattern (notes as
// semitones from a root, plus timing) rendered through a pack's "voice" (its oscillator, envelope and character),
// so all seven packs cover every event and a new event is one pattern, not seven hand-tuned sounds.
import type { SoundPack } from './types';

export type SoundName =
  | 'pop' // task completed
  | 'add' // task added
  | 'delete'
  | 'snooze'
  | 'undo'
  | 'tick' // subtask, small toggles
  | 'nav' // a tab or view switch
  | 'open' // a sheet or dialog
  | 'close'
  | 'error' // a warning toast
  | 'coin' // coins paid out
  | 'levelup'
  | 'badge'
  | 'ring' // daily goal closed
  | 'streak' // streak milestone
  | 'timerStart'
  | 'breakStart'
  | 'timerDone';

export type SoundCategory = 'ui' | 'rewards' | 'timer';

export const SOUND_NAMES: SoundName[] = [
  'pop',
  'add',
  'delete',
  'snooze',
  'undo',
  'tick',
  'nav',
  'open',
  'close',
  'error',
  'coin',
  'levelup',
  'badge',
  'ring',
  'streak',
  'timerStart',
  'breakStart',
  'timerDone',
];

export const CATEGORY: Record<SoundName, SoundCategory> = {
  pop: 'ui',
  add: 'ui',
  delete: 'ui',
  snooze: 'ui',
  undo: 'ui',
  tick: 'ui',
  nav: 'ui',
  open: 'ui',
  close: 'ui',
  error: 'ui',
  coin: 'rewards',
  levelup: 'rewards',
  badge: 'rewards',
  ring: 'rewards',
  streak: 'rewards',
  timerStart: 'timer',
  breakStart: 'timer',
  timerDone: 'timer',
};

export const SOUND_PACKS: SoundPack[] = ['soft', 'click', 'arcade', 'bubble', 'chime', 'synth', 'paper'];

/** One note of a rendered sound. `at` and `dur` are seconds; `freq` in Hz; `slideTo` a pitch glide target. */
export interface Note {
  freq: number;
  at: number;
  dur: number;
  type: OscillatorType;
  gain: number;
  slideTo?: number;
  detune?: number; // cents
}
/** A burst of filtered noise (clicks, paper, drops). */
export interface Burst {
  at: number;
  dur: number;
  gain: number;
  hp: number; // highpass Hz
}
export interface Rendered {
  notes: Note[];
  bursts: Burst[];
  master: number;
}

/** A pattern: semitone steps from the root, played `step` seconds apart, each lasting `dur`. */
interface Pattern {
  root: number; // Hz
  steps: number[]; // semitones; a nested pair [a, b] is a chord
  step: number;
  dur: number;
  slide?: number; // semitones each note glides by
  gain?: number;
  bursts?: Burst[]; // extra noise (paper rustles, clicks)
  chord?: boolean; // play all steps together
}

/** How a pack sounds: waveform, how notes glide, how long they ring, and whether they come with a click or rustle. */
export interface Voice {
  type: OscillatorType;
  gain: number; // master level for the pack
  ring: number; // multiplies note durations
  glide: number; // multiplies pattern slides (0 = none)
  detune: number; // cents, a slight chorus
  click?: Burst; // played at the start of short sounds
  rustle?: Burst; // played at the start of every sound (paper)
  octave?: number; // shift everything (synth sits low)
}

export const VOICES: Record<SoundPack, Voice> = {
  soft: { type: 'sine', gain: 0.22, ring: 1, glide: 0.6, detune: 0 },
  click: { type: 'square', gain: 0.12, ring: 0.45, glide: 0, detune: 0, click: { at: 0, dur: 0.02, gain: 0.25, hp: 3000 } },
  arcade: { type: 'square', gain: 0.14, ring: 0.7, glide: 1, detune: 0 },
  bubble: { type: 'sine', gain: 0.2, ring: 1.1, glide: 1.6, detune: 4 },
  chime: { type: 'triangle', gain: 0.2, ring: 2.4, glide: 0, detune: 3 },
  synth: { type: 'sawtooth', gain: 0.1, ring: 1.3, glide: 0.8, detune: 8, octave: -1 },
  paper: { type: 'triangle', gain: 0.18, ring: 0.8, glide: 0, detune: 0, rustle: { at: 0, dur: 0.06, gain: 0.3, hp: 1200 } },
};

const C5 = 523.25;
const A4 = 440;

export const PATTERNS: Record<SoundName, Pattern> = {
  pop: { root: 659, steps: [0], step: 0, dur: 0.12, slide: 7, gain: 0.8 },
  add: { root: C5, steps: [0, 4], step: 0.06, dur: 0.1, gain: 0.6 },
  delete: { root: A4, steps: [0, -5], step: 0.07, dur: 0.1, gain: 0.5 },
  snooze: { root: 587, steps: [0, -3, -7], step: 0.08, dur: 0.14, gain: 0.45 },
  undo: { root: 660, steps: [0], step: 0, dur: 0.14, slide: -7, gain: 0.6 },
  tick: { root: 880, steps: [0], step: 0, dur: 0.04, gain: 0.4 },
  nav: { root: 1047, steps: [0], step: 0, dur: 0.035, gain: 0.25 },
  open: { root: 392, steps: [0, 7], step: 0.05, dur: 0.1, gain: 0.4 },
  close: { root: 587, steps: [0, -7], step: 0.05, dur: 0.1, gain: 0.35 },
  error: { root: 330, steps: [0, 0], step: 0.12, dur: 0.1, gain: 0.5 },
  coin: { root: 1319, steps: [0, 5], step: 0.05, dur: 0.14, gain: 0.5 },
  levelup: { root: C5, steps: [0, 4, 7, 12], step: 0.12, dur: 0.2, gain: 0.8 },
  badge: { root: 784, steps: [0, 5], step: 0.1, dur: 0.3, gain: 0.8 },
  ring: { root: C5, steps: [0, 4, 7], step: 0.1, dur: 0.4, gain: 0.8 },
  streak: { root: 392, steps: [0, 7, 12, 19], step: 0.1, dur: 0.3, gain: 0.8 },
  timerStart: { root: 659, steps: [0, 7], step: 0.08, dur: 0.12, gain: 0.5 },
  breakStart: { root: 784, steps: [0, -5], step: 0.1, dur: 0.25, gain: 0.5 },
  timerDone: { root: 880, steps: [0, 0, 5], step: 0.3, dur: 0.3, gain: 0.8 },
};

/** Timer chimes that stay the same whatever the pack (Settings → Sounds → When the timer ends). */
export type TimerChime = 'pack' | 'bell' | 'beeps' | 'gong';
export const TIMER_CHIMES: TimerChime[] = ['pack', 'bell', 'beeps', 'gong'];
const CHIMES: Record<Exclude<TimerChime, 'pack'>, Rendered> = {
  bell: {
    notes: [
      { freq: 1760, at: 0, dur: 1.4, type: 'sine', gain: 0.6 },
      { freq: 2637, at: 0, dur: 0.9, type: 'sine', gain: 0.25 },
      { freq: 1760, at: 0.7, dur: 1.4, type: 'sine', gain: 0.5 },
    ],
    bursts: [],
    master: 0.22,
  },
  beeps: {
    notes: [0, 0.25, 0.5, 0.75].map((at) => ({ freq: 1000, at, dur: 0.12, type: 'square' as OscillatorType, gain: 0.4 })),
    bursts: [],
    master: 0.14,
  },
  gong: {
    notes: [
      { freq: 110, at: 0, dur: 2.5, type: 'triangle', gain: 0.6 },
      { freq: 165, at: 0, dur: 2, type: 'sine', gain: 0.35, detune: 6 },
      { freq: 220, at: 0.02, dur: 1.6, type: 'sine', gain: 0.25 },
    ],
    bursts: [{ at: 0, dur: 0.08, gain: 0.2, hp: 400 }],
    master: 0.3,
  },
};

const semi = (root: number, s: number) => root * Math.pow(2, s / 12);

/** Render a sound for a pack: the pattern's notes shaped by the voice, plus any noise the voice adds. */
export function render(name: SoundName, pack: SoundPack): Rendered {
  const v = VOICES[pack];
  const p = PATTERNS[name];
  const root = v.octave ? p.root * Math.pow(2, v.octave) : p.root;
  const notes: Note[] = p.steps.map((s, i) => {
    const freq = semi(root, s);
    const n: Note = { freq, at: i * p.step, dur: p.dur * v.ring, type: v.type, gain: p.gain ?? 0.6, detune: v.detune || undefined };
    if (p.slide && v.glide) n.slideTo = semi(freq, p.slide * v.glide);
    return n;
  });
  const bursts: Burst[] = [...(p.bursts ?? [])];
  if (v.rustle) bursts.push(v.rustle);
  // short interface sounds get the pack's click (a crisp attack); longer rewards don't
  if (v.click && CATEGORY[name] === 'ui') bursts.push(v.click);
  return { notes, bursts, master: v.gain };
}

/** The timer-end sound: the pack's own, or one of the fixed chimes. */
export function renderTimerDone(pack: SoundPack, chime: TimerChime): Rendered {
  return chime === 'pack' ? render('timerDone', pack) : CHIMES[chime];
}

/** Percent (0–100) to a gain multiplier: a gentle curve so the low end is still audible. */
export function volumeGain(percent: number): number {
  const p = Math.max(0, Math.min(100, percent)) / 100;
  return Math.pow(p, 1.6);
}

/** Same sound again within a few frames (a bulk action, a double tap) is skipped. */
export const THROTTLE_MS = 60;
export function throttled(last: number | undefined, now: number): boolean {
  return last !== undefined && now - last < THROTTLE_MS;
}
