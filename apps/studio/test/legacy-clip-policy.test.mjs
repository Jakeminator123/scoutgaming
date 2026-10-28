import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createSeedProject, validateProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import { createProjectStore } from '../lib/project-store.mjs';
import { loadLegacyClipInventory, legacyClipControls } from '../lib/legacy-clip-inventory.mjs';
import { createRuntimeMetadataReader } from '../../../tools/runtime-media-catalog.mjs';
import { resolveLegacyClipPolicy, upsertLegacyClipBinding, validateLegacyClipPolicy } from '../../../packages/presentation/runtime/legacy-clip-policy.mjs';
import { createPresentationApi } from '../../../services/game/presentation-api.mjs';
import { assertLocalRequest } from '../lib/http-guard.mjs';

async function fixture(t) {
  const repository = await mkdtemp(join(tmpdir(), 'croupier-lab-clips-'));
  t.after(() => rm(repository, { recursive: true, force: true }));
  const dataDirectory = join(repository, 'players');
  const write = async (file, value) => { const path = join(repository, file); await mkdir(dirname(path), { recursive: true }); await writeFile(path, typeof value === 'string' ? value : JSON.stringify(value)); };
  for (const [dealerId, base] of Object.entries({ vera: 'dealer', astrid: 'dealers/astrid', amira: 'dealers/amira', mei: 'dealers/mei' })) {
    await write(`web/public/${base}/streams/index.json`, { clips: {
      'idle-1/idle/idle': { file: 'idle.h264' }, 'idle-2/idle/idle': { file: 'idle2.h264' },
      'idle-1/actions/action-deal': { file: 'deal.h264' }, 'idle-1/actions/action-deal-watch': { file: 'watch.h264' },
      'idle-1/speak/win': { file: 'win.h264' }, 'idle-1/speak/lose': { file: 'lose.h264' },
      'idle-1/idle/idle-base3': { file: 'missing.h264' },
    } });
    for (const file of ['idle', 'idle2', 'deal', 'watch', 'win', 'lose']) await write(`web/public/${base}/streams/${file}.h264`, `${dealerId} synthetic ${file}`);
    await write(`web/public/${base}/audio/en/bank.json`, { win: { text: `Exact ${dealerId} win` }, lose: { text: `Exact ${dealerId} lose` } });
  }
  await write('players/bo.json', { clipAssignments: { vera: { idle: { clip: 'vera:idle-2/idle/idle' } }, astrid: { box4: { clip: 'direction-with-no-box' }, idle: { clip: 'mei:idle-1/idle/idle' } } } });
  await write('web/public/dealers/astrid/performance/manifest.json', { takes: [{ id: 'direction-with-no-box', dealer: 'astrid', action: 'deal-right', status: 'review', media: { src: 'direction.mp4' } }] });
  return { repository, dataDirectory, write };
}

test('old BO choices stay stored but are not offered by current clip controls', async t => {
  const options = await fixture(t);
  const before = await readFile(join(options.dataDirectory, 'bo.json'), 'utf8');
  const project = createSeedProject(), controls = await legacyClipControls(project, options);
  assert.equal(controls.runtime.source, 'lab/project.json');
  assert.deepEqual(controls.runtime.dealers.astrid.engine, {}, 'BO selection is never a fallback');
  assert.equal(Object.hasOwn(controls, 'legacy'), false);
  assert.equal(Object.hasOwn(controls, 'routes'), false);
  assert.equal(controls.clips.find(row => row.id === 'direction-with-no-box').exactParts.length, 0);
  assert.equal(await readFile(join(options.dataDirectory, 'bo.json'), 'utf8'), before);
  project.legacyClipPolicy = upsertLegacyClipBinding(project.legacyClipPolicy, { dealerId: 'astrid', part: 'idle', clipId: 'astrid:idle-2/idle/idle' });
  const resolved = resolveLegacyClipPolicy(project, controls);
  assert.equal(resolved.dealers.astrid.engine.idle, 'idle-2/idle/idle');
  assert.equal(resolved.dealers.mei, undefined);
  assert.equal(await readFile(join(options.dataDirectory, 'bo.json'), 'utf8'), before);
});

test('Astrid retains exact legacy bindings; missing files, different parts and speech substitutions fail closed', async t => {
  const inventory = await loadLegacyClipInventory(await fixture(t));
  const project = createSeedProject();
  for (const dealerId of ['astrid']) {
    project.legacyClipPolicy = upsertLegacyClipBinding(project.legacyClipPolicy, { dealerId, part: 'idle', clipId: `${dealerId}:idle-2/idle/idle` });
  }
  validateProject(project);
  const active = resolveLegacyClipPolicy(project, inventory);
  assert.equal(active.conflicts.length, 0);
  assert.equal(active.dealers.astrid.engine.idle, 'idle-2/idle/idle');
  for (const clipId of ['mei:idle-1/idle/idle', 'astrid:idle-1/idle/idle-base3', 'astrid:idle-1/speak/win', 'astrid:idle-1/actions/action-deal-watch']) {
    const invalid = { ...project, legacyClipPolicy: [{ dealerId: 'astrid', part: 'deal', clipId }] };
    assert.equal(resolveLegacyClipPolicy(invalid, inventory).conflicts.length, 1);
    assert.deepEqual(resolveLegacyClipPolicy(invalid, inventory).dealers.astrid.engine, {});
  }
  assert.throws(() => validateProject({ ...project, legacyClipPolicy: [{ dealerId: 'astrid', part: 'speak.lose', clipId: 'astrid:idle-1/speak/win' }] }), /klippkoppling/);
  assert.throws(() => validateProject({ ...project, legacyClipPolicy: [project.legacyClipPolicy[0], project.legacyClipPolicy[0]] }), /klippkoppling/);
  const speech = inventory.clips.find(row => row.id === 'astrid:idle-1/speak/win');
  assert.equal(speech.lineId, 'win'); assert.equal(speech.text, 'Exact astrid win'); assert.deepEqual(speech.exactParts, []);
});

test('native inventory fails on a missing runtime catalog but accepts the retired indexed registers', async t => {
  const { repository, write } = await fixture(t);
  const administration = { legacyClipReview: { sourceSha256: 'a'.repeat(64), neverAgain: {} } };
  const load = () => loadLegacyClipInventory({ repository, administration, mediaAvailable: async () => true, readMetadata: createRuntimeMetadataReader(repository) });
  await assert.rejects(load(), { code: 'ENOENT' });
  const speak = { status: 'review', lines: { greeting: { text: 'Exact greeting', media: { src: 'review/astrid-seam-repair/greeting.mp4' }, audio: 'dealers/astrid/audio/en/greeting.mp3' } } };
  const greenSpeak = { 'web/public/review/astrid-green-speak/speak.json': JSON.stringify(speak) };
  await write('media/catalog/legacy.json', { schemaVersion: 2, entries: { 'web/public/speech-media.json': '{}', ...greenSpeak } });
  const inventory = await load();
  assert.equal(inventory.reviewSafetyVerified, true);
  assert.deepEqual(inventory.clips.map(clip => [clip.id, clip.text, clip.available]), [['green:astrid:greeting', 'Exact greeting', true]]);
  // The retired V2 speech manifest may also be absent; its rows simply disappear.
  await write('media/catalog/legacy.json', { schemaVersion: 2, entries: { 'web/public/speech-media.json': '{}' } });
  assert.deepEqual((await load()).clips, []);
  await write('media/catalog/legacy.json', { schemaVersion: 2, entries: greenSpeak });
  await assert.rejects(load(), /Runtime metadata missing: web\/public\/speech-media\.json/);
});

test('review rejection blocks explicit Lab import/binding without changing project or recorded media', async t => {
  const options = await fixture(t);
  await options.write('players/bo.json', { neverAgain: { 'astrid:idle-2/idle/idle': { reason: 'review failed' } } });
  const project = createSeedProject();
  project.legacyClipPolicy = [{ dealerId: 'astrid', part: 'idle', clipId: 'astrid:idle-2/idle/idle' }];
  const before = structuredClone(project), controls = await legacyClipControls(project, options);
  assert.equal(controls.clips.find(row => row.id === project.legacyClipPolicy[0].clipId).reviewStatus, 'Never again');
  assert.equal(controls.runtime.conflicts.length, 1);
  assert.deepEqual(controls.runtime.dealers.astrid.engine, {});
  assert.deepEqual(project, before);
});

test('historical policy remains stored but its runtime endpoint is retired and stale saves fail', async t => {
  const options = await fixture(t), store = createProjectStore(join(options.repository, 'studio'));
  const base = await store.load(), edited = structuredClone(base);
  edited.legacyClipPolicy = [{ dealerId: 'amira', part: 'idle', clipId: 'amira:idle-2/idle/idle' }];
  const first = await store.save(edited, base.revision);
  const handler = createPresentationApi({ env: {}, store, legacyOptions: options });
  const server = createServer(async (req, res) => { await handler(req, res, new URL(req.url, 'http://local').pathname, req.headers['x-fixture-player'] === 'none' ? null : 'isolated-qa'); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/api/presentation/legacy-config`;
  assert.equal((await fetch(url, { headers: { 'x-fixture-player': 'none' } })).status, 401);
  const retired = await fetch(url);
  assert.equal(retired.status, 410);
  assert.equal((await store.load()).revision, first.revision);
  assert.deepEqual((await store.load()).legacyClipPolicy, edited.legacyClipPolicy);
  const next = structuredClone(first); next.legacyClipPolicy = [];
  const second = await store.save(next, first.revision);
  assert.equal((await fetch(url)).status, 410);
  assert.deepEqual((await store.load()).legacyClipPolicy, []);
  await assert.rejects(store.save(edited, base.revision), { statusCode: 409 });
  assert.equal((await store.load()).revision, second.revision);
});

test('clip editor endpoint uses the existing Lab origin and admin gateway boundary', () => {
  assert.throws(() => assertLocalRequest(new Request('http://127.0.0.1:4188/api/clip-controls', { headers: { origin: 'http://untrusted.example' } })), /labbet/);
  assert.throws(() => assertLocalRequest(new Request('https://untrusted.example/api/clip-controls')), /lokalt/);
});

test('shared inventory never reads or offers retired dealer registers',async t=>{
 const {repository}=await fixture(t),read=[];
 const inventory=await loadLegacyClipInventory({repository,administration:{legacyClipReview:{sourceSha256:'a'.repeat(64),neverAgain:{}}},mediaAvailable:async()=>true,readMetadata:async path=>{
 read.push(path);if(/(?:^|[\\/])(?:dealer[\\/]|(?:vera|mei|amira|johanna)(?:[\\/]|$))/.test(path))throw Error('Retired dealer source must not be read');
 return path.endsWith('speak.json')?{lines:{greeting:{text:'Astrid exact speech',media:{src:'astrid.mp4'},audio:'astrid.mp3'}}}:null;
 }});assert.ok(read.some(path=>path.includes('astrid')));assert.deepEqual(inventory.clips.map(row=>row.dealerId),['astrid']);
});

test('retired legacy bindings remain readable history but cannot resolve or be newly assigned', () => {
  for (const dealerId of ['vera', 'mei', 'amira']) {
    const binding = { dealerId, part: 'idle', clipId: `${dealerId}:idle-1/idle/idle` };
    assert.deepEqual(validateLegacyClipPolicy([binding]), [binding]);
    const resolved = resolveLegacyClipPolicy({ legacyClipPolicy: [binding] }, { clips: [{ id: binding.clipId, dealerId, available: true, exactParts: ['idle'], kind: 'engine', engineKey: 'idle-1/idle/idle' }] });
    assert.equal(resolved.dealers[dealerId], undefined);
    assert.equal(resolved.conflicts[0].reason, 'avvecklad_dealer');
    assert.throws(() => upsertLegacyClipBinding([], binding), /avvecklad/);
    assert.deepEqual(upsertLegacyClipBinding([binding], { ...binding, clipId: null }), []);
  }
});
