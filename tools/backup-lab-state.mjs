#!/usr/bin/env node
// Compatibility entry point: private, offline copy of Lab player/studio state.
// Never point this at an active server or a destination inside the checkout.
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, realpath, readdir, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireLocalSession } from '../open-claw/lab/deploy/local-session.mjs';

const DEFAULT_REPO = resolve(fileURLToPath(new URL('..', import.meta.url)));
const REQUIRED = ['players/croupier.db', 'players/craig.db', 'project.json'];
const OPTIONAL = ['players/bo.json'];
const SIDECARS = ['-wal', '-shm', '-journal'];
const VIDEO_FILE = /^(?:index\.json|classifications\.json|[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\.(?:mp4|webm))$/i;
const BACKUP_FILE = /^(?:players\/(?:croupier\.db|craig\.db|bo\.json)|project\.json|history\/\d+-[0-9a-f-]{36}\.json)$/i;
const allowedBackupPath = path => BACKUP_FILE.test(path)
  || (path.startsWith('videos/') && VIDEO_FILE.test(path.slice('videos/'.length)));

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function inside(parent, target) {
  const part = relative(parent, target);
  return part === '' || (part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part));
}
async function missing(path) {
  try { await lstat(path); return false; }
  catch (error) { if (error.code === 'ENOENT') return true; throw error; }
}
async function plainPath(path, { directory = false } = {}) {
  const full = resolve(path), root = parse(full).root;
  let cursor = root;
  for (const segment of relative(root, full).split(sep).filter(Boolean)) {
    cursor = join(cursor, segment);
    const state = await lstat(cursor);
    if (state.isSymbolicLink()) fail('symlink_refused');
    if (cursor !== full && !state.isDirectory()) fail('parent_not_directory');
  }
  const state = await lstat(full);
  if (directory ? !state.isDirectory() : !state.isFile()) fail('unexpected_file_type');
  return state;
}
function sameFile(a, b) {
  return a.dev === b.dev && a.ino === b.ino && a.size === b.size
    && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs;
}
async function sidecarsAbsent(playersDir) {
  for (const db of ['croupier.db', 'craig.db']) for (const suffix of SIDECARS) {
    if (!(await missing(join(playersDir, db + suffix)))) fail('database_sidecar_present');
  }
}
async function sourceFiles(dataDir) {
  await plainPath(dataDir, { directory: true });
  const players = join(dataDir, 'players');
  await plainPath(players, { directory: true });
  await sidecarsAbsent(players);
  const files = [...REQUIRED];
  for (const name of REQUIRED) await plainPath(join(dataDir, name));
  for (const name of OPTIONAL) if (!(await missing(join(dataDir, name)))) {
    await plainPath(join(dataDir, name)); files.push(name);
  }
  const history = join(dataDir, 'history');
  if (!(await missing(history))) {
    await plainPath(history, { directory: true });
    for (const entry of await readdir(history, { withFileTypes: true })) {
      if (!/^\d+-[0-9a-f-]{36}\.json$/i.test(entry.name) || !entry.isFile() || entry.isSymbolicLink()) fail('unexpected_history_entry');
      await plainPath(join(history, entry.name));
      files.push(`history/${entry.name}`);
    }
  }
  const videos = join(dataDir, 'videos');
  if (!(await missing(videos))) {
    await plainPath(videos, { directory: true });
    for (const entry of await readdir(videos, { withFileTypes: true })) {
      if (!VIDEO_FILE.test(entry.name) || !entry.isFile() || entry.isSymbolicLink()) fail('unexpected_video_entry');
      await plainPath(join(videos, entry.name));
      files.push(`videos/${entry.name}`);
    }
  }
  return files.sort();
}
async function digest(handle) {
  const hash = createHash('sha256');
  const chunk = Buffer.allocUnsafe(64 * 1024);
  let offset = 0;
  for (;;) {
    const { bytesRead } = await handle.read(chunk, 0, chunk.length, offset);
    if (!bytesRead) break;
    hash.update(chunk.subarray(0, bytesRead));
    offset += bytesRead;
  }
  return { sha256: hash.digest('hex'), bytes: offset };
}
async function copyChecked(source, target) {
  const initial = await plainPath(source);
  const input = await open(source, constants.O_RDONLY);
  try {
    if (!sameFile(await input.stat({ bigint: true }), await lstat(source, { bigint: true }))) fail('source_changed');
    const output = await open(target, 'wx', 0o600);
    try {
      const hash = createHash('sha256'), chunk = Buffer.allocUnsafe(64 * 1024);
      let offset = 0;
      for (;;) {
        const { bytesRead } = await input.read(chunk, 0, chunk.length, offset);
        if (!bytesRead) break;
        hash.update(chunk.subarray(0, bytesRead));
        for (let written = 0; written < bytesRead;) {
          const result = await output.write(chunk, written, bytesRead - written, offset + written);
          if (!result.bytesWritten) fail('backup_write_failed');
          written += result.bytesWritten;
        }
        offset += bytesRead;
      }
      await output.sync();
      const copied = { sha256: hash.digest('hex'), bytes: offset };
      const again = await digest(input);
      if (copied.sha256 !== again.sha256 || copied.bytes !== again.bytes
        || !sameFile(await input.stat({ bigint: true }), await lstat(source, { bigint: true }))
        || initial.size !== copied.bytes) fail('source_changed');
      return copied;
    } finally { await output.close(); }
  } finally { await input.close(); }
}
async function sha256File(path) {
  await plainPath(path);
  const before = await lstat(path, { bigint: true });
  const handle = await open(path, constants.O_RDONLY);
  try {
    if (!sameFile(await handle.stat({ bigint: true }), before)) fail('source_changed');
    const value = await digest(handle);
    if (!sameFile(await handle.stat({ bigint: true }), await lstat(path, { bigint: true }))) fail('source_changed');
    return value;
  } finally { await handle.close(); }
}
export async function verifyLabBackup(directory) {
  await plainPath(directory, { directory: true });
  const manifestFile = join(directory, 'manifest.json');
  await plainPath(manifestFile);
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  if (manifest?.schema !== 'croupier-lissabon-backup-v1' || !Array.isArray(manifest.files)) fail('invalid_backup_manifest');
  const seen = new Set();
  for (const item of manifest.files) {
    if (typeof item?.path !== 'string' || !allowedBackupPath(item.path)
      || seen.has(item.path.toLowerCase()) || !/^[a-f0-9]{64}$/.test(item.sha256) || !Number.isSafeInteger(item.bytes) || item.bytes < 0) fail('invalid_backup_manifest');
    seen.add(item.path.toLowerCase());
    const actual = await sha256File(join(directory, ...item.path.split('/')));
    if (actual.sha256 !== item.sha256 || actual.bytes !== item.bytes) fail('backup_hash_mismatch');
  }
  if (REQUIRED.some(name => !seen.has(name))) fail('invalid_backup_manifest');
  return manifest;
}
async function removeOwnTemp(path, parent, prefix) {
  if (!path || dirname(path) !== parent || !basename(path).startsWith(prefix)) return;
  const state = await lstat(path).catch(error => error.code === 'ENOENT' ? null : Promise.reject(error));
  if (state?.isDirectory() && !state.isSymbolicLink()) await rm(path, { recursive: true, force: true });
}

export async function backupLabState({ repoRoot = DEFAULT_REPO, destination } = {}) {
  if (typeof destination !== 'string' || !isAbsolute(destination)) fail('absolute_destination_required');
  const repo = resolve(repoRoot), target = resolve(destination);
  await plainPath(repo, { directory: true });
  const parent = dirname(target);
  await plainPath(parent, { directory: true });
  const repoReal = await realpath(repo), parentReal = await realpath(parent);
  if (inside(repoReal, target) || inside(repoReal, parentReal) || inside(target, repoReal)) fail('destination_must_be_outside_checkout');
  if (!(await missing(target))) fail('destination_already_exists');
  const dataDir = join(repo, 'apps', 'studio', 'data');
  // The same guard used by the coordinated launchers blocks all Croupier
  // product/lab starts for the whole copy, including starts on other ports.
  const session = await acquireLocalSession({ repoRoot: repo, labPort: 4211 });
  let temporary;
  const tempPrefix = `.${basename(target)}.partial-`;
  try {
    await sidecarsAbsent(join(dataDir, 'players'));
    const files = await sourceFiles(dataDir);
    temporary = join(parent, `${tempPrefix}${randomUUID()}`);
    await mkdir(temporary, { mode: 0o700 });
    const records = [];
    for (const name of files) {
      const parts = name.split('/');
      const dest = join(temporary, ...parts);
      if (parts.length > 1) await mkdir(dirname(dest), { recursive: true, mode: 0o700 });
      records.push({ path: name, ...await copyChecked(join(dataDir, ...parts), dest) });
    }
    if (JSON.stringify(await sourceFiles(dataDir)) !== JSON.stringify(files)) fail('source_changed');
    for (const record of records) {
      const current = await sha256File(join(dataDir, ...record.path.split('/')));
      if (current.sha256 !== record.sha256 || current.bytes !== record.bytes) fail('source_changed');
    }
    const manifest = { schema: 'croupier-lissabon-backup-v1', createdAt: new Date().toISOString(), files: records };
    const manifestHandle = await open(join(temporary, 'manifest.json'), 'wx', 0o600);
    try { await manifestHandle.writeFile(JSON.stringify(manifest, null, 2) + '\n'); await manifestHandle.sync(); }
    finally { await manifestHandle.close(); }
    await verifyLabBackup(temporary);
    if (!(await missing(target))) fail('destination_already_exists');
    await rename(temporary, target);
    temporary = undefined;
    return { destination: target, files: records.length, bytes: records.reduce((sum, item) => sum + item.bytes, 0) };
  } finally {
    await removeOwnTemp(temporary, parent, tempPrefix);
    await session.release();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--destination') {
    console.error('Usage: node tools/backup-lab-state.mjs --destination <absolute-directory-outside-checkout>');
    process.exitCode = 2;
  } else {
    backupLabState({ destination: args[1] }).then(({ files, bytes }) => {
      console.log(JSON.stringify({ status: 'verified', files, bytes, manifest: 'manifest.json' }));
    }).catch(error => { console.error(error.code || 'backup_failed'); process.exitCode = 1; });
  }
}
