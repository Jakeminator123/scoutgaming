import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createSeedProject, validateProject } from '../lib/studio-model.mjs';
import { createProjectStore } from '../lib/project-store.mjs';
import { loadLegacyClipInventory, legacyClipControls } from '../lib/legacy-clip-inventory.mjs';
import { resolveLegacyClipPolicy, upsertLegacyClipBinding } from '../../packages/presentation/runtime/legacy-clip-policy.mjs';
import { createPresentationApi } from '../../web/presentation-api.mjs';
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
  assert.deepEqual(controls.runtime.dealers.vera.engine, {}, 'BO selection is never a fallback');
  assert.equal(Object.hasOwn(controls, 'legacy'), false);
  assert.equal(Object.hasOwn(controls, 'routes'), false);
  assert.equal(controls.clips.find(row => row.id === 'direction-with-no-box').exactParts.length, 0);
  assert.equal(await readFile(join(options.dataDirectory, 'bo.json'), 'utf8'), before);
  project.legacyClipPolicy = upsertLegacyClipBinding(project.legacyClipPolicy, { dealerId: 'vera', part: 'idle', clipId: 'vera:idle-2/idle/idle' });
  const resolved = resolveLegacyClipPolicy(project, controls);
  assert.equal(resolved.dealers.vera.engine.idle, 'idle-2/idle/idle');
  assert.deepEqual(resolved.dealers.mei.engine, {});
  assert.equal(await readFile(join(options.dataDirectory, 'bo.json'), 'utf8'), before);
});

test('all four dealers have exact Lab bindings; missing files, different parts and speech substitutions fail closed', async t => {
  const inventory = await loadLegacyClipInventory(await fixture(t));
  const project = createSeedProject();
  for (const dealerId of ['vera', 'astrid', 'amira', 'mei']) {
    project.legacyClipPolicy = upsertLegacyClipBinding(project.legacyClipPolicy, { dealerId, part: 'idle', clipId: `${dealerId}:idle-2/idle/idle` });
  }
  validateProject(project);
  const active = resolveLegacyClipPolicy(project, inventory);
  assert.equal(active.conflicts.length, 0);
  for (const dealerId of ['vera', 'astrid', 'amira', 'mei']) assert.equal(active.dealers[dealerId].engine.idle, 'idle-2/idle/idle');
  for (const clipId of ['mei:idle-1/idle/idle', 'vera:idle-1/idle/idle-base3', 'vera:idle-1/speak/win', 'vera:idle-1/actions/action-deal-watch']) {
    const invalid = { ...project, legacyClipPolicy: [{ dealerId: 'vera', part: 'deal', clipId }] };
    assert.equal(resolveLegacyClipPolicy(invalid, inventory).conflicts.length, 1);
    assert.deepEqual(resolveLegacyClipPolicy(invalid, inventory).dealers.vera.engine, {});
  }
  assert.throws(() => validateProject({ ...project, legacyClipPolicy: [{ dealerId: 'vera', part: 'speak.lose', clipId: 'vera:idle-1/speak/win' }] }), /klippkoppling/);
  assert.throws(() => validateProject({ ...project, legacyClipPolicy: [project.legacyClipPolicy[0], project.legacyClipPolicy[0]] }), /klippkoppling/);
  const speech = inventory.clips.find(row => row.id === 'vera:idle-1/speak/win');
  assert.equal(speech.lineId, 'win'); assert.equal(speech.text, 'Exact vera win'); assert.deepEqual(speech.exactParts, []);
});

test('review rejection blocks explicit Lab import/binding without changing project or recorded media', async t => {
  const options = await fixture(t);
  await options.write('players/bo.json', { neverAgain: { 'vera:idle-2/idle/idle': { reason: 'review failed' } } });
  const project = createSeedProject();
  project.legacyClipPolicy = [{ dealerId: 'vera', part: 'idle', clipId: 'vera:idle-2/idle/idle' }];
  const before = structuredClone(project), controls = await legacyClipControls(project, options);
  assert.equal(controls.clips.find(row => row.id === project.legacyClipPolicy[0].clipId).reviewStatus, 'Never again');
  assert.equal(controls.runtime.conflicts.length, 1);
  assert.deepEqual(controls.runtime.dealers.vera.engine, {});
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
