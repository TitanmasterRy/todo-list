import { afterEach, describe, expect, it, vi } from 'vitest';
import { FrameSplitter, HttpStream, INPUT_PROBE_MS, INPUT_RETRY_AFTER_MS, INPUT_STALL_MS, MAX_IN_FLIGHT, coalesce, supportsRequestStreams } from './http';
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

  /** A stream with streamed input: the lines the gateway would read from /input, and the POSTs to /up. */
  function streamed() {
    let clock = 0;
    vi.stubGlobal('performance', { now: () => clock });
    const lines: string[] = [];
    const posts: string[][] = [];
    let signal: AbortSignal | null = null;
    const net = pipe();
    const s = new HttpStream({
      downUrl: 'https://gw.example/sessions/x/down',
      ticket: 't',
      canvas: fakeCanvas(),
      postInput: async (msgs) => void posts.push(msgs),
      openInput: (body, sig) => {
        signal = sig;
        void (async () => {
          const r = body.getReader();
          let rest = '';
          for (;;) {
            const { done, value } = await r.read().catch(() => ({ done: true, value: undefined }));
            if (done) return;
            rest += new TextDecoder().decode(value);
            const parts = rest.split('\n');
            rest = parts.pop()!;
            lines.push(...parts);
          }
        })();
        return new Promise<Response>((_, reject) => sig.addEventListener('abort', () => reject(new Error('aborted'))));
      },
      onState: () => {},
      fetchImpl: (async () => net.response) as unknown as typeof fetch,
    });
    const notice = (m: unknown) => net.push(frame(1, [...new TextEncoder().encode(JSON.stringify(m))]));
    const flush = async (ms = 0) => {
      clock += ms;
      await vi.advanceTimersByTimeAsync(ms);
    };
    return { s, lines, posts, notice, flush, aborted: () => !!signal?.aborted, types: () => lines.map((l) => JSON.parse(l).type) };
  }

  it('moves input to the streamed request once the gateway confirms it, and measures the delay through the PC', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    setup();
    const { s, posts, notice, flush, types } = streamed();
    s.start();
    await flush();
    expect(types()).toEqual(['gw-hello']);
    // unconfirmed: input still goes on POSTs
    s.send({ type: 'keydown', keyCode: 65 });
    await flush();
    expect(posts).toHaveLength(1);
    expect((await s.stats()).input).toBe('post');

    notice({ type: 'gw-input-ok' });
    await flush(10);
    s.send({ type: 'keyup', keyCode: 65 });
    await flush(10);
    expect(types()).toEqual(['gw-hello', 'keyup']);
    expect(posts).toHaveLength(1);
    expect((await s.stats()).input).toBe('stream');

    // a burst of mouse movement within one write gap is folded into one line
    s.send({ type: 'mousemove', dx: 1, dy: 0 });
    s.send({ type: 'mousemove', dx: 2, dy: 0 });
    s.send({ type: 'mousemove', dx: 3, dy: 0 });
    await flush(10);
    expect(types().filter((x) => x === 'mousemove')).toHaveLength(2);

    // the once-a-second ping comes back on /down: that round trip is the delay shown
    await flush(1000);
    expect(types()).toContain('ping');
    notice({ type: 'pong', ts: 1030 - 45 });
    await flush(0);
    expect((await s.stats()).rttMs).toBe(45);
    s.close();
    vi.useRealTimers();
  });

  it('stays on POSTs when the gateway never confirms the streamed input (HTTP/1.1, or a proxy that holds it)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    setup();
    const { s, posts, flush, aborted } = streamed();
    s.start();
    await flush();
    await flush(INPUT_PROBE_MS + 10);
    expect(aborted()).toBe(true);
    const before = posts.length;
    s.send({ type: 'keydown', keyCode: 65 });
    await flush();
    expect(posts.length).toBe(before + 1);
    expect((await s.stats()).input).toBe('post');
    s.close();
    vi.useRealTimers();
  });

  it('goes back to POSTs when streamed input stops getting answers', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    setup();
    const { s, posts, notice, flush, aborted } = streamed();
    s.start();
    await flush();
    notice({ type: 'gw-input-ok' });
    await flush(10);
    expect((await s.stats()).input).toBe('stream');
    // pings go out on the stream, but no pong comes back
    for (let k = 0; k < 5; k++) await flush(1000);
    expect(INPUT_STALL_MS).toBeLessThan(5000);
    expect(aborted()).toBe(true);
    const before = posts.length;
    s.send({ type: 'keyup', keyCode: 65 });
    await flush();
    expect(posts.length).toBe(before + 1);
    s.close();
    vi.useRealTimers();
  });

  it('opens streamed input again when one that had been working is cut, but not one that never got going', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    setup();
    const { s, notice, flush, types } = streamed();
    s.start();
    await flush();
    notice({ type: 'gw-input-ok' });
    await flush();
    // a good while of play, the PC answering every ping
    for (let k = 0; k < INPUT_RETRY_AFTER_MS / 1000 + 1; k++) {
      await flush(1000);
      notice({ type: 'pong', ts: 0 });
      await flush();
    }
    // then the pongs stop (a proxy cut the request): back to POSTs, and a fresh /input a moment later
    for (let k = 0; k < 5; k++) await flush(1000);
    expect((await s.stats()).input).toBe('post');
    expect(types().filter((x) => x === 'gw-hello')).toHaveLength(2);
    // this one is never confirmed: it's given up on and not tried again
    for (let k = 0; k < 20; k++) await flush(1000);
    expect(types().filter((x) => x === 'gw-hello')).toHaveLength(2);
    s.close();
    vi.useRealTimers();
  });

  it('tells the gateway to skip ahead when its clock shows the picture falling behind', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    setup();
    const { s, posts, notice, flush } = streamed();
    s.start();
    await flush();
    notice({ type: 'gw-clock', t: 0 }); // arrives at 0: the baseline
    await flush();
    await flush(500);
    notice({ type: 'gw-clock', t: 100 }); // arrives at 500: 400 ms behind
    await flush();
    await flush(400);
    notice({ type: 'gw-clock', t: 200 }); // arrives at 900: 700 ms behind, for long enough
    await flush();
    const lag = posts
      .flat()
      .map((l) => JSON.parse(l))
      .find((m) => m.type === 'gw-lag');
    expect(lag).toEqual({ type: 'gw-lag', ms: 700 });
    expect((await s.stats()).behindMs).toBe(700);
    s.close();
    vi.useRealTimers();
  });
});

describe('supportsRequestStreams', () => {
  it('detects a fetch that can stream a request body', () => {
    // Node's fetch can, like Chromium's
    expect(supportsRequestStreams()).toBe(true);
    const Real = globalThis.Request;
    // a browser that turns the stream into text gives it a Content-Type and never asks for duplex
    vi.stubGlobal(
      'Request',
      class {
        headers = new Headers({ 'Content-Type': 'text/plain;charset=UTF-8' });
      },
    );
    expect(supportsRequestStreams()).toBe(false);
    vi.stubGlobal('Request', Real);
    vi.unstubAllGlobals();
  });
});
