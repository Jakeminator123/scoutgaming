import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedProject, addDealer } from '../lib/studio-model.mjs';
import { forgeSlots, slotPlan, slotPrompt, anchorsFor, validateProfile, validatePositions, DEFAULT_POSITIONS } from '../lib/dealer-forge-catalog.mjs';
import { ForgeError } from '../lib/dealer-forge-service.mjs';
import { fixture, sha, scope, PNG, MP4 } from './helpers/dealer-forge-fixture.mjs';
import { createDealerForgeStore } from '../lib/dealer-forge-store.mjs';
import { createRunwayClient, RunwayError } from '../lib/runway-client.mjs';

const actor = { actor: 'tester' };

test('catalog: 40 slots in group order, deal slots carry targets and frames, transitions wait for the project event', () => {
  const project = addDealer(createSeedProject(), 'paow', 'Paow');
  const slots = forgeSlots(project);
  assert.equal(slots.length, 40);
  assert.deepEqual(slots.slice(0, 5).map(slot => slot.id), ['pose/vila', 'pose/redo', 'idle.ready/', 'transition.shoe/to-shoe', 'transition.shoe/from-shoe']);
  assert.equal(slots.find(slot => slot.id === 'transition.shoe/to-shoe').needsEvent, true);
  const deal = slots.find(slot => slot.id === 'deal.player.centre/box3');
  assert.deepEqual([deal.target, deal.frames, deal.start, deal.end, deal.group], ['4', 26, 'REDO', 'REDO', 'deal']);
  assert.equal(slots.filter(slot => slot.group === 'speech').length, 17);
  assert.equal(slots.at(-1).id, 'layer/background');
});

test('plans and prices follow the checked Runway list and anchors match poses', () => {
  const project = addDealer(createSeedProject(), 'paow', 'Paow');
  const by = id => forgeSlots(project).find(slot => slot.id === id);
  assert.deepEqual([slotPlan(by('idle.ready/'), { quality: '720' }).model, slotPlan(by('idle.ready/'), { quality: '720' }).credits], ['gen4_turbo', 25]);
  assert.deepEqual([slotPlan(by('idle.ready/'), { quality: '1080' }).model, slotPlan(by('idle.ready/'), { quality: '1080' }).credits], ['wan3', 100]);
  assert.equal(slotPlan(by('deal.player.left/box0'), { quality: '720' }).credits, 20);
  assert.equal(slotPlan(by('deal.player.left/box0'), { quality: '1080', duration: 2 }).credits, 40);
  assert.equal(slotPlan(by('layer/table'), { quality: '1080' }).credits, 8);
  assert.equal(slotPlan(by('layer/background'), { quality: '720' }).ratio, '1280:720');
  assert.deepEqual([slotPlan(by('speak.other/greeting'), {}).model, slotPlan(by('speak.other/greeting'), { speechSeconds: 7 }).credits], ['gwm1_avatars', 6]);
  assert.equal(slotPlan(by('speak.other/greeting'), { mode: 'keyframe', quality: '720' }).credits, 50);
  assert.throws(() => slotPlan(by('deal.player.left/box0'), { mode: 'reference' }), /referens/i);
  assert.throws(() => slotPlan(by('pose/vila'), {}), /laddas upp/);
  assert.deepEqual(anchorsFor(by('deal.player.left/box0'), slotPlan(by('deal.player.left/box0'), {})), ['redo']);
  assert.deepEqual(anchorsFor(by('transition.shoe/to-shoe'), slotPlan(by('transition.shoe/to-shoe'), {})), ['vila', 'redo']);
  assert.deepEqual(anchorsFor(by('idle.ready/'), slotPlan(by('idle.ready/'), { quality: '720' })), ['vila']);
});

test('prompts carry the canonical coordinates, green key and the slot motion; profile validation is strict', () => {
  const project = addDealer(createSeedProject(), 'paow', 'Paow');
  const profile = validateProfile({ subject: 'woman with dark hair, white shirt' });
  const prompt = slotPrompt(forgeSlots(project).find(slot => slot.id === 'deal.player.centre/box3'), profile);
  assert.match(prompt, /x=540, y=1115/); assert.match(prompt, /chroma green/); assert.match(prompt, /player position 4/); assert.match(prompt, /woman with dark hair/);
  assert.match(slotPrompt(forgeSlots(project).find(slot => slot.id === 'deal.player.centre/box3'), profile, { expression: 'smile' }), /closed-mouth smile/);
  assert.match(slotPrompt(forgeSlots(project).find(slot => slot.id === 'layer/table'), profile), /magenta/);
  assert.match(slotPrompt(forgeSlots(project).find(slot => slot.id === 'speak.other/greeting'), profile, { speechText: 'Place your bets' }), /"Place your bets"/);
  assert.deepEqual(validateProfile({}).positions, DEFAULT_POSITIONS);
  assert.throws(() => validatePositions({ 1: { cx: 5000, cy: 1 } }), /plats 1–7/);
  assert.throws(() => validateProfile({ avatar: { id: 'bad id!' } }), /avatar/);
  assert.equal(validateProfile({ language: 'sv' }).language, 'sv');
});

test('anchor upload normalizes to the green master and stores a private source anchor; state reports slot status', async () => {
  const { service, blobs } = fixture();
  const result = await service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/jpeg', dataBase64: Buffer.from('jpegbytes').toString('base64') }, actor);
  assert.match(result.anchor.pathname, /^croupier\/media\/dealers\/paow\/source\/anchors\/[a-f0-9-]{36}\/[a-f0-9]{64}\.png$/);
  assert.equal(blobs.size, 1); assert.equal(result.profile.revision, 1);
  const state = await service.state('paow');
  assert.equal(state.slots.find(slot => slot.id === 'pose/vila').status.level, 'ready');
  assert.equal(state.slots.find(slot => slot.id === 'pose/redo').status.level, 'required');
  assert.equal(state.slots.find(slot => slot.id === 'deal.player.left/box0').status.level, 'recommended');
  assert.equal(state.slots.find(slot => slot.id === 'transition.shoe/to-shoe').status.level, 'blocked');
  assert.equal(state.runwayConfigured, true); assert.equal(state.migrationReady, true);
  await assert.rejects(service.uploadAnchor('paow', { pose: 'side', contentType: 'image/png', dataBase64: 'AA==' }, actor), /vila eller redo/);
  await assert.rejects(service.uploadAnchor('nobody', { pose: 'vila', contentType: 'image/png', dataBase64: 'AA==' }, actor), /inte registrerad/);
});

test('deal job: keyframe wan3 with marked last frame, poll commits the MP4 into the exact slot as a review upload', async () => {
  const { service, submitted, tasks, registered, store, failPut } = fixture();
  await service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/png', dataBase64: PNG.toString('base64') }, actor);
  await assert.rejects(service.createJob('paow', { slotId: 'deal.player.centre/box3', quality: '720' }, actor), error => error instanceof ForgeError && error.code === 'forge_anchor_missing');
  await service.uploadAnchor('paow', { pose: 'redo', contentType: 'image/png', dataBase64: Buffer.concat([PNG, Buffer.from('redo')]).toString('base64') }, actor);
  const job = await service.createJob('paow', { slotId: 'deal.player.centre/box3', quality: '720', maxCredits: 50 }, actor);
  assert.equal(job.status, 'running'); assert.equal(job.taskId, 'task-1'); assert.equal(job.request.params, undefined);
  const params = submitted[0].params;
  assert.equal(params.model, 'wan3'); assert.equal(params.ratio, 'auto_720p'); assert.equal(params.duration, 2); assert.equal(params.audio, false);
  assert.deepEqual(params.promptImage.map(image => image.position), ['first', 'last']);
  assert.match(params.promptText, /x=540, y=1115/);
  const running = await service.pollJob('paow', job.jobId, actor);
  assert.equal(running.status, 'running'); assert.equal(running.result.progress, 0.3);
  tasks.set('task-1', { id: 'task-1', status: 'SUCCEEDED', output: ['https://out/clip.mp4'], credits: 20 });
  const done = await service.pollJob('paow', job.jobId, actor);
  assert.equal(done.status, 'succeeded'); assert.equal(done.result.credits, 20); assert.equal(done.result.role, 'standard');
  assert.equal(registered.length, 1);
  const record = registered[0];
  assert.deepEqual([record.classification.dealerId, record.classification.eventId, record.classification.situation, record.classification.kind, record.classification.role], ['paow', 'deal.player.centre', 'box3', 'action', 'standard']);
  assert.equal(record.classification.compositing.mode, 'green-screen');
  assert.equal(record.pathname, `croupier/media/dealers/paow/review/uploads/${record.id}/${record.sha256}.mp4`);
  assert.equal(record.sha256, sha(MP4));
  // The second clip in the same slot becomes a variant; a failed commit keeps the paid output for a retry.
  const second = await service.createJob('paow', { slotId: 'deal.player.centre/box3', quality: '720', expression: 'smile' }, actor);
  assert.match(second.request.prompt, /closed-mouth smile/);
  tasks.set(second.taskId, { id: second.taskId, status: 'SUCCEEDED', output: ['https://out/clip2.mp4'], credits: 20 });
  failPut.once = true;
  await assert.rejects(service.pollJob('paow', second.jobId, actor), /blob down/);
  assert.equal((await store.getJob(second.jobId)).status, 'generated');
  const retried = await service.pollJob('paow', second.jobId, actor);
  assert.equal(retried.status, 'succeeded'); assert.equal(retried.result.role, 'alternative');
  const state = await service.state('paow');
  assert.equal(state.slots.find(slot => slot.id === 'deal.player.centre/box3').media.length, 2);
  assert.equal(state.slots.find(slot => slot.id === 'deal.player.centre/box3').status.label, '2 klipp');
  assert.equal(state.jobs.length, 2);
});

test('reference mode reuses an existing clip in the slot; budget and missing event are refused before any paid call', async () => {
  const { service, submitted, tasks } = fixture();
  await service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/png', dataBase64: PNG.toString('base64') }, actor);
  await service.uploadAnchor('paow', { pose: 'redo', contentType: 'image/png', dataBase64: Buffer.concat([PNG, Buffer.from('redo')]).toString('base64') }, actor);
  await assert.rejects(service.createJob('paow', { slotId: 'deal.player.left/box0', quality: '1080', duration: 10, maxCredits: 100 }, actor), error => error.code === 'forge_budget_exceeded');
  await assert.rejects(service.createJob('paow', { slotId: 'transition.shoe/to-shoe' }, actor), error => error.code === 'forge_slot_needs_event');
  assert.equal(submitted.length, 0);
  const job = await service.createJob('paow', { slotId: 'deal.player.left/box0', quality: '720' }, actor);
  tasks.set(job.taskId, { id: job.taskId, status: 'SUCCEEDED', output: ['https://out/a.mp4'], credits: 20 });
  const done = await service.pollJob('paow', job.jobId, actor);
  const variant = await service.createJob('paow', { slotId: 'deal.player.left/box0', quality: '720', mode: 'reference', referenceMediaId: done.result.mediaId, duration: 5 }, actor);
  const params = submitted.at(-1).params;
  assert.equal(variant.request.mode, 'reference'); assert.equal(params.ratio, '720:1280'); assert.equal(params.referenceVideos.length, 1); assert.equal(params.promptImage[0].position, undefined);
  assert.equal(variant.request.referenceMediaId, done.result.mediaId);
});

test('failed, cancelled and submit-unknown tasks are journaled without a second paid submission', async () => {
  const unknown = new RunwayError('timeout', { code: 'runway_submit_unknown', submitUnknown: true });
  const { service, tasks, submitted } = fixture({ runway: { imageToVideo: async params => { submitted.push({ params }); if (submitted.length === 1) throw unknown; const id = `task-${submitted.length}`; tasks.set(id, { id, status: 'FAILED', failure: 'content moderation' }); return id; } } });
  await service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/png', dataBase64: PNG.toString('base64') }, actor);
  const first = await service.createJob('paow', { slotId: 'idle.ready/', quality: '720' }, actor);
  assert.equal(first.status, 'submit_unknown'); assert.equal(first.taskId, null);
  assert.equal((await service.pollJob('paow', first.jobId, actor)).status, 'submit_unknown');
  const resolved = await service.resolveUnknown('paow', first.jobId, { taskId: 'task-manual' }, actor);
  assert.equal(resolved.status, 'running'); assert.equal(resolved.taskId, 'task-manual');
  const second = await service.createJob('paow', { slotId: 'idle.ready/', quality: '720' }, actor);
  const failed = await service.pollJob('paow', second.jobId, actor);
  assert.equal(failed.status, 'failed'); assert.match(failed.error, /content moderation/);
  const third = await service.createJob('paow', { slotId: 'idle.ready/', quality: '720' }, actor);
  tasks.set(third.taskId, { id: third.taskId, status: 'RUNNING' });
  assert.equal((await service.cancelJob('paow', third.jobId, actor)).status, 'cancelled');
  assert.equal(submitted.length, 3);
});

test('pose job adopts the generated REDO anchor; table and background jobs become Forge layer assets in the project', async () => {
  const { service, tasks, documents, blobs } = fixture();
  await service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/png', dataBase64: PNG.toString('base64') }, actor);
  const pose = await service.createJob('paow', { slotId: 'pose/redo', quality: '1080' }, actor);
  assert.equal(pose.request.model, 'gen4_image'); assert.equal(pose.request.plan.credits, 8);
  tasks.set(pose.taskId, { id: pose.taskId, status: 'SUCCEEDED', output: ['https://out/png/redo.png'], credits: 8 });
  const done = await service.pollJob('paow', pose.jobId, actor);
  assert.equal(done.status, 'succeeded'); assert.equal(done.result.adopted, true);
  assert.equal((await service.state('paow')).profile.anchors.redo.sha256, done.result.anchor.sha256);
  const table = await service.createJob('paow', { slotId: 'layer/table', quality: '1080' }, actor);
  tasks.set(table.taskId, { id: table.taskId, status: 'SUCCEEDED', output: ['https://out/png/table.png'], credits: 8 });
  const tableDone = await service.pollJob('paow', table.jobId, actor);
  const background = await service.createJob('paow', { slotId: 'layer/background', quality: '720' }, actor);
  tasks.set(background.taskId, { id: background.taskId, status: 'SUCCEEDED', output: ['https://out/png/bg.png'], credits: 5 });
  await service.pollJob('paow', background.jobId, actor);
  const assets = documents.get('project').value.layerAssets;
  assert.equal(assets.length, 2);
  assert.deepEqual(assets.map(asset => asset.role), ['table', 'background']);
  assert.equal(assets[0].id, tableDone.result.assetId); assert.equal(assets[0].contentType, 'image/webp'); assert.match(assets[0].label, /^Forge · bord · paow/);
  assert.ok(blobs.has(assets[0].pathname) && blobs.has(assets[1].pathname));
  const state = await service.state('paow');
  assert.equal(state.slots.find(slot => slot.id === 'layer/table').status.level, 'ready');
  assert.equal(state.layers.length, 2);
});

test('speech job creates the avatar once, waits for READY, then submits an avatar video with the line text', async () => {
  let avatarStatus = 'PROCESSING';
  const { service, submitted, tasks } = fixture({ runway: { avatar: async () => ({ id: 'avatar-1', status: avatarStatus }) } });
  await service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/png', dataBase64: PNG.toString('base64') }, actor);
  const job = await service.createJob('paow', { slotId: 'speak.other/greeting' }, actor);
  assert.equal(job.status, 'queued'); assert.equal(submitted.at(-1).endpoint, 'avatars'); assert.equal(submitted.at(-1).params.voice.presetId, 'clara');
  assert.equal((await service.pollJob('paow', job.jobId, actor)).status, 'queued');
  avatarStatus = 'READY';
  const running = await service.pollJob('paow', job.jobId, actor);
  assert.equal(running.status, 'running'); assert.equal(submitted.at(-1).endpoint, 'avatar_videos');
  assert.deepEqual(submitted.at(-1).params.avatar, { type: 'custom', avatarId: 'avatar-1' });
  assert.match(submitted.at(-1).params.speech.text, /Welcome to Priv/);
  tasks.set(running.taskId, { id: running.taskId, status: 'SUCCEEDED', output: ['https://out/speech.mp4'], credits: 4 });
  const done = await service.pollJob('paow', job.jobId, actor);
  assert.equal(done.status, 'succeeded');
  const state = await service.state('paow');
  assert.equal(state.profile.avatar.status, 'READY');
  assert.equal(state.slots.find(slot => slot.id === 'speak.other/greeting').media[0].role, 'standard');
  const second = await service.createJob('paow', { slotId: 'speak.other/greeting' }, actor);
  assert.equal(second.status, 'running'); // avatar already READY: direct submission
});

test('createDealer registers through the project store with every event line; migration pending is reported', async () => {
  const { service, projectSaves, store } = fixture();
  const created = await service.createDealer({ dealerId: 'nova', label: 'Nova' }, { actor: 'tester', stillAuthorized: async () => true });
  assert.deepEqual(created.dealer, { id: 'nova', label: 'Nova' });
  assert.equal(projectSaves.length, 1); assert.ok(projectSaves[0].next.dealers.some(row => row.id === 'nova'));
  assert.ok((await service.listDealers()).some(row => row.id === 'nova'));
  await assert.rejects(service.createDealer({ dealerId: 'Nova!', label: 'x' }, { actor: 'tester' }), /dealer-id/i);
  store.setReady(false);
  const state = await service.state('nova');
  assert.equal(state.migrationReady, false); assert.equal(state.jobs.length, 0);
  await assert.rejects(service.createJob('nova', { slotId: 'idle.ready/' }, actor), error => error.code === 'forge_migration_pending');
});

test('store SQL keeps the scope-first parameter convention and journals jobs with CAS', async () => {
  const calls = [];
  const client = { query: async (sql, values) => { calls.push({ sql, values }); if (/forge:ready/.test(sql)) return { rows: [{ ready: true }] }; if (/profile-insert/.test(sql)) return { rows: [{ revision: 1 }] }; if (/job-update/.test(sql)) return { rows: [] }; return { rows: [] }; } };
  const repository = { async transaction(work) { return work(); }, async withTransactionClient(work) { return work(client); } };
  const store = createDealerForgeStore({ repository, scope, now: () => 42 });
  assert.equal(await store.ready(), true);
  const saved = await store.saveProfile('paow', { a: 1 }, { actor: 'tester' });
  assert.equal(saved.revision, 1);
  const job = await store.insertJob({ dealerId: 'paow', slotId: 'idle.ready/', kind: 'clip', status: 'running', taskId: 't', request: { plan: {} }, actor: 'tester' });
  assert.match(job.jobId, /^[a-f0-9-]{36}$/);
  await assert.rejects(store.updateJob(job.jobId, { expectedStatus: 'running', status: 'succeeded' }), error => error.code === 'studio_forge_conflict');
  assert.ok(calls.every(call => call.values[0] === 'test' && call.values[1] === 'ws'));
  assert.ok(calls.some(call => /INSERT INTO croupier_studio\.forge_jobs/.test(call.sql) && call.values[2] === job.jobId && call.values[12] === 42));
  await assert.rejects(store.insertJob({ dealerId: 'paow', slotId: 'x/', kind: 'clip', status: 'bogus', request: {}, actor: 'tester' }), /status/);
});

test('runway client: data URIs for small references, headers and no retry on ambiguous submit', async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, init });
    if (url.endsWith('/v1/image_to_video')) throw new Error('socket hang up');
    if (url.endsWith('/v1/tasks/t1')) return new Response(JSON.stringify({ id: 't1', status: 'SUCCEEDED', output: ['https://cdn/x.mp4'], cost: { credits: 25 } }), { status: 200 });
    if (url.endsWith('/v1/text_to_image')) return new Response(JSON.stringify({ error: 'Insufficient credits' }), { status: 402 });
    return new Response('{}', { status: 200 });
  };
  const client = createRunwayClient({ env: { RUNWAY_API_KEY: 'k'.repeat(24) }, fetchImpl });
  assert.match(await client.asset(Buffer.from('abc'), 'image/png'), /^data:image\/png;base64,/);
  await assert.rejects(client.asset(Buffer.from('abc'), 'text/plain'), /PNG/);
  await assert.rejects(client.imageToVideo({ model: 'gen4_turbo' }), error => error instanceof RunwayError && error.submitUnknown && error.code === 'runway_submit_unknown');
  assert.equal(requests.filter(row => row.url.endsWith('/v1/image_to_video')).length, 1);
  const task = await client.task('t1');
  assert.deepEqual([task.status, task.output, task.credits], ['SUCCEEDED', ['https://cdn/x.mp4'], 25]);
  await assert.rejects(client.textToImage({}), error => error.code === 'runway_credits' && /Insufficient credits/.test(error.message));
  const headers = requests[0].init.headers;
  assert.equal(headers['X-Runway-Version'], '2024-11-06'); assert.match(headers.Authorization, /^Bearer k+$/);
  assert.throws(() => createRunwayClient({ env: {} }), error => error.code === 'runway_key_missing');
  await assert.rejects(client.download('http://insecure/x.mp4'), /HTTPS/);
});
