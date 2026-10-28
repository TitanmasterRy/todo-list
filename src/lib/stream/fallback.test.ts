import { describe, expect, it } from 'vitest';
import { avcCodec, nalUnits, parseFrame } from './fallback';

const bytes = (...b: number[]) => new Uint8Array(b);

describe('WebSocket stream frames', () => {
  it('splits channel, keyframe flag and payload', () => {
    expect(parseFrame(bytes(1, 1, 0, 0, 1, 0x65).buffer)).toEqual({ kind: 'video', key: true, data: bytes(0, 0, 1, 0x65) });
    expect(parseFrame(bytes(1, 0, 9).buffer)).toMatchObject({ kind: 'video', key: false });
    expect(parseFrame(bytes(2, 0, 0xfc, 0xff).buffer)).toEqual({ kind: 'audio', data: bytes(0xfc, 0xff) });
    expect(parseFrame(bytes(3, 0, 0).buffer)).toBeNull();
    expect(parseFrame(bytes(1).buffer)).toBeNull();
  });

  it('finds NAL units after 3- and 4-byte start codes', () => {
    const au = bytes(0, 0, 0, 1, 0x67, 0x64, 0x00, 0x2a, 0, 0, 1, 0x68, 0xee, 0, 0, 0, 1, 0x65, 0x88);
    expect(nalUnits(au)).toEqual([bytes(0x67, 0x64, 0x00, 0x2a), bytes(0x68, 0xee), bytes(0x65, 0x88)]);
  });

  it('reads the codec string from the SPS', () => {
    expect(avcCodec(bytes(0, 0, 0, 1, 0x67, 0x64, 0x00, 0x33, 0xac, 0, 0, 1, 0x65))).toBe('avc1.640033');
    expect(avcCodec(bytes(0, 0, 1, 0x41, 0x9a))).toBeNull();
  });
});
