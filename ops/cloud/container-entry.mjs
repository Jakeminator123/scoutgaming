import { chown, chmod, lstat, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The image's node account is UID/GID 1000. A fresh platform volume may be
// root-owned. Fix only its exact mount directory, then drop root BEFORE apps,
// databases, provider settings or any public listener are initialized.
export async function prepareContainerUser(env = process.env, { fs = { chown, chmod, lstat, realpath }, proc = process } = {}) {
  if (env.CROUPIER_CLOUD_DATA_ROOT !== '/var/data') throw new Error('Container requires the persistent disk at /var/data.');
  const info = await fs.lstat('/var/data');
  if (!info.isDirectory() || info.isSymbolicLink() || await fs.realpath('/var/data') !== '/var/data') {
    throw new Error('Container data mount must be a real directory.');
  }
  if (proc.getuid() === 0) {
    await fs.chown('/var/data', 1000, 1000);
    await fs.chmod('/var/data', 0o700);
    proc.setgroups([]);
    proc.setgid(1000);
    proc.setuid(1000);
  }
  if (proc.getuid() !== 1000 || proc.getgid() !== 1000) throw new Error('Container must run as the node account.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepareContainerUser().then(async () => {
    const { main } = await import('./start.mjs');
    process.exitCode = await main(['--start']);
  }).catch(() => {
    console.error('Cloud container could not start. Check mount, build, required configuration and access checks.');
    process.exitCode = 1;
  });
}
