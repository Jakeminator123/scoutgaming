import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSpeechJournal } from '../web/postgres-speech-journal.mjs';
import { createGeneratedSpeechService } from '../web/generated-speech.mjs';
import { createGeneratedSpeechStreamService } from '../web/generated-speech-stream.mjs';
import { createSpeechSessionManager, SPEECH_SESSION_POLICY } from '../web/generated-speech-session.mjs';
import { GENERATED_SPEECH_DEFAULTS } from '../web/generated-speech-provider.mjs';
import { speechMemoryPool } from './fixtures/speech-memory-pool.mjs';

const digest = input => createHash('sha256').update(input).digest('hex');
const dealerAvatar = (dealerId='paow') => {const bytes=Buffer.from('synthetic owned image '+dealerId);return {schemaVersion:1,dealerId,profileRevision:digest(dealerId),imageSha256:digest(bytes),imageBase64:bytes.toString('base64')};};
const response = value => new Response(JSON.stringify(value), { headers:{ 'content-type':'application/json' } });
const input = patch => ({ owner:'isolated-runtime-owner', playerId:'isolated-player', requestId:'runtime-request',
  dealerId:'astrid', text:'A precise saved reply.', beforeCostly:async () => {}, ...patch });
const generated = text => {
  const audio = Buffer.from(`synthetic audio ${text}`), video = Buffer.from(`synthetic video ${text}`);
  return { exactText:text, ...GENERATED_SPEECH_DEFAULTS, provider:{ kind:'cartesia-runpod' },
    audio:{ bytes:audio, sha256:digest(audio), durationMs:2000, contentType:'audio/wav' },
    video:{ bytes:video, sha256:digest(video), fps:24, frameCount:48, contentType:'video/mp4' } };
};
async function fixture(t, { stamp = Date.parse('2026-10-03T23:59:00Z'), submit, initialPolicy = true } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-journal-runtime-'));
  let time = stamp, connected = false, busy = false, starts = 0;
  const pool = speechMemoryPool(() => time), journal = await createSpeechJournal({ pool, environmentId:'isolated-runtime', now:() => time });
  if (initialPolicy) {
    await journal.initializeBudgetPolicy({ dailyBudgetMicroUsd:1000000, confirmation:'verified-new-empty-cost-journal' });
    await journal.initializeFullfileBudgetPolicy({ reserveMicroUsd:200000,currentBudgetMicroUsd:1000000,confirmation:'verified-new-empty-cost-journal' });
  }
  const config = { apiKey:'synthetic-private-key', endpointId:'runtime-fixture',
    workerSecret:'worker-fixture-secret-at-least-32-characters', origin:'https://render.croupier-qa.invalid', reserveUsd:'0.20', dailyBudgetUsd:'1' };
  const calls = [], managers = [], services = [], jobs = new Map();
  const savedArtifacts = new Map(); let artifactReads = 0;
  const artifacts = {
    async save({ artifactId, ownerHash, speechPackage, audio, video }) {
      savedArtifacts.set(artifactId, { ownerHash, audio:Buffer.from(audio.bytes), video:Buffer.from(video.bytes) });
      return { speechPackage, artifacts:{ fixtureId:artifactId, ownerHash } };
    },
    async get({ artifactId, kind, ownerHash }) {
      artifactReads++; const value = savedArtifacts.get(artifactId);
      assert.equal(value?.ownerHash, ownerHash);
      return { bytes:Buffer.from(value[kind]), contentType:kind === 'audio' ? 'audio/wav' : 'video/mp4' };
    },
  };
  const deps = { journal, journalRequired:true, now:() => time, workerState:() => ({ workers:Number(connected), busy:Number(busy), available:Number(connected && !busy) }),
    stopWorker:() => { connected = false; }, sleep:async ms => { time += ms; }, readyTimeoutMs:1000,
    fetchImpl:async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith('/run')) { starts++; if (submit) return submit(url, init); const id = `synthetic-job-${starts}`; jobs.set(id, 'IN_PROGRESS'); return response({ id, status:'IN_QUEUE' }); }
      const id = url.split('/').at(-1);
      if (url.includes('/status/')) { if (jobs.get(id) === 'IN_PROGRESS') connected = true; return response({ id, status:jobs.get(id) }); }
      if (url.includes('/cancel/')) { jobs.set(id, 'CANCELLED'); connected = false; return response({ id, status:'CANCELLED' }); }
      assert.fail('unexpected fixture provider URL');
    } };
  const manager = patch => { const value = createSpeechSessionManager(config, { ...deps, ...patch }); managers.push(value); return value; };
  t.after(async () => { await Promise.allSettled(services.map(value => value.close())); await Promise.allSettled(managers.map(value => value.close())); await rm(directory, { recursive:true, force:true }); });
  return { directory, pool, journal, config, deps, calls, jobs, manager, services, artifacts, artifactReads:() => artifactReads, starts:() => starts,
    setTime:value => { time = value; }, getTime:() => time, busy:value => { busy = value; } };
}

test('journal admission accepts a 135-second owned avatar startup with one reservation', async t => {
  const f=await fixture(t),started=f.getTime();let allowConnection=true;
  const manager=f.manager({readyTimeoutMs:undefined,
    workerState:()=>{const ready=allowConnection&&f.getTime()-started>=135000;return {workers:Number(ready),busy:0,available:Number(ready)};}});
  const ready=await manager.ensure({beforeCostly:async()=>{},avatar:dealerAvatar()});
  assert.equal(ready.ready,true);assert.equal(ready.binding.dealerId,'paow');
  assert.equal(f.getTime()-started,135000);assert.equal(f.starts(),1);
  assert.equal(f.calls.filter(call=>call.url.includes('/cancel/')).length,0);
  const submitted=JSON.parse(f.calls.find(call=>call.url.endsWith('/run')).init.body);
  assert.equal(submitted.input.ttl,540);assert.equal(submitted.policy.executionTimeout,600000);
  allowConnection=false;
});

test('journal cold-start deadline stays bounded and reserves no replacement job', async t => {
  const f=await fixture(t),started=f.getTime();
  const manager=f.manager({readyTimeoutMs:undefined,workerState:()=>({workers:0,busy:0,available:0})});
  await assert.rejects(manager.ensure({beforeCostly:async()=>{},avatar:dealerAvatar()}),{code:'generated_speech_session_start_timeout'});
  assert.equal(f.getTime()-started,SPEECH_SESSION_POLICY.admissionWindowMs);
  assert.equal(f.starts(),1);assert.equal(f.calls.filter(call=>call.url.includes('/cancel/')).length,1);
});

test('disconnect after 90 seconds still cancels cold preparation immediately', async t => {
  const f=await fixture(t),started=f.getTime(),controller=new AbortController();
  const manager=f.manager({readyTimeoutMs:undefined,workerState:()=>({workers:0,busy:0,available:0}),
    sleep:async ms=>{f.setTime(f.getTime()+ms);if(f.getTime()-started>=100000)controller.abort();}});
  await assert.rejects(manager.ensure({beforeCostly:async()=>{},signal:controller.signal,avatar:dealerAvatar()}),{code:'generated_speech_session_cancelled'});
  assert.equal(f.getTime()-started,100000);assert.equal(f.starts(),1);
  assert.equal(f.calls.filter(call=>call.url.includes('/cancel/')).length,1);
});

test('longer startup allowance does not extend retirement of a lingering old dealer', async t => {
  const durations=[];
  for(const readyTimeoutMs of [90000,undefined]){
    const f=await fixture(t),started=f.getTime();let lingering=true;
    const manager=f.manager({readyTimeoutMs,workerState:()=>{
      const connected=lingering&&f.starts()>0;return {workers:Number(connected),busy:0,available:Number(connected)};
    }});
    await manager.ensure({beforeCostly:async()=>{},avatar:dealerAvatar()});
    try {
      await assert.rejects(manager.ensure({beforeCostly:async()=>{},avatar:dealerAvatar('dragge')}),{code:'generated_speech_session_stop_timeout'});
      durations.push(f.getTime()-started);assert.equal(f.starts(),1);
    } finally { lingering=false; }
  }
  assert.deepEqual(durations,[135000,135000]); // Existing 45 s drain + 90 s retirement.
});

test('Neon opt-in without journal fails before disk, relay or provider; no policy auto bootstrap', async t => {
  const f = await fixture(t, { initialPolicy:false }); let relay = 0;
  assert.throws(() => createGeneratedSpeechService({ reserveMicroUsd:200000, dailyBudgetMicroUsd:1000000 }, { journalRequired:true }), { code:'generated_speech_journal_unavailable' });
  assert.throws(() => createSpeechSessionManager(f.config, { ...f.deps, journal:null }), { code:'generated_speech_journal_unavailable' });
  await assert.rejects(createGeneratedSpeechStreamService({}, {}, { journalRequired:true, resolveOwner:() => '', attachRelay:() => { relay++; } }), { code:'generated_speech_journal_unavailable' });
  assert.equal(relay, 0); assert.equal(f.calls.length, 0); assert.deepEqual(await readdir(f.directory), []);
  await assert.rejects(f.manager().ensure(input()), { code:'generated_speech_budget_policy_missing' });
  assert.equal(f.pool.state.policies.size, 0); assert.equal(f.pool.state.sessions.size, 0); assert.equal(f.starts(), 0);
});

test('journal pins dealer binding before submit, reuses only matching profile and retires old worker before switching',async t=>{
  const f=await fixture(t),manager=f.manager(),avatar=dealerAvatar();
  const first=await manager.ensure(input({avatar}));
  assert.deepEqual(JSON.parse(f.calls.find(call=>call.url.endsWith('/run')).init.body).input.avatar,avatar);
  const headers={'x-dealer-id':'paow','x-speech-profile-revision':avatar.profileRevision,'x-speech-image-sha256':avatar.imageSha256,'x-speech-protocol':'3'};
  assert.equal(manager.authorizeWorker(headers,first.workerId),true);assert.equal(manager.authorizeWorker({},first.workerId),false);
  assert.equal(manager.authorizeWorker(headers,'untracked'),false);
  assert.equal((await manager.ensure(input({avatar}))).workerId,first.workerId);assert.equal(f.starts(),1);
  f.busy(true);await assert.rejects(manager.ensure(input({avatar:dealerAvatar('dragge')})),{code:'generated_speech_stream_busy'});assert.equal(f.starts(),1);
  f.busy(false);const second=await manager.ensure(input({avatar:dealerAvatar('dragge')}));
  assert.notEqual(second.workerId,first.workerId);assert.equal(f.starts(),2);
  assert.equal(manager.authorizeWorker(headers,first.workerId),false);
  assert.notEqual([...f.pool.state.sessions.values()][0].released_at_ms,null);
});
test('simultaneous different dealer cannot join a pending paid session',async t=>{
  const f=await fixture(t);let release,started;
  const gate=new Promise(resolve=>{release=resolve;}),submitted=new Promise(resolve=>{started=resolve;});
  const manager=f.manager({fetchImpl:async(url,init)=>{if(url.endsWith('/run')){started();await gate;}return f.deps.fetchImpl(url,init);}});
  const first=manager.ensure(input({avatar:dealerAvatar()}));await submitted;
  await assert.rejects(manager.ensure(input({avatar:dealerAvatar('dragge')})),{code:'generated_speech_stream_busy'});
  release();const ready=await first;assert.equal(ready.binding.dealerId,'paow');assert.equal(f.starts(),1);
});
test('restarted manager drains an unknown previous dealer binding without admitting a replacement on the recovery turn',async t=>{
  const f=await fixture(t),first=f.manager(),avatar=dealerAvatar();await first.ensure(input({avatar}));
  f.setTime(f.getTime()+SPEECH_SESSION_POLICY.reservationWindowMs+1);
  const restarted=f.manager();
  await assert.rejects(restarted.ensure(input({avatar:dealerAvatar('dragge')})),{code:'generated_speech_recovery_required'});
  assert.equal(f.starts(),1);assert.notEqual([...f.pool.state.sessions.values()][0].released_at_ms,null);
  assert.equal(restarted.authorizeWorker({},[...f.pool.state.sessions.values()][0].worker_id),false);
});

test('actual session caller reserves both UTC days, shares one submit and persists no disk ledger', async t => {
  const f = await fixture(t), manager = f.manager();
  await Promise.all([manager.ensure(input()), manager.ensure(input({ requestId:'second' }))]);
  assert.equal(f.starts(), 1); assert.equal(f.pool.state.sessions.size, 1);
  assert.deepEqual([...f.pool.state.reservations.values()].map(row => [row.day, row.reserved_micro_usd]), [['2026-10-03','200000'], ['2026-10-04','200000']]);
  assert.deepEqual(await readdir(f.directory), []);
  const posted = JSON.parse(f.calls[0].init.body);
  assert.deepEqual(posted.policy, { executionTimeout:600000, ttl:660000 });
  assert.equal(posted.input.ttl, SPEECH_SESSION_POLICY.seconds);
  f.busy(true); await assert.rejects(manager.ensure(input()), { code:'generated_speech_stream_busy' });
  assert.equal(f.calls.filter(value => value.url.includes('/cancel/')).length, 0);
  f.busy(false); await manager.close();
  assert.equal([...f.pool.state.sessions.values()][0].terminal_status, 'CANCELLED');
  assert.notEqual([...f.pool.state.sessions.values()][0].released_at_ms, null);
  assert.equal(f.pool.state.reservations.size, 2, 'no refund on cancel');
});

test('normal close lets the exact idle worker complete without cancellation intent or a second job', async t => {
  const f = await fixture(t);
  const stopped = [];
  const manager = f.manager({ stopWorker: workerId => {
    assert.match(workerId, /^croupier-[a-f0-9]{32}$/);
    stopped.push(workerId);
    f.deps.stopWorker(workerId); f.jobs.set('synthetic-job-1', 'COMPLETED'); return true;
  } });
  await manager.ensure(input()); await Promise.all([manager.close(), manager.close()]);
  const session = [...f.pool.state.sessions.values()][0];
  assert.equal(session.terminal_status, 'COMPLETED');
  assert.equal(session.cancel_requested_at_ms, null);
  assert.notEqual(session.released_at_ms, null);
  assert.equal(f.calls.filter(call => call.url.includes('/cancel/')).length, 0);
  assert.deepEqual(stopped, [session.worker_id]);
  assert.equal(f.starts(), 1);
  assert.equal(f.pool.state.reservations.size, 2, 'graceful completion never refunds its reservation');
});

test('new demand cannot reuse or replace a worker while its graceful retirement is pending', async t => {
  const f = await fixture(t);
  let releaseSleep, stopped;
  const held = new Promise(resolve => { releaseSleep = resolve; });
  const stopping = new Promise(resolve => { stopped = resolve; });
  let holdRetirement = false, firstSleep = true;
  const manager = f.manager({ idleTimeoutMs:10,
    stopWorker: workerId => { f.deps.stopWorker(workerId); stopped(); return true; },
    sleep: async ms => { f.setTime(f.getTime() + ms); if (holdRetirement && firstSleep) { firstSleep = false; await held; } },
  });
  await manager.ensure(input()); holdRetirement = true;
  let waitTimer;
  try {
    await Promise.race([
      stopping,
      new Promise((_, reject) => { waitTimer = setTimeout(() => reject(Error('idle retirement did not start')), 1_000); }),
    ]);
  } finally { clearTimeout(waitTimer); }
  await assert.rejects(manager.ensure(input({ requestId:'during-graceful-stop' })), { code:'generated_speech_session_stopping' });
  assert.equal(f.starts(), 1);
  releaseSleep();
  const deadline = Date.now() + 1_000;
  while ([...f.pool.state.sessions.values()][0].released_at_ms === null) {
    if (Date.now() >= deadline) assert.fail('fallback cancellation did not finish');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.equal(f.calls.filter(call => call.url.includes('/cancel/')).length, 1);
  await manager.close();
  assert.equal(f.starts(), 1);
});

test('lost paid submit response remains uncertain through restart and prevents second provider POST', async t => {
  const f = await fixture(t, { submit:async () => { throw Error('synthetic lost response'); } });
  await assert.rejects(f.manager().ensure(input()), { code:'generated_speech_session_unavailable' });
  assert.equal([...f.pool.state.sessions.values()][0].state, 'submission_uncertain');
  f.setTime(f.getTime() + SPEECH_SESSION_POLICY.reservationWindowMs + 1);
  await assert.rejects(f.manager().ensure(input({ requestId:'after-restart' })), { code:'generated_speech_session_submission_uncertain' });
  assert.equal(f.starts(), 1); assert.equal(f.pool.state.reservations.size, 2);
  assert.deepEqual(await readdir(f.directory), []);
});

test('failed durable submit marker never reaches the provider and keeps reservation fenced', async t => {
  const f = await fixture(t); f.pool.failNext('update_session:state');
  await assert.rejects(f.manager().ensure(input()), { code:'generated_speech_journal_unavailable' });
  assert.equal(f.starts(), 0); assert.equal([...f.pool.state.sessions.values()][0].state, 'reserved');
});

test('fullfile caller caches SQL identity on restart, preserves owned bytes and blocks capability replay', async t => {
  const f = await fixture(t); let paid = 0;
  const construct = () => createGeneratedSpeechService({ reserveMicroUsd:200000, dailyBudgetMicroUsd:1000000 }, { journal:f.journal, journalRequired:true, artifacts:f.artifacts,
    provider:{ generate:async ({ text, beforeCostly }) => { await beforeCostly(); paid++; return generated(text); } } });
  const service = construct(), packageValue = await service.generate(input());
  assert.equal(paid, 1); assert.equal([...f.pool.state.requests.values()][0].state, 'completed');
  assert.deepEqual(await construct().generate(input()), packageValue); assert.equal(paid, 1);
  await assert.rejects(construct().generate(input({ text:'Different reply.' })), { code:'generated_speech_request_conflict' });
  const id = packageValue.packageId.slice('generated-'.length);
  assert.equal(digest((await service.media({ id, kind:'audio', owner:input().owner })).bytes), packageValue.audio.sha256);
  await assert.rejects(service.media({ id, kind:'audio', owner:'foreign' }), { code:'generated_speech_not_found' });
  assert.equal(f.artifactReads(), 1, 'foreign owner fails SQL before artifact read');
  assert.deepEqual(await readdir(f.directory), [], 'SQL journal and private artifact adapter; no disk fallback');
  await assert.rejects(f.journal.findRequest({ ownerHash:digest(input().owner), requestId:input().requestId, fingerprint:digest('different'), capability:'stream' }), { code:'generated_speech_request_conflict' });
});

test('fullfile uncertainty and lost submit-marker commit never authorize a second mutation', async t => {
  const f = await fixture(t); let paid = 0;
  const construct = () => createGeneratedSpeechService({ directory:f.directory, reserveMicroUsd:200000, dailyBudgetMicroUsd:1000000 }, { journal:f.journal, artifacts:f.artifacts, provider:{ generate:async () => { paid++; throw Error('unknown paid result'); } } });
  await assert.rejects(construct().generate(input()), { code:'generated_speech_failed' });
  assert.equal(paid, 1); assert.equal([...f.pool.state.requests.values()][0].state, 'submission_uncertain');
  await assert.rejects(construct().generate(input()), { code:'generated_speech_request_already_attempted' }); assert.equal(paid, 1);
  f.setTime(f.getTime() + SPEECH_SESSION_POLICY.reservationWindowMs + 1);
  await assert.rejects(construct().generate(input({ requestId:'new-after-restart' })), { code:'generated_speech_recovery_required' }); assert.equal(paid, 1);
});

test('Neon fullfile requires private artifact adapter before any reservation or provider call', async t => {
  const f = await fixture(t);
  assert.throws(() => createGeneratedSpeechService({ directory:f.directory, reserveMicroUsd:200000, dailyBudgetMicroUsd:1000000 }, { journal:f.journal, journalRequired:true }), { code:'generated_speech_artifacts_unavailable' });
  assert.equal(f.pool.state.requests.size, 0); assert.deepEqual(await readdir(f.directory), []);
});

test('lost fullfile submit-marker commit cannot call provider and completed owner lookup is environment scoped', async t => {
  const f = await fixture(t); let paid = 0;
  const wrapped = { ...f.journal,
    async markRequestSubmissionStarted(value) { f.pool.failNext('COMMIT', { afterCommit:true }); return f.journal.markRequestSubmissionStarted(value); } };
  const service = createGeneratedSpeechService({ directory:f.directory, reserveMicroUsd:200000, dailyBudgetMicroUsd:1000000 }, { journal:wrapped, artifacts:f.artifacts, provider:{ generate:async () => { paid++; } } });
  await assert.rejects(service.generate(input()), { code:'generated_speech_journal_unavailable' }); assert.equal(paid, 0);
  assert.equal([...f.pool.state.requests.values()][0].state, 'submission_uncertain');
  const foreign = await createSpeechJournal({ pool:f.pool, environmentId:'foreign-runtime', now:f.getTime });
  await assert.rejects(foreign.getCompletedPackageById({ ownerHash:digest(input().owner), packageId:'generated-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }), { code:'generated_speech_not_found' });
});

test('known expired 404 retirement preserves cost, fails current turn and admits replacement only on later demand', async t => {
  const f = await fixture(t); const initial = f.manager(); await initial.ensure(input());
  // Simulate restart without gracefully cancelling the known job.
  f.setTime(f.getTime() + SPEECH_SESSION_POLICY.reservationWindowMs + 1);
  f.deps.stopWorker();
  const restarted = f.manager({ workerState:() => ({ workers:0, busy:0, available:0 }), fetchImpl:async () => new Response('', { status:404 }) });
  await assert.rejects(restarted.ensure(input()), { code:'generated_speech_session_provider_not_found' });
  const old = [...f.pool.state.sessions.values()][0];
  assert.equal(old.terminal_status, 'TIMED_OUT'); assert.notEqual(old.released_at_ms, null); assert.equal(f.starts(), 1);
  const replacement = f.manager(); await replacement.ensure(input({ requestId:'explicit-later' }));
  assert.equal(f.starts(), 2); assert.equal(f.pool.state.reservations.size, 3, 'prior two-day reservation plus new-day reservation retained');
});

test('stream prepare remains unpaid, paid source uses SQL identity and cancellation before source is permanent', async t => {
  const f = await fixture(t); let relayOptions, paid = 0;
  const relay = { status:() => ({ workers:1, available:1, busy:0 }), close() {},
    openSource:() => ({ writePCM:async () => {}, end() {}, abort() {} }) };
  const construct = async () => {
  const service = await createGeneratedSpeechStreamService({}, { workerSecret:f.config.workerSecret,
      ticketSecret:f.config.workerSecret, origin:f.config.origin, voiceId:'fixture-voice', modelId:'fixture-model' }, {
      journal:f.journal, journalRequired:true, resolveOwner:async request => request.owner,
      attachRelay:(_, options) => { relayOptions = options; return relay; },
      pcmSource:async function*({ beforeCostly }) { await beforeCostly(); paid++; yield new Uint8Array(48); } });
    f.services.push(service); return service;
  };
  const service = await construct(), descriptor = await service.prepare(input());
  assert.equal(paid, 0); assert.equal([...f.pool.state.requests.values()][0].state, 'reserved');
  const request = { owner:input().owner, headers:{ 'sec-websocket-protocol':`astrid-v2, ticket.${descriptor.ticket}` } };
  const identity = await relayOptions.authenticateClient(request);
  await relayOptions.onSessionReady({ ...identity, signal:new AbortController().signal });
  assert.equal(paid, 1); assert.equal([...f.pool.state.requests.values()][0].state, 'completed');
  service.cancelOwner(input().owner);
  await service.prepare(input({ requestId:'cancel-before-paid' })); service.cancelOwner(input().owner); await service.close();
  assert.equal([...f.pool.state.requests.values()][1].state, 'failed'); assert.equal(paid, 1);
  const restarted = await construct();
  await assert.rejects(restarted.prepare(input()), { code:'generated_speech_request_already_attempted' });
  assert.deepEqual(await readdir(f.directory), []);
});

test('Neon close waits for pending idle cancellation, terminal and drain before releasing the lease', async t => {
  const f = await fixture(t);
  let releaseCancel, cancelStarted = false, closed = false;
  const held = new Promise(resolve => { releaseCancel = resolve; });
  const manager = f.manager({ idleTimeoutMs: 10, fetchImpl: async (url, init) => {
    if (url.includes('/cancel/')) { cancelStarted = true; await held; }
    return f.deps.fetchImpl(url, init);
  } });
  await manager.ensure(input());
  await t.waitFor(() => assert.equal(cancelStarted, true), { interval: 5, timeout: 1000 });
  const closing = manager.close().then(() => { closed = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(closed, false);
  assert.equal([...f.pool.state.sessions.values()][0].terminal_status, null);
  releaseCancel(); await closing;
  const session = [...f.pool.state.sessions.values()][0];
  assert.equal(session.terminal_status, 'CANCELLED');
  assert.notEqual(session.cancel_requested_at_ms, null);
  assert.notEqual(session.released_at_ms, null);
  assert.equal(f.calls.filter(c => c.url.includes('/cancel/')).length, 1);
  assert.equal(f.starts(), 1);
  assert.equal(f.pool.state.reservations.size, 2, 'all day reservations retained');
});

test('stream shutdown retains its shared SQL fence until preparation and cancelled request writes finish', async t => {
  const pool = speechMemoryPool(Date.now);
  const actual = await createSpeechJournal({ pool, environmentId:'isolated-shutdown-fence', now:Date.now });
  await actual.initializeBudgetPolicy({ dailyBudgetMicroUsd:1000000, confirmation:'verified-new-empty-cost-journal' });
  let releaseWrites, releasePreparation, connected = false, providerState = 'IN_PROGRESS', releases = 0, paidRuns = 0, paidTts = 0;
  const writesGate = new Promise(resolve => { releaseWrites = resolve; });
  const preparationGate = new Promise(resolve => { releasePreparation = resolve; });
  const order = [];
  const journal = { ...actual,
    async failRequest(value) { order.push('request:waiting'); await writesGate; const result = await actual.failRequest(value); order.push('request:flushed'); return result; },
    async releaseLease(value) { releases++; await actual.releaseLease(value); order.push('lease:released'); },
  };
  const relay = {
    status:() => ({ workers:Number(connected), available:Number(connected), busy:0 }),
    workerStatus:() => ({ workers:Number(connected), available:Number(connected), busy:0 }),
    stopWorker() { order.push('worker:stop'); connected = false; providerState = 'COMPLETED'; return true; },
    close() { order.push('relay:close'); },
  };
  const service = await createGeneratedSpeechStreamService({}, {
    workerSecret:'isolated-shutdown-worker-secret-at-least-32-characters', ticketSecret:'isolated-shutdown-ticket-secret-at-least-32-characters',
    origin:'https://shutdown-fixture.invalid', voiceId:'fixture-voice', modelId:'fixture-model',
    session:{ apiKey:'fixture-only', endpointId:'fixture-endpoint', reserveUsd:'0.20', dailyBudgetUsd:'1' },
  }, {
    journal, journalRequired:true, resolveOwner:async () => input().owner, attachRelay:() => relay,
    pcmSource:async function*() { paidTts++; },
    fetchImpl:async url => { if (url.endsWith('/run')) { paidRuns++; connected = true; }
      assert.ok(url.endsWith('/run') || url.includes('/status/'), 'natural retirement never submits cancellation');
      return response({ id:'fixture-job', status:providerState }); },
  });
  t.after(async () => { releasePreparation(); releaseWrites(); await Promise.allSettled([service.close()]); });
  await service.prepare(input());
  let freshChecks = 0;
  const preparing = service.prepare(input({ owner:'isolated-second-owner', requestId:'second-request',
    beforeCostly:async () => { if (++freshChecks === 2) await preparationGate; } }));
  const preparationOutcome = assert.rejects(preparing, { code:'generated_speech_stream_cancelled' });
  await t.waitFor(() => assert.equal(freshChecks, 2), { interval:5, timeout:1000 });
  const closing = service.close();
  assert.equal(service.close(), closing);
  let closed = false;
  const observedClose = closing.then(() => { closed = true; });
  observedClose.catch(() => {});
  await t.waitFor(() => assert.notEqual([...pool.state.sessions.values()][0].released_at_ms, null), { interval:5, timeout:1000 });
  assert.ok(order.includes('worker:stop'), 'worker retirement starts despite blocked request writes');
  assert.equal(releases, 0); assert.equal(closed, false);
  releasePreparation();
  await t.waitFor(() => assert.equal(order.filter(value => value === 'request:waiting').length, 2), { interval:5, timeout:1000 });
  assert.equal(releases, 0, 'request transactions still own the original fence');
  releaseWrites(); await preparationOutcome; await observedClose;
  assert.equal(releases, 1);
  assert.deepEqual([...pool.state.requests.values()].map(value => value.state), ['failed', 'failed']);
  assert.ok(order.lastIndexOf('request:flushed') < order.indexOf('lease:released'));
  assert.equal([...pool.state.sessions.values()][0].terminal_status, 'COMPLETED');
  assert.equal(paidRuns, 1); assert.equal(paidTts, 0);
  assert.ok(pool.state.reservations.size > 0, 'shutdown preserves reservations');
});
