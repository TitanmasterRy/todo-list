import { describe, expect, it } from 'vitest';
import { runConnectionTest, type Probes } from './conntest';

const CREDS = { username: 'u', credential: 'c', ttl: 600, urls: ['turn:t:3478?transport=udp', 'turn:t:3478?transport=tcp', 'turns:t:5349?transport=tcp'] };

function probes(over: Partial<Probes> & { relays?: string[] } = {}): Probes {
  return {
    blocked: () => null,
    health: async () => ({ ok: true, mw: 'up', host: 'online' }),
    echo: async () => true,
    turn: async () => CREDS,
    relay: async (url) => (over.relays ?? ['udp', 'tcp', 'tls']).some((k) => (k === 'tls' ? url.startsWith('turns:') : url.endsWith(`transport=${k}`) && url.startsWith('turn:'))),
    ...over,
  };
}

describe('connection test', () => {
  it('passes every step on an open network', async () => {
    const seen: number[] = [];
    const r = await runConnectionTest('https://play.example.com', probes(), (s) => seen.push(s.filter((x) => x.ok !== null).length));
    expect(r.steps.every((s) => s.ok)).toBe(true);
    expect(r.verdict).toEqual({ transport: 'webrtc', tone: 'ok', message: 'stream.verdict.udp' });
    expect(seen.at(-1)).toBe(7);
  });

  it('falls back to TCP or TLS relays when UDP is blocked', async () => {
    expect((await runConnectionTest('https://p', probes({ relays: ['tls'] }))).verdict).toEqual({ transport: 'webrtc', tone: 'warn', message: 'stream.verdict.tls' });
  });

  it('uses the WebSocket mode when only 443 gets out', async () => {
    const r = await runConnectionTest('https://p', probes({ relays: [] }));
    expect(r.verdict).toEqual({ transport: 'ws', tone: 'warn', message: 'stream.verdict.wsOnly' });
  });

  it('says plainly when the network blocks streaming', async () => {
    const r = await runConnectionTest('https://p', probes({ relays: [], echo: async (_u, binary) => !binary }));
    expect(r.verdict).toEqual({ transport: null, tone: 'bad', message: 'stream.verdict.blocked' });
    expect((await runConnectionTest('https://p', probes({ echo: async () => false }))).verdict.message).toBe('stream.verdict.noWs');
  });

  it('stops early when the policy or the server is the problem', async () => {
    const csp = await runConnectionTest('https://p', probes({ blocked: () => 'https://p' }));
    expect(csp.steps.slice(1).every((s) => s.ok === null)).toBe(true);
    expect(csp.steps[0]).toMatchObject({ detail: 'stream.test.cspBlocked', params: { origin: 'https://p' } });
    const down = await runConnectionTest('https://p', probes({ health: async () => Promise.reject(new Error('x')) }));
    expect(down.verdict.transport).toBeNull();
    const pcOff = await runConnectionTest('https://p', probes({ health: async () => ({ ok: true, mw: 'up', host: 'offline' }) }));
    expect(pcOff.steps[1].detail).toBe('stream.test.pcOff');
  });

  it('asks to sign in before testing the relay', async () => {
    const r = await runConnectionTest('https://p', probes({ turn: async () => null }));
    expect(r.steps.find((s) => s.id === 'turn-udp')).toMatchObject({ ok: null, detail: 'stream.test.signInFirst' });
    expect(r.verdict.message).toBe('stream.verdict.signIn');
  });
});
