#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { mkdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPOSITORY, childSpecifications, inspectCloudBootstrap, inspectCloudDisk, validateCloudConfig } from './config.mjs';
import { createCloudGateway } from './gateway.mjs';
import { closeGateway, startChildren } from './process-group.mjs';

// This code-level gate cannot be enabled by deployment environment variables.
// Replace it only alongside an authenticated Lab/Web access implementation and
// its public-host, Origin, cookie, and proxy tests.
export function assertCloudAccessReady() {
  throw new Error('Cloud start blocked: live authenticated access and deployment verification are incomplete.');
}

async function preflight(env) {
  const config = validateCloudConfig(env);
  await inspectCloudDisk(config);
  await inspectCloudBootstrap(config);
  const build = await stat(join(REPOSITORY, 'lab/.next/BUILD_ID')).catch(() => null);
  if (!build?.isFile()) throw new Error('A production Lab build is required.');
  return config;
}

export async function main(args = process.argv.slice(2), env = process.env) {
  if (args.length !== 1 || !['--check', '--start'].includes(args[0])) {
    throw new Error('Usage: node ops/cloud/start.mjs --check|--start');
  }
  const config = await preflight(env);
  if (args[0] === '--check') {
    console.log('Cloud layout valid; launch remains blocked pending live access and deployment verification.');
    return 2;
  }
  assertCloudAccessReady();
  // Unreachable until a reviewed code change replaces the gate above.
  const labInternalSecret = randomBytes(32).toString('hex');
  const abort = new AbortController();
  process.once('SIGINT', () => abort.abort());
  process.once('SIGTERM', () => abort.abort());
  for (const path of Object.values(config.paths)) await mkdir(path, { recursive: true, mode: 0o700 });
  const children = await startChildren(childSpecifications(config, env, { labInternalSecret }), { signal: abort.signal });
  const gateway = createCloudGateway(config, { labInternalSecret });
  try {
    await new Promise((yes, no) => {
      gateway.once('error', no);
      gateway.listen(config.publicPort, '0.0.0.0', () => { gateway.off('error', no); yes(); });
    });
    console.log('Cloud gateway listening; Web and Lab are on loopback.');
    const interrupted = new Promise(resolveDone => {
      abort.signal.addEventListener('abort', () => resolveDone('signal'), { once: true });
      if (abort.signal.aborted) resolveDone('signal');
    });
    const reason = await Promise.race([interrupted, children.ended]);
    if (reason !== 'signal') throw new Error('A cloud child exited unexpectedly.');
    return 0;
  } finally {
    await closeGateway(gateway);
    await children.stop();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    // All validation errors contain variable names or fixed messages, never values.
    console.error(error.message);
    process.exitCode = 1;
  });
}
