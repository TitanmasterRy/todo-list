// Casino chip drawing: denominations, colors, and the SVG face used when no chip art is dropped in.

export const CHIP_VALUES = [1, 5, 10, 25, 100, 500, 1000];
/** Values with their own art slot (casino/chip-N.webp). 10 reuses the 5 art, tinted blue. */
export const CHIP_ART = [1, 5, 25, 100, 500, 1000];

interface ChipLook {
  base: string;
  edge: string; // edge stripes and inner ring
  inlay: string;
  ink: string; // the printed value
}
const LOOK: Record<number, ChipLook> = {
  1: { base: '#eeeae0', edge: '#2359b5', inlay: '#fbfaf6', ink: '#1d3f7a' },
  5: { base: '#c8102e', edge: '#fff4f0', inlay: '#fbf3ec', ink: '#a10d25' },
  10: { base: '#1f5fbf', edge: '#f2f6ff', inlay: '#f4f7fd', ink: '#174a95' },
  25: { base: '#17853c', edge: '#fbf7e8', inlay: '#f5f8ef', ink: '#116631' },
  100: { base: '#1c1c22', edge: '#e9dfc4', inlay: '#f4efe2', ink: '#1c1c22' },
  500: { base: '#6a2ea3', edge: '#f5d56c', inlay: '#f7f1fb', ink: '#55217f' },
  1000: { base: '#e2a21b', edge: '#1c1c22', inlay: '#fff8e3', ink: '#8a5a00' },
};

/** The chip look for any amount: the largest denomination that fits. */
export function chipTier(v: number): number {
  let t = 1;
  for (const c of CHIP_VALUES) if (v >= c) t = c;
  return t;
}

export function chipLabel(v: number): string {
  if (v >= 1_000_000) return `${Math.round(v / 100_000) / 10}M`;
  if (v >= 1000) return `${Math.round(v / 100) / 10}K`;
  return String(v);
}

/** Art slot for a chip value, and whether the art needs the blue tint (the 10 chip). */
export function chipArt(v: number): { name: string; tint: boolean } {
  const t = chipTier(v);
  if (t === 10) return { name: 'casino/chip-5.webp', tint: true };
  return { name: `casino/chip-${CHIP_ART.includes(t) ? t : 1}.webp`, tint: false };
}

/** Chips making up an amount, largest first (at most `max`). */
export function breakdown(amount: number, max = 8): number[] {
  const out: number[] = [];
  let left = Math.floor(amount);
  for (const c of [...CHIP_VALUES].reverse()) {
    while (left >= c && out.length < max) {
      out.push(c);
      left -= c;
    }
  }
  return out;
}

const R = 42;
const CIRC = 2 * Math.PI * R;

/** An SVG chip face (viewBox 100×100). `label` false leaves the center blank. */
export function chipSvg(v: number, label = true): string {
  const k = LOOK[chipTier(v)];
  const text = chipLabel(v);
  const fs = text.length >= 4 ? 19 : text.length === 3 ? 23 : 28;
  const dash = CIRC / 12;
  return (
    `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">` +
    `<circle cx="50" cy="50" r="48" fill="${k.base}"/>` +
    `<circle cx="50" cy="50" r="${R}" fill="none" stroke="${k.edge}" stroke-width="11" stroke-dasharray="${dash.toFixed(2)} ${dash.toFixed(2)}" transform="rotate(-8 50 50)"/>` +
    `<circle cx="50" cy="50" r="48" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="2"/>` +
    `<circle cx="50" cy="50" r="33" fill="${k.base}"/>` +
    `<circle cx="50" cy="50" r="30" fill="none" stroke="${k.edge}" stroke-width="1.6" stroke-dasharray="3 2.4"/>` +
    `<circle cx="50" cy="50" r="25" fill="${k.inlay}"/>` +
    (label
      ? `<text x="50" y="51" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif" font-weight="900" font-size="${fs}" fill="${k.ink}">${text}</text>`
      : '') +
    `<ellipse cx="38" cy="28" rx="26" ry="13" fill="#fff" opacity=".16" transform="rotate(-24 38 28)"/>` +
    `</svg>`
  );
}
