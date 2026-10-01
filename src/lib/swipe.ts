// Swipe a task row on a touch screen: right to complete, left to snooze to tomorrow. A small vibration marks the point
// where letting go will act. Mouse and pen are left alone (they have the checkbox and the snooze button).
import type { Action } from 'svelte/action';
import { buzz } from './haptics';

export type SwipeDir = 'right' | 'left';

/** How far (px) a swipe has to go to act: 35% of the row, between 64 and 120 px. */
export function swipeThreshold(width: number): number {
  return Math.max(64, Math.min(120, width * 0.35));
}

/** What letting go at dx does. */
export function swipeDecision(dx: number, width: number): SwipeDir | null {
  const t = swipeThreshold(width);
  return dx >= t ? 'right' : dx <= -t ? 'left' : null;
}

/** Resistance past the threshold so the row doesn't fly off. */
export function swipeOffset(dx: number, width: number): number {
  const t = swipeThreshold(width);
  const a = Math.abs(dx);
  const out = a <= t ? a : t + (a - t) * 0.35;
  return Math.sign(dx) * Math.min(out, width * 0.6);
}

interface SwipeOpts {
  enabled: boolean;
  onswipe: (dir: SwipeDir) => void;
}

/** use:swipe={{ enabled, onswipe }}. Sets --swipe-x and data-swipe="right|left" on the node while dragging. */
export const swipe: Action<HTMLElement, SwipeOpts> = (node, initial) => {
  let opts = initial;
  let id: number | null = null;
  let x0 = 0;
  let y0 = 0;
  let dx = 0;
  let locked: 'h' | 'v' | null = null;
  let armed: SwipeDir | null = null;

  function reset() {
    id = null;
    locked = null;
    armed = null;
    dx = 0;
    node.style.removeProperty('--swipe-x');
    delete node.dataset.swipe;
    delete node.dataset.swipeArmed;
  }

  function down(e: PointerEvent) {
    if (!opts.enabled || e.pointerType !== 'touch' || id !== null) return;
    if ((e.target as HTMLElement).closest('input, textarea, select, .handle, .actions')) return;
    id = e.pointerId;
    x0 = e.clientX;
    y0 = e.clientY;
  }

  function move(e: PointerEvent) {
    if (e.pointerId !== id) return;
    const mx = e.clientX - x0;
    const my = e.clientY - y0;
    if (!locked) {
      if (Math.abs(mx) < 10 && Math.abs(my) < 10) return;
      locked = Math.abs(mx) > Math.abs(my) * 1.3 ? 'h' : 'v';
      if (locked === 'v') return;
      try {
        node.setPointerCapture?.(e.pointerId);
      } catch {
        /* the pointer already ended */
      }
    }
    if (locked !== 'h') return;
    dx = mx;
    const w = node.offsetWidth || 320;
    node.style.setProperty('--swipe-x', `${swipeOffset(dx, w)}px`);
    node.dataset.swipe = dx > 0 ? 'right' : 'left';
    const d = swipeDecision(dx, w);
    if (d !== armed) {
      armed = d;
      if (d) buzz('arm');
      if (d) node.dataset.swipeArmed = '';
      else delete node.dataset.swipeArmed;
    }
  }

  function up(e: PointerEvent) {
    if (e.pointerId !== id) return;
    const wasH = locked === 'h';
    const d = wasH ? swipeDecision(dx, node.offsetWidth || 320) : null;
    reset();
    if (wasH) {
      // the release after a sideways drag isn't a tap on the row
      const stop = (ev: Event) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      node.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(() => node.removeEventListener('click', stop, { capture: true }), 350);
    }
    if (d) {
      buzz('swipe');
      opts.onswipe(d);
    }
  }

  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', reset);
  return {
    update(next) {
      opts = next;
    },
    destroy() {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', reset);
    },
  };
};
