import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const STATE_DIR = '/data/openclaw';
// The pinned official Node/OpenClaw image supplies node as uid/gid 1000.
const NODE_ID = 1000;
const fail = () => { throw new Error('gateway_mount_owner_unavailable'); };

// Render mounts its root-owned disk after Docker's build-time chown. Native
// config.patch tightens the containing directory and therefore needs ownership,
// even when the group can already create files there. Never recurse into state.
export function prepareGatewayOwner({ filesystem = fs, system = process } = {}) {
  if (system.platform !== 'linux' || ![0, NODE_ID].includes(system.getuid())
    || system.env.OPENCLAW_STATE_DIR !== STATE_DIR) fail();
  const root = system.getuid() === 0;
  const descriptor = filesystem.openSync(STATE_DIR,
    filesystem.constants.O_RDONLY | filesystem.constants.O_DIRECTORY | filesystem.constants.O_NOFOLLOW);
  try {
    const stat = filesystem.fstatSync(descriptor);
    if (!stat.isDirectory() || ![0, NODE_ID].includes(stat.uid)) fail();
    if (stat.uid !== NODE_ID || stat.gid !== NODE_ID) {
      if (!root) fail();
      filesystem.fchownSync(descriptor, NODE_ID, NODE_ID);
    }
    const verified = filesystem.fstatSync(descriptor);
    if (verified.uid !== NODE_ID || verified.gid !== NODE_ID) fail();
  } finally { filesystem.closeSync(descriptor); }
  if (root) {
    system.setgroups([]);
    system.setgid(NODE_ID);
    system.setuid(NODE_ID);
  }
  if (system.getuid() !== NODE_ID || system.geteuid() !== NODE_ID
    || system.getgid() !== NODE_ID || system.getegid() !== NODE_ID
    || system.getgroups().some(group => group !== NODE_ID)) fail();
  // setuid does not update Docker's root-user environment. The CLI still uses
  // HOME for paths outside OPENCLAW_STATE_DIR, even when config is explicit.
  system.env.HOME = '/home/node';
  system.env.USER = 'node';
  system.env.LOGNAME = 'node';
}

const PHASES = new Set(['mount-owner', 'init-exec', 'starter-import', 'runtime-start', 'environment', 'config-read',
  'config-plan', 'config-write', 'config-validate', 'runtime-bundle', 'helper-start', 'gateway-spawn']);
const ERROR_CODES = new Set(['EACCES', 'EPERM', 'ENOENT', 'ENOTDIR', 'ELOOP', 'EROFS', 'ENOSPC',
  'EEXIST', 'EMFILE', 'ENFILE', 'EIO', 'ERR_MODULE_NOT_FOUND', 'ERR_DLOPEN_FAILED',
  'GATEWAY_CONFIG_VALIDATION_FAILED']);

export function gatewayStartupFailure(error, phase) {
  const safePhase = PHASES.has(phase) ? phase : 'runtime-start';
  const code = ERROR_CODES.has(error?.code) ? error.code : 'UNAVAILABLE';
  return `Gateway startup failed; phase=${safePhase} code=${code}.`;
}

// Replace the root bootstrap only AFTER the irreversible uid/gid drop. Tini
// and every child then share uid 1000, so forwarding needs no CAP_KILL, while
// PID 1 still reaps orphaned descendants. The pinned Linux image supplies both.
export function runGatewayInit({ owner = prepareGatewayOwner, system = process,
  execute = (...args) => process.execve(...args), logger = console } = {}) {
  let phase = 'mount-owner';
  try {
    owner();
    phase = 'init-exec';
    execute('/usr/bin/tini', ['/usr/bin/tini', '-s', '--', system.execPath,
      '/opt/croupier-gateway/gateway-bootstrap.mjs', '--runtime'], system.env);
    return true; // Only reached by an injected test executor; execve replaces us.
  } catch (error) {
    logger.error(gatewayStartupFailure(error, phase));
    return false;
  }
}
export async function runGatewayBootstrap({ owner = prepareGatewayOwner,
  loadStarter = () => import('./start-gateway.mjs'), logger = console } = {}) {
  let phase = 'mount-owner';
  try {
    owner();
    logger.info('Gateway mount owner ready; runtime uid=1000 gid=1000.');
    // No config, helper or Gateway code is loaded until root is irreversibly
    // dropped. The existing starter retains its signal handling and validation.
    phase = 'starter-import';
    const { startGateway } = await loadStarter();
    phase = 'runtime-start';
    await startGateway({ onPhase: (next) => { phase = next; } });
    return true;
  } catch (error) {
    logger.error(gatewayStartupFailure(error, phase));
    return false;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ok = process.argv[2] === '--runtime' ? await runGatewayBootstrap() : runGatewayInit();
  if (!ok) process.exitCode = 1;
}
