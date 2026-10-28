import { describe, expect, it } from 'vitest';
import { parseFrame } from './fallback';

const bytes = (...b: number[]) => new Uint8Array(b);

describe('WebSocket stream frames', () => {
  it('splits channel, keyframe flag and payload', () => {
    expect(parseFrame(bytes(1, 1, 0, 0, 1, 0x65).buffer)).toEqual({ kind: 'video', key: true, data: bytes(0, 0, 1, 0x65) });
    expect(parseFrame(bytes(1, 0, 9).buffer)).toMatchObject({ kind: 'video', key: false });
    expect(parseFrame(bytes(2, 0, 0xfc, 0xff).buffer)).toEqual({ kind: 'audio', data: bytes(0xfc, 0xff) });
    expect(parseFrame(bytes(3, 0, 0).buffer)).toBeNull();
    expect(parseFrame(bytes(1).buffer)).toBeNull();
  });
});
