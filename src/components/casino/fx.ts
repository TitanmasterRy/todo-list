// Casino motion helpers: reduced-motion checks, waits that shrink with it, and chips flying between the
// balance counter and the betting spots. Everything here is decorative: game logic never waits on an animation
// frame, only on timers (which keep running when the game is closed mid-round, so payouts always land).
import { store } from '../../lib/store.svelte';
import { artUrl } from '../../lib/art.svelte';
import { breakdown, chipArt, chipSvg } from './chips';
import { sfx } from './sfx';

/** Motion is reduced by the app setting or by the OS (unless the app was told motion is fine). */
export function reduced(): boolean {
  if (store.settings.reducedMotion) return true;
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('motion-ok')) return false;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Wait `ms` (a short beat with reduced motion, so the order of events still reads). */
export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, reduced() ? Math.min(ms, 60) : ms));
}

/** Motion duration: `ms`, or 0 with reduced motion. */
export function dur(ms: number): number {
  return reduced() ? 0 : ms;
}

function center(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function chipNode(v: number, size: number): HTMLElement {
  const d = document.createElement('div');
  d.className = 'cz-flychip';
  d.style.width = d.style.height = `${size}px`;
  const art = chipArt(v);
  const url = artUrl(art.name);
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    if (art.tint) img.className = 'cz-tint10';
    d.append(img);
  } else d.innerHTML = chipSvg(v);
  return d;
}

function visible(el: Element | null | undefined): el is Element {
  if (!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 || r.height > 0;
}

/** Fly chips worth `amount` from one element to another (arcing, staggered). */
export function flyChips(from: Element | null | undefined, to: Element | null | undefined, amount: number, o: { size?: number; max?: number } = {}): void {
  if (amount <= 0 || reduced() || !visible(from) || !visible(to) || typeof document.body.animate !== 'function') return;
  const a = center(from);
  const b = center(to);
  const size = o.size ?? 30;
  const chips = breakdown(amount, o.max ?? 5).reverse();
  const lift = Math.min(120, 40 + Math.hypot(b.x - a.x, b.y - a.y) * 0.25);
  chips.forEach((v, i) => {
    const n = chipNode(v, size);
    n.style.left = `${a.x - size / 2}px`;
    n.style.top = `${a.y - size / 2}px`;
    document.body.append(n);
    const dx = b.x - a.x;
    const dy = b.y - a.y - i * 3;
    const spin = (Math.random() - 0.5) * 360;
    const anim = n.animate(
      [
        { transform: 'translate(0,0) scale(.9) rotate(0deg)', opacity: 0 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - lift}px) scale(1.15) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${dx}px, ${dy}px) scale(1) rotate(${spin}deg)`, opacity: 1, offset: 0.92 },
        { transform: `translate(${dx}px, ${dy}px) scale(.96) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration: 520 + i * 25, delay: i * 70, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'both' },
    );
    setTimeout(() => sfx('chip'), i * 70 + 480);
    anim.onfinish = () => n.remove();
    anim.oncancel = () => n.remove();
  });
}

const balance = () => document.querySelector('[data-chip-balance]');

/** Chips from your balance to a betting spot. */
export function chipsIn(spot: Element | null | undefined, amount: number): void {
  flyChips(balance(), spot, amount);
}

/** Chips from a betting spot (or the dealer's tray) back to your balance. */
export function chipsOut(spot: Element | null | undefined, amount: number): void {
  flyChips(spot, balance(), amount, { max: 7 });
}

/** A short shake of an element (big wins, the mine going off). */
export function shake(el: Element | null | undefined, strength = 6): void {
  if (!el || reduced() || typeof (el as HTMLElement).animate !== 'function') return;
  const s = strength;
  (el as HTMLElement).animate(
    [
      { transform: 'translate(0,0)' },
      { transform: `translate(${-s}px, ${s / 2}px) rotate(-.4deg)` },
      { transform: `translate(${s}px, ${-s / 2}px) rotate(.4deg)` },
      { transform: `translate(${-s / 2}px, ${-s / 3}px)` },
      { transform: `translate(${s / 3}px, ${s / 3}px)` },
      { transform: 'translate(0,0)' },
    ],
    { duration: 420, easing: 'ease-out' },
  );
}
