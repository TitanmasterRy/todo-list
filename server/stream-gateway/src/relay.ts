// The signaling relay between one browser and MoonlightWeb's /ws. The gateway speaks MW-BIND-v1 to MW with its own
// pairing key, verifies MW's offer before the browser sees it, and signs the browser's answer fingerprint. MW's
// ice-config (empty in LAN-only mode) is replaced with our TURN servers. Only the messages the protocol needs pass;
// anything else is dropped. Fails closed: any doubt closes both sides with 1008.
import { randomBytes } from 'node:crypto';
import { MIN_NONCE_BYTES, PROTOCOL, browserDigest, extractFingerprint, fromB64, hostDigest, keyIdOf, signRaw, spkiOf, verifyRaw } from './mwbind.js';

export interface Side {
  send(data: string): void;
  close(code: number, reason: string): void;
}

export interface RelayOptions {
  pairingKey: string;
  /** MW's host key (SPKI DER) and id, pinned when the gateway was linked */
  hostKey: Buffer;
  hostId: string;
  iceServers: () => unknown[];
  browser: Side;
  mw: Side;
  log?: (msg: string) => void;
}

const MAX_SDP = 64 * 1024;

function parse(text: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

export class SignalRelay {
  private nonceB = randomBytes(32);
  private keyId: string;
  private nonceH: Buffer | null = null;
  private fpH = '';
  private answered = false;
  /** the browser's candidates that came before its answer */
  private early: Record<string, unknown>[] = [];
  closed = false;

  constructor(private o: RelayOptions) {
    this.keyId = keyIdOf(spkiOf(o.pairingKey));
  }

  /** MW-BIND step 0: MW holds its offer until it has our key id and nonce. */
  start(): void {
    this.o.mw.send(JSON.stringify({ type: 'hello', key_id: this.keyId, nonce: this.nonceB.toString('base64') }));
  }

  fail(reason: string): void {
    if (this.closed) return;
    this.closed = true;
    this.o.log?.(`signaling refused: ${reason}`);
    this.o.browser.close(1008, 'pairing verification failed');
    this.o.mw.close(1008, 'pairing verification failed');
  }

  fromMw(text: string): void {
    if (this.closed) return;
    const msg = parse(text);
    if (!msg) return;
    if (msg.type === 'ice-config') {
      const timeout = typeof msg.iceTimeoutMs === 'number' ? msg.iceTimeoutMs : undefined;
      this.o.browser.send(JSON.stringify({ type: 'ice-config', iceServers: this.o.iceServers(), ...(timeout ? { iceTimeoutMs: timeout } : {}) }));
    } else if (msg.type === 'sdp') {
      this.onOffer(msg);
    } else if (msg.type === 'ice') {
      if (!this.nonceH) return; // MW holds its candidates until the offer; anything earlier is out of order
      this.forwardIce(msg, this.o.browser);
    } else {
      this.o.log?.(`dropped a "${String(msg.type).slice(0, 32)}" message from MoonlightWeb`);
    }
  }

  private onOffer(msg: Record<string, unknown>): void {
    if (this.nonceH) return this.fail('a second offer');
    const sdp = typeof msg.sdp === 'string' && msg.sdp.length <= MAX_SDP ? msg.sdp : '';
    if (!sdp) return this.fail('the offer has no SDP');
    if (msg.protocol !== PROTOCOL) return this.fail('the offer is not signed with MW-BIND-v1');
    if (msg.host_id !== this.o.hostId) return this.fail('the offer names another host');
    const nonceH = fromB64(msg.nonce);
    const sig = fromB64(msg.sig);
    if (!nonceH || nonceH.length < MIN_NONCE_BYTES) return this.fail('the host nonce is missing or short');
    if (!sig) return this.fail('the offer carries no signature');
    const fpH = extractFingerprint(sdp);
    if (!fpH) return this.fail('the offer does not commit to one sha-256 fingerprint');
    if (!verifyRaw(this.o.hostKey, hostDigest(this.o.hostId, this.keyId, this.nonceB, fpH), sig)) return this.fail("the host's signature does not verify");
    this.nonceH = nonceH;
    this.fpH = fpH;
    this.o.browser.send(JSON.stringify({ type: 'sdp', sdp }));
  }

  fromBrowser(text: string): void {
    if (this.closed) return;
    const msg = parse(text);
    if (!msg) return;
    if (msg.type === 'sdp') {
      if (!this.nonceH || this.answered) return this.fail('an answer without an offer');
      const sdp = typeof msg.sdp === 'string' && msg.sdp.length <= MAX_SDP ? msg.sdp : '';
      const fpB = sdp ? extractFingerprint(sdp) : '';
      if (!fpB) return this.fail('the answer does not commit to one sha-256 fingerprint');
      this.answered = true;
      const sig = signRaw(this.o.pairingKey, browserDigest(this.o.hostId, this.nonceH, this.fpH, fpB));
      this.o.mw.send(JSON.stringify({ type: 'sdp', sdp, sig: sig.toString('base64') }));
      for (const c of this.early.splice(0)) this.forwardIce(c, this.o.mw);
    } else if (msg.type === 'ice') {
      if (this.answered) this.forwardIce(msg, this.o.mw);
      else if (this.early.length < 32) this.early.push(msg);
    }
  }

  private forwardIce(msg: Record<string, unknown>, to: Side): void {
    const candidate = typeof msg.candidate === 'string' ? msg.candidate : '';
    const mid = typeof msg.mid === 'string' ? msg.mid : '0';
    if (candidate.length > 1024 || mid.length > 32) return;
    to.send(JSON.stringify({ type: 'ice', candidate, mid }));
  }
}
