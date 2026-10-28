// Owner-only operations the CLI asks the running server to do, on a port bound to 127.0.0.1 inside the container
// (`docker exec` reaches it, nothing outside does). The server stays the only writer of state.json.
import { createServer, type Server } from 'node:http';
import { spkiOf } from './mwbind.js';
import type { MwApi } from './mw.js';
import type { Store } from './store.js';

export const ADMIN_PORT = 8081;

/** Sign the gateway in to MoonlightWeb with a one-time PIN and register its MW-BIND key. */
export async function linkMw(store: Store, mw: MwApi, pin: string): Promise<{ hostId: string }> {
  if (!/^\d{4,12}$/.test(pin)) throw new Error('The PIN should be digits only');
  const link = await mw.validate(pin, spkiOf(store.state.pairingKey).toString('base64'));
  store.state.mw = { ...link, linkedAt: new Date().toISOString() };
  store.save();
  return { hostId: link.hostId };
}

/** Forget the TOTP secret and end every sign-in; the next sign-in shows the QR again. */
export function resetTotp(store: Store): void {
  delete store.state.totp;
  store.state.generation += 1;
  store.state.families = {};
  store.state.refresh = {};
  store.save();
}

export function createAdmin(store: Store, mw: MwApi | null, log: (line: string) => void): Server {
  return createServer(async (req, res) => {
    const reply = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    };
    let raw = '';
    for await (const c of req) {
      raw += c;
      if (raw.length > 1024) return reply(413, { error: 'too large' });
    }
    try {
      if (req.method === 'POST' && req.url === '/link-mw') {
        if (!mw) return reply(503, { error: 'MW_URL or MW_CERT_SHA256 is not set' });
        const { pin } = JSON.parse(raw || '{}') as { pin?: string };
        const r = await linkMw(store, mw, String(pin ?? '').trim());
        log('linked to MoonlightWeb');
        return reply(200, { ok: true, ...r });
      }
      if (req.method === 'POST' && req.url === '/reset-totp') {
        resetTotp(store);
        log('two-factor sign-in was reset; every sign-in ended');
        return reply(200, { ok: true });
      }
      reply(404, { error: 'not found' });
    } catch (e) {
      reply(400, { error: (e as Error).message });
    }
  });
}
