import { randomUUID } from 'node:crypto';
import { lstat, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import lockfile from 'proper-lockfile';
import { safeDirectory, uploadDirectory } from './video-uploads.mjs';
import { validateVideoMetadata } from './video-intake.mjs';
import { StudioError } from './project-store.mjs';
const LIMIT = 8 * 1024 * 1024;
const validId = id => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id);

export async function readClassifications(options = {}) {
  const dir = uploadDirectory(options);
  try {
    await safeDirectory(dir);
    const file = join(dir, 'classifications.json'), info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size > LIMIT) throw new Error('Invalid registry');
    const data = JSON.parse(await readFile(file, 'utf8'));
    if (data.schemaVersion !== 1 || !Array.isArray(data.entries) || data.entries.length > 10000) throw new Error('Invalid registry');
    const ids = new Set();
    for (const row of data.entries) {
      if (!validId(row.id) || ids.has(row.id) || !/^[a-f0-9]{64}$/.test(row.sha256)) throw new Error('Invalid entry');
      validateVideoMetadata(row.metadata); ids.add(row.id);
    }
    return data.entries;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new StudioError('Kategoriseringsregistret kunde inte läsas. Filerna är bevarade.', 503);
  }
}

// Metadata overlay only: original video bytes and source inventory never change.
// Optimistic comparison plus a directory lock prevents lost edits across tabs.
export async function classifyVideo(body, registry, options = {}) {
  if (!body || Object.keys(body).some(k => !['id', 'sha256', 'metadata', 'previous'].includes(k)) || !validId(body.id)) throw new StudioError('Ogiltig videokategorisering.');
  const video = registry.videos.find(v => v.id === body.id);
  if (!video || video.sha256 !== body.sha256 || !video.available) throw new StudioError('Videon saknas eller har ändrats. Läs om banken.', 409);
  if (video.familyId) throw new StudioError('Manifeststyrd video kategoriseras genom sin fysiska familjemapp.', 409);
  let metadata;
  try { metadata = validateVideoMetadata(body.metadata, {forWrite:true}); }
  catch (error) { throw new StudioError(error.message); }
  const dir = uploadDirectory(options);
  await safeDirectory(dir, true);
  let release, compromised = false;
  try { release = await lockfile.lock(dir, { lockfilePath: join(dir, '.classification.lock'), retries: 0, onCompromised: () => { compromised = true; } }); }
  catch (error) { if (error.code === 'ELOCKED') throw new StudioError('En annan kategorisering sparas. Försök igen.', 423); throw error; }
  const temp = join(dir, `${randomUUID()}.classification.tmp`);
  try {
    const entries = await readClassifications(options);
    const old = entries.find(v => v.id === body.id);
    const current = (old?.sha256 === video.sha256 ? old.metadata : undefined) ?? video.classification ?? null;
    const canonical = value => JSON.stringify(value && Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
    if (canonical(body.previous ?? null) !== canonical(current)) throw new StudioError('Kategoriseringen har ändrats i ett annat fönster. Läs om banken.', 409);
    const row = { id: video.id, sha256: video.sha256, metadata, updatedAt: new Date().toISOString() };
    const next = entries.filter(v => v.id !== video.id); next.push(row);
    const json = JSON.stringify({ schemaVersion: 1, entries: next }, null, 2) + '\n';
    if (next.length > 10000 || Buffer.byteLength(json) > LIMIT) throw new StudioError('Kategoriseringsregistret är fullt.', 409);
    await writeFile(temp, json, { flag: 'wx' });
    if (compromised) throw new StudioError('Skrivlåset ändrades. Försök igen.', 423);
    await rename(temp, join(dir, 'classifications.json'));
    return row;
  } finally { await unlink(temp).catch(() => {}); await release(); }
}
