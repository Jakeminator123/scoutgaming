#!/usr/bin/env node
// Private Render disk export. Run during a quiesced maintenance window.
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCompanionState, COMPANION_STORE_FILE } from '../packages/director/node/companion-store.mjs';
import { parseSearchState, SEARCH_STORE_FILE } from '../services/openclaw/lab/deploy/companion-search-server.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = 'croupier-render-state-v1';
// The product profile (players/croupier.db, craig.db) left with the engine's SQLite path;
// game data is restored from Neon. Older product snapshots: ENVIRONMENT-RESTORATION.md.
const PROFILES = {
  director: [],
  gateway: ['openclaw.json'],
};
// The companion stores are atomically replaced JSON files. A hash only proves the
// copy; the owning module's parser proves the copy is a complete, usable store.
// Every other file, including retired companion.sqlite files and their journals
// left on a disk, is opaque: stopped writers make its exact bytes the state.
const STORES = { director: { [COMPANION_STORE_FILE]: parseCompanionState }, gateway: { [SEARCH_STORE_FILE]: parseSearchState } };

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function within(parent, target) {
  const part = relative(parent, target);
  return part === '' || (part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part));
}
function parts(name) {
  if (typeof name !== 'string' || !name || name.includes('\\') || name.includes(':') ||
    name.startsWith('/') || name.split('/').some(part => !part || part === '.' || part === '..' || /[\x00-\x1f]/.test(part))) fail('invalid_manifest');
  return name.split('/');
}
async function missing(path) {
  try { await lstat(path); return false; }
  catch (error) { if (error.code === 'ENOENT') return true; throw error; }
}
async function plain(path, directory = false) {
  const full = resolve(path), root = parse(full).root;
  let cursor = root;
  for (const part of relative(root, full).split(sep).filter(Boolean)) {
    cursor = join(cursor, part);
    const item = await lstat(cursor);
    if (item.isSymbolicLink()) fail('symlink_refused');
    if (cursor !== full && !item.isDirectory()) fail('invalid_parent');
  }
  const item = await lstat(full);
  if (directory ? !item.isDirectory() : !item.isFile()) fail('invalid_file_type');
  return item;
}
async function filesUnder(root) {
  await plain(root, true);
  const files = [];
  async function visit(folder, prefix = '') {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      parts(name);
      if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile())) fail('unsafe_source_entry');
      const full = join(folder, entry.name);
      await plain(full, entry.isDirectory());
      if (entry.isDirectory()) await visit(full, name);
      else files.push(name);
    }
  }
  await visit(root);
  return files.sort();
}
async function hashFile(path) {
  await plain(path);
  const before = await stat(path, { bigint: true });
  const input = await open(path, constants.O_RDONLY);
  try {
    const hash = createHash('sha256'), buffer = Buffer.allocUnsafe(64 * 1024);
    let bytes = 0;
    for (;;) {
      const { bytesRead } = await input.read(buffer, 0, buffer.length, bytes);
      if (!bytesRead) break;
      hash.update(buffer.subarray(0, bytesRead)); bytes += bytesRead;
    }
    const after = await stat(path, { bigint: true });
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs || BigInt(bytes) !== after.size) fail('source_changed');
    return { sha256: hash.digest('hex'), bytes };
  } finally { await input.close(); }
}
async function copyPlain(source, target) {
  const before = await hashFile(source);
  const input = await open(source, constants.O_RDONLY);
  try {
    const output = await open(target, 'wx', 0o600);
    try {
      const buffer = Buffer.allocUnsafe(64 * 1024);
      let offset = 0;
      for (;;) {
        const { bytesRead } = await input.read(buffer, 0, buffer.length, offset);
        if (!bytesRead) break;
        let written = 0;
        while (written < bytesRead) {
          const result = await output.write(buffer, written, bytesRead - written, offset + written);
          if (!result.bytesWritten) fail('copy_failed');
          written += result.bytesWritten;
        }
        offset += bytesRead;
      }
      await output.sync();
    } finally { await output.close(); }
  } finally { await input.close(); }
  const after = await hashFile(source), copied = await hashFile(target);
  if (JSON.stringify(before) !== JSON.stringify(after) || JSON.stringify(before) !== JSON.stringify(copied)) fail('source_changed');
  return copied;
}
async function checkStore(profile, name, path) {
  const parse = Object.hasOwn(STORES[profile], name) ? STORES[profile][name] : null;
  if (!parse) return;
  try { parse(await readFile(path, 'utf8')); } catch { fail('store_integrity_failed'); }
}
async function writeManifest(path, manifest) {
  const file = await open(path, 'wx', 0o600);
  try { await file.writeFile(JSON.stringify(manifest, null, 2) + '\n'); await file.sync(); }
  finally { await file.close(); }
}
async function removeOwnStage(stage, parent, prefix) {
  if (!stage || dirname(stage) !== parent || !basename(stage).startsWith(prefix)) return;
  const item = await lstat(stage).catch(error => error.code === 'ENOENT' ? null : Promise.reject(error));
  if (item?.isDirectory() && !item.isSymbolicLink()) await rm(stage, { recursive: true, force: true });
}
function checkProfile(profile, names) {
  if (!Object.hasOwn(PROFILES, profile)) fail('invalid_profile');
  if (!names.length || PROFILES[profile].some(name => !names.includes(name)) ||
    (profile === 'director' && !names.some(name => name === 'catalog.json' || name === COMPANION_STORE_FILE || name.startsWith('history/')))) fail('required_state_missing');
}
function separate(a, b) {
  if (within(a, b) || within(b, a)) fail('paths_overlap');
  if (within(REPO, b)) fail('destination_inside_checkout');
}

export async function verifyRenderBackup(snapshot) {
  const root = resolve(snapshot);
  await plain(root, true);
  await plain(join(root, 'manifest.json'));
  let manifest;
  try { manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8')); }
  catch { fail('invalid_manifest'); }
  if (manifest?.schema !== SCHEMA || !Object.hasOwn(PROFILES, manifest.profile) || !Array.isArray(manifest.files)) fail('invalid_manifest');
  const seen = new Set();
  for (const item of manifest.files) {
    parts(item?.path);
    if (item.path === 'manifest.json' || seen.has(item.path.toLowerCase()) ||
      !/^[a-f0-9]{64}$/.test(item.sha256) || !Number.isSafeInteger(item.bytes) || item.bytes < 0) fail('invalid_manifest');
    seen.add(item.path.toLowerCase());
  }
  checkProfile(manifest.profile, manifest.files.map(item => item.path));
  const actualNames = await filesUnder(root);
  if (JSON.stringify(actualNames) !== JSON.stringify([...manifest.files.map(item => item.path), 'manifest.json'].sort())) fail('unexpected_backup_entry');
  for (const item of manifest.files) {
    const file = join(root, ...parts(item.path));
    const actual = await hashFile(file);
    if (actual.sha256 !== item.sha256 || actual.bytes !== item.bytes) fail('backup_hash_mismatch');
    await checkStore(manifest.profile, item.path, file);
  }
  return manifest;
}

export async function backupRenderState({ profile, source, destination, quiesced = false } = {}) {
  if (!quiesced) fail('quiesced_required');
  if (typeof source !== 'string' || typeof destination !== 'string' || !isAbsolute(source) || !isAbsolute(destination)) fail('absolute_path_required');
  const root = resolve(source), target = resolve(destination), parent = dirname(target);
  await plain(root, true); await plain(parent, true); separate(root, target);
  if (!(await missing(target))) fail('destination_exists');
  const names = await filesUnder(root);
  checkProfile(profile, names);
  if (names.includes('manifest.json') || names.some(name => name.split('/').some(part => part.startsWith('.croupier-restore-partial-')))) fail('reserved_source_entry');
  const prefix = `.${basename(target)}.partial-`;
  let stage;
  try {
    stage = join(parent, `${prefix}${randomUUID()}`);
    await mkdir(stage, { mode: 0o700 });
    const files = [];
    for (const name of names) {
      const targetFile = join(stage, ...parts(name));
      await mkdir(dirname(targetFile), { recursive: true, mode: 0o700 });
      files.push({ path: name, ...await copyPlain(join(root, ...parts(name)), targetFile) });
    }
    if (JSON.stringify(await filesUnder(root)) !== JSON.stringify(names)) fail('source_changed');
    // Every file is exact bytes: hashed around its copy and once more after all copies.
    for (const item of files) {
      if (JSON.stringify(await hashFile(join(root, ...parts(item.path)))) !==
        JSON.stringify({ sha256: item.sha256, bytes: item.bytes })) fail('source_changed');
    }
    await writeManifest(join(stage, 'manifest.json'), { schema: SCHEMA, profile, createdAt: new Date().toISOString(), files });
    await verifyRenderBackup(stage);
    if (!(await missing(target))) fail('destination_exists');
    await rename(stage, target); stage = undefined;
    return { profile, files: files.length, bytes: files.reduce((sum, item) => sum + item.bytes, 0) };
  } finally { await removeOwnStage(stage, parent, prefix); }
}

export async function restoreRenderState({ snapshot, destination, quiesced = false, profile } = {}) {
  if (!quiesced) fail('quiesced_required');
  if (typeof snapshot !== 'string' || typeof destination !== 'string' || !isAbsolute(snapshot) || !isAbsolute(destination)) fail('absolute_path_required');
  const root = resolve(snapshot), target = resolve(destination);
  await plain(target, true); separate(root, target);
  const manifest = await verifyRenderBackup(root);
  if (profile !== manifest.profile) fail('profile_mismatch');
  if ((await readdir(target)).length) fail('destination_not_empty');
  const prefix = '.croupier-restore-partial-';
  let stage;
  const moved = [];
  try {
    stage = join(target, `${prefix}${randomUUID()}`);
    await mkdir(stage, { mode: 0o700 });
    for (const item of manifest.files) {
      const file = join(stage, ...parts(item.path));
      await mkdir(dirname(file), { recursive: true, mode: 0o700 });
      await copyPlain(join(root, ...parts(item.path)), file);
    }
    await writeManifest(join(stage, 'manifest.json'), manifest);
    await verifyRenderBackup(stage);
    const entries = (await readdir(stage)).filter(name => name !== 'manifest.json');
    for (const entry of entries) {
      if (!(await missing(join(target, entry)))) fail('destination_not_empty');
      await rename(join(stage, entry), join(target, entry));
      moved.push(entry);
    }
    return { profile, files: manifest.files.length };
  } catch (error) {
    for (const entry of moved.reverse()) await rename(join(target, entry), join(stage, entry));
    throw error;
  } finally { await removeOwnStage(stage, target, prefix); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  async function main() {
    const [command, ...rest] = process.argv.slice(2), options = {};
    if (rest.length % 2) fail('invalid_arguments');
    for (let i = 0; i < rest.length; i += 2) {
      if (!rest[i]?.startsWith('--') || !rest[i + 1] || Object.hasOwn(options, rest[i])) fail('invalid_arguments');
      options[rest[i]] = rest[i + 1];
    }
    const keys = Object.keys(options).sort().join(',');
    if (command === 'backup' && keys === '--destination,--profile,--quiesced,--source') {
      return backupRenderState({ profile: options['--profile'], source: options['--source'], destination: options['--destination'], quiesced: options['--quiesced'] === 'yes' });
    }
    if (command === 'verify' && keys === '--snapshot') return verifyRenderBackup(options['--snapshot']);
    if (command === 'restore' && keys === '--destination,--profile,--quiesced,--snapshot') {
      return restoreRenderState({ profile: options['--profile'], snapshot: options['--snapshot'], destination: options['--destination'], quiesced: options['--quiesced'] === 'yes' });
    }
    fail('invalid_arguments');
  }
  main().then(result => console.log(JSON.stringify({ status: 'verified', profile: result.profile, files: result.files?.length ?? result.files, bytes: result.bytes })))
    .catch(error => { console.error(error.code || 'render_state_failed'); process.exitCode = 1; });
}
