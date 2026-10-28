import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebRtcStream, connectionStats, mungeAnswer, rtcConfig } from './rtc';

describe('mungeAnswer', () => {
  it('answers receive-only with stereo Opus', () => {
    const sdp = [
      'm=video 9 UDP/TLS/RTP/SAVPF 96',
      'a=sendrecv',
      'm=audio 9 UDP/TLS/RTP/SAVPF 111',
      'a=sendrecv',
      'a=rtpmap:111 opus/48000/2',
      'a=fmtp:111 minptime=10;useinbandfec=1;stereo=0',
    ].join('\r\n');
    const out = mungeAnswer(sdp);
    expect(out).not.toContain('sendrecv');
    expect(out.match(/a=recvonly/g)).toHaveLength(2);
    expect(out).toContain('a=fmtp:111 minptime=10;useinbandfec=1;stereo=1;sprop-stereo=1');
  });

  it('adds the fmtp line when the answer has none', () => {
    expect(mungeAnswer('a=rtpmap:109 opus/48000/2\r\na=x')).toBe('a=rtpmap:109 opus/48000/2\r\na=fmtp:109 stereo=1;sprop-stereo=1\r\na=x');
  });
});

describe('rtcConfig', () => {
  it('forces media through the relay', () => {
    expect(rtcConfig([])).toMatchObject({ iceTransportPolicy: 'relay', bundlePolicy: 'max-bundle' });
  });
});

describe('connectionStats', () => {
  const report = (relayProtocol = 'tcp') => [
    { id: 'T', type: 'transport', selectedCandidatePairId: 'P' },
    { id: 'P', type: 'candidate-pair', localCandidateId: 'L', currentRoundTripTime: 0.042 },
    { id: 'L', type: 'local-candidate', candidateType: 'relay', relayProtocol },
  ];

  it('reads the relay path and the round trip', () => {
    expect(connectionStats(report())).toEqual({ path: 'relay-tcp', rttMs: 42 });
    expect(connectionStats(report('tls')).path).toBe('relay-tls');
    expect(connectionStats(report('udp')).path).toBe('relay-udp');
  });

  it('copes with an empty report', () => {
    expect(connectionStats([])).toEqual({ path: 'unknown', rttMs: null });
  });
});

// ---------- the offer/answer flow, with a fake RTCPeerConnection and WebSocket ----------
class FakeDC {
  readyState = 'connecting';
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  constructor(
    readonly label: string,
    readonly init: RTCDataChannelInit,
  ) {}
  send(t: string) {
    this.sent.push(t);
  }
  close() {}
  open() {
    this.readyState = 'open';
    this.onopen?.();
  }
}

class FakePC {
  static last: FakePC;
  config: RTCConfiguration;
  dcs: FakeDC[] = [];
  remoteDescription: RTCSessionDescriptionInit | null = null;
  localDescription: RTCSessionDescriptionInit | null = null;
  added: RTCIceCandidateInit[] = [];
  connectionState = 'new';
  ontrack: ((e: unknown) => void) | null = null;
  onicecandidate: ((e: { candidate: { candidate: string; sdpMid: string } | null }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  constructor(config: RTCConfiguration) {
    this.config = config;
    FakePC.last = this;
  }
  createDataChannel(label: string, init: RTCDataChannelInit) {
    const dc = new FakeDC(label, init);
    this.dcs.push(dc);
    return dc;
  }
  dc(label: string) {
    return this.dcs.find((d) => d.label === label)!;
  }
  setConfiguration(c: RTCConfiguration) {
    this.config = c;
  }
  async setRemoteDescription(d: RTCSessionDescriptionInit) {
    this.remoteDescription = d;
  }
  async addIceCandidate(c: RTCIceCandidateInit) {
    this.added.push(c);
  }
  async createAnswer() {
    return { type: 'answer', sdp: 'v=0\r\na=sendrecv\r\na=fingerprint:sha-256 AA' };
  }
  async setLocalDescription(d: RTCSessionDescriptionInit) {
    this.localDescription = d;
  }
  close() {}
}

class FakeWS {
  static last: FakeWS;
  sent: Record<string, unknown>[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number; reason: string }) => void) | null = null;
  constructor(readonly url: string) {
    FakeWS.last = this;
  }
  send(t: string) {
    this.sent.push(JSON.parse(t));
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  deliver(m: unknown) {
    this.onmessage?.({ data: JSON.stringify(m) });
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const g = globalThis as Record<string, unknown>;
const hadMediaStream = 'MediaStream' in g;

beforeAll(() => {
  if (!hadMediaStream)
    g.MediaStream = class {
      tracks: unknown[] = [];
      addTrack(t: unknown) {
        this.tracks.push(t);
      }
      getTracks() {
        return [];
      }
    };
});
afterAll(() => {
  if (!hadMediaStream) delete g.MediaStream;
});

function setup() {
  const states: [string, string | undefined][] = [];
  const audio = { srcObject: null, play: async () => {} } as unknown as HTMLAudioElement;
  // node has no canvas or WebCodecs; chunk reassembly is covered in video.test.ts
  const canvas = { getContext: () => null, width: 0, height: 0 } as unknown as HTMLCanvasElement;
  const s = new WebRtcStream({
    signalUrl: 'wss://g/sessions/abc/signal',
    ticket: 'T',
    iceServers: [{ urls: 'turn:t:3478?transport=udp', username: 'u', credential: 'c' }],
    canvas,
    audio,
    onState: (st, why) => states.push([st, why]),
    PeerConnection: FakePC as unknown as typeof RTCPeerConnection,
    WS: FakeWS as unknown as typeof WebSocket,
  });
  s.start();
  FakeWS.last.open();
  return { s, states, pc: FakePC.last, ws: FakeWS.last, audio };
}

describe('WebRtcStream', () => {
  it("relays only, with MoonlightWeb's pre-negotiated video and input channels", () => {
    const { pc, ws } = setup();
    expect(pc.config.iceTransportPolicy).toBe('relay');
    expect(pc.dc('video').init).toEqual({ negotiated: true, id: 0, ordered: true, maxPacketLifeTime: 500 });
    expect(pc.dc('input').init).toEqual({ negotiated: true, id: 2 });
    expect(ws.sent[0]).toEqual({ type: 'auth', ticket: 'T' });
  });

  it('answers the offer, trickles candidates both ways and reports connected', async () => {
    const { s, pc, ws, states } = setup();
    ws.deliver({ type: 'ice-config', iceServers: [{ urls: ['turns:t:5349?transport=tcp'], username: 'u2', credential: 'c2' }], iceTimeoutMs: 8000 });
    ws.deliver({ type: 'ice', candidate: 'candidate:early', mid: 'video' });
    ws.deliver({ type: 'sdp', sdp: 'v=0\r\nm=video' });
    await flush();
    expect(pc.config.iceServers?.[0].urls).toEqual(['turns:t:5349?transport=tcp']);
    expect(pc.config.iceTransportPolicy).toBe('relay');
    expect(pc.remoteDescription).toEqual({ type: 'offer', sdp: 'v=0\r\nm=video' });
    expect(pc.added).toEqual([{ candidate: 'candidate:early', sdpMid: 'video' }]);
    expect(ws.sent[1]).toEqual({ type: 'sdp', sdp: 'v=0\r\na=recvonly\r\na=fingerprint:sha-256 AA' });
    pc.onicecandidate?.({ candidate: { candidate: 'candidate:2 1 udp 1 1.2.3.4 9 typ relay', sdpMid: '0' } });
    expect(ws.sent[2]).toEqual({ type: 'ice', candidate: 'candidate:2 1 udp 1 1.2.3.4 9 typ relay', mid: '0' });
    pc.dc('input').open();
    expect(states).toEqual([['connected', undefined]]);
    expect(ws.readyState).toBe(3);
    s.send({ type: 'keydown', keyCode: 65 });
    expect(pc.dc('input').sent).toEqual(['{"type":"keydown","keyCode":65}']);
  });

  it('plays the audio track and ignores anything else', () => {
    const { pc, audio } = setup();
    pc.ontrack?.({ track: { kind: 'video' } });
    expect(audio.srcObject).toBeNull();
    pc.ontrack?.({ track: { kind: 'audio' } });
    expect((audio.srcObject as unknown as { tracks: unknown[] }).tracks).toEqual([{ kind: 'audio' }]);
  });

  it('explains a refused binding and an ending from the PC', () => {
    const a = setup();
    a.ws.onclose?.({ code: 1008, reason: 'pairing verification failed' });
    expect(a.states[0]).toEqual(['failed', 'stream.fail.binding']);
    const b = setup();
    b.pc.dc('input').open();
    b.pc.dc('input').onmessage?.({ data: '{"type":"host-ended"}' });
    expect(b.states.at(-1)).toEqual(['ended', 'stream.end.hostEnded']);
  });
});
