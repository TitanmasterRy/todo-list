import { afterEach, describe, expect, it, vi } from 'vitest';
import { FrameSplitter, HttpStream, MAX_IN_FLIGHT, coalesce } from './http';
import type { InputMessage } from './input';

describe('coalesce', () => {
  it('sums a run of relative mouse moves into one', () => {
    const msgs: InputMessage[] = [
      { type: 'mousemove', dx: 3, dy: -1 },
      { type: 'mousemove', dx: 2, dy: 4 },
      { type: 'mousemove', dx: -1, dy: 0 },
    ];
    expect(coalesce(msgs)).toEqual([{ type: 'mousemove', dx: 4, dy: 3 }]);
  });

  it('keeps clicks in order relative to the moves around them', () => {
    const msgs: InputMessage[] = [
      { type: 'mousemove', dx: 1, dy: 1 },
      { type: 'mousemove', dx: 1, dy: 1 },
      { type: 'mousedown', button: 1 },
      { type: 'mousemove', dx: 5, dy: 0 },
    ];
    expect(coalesce(msgs)).toEqual([
      { type: 'mousemove', dx: 2, dy: 2 },
      { type: 'mousedown', button: 1 },
      { type: 'mousemove', dx: 5, dy: 0 },
    ]);
  });

  it('collapses repeated absolute moves and held-key heartbeats to the latest', () => {
    const msgs: InputMessage[] = [
      { type: 'mousemove', x: 10, y: 10, referenceWidth: 1920, referenceHeight: 1080 },
      { type: 'mousemove', x: 20, y: 30, referenceWidth: 1920, referenceHeight: 1080 },
      { type: 'inputstate', keys: [], buttons: 0 },
      { type: 'inputstate', keys: [{ type: 'keydown', keyCode: 65 }], buttons: 0 },
    ];
    expect(coalesce(msgs)).toEqual([
      { type: 'mousemove', x: 20, y: 30, referenceWidth: 1920, referenceHeight: 1080 },
      { type: 'inputstate', keys: [{ type: 'keydown', keyCode: 65 }], buttons: 0 },
    ]);
  });

  it('leaves key presses untouched and in order', () => {
    const msgs: InputMessage[] = [
      { type: 'keydown', keyCode: 65 },
      { type: 'keyup', keyCode: 65 },
      { type: 'keydown', keyCode: 66 },
    ];
    expect(coalesce(msgs)).toEqual(msgs);
  });
});

describe('FrameSplitter', () => {
  const bytes = (b: ArrayBuffer) => [...new Uint8Array(b)];

  it('reassembles frames split across many reads, and several frames in one read', () => {
    const f = new FrameSplitter();
    const a = frame(0, [1, 2, 3, 4, 5, 6, 7, 8]);
    for (const b of a) f.push(Uint8Array.of(b)); // one byte per read
    const one = f.next()!;
    expect(one.kind).toBe(0);
    expect(bytes(one.payload)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(f.next()).toBeNull();

    const both = new Uint8Array([...frame(1, [9]), ...frame(0, [10, 11])]);
    f.push(both.subarray(0, 3));
    expect(f.next()).toBeNull();
    f.push(both.subarray(3));
    expect(bytes(f.next()!.payload)).toEqual([9]);
    expect(bytes(f.next()!.payload)).toEqual([10, 11]);
    expect(f.next()).toBeNull();
  });

  it('refuses a length no real frame has', () => {
    const f = new FrameSplitter();
    f.push(Uint8Array.of(0, 0xff, 0xff, 0xff, 0xff));
    expect(() => f.next()).toThrow();
  });
});

// A stand-in for the browser bits the transport touches: a canvas (just needs getContext), WebCodecs and
// AudioContext. The test drives the downstream reader and the input POSTs directly.
class FakeVideoDecoder {
  state = 'unconfigured';
  configure() {
    this.state = 'configured';
  }
  decode() {}
  close() {
    this.state = 'closed';
  }
}

function fakeCanvas(): HTMLCanvasElement {
  return { width: 0, height: 0, getContext: () => ({ drawImage() {} }) } as unknown as HTMLCanvasElement;
}

/** A controllable ReadableStream of bytes, plus the Response that wraps it. */
function pipe() {
  let controller: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start: (c) => (controller = c) });
  return {
    response: { ok: true, status: 200, body: stream } as unknown as Response,
    push: (b: Uint8Array) => controller.enqueue(b),
    end: () => controller.close(),
  };
}

function frame(kind: number, payload: number[]): Uint8Array {
  const out = new Uint8Array(5 + payload.length);
  out[0] = kind;
  new DataView(out.buffer).setUint32(1, payload.length);
  out.set(payload, 5);
  return out;
}

describe('HttpStream', () => {
  afterEach(() => vi.unstubAllGlobals());

  function setup() {
    vi.stubGlobal('VideoDecoder', FakeVideoDecoder);
    vi.stubGlobal('EncodedVideoChunk', class {});
    vi.stubGlobal(
      'AudioContext',
      class {
        state = 'running';
        close() {}
        resume() {}
        createGain() {
          return { gain: { value: 1 }, connect() {} };
        }
      },
    );
    vi.stubGlobal('AudioDecoder', class {});
    vi.stubGlobal('performance', { now: () => 0 });
  }

  it('splits the length-prefixed stream into frames, even across chunk boundaries', async () => {
    setup();
    const seen: { key: boolean; len: number }[] = [];
    const net = pipe();
    const s = new HttpStream({
      downUrl: 'https://gw.example/sessions/x/down',
      ticket: 't',
      canvas: fakeCanvas(),
      postInput: async () => {},
      onState: () => {},
      fetchImpl: (async () => net.response) as unknown as typeof fetch,
    });
    // reach into the video sink so we don't need a real decoder pipeline
    (s as unknown as { video: Record<string, unknown> }).video = {
      push: (au: Uint8Array, key: boolean) => seen.push({ key, len: au.length }),
      count: () => {},
      close: () => {},
      rates: () => ({ fps: 0, kbps: 0, width: 0, height: 0 }),
    };
    s.start();
    await Promise.resolve();

    // one keyframe access unit (SPS/… elided): MW media frame is [0x01 video][flags=1 key][AU bytes]
    const au = [0, 0, 0, 1, 0x67, 0x42];
    const f = frame(0, [1, 1, ...au]);
    // deliver it split down the middle, to exercise the reassembly buffer
    net.push(f.subarray(0, 4));
    await new Promise((r) => setTimeout(r, 0));
    net.push(f.subarray(4));
    await new Promise((r) => setTimeout(r, 0));

    expect(seen).toEqual([{ key: true, len: au.length }]);
    s.close();
  });

  it('keeps a few numbered POSTs in flight and folds the rest into the next one', async () => {
    setup();
    const posts: { msgs: string[]; seq: number }[] = [];
    const gates: (() => void)[] = [];
    const net = pipe();
    const s = new HttpStream({
      downUrl: 'https://gw.example/sessions/x/down',
      ticket: 't',
      canvas: fakeCanvas(),
      postInput: (msgs, seq) => {
        posts.push({ msgs, seq });
        return new Promise<void>((r) => gates.push(r)); // every POST stays open until released
      },
      onState: () => {},
      fetchImpl: (async () => net.response) as unknown as typeof fetch,
    });
    s.start();

    // each of the first MAX_IN_FLIGHT messages leaves at once, without waiting for the one before
    for (let k = 0; k < MAX_IN_FLIGHT; k++) s.send({ type: 'keydown', keyCode: 65 + k });
    // more input queues while every slot is taken
    s.send({ type: 'keyup', keyCode: 65 });
    s.send({ type: 'keyup', keyCode: 66 });
    await Promise.resolve();
    expect(posts.map((p) => p.seq)).toEqual([1, 2, 3].slice(0, MAX_IN_FLIGHT));
    expect(posts.every((p) => p.msgs.length === 1)).toBe(true);

    gates[0](); // a slot frees up
    await new Promise((r) => setTimeout(r, 0));
    expect(posts).toHaveLength(MAX_IN_FLIGHT + 1);
    // the next POST carried both messages that queued, in order, with the next number
    expect(posts[MAX_IN_FLIGHT]).toEqual({
      seq: MAX_IN_FLIGHT + 1,
      msgs: [JSON.stringify({ type: 'keyup', keyCode: 65 }), JSON.stringify({ type: 'keyup', keyCode: 66 })],
    });
    for (const g of gates) g();
    s.close();
  });
});
