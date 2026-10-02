#!/usr/bin/env node
// Offline, no-overwrite migration. The complete retired directory is backed
// up outside Git before saved state is merged into Lab and the source removed.
import { createHash, randomUUID } from 'node:crypto';
import { constants, createReadStream } from 'node:fs';
import { copyFile, lstat, mkdir, readdir, readFile, realpath, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireLocalSession } from '../open-claw/lab/deploy/local-session.mjs';

const fail = code => { throw Object.assign(new Error(code), { code }); };
const inside = (parent, target) => {
  const part = relative(parent, target);
  return part === '' || (part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part));
};
async function state(path) {
  try { return await lstat(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function plain(path) {
  const full = resolve(path), root = parse(full).root;
  let cursor = root;
  for (const part of relative(root, full).split(sep).filter(Boolean)) {
    cursor = join(cursor, part);
    const value = await state(cursor);
    if (!value) break;
    if (value.isSymbolicLink()) fail('symlink_refused');
    if (cursor !== full && !value.isDirectory()) fail('parent_not_directory');
  }
  return state(full);
}
async function inventory(directory, prefix = '') {
  const value = await plain(directory);
  if (!value?.isDirectory()) fail('source_not_directory');
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name, file = join(directory, entry.name);
    if (entry.isSymbolicLink()) fail('symlink_refused');
    if (entry.isDirectory()) files.push(...await inventory(file, name + '/'));
    else if (entry.isFile()) files.push(name);
    else fail('special_file_refused');
  }
  return files.sort();
}
async function digest(file) {
  if (!(await plain(file))?.isFile()) fail('source_not_file');
  const before = await lstat(file, { bigint: true });
  const hash = createHash('sha256'); let bytes = 0;
  for await (const chunk of createReadStream(file)) { hash.update(chunk); bytes += chunk.length; }
  const after = await lstat(file, { bigint: true });
  if (before.ino !== after.ino || before.dev !== after.dev || before.size !== after.size
    || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs) fail('source_changed');
  return { bytes, sha256: hash.digest('hex') };
}
async function matches(file, expected) {
  const value = await digest(file);
  if (value.bytes !== expected.bytes || value.sha256 !== expected.sha256) fail('hash_mismatch');
}
const pathFor = (root, name) => join(root, ...name.split('/'));
function validPath(name) {
  return typeof name === 'string' && name.length > 0 && !name.includes('\\')
    && !name.includes(':') && name.split('/').every(part => part && part !== '.' && part !== '..');
}
export async function verifyLabMigrationBackup(destination) {
  await plain(destination);
  const manifest = JSON.parse(await readFile(join(destination, 'manifest.json'), 'utf8'));
  if (manifest?.schema !== 'croupier-lab-migration-v1' || !Array.isArray(manifest.files)) fail('invalid_manifest');
  const seen = new Set();
  for (const file of manifest.files) {
    if (!validPath(file?.path) || seen.has(file.path.toLowerCase()) || !/^[a-f0-9]{64}$/.test(file.sha256)
      || !Number.isSafeInteger(file.bytes) || file.bytes < 0) fail('invalid_manifest');
    seen.add(file.path.toLowerCase());
    await matches(pathFor(join(destination, 'lissabon'), file.path), file);
  }
  if (JSON.stringify(await inventory(join(destination, 'lissabon'))) !== JSON.stringify(manifest.files.map(file => file.path).sort())) fail('backup_file_set_changed');
  return manifest;
}
export async function migrateLabState({ repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url))), destination, apply = false } = {}) {
  const root = await realpath(resolve(repoRoot)), source = join(root, 'lissabon'), target = join(root, 'lab', 'data');
  if (!(await plain(source))) return { status: 'already_migrated', files: 0, bytes: 0 };
  // Both paths are fixed children of the verified repository, never CLI paths.
  if (!inside(root, source) || !inside(root, target)) fail('invalid_source');
  if (typeof destination !== 'string' || !isAbsolute(destination)) fail('absolute_destination_required');
  const backup = resolve(destination), parent = dirname(backup);
  if (!(await plain(parent))?.isDirectory()) fail('backup_parent_required');
  const parentReal = await realpath(parent);
  if (inside(root, backup) || inside(root, parentReal) || inside(backup, root)) fail('backup_must_be_outside_checkout');
  if (await state(backup)) fail('backup_already_exists');
  const session = await acquireLocalSession({ repoRoot: root, labPort: 4211 });
  const created = []; let temporary;
  try {
    const names = await inventory(source);
    if (names.some(name => /^data\/players\/.*\.(?:db|sqlite)(?:-wal|-shm|-journal)$/i.test(name))) fail('database_sidecar_present');
    const files = [];
    for (const name of names) {
      if (!validPath(name)) fail('invalid_source_path');
      files.push({ path: name, ...await digest(pathFor(source, name)) });
    }
    const saved = files.filter(file => file.path.startsWith('data/') && !/^data\/\.local-session\.sqlite(?:-wal|-shm|-journal)?$/.test(file.path));
    for (const file of saved) {
      const output = pathFor(target, file.path.slice(5));
      if (await plain(output)) {
        try { await matches(output, file); } catch { fail('target_conflict'); }
      }
    }
    if (!apply) return { status: 'ready', files: saved.length, bytes: saved.reduce((n, file) => n + file.bytes, 0) };
    temporary = join(parent, `.${parse(backup).base}.partial-${randomUUID()}`);
    await mkdir(join(temporary, 'lissabon'), { recursive: true, mode: 0o700 });
    for (const file of files) {
      const output = pathFor(join(temporary, 'lissabon'), file.path);
      await mkdir(dirname(output), { recursive: true, mode: 0o700 });
      await copyFile(pathFor(source, file.path), output, constants.COPYFILE_EXCL);
      await matches(output, file); await matches(pathFor(source, file.path), file);
    }
    await writeFile(join(temporary, 'manifest.json'), JSON.stringify({ schema: 'croupier-lab-migration-v1', createdAt: new Date().toISOString(), files }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await verifyLabMigrationBackup(temporary);
    await rename(temporary, backup); temporary = undefined;
    for (const file of saved) {
      const output = pathFor(target, file.path.slice(5));
      if (!(await plain(output))) {
        await mkdir(dirname(output), { recursive: true, mode: 0o700 });
        await copyFile(pathFor(source, file.path), output, constants.COPYFILE_EXCL);
        created.push({ output, file });
      }
      await matches(output, file);
    }
    if (JSON.stringify(await inventory(source)) !== JSON.stringify(names)) fail('source_changed');
    for (const file of files) await matches(pathFor(source, file.path), file);
    for (const file of saved) await matches(pathFor(target, file.path.slice(5)), file);
    await verifyLabMigrationBackup(backup);
    // No fallible data operations remain. Preserve target copies even if source
    // removal is interrupted; the verified backup contains the entire source.
    created.length = 0;
    if (await realpath(source) !== source || source !== join(root, 'lissabon')) fail('invalid_source');
    await rm(source, { recursive: true });
    return { status: 'migrated', files: saved.length, bytes: saved.reduce((n, file) => n + file.bytes, 0), backupFiles: files.length, destination: backup };
  } catch (error) {
    for (const item of created.reverse()) {
      // Roll back only unchanged copies created by this call.
      try { await matches(item.output, item.file); await unlink(item.output); } catch { /* Preserve uncertain files. */ }
    }
    throw error;
  } finally {
    if (temporary && dirname(temporary) === parent && parse(temporary).base.startsWith(`.${parse(backup).base}.partial-`)) await rm(temporary, { recursive: true, force: true });
    await session.release();
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args[0] !== '--destination' || !args[1] || args.slice(2).some(arg => arg !== '--apply')) {
    console.error('Usage: node tools/migrate-lab-state.mjs --destination <new-private-backup-directory> [--apply]'); process.exitCode = 2;
  } else migrateLabState({ destination: args[1], apply: args.includes('--apply') })
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(error.code || 'migration_failed'); process.exitCode = 1; });
}
