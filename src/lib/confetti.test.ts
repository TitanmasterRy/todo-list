import { describe, expect, it } from 'vitest';
import { BURST_SECONDS, buildSprites, burstAlpha, frameStep, particleBudget, spawnParticles, stepParticles } from './confetti';

describe('particleBudget', () => {
  it('gives a laptop the full count', () => {
    expect(particleBudget({ width: 1440, height: 900, requested: 180 })).toBe(180);
  });
  it('scales down on a phone and again in lite mode', () => {
    const phone = particleBudget({ width: 390, height: 844, requested: 180 });
    expect(phone).toBeLessThan(180);
    expect(phone).toBeGreaterThanOrEqual(72); // never below 40% of the ask for the screen
    const lite = particleBudget({ width: 390, height: 844, requested: 180, lite: true });
    expect(lite).toBeLessThan(phone);
    expect(lite).toBeGreaterThanOrEqual(24);
  });
  it('never exceeds the request', () => {
    expect(particleBudget({ width: 4000, height: 3000, requested: 60 })).toBe(60);
  });
});

describe('frameStep', () => {
  it('is one frame at 60 Hz and clamps a long pause', () => {
    expect(frameStep(16.67)).toBeCloseTo(1, 1);
    expect(frameStep(33)).toBeCloseTo(2, 1);
    expect(frameStep(5000)).toBe(3);
    expect(frameStep(0)).toBe(0.25);
  });
});

describe('spawnParticles / stepParticles', () => {
  const rng = () => 0.5;
  it('launches from both sides toward the middle', () => {
    const parts = spawnParticles(4, 1000, 800, 3, rng);
    expect(parts).toHaveLength(4);
    expect(parts[0].x).toBeLessThan(500);
    expect(parts[1].x).toBeGreaterThan(500);
    expect(parts[0].vx).toBeGreaterThan(0);
    expect(parts[1].vx).toBeLessThan(0);
    expect(parts.map((p) => p.sprite)).toEqual([0, 1, 2, 0]);
  });
  it('falls under gravity and counts pieces still on screen', () => {
    const parts = spawnParticles(10, 1000, 800, 2, rng);
    const y0 = parts[0].y;
    expect(stepParticles(parts, 1, 800)).toBe(10);
    expect(parts[0].y).toBeLessThan(y0); // first it rises
    for (let i = 0; i < 400; i++) stepParticles(parts, 1, 800);
    expect(stepParticles(parts, 1, 800)).toBe(0); // then it all lands
  });
  it('a two-frame step moves twice as far as a one-frame step', () => {
    const a = spawnParticles(1, 1000, 800, 1, rng);
    const b = spawnParticles(1, 1000, 800, 1, rng);
    stepParticles(a, 1, 800);
    stepParticles(a, 1, 800);
    stepParticles(b, 2, 800);
    expect(b[0].x).toBeCloseTo(a[0].x, 0);
  });
});

describe('burstAlpha', () => {
  it('holds, then fades out by the end of the burst', () => {
    expect(burstAlpha(0)).toBe(1);
    expect(burstAlpha(1.6)).toBe(1);
    expect(burstAlpha(2.2)).toBeCloseTo(0.5);
    expect(burstAlpha(BURST_SECONDS)).toBe(0);
  });
});

describe('buildSprites', () => {
  it('uses shapes in the theme colors for a plain burst', () => {
    const s = buildSprites(['#111', '#222'], [], 'burst', false);
    expect(s).toHaveLength(6);
    expect(s.every((x) => x.kind !== 'glyph')).toBe(true);
  });
  it('pixels are rectangles only, stars are ✦ glyphs', () => {
    expect(buildSprites(['#1', '#2'], [], 'pixels', false).every((x) => x.kind === 'rect')).toBe(true);
    expect(buildSprites(['#1'], [], 'stars', false)).toEqual([{ kind: 'glyph', color: '#1', glyph: '✦' }]);
  });
  it('mixes emoji in for hearts and bought styles', () => {
    const s = buildSprites(['#f0f'], ['💖', '⭐'], 'hearts', false);
    expect(s.filter((x) => x.kind === 'glyph').map((x) => x.glyph)).toEqual(['💖', '⭐', '💖']);
    expect(s.filter((x) => x.kind !== 'glyph')).toHaveLength(3);
    const bought = buildSprites(['#fc0'], ['🪙'], 'burst', true);
    expect(bought.some((x) => x.glyph === '🪙')).toBe(true);
    expect(bought.filter((x) => x.kind !== 'glyph').every((x) => x.kind === 'dot')).toBe(true);
  });
});
