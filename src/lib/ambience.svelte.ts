// Focus ambience: background sound beds made from noise, no files. Rain, fire, wind, waves and plain brown, pink
// and white noise, each with its own character, through a shared volume with slow fades. Loaded with the Focus
// panel that uses it.
import { audioContext } from './sounds';
import { volumeGain } from './soundkit';

export type AmbienceKind = 'rain' | 'fire' | 'wind' | 'waves' | 'brown' | 'pink' | 'white';
export const AMBIENCE_KINDS: AmbienceKind[] = ['rain', 'fire', 'wind', 'waves', 'brown', 'pink', 'white'];
export const AMBIENCE_ICON: Record<AmbienceKind, string> = { rain: '🌧️', fire: '🔥', wind: '🌬️', waves: '🌊', brown: '🟤', pink: '🩷', white: '⬜' };

const LOOP_SECONDS = 4;
const cache = new Map<'white' | 'pink' | 'brown', AudioBuffer>();

/** A loop of noise with the given color (Paul Kellet's pink filter; brown is integrated white). */
function noiseBuffer(c: AudioContext, color: 'white' | 'pink' | 'brown'): AudioBuffer {
  const hit = cache.get(color);
  if (hit) return hit;
  const n = c.sampleRate * LOOP_SECONDS;
  const buf = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0,
      last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'white') d[i] = w * 0.5;
      else if (color === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else {
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
    // a short crossfade at the loop point so the seam doesn't click
    const fade = Math.floor(c.sampleRate * 0.05);
    for (let i = 0; i < fade; i++) {
      const k = i / fade;
      d[i] *= k;
      d[n - 1 - i] *= k;
    }
  }
  cache.set(color, buf);
  return buf;
}

class Ambience {
  kind = $state<AmbienceKind | null>(null);
  playing = $state(false);
  private master: GainNode | null = null;
  private nodes: AudioNode[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private volumePct = 40;

  start(kind: AmbienceKind, volumePct = this.volumePct): void {
    const c = audioContext();
    if (!c) return;
    this.stop(true);
    this.volumePct = volumePct;
    const master = c.createGain();
    master.gain.setValueAtTime(0.0001, c.currentTime);
    master.gain.exponentialRampToValueAtTime(Math.max(0.0001, volumeGain(volumePct)), c.currentTime + 1.2);
    master.connect(c.destination);
    this.master = master;
    this.nodes = [master];
    this.build(c, kind, master);
    this.kind = kind;
    this.playing = true;
  }

  setVolume(volumePct: number): void {
    this.volumePct = volumePct;
    const c = audioContext();
    if (this.master && c) this.master.gain.setTargetAtTime(Math.max(0.0001, volumeGain(volumePct)), c.currentTime, 0.05);
  }

  stop(now = false): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    const c = audioContext();
    const master = this.master;
    const nodes = this.nodes;
    this.master = null;
    this.nodes = [];
    this.playing = false;
    if (!master || !c) return;
    const fade = now ? 0.05 : 0.8;
    master.gain.setTargetAtTime(0.0001, c.currentTime, fade / 4);
    setTimeout(
      () => {
        for (const n of nodes) {
          try {
            (n as AudioScheduledSourceNode).stop?.();
          } catch {
            /* already stopped */
          }
          n.disconnect();
        }
      },
      fade * 1000 + 100,
    );
  }

  private loop(c: AudioContext, color: 'white' | 'pink' | 'brown', out: AudioNode): AudioBufferSourceNode {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, color);
    src.loop = true;
    src.connect(out);
    src.start();
    this.nodes.push(src);
    return src;
  }
  private filter(c: AudioContext, type: BiquadFilterType, freq: number, q: number, out: AudioNode): BiquadFilterNode {
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    f.connect(out);
    this.nodes.push(f);
    return f;
  }
  private lfo(c: AudioContext, hz: number, depth: number, param: AudioParam): void {
    const o = c.createOscillator();
    o.frequency.value = hz;
    const g = c.createGain();
    g.gain.value = depth;
    o.connect(g).connect(param);
    o.start();
    this.nodes.push(o, g);
  }
  /** Random short noise hits (rain drops, fire crackles), rescheduled while playing. */
  private hits(c: AudioContext, out: AudioNode, hp: number, every: [number, number], gain: [number, number], dur: number): void {
    const tick = () => {
      if (!this.master) return;
      const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      const src = c.createBufferSource();
      src.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = hp * (0.7 + Math.random() * 0.8);
      const g = c.createGain();
      g.gain.value = gain[0] + Math.random() * (gain[1] - gain[0]);
      src.connect(f).connect(g).connect(out);
      src.start();
      this.timers.push(setTimeout(tick, every[0] + Math.random() * (every[1] - every[0])));
    };
    this.timers.push(setTimeout(tick, every[0]));
  }

  private build(c: AudioContext, kind: AmbienceKind, out: GainNode): void {
    switch (kind) {
      case 'white':
        this.loop(c, 'white', this.filter(c, 'lowpass', 6000, 0.5, out));
        break;
      case 'pink':
        this.loop(c, 'pink', out);
        break;
      case 'brown':
        this.loop(c, 'brown', out);
        break;
      case 'rain': {
        // a steady hiss plus scattered drops
        const body = this.filter(c, 'bandpass', 1800, 0.5, out);
        this.loop(c, 'pink', body);
        this.hits(c, out, 2500, [40, 220], [0.08, 0.25], 0.03);
        break;
      }
      case 'fire': {
        const body = this.filter(c, 'lowpass', 500, 0.7, out);
        this.loop(c, 'brown', body);
        this.lfo(c, 0.3, 120, body.frequency);
        this.hits(c, out, 1800, [80, 600], [0.1, 0.4], 0.02);
        break;
      }
      case 'wind': {
        const body = this.filter(c, 'lowpass', 600, 1.2, out);
        this.loop(c, 'pink', body);
        this.lfo(c, 0.09, 350, body.frequency);
        const swell = c.createGain();
        swell.gain.value = 0.7;
        this.lfo(c, 0.13, 0.3, swell.gain);
        body.disconnect();
        body.connect(swell).connect(out);
        this.nodes.push(swell);
        break;
      }
      case 'waves': {
        const body = this.filter(c, 'lowpass', 900, 0.8, out);
        this.loop(c, 'pink', body);
        const swell = c.createGain();
        swell.gain.value = 0.55;
        this.lfo(c, 0.07, 0.45, swell.gain);
        this.lfo(c, 0.07, 500, body.frequency);
        body.disconnect();
        body.connect(swell).connect(out);
        this.nodes.push(swell);
        break;
      }
    }
  }
}

export const ambience = new Ambience();
