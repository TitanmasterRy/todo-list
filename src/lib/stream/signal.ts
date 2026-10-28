// The browser's half of the signaling the gateway relays from MoonlightWeb (server/stream-gateway/API.md): the
// first message authenticates with the one-time ticket, then ice-config / offer / candidates arrive and the answer
// and our candidates go back. The bearer token never goes in the URL.

export type SignalMessage =
  { type: 'ice-config'; iceServers: RTCIceServer[]; iceTimeoutMs?: number } | { type: 'sdp'; sdp: string } | { type: 'ice'; candidate: string; mid: string };

/** A message from the gateway as a checked object, or null for anything else. */
export function parseSignal(text: unknown): SignalMessage | null {
  if (typeof text !== 'string' || text.length > 128 * 1024) return null;
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(text);
  } catch {
    return null;
  }
  if (!o || typeof o !== 'object') return null;
  if (o.type === 'sdp' && typeof o.sdp === 'string' && o.sdp.startsWith('v=0')) return { type: 'sdp', sdp: o.sdp };
  if (o.type === 'ice' && typeof o.candidate === 'string' && o.candidate.length <= 1024)
    return { type: 'ice', candidate: o.candidate, mid: typeof o.mid === 'string' ? o.mid.slice(0, 32) : '0' };
  if (o.type === 'ice-config' && Array.isArray(o.iceServers)) {
    const iceServers = o.iceServers
      .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
      .map((s) => ({
        urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u): u is string => typeof u === 'string' && /^turns?:/.test(u)),
        username: typeof s.username === 'string' ? s.username : undefined,
        credential: typeof s.credential === 'string' ? s.credential : undefined,
      }))
      .filter((s) => s.urls.length);
    const t = typeof o.iceTimeoutMs === 'number' && o.iceTimeoutMs > 0 ? Math.min(o.iceTimeoutMs, 60_000) : undefined;
    return { type: 'ice-config', iceServers, ...(t ? { iceTimeoutMs: t } : {}) };
  }
  return null;
}

export interface SignalHandlers {
  onMessage: (m: SignalMessage) => void;
  onClose: (code: number, reason: string) => void;
}

/** A WebSocket to the gateway that authenticates with a ticket, then exchanges SignalMessages. */
export class SignalChannel {
  private ws: WebSocket;
  private queue: string[] = [];
  private open = false;

  constructor(url: string, ticket: string, h: SignalHandlers, WS: typeof WebSocket = WebSocket) {
    this.ws = new WS(url);
    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({ type: 'auth', ticket }));
      this.open = true;
      for (const m of this.queue.splice(0)) this.ws.send(m);
    };
    this.ws.onmessage = (e) => {
      const m = parseSignal(e.data);
      if (m) h.onMessage(m);
    };
    this.ws.onclose = (e) => h.onClose(e.code, e.reason);
  }

  send(m: { type: 'sdp'; sdp: string } | { type: 'ice'; candidate: string; mid: string }): void {
    const text = JSON.stringify(m);
    if (this.open && this.ws.readyState === 1) this.ws.send(text);
    else this.queue.push(text);
  }

  close(): void {
    this.ws.onclose = null;
    this.ws.close(1000);
  }
}
