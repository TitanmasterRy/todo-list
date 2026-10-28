import { describe, expect, it } from 'vitest';
import { PAD, PadTracker, WheelAccumulator, absolutePosition, keyMessage, mouseButton, padState, padType, vkFor } from './input';

const key = (code: string, mods: Partial<{ shiftKey: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean }> = {}) => ({
  code,
  shiftKey: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  ...mods,
});
const pad = (pressed: number[] = [], axes = [0, 0, 0, 0], index = 0, id = 'Xbox Controller') => ({
  index,
  id,
  axes,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })),
});

describe('keyboard', () => {
  it('maps physical keys to Windows virtual-key codes', () => {
    expect(vkFor('KeyA')).toBe(0x41);
    expect(vkFor('KeyZ')).toBe(0x5a);
    expect(vkFor('Digit0')).toBe(0x30);
    expect(vkFor('Numpad7')).toBe(0x67);
    expect(vkFor('F1')).toBe(0x70);
    expect(vkFor('F24')).toBe(0x87);
    expect(vkFor('F25')).toBe(0);
    expect(vkFor('ShiftLeft')).toBe(0xa0);
    expect(vkFor('Escape')).toBe(0x1b);
    expect(vkFor('Semicolon')).toBe(0xba);
    expect(vkFor('Fn')).toBe(0);
  });

  it('builds keydown/keyup messages with modifiers', () => {
    expect(keyMessage(true, key('KeyW', { shiftKey: true }))).toEqual({
      type: 'keydown',
      keyCode: 0x57,
      code: 'KeyW',
      shiftKey: true,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
    });
    expect(keyMessage(false, key('Space'))?.type).toBe('keyup');
    expect(keyMessage(true, key('Unidentified'))).toBeNull();
  });
});

describe('mouse', () => {
  it('numbers buttons the GameStream way', () => {
    expect([0, 1, 2, 3, 4, 5].map(mouseButton)).toEqual([1, 2, 3, 4, 5, 0]);
  });

  it('turns wheel deltas into whole 120ths with up positive, carrying the rest', () => {
    const w = new WheelAccumulator();
    expect(w.push(0, 100, 0)).toEqual([{ type: 'mousewheel', delta: -120 }]);
    expect(w.push(0, -3, 1)).toEqual([{ type: 'mousewheel', delta: 120 }]);
    // a trackpad's small steps add up instead of vanishing
    expect(w.push(0, 0.5, 0)).toEqual([]);
    expect(w.push(0, 0.5, 0)).toEqual([{ type: 'mousewheel', delta: -1 }]);
    expect(w.push(50, 0, 0)).toEqual([{ type: 'mousehwheel', delta: 60 }]);
  });

  it('maps a pointer to stream pixels, ignoring the letterbox', () => {
    const box = { left: 0, top: 0, width: 1000, height: 1000 };
    const stream = { width: 2000, height: 1000 };
    expect(absolutePosition(500, 500, box, stream)).toEqual({ x: 1000, y: 500 });
    expect(absolutePosition(0, 250, box, stream)).toEqual({ x: 0, y: 0 });
    expect(absolutePosition(500, 100, box, stream)).toBeNull();
  });
});

describe('gamepads', () => {
  it('maps the standard layout to GameStream flags, sticks up positive', () => {
    const s = padState(pad([0, 3, 12, 16, 9], [1, -1, -0.5, 0.5]));
    expect(s.buttons).toBe(PAD.A | PAD.Y | PAD.UP | PAD.HOME | PAD.START);
    expect(s).toMatchObject({ lx: 32767, ly: 32767, rx: -16383, ry: -16384, lt: 0, rt: 0 });
    const t = pad([7]);
    t.buttons[6] = { pressed: false, value: 0.5 };
    expect(padState(t)).toMatchObject({ lt: 128, rt: 255 });
  });

  it('guesses the controller family', () => {
    expect(padType('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)')).toBe(2);
    expect(padType('Pro Controller (Vendor: 057e)')).toBe(3);
    expect(padType('Xbox 360 Controller (XInput STANDARD GAMEPAD)')).toBe(1);
  });

  it('announces pads, sends only changes (plus a heartbeat) and removals', () => {
    const t = new PadTracker();
    expect(t.poll([pad()], 0).map((m) => m.type)).toEqual(['gamepadconnect', 'gamepad']);
    expect(t.poll([pad()], 100)).toEqual([]);
    expect(t.poll([pad([0])], 200)).toEqual([{ type: 'gamepad', index: 0, mask: 1, buttons: PAD.A, lt: 0, rt: 0, lx: 0, ly: 0, rx: 0, ry: 0 }]);
    expect(t.poll([pad([0])], 800)).toHaveLength(1);
    expect(t.poll([pad([0]), pad([], undefined, 1)], 900).map((m) => [m.type, m.mask])).toEqual([
      ['gamepadconnect', 3],
      ['gamepad', 3],
    ]);
    expect(t.poll([null, pad([], undefined, 1)], 950)).toEqual([{ type: 'gamepaddisconnect', index: 0, mask: 2 }]);
    expect(t.releaseAll()).toEqual([{ type: 'gamepad', index: 1, mask: 0, buttons: 0, lt: 0, rt: 0, lx: 0, ly: 0, rx: 0, ry: 0 }]);
  });
});
