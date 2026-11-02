// The HTTP transport for networks that block WebSockets and the TURN relay but still pass ordinary HTTPS (see the
// gateway's /down and /up in server/stream-gateway/API.md). Video and audio come down one long chunked response,
// each MoonlightWeb frame length-prefixed `[kind:1][len:4][payload]` (kind 0 binary media, 1 text notice); input
// goes back on POSTs. It's the slowest path — a POST is one round trip — so input is pipelined: the next POST
// leaves the instant the last returns, carrying whatever queued, which pins the lag to about one round trip.
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
  /** POST a batch of input messages to the session's /up; resolves with the round-trip ms, or rejects */
  postInput: (msgs: string[]) => Promise<void>;
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

export class HttpStream {
  private video: VideoSink;
  private audio: OpusPlayer;
  private state: StreamState = 'connecting';
  private ctrl = new AbortController();
  private queue: InputMessage[] = [];
  private inFlight = false;
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
    this.idle = setInterval(() => this.queue.length === 0 && !this.inFlight && this.pump(), 1000);
  }

  private async read(reader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>>): Promise<void> {
    let buf = new Uint8Array(0);
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return void this.set('ended', 'stream.end.ended');
      buf = concat(buf, value);
      // peel off every complete [kind][len][payload] frame the buffer now holds
      for (;;) {
        if (buf.length < 5) break;
        const len = (buf[1] << 24) | (buf[2] << 16) | (buf[3] << 8) | buf[4];
        if (len < 0 || len > 16 * 1024 * 1024) return void this.set('failed', 'stream.fail.setup');
        if (buf.length < 5 + len) break;
        this.frame(buf[0], buf.subarray(5, 5 + len));
        buf = buf.subarray(5 + len);
      }
    }
  }

  private frame(kind: number, payload: Uint8Array): void {
    if (kind === 0) {
      const ab = new ArrayBuffer(payload.length);
      new Uint8Array(ab).set(payload);
      const f = parseFrame(ab);
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
    void this.pump();
  }

  setVolume(volume: number, muted: boolean): void {
    this.audio.setVolume(volume, muted);
  }

  private async pump(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    const batch = coalesce(this.queue.splice(0)).map((m) => JSON.stringify(m));
    const t0 = performance.now();
    try {
      await this.o.postInput(batch);
      this.rtt = Math.round(performance.now() - t0);
    } catch {
      /* a dropped batch is fine; the next one carries fresh input, and the downstream reports a real end */
    } finally {
      this.inFlight = false;
      if (this.queue.length) void this.pump();
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

function concat(a: Uint8Array, b: Uint8Array<ArrayBufferLike>): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
