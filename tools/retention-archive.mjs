#!/usr/bin/env node
// Local immutable snapshots and completed observation sessions only. No cloud/data purge.
import { readdir, lstat, readFile, writeFile, mkdir, rename, rmdir, copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join, resolve, relative, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const locations = { projectHistory: 'apps/studio/data/history', observations: 'apps/studio/data/observations' };
const snapshotName = /^\d{13}-[a-f0-9-]{36}\.json$/;
const sessionName = /^\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-\d{3}Z$/;
const observationFiles = new Set(['verify.json', 'mapping.json', 'partner-events.jsonl', 'error.json', 'session.json', 'STOP']);
const fail = code => { throw Object.assign(new Error(code), { code }); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async path => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
const optionalStat = async path => lstat(path).catch(error => { if (error.code !== 'ENOENT') throw error; return null; });

// Reject links/junctions all the way to each leaf, including the archive root.
async function checkedPath(root, path) {
  const rel = relative(resolve(root), resolve(root, path));
  if (!rel || isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep) || resolve(root, rel) !== resolve(root, path)) fail('retention_path_invalid');
  let current = resolve(root);
  if ((await lstat(current)).isSymbolicLink()) fail('retention_link_refused');
  for (const part of rel.split(sep)) {
    current = join(current, part);
    const stat = await optionalStat(current);
    if (stat?.isSymbolicLink()) fail('retention_link_refused');
  }
  return current;
}

export async function readPolicy(root = repositoryRoot) {
  const value = await json(join(root, 'tools/retention-policy.json'));
  if (Object.keys(value).sort().join(',') !== 'observations,projectHistory') fail('retention_policy_invalid');
  for (const limits of Object.values(value)) {
    if (Object.keys(limits).sort().join(',') !== 'keepNewest,maxBytes,maxEntries'
      || !Object.values(limits).every(n => Number.isSafeInteger(n) && n > 0)
      || limits.keepNewest < 2 || limits.maxEntries < limits.keepNewest) fail('retention_policy_invalid');
  }
  return value;
}

async function entryInventory(root, category, name, { digest = false } = {}) {
  if (!(category === 'projectHistory' ? snapshotName : sessionName).test(name)) return null;
  const source = `${locations[category]}/${name}`, path = await checkedPath(root, source), stat = await lstat(path);
  let names;
  if (category === 'projectHistory') {
    if (!stat.isFile() || stat.nlink !== 1) fail('retention_entry_invalid');
    names = [''];
  } else {
    if (!stat.isDirectory()) fail('retention_entry_invalid');
    names = (await readdir(path)).sort();
    if (!names.includes('session.json')) return null; // Writer still owns the session.
    if (names.some(name => !observationFiles.has(name))) fail('retention_entry_invalid');
    const marker = await checkedPath(root, `${source}/session.json`);
    const finished = await json(marker);
    if (!Number.isFinite(Date.parse(finished.startedAt)) || !Number.isFinite(Date.parse(finished.endedAt))) fail('retention_session_invalid');
  }
  const files = [];
  for (const name of names) {
    const file = await checkedPath(root, name ? `${source}/${name}` : source), meta = await lstat(file);
    if (!meta.isFile() || meta.nlink !== 1) fail('retention_entry_invalid');
    files.push({ path: name, bytes: meta.size, mtimeMs: meta.mtimeMs,
      ...(digest ? { sha256: hash(await readFile(file)) } : {}) });
  }
  return { category, source, bytes: files.reduce((sum, file) => sum + file.bytes, 0), files };
}

export async function previewRetention({ root = repositoryRoot, categories = Object.keys(locations) } = {}) {
  const policy = await readPolicy(root), groups = [];
  if (!Array.isArray(categories) || categories.some(key => !Object.hasOwn(locations, key))) fail('retention_category_invalid');
  for (const category of categories) {
    const directory = await checkedPath(root, locations[category]);
    const names = await readdir(directory).catch(error => { if (error.code !== 'ENOENT') throw error; return []; });
    const entries = [];
    for (const name of names.sort()) {
      const entry = await entryInventory(root, category, name);
      if (entry) entries.push(entry);
    }
    let count = entries.length, bytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
    const limits = policy[category], selected = [];
    for (const entry of entries) {
      if (count <= limits.keepNewest || (count <= limits.maxEntries && bytes <= limits.maxBytes)) break;
      selected.push(entry); count--; bytes -= entry.bytes;
    }
    groups.push({ category, limits, totalEntries: entries.length, totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
      retainedEntries: count, retainedBytes: bytes, thresholdStillExceeded: count > limits.maxEntries || bytes > limits.maxBytes, selected });
  }
  return { schemaVersion: 1, groups };
}

async function withArchiveLock(root, operation) {
  const archive = await checkedPath(root, 'arkiv');
  await mkdir(archive, { recursive: true });
  const lock = await checkedPath(root, 'arkiv/.retention.lock');
  try { await mkdir(lock); } catch (error) { if (error.code === 'EEXIST') fail('retention_busy'); throw error; }
  try { return await operation(); } finally { await rmdir(lock); }
}

export async function archiveRetention({ root = repositoryRoot, categories } = {}) {
  return withArchiveLock(root, async () => {
    const plan = await previewRetention({ root, categories });
    const selected = plan.groups.flatMap(group => group.selected);
    if (!selected.length) return { ...plan, batch: null, archivedEntries: 0 };
    const batch = `arkiv/${new Date().toISOString().slice(0, 10)}/retention-${randomUUID()}`;
    const directory = await checkedPath(root, batch);
    await mkdir(directory, { recursive: true });
    const entries = [];
    for (const entry of selected) {
      const current = await entryInventory(root, entry.category, entry.source.split('/').at(-1));
      if (JSON.stringify(current) !== JSON.stringify(entry)) fail('retention_source_changed');
      entries.push(await entryInventory(root, entry.category, entry.source.split('/').at(-1), { digest: true }));
    }
    const manifest = { schemaVersion: 1, createdAt: new Date().toISOString(), state: 'planned', entries };
    await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    for (const entry of entries) {
      const current = await entryInventory(root, entry.category, entry.source.split('/').at(-1), { digest: true });
      if (JSON.stringify(current) !== JSON.stringify(entry)) fail('retention_source_changed');
      const source = await checkedPath(root, entry.source), target = await checkedPath(root, `${batch}/${entry.source}`);
      await mkdir(dirname(target), { recursive: true });
      if (await optionalStat(target)) fail('retention_target_exists');
      await rename(source, target);
    }
    // The initial manifest survives an interrupted move and is sufficient for recovery.
    manifest.state = 'complete';
    await writeFile(join(directory, 'manifest.tmp'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await rename(join(directory, 'manifest.tmp'), join(directory, 'manifest.json'));
    return { ...plan, batch, archivedEntries: entries.length };
  });
}

export async function restoreRetention({ root = repositoryRoot, batch, apply = false } = {}) {
  if (typeof batch !== 'string' || !/^arkiv\/\d{4}-\d\d-\d\d\/retention-[a-f0-9-]{36}$/.test(batch)) fail('retention_batch_invalid');
  const run = async () => {
    const manifest = await json(await checkedPath(root, `${batch}/manifest.json`));
    if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.entries) || !['planned', 'complete'].includes(manifest.state)) fail('retention_manifest_invalid');
    const result = [];
    for (const entry of manifest.entries) {
      const base = locations[entry.category], name = entry.source?.split('/').at(-1);
      if (!Object.hasOwn(locations, entry.category) || !base || entry.source !== `${base}/${name}` || !(entry.category === 'projectHistory' ? snapshotName : sessionName).test(name)
        || !Array.isArray(entry.files) || !entry.files.length) fail('retention_manifest_invalid');
      const expectedFiles = entry.category === 'projectHistory' ? [''] : entry.files.map(file => file.path);
      if (entry.category === 'projectHistory' && entry.files.length !== 1
        || entry.category === 'observations' && (!expectedFiles.includes('session.json') || expectedFiles.some(name => !observationFiles.has(name)))
        || new Set(expectedFiles).size !== expectedFiles.length) fail('retention_manifest_invalid');
      const source = await checkedPath(root, entry.source), archived = await checkedPath(root, `${batch}/${entry.source}`);
      const sourceExists = Boolean(await optionalStat(source)), archivedExists = Boolean(await optionalStat(archived));
      if (!archivedExists) {
        if (!sourceExists || manifest.state !== 'planned') fail('retention_archive_missing');
        result.push({ source: entry.source, status: 'not-moved' }); continue;
      }
      if (sourceExists) fail('retention_restore_target_exists');
      const meta = await lstat(archived);
      if (entry.category === 'projectHistory' ? !meta.isFile() : !meta.isDirectory()) fail('retention_manifest_invalid');
      if (entry.category === 'observations' && JSON.stringify((await readdir(archived)).sort()) !== JSON.stringify([...expectedFiles].sort())) fail('retention_archive_changed');
      for (const file of entry.files) {
        if (!expectedFiles.includes(file.path) || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) fail('retention_manifest_invalid');
        const path = await checkedPath(root, `${batch}/${entry.source}${file.path ? '/' + file.path : ''}`), stat = await lstat(path);
        if (!stat.isFile() || stat.nlink !== 1 || stat.size !== file.bytes || hash(await readFile(path)) !== file.sha256) fail('retention_archive_changed');
      }
      result.push({ source: entry.source, status: apply ? 'restored' : 'ready' });
    }
    if (apply) for (const entry of manifest.entries) {
      if (result.find(row => row.source === entry.source)?.status === 'not-moved') continue;
      const target = await checkedPath(root, entry.source);
      await mkdir(dirname(target), { recursive: true });
      if (entry.category === 'observations') await mkdir(target); // Never merge into a live capture.
      for (const file of entry.files) {
        const suffix = file.path ? '/' + file.path : '';
        await copyFile(await checkedPath(root, `${batch}/${entry.source}${suffix}`), await checkedPath(root, `${entry.source}${suffix}`), constants.COPYFILE_EXCL);
      }
    }
    return { batch, apply, entries: result, archivePreserved: true };
  };
  return apply ? withArchiveLock(root, run) : run();
}

export async function autoArchiveLocalArtifacts(category, { dataDir, root = repositoryRoot, warn = console.warn } = {}) {
  // Temporary fixtures, external data locations and cloud repositories do not opt in.
  if (dataDir && resolve(dataDir) !== join(root, 'apps/studio/data')) return { skipped: true };
  try { return await archiveRetention({ root, categories: [category] }); }
  catch (error) { if (error.code !== 'retention_busy') warn('Lokal arkivering kunde inte slutföras. Sparade data är kvar; kör node tools/retention-archive.mjs för kontroll.'); return { deferred: true }; }
}

export async function main(args = process.argv.slice(2)) {
  const apply = args.includes('--apply'), restoreIndex = args.indexOf('--restore');
  const expected = restoreIndex < 0 ? (apply ? ['--apply'] : []) : ['--restore', args[restoreIndex + 1], ...(apply ? ['--apply'] : [])];
  if (args.length !== expected.length || args.some(arg => !expected.includes(arg))) fail('Usage: node tools/retention-archive.mjs [--apply] | --restore arkiv/YYYY-MM-DD/retention-ID [--apply]');
  const result = restoreIndex < 0 ? await (apply ? archiveRetention() : previewRetention()) : await restoreRetention({ batch: args[restoreIndex + 1], apply });
  console.log(JSON.stringify(result, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.code ?? 'retention_failed'); process.exitCode = 1; });
