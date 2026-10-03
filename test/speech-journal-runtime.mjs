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
  const config = { directory, apiKey:'synthetic-private-key', endpointId:'runtime-fixture',
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

test('Neon opt-in without journal fails before disk, relay or provider; no policy auto bootstrap', async t => {
  const f = await fixture(t, { initialPolicy:false }); let relay = 0;
  assert.throws(() => createGeneratedSpeechService({ directory:f.directory, reserveMicroUsd:200000, dailyBudgetMicroUsd:1000000 }, { journalRequired:true }), { code:'generated_speech_journal_unavailable' });
  assert.throws(() => createSpeechSessionManager(f.config, { ...f.deps, journal:null }), { code:'generated_speech_journal_unavailable' });
  await assert.rejects(createGeneratedSpeechStreamService({}, { directory:f.directory }, { journalRequired:true, resolveOwner:() => '', attachRelay:() => { relay++; } }), { code:'generated_speech_journal_unavailable' });
  assert.equal(relay, 0); assert.equal(f.calls.length, 0); assert.deepEqual(await readdir(f.directory), []);
  await assert.rejects(f.manager().ensure(input()), { code:'generated_speech_budget_policy_missing' });
  assert.equal(f.pool.state.policies.size, 0); assert.equal(f.pool.state.sessions.size, 0); assert.equal(f.starts(), 0);
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
  const construct = () => createGeneratedSpeechService({ directory:f.directory, reserveMicroUsd:200000, dailyBudgetMicroUsd:1000000 }, { journal:f.journal, journalRequired:true, artifacts:f.artifacts,
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
    const service = await createGeneratedSpeechStreamService({}, { directory:f.directory, workerSecret:f.config.workerSecret,
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
