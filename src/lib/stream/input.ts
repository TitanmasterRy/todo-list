// Keyboard, mouse and gamepad input for Play → Stream, encoded as MoonlightWeb's JSON input messages (see
// DECISIONS.md → Stream). Keys go by physical position (KeyboardEvent.code → Windows virtual-key code), so games see
// real keys on any keyboard layout. The pure encoders are exported for tests; InputCapture wires them to the page.

export type InputMessage = Record<string, unknown> & { type: string };

const VK: Record<string, number> = {
  Escape: 0x1b,
  Tab: 0x09,
  Backspace: 0x08,
  Enter: 0x0d,
  Space: 0x20,
  CapsLock: 0x14,
  ShiftLeft: 0xa0,
  ShiftRight: 0xa1,
  ControlLeft: 0xa2,
  ControlRight: 0xa3,
  AltLeft: 0xa4,
  AltRight: 0xa5,
  MetaLeft: 0x5b,
  MetaRight: 0x5c,
  ContextMenu: 0x5d,
  ArrowLeft: 0x25,
  ArrowUp: 0x26,
  ArrowRight: 0x27,
  ArrowDown: 0x28,
  Insert: 0x2d,
  Delete: 0x2e,
  Home: 0x24,
  End: 0x23,
  PageUp: 0x21,
  PageDown: 0x22,
  PrintScreen: 0x2c,
  ScrollLock: 0x91,
  Pause: 0x13,
  NumLock: 0x90,
  NumpadMultiply: 0x6a,
  NumpadAdd: 0x6b,
  NumpadSubtract: 0x6d,
  NumpadDecimal: 0x6e,
  NumpadDivide: 0x6f,
  NumpadEnter: 0x0d,
  Semicolon: 0xba,
  Equal: 0xbb,
  Comma: 0xbc,
  Minus: 0xbd,
  Period: 0xbe,
  Slash: 0xbf,
  Backquote: 0xc0,
  BracketLeft: 0xdb,
  Backslash: 0xdc,
  BracketRight: 0xdd,
  Quote: 0xde,
  IntlBackslash: 0xe2,
  IntlRo: 0xc1,
  AudioVolumeMute: 0xad,
  AudioVolumeDown: 0xae,
  AudioVolumeUp: 0xaf,
  MediaTrackNext: 0xb0,
  MediaTrackPrevious: 0xb1,
  MediaStop: 0xb2,
  MediaPlayPause: 0xb3,
};

/** The Windows virtual-key code for a KeyboardEvent.code, or 0 when there's none. */
export function vkFor(code: string): number {
  if (code in VK) return VK[code];
  let m = /^Key([A-Z])$/.exec(code);
  if (m) return m[1].charCodeAt(0);
  m = /^Digit(\d)$/.exec(code);
  if (m) return 0x30 + Number(m[1]);
  m = /^Numpad(\d)$/.exec(code);
  if (m) return 0x60 + Number(m[1]);
  m = /^F(\d{1,2})$/.exec(code);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 24) return 0x6f + Number(m[1]);
  return 0;
}

interface KeyLike {
  code: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

export function keyMessage(down: boolean, e: KeyLike): InputMessage | null {
  const keyCode = vkFor(e.code);
  if (!keyCode) return null;
  return { type: down ? 'keydown' : 'keyup', keyCode, code: e.code, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey };
}

/** DOM MouseEvent.button → GameStream button (1 left, 2 middle, 3 right, 4 back, 5 forward), or 0. */
export function mouseButton(button: number): number {
  return [1, 2, 3, 4, 5][button] ?? 0;
}

/**
 * Turns wheel events into whole 120ths of a notch (positive = up/right, like Windows), keeping the fraction for the
 * next event, since MoonlightWeb reads the amount as an integer.
 */
export class WheelAccumulator {
  private carry = { x: 0, y: 0 };

  push(deltaX: number, deltaY: number, deltaMode: number): InputMessage[] {
    // pixels: about 100 per notch in Chromium and Firefox; lines: 3 per notch; pages: one notch each
    const scale = deltaMode === 1 ? 40 : deltaMode === 2 ? 120 : 1.2;
    const out: InputMessage[] = [];
    for (const axis of ['y', 'x'] as const) {
      const raw = -(axis === 'y' ? deltaY : deltaX) * scale + this.carry[axis];
      const whole = Math.trunc(Math.max(-32768, Math.min(32767, raw)));
      this.carry[axis] = raw - whole;
      if (whole) out.push({ type: axis === 'y' ? 'mousewheel' : 'mousehwheel', delta: axis === 'y' ? whole : -whole });
    }
    return out;
  }
}

// GameStream controller button flags
export const PAD = {
  UP: 0x0001,
  DOWN: 0x0002,
  LEFT: 0x0004,
  RIGHT: 0x0008,
  START: 0x0010,
  BACK: 0x0020,
  LS: 0x0040,
  RS: 0x0080,
  LB: 0x0100,
  RB: 0x0200,
  HOME: 0x0400,
  A: 0x1000,
  B: 0x2000,
  X: 0x4000,
  Y: 0x8000,
} as const;

// standard-mapping button index → flag (6 and 7 are the analog triggers)
const PAD_BUTTONS: [number, number][] = [
  [0, PAD.A],
  [1, PAD.B],
  [2, PAD.X],
  [3, PAD.Y],
  [4, PAD.LB],
  [5, PAD.RB],
  [8, PAD.BACK],
  [9, PAD.START],
  [10, PAD.LS],
  [11, PAD.RS],
  [12, PAD.UP],
  [13, PAD.DOWN],
  [14, PAD.LEFT],
  [15, PAD.RIGHT],
  [16, PAD.HOME],
];

export interface PadLike {
  index: number;
  id: string;
  buttons: readonly { pressed: boolean; value: number }[];
  axes: readonly number[];
}

export interface PadState {
  buttons: number;
  lt: number;
  rt: number;
  lx: number;
  ly: number;
  rx: number;
  ry: number;
}

const stick = (v: number | undefined) => Math.max(-32768, Math.min(32767, Math.round((v ?? 0) * 32767)));
const trigger = (b: { pressed: boolean; value: number } | undefined) => (b ? Math.round(Math.max(b.value, b.pressed ? 1 : 0) * 255) : 0);

/** A standard-mapping gamepad as GameStream state (sticks up = positive). */
export function padState(p: PadLike): PadState {
  let buttons = 0;
  for (const [i, flag] of PAD_BUTTONS) if (p.buttons[i]?.pressed) buttons |= flag;
  return { buttons, lt: trigger(p.buttons[6]), rt: trigger(p.buttons[7]), lx: stick(p.axes[0]), ly: 0 - stick(p.axes[1]), rx: stick(p.axes[2]), ry: 0 - stick(p.axes[3]) };
}

/** GameStream controller type: 1 Xbox, 2 PlayStation, 3 Nintendo. */
export function padType(id: string): number {
  const s = id.toLowerCase();
  if (/054c|playstation|dualsense|dualshock/.test(s)) return 2;
  if (/057e|nintendo|pro controller|joy-con/.test(s)) return 3;
  return 1;
}

const samePad = (a: PadState, b: PadState) => a.buttons === b.buttons && a.lt === b.lt && a.rt === b.rt && a.lx === b.lx && a.ly === b.ly && a.rx === b.rx && a.ry === b.ry;

/** Up to four pads → connect / state / disconnect messages, sending a state only when it changed (or every 500 ms). */
export class PadTracker {
  private last = new Map<number, { state: PadState; at: number }>();

  poll(pads: readonly (PadLike | null)[], now: number): InputMessage[] {
    const live = pads.filter((p): p is PadLike => !!p && p.index < 4);
    const mask = live.reduce((m, p) => m | (1 << p.index), 0);
    const out: InputMessage[] = [];
    for (const [index] of this.last) {
      if (!live.some((p) => p.index === index)) {
        this.last.delete(index);
        out.push({ type: 'gamepaddisconnect', index, mask });
      }
    }
    for (const p of live) {
      const state = padState(p);
      const prev = this.last.get(p.index);
      if (!prev) out.push({ type: 'gamepadconnect', index: p.index, mask, ctype: padType(p.id), rumble: false });
      if (!prev || !samePad(prev.state, state) || now - prev.at >= 500) {
        this.last.set(p.index, { state, at: now });
        out.push({ type: 'gamepad', index: p.index, mask, ...state });
      }
    }
    return out;
  }

  /** Release every pad (when the stream loses focus or ends). */
  releaseAll(): InputMessage[] {
    const out: InputMessage[] = [];
    for (const [index] of this.last) out.push({ type: 'gamepad', index, mask: 0, buttons: 0, lt: 0, rt: 0, lx: 0, ly: 0, rx: 0, ry: 0 });
    return out;
  }
}

/** Where a pointer is on the picture, in stream pixels; null when it's on the letterbox bars. */
export function absolutePosition(
  clientX: number,
  clientY: number,
  box: { left: number; top: number; width: number; height: number },
  stream: { width: number; height: number },
): { x: number; y: number } | null {
  if (!stream.width || !stream.height || !box.width || !box.height) return null;
  const scale = Math.min(box.width / stream.width, box.height / stream.height);
  const w = stream.width * scale;
  const h = stream.height * scale;
  const x = (clientX - box.left - (box.width - w) / 2) / scale;
  const y = (clientY - box.top - (box.height - h) / 2) / scale;
  if (x < 0 || y < 0 || x > stream.width || y > stream.height) return null;
  return { x: Math.round(x), y: Math.round(y) };
}

interface CaptureOptions {
  /** the element showing the picture (video or canvas) */
  target: HTMLElement;
  send: (m: InputMessage) => void;
  /** the stream's size in pixels, for absolute mouse positions */
  size: () => { width: number; height: number };
}

/**
 * Listens for input while the stream is open. With Pointer Lock the mouse is relative (games); without it,
 * absolute (the desktop). Held keys are re-announced every 100 ms (MoonlightWeb releases keys that go quiet, so a
 * network stall can't leave one stuck), and everything is released when the page loses focus.
 */
export class InputCapture {
  private held = new Map<string, InputMessage>();
  private buttons = 0;
  private wheel = new WheelAccumulator();
  private pads = new PadTracker();
  private timers: ReturnType<typeof setInterval>[] = [];
  private off: (() => void)[] = [];
  private lockSynced = false;

  constructor(private o: CaptureOptions) {}

  get locked(): boolean {
    return document.pointerLockElement === this.o.target;
  }

  start(): void {
    const t = this.o.target;
    const on = <K extends keyof DocumentEventMap>(el: Document | HTMLElement | Window, type: K | string, fn: (e: Event) => void, opts?: AddEventListenerOptions) => {
      el.addEventListener(type, fn, opts);
      this.off.push(() => el.removeEventListener(type, fn, opts));
    };
    on(document, 'keydown', (e) => this.key(true, e as KeyboardEvent));
    on(document, 'keyup', (e) => this.key(false, e as KeyboardEvent));
    on(t, 'pointerdown', (e) => this.button(true, e as PointerEvent));
    on(document, 'pointerup', (e) => this.button(false, e as PointerEvent));
    on(t, 'contextmenu', (e) => e.preventDefault());
    on(document, 'pointermove', (e) => this.move(e as PointerEvent));
    on(t, 'wheel', (e) => this.scroll(e as WheelEvent), { passive: false });
    on(window, 'blur', () => this.releaseAll());
    on(document, 'visibilitychange', () => document.visibilityState === 'hidden' && this.releaseAll());
    this.timers.push(
      setInterval(() => {
        if (this.held.size || this.buttons) this.o.send({ type: 'inputstate', keys: [...this.held.values()], buttons: this.buttons });
      }, 100),
    );
    // pads have no events: read them often (Chrome samples at 250 Hz), send only changes
    this.timers.push(
      setInterval(() => {
        if (document.visibilityState !== 'visible' || !navigator.getGamepads) return;
        for (const m of this.pads.poll(navigator.getGamepads(), performance.now())) this.o.send(m);
      }, 8),
    );
  }

  stop(): void {
    this.releaseAll();
    for (const t of this.timers) clearInterval(t);
    for (const f of this.off) f();
    this.timers = [];
    this.off = [];
    if (this.locked) document.exitPointerLock();
  }

  private key(down: boolean, e: KeyboardEvent): void {
    // Escape without Keyboard Lock leaves full screen / pointer lock in the browser itself; let it
    if (e.code === 'Escape' && !this.locked && !document.fullscreenElement) return;
    const m = keyMessage(down, e);
    if (!m) return;
    e.preventDefault();
    if (down && !this.lockSynced) {
      this.lockSynced = true;
      this.o.send({ type: 'locksync', numLock: e.getModifierState('NumLock'), capsLock: e.getModifierState('CapsLock'), scrollLock: e.getModifierState('ScrollLock') });
    }
    if (down && e.repeat && this.held.has(e.code)) return;
    if (down) this.held.set(e.code, m);
    else this.held.delete(e.code);
    this.o.send(m);
  }

  private button(down: boolean, e: PointerEvent): void {
    if (e.pointerType !== 'mouse') return;
    const b = mouseButton(e.button);
    if (!b) return;
    if (down) {
      e.preventDefault();
      this.o.target.focus();
      this.buttons |= 1 << (b - 1);
    } else {
      if (!(this.buttons & (1 << (b - 1)))) return;
      this.buttons &= ~(1 << (b - 1));
    }
    this.o.send({ type: down ? 'mousedown' : 'mouseup', button: b });
  }

  private move(e: PointerEvent): void {
    if (e.pointerType !== 'mouse') return;
    if (this.locked) {
      if (e.movementX || e.movementY) this.o.send({ type: 'mousemove', dx: Math.round(e.movementX), dy: Math.round(e.movementY) });
      return;
    }
    if (e.target !== this.o.target && !this.buttons) return;
    const size = this.o.size();
    const p = absolutePosition(e.clientX, e.clientY, this.o.target.getBoundingClientRect(), size);
    if (p) this.o.send({ type: 'mousemove', x: p.x, y: p.y, referenceWidth: size.width, referenceHeight: size.height });
  }

  private scroll(e: WheelEvent): void {
    e.preventDefault();
    for (const m of this.wheel.push(e.deltaX, e.deltaY, e.deltaMode)) this.o.send(m);
  }

  releaseAll(): void {
    for (const m of this.held.values()) this.o.send({ ...m, type: 'keyup' });
    this.held.clear();
    for (let b = 1; b <= 5; b++) if (this.buttons & (1 << (b - 1))) this.o.send({ type: 'mouseup', button: b });
    this.buttons = 0;
    for (const m of this.pads.releaseAll()) this.o.send(m);
    this.pads = new PadTracker();
  }
}
