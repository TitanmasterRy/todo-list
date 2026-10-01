import { describe, expect, it } from 'vitest';
import { CATEGORY, PATTERNS, SOUND_NAMES, SOUND_PACKS, THROTTLE_MS, VOICES, render, renderTimerDone, throttled, volumeGain } from './soundkit';

describe('vocabulary', () => {
  it('every sound has a pattern and a category, every pack a voice', () => {
    for (const n of SOUND_NAMES) {
      expect(PATTERNS[n]).toBeDefined();
      expect(CATEGORY[n]).toBeDefined();
    }
    for (const p of SOUND_PACKS) expect(VOICES[p]).toBeDefined();
  });
});

describe('render', () => {
  it('renders every sound for every pack with sane values', () => {
    for (const p of SOUND_PACKS)
      for (const n of SOUND_NAMES) {
        const r = render(n, p);
        expect(r.notes.length).toBeGreaterThan(0);
        expect(r.master).toBeGreaterThan(0);
        expect(r.master).toBeLessThanOrEqual(0.35);
        for (const note of r.notes) {
          expect(note.freq).toBeGreaterThan(40);
          expect(note.freq).toBeLessThan(6000);
          expect(note.dur).toBeGreaterThan(0);
          expect(note.at).toBeGreaterThanOrEqual(0);
          expect(note.gain).toBeGreaterThan(0);
          expect(note.gain).toBeLessThanOrEqual(1);
        }
      }
  });
  it('follows the pattern: a level-up is a rising major arpeggio', () => {
    const r = render('levelup', 'soft');
    const f = r.notes.map((n) => n.freq);
    expect(f).toHaveLength(4);
    expect(f[1]).toBeGreaterThan(f[0]);
    expect(f[3] / f[0]).toBeCloseTo(2, 1);
    expect(r.notes[1].at).toBeCloseTo(0.12);
  });
  it('the voice shapes it: synth sits an octave lower, chime rings longer, bubble glides', () => {
    expect(render('pop', 'synth').notes[0].freq).toBeCloseTo(render('pop', 'soft').notes[0].freq / 2);
    expect(render('badge', 'chime').notes[0].dur).toBeGreaterThan(render('badge', 'soft').notes[0].dur);
    expect(render('pop', 'bubble').notes[0].slideTo).toBeGreaterThan(render('pop', 'bubble').notes[0].freq);
    expect(render('pop', 'chime').notes[0].slideTo).toBeUndefined();
  });
  it('clicks come with interface sounds only; paper rustles on everything', () => {
    expect(render('pop', 'click').bursts).toHaveLength(1);
    expect(render('levelup', 'click').bursts).toHaveLength(0);
    expect(render('levelup', 'paper').bursts).toHaveLength(1);
  });
});

describe('renderTimerDone', () => {
  it('uses the pack by default and the fixed chimes otherwise', () => {
    expect(renderTimerDone('arcade', 'pack')).toEqual(render('timerDone', 'arcade'));
    expect(renderTimerDone('arcade', 'bell').notes[0].freq).toBe(1760);
    expect(renderTimerDone('soft', 'beeps').notes).toHaveLength(4);
    expect(renderTimerDone('soft', 'gong').bursts).toHaveLength(1);
  });
});

describe('volumeGain', () => {
  it('is a gentle curve clamped to 0–100', () => {
    expect(volumeGain(0)).toBe(0);
    expect(volumeGain(100)).toBe(1);
    expect(volumeGain(150)).toBe(1);
    expect(volumeGain(50)).toBeGreaterThan(0.25);
    expect(volumeGain(50)).toBeLessThan(0.5);
  });
});

describe('throttled', () => {
  it('skips a repeat inside the window, never the first play', () => {
    expect(throttled(undefined, 1000)).toBe(false);
    expect(throttled(1000, 1000 + THROTTLE_MS - 1)).toBe(true);
    expect(throttled(1000, 1000 + THROTTLE_MS)).toBe(false);
  });
});
