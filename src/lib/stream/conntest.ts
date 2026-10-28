// The connection test: each step a stream needs, tried in order, with a plain-language result, and a verdict on
// which transport this network can use. The probes are injected so the logic is testable; `browserProbes` has the
// real ones.
import { blockedOrigin } from '../csp';
import type { GatewayClient, Health, StreamTransport, TurnCredentials } from './api';

export type StepId = 'csp' | 'https' | 'signal' | 'turn-udp' | 'turn-tcp' | 'turns' | 'ws443';

export interface StepResult {
  id: StepId;
  label: string;
  /** null = not tried */
  ok: boolean | null;
  detail: string;
}

export interface Probes {
  blocked: (url: string) => string | null;
  health: () => Promise<Health>;
  /** does a WebSocket to `url` echo a message? (`binary` sends 16 kB of bytes instead of text) */
  echo: (url: string, binary: boolean) => Promise<boolean>;
  /** null when not signed in */
  turn: () => Promise<TurnCredentials | null>;
  /** can a relay be allocated through this one TURN URL? */
  relay: (url: string, creds: TurnCredentials) => Promise<boolean>;
}

export const LABELS: Record<StepId, string> = {
  csp: 'This site may contact the stream server',
  https: 'Stream server reachable (HTTPS)',
  signal: 'Secure WebSocket (signaling)',
  'turn-udp': 'Relay over UDP 3478',
  'turn-tcp': 'Relay over TCP 3478',
  turns: 'Relay over TLS 5349',
  ws443: 'WebSocket stream on port 443',
};

export interface Verdict {
  /** the transport to use, or null when streaming can't work from here */
  transport: StreamTransport | null;
  tone: 'ok' | 'warn' | 'bad';
  message: string;
}

export async function runConnectionTest(server: string, p: Probes, onStep: (r: StepResult[]) => void = () => {}): Promise<{ steps: StepResult[]; verdict: Verdict }> {
  const steps: StepResult[] = (Object.keys(LABELS) as StepId[]).map((id) => ({ id, label: LABELS[id], ok: null, detail: '' }));
  const set = (id: StepId, ok: boolean | null, detail: string) => {
    const s = steps.find((x) => x.id === id)!;
    s.ok = ok;
    s.detail = detail;
    onStep(steps.map((x) => ({ ...x })));
  };
  const done = () => ({ steps, verdict: verdict(steps) });

  const blocked = p.blocked(server);
  set('csp', !blocked, blocked ? `This build's security policy doesn't list ${blocked}. Rebuild with VITE_STREAM_SERVER set (see STREAM.md).` : 'Allowed.');
  if (blocked) return done();

  let health: Health | null = null;
  try {
    health = await p.health();
  } catch {
    /* reported below */
  }
  if (!health) {
    set('https', false, 'No answer. The server may be down, or this network blocks it.');
    return done();
  }
  set(
    'https',
    true,
    health.mw === 'up'
      ? health.host === 'online'
        ? 'The server, the bridge and the gaming PC are up.'
        : 'The server is up, but the gaming PC is off or asleep.'
      : health.mw === 'down'
        ? 'The server is up, but the bridge at home is not answering.'
        : 'The server is up but not set up yet.',
  );

  const wss = server.replace(/^http/, 'ws') + '/ws-probe';
  const ws = await p.echo(wss, false).catch(() => false);
  set('signal', ws, ws ? 'Works.' : 'Blocked. This network stops WebSockets, which streaming needs.');

  const creds = await p.turn().catch(() => null);
  const host = new URL(server).hostname;
  for (const [id, url] of [
    ['turn-udp', creds?.urls.find((u) => /^turn:.*transport=udp/.test(u))],
    ['turn-tcp', creds?.urls.find((u) => /^turn:.*transport=tcp/.test(u))],
    ['turns', creds?.urls.find((u) => u.startsWith('turns:'))],
  ] as [StepId, string | undefined][]) {
    if (!creds) {
      set(id, null, 'Sign in to test the relay.');
      continue;
    }
    if (!url) {
      set(id, false, 'Not offered by the server.');
      continue;
    }
    const ok = await p.relay(url, creds).catch(() => false);
    set(id, ok, ok ? 'Works.' : 'Blocked or not answering.');
  }

  const big = ws && (await p.echo(wss, true).catch(() => false));
  set('ws443', big, big ? `Works (through ${host}).` : 'Blocked.');
  return done();
}

export function verdict(steps: StepResult[]): Verdict {
  const ok = (id: StepId) => steps.find((s) => s.id === id)?.ok === true;
  const tried = (id: StepId) => steps.find((s) => s.id === id)?.ok !== null;
  if (!ok('csp')) return { transport: null, tone: 'bad', message: "This copy of the site isn't allowed to contact the stream server." };
  if (!ok('https')) return { transport: null, tone: 'bad', message: "Can't reach the stream server from this network. It may be down, or the network blocks it." };
  if (!ok('signal')) return { transport: null, tone: 'bad', message: 'This network blocks WebSockets, so streaming can’t work here.' };
  const relays = (['turn-udp', 'turn-tcp', 'turns'] as StepId[]).filter(ok);
  if (relays.includes('turn-udp')) return { transport: 'webrtc', tone: 'ok', message: 'Everything works. Streams use the fast UDP relay.' };
  if (relays.length)
    return { transport: 'webrtc', tone: 'warn', message: `UDP is blocked here, so streams go over ${relays.includes('turn-tcp') ? 'TCP' : 'TLS'}. Expect a little more delay.` };
  if (!tried('turn-udp')) return { transport: 'webrtc', tone: 'warn', message: 'The server is reachable. Sign in to test the relay.' };
  if (ok('ws443'))
    return {
      transport: 'ws',
      tone: 'warn',
      message: 'This network blocks streaming traffic and only lets normal web traffic (port 443) out. Streams will use the slower WebSocket mode.',
    };
  return { transport: null, tone: 'bad', message: 'This network blocks streaming. Try another network or mobile data.' };
}

/** The real probes, in the browser. */
export function browserProbes(api: GatewayClient): Probes {
  return {
    blocked: (url) => blockedOrigin(url),
    health: () => api.health(),
    turn: async () => (api.signedIn ? api.turnCredentials() : null),
    echo: (url, binary) =>
      new Promise((resolve) => {
        const ws = new WebSocket(url);
        ws.binaryType = 'arraybuffer';
        const payload = binary ? crypto.getRandomValues(new Uint8Array(16 * 1024)) : 'probe';
        const timer = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 6_000);
        ws.onopen = () => ws.send(payload);
        ws.onmessage = (e) => {
          clearTimeout(timer);
          resolve(binary ? e.data instanceof ArrayBuffer && e.data.byteLength === (payload as Uint8Array).length : e.data === payload);
          ws.close();
        };
        ws.onerror = () => {
          clearTimeout(timer);
          resolve(false);
        };
      }),
    relay: (url, creds) =>
      new Promise((resolve) => {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: url, username: creds.username, credential: creds.credential }], iceTransportPolicy: 'relay' });
        const finish = (ok: boolean) => {
          clearTimeout(timer);
          pc.close();
          resolve(ok);
        };
        const timer = setTimeout(() => finish(false), 8_000);
        pc.onicecandidate = (e) => {
          if (e.candidate && / typ relay /.test(e.candidate.candidate)) finish(true);
          else if (!e.candidate) finish(false);
        };
        pc.createDataChannel('probe');
        pc.createOffer()
          .then((o) => pc.setLocalDescription(o))
          .catch(() => finish(false));
      }),
  };
}
