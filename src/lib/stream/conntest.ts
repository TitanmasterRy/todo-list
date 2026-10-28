// The connection test: each step a stream needs, tried in order, with a plain-language result, and a verdict on
// which transport this network can use. The probes are injected so the logic is testable; `browserProbes` has the
// real ones.
import { blockedOrigin } from '../csp';
import type { MessageKey } from '../i18n/index.svelte';
import type { GatewayClient, Health, StreamTransport, TurnCredentials } from './api';

export type StepId = 'csp' | 'https' | 'signal' | 'turn-udp' | 'turn-tcp' | 'turns' | 'ws443';

export interface StepResult {
  id: StepId;
  /** null = not tried */
  ok: boolean | null;
  /** what happened, as a message key */
  detail: MessageKey | '';
  params?: Record<string, string>;
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

export const STEPS: StepId[] = ['csp', 'https', 'signal', 'turn-udp', 'turn-tcp', 'turns', 'ws443'];

export const STEP_LABEL: Record<StepId, MessageKey> = {
  csp: 'stream.step.csp',
  https: 'stream.step.https',
  signal: 'stream.step.signal',
  'turn-udp': 'stream.step.turnUdp',
  'turn-tcp': 'stream.step.turnTcp',
  turns: 'stream.step.turns',
  ws443: 'stream.step.ws443',
};

export interface Verdict {
  /** the transport to use, or null when streaming can't work from here */
  transport: StreamTransport | null;
  tone: 'ok' | 'warn' | 'bad';
  message: MessageKey;
}

export async function runConnectionTest(server: string, p: Probes, onStep: (r: StepResult[]) => void = () => {}): Promise<{ steps: StepResult[]; verdict: Verdict }> {
  const steps: StepResult[] = STEPS.map((id) => ({ id, ok: null, detail: '' }));
  const set = (id: StepId, ok: boolean | null, detail: MessageKey, params?: Record<string, string>) => {
    Object.assign(
      steps.find((x) => x.id === id)!,
      { ok, detail, params },
    );
    onStep(steps.map((x) => ({ ...x })));
  };
  const done = () => ({ steps, verdict: verdict(steps) });

  const blocked = p.blocked(server);
  if (blocked) {
    set('csp', false, 'stream.test.cspBlocked', { origin: blocked });
    return done();
  }
  set('csp', true, 'stream.test.allowed');

  let health: Health | null = null;
  try {
    health = await p.health();
  } catch {
    /* reported below */
  }
  if (!health) {
    set('https', false, 'stream.test.noAnswer');
    return done();
  }
  set(
    'https',
    true,
    health.mw === 'up' ? (health.host === 'online' ? 'stream.test.allUp' : 'stream.test.pcOff') : health.mw === 'down' ? 'stream.test.bridgeDown' : 'stream.test.notSetUp',
  );

  const wss = server.replace(/^http/, 'ws') + '/ws-probe';
  const ws = await p.echo(wss, false).catch(() => false);
  set('signal', ws, ws ? 'stream.test.works' : 'stream.test.wsBlocked');

  // the three relays are tried at the same time, so a network that blocks them all costs one timeout, not three
  const creds = await p.turn().catch(() => null);
  const relays: [StepId, string | undefined][] = [
    ['turn-udp', creds?.urls.find((u) => /^turn:.*transport=udp/.test(u))],
    ['turn-tcp', creds?.urls.find((u) => /^turn:.*transport=tcp/.test(u))],
    ['turns', creds?.urls.find((u) => u.startsWith('turns:'))],
  ];
  const results = await Promise.all(relays.map(([, url]) => (creds && url ? p.relay(url, creds).catch(() => false) : Promise.resolve(null))));
  relays.forEach(([id, url], i) => {
    if (!creds) set(id, null, 'stream.test.signInFirst');
    else if (!url) set(id, false, 'stream.test.notOffered');
    else set(id, results[i], results[i] ? 'stream.test.works' : 'stream.test.blocked');
  });

  const big = ws && (await p.echo(wss, true).catch(() => false));
  set('ws443', big, big ? 'stream.test.works' : 'stream.test.blocked');
  return done();
}

export function verdict(steps: StepResult[]): Verdict {
  const ok = (id: StepId) => steps.find((s) => s.id === id)?.ok === true;
  const tried = (id: StepId) => steps.find((s) => s.id === id)?.ok !== null;
  if (!ok('csp')) return { transport: null, tone: 'bad', message: 'stream.verdict.csp' };
  if (!ok('https')) return { transport: null, tone: 'bad', message: 'stream.verdict.unreachable' };
  if (!ok('signal')) return { transport: null, tone: 'bad', message: 'stream.verdict.noWs' };
  if (ok('turn-udp')) return { transport: 'webrtc', tone: 'ok', message: 'stream.verdict.udp' };
  if (ok('turn-tcp')) return { transport: 'webrtc', tone: 'warn', message: 'stream.verdict.tcp' };
  if (ok('turns')) return { transport: 'webrtc', tone: 'warn', message: 'stream.verdict.tls' };
  if (!tried('turn-udp')) return { transport: 'webrtc', tone: 'warn', message: 'stream.verdict.signIn' };
  if (ok('ws443')) return { transport: 'ws', tone: 'warn', message: 'stream.verdict.wsOnly' };
  return { transport: null, tone: 'bad', message: 'stream.verdict.blocked' };
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
