import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createSeedProject, addDealer } from '../../../packages/presentation/contracts/studio-model.mjs';
import { forgeSlots, slotById, slotPlan, slotPrompt, anchorsFor, validateProfile, validatePositions, DEFAULT_POSITIONS } from '../lib/dealer-forge-catalog.mjs';
import {dealerMediaSlots} from '../lib/dealer-media-library.mjs';
import {ROULETTE_MEDIA_EVENTS} from '../../../packages/presentation/contracts/roulette-media.mjs';
import { ForgeError } from '../lib/dealer-forge-service.mjs';
import { fixture, sha, scope, PNG, MP4 } from './fixtures/dealer-forge-fixture.mjs';
import { createDealerForgeStore } from '../lib/dealer-forge-store.mjs';
import { createRunwayClient, RunwayError } from '../lib/runway-client.mjs';
import { createStudioRepository } from '../../../packages/studio-registry/server/document-repository.mjs';
import { createStudioMemoryPool } from '../../../test/fixtures/studio-memory-pool.mjs';
import { seedSavedVideoProject } from './fixtures/video-dealer-project.mjs';
import { checkPermanentMediaDeletion } from '../lib/studio-media-deletion.mjs';

const actor = { actor: 'tester' };

async function referenceFixture() {
 const pool=createStudioMemoryPool(),repository=createStudioRepository({pool,scope});
 seedSavedVideoProject(pool,scope,addDealer(createSeedProject(),'paow','Paow'));
 const id=randomUUID(),hash='a'.repeat(64),record={id,sha256:hash,size:32,contentType:'video/mp4',pathname:`croupier/media/dealers/paow/review/uploads/${id}/${hash}.mp4`,classification:{dealerId:'paow',eventId:'idle.ready',kind:'idle',role:'alternative',situation:'',label:'Input',notes:''}};
 await repository.registerMedia(record,{actor:'tester'});
 const row=await repository.getMedia(id),store=createDealerForgeStore({repository,scope,now:()=>1});
 const captured=Object.fromEntries(['id','sha256','pathname','revision'].map(key=>[key,row[key]]));
 const job={jobId:randomUUID(),dealerId:'paow',slotId:'idle.ready/',kind:'clip',status:'prepared',request:{referenceMediaId:id,referenceSha256:hash,mediaReferences:[captured],options:{referenceMediaId:id}},actor:'tester'};
 const archive=async()=>{const current=await repository.getMedia(id);return repository.classifyMedia(id,{sha256:hash,expectedRevision:current.revision,metadata:{...current.classification,archived:true},actor:'tester'});};
 const pending=async()=>{const current=await archive();return repository.setMediaDeletion(id,{expectedRevision:current.revision,sha256:hash,actor:'tester',deletion:{state:'pending',requestedAt:'2026-10-17T00:00:00.000Z'}});};
 return {pool,repository,store,row,job,archive,pending};
}

test('Forge atomically rejects tombstoned input IDs including queued audio options before inserting a job',async()=>{
 for(const reference of ['referenceMediaId','audioMediaId'])for(const state of ['pending','deleted']){
  const f=await referenceFixture(),pending=await f.pending();
  if(state==='deleted')await f.repository.setMediaDeletion(f.row.id,{expectedRevision:pending.revision,sha256:pending.sha256,actor:'tester',
   deletion:{...pending.deletion,state,completedAt:'2026-10-17T00:01:00.000Z'}});
  f.job.request={options:{[reference]:f.row.id}};
  await assert.rejects(f.store.insertJob(f.job),{code:'studio_forge_reference_conflict'});
  assert.equal(await f.store.getJob(f.job.jobId),null);
  assert.equal(f.pool.calls.some(call=>call.marker==='job-insert'),false);
 }
});

test('Forge captures exact input hash, pathname, revision and dealer before acquiring a reference',async()=>{
 for(const field of ['sha256','pathname','revision']){
  const f=await referenceFixture();f.job.request.mediaReferences[0][field]+='-changed';
  await assert.rejects(f.store.insertJob(f.job),{code:'studio_forge_reference_conflict'});
 }
 const f=await referenceFixture();f.job.dealerId='anna-jonsson';
 // A different registered dealer must not claim Paow media.
 f.pool.corruptDocument(scope,'project',doc=>({...doc,value:addDealer(doc.value,'anna-jonsson','Anna')}));
 await assert.rejects(f.store.insertJob(f.job),{code:'studio_forge_reference_conflict'});
});

test('a retained Forge reference blocks purge through ambiguous submission but terminal input history releases it',async()=>{
 const f=await referenceFixture();await f.store.insertJob(f.job);await f.archive();
 const inspect=async()=>{const row=await f.repository.getMedia(f.row.id);return checkPermanentMediaDeletion(f.repository,{id:row.id,sha256:row.sha256,expectedRevision:row.revision},{indexVerified:true});};
 assert.deepEqual(await inspect(),{allowed:false,reason:'studio_media_in_use'});
 await f.store.updateJob(f.job.jobId,{expectedStatus:'prepared',status:'submit_unknown'});
 assert.deepEqual(await inspect(),{allowed:false,reason:'studio_media_in_use'});
 await f.store.updateJob(f.job.jobId,{expectedStatus:'submit_unknown',status:'failed'});
 assert.deepEqual(await inspect(),{allowed:true});
 await f.pending();
 await assert.rejects(f.store.updateJob(f.job.jobId,{expectedStatus:'failed',status:'prepared'}),{code:'studio_forge_reference_conflict'});
 assert.equal((await f.store.getJob(f.job.jobId)).status,'failed');
});

test('a waiting Forge acquisition sees the deletion committed under the shared scope lock',async()=>{
 const f=await referenceFixture();let enter,release;
 const entered=new Promise(resolve=>{enter=resolve;}),hold=new Promise(resolve=>{release=resolve;});
 const deletion=f.repository.transaction(async()=>{enter();await hold;await f.pending();});
 await entered;
 const insertion=f.store.insertJob(f.job);
 release();await deletion;
 await assert.rejects(insertion,{code:'studio_forge_reference_conflict'});
 assert.equal(await f.store.getJob(f.job.jobId),null);
});

test('late Forge commits reject already pending media without losing an ambiguous provider outcome',async()=>{
 const f=await referenceFixture();await f.store.insertJob(f.job);await f.pending();
 await assert.rejects(f.store.assertJobReferences(f.job),{code:'studio_forge_reference_conflict'});
 await assert.rejects(f.store.updateJob(f.job.jobId,{expectedStatus:'prepared',status:'committing'}),{code:'studio_forge_reference_conflict'});
 assert.equal((await f.store.updateJob(f.job.jobId,{expectedStatus:'prepared',status:'submit_unknown'})).status,'submit_unknown');
});

test('roulette and game conditions never become blackjack Forge slots, provider submissions or saved jobs',async()=>{
  const project=addDealer(createSeedProject(),'paow','Paow'),roulette=dealerMediaSlots(project,'roulette');
  assert.equal(roulette.length,4);
  const gameConditions=project.events.filter(event=>['turn','settle'].includes(event.sourceType)).map(event=>({id:event.id+'/'}));
  const tampered={...project,events:[...project.events,...ROULETTE_MEDIA_EVENTS]};
  assert.deepEqual(forgeSlots(tampered),forgeSlots(project));
  const f=fixture();
  for(const slot of [...roulette,...gameConditions]){
    assert.throws(()=>slotById(project,slot.id),e=>e.code==='forge_slot_unknown');
    await assert.rejects(f.service.createJob('paow',{requestId:randomUUID(),slotId:slot.id,quality:'720'},actor),e=>e.code==='forge_slot_unknown');
  }
  assert.equal(f.submitted.length,0);assert.equal(f.store.jobs.size,0);assert.equal(f.registered.length,0);
});

test('catalog separates speech and idle while deal targets and shoe transitions retain their exact geometry', () => {
  const project = addDealer(createSeedProject(), 'paow', 'Paow');
  const slots = forgeSlots(project);
  assert.ok(slots.every(slot=>slot.group!=='reaction'&&!/^(turn|settle)\./.test(slot.eventId??'')));
  assert.deepEqual(slots.slice(0, 5).map(slot => slot.id), ['pose/vila', 'pose/redo', 'idle.ready/', 'transition.shoe/to-shoe', 'transition.shoe/from-shoe']);
  const toShoe = slots.find(slot => slot.id === 'transition.shoe/to-shoe');
  assert.deepEqual([toShoe.fromProject, Boolean(toShoe.needsEvent), toShoe.start, toShoe.end], [true, false, 'VILA', 'REDO']);
  // A raw document without the event still lists the slots, marked as waiting for it.
  const legacy = forgeSlots({ ...project, events: project.events.filter(event => event.id !== 'transition.shoe') });
  assert.deepEqual(legacy.map(slot=>slot.id),slots.map(slot=>slot.id)); assert.equal(legacy.find(slot => slot.id === 'transition.shoe/to-shoe').needsEvent, true);
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
  assert.equal(state.slots.find(slot => slot.id === 'transition.shoe/to-shoe').status.level, 'recommended');
  assert.equal(state.runwayConfigured, true); assert.equal(state.migrationReady, true);
  await assert.rejects(service.uploadAnchor('paow', { pose: 'side', contentType: 'image/png', dataBase64: 'AA==' }, actor), /vila eller redo/);
  await assert.rejects(service.uploadAnchor('nobody', { pose: 'vila', contentType: 'image/png', dataBase64: 'AA==' }, actor), /inte registrerad/);
});

test('deal job: keyframe wan3 with marked last frame, poll commits the MP4 into the exact slot as a review upload', async () => {
  const { service, submitted, tasks, registered, store, failPut } = fixture();
  await service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/png', dataBase64: PNG.toString('base64') }, actor);
  await assert.rejects(service.createJob('paow', { requestId: randomUUID(), slotId: 'deal.player.centre/box3', quality: '720' }, actor), error => error instanceof ForgeError && error.code === 'forge_anchor_missing');
  await service.uploadAnchor('paow', { pose: 'redo', contentType: 'image/png', dataBase64: Buffer.concat([PNG, Buffer.from('redo')]).toString('base64') }, actor);
  const job = await service.createJob('paow', { requestId: randomUUID(), slotId: 'deal.player.centre/box3', quality: '720', maxCredits: 50 }, actor);
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
  const second = await service.createJob('paow', { requestId: randomUUID(), slotId: 'deal.player.centre/box3', quality: '720', expression: 'smile' }, actor);
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

test('reference mode reuses an existing clip in the slot; budget is refused before any paid call; shoe transitions use both poses', async () => {
  const project = addDealer(createSeedProject(), 'paow', 'Paow');
  // A saved document from before the shoe event: normalizeProject adds the optional event on read.
  const { service, submitted, tasks } = fixture({ project: { ...project, events: project.events.filter(event => event.id !== 'transition.shoe') } });
  await service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/png', dataBase64: PNG.toString('base64') }, actor);
  await service.uploadAnchor('paow', { pose: 'redo', contentType: 'image/png', dataBase64: Buffer.concat([PNG, Buffer.from('redo')]).toString('base64') }, actor);
  await assert.rejects(service.createJob('paow', { requestId: randomUUID(), slotId: 'deal.player.left/box0', quality: '1080', duration: 10, maxCredits: 100 }, actor), error => error.code === 'forge_budget_exceeded');
  assert.equal(submitted.length, 0);
  const toShoe = await service.createJob('paow', { requestId: randomUUID(), slotId: 'transition.shoe/to-shoe', quality: '1080', duration: 2, maxCredits: 100 }, actor);
  assert.equal(toShoe.status, 'running'); assert.deepEqual(Object.keys(toShoe.request.anchors).sort(), ['redo', 'vila']);
  assert.deepEqual(submitted.at(-1).params.promptImage.map(image => image.position), ['first', 'last']);
  const job = await service.createJob('paow', { requestId: randomUUID(), slotId: 'deal.player.left/box0', quality: '720' }, actor);
  tasks.set(job.taskId, { id: job.taskId, status: 'SUCCEEDED', output: ['https://out/a.mp4'], credits: 20 });
  const done = await service.pollJob('paow', job.jobId, actor);
  const variant = await service.createJob('paow', { requestId: randomUUID(), slotId: 'deal.player.left/box0', quality: '720', mode: 'reference', referenceMediaId: done.result.mediaId, duration: 5 }, actor);
  const params = submitted.at(-1).params;
  assert.equal(variant.request.mode, 'reference'); assert.equal(params.ratio, '720:1280'); assert.equal(params.referenceVideos.length, 1); assert.equal(params.promptImage[0].position, undefined);
  assert.equal(variant.request.referenceMediaId, done.result.mediaId);
});

test('failed, cancelled and submit-unknown tasks are journaled without a second paid submission', async () => {
  const unknown = new RunwayError('timeout', { code: 'runway_submit_unknown', submitUnknown: true });
  const { service, tasks, submitted } = fixture({ runway: { imageToVideo: async params => { submitted.push({ params }); if (submitted.length === 1) throw unknown; const id = `task-${submitted.length}`; tasks.set(id, { id, status: 'FAILED', failure: 'content moderation' }); return id; } } });
  await service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/png', dataBase64: PNG.toString('base64') }, actor);
  const first = await service.createJob('paow', { requestId: randomUUID(), slotId: 'idle.ready/', quality: '720' }, actor);
  assert.equal(first.status, 'submit_unknown'); assert.equal(first.taskId, null);
  assert.equal((await service.pollJob('paow', first.jobId, actor)).status, 'submit_unknown');
  const resolved = await service.resolveUnknown('paow', first.jobId, { taskId: 'task-manual' }, actor);
  assert.equal(resolved.status, 'running'); assert.equal(resolved.taskId, 'task-manual');
  const second = await service.createJob('paow', { requestId: randomUUID(), slotId: 'idle.ready/', quality: '720' }, actor);
  const failed = await service.pollJob('paow', second.jobId, actor);
  assert.equal(failed.status, 'failed'); assert.match(failed.error, /content moderation/);
  const third = await service.createJob('paow', { requestId: randomUUID(), slotId: 'idle.ready/', quality: '720' }, actor);
  tasks.set(third.taskId, { id: third.taskId, status: 'RUNNING' });
  assert.equal((await service.cancelJob('paow', third.jobId, actor)).status, 'cancelled');
  assert.equal(submitted.length, 3);
});

test('paid calls are journaled first: a failing journal never reaches Runway, a definite rejection is recorded as failed, nothing is charged twice', async () => {
  const { service, store, submitted } = fixture({ runway: { imageToVideo: async params => { submitted.push({ params }); throw new RunwayError('Runway avvisade anropet: content moderation', { status: 422, code: 'runway_request_failed' }); } } });
  await service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/png', dataBase64: PNG.toString('base64') }, actor);
  const body = { requestId: randomUUID(), slotId: 'idle.ready/', quality: '720' };
  const insert = store.insertJob; store.insertJob = async () => { throw new Error('journal down'); };
  await assert.rejects(service.createJob('paow', body, actor), /journal down/);
  assert.equal(submitted.length, 0, 'no Runway POST without a journal row');
  store.insertJob = insert;
  await assert.rejects(service.createJob('paow', body, actor), /content moderation/);
  const jobs = await store.listJobs('paow');
  assert.equal(jobs.length, 1); assert.equal(jobs[0].jobId, body.requestId); assert.equal(jobs[0].status, 'failed'); assert.equal(jobs[0].taskId, null); assert.match(jobs[0].error, /content moderation/);
  // The same request again returns the recorded rejection instead of a second POST.
  assert.equal((await service.createJob('paow', body, actor)).status, 'failed');
  assert.equal(submitted.length, 1);
  await assert.rejects(service.createJob('paow', { slotId: 'idle.ready/' }, actor), error => error.code === 'forge_request_id_required');
});

test('retry after the journal fails behind a paid POST returns the same job: one payment, one registration', async () => {
  const { service, store, submitted, tasks, registered, clock } = fixture();
  await service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/png', dataBase64: PNG.toString('base64') }, actor);
  const body = { requestId: randomUUID(), slotId: 'idle.ready/', quality: '720' };
  // The database goes away right after Runway accepted the POST: every outcome write and read-back fails.
  const update = store.updateJob, read = store.getJob;
  store.updateJob = async (id, change) => { if (change.expectedStatus === 'submitting') throw new Error('db down'); return update(id, change); };
  let reads = 0; store.getJob = async id => { if (++reads > 1) throw new Error('db down'); return read(id); };
  await assert.rejects(service.createJob('paow', body, actor), error => error.code === 'forge_submit_unrecorded' && /task-1/.test(error.message));
  store.updateJob = update; store.getJob = read;
  assert.equal(submitted.length, 1);
  // The operator retries with the same request: the journaled job comes back, nothing is paid again.
  const retried = await service.createJob('paow', body, actor);
  assert.equal(retried.jobId, body.requestId); assert.equal(retried.status, 'submitting'); assert.equal(submitted.length, 1);
  await assert.rejects(service.createJob('paow', { ...body, quality: '1080' }, actor), error => error.code === 'forge_request_reused');
  clock.now += 4 * 60_000;
  assert.equal((await service.pollJob('paow', body.requestId, actor)).status, 'submit_unknown');
  await service.resolveUnknown('paow', body.requestId, { taskId: 'task-1' }, actor);
  tasks.set('task-1', { id: 'task-1', status: 'SUCCEEDED', output: ['https://out/idle.mp4'], credits: 25 });
  assert.equal((await service.pollJob('paow', body.requestId, actor)).status, 'succeeded');
  assert.equal(submitted.length, 1); assert.equal(registered.length, 1);
});

test('a lost outcome write is retried and read back; a double click with one requestId pays once', async () => {
  const { service, store, submitted } = fixture();
  await service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/png', dataBase64: PNG.toString('base64') }, actor);
  const update = store.updateJob; let lost = true;
  // The write lands but its acknowledgement is lost once.
  store.updateJob = async (id, change) => { const saved = await update(id, change); if (lost && change.status === 'running') { lost = false; throw new Error('connection reset'); } return saved; };
  const body = { requestId: randomUUID(), slotId: 'idle.ready/', quality: '720' };
  const job = await service.createJob('paow', body, actor);
  assert.equal(job.status, 'running'); assert.equal(job.taskId, 'task-1');
  store.updateJob = update;
  const twin = { requestId: randomUUID(), slotId: 'idle.ready/', quality: '720' };
  const both = await Promise.all([service.createJob('paow', twin, actor), service.createJob('paow', twin, actor)]);
  assert.deepEqual(both.map(row => row.jobId), [twin.requestId, twin.requestId]);
  assert.equal(submitted.length, 2, 'one POST for the first request and one for the double click');
});

test('two concurrent requests with one key: the lease winner pays with the journaled seed even when its own insert lost the race', async () => {
  const { service, store, submitted } = fixture();
  await service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/png', dataBase64: PNG.toString('base64') }, actor);
  const body = { requestId: randomUUID(), slotId: 'idle.ready/', quality: '720' };
  // Both read prior=null; the first insert lands but its acknowledgement is held until the second request is done.
  const read = store.getJob, insert = store.insertJob; let emptyReads = 0, inserts = 0, release;
  const held = new Promise(resolve => { release = resolve; });
  store.getJob = async id => { const job = await read(id); if (!job) emptyReads += 1; return job; };
  store.insertJob = async row => { const result = await insert(row); if (++inserts === 1) await held; return result; };
  const random = Math.random, seeds = [0.1, 0.2]; Math.random = () => seeds.shift() ?? random();
  let first, second;
  try {
    first = service.createJob('paow', body, actor);
    second = await service.createJob('paow', body, actor);
  } finally { Math.random = random; release(); }
  first = await first;
  assert.equal(emptyReads, 2, 'both requests started without a journaled row');
  assert.deepEqual([first.jobId, second.jobId], [body.requestId, body.requestId]);
  assert.equal(submitted.length, 1, 'one paid POST');
  const journal = store.jobs.get(body.requestId).request;
  assert.equal(submitted[0].params.seed, journal.seed, 'the paid request carries the journaled seed');
  assert.equal(submitted[0].params.promptText, journal.prompt);
});

test('a prepared row never reached Runway: a retry resumes it once, an expired one fails without charge', async () => {
  const { service, store, submitted, clock } = fixture();
  await service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/png', dataBase64: PNG.toString('base64') }, actor);
  const update = store.updateJob; let block = true;
  store.updateJob = async (id, change) => { if (block && change.expectedStatus === 'prepared') { block = false; throw new Error('db down'); } return update(id, change); };
  const body = { requestId: randomUUID(), slotId: 'idle.ready/', quality: '720' };
  await assert.rejects(service.createJob('paow', body, actor), /db down/);
  assert.equal((await store.getJob(body.requestId)).status, 'prepared'); assert.equal(submitted.length, 0);
  const resumed = await service.createJob('paow', body, actor);
  assert.equal(resumed.status, 'running'); assert.equal(submitted.length, 1);
  assert.equal(submitted[0].params.seed, (await store.getJob(body.requestId)).request.seed, 'the resumed POST uses the journaled seed');
  block = true;
  const stale = { requestId: randomUUID(), slotId: 'idle.ready/', quality: '720' };
  await assert.rejects(service.createJob('paow', stale, actor), /db down/);
  assert.equal((await service.pollJob('paow', stale.requestId, actor)).status, 'prepared');
  clock.now += 4 * 60_000;
  const expired = await service.pollJob('paow', stale.requestId, actor);
  assert.equal(expired.status, 'failed'); assert.match(expired.error, /inget debiterades/);
  assert.equal((await service.createJob('paow', stale, actor)).status, 'failed');
  assert.equal(submitted.length, 1);
});

test('commit retries reuse the job-derived IDs: a lost journal write or blob acknowledgement never registers twice', async () => {
  const { service, store, tasks, registered, documents, repository, privateMedia, media } = fixture();
  await service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/png', dataBase64: PNG.toString('base64') }, actor);
  const update = store.updateJob; let failSucceeded = 1;
  store.updateJob = async (id, change) => { if (failSucceeded > 0 && change.status === 'succeeded') { failSucceeded -= 1; throw new Error('db down'); } return update(id, change); };
  const clip = await service.createJob('paow', { requestId: randomUUID(), slotId: 'idle.ready/', quality: '720' }, actor);
  tasks.set(clip.taskId, { id: clip.taskId, status: 'SUCCEEDED', output: ['https://out/idle.mp4'], credits: 25 });
  await assert.rejects(service.pollJob('paow', clip.jobId, actor), /db down/);
  assert.equal(registered.length, 1);
  const clipDone = await service.pollJob('paow', clip.jobId, actor);
  assert.equal(clipDone.status, 'succeeded'); assert.equal(registered.length, 1); assert.equal(clipDone.result.mediaId, registered[0].id);
  failSucceeded = 1;
  const table = await service.createJob('paow', { requestId: randomUUID(), slotId: 'layer/table', quality: '1080' }, actor);
  tasks.set(table.taskId, { id: table.taskId, status: 'SUCCEEDED', output: ['https://out/png/table.png'], credits: 8 });
  await assert.rejects(service.pollJob('paow', table.jobId, actor), /db down/);
  assert.equal((await service.pollJob('paow', table.jobId, actor)).status, 'succeeded');
  assert.equal(documents.get('project').value.layerAssets.length, 1);
  // Blob written but its acknowledgement lost, then registration fails: the retry finds the same object and registers once.
  const put = privateMedia.put; let lostPut = true;
  privateMedia.put = async (...args) => { await put(...args); if (lostPut) { lostPut = false; throw new Error('blob ack lost'); } };
  const register = repository.registerMedia; let failRegister = true;
  repository.registerMedia = async record => { if (failRegister) { failRegister = false; throw new Error('db down'); } return register(record); };
  const second = await service.createJob('paow', { requestId: randomUUID(), slotId: 'idle.ready/', quality: '720' }, actor);
  tasks.set(second.taskId, { id: second.taskId, status: 'SUCCEEDED', output: ['https://out/idle2.mp4'], credits: 25 });
  await assert.rejects(service.pollJob('paow', second.jobId, actor), /db down/);
  assert.equal((await service.pollJob('paow', second.jobId, actor)).status, 'succeeded');
  assert.equal(registered.length, 2); assert.equal(media.size, 2);
});

test('a broken 2xx provider response stays recoverable as submit_unknown and can be attached to its task', async () => {
  const real = createRunwayClient({ env: { RUNWAY_API_KEY: 'k'.repeat(24) }, fetchImpl: async () => new Response('<html>upstream reset', { status: 200 }) });
  const { service, tasks, registered } = fixture({ runway: { imageToVideo: params => real.imageToVideo(params) } });
  await service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/png', dataBase64: PNG.toString('base64') }, actor);
  const job = await service.createJob('paow', { requestId: randomUUID(), slotId: 'idle.ready/', quality: '720' }, actor);
  assert.equal(job.status, 'submit_unknown'); assert.match(job.error, /kan ha startats/);
  await service.resolveUnknown('paow', job.jobId, { taskId: 'task-from-portal' }, actor);
  tasks.set('task-from-portal', { id: 'task-from-portal', status: 'SUCCEEDED', output: ['https://out/idle.mp4'], credits: 25 });
  assert.equal((await service.pollJob('paow', job.jobId, actor)).status, 'succeeded');
  assert.equal(registered.length, 1);
});

test('two pollers on an avatar-queued job submit exactly one paid avatar video; the loser gets a conflict', async () => {
  let avatarStatus = 'PROCESSING';
  const { service, submitted } = fixture({ runway: { avatar: async () => ({ id: 'avatar-1', status: avatarStatus }) } });
  await service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/png', dataBase64: PNG.toString('base64') }, actor);
  const job = await service.createJob('paow', { requestId: randomUUID(), slotId: 'speak.other/greeting' }, actor);
  assert.equal(job.status, 'queued');
  avatarStatus = 'READY';
  const outcomes = await Promise.allSettled([service.pollJob('paow', job.jobId, actor), service.pollJob('paow', job.jobId, actor)]);
  const fulfilled = outcomes.filter(row => row.status === 'fulfilled'), rejected = outcomes.filter(row => row.status === 'rejected');
  assert.equal(fulfilled.length, 1); assert.equal(fulfilled[0].value.status, 'running');
  assert.equal(rejected.length, 1); assert.equal(rejected[0].reason.code, 'studio_forge_conflict');
  assert.equal(submitted.filter(row => row.endpoint === 'avatar_videos').length, 1);
});

test('a commit lease held by a dead worker is reclaimed after the lease window and the paid output is still registered', async () => {
  const { service, store, tasks, registered, clock } = fixture();
  await service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/png', dataBase64: PNG.toString('base64') }, actor);
  const job = await service.createJob('paow', { requestId: randomUUID(), slotId: 'idle.ready/', quality: '720' }, actor);
  tasks.set(job.taskId, { id: job.taskId, status: 'SUCCEEDED', output: ['https://out/idle.mp4'], credits: 25 });
  // Simulate a worker that took the lease and died before registering.
  Object.assign(store.jobs.get(job.jobId), { status: 'committing', result: { output: ['https://out/idle.mp4'], credits: 25, progress: 1 }, updatedAt: clock.now });
  assert.equal((await service.pollJob('paow', job.jobId, actor)).status, 'committing', 'a fresh lease is left alone');
  assert.equal(registered.length, 0);
  clock.now += 6 * 60_000;
  const done = await service.pollJob('paow', job.jobId, actor);
  assert.equal(done.status, 'succeeded'); assert.equal(registered.length, 1); assert.equal(done.result.credits, 25);
});

test('a submit lease held by a dead worker becomes submit_unknown instead of a silent resubmit; live leases cannot be cancelled', async () => {
  const { service, store, submitted, clock } = fixture();
  await service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/png', dataBase64: PNG.toString('base64') }, actor);
  const job = await service.createJob('paow', { requestId: randomUUID(), slotId: 'idle.ready/', quality: '720' }, actor);
  Object.assign(store.jobs.get(job.jobId), { status: 'submitting', taskId: null, updatedAt: clock.now });
  await assert.rejects(service.cancelJob('paow', job.jobId, actor), error => error.code === 'forge_job_busy');
  assert.equal((await service.pollJob('paow', job.jobId, actor)).status, 'submitting');
  clock.now += 4 * 60_000;
  const stale = await service.pollJob('paow', job.jobId, actor);
  assert.equal(stale.status, 'submit_unknown'); assert.match(stale.error, /Kontrollera portalen/);
  assert.equal(submitted.length, 1, 'no second paid submission');
  const resolved = await service.resolveUnknown('paow', job.jobId, { taskId: job.taskId }, actor);
  assert.equal(resolved.status, 'running');
  assert.equal((await service.cancelJob('paow', job.jobId, actor)).status, 'cancelled');
});

test('pose job adopts the generated REDO anchor; table and background jobs become Forge layer assets in the project', async () => {
  const { service, tasks, documents, blobs } = fixture();
  await service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/png', dataBase64: PNG.toString('base64') }, actor);
  const pose = await service.createJob('paow', { requestId: randomUUID(), slotId: 'pose/redo', quality: '1080' }, actor);
  assert.equal(pose.request.model, 'gen4_image'); assert.equal(pose.request.plan.credits, 8);
  tasks.set(pose.taskId, { id: pose.taskId, status: 'SUCCEEDED', output: ['https://out/png/redo.png'], credits: 8 });
  const done = await service.pollJob('paow', pose.jobId, actor);
  assert.equal(done.status, 'succeeded'); assert.equal(done.result.adopted, true);
  assert.equal((await service.state('paow')).profile.anchors.redo.sha256, done.result.anchor.sha256);
  const table = await service.createJob('paow', { requestId: randomUUID(), slotId: 'layer/table', quality: '1080' }, actor);
  tasks.set(table.taskId, { id: table.taskId, status: 'SUCCEEDED', output: ['https://out/png/table.png'], credits: 8 });
  const tableDone = await service.pollJob('paow', table.jobId, actor);
  const background = await service.createJob('paow', { requestId: randomUUID(), slotId: 'layer/background', quality: '720' }, actor);
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
  const job = await service.createJob('paow', { requestId: randomUUID(), slotId: 'speak.other/greeting' }, actor);
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
  const second = await service.createJob('paow', { requestId: randomUUID(), slotId: 'speak.other/greeting' }, actor);
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
  await assert.rejects(service.createJob('nova', { requestId: randomUUID(), slotId: 'idle.ready/' }, actor), error => error.code === 'forge_migration_pending');
});

test('store SQL keeps the scope-first parameter convention and journals jobs with CAS', async () => {
  const calls = [], rows = new Map();
  const toRow = values => ({ job_id: values[2], dealer_id: values[3], slot_id: values[4], kind: values[5], status: values[6], provider: 'runway', task_id: values[7], request: JSON.parse(values[8]), result: null, error: values[10], actor_id: values[11], created_at_ms: values[12], updated_at_ms: values[12] });
  const client = { query: async (sql, values) => {
    calls.push({ sql, values });
    if (/forge:ready/.test(sql)) return { rows: [{ ready: true }] };
    if (/profile-insert/.test(sql)) return { rows: [{ revision: 1 }] };
    if (/job-insert/.test(sql)) { if (rows.has(values[2])) return { rows: [] }; rows.set(values[2], toRow(values)); return { rows: [rows.get(values[2])] }; }
    if (/forge:job \*\//.test(sql)) return { rows: rows.has(values[2]) ? [rows.get(values[2])] : [] };
    return { rows: [] };
  } };
  let registered = true, locked = false;
  const repository = {
    async transaction(work) { locked = true; try { return await work(); } finally { locked = false; } },
    async withTransactionClient(work) { return work(client); },
    async readDocument() { assert.equal(locked, true); return { value: { dealers: registered ? [{ id: 'paow' }] : [] } }; },
  };
  const store = createDealerForgeStore({ repository, scope, now: () => 42 });
  assert.equal(await store.ready(), true);
  const saved = await store.saveProfile('paow', { a: 1 }, { actor: 'tester' });
  assert.equal(saved.revision, 1);
  const jobId = randomUUID();
  const first = await store.insertJob({ jobId, dealerId: 'paow', slotId: 'idle.ready/', kind: 'clip', status: 'prepared', request: { plan: {} }, actor: 'tester' });
  assert.equal(first.created, true); assert.equal(first.job.jobId, jobId); assert.equal(first.job.status, 'prepared');
  const again = await store.insertJob({ jobId, dealerId: 'paow', slotId: 'idle.ready/', kind: 'clip', status: 'prepared', request: { plan: {} }, actor: 'tester' });
  assert.equal(again.created, false); assert.equal(again.job.jobId, jobId);
  assert.ok(calls.some(call => /ON CONFLICT DO NOTHING RETURNING \*/.test(call.sql)));
  await assert.rejects(store.updateJob(jobId, { expectedStatus: 'running', status: 'succeeded' }), error => error.code === 'studio_forge_conflict');
  assert.ok(calls.every(call => call.values[0] === 'test' && call.values[1] === 'ws'));
  assert.ok(calls.some(call => /INSERT INTO croupier_studio\.forge_jobs/.test(call.sql) && call.values[2] === jobId && call.values[12] === 42));
  await assert.rejects(store.insertJob({ dealerId: 'paow', slotId: 'x/', kind: 'clip', status: 'bogus', request: {}, actor: 'tester' }), /status/);
  await assert.rejects(store.insertJob({ jobId: 'not-a-uuid', dealerId: 'paow', slotId: 'x/', kind: 'clip', status: 'prepared', request: {}, actor: 'tester' }), error => error.code === 'studio_forge_invalid_job');
  registered = false;
  const before = calls.length;
  await assert.rejects(store.saveProfile('paow', {}, { actor: 'tester' }), error => error.code === 'studio_dealer_inactive');
  await assert.rejects(store.insertJob({ jobId: randomUUID(), dealerId: 'paow', slotId: 'idle.ready/', kind: 'clip', status: 'prepared', request: {}, actor: 'tester' }), error => error.code === 'studio_dealer_inactive');
  assert.equal(calls.length, before, 'retirement must prevent both INSERT paths before SQL mutation');
});

for (const slotId of ['idle.ready/', 'pose/redo', 'layer/table', 'layer/background']) {
  test(`retirement during provider download cannot restore a Forge result: ${slotId}`, async () => {
    const f = fixture();
    await f.service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/png', dataBase64: PNG.toString('base64') }, actor);
    const job = await f.service.createJob('paow', { requestId: randomUUID(), slotId, quality: '720' }, actor);
    const image = slotId !== 'idle.ready/';
    f.tasks.set(job.taskId, { id: job.taskId, status: 'SUCCEEDED', output: [image ? 'https://out/png/result.png' : 'https://out/result.mp4'], credits: 8 });
    f.runway.download = async () => {
      f.documents.get('project').value.dealers = [];
      f.store.profiles.delete('paow');
      f.store.jobs.delete(job.jobId);
      return Buffer.from(image ? PNG : MP4);
    };
    await assert.rejects(f.service.pollJob('paow', job.jobId, actor), error => error.code === 'studio_forge_conflict');
    assert.equal(f.store.jobs.has(job.jobId), false);
    assert.equal(f.store.profiles.has('paow'), false);
    assert.equal(f.media.size, 0);
    assert.equal((f.documents.get('project').value.layerAssets ?? []).length, 0);
  });
}

test('a stale Forge committer cannot consume or reset a replacement commit lease', async () => {
  const f = fixture();
  await f.service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/png', dataBase64: PNG.toString('base64') }, actor);
  const job = await f.service.createJob('paow', { requestId: randomUUID(), slotId: 'idle.ready/', quality: '720' }, actor);
  f.tasks.set(job.taskId, { id: job.taskId, status: 'SUCCEEDED', output: ['https://out/result.mp4'], credits: 8 });
  f.runway.download = async () => {
    f.store.jobs.get(job.jobId).updatedAt += 1;
    return Buffer.from(MP4);
  };
  await assert.rejects(f.service.pollJob('paow', job.jobId, actor), error => error.code === 'studio_forge_conflict');
  assert.equal(f.media.size, 0);
  assert.equal(f.store.jobs.get(job.jobId).status, 'committing');
  assert.equal(f.store.jobs.get(job.jobId).updatedAt, f.clock.now + 1);
});

test('an expired-lease poller cannot reclaim a lease renewed after its first read', async () => {
  const f = fixture();
  await f.service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/png', dataBase64: PNG.toString('base64') }, actor);
  const job = await f.service.createJob('paow', { requestId: randomUUID(), slotId: 'idle.ready/', quality: '720' }, actor);
  Object.assign(f.store.jobs.get(job.jobId), { status: 'committing', result: { output: ['https://out/result.mp4'], credits: 8 } });
  f.clock.now += 6 * 60_000;
  const read = f.store.getJob; let first = true;
  f.store.getJob = async id => {
    const saved = await read(id);
    if (first) { first = false; f.store.jobs.get(id).updatedAt = f.clock.now; }
    return saved;
  };
  await assert.rejects(f.service.pollJob('paow', job.jobId, actor), error => error.code === 'studio_forge_conflict');
  assert.equal(f.store.jobs.get(job.jobId).status, 'committing');
  assert.equal(f.store.jobs.get(job.jobId).updatedAt, f.clock.now);
  assert.equal(f.media.size, 0);
});

test('an existing Forge job cannot commit after only its dealer is unregistered', async () => {
  const f = fixture();
  await f.service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/png', dataBase64: PNG.toString('base64') }, actor);
  const job = await f.service.createJob('paow', { requestId: randomUUID(), slotId: 'idle.ready/', quality: '720' }, actor);
  f.tasks.set(job.taskId, { id: job.taskId, status: 'SUCCEEDED', output: ['https://out/result.mp4'], credits: 8 });
  f.runway.download = async () => { f.documents.get('project').value.dealers = []; return Buffer.from(MP4); };
  await assert.rejects(f.service.pollJob('paow', job.jobId, actor), error => error.code === 'studio_dealer_inactive');
  assert.equal(f.media.size, 0);
  assert.equal(f.store.jobs.get(job.jobId).status, 'committing');
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

test('runway client: only a definite 4xx is a rejection; every ambiguous submit answer is submit_unknown', async () => {
  const brokenBody = () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"id":')); controller.error(new Error('reset')); } }), { status: 200 });
  const answers = {
    'ok-garbage': () => new Response('<html>bad gateway', { status: 200 }),
    'ok-no-id': () => new Response(JSON.stringify({ status: 'PENDING' }), { status: 200 }),
    'ok-bad-id': () => new Response(JSON.stringify({ id: 'has spaces/and slashes' }), { status: 200 }),
    'ok-broken-stream': brokenBody,
    'server-error': () => new Response('oops', { status: 502 }),
    'timeout-status': () => new Response('', { status: 408 }),
    'rejected': () => new Response(JSON.stringify({ error: 'promptText too long' }), { status: 400 }),
    'rate-limited': () => new Response(JSON.stringify({ error: 'slow down' }), { status: 429 }),
  };
  let current = 'ok-garbage';
  const client = createRunwayClient({ env: { RUNWAY_API_KEY: 'k'.repeat(24) }, fetchImpl: async () => answers[current]() });
  for (const name of ['ok-garbage', 'ok-no-id', 'ok-bad-id', 'ok-broken-stream', 'server-error', 'timeout-status']) {
    current = name;
    await assert.rejects(client.imageToVideo({}), error => error instanceof RunwayError && error.submitUnknown === true && error.code === 'runway_submit_unknown', name);
    await assert.rejects(client.avatarVideo({}), error => error.submitUnknown === true, `${name} (avatar video)`);
  }
  for (const name of ['rejected', 'rate-limited']) {
    current = name;
    await assert.rejects(client.textToImage({}), error => error instanceof RunwayError && error.submitUnknown === false, name);
  }
  current = 'server-error';
  await assert.rejects(client.task('t1'), error => error.submitUnknown === false, 'a failed read is never submit_unknown');
  const truncated = createRunwayClient({ env: { RUNWAY_API_KEY: 'k'.repeat(24) }, fetchImpl: async () => new Response(new Uint8Array(10), { status: 200, headers: { 'Content-Length': '64' } }) });
  await assert.rejects(truncated.download('https://cdn/x.mp4'), error => error.code === 'runway_download_truncated');
});

// Sweep: fail every external call of a full job once (before its effect, after its effect, or as an ambiguous
// provider answer), keep retrying with the same requestId and let the operator resolve submit_unknown from the
// portal. Whatever breaks, Runway is paid at most once and a paid output is registered exactly once.
const SUBMIT_CALLS = new Set(['runway.imageToVideo', 'runway.textToImage']);
async function faultRun(slotId, fault) {
  const f = fixture();
  await f.service.uploadAnchor('paow', { pose: 'vila', contentType: 'image/png', dataBase64: PNG.toString('base64') }, actor);
  const log = []; let calls = 0;
  const targets = { store: [f.store, ['insertJob', 'getJob', 'updateJob', 'saveProfile', 'getProfile']], repository: [f.repository, ['readDocument', 'saveDocument', 'getMedia', 'registerMedia']],
    runway: [f.runway, ['asset', 'imageToVideo', 'textToImage', 'task', 'download']], blob: [f.privateMedia, ['put', 'get']] };
  for (const [prefix, [target, names]] of Object.entries(targets)) for (const name of names) {
    const real = target[name], label = `${prefix}.${name}`;
    target[name] = async (...args) => {
      const index = calls++; log.push(label);
      if (!fault || fault.index !== index) return real(...args);
      if (SUBMIT_CALLS.has(label)) {
        if (fault.mode === 'before') throw new RunwayError('Runway avvisade anropet: injected', { status: 422, code: 'runway_request_failed' });
        if (fault.mode === 'unknown') throw new RunwayError('injected timeout', { code: 'runway_submit_unknown', submitUnknown: true });
        await real(...args); throw new RunwayError('injected lost answer', { code: 'runway_submit_unknown', submitUnknown: true });
      }
      if (fault.mode === 'after') { await real(...args); throw new Error('injected after effect'); }
      throw new Error('injected before effect');
    };
  }
  const body = { requestId: randomUUID(), slotId, quality: slotId === 'idle.ready/' ? '720' : '1080' };
  const output = slotId === 'idle.ready/' ? 'https://out/idle.mp4' : 'https://out/png/out.png';
  const settle = () => { for (const [id, task] of f.tasks) if (task.status !== 'SUCCEEDED') f.tasks.set(id, { id, status: 'SUCCEEDED', output: [output], credits: 8 }); };
  const attempt = async work => { try { await work(); } catch { /* the operator just tries again */ } };
  for (let round = 0; round < 5; round += 1) {
    await attempt(() => f.service.createJob('paow', body, actor));
    settle();
    await attempt(() => f.service.pollJob('paow', body.requestId, actor));
    await attempt(() => f.service.pollJob('paow', body.requestId, actor));
    f.clock.now += 6 * 60_000;
  }
  const paid = f.submitted.filter(row => row.endpoint === 'image_to_video' || row.endpoint === 'text_to_image');
  const parked = f.store.jobs.get(body.requestId);
  if (parked?.status === 'submit_unknown') {
    // The operator checks the Runway portal: attach the task that exists, otherwise cancel.
    if (paid.length) await f.service.resolveUnknown('paow', body.requestId, { taskId: [...f.tasks.keys()].at(-1) }, actor);
    else await f.service.cancelJob('paow', body.requestId, actor);
    for (let round = 0; round < 3; round += 1) { settle(); await attempt(() => f.service.pollJob('paow', body.requestId, actor)); f.clock.now += 6 * 60_000; }
  }
  const committed = slotId === 'idle.ready/' ? f.media.size
    : slotId === 'layer/table' ? (f.documents.get('project').value.layerAssets ?? []).length
      : [...f.blobs.keys()].filter(path => path.includes('/source/anchors/')).length - 1;
  const journal = f.store.jobs.get(body.requestId)?.request;
  return { calls, log, paid: paid.length, committed, status: f.store.jobs.get(body.requestId)?.status ?? 'absent', seedMatches: paid.every(row => row.params.seed === journal?.seed) };
}

test('fault sweep: any single failure in a job, retried with the same requestId, pays at most once and commits exactly once', async () => {
  let scenarios = 0;
  for (const slotId of ['idle.ready/', 'layer/table', 'pose/redo']) {
    const clean = await faultRun(slotId, null);
    assert.deepEqual([clean.paid, clean.committed, clean.status], [1, 1, 'succeeded'], `clean run ${slotId}`);
    for (let index = 0; index < clean.calls; index += 1) {
      const modes = SUBMIT_CALLS.has(clean.log[index]) ? ['before', 'after', 'unknown'] : ['before', 'after'];
      for (const mode of modes) {
        const run = await faultRun(slotId, { index, mode });
        const where = `${slotId} · call ${index} ${clean.log[index]} · ${mode} → paid ${run.paid}, committed ${run.committed}, ${run.status}`;
        assert.ok(run.paid <= 1, `paid twice: ${where}`);
        assert.ok(run.committed <= 1, `committed twice: ${where}`);
        assert.ok(run.seedMatches, `paid seed differs from the journal: ${where}`);
        if (run.paid === 1) assert.deepEqual([run.status, run.committed], ['succeeded', 1], `paid output lost: ${where}`);
        else assert.ok(['failed', 'cancelled'].includes(run.status) && run.committed === 0, `unpaid job not closed: ${where}`);
        scenarios += 1;
      }
    }
  }
  assert.ok(scenarios > 60, `sweep covered ${scenarios} scenarios`);
});
