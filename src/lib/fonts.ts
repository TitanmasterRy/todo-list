// Reading fonts. Each one is bundled (so it works offline) and only downloaded when picked.
export type FontChoice = 'system' | 'atkinson' | 'lexend' | 'dyslexic';

export const FONTS: { id: FontChoice; label: string; hint: string; stack: string; load?: () => Promise<unknown> }[] = [
  { id: 'system', label: 'System', hint: 'Your device’s default font', stack: '' },
  {
    id: 'atkinson',
    label: 'Atkinson Hyperlegible',
    hint: 'Designed for low vision: letters that are hard to confuse',
    stack: "'Atkinson Hyperlegible', system-ui, sans-serif",
    load: () => Promise.all([import('@fontsource/atkinson-hyperlegible/400.css'), import('@fontsource/atkinson-hyperlegible/700.css')]),
  },
  {
    id: 'lexend',
    label: 'Lexend',
    hint: 'Wide, even spacing that can make reading faster',
    stack: "'Lexend', system-ui, sans-serif",
    load: () => Promise.all([import('@fontsource/lexend/400.css'), import('@fontsource/lexend/600.css')]),
  },
  {
    id: 'dyslexic',
    label: 'OpenDyslexic',
    hint: 'Weighted letter bottoms to help with dyslexia',
    stack: "'OpenDyslexic', system-ui, sans-serif",
    load: () => Promise.all([import('@fontsource/opendyslexic/400.css'), import('@fontsource/opendyslexic/700.css')]),
  },
];

const loaded = new Set<FontChoice>();

/** Set the app font (loading its files the first time). */
export async function applyFont(choice: FontChoice): Promise<void> {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const font = FONTS.find((f) => f.id === choice);
  if (!font || !font.stack) {
    root.style.removeProperty('--font');
    return;
  }
  if (font.load && !loaded.has(choice)) {
    await font.load();
    loaded.add(choice);
  }
  root.style.setProperty('--font', font.stack);
}
