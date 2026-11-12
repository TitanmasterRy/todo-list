// The HTTP transport for networks that block WebSockets and the TURN relay but still pass ordinary HTTPS (see the
// gateway's /down, /input and /up in server/stream-gateway/API.md). Video and audio come down one long chunked
// response, each MoonlightWeb frame length-prefixed `[kind:1][len:4][payload]` (kind 0 binary media, 1 text notice).
// Input goes back on one long streamed request (/input) where the browser and the network allow it: a key press is
// then a few bytes on a connection that's already open. Otherwise it goes on POSTs (/up), a few in flight at once and
// numbered so the gateway applies them in order, since waiting for each reply would add a whole round trip.
import type { InputMessage } from './input';
import type { MessageKey } from '../i18n/index.svelte';
import { OpusPlayer } from './audio';
import { parseFrame } from './fallback';
import { LagMeter } from './lag';
import { ENDINGS, type StreamState, type StreamStats } from './rtc';
import { VideoSink } from './video';

export interface HttpStreamOptions {
  /** the gateway's https URL for the session's /down path */
  downUrl: string;
  ticket: string;
  canvas: HTMLCanvasElement;
  /** POST a batch of input messages, numbered from 1, to the session's /up; resolves when it's answered, or rejects */
  postInput: (msgs: string[], seq: number) => Promise<void>;
  /** open the session's streamed /input request with this body; settles only when the request ends */
  openInput?: (body: ReadableStream<Uint8Array>, signal: AbortSignal) => Promise<Response>;
  onState: (s: StreamState, why?: MessageKey) => void;
  /** scheduling lead for the Opus player, ms (shorter = lower latency) */
  audioLeadMs?: number;
  /** backlog (ms) at which the gateway is asked to skip ahead */
  lagThresholdMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Whether fetch can stream a request body (Chromium 105+; Firefox and Safari can't yet). A browser that can't would
 * turn the stream into the text "[object ReadableStream]" and give it a Content-Type, and never asks for `duplex`.
 */
export function supportsRequestStreams(): boolean {
  try {
    let duplex = false;
    const init = {
      method: 'POST',
      body: new ReadableStream(),
      get duplex() {
        duplex = true;
        return 'half';
      },
    };
    return !new Request('https://example.invalid/', init as RequestInit).headers.has('Content-Type') && duplex;
  } catch {
    return false;
  }
}

/**
 * Fold a backlog that built up while a POST was in flight: a run of relative mouse moves becomes one summed move,
 * repeated absolute moves and held-key heartbeats collapse to the latest. Under lag this sends the current state
 * rather than replaying a long history, so the pointer tracks instead of catching up in jumps. Order is kept
 * otherwise, so a click still lands relative to the moves around it.
 */
export function coalesce(msgs: InputMessage[]): InputMessage[] {
  const out: InputMessage[] = [];
  for (const m of msgs) {
    const last = out[out.length - 1];
    if (m.type === 'mousemove' && last?.type === 'mousemove' && 'dx' in m && 'dx' in last) {
      out[out.length - 1] = { type: 'mousemove', dx: (last.dx as number) + (m.dx as number), dy: (last.dy as number) + (m.dy as number) };
      continue;
    }
    if (m.type === 'mousemove' && last?.type === 'mousemove' && 'x' in m && 'x' in last) {
      out[out.length - 1] = m; // absolute: only the latest position matters
      continue;
    }
    if (m.type === 'inputstate' && last?.type === 'inputstate') {
      out[out.length - 1] = m; // a heartbeat is a full snapshot; keep the newest
      continue;
    }
    out.push(m);
  }
  return out;
}

/** POSTs allowed in flight at once; more input waits and is folded into the next batch. */
export const MAX_IN_FLIGHT = 3;
/** how long the gateway has to confirm the streamed input got through before it's given up on */
export const INPUT_PROBE_MS = 3_000;
/** no pong for this long while streaming input: something on the way is holding it, so go back to POSTs */
export const INPUT_STALL_MS = 3_000;
/** a streamed input that worked at least this long (ms) and was then cut is opened again; one that never got going isn't */
export const INPUT_RETRY_AFTER_MS = 10_000;
/** writes to the input stream are at least this far apart (ms); a 1000 Hz mouse is folded into fewer, larger writes */
const WRITE_GAP_MS = 4;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
/** a length past this means the stream is corrupt (a 4K keyframe is a few MB) */
const MAX_FRAME = 16 * 1024 * 1024;

/**
 * Splits the /down byte stream into frames. Chunks are kept as they arrive and each payload is copied out once, so
 * a big keyframe spread over a hundred reads costs one copy instead of a hundred growing ones, which used to stall
 * the page enough to slow the download itself.
 */
export class FrameSplitter {
  private chunks: Uint8Array[] = [];
  /** bytes of chunks[0] already taken */
  private head = 0;
  private size = 0;

  push(b: Uint8Array): void {
    if (!b.length) return;
    this.chunks.push(b);
    this.size += b.length;
  }

  /** The next whole frame, or null until more bytes arrive. Throws on a length that can't be right. */
  next(): { kind: number; payload: ArrayBuffer } | null {
    if (this.size < 5) return null;
    const len = ((this.byteAt(1) << 24) | (this.byteAt(2) << 16) | (this.byteAt(3) << 8) | this.byteAt(4)) >>> 0;
    if (len > MAX_FRAME) throw new RangeError('bad frame length');
    if (this.size < 5 + len) return null;
    const kind = this.byteAt(0);
    this.take(5);
    return { kind, payload: this.take(len) };
  }

  private byteAt(i: number): number {
    let j = this.head + i;
    for (const c of this.chunks) {
      if (j < c.length) return c[j];
      j -= c.length;
    }
    return 0;
  }

  private take(n: number): ArrayBuffer {
    const out = new Uint8Array(n);
    for (let at = 0; at < n;) {
      const c = this.chunks[0];
      const k = Math.min(n - at, c.length - this.head);
      out.set(c.subarray(this.head, this.head + k), at);
      at += k;
      this.head += k;
      if (this.head === c.length) {
        this.chunks.shift();
        this.head = 0;
      }
    }
    this.size -= n;
    return out.buffer;
  }
}

export class HttpStream {
  private video: VideoSink;
  private audio: OpusPlayer;
  private lag: LagMeter;
  private state: StreamState = 'connecting';
  private ctrl = new AbortController();
  private queue: InputMessage[] = [];
  private inFlight = 0;
  private seq = 0;
  /** round trip of the last POST, ms (the fallback figure when no pong has come back) */
  private postRtt: number | null = null;
  /** round trip of the last ping through the PC and back down /down, ms: the delay a key press really sees */
  private pingRtt: number | null = null;
  private pingSeq = 0;
  private lastPong = 0;
  private idle: ReturnType<typeof setInterval> | null = null;
  /** 'post': input on /up; 'probing': /input is open but unconfirmed, input still on /up; 'stream': input on /input */
  private input: 'post' | 'probing' | 'stream' = 'post';
  private inputCtrl: AbortController | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private streamingSince = 0;
  private lastWrite = -Infinity;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private probeTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private o: HttpStreamOptions) {
    this.audio = new OpusPlayer(o.audioLeadMs);
    this.lag = new LagMeter((ms) => this.send({ type: 'gw-lag', ms }), o.lagThresholdMs);
    this.video = new VideoSink(
      o.canvas,
      () => this.send({ type: 'requestidr' }),
      () => this.set('connected'),
    );
  }

  start(): void {
    const f = this.o.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
    f(this.o.downUrl, { headers: { Authorization: `Bearer ${this.o.ticket}` }, cache: 'no-store', credentials: 'omit', signal: this.ctrl.signal })
      .then((r) => {
        if (!r.ok || !r.body) return this.set('failed', r.status === 401 ? 'stream.fail.refused' : 'stream.fail.setup');
        // the gateway confirms streamed input on /down, so it's tried once /down is open
        this.openInput();
        return this.read(r.body.getReader());
      })
      .catch(() => this.set('failed', 'stream.fail.setup'));
    // a ping a second measures the real delay and keeps the input path warm, so a gateway-side end is noticed too
    this.idle = setInterval(() => this.tick(), 1000);
  }

  private tick(): void {
    const now = performance.now();
    if (this.input === 'stream' && now - Math.max(this.lastPong, this.streamingSince) > INPUT_STALL_MS) this.inputFailed();
    this.send({ type: 'ping', seq: ++this.pingSeq, ts: now }, false);
  }

  private openInput(): void {
    if (!this.o.openInput || !supportsRequestStreams() || this.state === 'ended' || this.state === 'failed') return;
    const pipe = new TransformStream<Uint8Array, Uint8Array>();
    this.inputCtrl = new AbortController();
    this.writer = pipe.writable.getWriter();
    this.input = 'probing';
    this.o.openInput(pipe.readable, this.inputCtrl.signal).then(
      () => this.inputFailed(), // the gateway ended it (a newer one replaced it, or the stream is over)
      () => this.inputFailed(), // HTTP/1.1 to the gateway, a refusal, or a network that won't carry it
    );
    this.writer.write(encoder.encode('{"type":"gw-hello"}\n')).catch(() => this.inputFailed());
    this.probeTimer = setTimeout(() => this.input === 'probing' && this.inputFailed(), INPUT_PROBE_MS);
  }

  /**
   * The streamed input stopped, or never got through: input goes on POSTs. One that worked for a while and was then
   * cut (a proxy's cap on body size, a network change) is opened again; one that never got going isn't.
   */
  private inputFailed(): void {
    if (this.input === 'post') return;
    const lasted = this.input === 'stream' ? performance.now() - this.streamingSince : 0;
    this.input = 'post';
    this.writer = null;
    this.inputCtrl?.abort();
    this.inputCtrl = null;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    if (this.probeTimer) clearTimeout(this.probeTimer);
    this.flushTimer = this.probeTimer = null;
    // held keys and buttons were in what may have been lost; the heartbeat repeats them on the new path
    this.pump();
    if (lasted >= INPUT_RETRY_AFTER_MS && this.state !== 'ended' && this.state !== 'failed') this.retryTimer = setTimeout(() => this.openInput(), 1000);
  }

  private async read(reader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>>): Promise<void> {
    const frames = new FrameSplitter();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return void this.set('ended', 'stream.end.ended');
      frames.push(value);
      try {
        for (let f = frames.next(); f; f = frames.next()) this.frame(f.kind, f.payload);
      } catch {
        return void this.set('failed', 'stream.fail.setup');
      }
    }
  }

  private frame(kind: number, payload: ArrayBuffer): void {
    if (kind === 0) {
      const f = parseFrame(payload);
      if (!f) return;
      if (f.kind === 'audio') return this.audio.push(f.data);
      this.video.count(payload.byteLength);
      this.video.push(f.data, f.key);
      return;
    }
    try {
      const m = JSON.parse(decoder.decode(payload)) as { type?: string; t?: number; ts?: number };
      const t = m.type ?? '';
      if (t === 'gw-clock' && typeof m.t === 'number') this.lag.sample(m.t);
      else if (t === 'pong' && typeof m.ts === 'number') {
        this.lastPong = performance.now();
        this.pingRtt = Math.round(this.lastPong - m.ts);
      } else if (t === 'gw-input-ok' && this.input === 'probing') {
        this.input = 'stream';
        this.streamingSince = performance.now();
        if (this.probeTimer) clearTimeout(this.probeTimer);
        this.probeTimer = null;
        this.flush();
      } else if (t in ENDINGS) this.set('ended', ENDINGS[t]);
    } catch {
      /* not for us */
    }
  }

  private set(s: StreamState, why?: MessageKey): void {
    if (this.state === s || this.state === 'ended' || this.state === 'failed') return;
    this.state = s;
    this.o.onState(s, why);
  }

  /** `user` is false for the transport's own messages, which aren't a gesture that may start the sound. */
  send(m: InputMessage, user = true): void {
    if (user) this.audio.resume();
    this.queue.push(m);
    if (this.input === 'stream') this.flush();
    else this.pump();
  }

  setVolume(volume: number, muted: boolean): void {
    this.audio.setVolume(volume, muted);
  }

  /** Write what's queued to /input, unless the last write was a moment ago or the network is still taking it. */
  private flush(): void {
    const w = this.writer;
    if (!w || this.flushTimer || !this.queue.length) return;
    const wait = this.lastWrite + WRITE_GAP_MS - performance.now();
    if (wait > 0 || (w.desiredSize !== null && w.desiredSize <= 0)) {
      this.flushTimer = setTimeout(
        () => {
          this.flushTimer = null;
          this.flush();
        },
        Math.max(wait, WRITE_GAP_MS),
      );
      return;
    }
    this.lastWrite = performance.now();
    const text = coalesce(this.queue.splice(0))
      .map((m) => JSON.stringify(m) + '\n')
      .join('');
    w.write(encoder.encode(text)).catch(() => this.inputFailed());
  }

  private pump(): void {
    if (this.queue.length && this.inFlight < MAX_IN_FLIGHT) void this.post(coalesce(this.queue.splice(0)).map((m) => JSON.stringify(m)));
  }

  private async post(batch: string[]): Promise<void> {
    this.inFlight++;
    const t0 = performance.now();
    try {
      await this.o.postInput(batch, ++this.seq);
      this.postRtt = Math.round(performance.now() - t0);
    } catch {
      /* a dropped batch is fine; the next one carries fresh input, and the downstream reports a real end */
    } finally {
      this.inFlight--;
      if (this.input === 'stream') this.flush();
      else this.pump();
    }
  }

  /** The stream keeps falling behind however often it skips ahead: a lower bitrate would play better. */
  congested(): boolean {
    return this.lag.congested();
  }

  async stats(): Promise<StreamStats> {
    return { path: 'http', rttMs: this.pingRtt ?? this.postRtt, lost: 0, behindMs: this.lag.behind, input: this.input === 'stream' ? 'stream' : 'post', ...this.video.rates() };
  }

  close(): void {
    this.state = 'ended';
    if (this.idle) clearInterval(this.idle);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.queue = [];
    this.inputFailed();
    try {
      this.ctrl.abort();
    } catch {
      /* already aborted */
    }
    this.video.close();
    this.audio.close();
  }
}
