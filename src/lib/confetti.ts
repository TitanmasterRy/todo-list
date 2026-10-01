// Confetti simulation, kept apart from the canvas so it can be tested. Particles reference a pre-drawn sprite
// (a glyph or a colored shape) by index; the component draws each one with a single drawImage call.

export interface Sprite {
  kind: 'glyph' | 'rect' | 'dot' | 'tri';
  color: string;
  glyph?: string; // for kind 'glyph': an emoji or ✦
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  scale: number; // of the sprite's drawn size
  sprite: number; // index into the sprite list
}

export interface Budget {
  width: number;
  height: number;
  requested: number;
  lite?: boolean;
}

/** How many pieces to launch: the requested count, scaled down for small screens and halved in lite mode. */
export function particleBudget(b: Budget): number {
  const area = Math.max(1, b.width * b.height);
  const screen = Math.min(1, Math.max(0.4, area / (1100 * 700)));
  let n = Math.round(b.requested * screen);
  if (b.lite) n = Math.round(n * 0.45);
  return Math.max(24, Math.min(b.requested, n));
}

/** A clamped step length in 60 Hz frames: a dropped frame moves pieces further, a tab switch doesn't teleport them. */
export function frameStep(dtMs: number): number {
  return Math.min(3, Math.max(0.25, dtMs / (1000 / 60)));
}

export function spawnParticles(count: number, width: number, height: number, spriteCount: number, rng: () => number = Math.random): Particle[] {
  const parts: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    parts.push({
      x: width / 2 + side * (width * 0.25) + (rng() - 0.5) * 60,
      y: height * 0.6,
      vx: -side * (2 + rng() * 6) + (rng() - 0.5) * 4,
      vy: -(9 + rng() * 9),
      rot: rng() * Math.PI,
      vr: (rng() - 0.5) * 0.3,
      scale: 0.55 + rng() * 0.45,
      sprite: spriteCount ? i % spriteCount : 0,
    });
  }
  return parts;
}

/** Move every piece by `step` frames of gravity and drag. Returns how many are still on screen. */
export function stepParticles(parts: Particle[], step: number, height: number): number {
  const drag = Math.pow(0.99, step);
  let alive = 0;
  for (const p of parts) {
    p.vy += 0.35 * step;
    p.vx *= drag;
    p.x += p.vx * step;
    p.y += p.vy * step;
    p.rot += p.vr * step;
    if (p.y < height + 20) alive++;
  }
  return alive;
}

/** Opacity over the burst: full for 1.6 s, then a 1.2 s fade. */
export function burstAlpha(elapsedSec: number): number {
  return Math.max(0, 1 - Math.max(0, elapsedSec - 1.6) / 1.2);
}

export const BURST_SECONDS = 3.5;

export type Flourish = 'burst' | 'hearts' | 'pixels' | 'leaves' | 'stars' | 'ink' | 'none';

/** The sprite set for a theme (or a bought confetti style, which uses its own emoji and colors). */
export function buildSprites(colors: string[], emoji: string[], flourish: Flourish, styled: boolean): Sprite[] {
  const out: Sprite[] = [];
  const glyphs = emoji.filter(Boolean);
  const shapes: Sprite['kind'][] = styled ? ['dot'] : flourish === 'pixels' ? ['rect'] : ['rect', 'dot', 'tri'];
  for (const color of colors) for (const kind of shapes) out.push({ kind, color });
  if (flourish === 'stars' && !styled) return colors.map((color) => ({ kind: 'glyph', color, glyph: '✦' }));
  const wantGlyphs = styled || flourish === 'hearts' || flourish === 'leaves';
  if (wantGlyphs && glyphs.length) {
    // interleave so every other piece is a glyph, as before
    const mixed: Sprite[] = [];
    const n = Math.max(out.length, glyphs.length);
    for (let i = 0; i < n; i++) {
      mixed.push(out[i % out.length]);
      mixed.push({ kind: 'glyph', color: colors[i % colors.length], glyph: glyphs[i % glyphs.length] });
    }
    return mixed;
  }
  return out;
}
