// The WebRTC side of Play → Stream (MoonlightWeb's `webrtc-dc-udp` transport): H.264 access units arrive in chunks
// on a pre-negotiated "video" DataChannel and are decoded with WebCodecs onto a canvas, Opus audio is an ordinary
// RTP track played by an <audio> element, and input goes back on the "input" channel. Media only ever goes through
// TURN (iceTransportPolicy "relay"): the PC's ports aren't open to the internet, and the relay is what reaches it.
import { SignalChannel, type SignalMessage } from './signal';
import type { MessageKey } from '../i18n/index.svelte';
import type { InputMessage } from './input';
import { Reassembler, VideoSink, parseChunk } from './video';

export function rtcConfig(iceServers: RTCIceServer[]): RTCConfiguration {
  return { iceServers, iceTransportPolicy: 'relay', bundlePolicy: 'max-bundle' };
}

/** Our answer: receive-only media, and stereo Opus (without stereo=1 the browser decodes mono). */
export function mungeAnswer(sdp: string): string {
  let out = sdp.replace(/a=sendrecv/g, 'a=recvonly');
  const pt = /a=rtpmap:(\d+) opus\/48000/i.exec(out)?.[1];
  if (pt) {
    const fmtp = new RegExp(`^a=fmtp:${pt} (.*)$`, 'm');
    const m = fmtp.exec(out);
    if (m) {
      const params = m[1].split(';').filter((p) => p && !/^(sprop-)?stereo=/.test(p));
      out = out.replace(fmtp, `a=fmtp:${pt} ${[...params, 'stereo=1', 'sprop-stereo=1'].join(';')}`);
    } else {
      out = out.replace(new RegExp(`^(a=rtpmap:${pt} opus/48000[^\\r\\n]*)`, 'mi'), `$1\r\na=fmtp:${pt} stereo=1;sprop-stereo=1`);
    }
  }
  return out;
}

export type StreamPath = 'relay-udp' | 'relay-tcp' | 'relay-tls' | 'direct' | 'ws' | 'http' | 'unknown';

export interface StreamStats {
  path: StreamPath;
  rttMs: number | null;
  fps: number | null;
  kbps: number | null;
  width: number;
  height: number;
  /** video frames lost on the way (each one costs a keyframe request) */
  lost: number;
}

type Stat = Record<string, unknown> & { id: string; type: string };
const n = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);

/** The connection path and round trip from an RTCStatsReport's values (the video numbers come from the decoder). */
export function connectionStats(reports: Iterable<Stat>): { path: StreamPath; rttMs: number | null } {
  const all = [...reports];
  const byId = new Map(all.map((r) => [r.id, r]));
  const transport = all.find((r) => r.type === 'transport' && r.selectedCandidatePairId);
  const pair =
    (transport && byId.get(String(transport.selectedCandidatePairId))) ?? all.find((r) => r.type === 'candidate-pair' && r.state === 'succeeded' && (r.nominated || r.selected));
  const local = pair ? byId.get(String(pair.localCandidateId)) : undefined;
  let path: StreamPath = 'unknown';
  if (local?.candidateType === 'relay') {
    const proto = String(local.relayProtocol ?? local.protocol ?? '');
    path = proto === 'tls' ? 'relay-tls' : proto === 'tcp' ? 'relay-tcp' : 'relay-udp';
  } else if (local) path = 'direct';
  const rtt = n(pair?.currentRoundTripTime);
  return { path, rttMs: rtt === null ? null : Math.round(rtt * 1000) };
}

export type StreamState = 'connecting' | 'connected' | 'failed' | 'ended';

/** What MoonlightWeb says on the input channel when the stream ends from its side. */
export const ENDINGS: Record<string, MessageKey> = {
  'session-ended': 'stream.end.ended',
  'host-ended': 'stream.end.hostEnded',
  'host-lost': 'stream.end.hostLost',
  takeover: 'stream.end.takeover',
  revoked: 'stream.end.revoked',
};

export interface WebRtcOptions {
  signalUrl: string;
  ticket: string;
  iceServers: RTCIceServer[];
  /** the picture */
  canvas: HTMLCanvasElement;
  /** plays the audio track */
  audio: HTMLAudioElement;
  onState: (s: StreamState, why?: MessageKey) => void;
  PeerConnection?: typeof RTCPeerConnection;
  WS?: typeof WebSocket;
}

export class WebRtcStream {
  private pc: RTCPeerConnection;
  private dc: RTCDataChannel;
  private videoDc: RTCDataChannel;
  private signal: SignalChannel | null = null;
  private pending: RTCIceCandidateInit[] = [];
  private media = new MediaStream();
  private state: StreamState = 'connecting';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private video: VideoSink;
  private chunks = new Reassembler();
  private lost = 0;

  constructor(private o: WebRtcOptions) {
    const PC = o.PeerConnection ?? RTCPeerConnection;
    this.pc = new PC(rtcConfig(o.iceServers));
    this.video = new VideoSink(o.canvas, () => this.send({ type: 'requestidr' }));
    // MoonlightWeb's channel layout: 0 video (ordered, 500 ms lifetime), 2 input (reliable); 1 and 3 are unused here
    this.videoDc = this.pc.createDataChannel('video', { negotiated: true, id: 0, ordered: true, maxPacketLifeTime: 500 });
    this.videoDc.binaryType = 'arraybuffer';
    this.videoDc.onmessage = (e) => this.chunk(e.data);
    this.dc = this.pc.createDataChannel('input', { negotiated: true, id: 2 });
    this.dc.onopen = () => this.set('connected');
    this.dc.onmessage = (e) => this.notice(e.data);
    this.pc.ontrack = (e) => {
      if (e.track.kind !== 'audio') return;
      this.media.addTrack(e.track);
      this.o.audio.srcObject = this.media;
      void this.o.audio.play().catch(() => {});
    };
    this.pc.onicecandidate = (e) => {
      if (e.candidate?.candidate) this.signal?.send({ type: 'ice', candidate: e.candidate.candidate, mid: e.candidate.sdpMid ?? '0' });
    };
    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === 'failed') this.set('failed', 'stream.fail.relay');
    };
  }

  private chunk(data: unknown): void {
    if (!(data instanceof ArrayBuffer)) return;
    const c = parseChunk(data);
    if (!c) return;
    this.video.count(data.byteLength);
    const r = this.chunks.push(c);
    if (r.lost) {
      this.lost++;
      this.video.lost();
    }
    if (r.frame) this.video.push(r.frame.data, r.frame.key);
  }

  start(): void {
    this.signal = new SignalChannel(
      this.o.signalUrl,
      this.o.ticket,
      {
        onMessage: (m) => void this.onSignal(m).catch(() => this.set('failed', 'stream.fail.setup')),
        onClose: (code) => {
          if (this.state !== 'connecting') return;
          this.set('failed', code === 1008 ? 'stream.fail.binding' : 'stream.fail.closed');
        },
      },
      this.o.WS,
    );
    this.arm(20_000);
  }

  /** a deadline for the connection, matched to MoonlightWeb's own ICE timeout */
  private arm(ms: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.state === 'connecting' && this.set('failed', 'stream.fail.timeout'), ms);
  }

  private async onSignal(m: SignalMessage): Promise<void> {
    if (m.type === 'ice-config') {
      if (m.iceServers.length) this.pc.setConfiguration(rtcConfig(m.iceServers));
      if (m.iceTimeoutMs) this.arm(m.iceTimeoutMs + 8_000);
    } else if (m.type === 'sdp') {
      await this.pc.setRemoteDescription({ type: 'offer', sdp: m.sdp });
      for (const c of this.pending.splice(0)) await this.pc.addIceCandidate(c).catch(() => {});
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription({ type: 'answer', sdp: mungeAnswer(answer.sdp ?? '') });
      this.signal?.send({ type: 'sdp', sdp: this.pc.localDescription?.sdp ?? '' });
    } else {
      const c = { candidate: m.candidate, sdpMid: m.mid };
      if (this.pc.remoteDescription) await this.pc.addIceCandidate(c).catch(() => {});
      else this.pending.push(c);
    }
  }

  private notice(data: unknown): void {
    if (typeof data !== 'string') return;
    try {
      const t = (JSON.parse(data) as { type?: string }).type ?? '';
      if (t in ENDINGS) this.set('ended', ENDINGS[t]);
    } catch {
      /* not for us */
    }
  }

  private set(s: StreamState, why?: MessageKey): void {
    if (this.state === s || this.state === 'ended' || this.state === 'failed') return;
    this.state = s;
    if (s !== 'connecting' && this.timer) clearTimeout(this.timer);
    // the signaling socket has done its job once the input channel is open
    if (s !== 'connecting') this.signal?.close();
    this.o.onState(s, why);
  }

  send(m: InputMessage): void {
    if (this.dc.readyState === 'open') this.dc.send(JSON.stringify(m));
  }

  async stats(): Promise<StreamStats> {
    const report = await this.pc.getStats();
    return { ...connectionStats(report.values() as Iterable<Stat>), ...this.video.rates(), lost: this.lost };
  }

  close(): void {
    if (this.timer) clearTimeout(this.timer);
    this.state = 'ended';
    this.signal?.close();
    this.dc.close();
    this.videoDc.close();
    this.pc.close();
    this.video.close();
    for (const t of this.media.getTracks()) t.stop();
    this.o.audio.srcObject = null;
  }
}
