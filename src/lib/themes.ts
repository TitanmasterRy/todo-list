// Theme packs: colors + shape + sound pack + particle style + confetti palette + completion flourish.
import type { SoundPack, ThemePack } from './types';

export interface ThemeDef {
  id: ThemePack;
  name: string;
  emoji: string;
  tagline: string;
  sound: SoundPack;
  particles: { shapes: string[]; colors: string[]; count: number; spread: number }; // shapes: css shape ids or emoji
  confetti: string[];
  flourish: 'burst' | 'hearts' | 'pixels' | 'leaves' | 'stars' | 'ink' | 'none';
  vars: Record<string, string>; // CSS variables applied on :root (both light/dark unless suffixed)
  darkVars?: Record<string, string>;
  lightVars?: Record<string, string>;
  font?: string;
}

export const THEMES: ThemeDef[] = [
  {
    id: 'classic',
    name: 'Classic',
    emoji: '✨',
    tagline: 'The default: violet accent, soft pop, confetti burst.',
    sound: 'soft',
    particles: { shapes: ['dot'], colors: ['#6c5ce7', '#00cec9', '#fdcb6e', '#e17055', '#fd79a8', '#74b9ff'], count: 10, spread: 24 },
    confetti: ['#6c5ce7', '#00cec9', '#fdcb6e', '#e17055', '#55efc4', '#fd79a8', '#74b9ff', '#ffeaa7'],
    flourish: 'burst',
    vars: { '--radius': '12px', '--radius-sm': '8px', '--font-weight-title': '600' },
  },
  {
    id: 'sleek',
    name: 'Sleek',
    emoji: '◼️',
    tagline: 'Monochrome, tight corners, a single click and a thin glow. Nothing in your way.',
    sound: 'click',
    particles: { shapes: ['line'], colors: ['#e8eaf0', '#9aa1b2'], count: 6, spread: 16 },
    confetti: ['#ffffff', '#c9cedb', '#8b92a3', '#6c5ce7'],
    flourish: 'none',
    vars: { '--radius': '6px', '--radius-sm': '4px', '--font-weight-title': '500', '--spring': 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    darkVars: {
      '--bg': '#0a0a0b',
      '--bg-elev': '#111113',
      '--bg-elev-2': '#18181b',
      '--bg-hover': '#1f1f23',
      '--border': '#232327',
      '--border-strong': '#333338',
      '--accent': '#e8eaf0',
    },
    lightVars: { '--bg': '#fafafa', '--bg-elev': '#ffffff', '--bg-elev-2': '#f2f2f3', '--border': '#e4e4e7', '--border-strong': '#c8c8cc', '--accent': '#18181b' },
  },
  {
    id: 'cute',
    name: 'Cute',
    emoji: '🌸',
    tagline: 'Pastel pinks, round corners, bubbly pops and a shower of hearts and stars.',
    sound: 'bubble',
    particles: { shapes: ['💖', '⭐', '🌸', '✨', '💫'], colors: ['#ff8fab', '#ffc6d9', '#b5ead7', '#fdfd96', '#c7ceea'], count: 9, spread: 30 },
    confetti: ['#ff8fab', '#ffc6d9', '#b5ead7', '#fdfd96', '#c7ceea', '#ffd6e0', '#e2f0cb'],
    flourish: 'hearts',
    vars: { '--radius': '18px', '--radius-sm': '12px', '--font-weight-title': '700', '--accent': '#ff6f9c' },
    darkVars: { '--bg': '#1a1216', '--bg-elev': '#241820', '--bg-elev-2': '#2e1f29', '--bg-hover': '#3a2733', '--border': '#3d2a36', '--border-strong': '#54394a' },
    lightVars: {
      '--bg': '#fff4f8',
      '--bg-elev': '#ffffff',
      '--bg-elev-2': '#ffe9f1',
      '--bg-hover': '#ffdfea',
      '--border': '#ffd3e2',
      '--border-strong': '#f7b5cc',
      '--text': '#4a2a3a',
      '--text-muted': '#8a5a72',
    },
  },
  {
    id: 'arcade',
    name: 'Arcade',
    emoji: '🕹️',
    tagline: 'Neon on black, pixel particles, chiptune sounds. Every task is a power-up.',
    sound: 'arcade',
    particles: { shapes: ['pixel'], colors: ['#39ff14', '#ff2079', '#00e5ff', '#ffe600', '#ff6a00'], count: 12, spread: 28 },
    confetti: ['#39ff14', '#ff2079', '#00e5ff', '#ffe600', '#ff6a00', '#b026ff'],
    flourish: 'pixels',
    vars: { '--radius': '2px', '--radius-sm': '2px', '--font-weight-title': '700', '--accent': '#39ff14', '--mono': '"Press Start 2P", ui-monospace, monospace' },
    darkVars: {
      '--bg': '#050510',
      '--bg-elev': '#0b0b1e',
      '--bg-elev-2': '#12122b',
      '--bg-hover': '#1a1a3a',
      '--border': '#22224a',
      '--border-strong': '#3a3a7a',
      '--text': '#e8f7ff',
      '--text-muted': '#8ea0c8',
    },
    lightVars: {
      '--bg': '#0b0b1e',
      '--bg-elev': '#12122b',
      '--bg-elev-2': '#1a1a3a',
      '--bg-hover': '#22224a',
      '--border': '#2a2a5a',
      '--border-strong': '#3a3a7a',
      '--text': '#e8f7ff',
      '--text-muted': '#8ea0c8',
    },
  },
  {
    id: 'nature',
    name: 'Nature',
    emoji: '🌿',
    tagline: 'Forest greens and warm paper, wooden chimes, drifting leaves.',
    sound: 'chime',
    particles: { shapes: ['🍃', '🌱', '🍂', '✿'], colors: ['#4caf50', '#8bc34a', '#c8a15b', '#7bb661'], count: 8, spread: 26 },
    confetti: ['#4caf50', '#8bc34a', '#cddc39', '#c8a15b', '#a1887f', '#66bb6a'],
    flourish: 'leaves',
    vars: { '--radius': '14px', '--radius-sm': '10px', '--font-weight-title': '600', '--accent': '#3f9d5a' },
    darkVars: { '--bg': '#0f1a12', '--bg-elev': '#15241a', '--bg-elev-2': '#1c2f22', '--bg-hover': '#243b2b', '--border': '#26402e', '--border-strong': '#3a5a44' },
    lightVars: {
      '--bg': '#f4f1e6',
      '--bg-elev': '#fffdf5',
      '--bg-elev-2': '#ece7d3',
      '--bg-hover': '#e3dcc2',
      '--border': '#dcd5bb',
      '--border-strong': '#c3b998',
      '--text': '#243120',
      '--text-muted': '#5e6b5a',
    },
  },
  {
    id: 'space',
    name: 'Space',
    emoji: '🚀',
    tagline: 'Deep navy, starfield particles, synth swells. Level ups launch.',
    sound: 'synth',
    particles: { shapes: ['star', '✦', '·'], colors: ['#ffffff', '#9ad0ff', '#c8b6ff', '#ffd166'], count: 14, spread: 34 },
    confetti: ['#ffffff', '#9ad0ff', '#c8b6ff', '#ffd166', '#7f5af0', '#2cb67d'],
    flourish: 'stars',
    vars: { '--radius': '10px', '--radius-sm': '8px', '--font-weight-title': '600', '--accent': '#7f5af0' },
    darkVars: {
      '--bg': '#070914',
      '--bg-elev': '#0d1024',
      '--bg-elev-2': '#141936',
      '--bg-hover': '#1b2147',
      '--border': '#1f2650',
      '--border-strong': '#33407a',
      '--text': '#e9ecff',
      '--text-muted': '#9aa5d6',
    },
    lightVars: { '--bg': '#eef0fb', '--bg-elev': '#ffffff', '--bg-elev-2': '#e3e7fa', '--bg-hover': '#d7dcf7', '--border': '#d0d5f0', '--border-strong': '#a8b1e0' },
  },
  {
    id: 'paper',
    name: 'Paper',
    emoji: '📝',
    tagline: 'Ink on paper, serif titles, pencil scratches and a satisfying stamp.',
    sound: 'paper',
    particles: { shapes: ['line', 'dot'], colors: ['#2b2b2b', '#7a5c3a', '#b38b59'], count: 7, spread: 18 },
    confetti: ['#2b2b2b', '#7a5c3a', '#b38b59', '#e0c9a6', '#c0392b'],
    flourish: 'ink',
    vars: { '--radius': '4px', '--radius-sm': '3px', '--font-weight-title': '700', '--accent': '#c0392b', '--font': 'Georgia, "Times New Roman", serif' },
    darkVars: {
      '--bg': '#1c1a17',
      '--bg-elev': '#24211d',
      '--bg-elev-2': '#2e2a25',
      '--bg-hover': '#38332d',
      '--border': '#3a352e',
      '--border-strong': '#54493d',
      '--text': '#efe6d6',
      '--text-muted': '#b5a992',
    },
    lightVars: {
      '--bg': '#f7f2e8',
      '--bg-elev': '#fffdf8',
      '--bg-elev-2': '#f0e9da',
      '--bg-hover': '#e8dfcb',
      '--border': '#e1d7c2',
      '--border-strong': '#c9bb9d',
      '--text': '#2b2620',
      '--text-muted': '#6b5f4e',
    },
  },
];

export function themeById(id: ThemePack): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Apply a theme pack's CSS variables to the root; `dark` says which palette is active. Accent override wins when the pack has no fixed accent. */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors. */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Text color for buttons filled with the accent: white when it reads well, near-black otherwise. */
export function accentContrast(accent: string): string {
  if (!/^#[0-9a-f]{3,8}$/i.test(accent)) return '#ffffff';
  return contrastRatio('#ffffff', accent) >= 4.5 || contrastRatio('#ffffff', accent) >= contrastRatio('#111111', accent) ? '#ffffff' : '#111111';
}

export function applyThemePack(id: ThemePack, dark: boolean, accent: string): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const t = themeById(id);
  const all = new Set<string>();
  for (const th of THEMES) {
    Object.keys(th.vars).forEach((k) => all.add(k));
    Object.keys(th.darkVars ?? {}).forEach((k) => all.add(k));
    Object.keys(th.lightVars ?? {}).forEach((k) => all.add(k));
  }
  for (const k of all) root.style.removeProperty(k);
  const vars = { ...t.vars, ...(dark ? t.darkVars : t.lightVars) };
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.dataset.pack = id;
  // accent: pack accent unless the user picked a custom accent on a pack without a fixed one
  const finalAccent = !vars['--accent'] || id === 'classic' ? accent : vars['--accent'];
  root.style.setProperty('--accent', finalAccent);
  root.style.setProperty('--accent-contrast', accentContrast(finalAccent));
}
