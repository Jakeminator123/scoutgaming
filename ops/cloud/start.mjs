#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { childSpecifications, inspectCloudBootstrap, inspectCloudDisk, validateCloudConfig } from './config.mjs';
import { createCloudGateway } from './gateway.mjs';
import { closeGateway, startChildren } from './process-group.mjs';
import { verifyCloudAccess } from './access-check.mjs';
import { createStorageExportServer } from './storage-export.mjs';
import { withChildDiagnostics } from './child-diagnostics.mjs';
import { SHUTDOWN_BUDGET, trackServerConnections } from '../../services/game/graceful-shutdown.mjs';

// Deliberate pilot opt-in is not a claim of production acceptance.
export function assertCloudAccessReady(env = process.env) {
  if (env.CROUPIER_CLOUD_LAUNCH !== 'pilot') {
    throw new Error('Cloud start requires CROUPIER_CLOUD_LAUNCH=pilot. Public deployment acceptance is still required.');
  }
}

function listen(server, port, host) {
  return new Promise((resolveReady, reject) => {
    const failed = error => { server.off('listening', ready); reject(error); };
    const ready = () => { server.off('error', failed); resolveReady(); };
    server.once('error', failed);
    server.once('listening', ready);
    server.listen(port, host);
  });
}

export async function openCheckedGateway(gateway, config, { checkAccess = verifyCloudAccess, signal } = {}) {
  trackServerConnections(gateway);
  try {
    // No externally reachable listener until actual local access checks pass.
    await listen(gateway, 0, '127.0.0.1');
    await checkAccess(config, { gatewayPort: gateway.address().port });
    await closeGateway(gateway);
    if (signal?.aborted) throw new Error('Cloud start was interrupted.');
    await listen(gateway, config.publicPort, '0.0.0.0');
  } catch (error) {
    await closeGateway(gateway);
    throw error;
  }
}

export async function stopCloudRuntime(gateway, children) {
  // Worker upgrades can be needed by the child's provider retirement. Signal
  // the game child before any gateway wait, then drain these paths in parallel.
  const childStop = children?.stop();
  await Promise.all([childStop, closeGateway(gateway, SHUTDOWN_BUDGET.childMs)]);
}

async function preflight(env) {
  const config = validateCloudConfig(env);
  await inspectCloudDisk(config);
  await inspectCloudBootstrap(config);
  return config;
}

// Production start forwards only the allowlisted finite game diagnostics.
export async function main(args = process.argv.slice(2), env = process.env) {
  if (args.length !== 1 || !['--check', '--start'].includes(args[0])) {
    throw new Error('Usage: node ops/cloud/start.mjs --check|--start');
  }
  const config = await preflight(env);
  if (args[0] === '--check') {
    console.log('Cloud configuration valid. No services started; public TLS, login, persistence and playback are not verified.');
    return 0;
  }
  assertCloudAccessReady(env);
  const abort = new AbortController();
  const stop = () => abort.abort();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  let children, gateway;
  try {
    if (config.storageExport) {
      gateway = createStorageExportServer(config, config.storageExport, { childlessStartup: true });
      trackServerConnections(gateway);
      await listen(gateway, config.publicPort, '0.0.0.0');
      console.log('Storage maintenance active; no game writers started.');
      await new Promise(done => { abort.signal.addEventListener('abort', done, { once: true }); if (abort.signal.aborted) done(); });
      return 0;
    }
    for (const path of Object.values(config.paths)) await mkdir(path, { recursive: true, mode: 0o700 });
    children = await startChildren(withChildDiagnostics(childSpecifications(config, env)), { signal: abort.signal });
    gateway = createCloudGateway(config, { vercelIngress: config.vercelIngress, renderGitCommit: env.RENDER_GIT_COMMIT });
    await openCheckedGateway(gateway, config, { signal: abort.signal });
    console.log('Cloud pilot listening after local access checks; public deployment acceptance remains outstanding.');
    const interrupted = new Promise(resolveDone => {
      abort.signal.addEventListener('abort', () => resolveDone('signal'), { once: true });
      if (abort.signal.aborted) resolveDone('signal');
    });
    const reason = await Promise.race([interrupted, children.ended]);
    if (reason !== 'signal') throw new Error('A cloud child exited unexpectedly.');
    return 0;
  } finally {
    try { await stopCloudRuntime(gateway, children); }
    finally {
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    // All validation errors contain variable names or fixed messages, never values.
    console.error(error.message);
    process.exitCode = 1;
  });
}
