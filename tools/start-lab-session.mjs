#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireLocalSession } from '../open-claw/lab/deploy/local-session.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function startLabSession({ repoRoot = root, port = 4188 } = {}) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local lab port.');
  const session = await acquireLocalSession({ repoRoot, labPort: port });
  let child, interrupted = false;
  const stop = () => { interrupted = true; child?.kill('SIGTERM'); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  async function run(command, args, options = {}) {
    if (interrupted) throw new Error('Labbstarten avbröts.');
    return await new Promise((yes, no) => {
      child = spawn(command, args, { cwd: join(repoRoot, 'apps', 'studio'), windowsHide: true, stdio: 'inherit',
        env: session.environment(process.env), ...options });
      child.once('error', no);
      child.once('exit', code => { child = null; code === 0 ? yes() : no(new Error(`Labbprocessen avslutades (${code}).`)); });
      try { session.trackChild(child); } catch (error) { child.kill(); no(error); }
    });
  }
  try {
    const next = join(repoRoot, 'apps', 'studio', 'node_modules', 'next', 'dist', 'bin', 'next');
    if (!existsSync(next)) {
      // The fixed npm command runs inside the lease too: it changes shared deps.
      await run('npm', ['ci'], { shell: process.platform === 'win32' });
    }
    await run(process.execPath, [next, 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)]);
  } finally {
    process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
    await session.release();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--port') throw new Error('Use --port <local-port>.');
    await startLabSession({ port: Number(args[1]) });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
