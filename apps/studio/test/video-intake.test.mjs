import { createLegacyProject as createSeedProject } from './fixtures/legacy-project.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {seedLegacyVideo} from './fixtures/legacy-video.mjs';
import {uploadDirectory, readUploads} from '../lib/video-local-readers.mjs';
import { loadVideoRegistry, getVideoResponse } from '../lib/video-registry.mjs';
import { loadVideoRegistry as loadGameVideoRegistry, getVideoResponse as getGameVideoResponse } from '../../../services/game/storage/video-registry.mjs';
import { validateVideoMetadata, videoFitsEvent, MAX_VIDEO_BYTES } from '../../../packages/presentation/contracts/video-intake.mjs';
import { validateProject, addVariant, buildRuntimeCatalog } from '../../../packages/presentation/contracts/studio-model.mjs';
import { simulateStudio as simulate, decisionCatalog, validateVideoBindings } from '../lib/studio-server.mjs';
const simulateStudio = (body, options = {}) => simulate(body, { videoRegistry: { videos: [], families: [] }, ...options });
import { prepareDecision } from '../../../packages/director/engine.mjs';
import { readSettings } from '../lib/director-settings.mjs';

// Container-signature fixture, not a decodable video or a visual approval.
const bytes = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom00000000test-media')]);
const metadata = { label: 'Astrid mitten', dealerId: 'astrid', eventId: 'deal.player.centre', kind: 'action', role: 'standard', situation: 'box3', notes: 'QA' };
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'croupier-intake-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { uploadDir: join(root, 'uploads'), snapshotPath: join(root, 'missing.json'), archiveDir: null };
}

test('retired shared Studio directory cannot redirect the local upload fixture', () => {
  assert.equal(uploadDirectory({ env: { LAB_STUDIO_DATA_DIR: 'retired-storage' } }), uploadDirectory({ env: {} }));
});

test('stored video preserves bytes and classification across reload and serves ranges without original archive', async t => {
  const options = await fixture(t);
  const result = await seedLegacyVideo(options, bytes, metadata);
  const saved = await readUploads(options);
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0].classification, {
    ...metadata,
    compositing: { mode: 'green-screen', threshold: 0.23, softness: 0.15, despill: 0 },
  });
  assert.equal(saved[0].sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(await readFile(join(options.uploadDir, `${result.id}.mp4`)), bytes);
  const registry = await loadVideoRegistry(options);
  assert.equal(registry.videos.length, 1); assert.equal(registry.videos[0].source, 'upload');
  assert.equal(registry.videos[0].available, true);
  assert.ok(!JSON.stringify(registry).includes(options.uploadDir));
  const oldBasePath = process.env.NEXT_PUBLIC_LAB_BASE_PATH;
  try {
    for (const basePath of ['', '/studio']) {
      process.env.NEXT_PUBLIC_LAB_BASE_PATH = basePath;
      assert.deepEqual(await loadGameVideoRegistry(options), await loadVideoRegistry(options), 'game and Studio retain identical read/preview contracts');
    }
  } finally {
    if (oldBasePath === undefined) delete process.env.NEXT_PUBLIC_LAB_BASE_PATH;
    else process.env.NEXT_PUBLIC_LAB_BASE_PATH = oldBasePath;
  }
  const gameResponse = await getGameVideoResponse(result.id, new Request(`http://localhost:4188/api/videos/${result.id}`, { headers: { range: 'bytes=0-7' } }), options);
  assert.equal(gameResponse.status, 206); assert.deepEqual(Buffer.from(await gameResponse.arrayBuffer()), bytes.subarray(0, 8));
  const response = await getVideoResponse(result.id, new Request(`http://localhost:4188/api/videos/${result.id}`, { headers: { range: 'bytes=0-7' } }), options);
  assert.equal(response.status, 206); assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes.subarray(0, 8));
  assert.deepEqual((await readdir(options.uploadDir)).sort(), ['index.json', `${result.id}.mp4`].sort());
});

test('speech requires exact line and situation matching preserves hidden-card distinction', () => {
  assert.throws(() => validateVideoMetadata({ ...metadata, eventId: 'speak.other', kind: 'speech', situation: '' }), /replik/);
  assert.throws(() => validateVideoMetadata({ ...metadata, eventId: 'speak.goodluck', kind: 'speech', situation: 'win' }), /Situationen/);
  assert.equal(videoFitsEvent({ classification: metadata }, { type: 'deal', to: 'box', box: 3 }), true);
  assert.equal(videoFitsEvent({ classification: metadata }, { type: 'deal', to: 'box', box: 2 }), false);
  assert.equal(videoFitsEvent({ classification: { ...metadata, situation: 'dealer-hole' } }, { type: 'deal', to: 'dealer', faceDown: false }), false);
});

test('blackjack action clips may declare a VILA/REDO pose chain; speech, idle, roulette poses and half chains are rejected', () => {
  const chained = validateVideoMetadata({ ...metadata, startPose: 'VILA', endPose: 'REDO' });
  assert.equal(chained.startPose, 'VILA'); assert.equal(chained.endPose, 'REDO');
  assert.equal(validateVideoMetadata(metadata).startPose, undefined);
  validateVideoMetadata({ ...metadata, eventId: 'reveal.dealer', situation: 'dealer-hole', startPose: 'VILA', endPose: 'VILA' });
  validateVideoMetadata({ ...metadata, eventId: 'transition.shoe', situation: 'to-shoe', startPose: 'VILA', endPose: 'REDO' });
  assert.throws(() => validateVideoMetadata({ ...metadata, eventId: 'transition.shoe', situation: 'to-shoe', startPose: 'REDO', endPose: 'VILA' }), /Till skon/);
  assert.throws(() => validateVideoMetadata({ ...metadata, startPose: 'VILA' }), /både start- och slutpose/);
  assert.throws(() => validateVideoMetadata({ ...metadata, startPose: 'WHEEL', endPose: 'VILA' }), /Roulettens poser/);
  assert.throws(() => validateVideoMetadata({ ...metadata, startPose: 'unverified', endPose: 'VILA' }), /Roulettens poser/);
  assert.throws(() => validateVideoMetadata({ ...metadata, eventId: 'speak.goodluck', kind: 'speech', situation: 'goodluck', startPose: 'VILA', endPose: 'VILA' }), /bara utdelnings/);
  assert.throws(() => validateVideoMetadata({ ...metadata, eventId: 'idle.ready', kind: 'idle', situation: '', startPose: 'VILA', endPose: 'VILA' }), /bara utdelnings/);
  assert.throws(() => validateVideoMetadata({ ...metadata, eventId: 'settle.win', kind: 'reaction', situation: '', startPose: 'VILA', endPose: 'VILA' }), /bara utdelnings/);
  // Existing seat matching is unaffected by the declared chain.
  assert.equal(videoFitsEvent({ classification: chained }, { type: 'deal', to: 'box', box: 3 }), true);
});

test('new recorded speech metadata binds dealer and exact line while old speech remains unchanged',()=>{
  const legacy={...metadata,eventId:'speak.goodluck',kind:'speech',situation:'goodluck',playback:'once'};
  const recordedSpeech={schemaVersion:1,dealerId:'astrid',lineId:'goodluck',takeId:'goodluck_1',language:'sv',exactText:'Inspelad testreplik.',
    videoSha256:'a'.repeat(64),audioSha256:'b'.repeat(64),indexSha256:'c'.repeat(64),fps:24,frameCount:72,audioDelayMs:0,
    entryPose:'VILA',exitPose:'VILA',calibrationRevision:'fixture-v1',recording:{status:'pending'},review:{status:'pending'}};
  assert.deepEqual(validateVideoMetadata(legacy),legacy);
  const value={...legacy,recordedSpeech};assert.deepEqual(validateVideoMetadata(value),value);
  for(const change of [{dealerId:'vera'},{lineId:'win'},{language:'SV'},{review:{status:'approved'}}])
    assert.throws(()=>validateVideoMetadata({...value,recordedSpeech:{...recordedSpeech,...change}}));
  assert.throws(()=>validateVideoMetadata({...metadata,recordedSpeech}));
  assert.throws(()=>validateVideoMetadata({...value,mediaType:'audio'}));
  assert.throws(()=>validateVideoMetadata({...value,playback:'loop'}));
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

test('a stored greeting binds, survives reload and cannot play as another speech line', async t => {
  const options = await fixture(t);
  const speech = { ...metadata, eventId: 'speak.other', kind: 'speech', situation: 'greeting' };
  const result = await seedLegacyVideo(options, bytes, speech);
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

test('all 256 seed mappings resolve to the right event; new alternatives are manual', () => {
  const project = createSeedProject();
  assert.equal(project.events.length, 16); assert.equal(project.lines.length, 64);
  assert.equal(project.lines.reduce((count, line) => count + line.variants.length, 0), 256);
  for (const dealer of project.dealers) for (const e of project.events) {
    assert.equal(prepareDecision(buildRuntimeCatalog(project, dealer.id), { requestId: 'audit-mapping', event: e.exampleEvent, mode: 'off' }).node.id, e.id);
  }
  const updated = addVariant(project, 'astrid', 'idle.ready');
  assert.deepEqual(updated.lines.find(l => l.dealerId === 'astrid' && l.eventId === 'idle.ready').variants.at(-1).selection, { rules: false, model: false, random: false });
});
