// A short vibration on phones that support it, off with the Vibration setting. Desktop browsers have no motor
// and simply ignore the call.
import { store } from './store.svelte';

export type Buzz = 'tap' | 'arm' | 'swipe' | 'done' | 'ring' | 'levelup';
const PATTERNS: Record<Buzz, number | number[]> = {
  tap: 6,
  arm: 8,
  swipe: 18,
  done: 12,
  ring: [20, 40, 20],
  levelup: [30, 40, 60],
};

export function buzz(kind: Buzz | number = 'tap'): void {
  if (store.settings.haptics === false) return;
  try {
    navigator.vibrate?.(typeof kind === 'number' ? kind : PATTERNS[kind]);
  } catch {
    /* not allowed in this context */
  }
}
