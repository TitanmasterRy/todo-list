// The WebSocket transport for networks where only port 443 gets out (MoonlightWeb's `wss` mode, piped through the
// gateway). Frames are `[0x01][flags][H.264 Annex-B access unit]` (flags bit 0 = keyframe) and
// `[0x02][0x00][Opus packet]`; the browser decodes both with WebCodecs. It's TCP, so it lags more than WebRTC: the
// decoder drops to the next keyframe rather than fall behind, and audio keeps a small buffer.
import type { InputMessage } from './input';
import type { MessageKey } from '../i18n/index.svelte';
import { ENDINGS, type StreamState, type StreamStats } from './rtc';

export type WsFrame = { kind: 'video'; key: boolean; data: Uint8Array } | { kind: 'audio'; data: Uint8Array };

export function parseFrame(buf: ArrayBuffer): WsFrame | null {
  if (buf.byteLength < 3) return null;
  const b = new Uint8Array(buf);
  if (b[0] === 1) return { kind: 'video', key: (b[1] & 1) === 1, data: b.subarray(2) };
  if (b[0] === 2) return { kind: 'audio', data: b.subarray(2) };
  return null;
}

/** The NAL units of an Annex-B access unit (start codes removed). */
export function nalUnits(au: Uint8Array): Uint8Array[] {
  const starts: [number, number][] = [];
  for (let i = 0; i + 2 < au.length; i++) {
    if (au[i] === 0 && au[i + 1] === 0 && au[i + 2] === 1) {
      starts.push([i, i + 3]);
      i += 2;
    }
  }
  return starts.map(([, from], k) => {
    let to = k + 1 < starts.length ? starts[k + 1][0] : au.length;
    // a 4-byte start code leaves its leading zero on the previous unit
    if (k + 1 < starts.length && to > from && au[to - 1] === 0) to--;
    return au.subarray(from, to);
  });
}

/** `avc1.PPCCLL` from the access unit's SPS, or null when it carries none. */
export function avcCodec(au: Uint8Array): string | null {
  const sps = nalUnits(au).find((n) => (n[0] & 0x1f) === 7);
  if (!sps || sps.length < 4) return null;
  return `avc1.${[sps[1], sps[2], sps[3]].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

export function supportsWsStream(): boolean {
  return typeof VideoDecoder !== 'undefined' && typeof AudioDecoder !== 'undefined' && typeof AudioContext !== 'undefined';
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
  private video: VideoDecoder | null = null;
  private audio: AudioDecoder | null = null;
  private ctx: AudioContext;
  private draw: CanvasRenderingContext2D | null;
  private needKey = true;
  private playAt = 0;
  private state: StreamState = 'connecting';
  private frames = 0;
  private bytes = 0;
  private window = { at: performance.now(), frames: 0, bytes: 0, fps: 0, kbps: 0 };
  private rtt: number | null = null;
  private ping: ReturnType<typeof setInterval> | null = null;

  constructor(private o: WsStreamOptions) {
    // made while the click that started the stream still counts as a user gesture, so sound is allowed
    this.ctx = new AudioContext({ sampleRate: 48_000, latencyHint: 'interactive' });
    this.draw = o.canvas.getContext('2d', { alpha: false, desynchronized: true });
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
    this.ping = setInterval(() => this.send({ type: 'ping', seq: this.frames, ts: performance.now() }), 2_000);
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
    this.bytes += buf.byteLength;
    if (f.kind === 'audio') return this.decodeAudio(f.data);
    if (this.needKey && !f.key) return;
    if (!this.video || this.video.state !== 'configured') {
      const codec = f.key ? avcCodec(f.data) : null;
      if (!codec) return;
      this.video?.close();
      this.video = new VideoDecoder({ output: (frame) => this.show(frame), error: () => this.resetVideo() });
      this.video.configure({ codec, optimizeForLatency: true, hardwareAcceleration: 'prefer-hardware' });
    }
    // behind by more than a few frames: skip to the next keyframe instead of drifting further back
    if (!f.key && this.video.decodeQueueSize > 4) return this.resetVideo();
    this.needKey = false;
    this.video.decode(new EncodedVideoChunk({ type: f.key ? 'key' : 'delta', timestamp: Math.round(performance.now() * 1000), data: f.data }));
  }

  private resetVideo(): void {
    this.needKey = true;
    try {
      this.video?.close();
    } catch {
      /* already closed */
    }
    this.video = null;
    this.send({ type: 'requestidr' });
  }

  private show(frame: VideoFrame): void {
    const c = this.o.canvas;
    if (c.width !== frame.displayWidth || c.height !== frame.displayHeight) {
      c.width = frame.displayWidth;
      c.height = frame.displayHeight;
    }
    this.draw?.drawImage(frame, 0, 0);
    frame.close();
    this.frames++;
    this.set('connected');
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
    const w = this.window;
    const now = performance.now();
    if (now - w.at >= 900) {
      w.fps = Math.round(((this.frames - w.frames) * 1000) / (now - w.at));
      w.kbps = Math.round(((this.bytes - w.bytes) * 8) / (now - w.at));
      Object.assign(w, { at: now, frames: this.frames, bytes: this.bytes });
    }
    return { path: 'ws', rttMs: this.rtt, fps: w.fps, kbps: w.kbps, width: this.o.canvas.width, height: this.o.canvas.height, packetsLost: 0, jitterMs: null };
  }

  close(): void {
    this.state = 'ended';
    if (this.ping) clearInterval(this.ping);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close(1000);
    }
    for (const d of [this.video, this.audio]) {
      try {
        d?.close();
      } catch {
        /* already closed */
      }
    }
    void this.ctx.close();
  }
}
