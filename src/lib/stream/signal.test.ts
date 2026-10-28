import { describe, expect, it } from 'vitest';
import { SignalChannel, parseSignal } from './signal';

class FakeWS {
  static last: FakeWS;
  sent: string[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number; reason: string }) => void) | null = null;
  constructor(readonly url: string) {
    FakeWS.last = this;
  }
  send(t: string) {
    this.sent.push(t);
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
}

describe('parseSignal', () => {
  it('accepts the three gateway messages and nothing else', () => {
    expect(parseSignal(JSON.stringify({ type: 'sdp', sdp: 'v=0\r\n' }))).toEqual({ type: 'sdp', sdp: 'v=0\r\n' });
    expect(parseSignal(JSON.stringify({ type: 'ice', candidate: 'candidate:1', mid: 'video' }))).toEqual({ type: 'ice', candidate: 'candidate:1', mid: 'video' });
    expect(parseSignal(JSON.stringify({ type: 'ice-config', iceServers: [{ urls: ['turn:a', 'stun:b', 7], username: 'u', credential: 'c' }], iceTimeoutMs: 8000 }))).toEqual({
      type: 'ice-config',
      iceServers: [{ urls: ['turn:a'], username: 'u', credential: 'c' }],
      iceTimeoutMs: 8000,
    });
    expect(parseSignal(JSON.stringify({ type: 'sdp', sdp: '<b>' }))).toBeNull();
    expect(parseSignal(JSON.stringify({ type: 'fallback-ws' }))).toBeNull();
    expect(parseSignal('not json')).toBeNull();
    expect(parseSignal(new ArrayBuffer(3))).toBeNull();
  });
});

describe('SignalChannel', () => {
  it('authenticates with the ticket first and queues until open', () => {
    const got: unknown[] = [];
    const ch = new SignalChannel('wss://g/sessions/x/signal', 'T1', { onMessage: (m) => got.push(m), onClose: () => {} }, FakeWS as unknown as typeof WebSocket);
    const ws = FakeWS.last;
    expect(ws.url).toBe('wss://g/sessions/x/signal');
    ch.send({ type: 'ice', candidate: 'c', mid: '0' });
    expect(ws.sent).toEqual([]);
    ws.open();
    expect(ws.sent.map((s) => JSON.parse(s).type)).toEqual(['auth', 'ice']);
    expect(JSON.parse(ws.sent[0])).toEqual({ type: 'auth', ticket: 'T1' });
    ws.onmessage?.({ data: JSON.stringify({ type: 'sdp', sdp: 'v=0' }) });
    ws.onmessage?.({ data: '{"type":"weird"}' });
    expect(got).toEqual([{ type: 'sdp', sdp: 'v=0' }]);
  });
});
