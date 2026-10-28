import { describe, expect, it } from 'vitest';
import { PROTOCOL, browserDigest, hostDigest, keyIdOf, newPairingKey, signRaw, spkiOf, verifyRaw } from './mwbind.js';
import { SignalRelay, type Side } from './relay.js';
import { fp, hostIdentity, nonce, sdp } from './testkit.js';

class Pipe implements Side {
  sent: Record<string, unknown>[] = [];
  closed: [number, string] | null = null;
  send(t: string) {
    this.sent.push(JSON.parse(t));
  }
  close(code: number, reason: string) {
    this.closed = [code, reason];
  }
}

const ICE = [{ urls: ['turn:t:3478?transport=udp'], username: 'u', credential: 'c' }];

function setup() {
  const host = hostIdentity();
  const gatewayKey = newPairingKey();
  const browser = new Pipe();
  const mw = new Pipe();
  const relay = new SignalRelay({ pairingKey: gatewayKey, hostKey: host.spki, hostId: host.hostId, iceServers: () => ICE, browser, mw });
  relay.start();
  const hello = mw.sent[0] as { type: string; key_id: string; nonce: string };
  /** what an honest MoonlightWeb sends after the hello */
  const offer = (fpH = fp('11'), over: Record<string, unknown> = {}) => {
    const nonceH = nonce();
    const sig = signRaw(host.key, hostDigest(host.hostId, hello.key_id, Buffer.from(hello.nonce, 'base64'), fpH.toUpperCase()));
    relay.fromMw(JSON.stringify({ type: 'sdp', sdp: sdp(fpH), protocol: PROTOCOL, host_id: host.hostId, nonce: nonceH.toString('base64'), sig: sig.toString('base64'), ...over }));
    return nonceH;
  };
  return { host, gatewayKey, browser, mw, relay, hello, offer };
}

describe('SignalRelay (MW-BIND-v1)', () => {
  it('announces the gateway key with a fresh 32-byte nonce', () => {
    const { hello, gatewayKey } = setup();
    expect(hello.type).toBe('hello');
    expect(hello.key_id).toBe(keyIdOf(spkiOf(gatewayKey)));
    expect(Buffer.from(hello.nonce, 'base64')).toHaveLength(32);
  });

  it("replaces MoonlightWeb's ice-config with the TURN servers", () => {
    const { relay, browser } = setup();
    relay.fromMw(JSON.stringify({ type: 'ice-config', iceServers: [], iceTimeoutMs: 8000 }));
    expect(browser.sent).toEqual([{ type: 'ice-config', iceServers: ICE, iceTimeoutMs: 8000 }]);
  });

  it('forwards a verified offer without the binding fields', () => {
    const { browser, offer } = setup();
    offer();
    expect(browser.sent).toEqual([{ type: 'sdp', sdp: sdp(fp('11')) }]);
  });

  it('refuses an offer whose fingerprint was swapped in transit', () => {
    const { relay, browser, mw, host, hello } = setup();
    const sig = signRaw(host.key, hostDigest(host.hostId, hello.key_id, Buffer.from(hello.nonce, 'base64'), fp('11')));
    relay.fromMw(JSON.stringify({ type: 'sdp', sdp: sdp(fp('66')), protocol: PROTOCOL, host_id: host.hostId, nonce: nonce().toString('base64'), sig: sig.toString('base64') }));
    expect(browser.sent).toEqual([]);
    expect(browser.closed?.[0]).toBe(1008);
    expect(mw.closed?.[0]).toBe(1008);
  });

  it.each([
    ['no signature', { sig: undefined }],
    ['another protocol', { protocol: 'MW-BIND-v0' }],
    ['another host', { host_id: 'someone-else' }],
    ['a short nonce', { nonce: Buffer.alloc(8).toString('base64') }],
    ['a signature by another key', { sig: signRaw(newPairingKey(), Buffer.from('x')).toString('base64') }],
  ])('fails closed on %s', (_name, over) => {
    const { browser, offer } = setup();
    offer(fp('11'), over);
    expect(browser.sent).toEqual([]);
    expect(browser.closed?.[0]).toBe(1008);
  });

  it("signs the browser's own fingerprint so MoonlightWeb can verify it", () => {
    const { relay, mw, offer, host, gatewayKey } = setup();
    const nonceH = offer();
    relay.fromBrowser(JSON.stringify({ type: 'sdp', sdp: sdp(fp('22')) }));
    const answer = mw.sent[1] as { type: string; sdp: string; sig: string };
    expect(answer.type).toBe('sdp');
    expect(answer.sdp).toBe(sdp(fp('22')));
    expect(verifyRaw(spkiOf(gatewayKey), browserDigest(host.hostId, nonceH, fp('11'), fp('22')), Buffer.from(answer.sig, 'base64'))).toBe(true);
  });

  it('refuses an answer before the offer, a second answer, or one without a fingerprint', () => {
    const a = setup();
    a.relay.fromBrowser(JSON.stringify({ type: 'sdp', sdp: sdp(fp('22')) }));
    expect(a.mw.closed?.[0]).toBe(1008);
    const b = setup();
    b.offer();
    b.relay.fromBrowser(JSON.stringify({ type: 'sdp', sdp: 'v=0\r\n' }));
    expect(b.mw.closed?.[0]).toBe(1008);
    const c = setup();
    c.offer();
    c.relay.fromBrowser(JSON.stringify({ type: 'sdp', sdp: sdp(fp('22')) }));
    c.relay.fromBrowser(JSON.stringify({ type: 'sdp', sdp: sdp(fp('33')) }));
    expect(c.mw.closed?.[0]).toBe(1008);
  });

  it('passes candidates both ways, holding the browser’s until its answer', () => {
    const { relay, browser, mw, offer } = setup();
    offer();
    relay.fromMw(JSON.stringify({ type: 'ice', candidate: 'candidate:1 1 udp 1 10.250.50.10 48550 typ host', mid: 'video' }));
    expect(browser.sent[1]).toEqual({ type: 'ice', candidate: 'candidate:1 1 udp 1 10.250.50.10 48550 typ host', mid: 'video' });
    relay.fromBrowser(JSON.stringify({ type: 'ice', candidate: 'candidate:2 1 udp 1 1.2.3.4 5 typ relay', mid: '0', extra: 'dropped' }));
    expect(mw.sent).toHaveLength(1);
    relay.fromBrowser(JSON.stringify({ type: 'sdp', sdp: sdp(fp('22')) }));
    expect(mw.sent[2]).toEqual({ type: 'ice', candidate: 'candidate:2 1 udp 1 1.2.3.4 5 typ relay', mid: '0' });
  });

  it('drops messages the protocol does not need', () => {
    const { relay, browser, mw, offer } = setup();
    relay.fromMw(JSON.stringify({ type: 'fallback-ws' }));
    relay.fromMw('not json');
    offer();
    relay.fromBrowser(JSON.stringify({ type: 'fallback-ws-request' }));
    relay.fromBrowser(JSON.stringify({ type: 'hello', key_id: 'x', nonce: 'y' }));
    expect(browser.sent).toHaveLength(1);
    expect(mw.sent).toHaveLength(1);
  });
});
