// WebAudio sound engine: no audio files, a lazy AudioContext, one master bus with a volume and a limiter, and a
// vocabulary of short synthesized sounds (src/lib/soundkit.ts) in seven packs. Lazy chunks (casino, factory,
// ambience) play through the same bus so one volume rules everything.
import type { SoundPack } from './types';
import { CATEGORY, render, renderTimerDone, throttled, volumeGain, type Rendered, type SoundName, type TimerChime } from './soundkit';

export type { SoundName, TimerChime } from './soundkit';

export interface SoundConfig {
  enabled: boolean;
  pack: SoundPack;
  volume: number; // 0–100
  ui: boolean;
  rewards: boolean;
  timer: boolean;
  chime: TimerChime;
}

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
let config: SoundConfig = { enabled: false, pack: 'soft', volume: 70, ui: true, rewards: true, timer: true, chime: 'pack' };
const lastPlayed = new Map<SoundName, number>();
let unlockBound = false;

/** The context, created on first use, whether or not sounds are on (ambience and previews need it). */
export function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** The master bus: everything plays through it, so the volume setting and the limiter apply to every chunk. */
export function soundBus(): GainNode | null {
  const c = audioContext();
  if (!c) return null;
  if (!bus) {
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 20;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;
    bus = c.createGain();
    bus.gain.value = volumeGain(config.volume);
    bus.connect(limiter).connect(c.destination);
  }
  return bus;
}

export function configureSounds(opts: Partial<SoundConfig>): void {
  config = { ...config, ...opts };
  if (bus && ctx) bus.gain.setTargetAtTime(volumeGain(config.volume), ctx.currentTime, 0.02);
  // mobile browsers only let audio start from a gesture: the first tap or key unlocks the context for later sounds
  if (config.enabled && !unlockBound && typeof document !== 'undefined') {
    unlockBound = true;
    const unlock = () => primeAudio();
    document.addEventListener('pointerdown', unlock, { once: true, passive: true });
    document.addEventListener('keydown', unlock, { once: true });
  }
}

/** The audio context while sounds are on (lazy chunks synthesize their own effects), else null. */
export function soundContext(): AudioContext | null {
  return config.enabled ? audioContext() : null;
}

/** Unlock audio on a user gesture with an inaudible blip. */
export function primeAudio(): void {
  if (!config.enabled) return;
  const c = audioContext();
  const out = soundBus();
  if (!c || !out) return;
  const g = c.createGain();
  g.gain.value = 0.0001;
  const o = c.createOscillator();
  o.connect(g).connect(out);
  o.start();
  o.stop(c.currentTime + 0.01);
}

function playRendered(r: Rendered): void {
  const c = audioContext();
  const out = soundBus();
  if (!c || !out) return;
  const t0 = c.currentTime;
  const master = c.createGain();
  master.gain.value = r.master;
  master.connect(out);
  for (const n of r.notes) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = n.type;
    if (n.detune) o.detune.value = n.detune;
    o.frequency.setValueAtTime(n.freq, t0 + n.at);
    if (n.slideTo) o.frequency.exponentialRampToValueAtTime(n.slideTo, t0 + n.at + n.dur);
    g.gain.setValueAtTime(0.0001, t0 + n.at);
    g.gain.exponentialRampToValueAtTime(n.gain, t0 + n.at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
    o.connect(g).connect(master);
    o.start(t0 + n.at);
    o.stop(t0 + n.at + n.dur + 0.02);
  }
  for (const b of r.bursts) {
    const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * b.dur)), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = b.hp;
    const g = c.createGain();
    g.gain.value = b.gain;
    src.connect(f).connect(g).connect(master);
    src.start(t0 + b.at);
  }
}

function allowed(name: SoundName): boolean {
  const cat = CATEGORY[name];
  return cat === 'ui' ? config.ui : cat === 'rewards' ? config.rewards : config.timer;
}

export function playSound(name: SoundName, force = false): void {
  if (!force && (!config.enabled || !allowed(name))) return;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (!force && throttled(lastPlayed.get(name), now)) return;
  lastPlayed.set(name, now);
  try {
    playRendered(name === 'timerDone' ? renderTimerDone(config.pack, config.chime) : render(name, config.pack));
  } catch (e) {
    console.warn('sound failed', e);
  }
}

/** Hear one sound in a pack regardless of the mute setting (Settings → Sounds). */
export function previewSound(name: SoundName, pack: SoundPack = config.pack): void {
  try {
    playRendered(render(name, pack));
  } catch {
    /* no audio here */
  }
}

/** Preview a pack regardless of the mute setting. */
export function previewPack(p: SoundPack): void {
  previewSound('pop', p);
}

export function previewChime(chime: TimerChime): void {
  try {
    playRendered(renderTimerDone(config.pack, chime));
  } catch {
    /* no audio here */
  }
}
