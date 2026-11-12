import { afterEach, describe, expect, it, vi } from 'vitest';
import { WsStream, parseFrame } from './fallback';

const bytes = (...b: number[]) => new Uint8Array(b);

describe('WebSocket stream frames', () => {
  it('splits channel, keyframe flag and payload', () => {
    expect(parseFrame(bytes(1, 1, 0, 0, 1, 0x65).buffer)).toEqual({ kind: 'video', key: true, data: bytes(0, 0, 1, 0x65) });
    expect(parseFrame(bytes(1, 0, 9).buffer)).toMatchObject({ kind: 'video', key: false });
    expect(parseFrame(bytes(2, 0, 0xfc, 0xff).buffer)).toEqual({ kind: 'audio', data: bytes(0xfc, 0xff) });
    expect(parseFrame(bytes(3, 0, 0).buffer)).toBeNull();
    expect(parseFrame(bytes(1).buffer)).toBeNull();
  });
});

describe('WsStream', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks the gateway to skip ahead when its clock shows the picture falling behind', () => {
    let now = 0;
    vi.stubGlobal('performance', { now: () => now });
    vi.stubGlobal('VideoDecoder', class {});
    vi.stubGlobal(
      'AudioContext',
      class {
        state = 'running';
        close() {}
        createGain() {
          return { gain: { value: 1 }, connect() {} };
        }
      },
    );
    const sent: string[] = [];
    class FakeWs {
      readyState = 1;
      binaryType = '';
      onopen: (() => void) | null = null;
      onmessage: ((e: { data: unknown }) => void) | null = null;
      onclose: (() => void) | null = null;
      send(t: string) {
        sent.push(t);
      }
      close() {}
    }
    const sockets: FakeWs[] = [];
    const s = new WsStream({
      url: 'wss://gw.example/sessions/x/media',
      ticket: 't',
      canvas: { getContext: () => null } as unknown as HTMLCanvasElement,
      onState: () => {},
      WS: new Proxy(FakeWs, {
        construct: () => {
          const w = new FakeWs();
          sockets.push(w);
          return w;
        },
      }) as unknown as typeof WebSocket,
    });
    s.start();
    const clock = (at: number, t: number) => {
      now = at;
      sockets[0].onmessage!({ data: JSON.stringify({ type: 'gw-clock', t }) });
    };
    clock(30, 0);
    clock(530, 100);
    clock(930, 200);
    expect(sent.map((x) => JSON.parse(x))).toContainEqual({ type: 'gw-lag', ms: 700 });
    s.close();
  });
});
