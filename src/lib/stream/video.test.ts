import { afterAll, describe, expect, it } from 'vitest';
import { CHUNK_HEADER, Reassembler, VideoSink, avcCodec, nalUnits, parseChunk, type Chunk } from './video';

const bytes = (...b: number[]) => new Uint8Array(b);

/** A video DataChannel message as MoonlightWeb's FrameSender writes it. */
function message(frameId: number, index: number, total: number, key: boolean, payload: number[]): ArrayBuffer {
  const buf = new ArrayBuffer(CHUNK_HEADER + payload.length);
  const v = new DataView(buf);
  v.setUint32(0, frameId);
  v.setUint16(4, index);
  v.setUint16(6, total);
  v.setUint8(8, key ? 1 : 0);
  v.setUint32(9, payload.length);
  v.setUint32(13, 123456);
  new Uint8Array(buf, CHUNK_HEADER).set(payload);
  return buf;
}
const chunk = (...a: Parameters<typeof message>) => parseChunk(message(...a)) as Chunk;

describe('H.264 access units', () => {
  it('finds NAL units after 3- and 4-byte start codes', () => {
    const au = bytes(0, 0, 0, 1, 0x67, 0x64, 0x00, 0x2a, 0, 0, 1, 0x68, 0xee, 0, 0, 0, 1, 0x65, 0x88);
    expect(nalUnits(au)).toEqual([bytes(0x67, 0x64, 0x00, 0x2a), bytes(0x68, 0xee), bytes(0x65, 0x88)]);
  });

  it('reads the codec string from the SPS', () => {
    expect(avcCodec(bytes(0, 0, 0, 1, 0x67, 0x64, 0x00, 0x33, 0xac, 0, 0, 1, 0x65))).toBe('avc1.640033');
    expect(avcCodec(bytes(0, 0, 1, 0x41, 0x9a))).toBeNull();
  });
});

describe('video DataChannel chunks', () => {
  it('parses the 17-byte header', () => {
    expect(parseChunk(message(7, 1, 3, true, [9, 8]))).toEqual({ frameId: 7, index: 1, total: 3, key: true, data: bytes(9, 8) });
  });

  it('rejects malformed messages', () => {
    expect(parseChunk(new ArrayBuffer(10))).toBeNull();
    expect(parseChunk(message(1, 3, 3, false, [1]))).toBeNull();
    expect(parseChunk(message(1, 0, 0, false, [1]))).toBeNull();
    const short = message(1, 0, 1, false, [1, 2]);
    new DataView(short).setUint32(9, 5);
    expect(parseChunk(short)).toBeNull();
  });

  it('reassembles a frame from its chunks', () => {
    const r = new Reassembler();
    expect(r.push(chunk(10, 0, 3, true, [1, 2]))).toEqual({ lost: false });
    expect(r.push(chunk(10, 1, 3, true, [3]))).toEqual({ lost: false });
    expect(r.push(chunk(10, 2, 3, true, [4, 5]))).toEqual({ frame: { key: true, data: bytes(1, 2, 3, 4, 5) }, lost: false });
    expect(r.push(chunk(11, 0, 1, false, [6]))).toEqual({ frame: { key: false, data: bytes(6) }, lost: false });
  });

  it('reports a frame that never completed', () => {
    const r = new Reassembler();
    r.push(chunk(1, 0, 2, false, [1]));
    // chunk 1 of frame 1 was dropped by the channel
    expect(r.push(chunk(2, 0, 1, false, [2]))).toEqual({ frame: { key: false, data: bytes(2) }, lost: true });
  });

  it('reports a frame that went missing whole', () => {
    const r = new Reassembler();
    r.push(chunk(1, 0, 1, false, [1]));
    expect(r.push(chunk(3, 0, 1, false, [3])).lost).toBe(true);
    expect(r.push(chunk(4, 0, 1, false, [4])).lost).toBe(false);
  });

  it('ignores late leftovers and duplicates, and survives the id wrapping', () => {
    const r = new Reassembler();
    r.push(chunk(5, 0, 2, false, [1]));
    expect(r.push(chunk(4, 0, 1, false, [9]))).toEqual({ lost: false });
    expect(r.push(chunk(5, 0, 2, false, [1]))).toEqual({ lost: false });
    expect(r.push(chunk(5, 1, 2, false, [2])).frame?.data).toEqual(bytes(1, 2));
    const w = new Reassembler();
    w.push(chunk(0xffffffff, 0, 1, false, [1]));
    expect(w.push(chunk(0, 0, 1, true, [2]))).toEqual({ frame: { key: true, data: bytes(2) }, lost: false });
  });
});

describe('VideoSink', () => {
  // a stand-in for WebCodecs (node has none): records configure/decode/close and lets the test fill the queue
  class FakeDecoder {
    static all: FakeDecoder[] = [];
    state = 'unconfigured';
    decodeQueueSize = 0;
    config: VideoDecoderConfig | null = null;
    decoded: string[] = [];
    closed = false;
    constructor(readonly init: VideoDecoderInit) {
      FakeDecoder.all.push(this);
    }
    configure(c: VideoDecoderConfig) {
      this.config = c;
      this.state = 'configured';
    }
    decode(c: { type: string }) {
      this.decoded.push(c.type);
    }
    close() {
      this.closed = true;
      this.state = 'closed';
    }
  }
  const g = globalThis as Record<string, unknown>;
  afterAll(() => {
    delete g.VideoDecoder;
    delete g.EncodedVideoChunk;
  });
  const KEY = bytes(0, 0, 0, 1, 0x67, 0x42, 0xc0, 0x1e, 0, 0, 0, 1, 0x65, 0x88);
  const DELTA = bytes(0, 0, 0, 1, 0x41, 0x9a);

  function sink() {
    FakeDecoder.all = [];
    g.VideoDecoder = FakeDecoder;
    g.EncodedVideoChunk = class {
      constructor(readonly init: { type: string }) {
        Object.assign(this, init);
      }
    };
    let asks = 0;
    const canvas = { getContext: () => null, width: 0, height: 0 } as unknown as HTMLCanvasElement;
    const s = new VideoSink(canvas, () => asks++);
    return { s, asks: () => asks };
  }

  it('waits for a keyframe, configures from its SPS, and never requires hardware decoding', () => {
    const { s, asks } = sink();
    s.push(DELTA, false);
    expect(FakeDecoder.all).toHaveLength(0);
    expect(asks()).toBe(1);
    s.push(KEY, true);
    s.push(DELTA, false);
    const d = FakeDecoder.all[0];
    expect(d.config).toMatchObject({ codec: 'avc1.42c01e', optimizeForLatency: true, hardwareAcceleration: 'no-preference' });
    expect(d.decoded).toEqual(['key', 'delta']);
  });

  it('skips deltas after a gap or a backlog but keeps the decoder, so queued frames still show', () => {
    const { s } = sink();
    s.push(KEY, true);
    const d = FakeDecoder.all[0];
    s.lost();
    s.push(DELTA, false);
    expect(d.decoded).toEqual(['key']);
    expect(d.closed).toBe(false);
    s.push(KEY, true);
    d.decodeQueueSize = 5;
    s.push(DELTA, false);
    expect(d.decoded).toEqual(['key', 'key']);
    expect(d.closed).toBe(false);
    expect(FakeDecoder.all).toHaveLength(1);
  });

  it('starts a new decoder after a decoder error', () => {
    const { s } = sink();
    s.push(KEY, true);
    FakeDecoder.all[0].init.error(new DOMException('boom'));
    expect(FakeDecoder.all[0].closed).toBe(true);
    s.push(KEY, true);
    expect(FakeDecoder.all).toHaveLength(2);
  });
});
