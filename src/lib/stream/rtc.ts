// The WebRTC side of Play → Stream (MoonlightWeb's `webrtc-media-udp` transport): MoonlightWeb offers H.264 video
// and Opus audio tracks plus a pre-negotiated "input" DataChannel; we answer receive-only and play the tracks in a
// plain <video>. Media only ever goes through TURN (iceTransportPolicy "relay"): the PC's ports aren't open to the
// internet, and the relay is what reaches it.
import { SignalChannel, type SignalMessage } from './signal';
import type { InputMessage } from './input';

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

export type StreamPath = 'relay-udp' | 'relay-tcp' | 'relay-tls' | 'direct' | 'ws' | 'unknown';

export interface StreamStats {
  path: StreamPath;
  rttMs: number | null;
  fps: number | null;
  kbps: number | null;
  width: number;
  height: number;
  packetsLost: number;
  jitterMs: number | null;
}

export interface StatsMark {
  bytes: number;
  at: number;
}

type Stat = Record<string, unknown> & { id: string; type: string; timestamp?: number };
const n = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);

/** The numbers for the stats overlay from an RTCStatsReport's values; `prev` turns byte counts into a bitrate. */
export function summarizeStats(reports: Iterable<Stat>, prev?: StatsMark): { stats: StreamStats; mark: StatsMark | undefined } {
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
  const video = all.find((r) => r.type === 'inbound-rtp' && (r.kind === 'video' || r.mediaType === 'video'));
  const bytes = n(video?.bytesReceived);
  const at = n(video?.timestamp);
  const mark = bytes !== null && at !== null ? { bytes, at } : undefined;
  const kbps = mark && prev && mark.at > prev.at ? Math.round(((mark.bytes - prev.bytes) * 8) / (mark.at - prev.at)) : null;
  const rtt = n(pair?.currentRoundTripTime);
  const jitter = n(video?.jitter);
  return {
    stats: {
      path,
      rttMs: rtt === null ? null : Math.round(rtt * 1000),
      fps: n(video?.framesPerSecond),
      kbps,
      width: n(video?.frameWidth) ?? 0,
      height: n(video?.frameHeight) ?? 0,
      packetsLost: n(video?.packetsLost) ?? 0,
      jitterMs: jitter === null ? null : Math.round(jitter * 1000),
    },
    mark,
  };
}

export type StreamState = 'connecting' | 'connected' | 'failed' | 'ended';

/** What MoonlightWeb says on the input channel when the stream ends from its side. */
const ENDINGS: Record<string, string> = {
  'session-ended': 'The stream ended.',
  'host-ended': 'The game or desktop session on the PC ended.',
  'host-lost': 'The gaming PC stopped answering.',
  takeover: 'Another device took over the stream.',
  revoked: 'This sign-in was ended on the server.',
};

export interface WebRtcOptions {
  signalUrl: string;
  ticket: string;
  iceServers: RTCIceServer[];
  video: HTMLVideoElement;
  onState: (s: StreamState, why?: string) => void;
  PeerConnection?: typeof RTCPeerConnection;
  WS?: typeof WebSocket;
}

export class WebRtcStream {
  private pc: RTCPeerConnection;
  private dc: RTCDataChannel;
  private signal: SignalChannel | null = null;
  private pending: RTCIceCandidateInit[] = [];
  private media = new MediaStream();
  private state: StreamState = 'connecting';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private mark: StatsMark | undefined;

  constructor(private o: WebRtcOptions) {
    const PC = o.PeerConnection ?? RTCPeerConnection;
    this.pc = new PC(rtcConfig(o.iceServers));
    this.dc = this.pc.createDataChannel('input', { negotiated: true, id: 1 });
    this.dc.onopen = () => this.set('connected');
    this.dc.onmessage = (e) => this.notice(e.data);
    this.pc.ontrack = (e) => {
      this.media.addTrack(e.track);
      if (this.o.video.srcObject !== this.media) this.o.video.srcObject = this.media;
    };
    this.pc.onicecandidate = (e) => {
      if (e.candidate?.candidate) this.signal?.send({ type: 'ice', candidate: e.candidate.candidate, mid: e.candidate.sdpMid ?? '0' });
    };
    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === 'failed') this.set('failed', "Couldn't connect through the relay. Try the connection test.");
    };
  }

  start(): void {
    this.signal = new SignalChannel(
      this.o.signalUrl,
      this.o.ticket,
      {
        onMessage: (m) => void this.onSignal(m).catch(() => this.set('failed', "The stream couldn't be set up.")),
        onClose: (code) => {
          if (this.state !== 'connecting') return;
          this.set('failed', code === 1008 ? "The stream server couldn't verify the gaming PC, so it stopped." : 'The stream server closed the connection.');
        },
      },
      this.o.WS,
    );
    this.arm(20_000);
  }

  /** a deadline for the connection, matched to MoonlightWeb's own ICE timeout */
  private arm(ms: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.state === 'connecting' && this.set('failed', 'The connection timed out. Try the connection test.'), ms);
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

  private set(s: StreamState, why?: string): void {
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
    const r = summarizeStats(report.values() as Iterable<Stat>, this.mark);
    this.mark = r.mark ?? this.mark;
    return r.stats;
  }

  close(): void {
    if (this.timer) clearTimeout(this.timer);
    this.state = 'ended';
    this.signal?.close();
    this.dc.close();
    this.pc.close();
    for (const t of this.media.getTracks()) t.stop();
    this.o.video.srcObject = null;
  }
}
