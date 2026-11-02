// The HTTP transport for networks that block WebSockets and the TURN relay but still pass ordinary HTTPS (see the
// gateway's /down and /up in server/stream-gateway/API.md). Video and audio come down one long chunked response,
// each MoonlightWeb frame length-prefixed `[kind:1][len:4][payload]` (kind 0 binary media, 1 text notice); input
// goes back on POSTs. It's the slowest path, so input doesn't wait its turn behind one POST at a time: a few are in
// flight at once, numbered so the gateway applies them in order. Waiting for each reply used to add a whole round
// trip, and on HTTP/2 that reply queues behind the video coming down the same connection.
import type { InputMessage } from './input';
import type { MessageKey } from '../i18n/index.svelte';
import { OpusPlayer } from './audio';
import { parseFrame } from './fallback';
import { ENDINGS, type StreamState, type StreamStats } from './rtc';
import { VideoSink } from './video';

export interface HttpStreamOptions {
  /** the gateway's https URL for the session's /down path */
  downUrl: string;
  ticket: string;
  canvas: HTMLCanvasElement;
  /** POST a batch of input messages, numbered from 1, to the session's /up; resolves when it's answered, or rejects */
  postInput: (msgs: string[], seq: number) => Promise<void>;
  onState: (s: StreamState, why?: MessageKey) => void;
  /** scheduling lead for the Opus player, ms (shorter = lower latency) */
  audioLeadMs?: number;
  fetchImpl?: typeof fetch;
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
  private state: StreamState = 'connecting';
  private ctrl = new AbortController();
  private queue: InputMessage[] = [];
  private inFlight = 0;
  private seq = 0;
  private rtt: number | null = null;
  private idle: ReturnType<typeof setInterval> | null = null;

  constructor(private o: HttpStreamOptions) {
    this.audio = new OpusPlayer(o.audioLeadMs);
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
        return this.read(r.body.getReader());
      })
      .catch(() => this.set('failed', 'stream.fail.setup'));
    // a quiet keepalive so RTT stays fresh and a gateway-side end is noticed even when no keys are down
    this.idle = setInterval(() => this.queue.length === 0 && !this.inFlight && void this.post([]), 1000);
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
      const t = (JSON.parse(new TextDecoder().decode(payload)) as { type?: string }).type ?? '';
      if (t in ENDINGS) this.set('ended', ENDINGS[t]);
    } catch {
      /* not for us */
    }
  }

  private set(s: StreamState, why?: MessageKey): void {
    if (this.state === s || this.state === 'ended' || this.state === 'failed') return;
    this.state = s;
    this.o.onState(s, why);
  }

  send(m: InputMessage): void {
    this.audio.resume();
    this.queue.push(m);
    this.pump();
  }

  setVolume(volume: number, muted: boolean): void {
    this.audio.setVolume(volume, muted);
  }

  private pump(): void {
    if (this.queue.length && this.inFlight < MAX_IN_FLIGHT) void this.post(coalesce(this.queue.splice(0)).map((m) => JSON.stringify(m)));
  }

  private async post(batch: string[]): Promise<void> {
    this.inFlight++;
    const t0 = performance.now();
    try {
      await this.o.postInput(batch, ++this.seq);
      this.rtt = Math.round(performance.now() - t0);
    } catch {
      /* a dropped batch is fine; the next one carries fresh input, and the downstream reports a real end */
    } finally {
      this.inFlight--;
      this.pump();
    }
  }

  async stats(): Promise<StreamStats> {
    return { path: 'http', rttMs: this.rtt, lost: 0, ...this.video.rates() };
  }

  close(): void {
    this.state = 'ended';
    if (this.idle) clearInterval(this.idle);
    try {
      this.ctrl.abort();
    } catch {
      /* already aborted */
    }
    this.video.close();
    this.audio.close();
  }
}
