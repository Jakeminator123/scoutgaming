import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Render fromService exposes hostport; Blueprint YAML cannot interpolate URLs.
if (!process.env.OPENCLAW_BASE_URL && process.env.OPENCLAW_HOSTPORT) {
  const hostport = process.env.OPENCLAW_HOSTPORT;
  if (!/^[a-zA-Z0-9.-]+:\d{1,5}$/.test(hostport)) {
    throw new Error('OPENCLAW_HOSTPORT must be a private hostname:port.');
  }
  process.env.OPENCLAW_BASE_URL = `http://${hostport}`;
}

const serverPath = fileURLToPath(new URL('../src/server.mjs', import.meta.url));
const server = spawn(process.execPath, [serverPath], { stdio: 'inherit', env: process.env });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.kill(signal));
server.on('error', () => {
  console.error('Unable to start the Croupier lab Director.');
  process.exitCode = 1;
});
server.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
