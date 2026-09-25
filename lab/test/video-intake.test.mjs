import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { uploadVideo, readUploads } from '../lib/video-uploads.mjs';
import { loadVideoRegistry, getVideoResponse } from '../lib/video-registry.mjs';
import { validateVideoMetadata, videoFitsEvent, MAX_VIDEO_BYTES } from '../lib/video-intake.mjs';
import { createSeedProject, validateProject, addVariant, buildRuntimeCatalog } from '../lib/studio-model.mjs';
import { auditStudio } from '../lib/studio-audit.mjs';
import { simulateStudio as simulate, decisionCatalog, validateVideoBindings } from '../lib/studio-server.mjs';
const simulateStudio = (body, options = {}) => simulate(body, { videoRegistry: { videos: [], families: [] }, ...options });
import { prepareDecision } from '../../open-claw/lab/src/engine.mjs';
import { readSettings } from '../../open-claw/lab/src/settings.mjs';

// Container-signature fixture, not a decodable video or a visual approval.
const bytes = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom00000000test-media')]);
const metadata = { label: 'Astrid mitten', dealerId: 'astrid', eventId: 'deal.player.centre', kind: 'action', role: 'standard', situation: 'box3', notes: 'QA' };
const request = (body = bytes, fields = metadata, headers = {}) => new Request('http://localhost:4188/api/videos', { method: 'POST', headers: { 'content-type': 'video/mp4', 'x-video-metadata': encodeURIComponent(JSON.stringify(fields)), ...headers }, body, duplex: 'half' });
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'croupier-intake-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { uploadDir: join(root, 'uploads'), snapshotPath: join(root, 'missing.json'), archiveDir: null };
}

test('upload persists exact bytes and classification, deduplicates retry, survives reload and serves ranges without original archive', async t => {
  const options = await fixture(t);
  const result = await uploadVideo(request(), options);
  const saved = await readUploads(options);
  assert.equal(saved.length, 1); assert.deepEqual(saved[0].classification, metadata);
  assert.equal(saved[0].sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(await readFile(join(options.uploadDir, `${result.id}.mp4`)), bytes);
  assert.deepEqual(await uploadVideo(request(), options), { id: result.id, duplicate: true });
  const registry = await loadVideoRegistry(options);
  assert.equal(registry.videos.length, 1); assert.equal(registry.videos[0].source, 'upload');
  assert.equal(registry.videos[0].available, true);
  assert.ok(!JSON.stringify(registry).includes(options.uploadDir));
  const response = await getVideoResponse(result.id, new Request(`http://localhost:4188/api/videos/${result.id}`, { headers: { range: 'bytes=0-7' } }), options);
  assert.equal(response.status, 206); assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes.subarray(0, 8));
  assert.deepEqual((await readdir(options.uploadDir)).sort(), ['index.json', `${result.id}.mp4`].sort());
});

test('invalid type, metadata, foreign origin and oversized stream never become records', async t => {
  const options = await fixture(t);
  await assert.rejects(uploadVideo(request(bytes, { ...metadata, dealerId: 'unknown' }), options), /dealer/);
  await assert.rejects(uploadVideo(request(bytes, { ...metadata, kind: 'idle' }), options), /Videotypen/);
  await assert.rejects(uploadVideo(request(bytes, metadata, { origin: 'https://other.test' }), options), /labbet/);
  await assert.rejects(uploadVideo(request(bytes, metadata, { 'content-length': String(MAX_VIDEO_BYTES + 1) }), options), e => e.statusCode === 413);
  await assert.rejects(uploadVideo(request(Buffer.from('not a video file')), options), e => e.statusCode === 415);
  let sent = 0;
  const stream = new ReadableStream({ pull(c) { if (sent++ < 129) c.enqueue(new Uint8Array(1024 * 1024)); else c.close(); } });
  await assert.rejects(uploadVideo(request(stream), options), e => e.statusCode === 413);
  assert.deepEqual(await readUploads(options), []);
  assert.deepEqual(await readdir(options.uploadDir), []);
});

test('interrupted uploads clean only their temporary file, corrupt index preserves prior files', async t => {
  const options = await fixture(t);
  const good = await uploadVideo(request(), options);
  const stream = new ReadableStream({ start(c) { c.enqueue(bytes); c.error(new Error('disconnect')); } });
  await assert.rejects(uploadVideo(request(stream), options), /disconnect/);
  assert.equal((await readUploads(options)).length, 1);
  await writeFile(join(options.uploadDir, 'index.json'), 'broken');
  await assert.rejects(uploadVideo(request(bytes, { ...metadata, label: 'Another' }), options), /bevarats/);
  assert.equal(await readFile(join(options.uploadDir, 'index.json'), 'utf8'), 'broken');
  assert.deepEqual(await readFile(join(options.uploadDir, `${good.id}.mp4`)), bytes);
  assert.equal((await readdir(options.uploadDir)).length, 2);
});

test('speech requires exact line and situation matching preserves hidden-card distinction', () => {
  assert.throws(() => validateVideoMetadata({ ...metadata, eventId: 'speak.other', kind: 'speech', situation: '' }), /replik/);
  assert.throws(() => validateVideoMetadata({ ...metadata, eventId: 'speak.goodluck', kind: 'speech', situation: 'win' }), /Situationen/);
  assert.equal(videoFitsEvent({ classification: metadata }, { type: 'deal', to: 'box', box: 3 }), true);
  assert.equal(videoFitsEvent({ classification: metadata }, { type: 'deal', to: 'box', box: 2 }), false);
  assert.equal(videoFitsEvent({ classification: { ...metadata, situation: 'dealer-hole' } }, { type: 'deal', to: 'dealer', faceDown: false }), false);
});

const settings = readSettings({ env: {}, envFiles: [] });
const noFetch = () => assert.fail('No model calls in local tests');
test('manual alternatives stay out of rules/model/random; opt-in random obeys triggers and keeps standard', async () => {
  const project = createSeedProject();
  const line = project.lines.find(l => l.dealerId === 'astrid' && l.eventId === 'speak.goodluck');
  for (const v of line.variants.slice(1)) v.selection = { rules: false, model: false, random: false };
  const body = { project, dealerId: 'astrid', eventId: line.eventId, context: { playerHistory: { returning: true, preferredLanguage: 'de' } } };
  for (const mode of ['off', 'rules', 'random']) {
    assert.equal((await simulateStudio({ ...body, mode }, { settings, fetchImpl: noFetch })).variant.id, line.baselineVariantId);
  }
  assert.equal(decisionCatalog(project, 'astrid').events[0].variants.length, 1);
  line.variants[1].selection.random = true;
  assert.equal((await simulateStudio({ ...body, mode: 'random' }, { settings, fetchImpl: noFetch, random: () => 0 })).variant.id, line.variants[1].id);
  assert.equal((await simulateStudio({ ...body, mode: 'random' }, { settings, fetchImpl: noFetch, random: () => 0.999 })).variant.id, line.baselineVariantId);
  assert.equal((await simulateStudio({ ...body, context: {}, mode: 'random' }, { settings, fetchImpl: noFetch, random: () => 0 })).variant.id, line.baselineVariantId);
  assert.equal((await simulateStudio({ ...body, mode: 'off' }, { settings, fetchImpl: noFetch })).variant.id, line.baselineVariantId);
  line.variants[0].selection = { rules: false, model: false, random: false };
  assert.throws(() => validateProject(project), /standarden/);
});

test('imported video cannot bind to another dealer/event or play over a different exact line', async () => {
  const project = createSeedProject(), line = project.lines.find(l => l.dealerId === 'astrid' && l.eventId === 'speak.other');
  const id = '00000000-0000-0000-0000-000000000001'; line.variants[0].videoGenerationId = id;
  const other = line.eventId;
  const differentLine = project.events.find(e => e.id === other).exampleEvent.line === 'lose' ? 'win' : 'lose';
  const video = { id, available: true, classification: { ...metadata, eventId: other, kind: 'speech', situation: differentLine } };
  const videoRegistry = { videos: [video] };
  const result = await simulateStudio({ project, dealerId: 'astrid', eventId: other, mode: 'off', context: {} }, { settings, fetchImpl: noFetch, videoRegistry });
  assert.equal(result.videoGenerationId, null); assert.ok(result.trace.some(t => t.stage === 'video'));
  video.classification.dealerId = 'vera';
  await assert.rejects(validateVideoBindings(project, { registry: videoRegistry }), /giltig kategorisering/);
});

test('a newly uploaded greeting binds, survives reload and cannot play as another speech line', async t => {
  const options = await fixture(t);
  const speech = { ...metadata, eventId: 'speak.other', kind: 'speech', situation: 'greeting' };
  const result = await uploadVideo(request(bytes, speech), options);
  const videoRegistry = await loadVideoRegistry(options);
  const project = createSeedProject();
  project.lines.find(l => l.dealerId === 'astrid' && l.eventId === 'speak.other').variants[0].videoGenerationId = result.id;
  await validateVideoBindings(project, { registry: videoRegistry });
  const body = { project, dealerId: 'astrid', eventId: 'speak.other', mode: 'off', context: {} };
  const chosen = await simulateStudio({ ...body, exampleEvent: { type: 'speak', line: 'greeting' } }, { settings, fetchImpl: noFetch, videoRegistry });
  assert.equal(chosen.videoGenerationId, result.id);
  const mismatch = await simulateStudio({ ...body, exampleEvent: { type: 'speak', line: 'win' } }, { settings, fetchImpl: noFetch, videoRegistry });
  assert.equal(mismatch.videoGenerationId, null);
  for (const line of ['peek', 'bust', 'sidebet', 'chatter1', 'chatter2', 'farewell']) {
    assert.doesNotThrow(() => validateVideoMetadata({ ...speech, situation: line }));
  }
  assert.throws(() => validateVideoMetadata({ ...speech, situation: 'invented-speech' }), /Situationen/);
});

test('all 256 seed mappings resolve to the right event and 64 distinct motion definitions; new alternatives are manual', () => {
  const project = createSeedProject(), audit = auditStudio(project);
  assert.equal(audit.events, 16); assert.equal(audit.lines.length, 64); assert.equal(audit.variants, 256);
  assert.equal(audit.uniqueMotions, 64); assert.equal(audit.socialMotions, 1); assert.deepEqual(audit.problems, []);
  for (const dealer of project.dealers) for (const e of project.events) {
    assert.equal(prepareDecision(buildRuntimeCatalog(project, dealer.id), { requestId: 'audit-mapping', event: e.exampleEvent, mode: 'off' }).node.id, e.id);
  }
  const updated = addVariant(project, 'astrid', 'idle.ready');
  assert.deepEqual(updated.lines.find(l => l.dealerId === 'astrid' && l.eventId === 'idle.ready').variants.at(-1).selection, { rules: false, model: false, random: false });
});
