// Setup commands, run inside the container. Secrets come in on stdin, so they never reach the shell history:
//   docker exec -i stream-gateway node dist/cli.js hash-password   (prints GATEWAY_PASSWORD_HASH)
//   docker exec -i stream-gateway node dist/cli.js link-mw         (PIN from `moonlightweb --new-pin`)
//   docker exec stream-gateway node dist/cli.js reset-totp         (shows the QR again on the next sign-in)
import { randomBytes } from 'node:crypto';
import { argon2id } from 'hash-wasm';
import { ADMIN_PORT } from './admin.js';

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) process.stderr.write('(type it, then press Enter and Ctrl-D)\n');
  let s = '';
  for await (const c of process.stdin) s += c;
  return s.replace(/\r?\n$/, '');
}

export async function hashPassword(password: string, memorySize = 65536): Promise<string> {
  return argon2id({ password, salt: randomBytes(16), parallelism: 1, iterations: 3, memorySize, hashLength: 32, outputType: 'encoded' });
}

async function admin(path: string, body: unknown): Promise<void> {
  const r = await fetch(`http://127.0.0.1:${ADMIN_PORT}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await r.json()) as Record<string, unknown>;
  if (!r.ok) throw new Error(String(data.error ?? r.status));
  console.log(JSON.stringify(data));
}

async function main(cmd: string | undefined): Promise<void> {
  if (cmd === 'hash-password') {
    const pw = await readStdin();
    if (pw.length < 12) throw new Error('Use a password of at least 12 characters');
    console.log(await hashPassword(pw));
  } else if (cmd === 'link-mw') {
    await admin('/link-mw', { pin: (await readStdin()).trim() });
  } else if (cmd === 'reset-totp') {
    await admin('/reset-totp', {});
  } else {
    console.error('usage: node dist/cli.js hash-password | link-mw | reset-totp');
    process.exitCode = 2;
  }
}

if (process.argv[1]?.endsWith('cli.js')) {
  main(process.argv[2]).catch((e: Error) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
