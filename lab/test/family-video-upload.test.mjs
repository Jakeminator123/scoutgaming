import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { MEDIA_FAMILY_DEFINITIONS } from '../../packages/presentation/runtime/media-families.mjs';
import { mediaLineForEvent, mediaVariantPolicy } from '../../packages/presentation/runtime/media-family-policy.mjs';
import { buildLabVideoManifest, manifestJson } from '../../tools/media/build-lab-video-manifest.mjs';
import { createSeedProject } from '../lib/studio-model.mjs';
import { validateVideoMetadata } from '../lib/video-intake.mjs';
import { uploadVideo } from '../lib/video-uploads.mjs';
import { loadVideoRegistry, getVideoResponse } from '../lib/video-registry.mjs';

const bytes = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom00000000family-upload-fixture')]);
const metadata = { familyId: 'astrid/deal.player.left/box0', label: 'Ny kortvariant.mp4', dealerId: 'astrid', eventId: 'deal.player.left', kind: 'action', role: 'alternative', situation: 'box0', playback: 'once', notes: '' };
const request = fields => new Request('http://localhost:4188/api/videos', { method: 'POST', headers: { 'content-type': 'video/mp4', 'x-video-metadata': encodeURIComponent(JSON.stringify(fields)) }, body: bytes, duplex: 'half' });

test('explicit family upload survives reload, joins exact shared selection manually and serves two range reads', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'croupier-family-upload-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const archiveDir = join(dir, 'archive');
  for (const family of MEDIA_FAMILY_DEFINITIONS) for (const file of family.standardPaths) {
    const path = join(archiveDir, file); await mkdir(dirname(path), { recursive: true }); await writeFile(path, `fixture:${file}`);
    await mkdir(join(archiveDir, family.variantDirectory), { recursive: true });
  }
  const snapshotPath = join(archiveDir, 'lab-video-manifest.json');
  await writeFile(snapshotPath, manifestJson(await buildLabVideoManifest({ root: archiveDir })));
  const before = await readFile(snapshotPath, 'utf8');
  const options = { archiveDir, snapshotPath, uploadDir: join(dir, 'uploads') };
  const result = await uploadVideo(request(metadata), options);
  assert.deepEqual(await uploadVideo(request(metadata), options), { ...result, duplicate: true });
  const inventory = await loadVideoRegistry(options);
  const video = inventory.videos.find(row => row.id === result.id);
  assert.equal(video.familyId, metadata.familyId); assert.equal(video.role, 'variant');
  assert.equal(video.bindingScope, 'shared-local'); assert.equal(video.source, 'upload');
  assert.equal(video.reviewStatus, 'unreviewed'); assert.equal(video.fileName, `${result.id}.mp4`);
  assert.equal(video.label, metadata.label);
  const family = inventory.families.find(row => row.id === metadata.familyId);
  assert.deepEqual(family.variantIds, [result.id]); assert.equal(family.standardIds.length, 1);
  const project = createSeedProject();
  assert.deepEqual(mediaVariantPolicy(project, family, result.id).selection, { rules: false, random: false, model: false });
  const event = { type: 'deal', to: 'box', box: 0, card: 'AS', handIndex: 0 };
  const selected = mediaLineForEvent(project, inventory, 'astrid', metadata.eventId, event);
  assert.ok(selected.line.variants.some(row => row.videoGenerationId === result.id));
  const other = mediaLineForEvent(project, inventory, 'astrid', metadata.eventId, { ...event, box: 1 });
  assert.ok(!other.line.variants.some(row => row.videoGenerationId === result.id));
  for (let i = 0; i < 2; i++) {
    const response = await getVideoResponse(result.id, new Request(`http://localhost:4188/api/videos/${result.id}`, { headers: { range: 'bytes=0-15' } }), options);
    assert.equal(response.status, 206); assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes.subarray(0, 16));
  }
  assert.equal(await readFile(snapshotPath, 'utf8'), before);
  const legacy = await uploadVideo(request({ ...metadata, familyId: undefined, label: 'Legacy bank' }), options);
  const reloaded = await loadVideoRegistry(options);
  assert.equal(reloaded.videos.find(row => row.id === legacy.id).familyId, undefined);
  assert.deepEqual(reloaded.families.find(row => row.id === family.id).variantIds, [result.id]);
});

test('family intake rejects other dealer, event, situation, standard override and invented family', () => {
  for (const change of [{ dealerId: 'vera' }, { eventId: 'deal.player.centre' }, { situation: 'box1' }, { role: 'standard' }, { familyId: 'astrid/deal.player.left/fake' }]) {
    assert.throws(() => validateVideoMetadata({ ...metadata, ...change }), /familj/);
  }
  const idle = { ...metadata, familyId: 'astrid/idle.ready/ready', eventId: 'idle.ready', kind: 'idle', situation: '' };
  assert.equal(validateVideoMetadata(idle).familyId, idle.familyId);
  assert.throws(() => validateVideoMetadata({ ...idle, situation: 'box0' }), /familj/);
  const speech = { ...metadata, familyId: 'astrid/speak.goodluck/goodluck', eventId: 'speak.goodluck', kind: 'speech', situation: 'goodluck' };
  assert.equal(validateVideoMetadata(speech).familyId, speech.familyId);
  assert.throws(() => validateVideoMetadata({ ...speech, situation: 'greeting' }), /familj/);
});

test('editor can inspect every speech candidate and runtime includes a configured fifth upload', () => {
  const project = createSeedProject();
  const definition = MEDIA_FAMILY_DEFINITIONS.find(row => row.eventId === 'speak.goodluck');
  const ids = Array.from({ length: 6 }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`);
  const family = { ...definition, standardIds: [ids[0]], variantIds: ids.slice(1) };
  const inventory = { families: [family], videos: ids.map((id, i) => ({ id, familyId: family.id, role: i ? 'variant' : 'standard', available: true, fileName: `clip-${i}.mp4` })) };
  const event = { type: 'speak', line: 'goodluck' };
  assert.equal(mediaLineForEvent(project, inventory, 'astrid', definition.eventId, event, { includeManualVariants: true }).line.variants.length, 6);
  project.mediaPolicy = [{ familyId: family.id, variants: [{ videoId: ids[5], selection: { rules: true, model: false, random: false }, priority: 10, triggerIds: [] }] }];
  const runtime = mediaLineForEvent(project, inventory, 'astrid', definition.eventId, event);
  assert.equal(runtime.line.variants.length, 5);
  assert.ok(runtime.line.variants.some(row => row.videoGenerationId === ids[5]));
});
