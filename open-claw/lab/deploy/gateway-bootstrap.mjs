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
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    prepareGatewayOwner();
    console.info('Gateway mount owner ready; runtime uid=1000 gid=1000.');
    // No config, helper or Gateway code is loaded until root is irreversibly
    // dropped. The existing starter retains its signal handling and validation.
    const { startGateway } = await import('./start-gateway.mjs');
    await startGateway();
  } catch {
    console.error('Gateway startup failed; mount ownership or runtime initialization unavailable.');
    process.exitCode = 1;
  }
}
