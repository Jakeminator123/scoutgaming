import {readLocalAlphaMedia} from './video-alpha-reader.mjs';
import { randomUUID } from 'node:crypto';
import { writeFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import lockfile from 'proper-lockfile';
import {LIMIT,safeDirectory,uploadDirectory,readClassifications,validClassificationVideoId as validId} from './video-local-readers.mjs';
import { validateVideoMetadata } from '../../packages/presentation/contracts/video-intake.mjs';
import { StudioError } from './project-store.mjs';

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
  if(metadata.compositing?.mode==='alpha'&&video.classification?.compositing?.mode!=='alpha'){
    const response=await (options.readAlphaMedia??readLocalAlphaMedia)(video.id,options);
    if(!response.ok)throw new StudioError('Alfafilen kunde inte läsas.',503);
    const {assertMediaAlpha}=await import('./media-alpha.mjs');
    await assertMediaAlpha(Buffer.from(await response.arrayBuffer()),response.headers.get('content-type')?.split(';')[0]);
  }
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
