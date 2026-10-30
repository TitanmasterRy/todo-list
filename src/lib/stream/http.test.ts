import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpStream } from './http';

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

  it('pipelines input: one POST in flight, the next carries everything queued while it was out', async () => {
    setup();
    const batches: string[][] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const net = pipe();
    const s = new HttpStream({
      downUrl: 'https://gw.example/sessions/x/down',
      ticket: 't',
      canvas: fakeCanvas(),
      postInput: async (msgs) => {
        batches.push(msgs);
        if (batches.length === 1) await gate; // hold the first POST open
      },
      onState: () => {},
      fetchImpl: (async () => net.response) as unknown as typeof fetch,
    });
    s.start();

    s.send({ type: 'keydown', keyCode: 65 }); // starts the first POST
    s.send({ type: 'keydown', keyCode: 66 }); // queued while the first is in flight
    s.send({ type: 'keyup', keyCode: 65 }); // also queued
    await Promise.resolve();
    expect(batches.length).toBe(1);
    expect(batches[0]).toHaveLength(1);

    release(); // first POST returns
    await new Promise((r) => setTimeout(r, 0));
    expect(batches.length).toBe(2);
    // the second POST carried both messages that queued during the first
    expect(batches[1]).toHaveLength(2);
    s.close();
  });
});
