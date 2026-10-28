// The WebSocket transport for networks where only port 443 gets out (MoonlightWeb's `wss` mode, piped through the
// gateway). Frames are `[0x01][flags][H.264 Annex-B access unit]` (flags bit 0 = keyframe) and
// `[0x02][0x00][Opus packet]`; video goes to the shared VideoSink and audio is decoded with WebCodecs. It's TCP, so
// it lags more than WebRTC: video skips to the next keyframe rather than fall behind, and audio keeps a small buffer.
import type { InputMessage } from './input';
import type { MessageKey } from '../i18n/index.svelte';
import { ENDINGS, type StreamState, type StreamStats } from './rtc';
import { VideoSink } from './video';

export type WsFrame = { kind: 'video'; key: boolean; data: Uint8Array } | { kind: 'audio'; data: Uint8Array };

export function parseFrame(buf: ArrayBuffer): WsFrame | null {
  if (buf.byteLength < 3) return null;
  const b = new Uint8Array(buf);
  if (b[0] === 1) return { kind: 'video', key: (b[1] & 1) === 1, data: b.subarray(2) };
  if (b[0] === 2) return { kind: 'audio', data: b.subarray(2) };
  return null;
}

export interface WsStreamOptions {
  url: string;
  ticket: string;
  canvas: HTMLCanvasElement;
  onState: (s: StreamState, why?: MessageKey) => void;
  WS?: typeof WebSocket;
}

export class WsStream {
  private ws: WebSocket | null = null;
  private video: VideoSink;
  private audio: AudioDecoder | null = null;
  private ctx: AudioContext;
  private playAt = 0;
  private state: StreamState = 'connecting';
  private rtt: number | null = null;
  private seq = 0;
  private ping: ReturnType<typeof setInterval> | null = null;

  constructor(private o: WsStreamOptions) {
    // made while the click that started the stream still counts as a user gesture, so sound is allowed
    this.ctx = new AudioContext({ sampleRate: 48_000, latencyHint: 'interactive' });
    this.video = new VideoSink(
      o.canvas,
      () => this.send({ type: 'requestidr' }),
      () => this.set('connected'),
    );
  }

  start(): void {
    const WS = this.o.WS ?? WebSocket;
    const ws = new WS(this.o.url);
    this.ws = ws;
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', ticket: this.o.ticket }));
    ws.onmessage = (e) => (typeof e.data === 'string' ? this.notice(e.data) : this.frame(e.data as ArrayBuffer));
    ws.onclose = (e) =>
      this.set(this.state === 'connected' ? 'ended' : 'failed', this.state === 'connected' ? 'stream.end.ended' : e.code === 4001 ? 'stream.fail.refused' : 'stream.fail.ws');
    this.ping = setInterval(() => this.send({ type: 'ping', seq: ++this.seq, ts: performance.now() }), 2_000);
  }

  private set(s: StreamState, why?: MessageKey): void {
    if (this.state === s || this.state === 'ended' || this.state === 'failed') return;
    this.state = s;
    this.o.onState(s, why);
  }

  private notice(text: string): void {
    try {
      const m = JSON.parse(text) as { type?: string; ts?: number };
      if (m.type === 'pong' && typeof m.ts === 'number') this.rtt = Math.round(performance.now() - m.ts);
      else if (m.type && m.type in ENDINGS) this.set('ended', ENDINGS[m.type]);
    } catch {
      /* not for us */
    }
  }

  private frame(buf: ArrayBuffer): void {
    const f = parseFrame(buf);
    if (!f) return;
    if (f.kind === 'audio') return this.decodeAudio(f.data);
    this.video.count(buf.byteLength);
    this.video.push(f.data, f.key);
  }

  private decodeAudio(data: Uint8Array): void {
    if (!this.audio) {
      this.audio = new AudioDecoder({ output: (a) => this.play(a), error: () => (this.audio = null) });
      this.audio.configure({ codec: 'opus', sampleRate: 48_000, numberOfChannels: 2 });
    }
    if (this.audio.state === 'configured') this.audio.decode(new EncodedAudioChunk({ type: 'key', timestamp: Math.round(performance.now() * 1000), data }));
  }

  private play(a: AudioData): void {
    const buf = this.ctx.createBuffer(a.numberOfChannels, a.numberOfFrames, a.sampleRate);
    for (let ch = 0; ch < a.numberOfChannels; ch++) {
      const plane = new Float32Array(a.numberOfFrames);
      a.copyTo(plane, { planeIndex: ch, format: 'f32-planar' });
      buf.copyToChannel(plane, ch);
    }
    a.close();
    const now = this.ctx.currentTime;
    // keep about 60 ms queued; if the queue grew past a quarter second (a stall), start over from now
    if (this.playAt < now || this.playAt - now > 0.25) this.playAt = now + 0.06;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    src.start(this.playAt);
    this.playAt += buf.duration;
  }

  send(m: InputMessage): void {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(m));
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  async stats(): Promise<StreamStats> {
    return { path: 'ws', rttMs: this.rtt, lost: 0, ...this.video.rates() };
  }

  close(): void {
    this.state = 'ended';
    if (this.ping) clearInterval(this.ping);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close(1000);
    }
    this.video.close();
    try {
      this.audio?.close();
    } catch {
      /* already closed */
    }
    void this.ctx.close();
  }
}
