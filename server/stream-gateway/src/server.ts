// Entry point: `node dist/server.js` (the Docker image's command).
import { createAdmin, ADMIN_PORT } from './admin.js';
import { createGateway } from './app.js';
import { loadConfig } from './config.js';
import { MwClient } from './mw.js';
import { Store } from './store.js';

const log = (line: string) => console.log(`${new Date().toISOString()} ${line}`);
const { config, missing } = loadConfig();
if (missing.length) log(`not configured yet: ${missing.join(', ')}`);

const store = new Store(config.dataDir);
const mw = config.mwUrl && config.mwCertSha256 ? new MwClient(config.mwUrl, config.mwCertSha256, () => store.state.mw?.cookie ?? '') : null;
if (!store.state.mw) log('not linked to MoonlightWeb yet: run `node dist/cli.js link-mw` with a PIN');

const { server, close } = createGateway({ config, missing, store, mw, log });
server.listen(config.port, () => log(`stream gateway listening on :${config.port}`));
const admin = createAdmin(store, mw, log);
admin.listen(ADMIN_PORT, '127.0.0.1');

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    close();
    admin.close();
    process.exit(0);
  });
}
