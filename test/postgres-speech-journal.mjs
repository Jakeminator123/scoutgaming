import {createMovingDriftController} from '../services/game/moving-drift-controller.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { summarizeMovingWorkerHealth } from '../services/game/moving-speech-runpod.mjs';
import { movingCapacityFixture } from './fixtures/moving-capacity.mjs';
import { speechMemoryPool as memoryPool } from './fixtures/speech-memory-pool.mjs';
import { createSpeechJournal, GPU_RESERVATION_WINDOW_MS, FULLFILE_ADMISSION_REMAINING_MS, speechRequestKey } from '../services/game/postgres-speech-journal.mjs';

// Deterministic transaction fixture, not a substitute for real PostgreSQL DDL,
// lock/constraint tests. No server, provider, env credential or Blob access.
const ownerHash = 'a'.repeat(64), otherOwner = 'b'.repeat(64), fingerprint = 'c'.repeat(64);
const emptyWorker = Object.freeze({ workers: 0, busy: 0, available: 0 });
const sessionId = '1'.repeat(32), sessionId2 = '2'.repeat(32);
const proof = id => ({ workerId: `croupier-${id}`, ...emptyWorker });
const rejection = (code, status) => error => error.code === code && error.message === code && (status === undefined || error.statusCode === status);
async function fixture({ environmentId = 'isolated-qa', stamp = Date.parse('2026-10-03T12:00:00Z'), dbClock = false } = {}) {
  let time = stamp;
  const pool = memoryPool(() => time), options = { pool, environmentId, ...(dbClock ? {} : { now: () => time }) };
  const journal = await createSpeechJournal(options);
  return { pool, journal, options, setTime: value => { time = value; }, getTime: () => time };
}
const streamLease = journal => journal.acquireLease({ resource: 'stream-session', holderId: 'runtime-a', ttlMs: GPU_RESERVATION_WINDOW_MS });
const fileBudget = Object.freeze({ reserveMicroUsd:250000, currentBudgetMicroUsd:1000000 });
const initFilePolicy = async journal => {
  await initPolicy(journal);
  await journal.initializeFullfileBudgetPolicy({ ...fileBudget, confirmation:'verified-new-empty-cost-journal' });
};
const fileLease = async journal => { await initFilePolicy(journal); return journal.acquireLease({ resource:'fullfile-provider', holderId:'runtime-a', ttlMs:GPU_RESERVATION_WINDOW_MS }); };
const initPolicy = (journal, dailyBudgetMicroUsd = 1000000) => journal.initializeBudgetPolicy({ dailyBudgetMicroUsd, confirmation: 'verified-new-empty-cost-journal' });
const reserve = (journal, lease, id = sessionId, extra = {}) => journal.reserveSession({ sessionId: id, endpointId: 'endpoint-fixture', lease, reserveMicroUsd: 250000, currentBudgetMicroUsd: 1000000, workerState: emptyWorker, ...extra });
const claim = (journal, lease, extra = {}) => journal.claimRequest({ ownerHash, requestId: 'request-1', fingerprint, capability: 'fullfile', lease, ...fileBudget, ...extra });
async function running(journal, lease, id = sessionId) {
  await reserve(journal, lease, id);
  await journal.markSubmissionStarted({ sessionId: id, lease });
  return journal.attachJob({ sessionId: id, lease, jobId: `job-${id}` });
}
async function finish(journal, lease, id = sessionId) {
  await journal.recordProviderStatus({ sessionId: id, lease, jobId: `job-${id}`, status: 'COMPLETED' });
  return journal.confirmWorkerDrained({ sessionId: id, lease, proof: proof(id) });
}

test('factory does not query/seed schema or cost state; request key matches existing disk format', async () => {
  const { pool } = await fixture();
  assert.equal(pool.trace.length, 0);
  assert.equal(speechRequestKey(ownerHash, 'request-1'), createHash('sha256').update(`${ownerHash}\0request-1`).digest('hex'));
  await assert.rejects(createSpeechJournal({ pool, environmentId: 'production/../../qa' }), rejection('studio_invalid_scope', 422));
  await assert.rejects(createSpeechJournal({ pool: {}, environmentId: 'isolated-qa' }), rejection('invalid_generated_speech_journal_input', 422));
  assert.equal(pool.trace.length, 0);
});

test('two writers claim one durable common key; conflicts cannot switch fingerprint/capability', async () => {
  const { pool, journal, options } = await fixture(), second = await createSpeechJournal(options), lease = await fileLease(journal);
  const results = await Promise.all([claim(journal, lease), claim(second, lease)]);
  assert.deepEqual(results.map(r => r.status).sort(), ['inFlight', 'new']);
  assert.equal(results[0].key, results[1].key); assert.equal(pool.state.requests.size, 1);
  await assert.rejects(claim(second, lease, { fingerprint: 'd'.repeat(64) }), rejection('generated_speech_request_conflict', 409));
  await assert.rejects(claim(second, lease, { capability: 'stream' }), rejection('generated_speech_request_conflict', 409));
  await assert.rejects(claim(journal, lease, { requestId: 'second-request' }), rejection('generated_speech_busy', 429));
  assert.equal(pool.state.requests.size, 1); assert.deepEqual(pool.counts, { connects: pool.counts.connects, releases: pool.counts.connects });
});

test('completed private metadata survives restart and is owner/environment scoped', async () => {
  const { pool, journal, options } = await fixture(), lease = await fileLease(journal), request = await claim(journal, lease);
  await journal.markRequestSubmissionStarted({ key: request.key, lease, ...fileBudget });
  const packageMetadata = { packageId: 'generated-fixture', exactText: 'Hej.', reviewStatus: 'pending', audio: { pathname: 'croupier/generated/audio.wav', sha256: 'e'.repeat(64) } };
  await journal.completeRequest({ key: request.key, lease, packageId: 'generated-fixture', packageMetadata });
  packageMetadata.audio.pathname = 'changed-after-call';
  const restarted = await createSpeechJournal(options), saved = await claim(restarted, undefined);
  assert.equal(saved.status, 'completed'); assert.equal(saved.packageMetadata.audio.pathname, 'croupier/generated/audio.wav');
  saved.packageMetadata.audio.pathname = 'caller-edit';
  assert.equal((await restarted.getCompletedPackage({ ownerHash, requestId: 'request-1' })).packageMetadata.audio.pathname, 'croupier/generated/audio.wav');
  await assert.rejects(restarted.getCompletedPackage({ ownerHash: otherOwner, requestId: 'request-1' }), rejection('generated_speech_not_found', 404));
  const differentEnvironment = await createSpeechJournal({ ...options, environmentId: 'another-qa' });
  await assert.rejects(differentEnvironment.getCompletedPackage({ ownerHash, requestId: 'request-1' }), rejection('generated_speech_not_found', 404));
  assert.equal(pool.state.requests.size, 1);
  await journal.releaseLease({ lease });
});

test('package metadata rejects credential/binary/query URL/getter inputs before persistence', async () => {
  const { journal, pool } = await fixture(), lease = await fileLease(journal), request = await claim(journal, lease);
  await journal.markRequestSubmissionStarted({ key: request.key, lease, ...fileBudget });
  const cases = [{ token: 'private' }, { nested: { apiKey: 'private' } }, { audio: 'data:audio/wav;base64,AAA=' }, { authorization: 'Bearer secret' },
    { video: 'https://blob.invalid/file?X-Amz-Signature=private' }, { audio: '/api/audio?token=private' }, { video: 'wss://worker.invalid/private' },
    { ticket: 'single-use-private' }, { video: 'https://user:private@blob.invalid/file' }, { get forbidden() { throw new Error('must not execute'); } }];
  for (const packageMetadata of cases) await assert.rejects(journal.completeRequest({ key: request.key, lease, packageId: 'generated-fixture', packageMetadata }), rejection('invalid_generated_speech_package', 422));
  assert.equal([...pool.state.requests.values()][0].state, 'submission_started');
  await assert.rejects(journal.completeRequest({ key: request.key, lease }), rejection('invalid_generated_speech_package', 422));
});

test('uncertain and failed request keys cannot retry after restart; expiry cannot forgive paid full-file work', async () => {
  const f = await fixture(), lease = await fileLease(f.journal), request = await claim(f.journal, lease);
  await f.journal.markRequestSubmissionStarted({ key: request.key, lease, ...fileBudget });
  assert.equal((await f.journal.failRequest({ key: request.key, lease })).state, 'submission_uncertain');
  f.setTime(f.getTime() + GPU_RESERVATION_WINDOW_MS + 1);
  const restarted = await createSpeechJournal(f.options);
  assert.equal((await claim(restarted, lease)).status, 'alreadyAttempted');
  await assert.rejects(fileLease(restarted), rejection('generated_speech_recovery_required', 409));
  await assert.rejects(restarted.completeRequest({ key: request.key, lease, packageId: 'generated-late', packageMetadata: {} }), rejection('generated_speech_stale_fence', 409));
  const fresh = await fixture(), nextLease = await fileLease(fresh.journal), next = await claim(fresh.journal, nextLease);
  assert.equal((await fresh.journal.failRequest({ key: next.key, lease: nextLease })).state, 'failed');
  await fresh.journal.releaseLease({ lease: nextLease });
  assert.equal((await claim(fresh.journal, undefined)).status, 'alreadyAttempted');
});

test('lease renewal/fence and stale completion are enforced on every writer', async () => {
  const f = await fixture(), lease = await f.journal.acquireLease({ resource: 'fullfile-provider', holderId: 'old', ttlMs: 1000 });
  await assert.rejects(fileLease(f.journal), rejection('generated_speech_lease_busy', 429));
  f.setTime(f.getTime() + 1000);
  const fresh = await f.journal.acquireLease({ resource: 'fullfile-provider', holderId: 'new', ttlMs: 1000 });
  assert.equal(fresh.fence, lease.fence + 1);
  const renewed = await f.journal.renewLease({ lease: fresh, ttlMs: 5000 }); assert.equal(renewed.fence, fresh.fence);
  await assert.rejects(claim(f.journal, lease), rejection('generated_speech_stale_fence', 409));
  const request = await claim(f.journal, fresh); await f.journal.markRequestSubmissionStarted({ key: request.key, lease: fresh, ...fileBudget });
  await assert.rejects(f.journal.completeRequest({ key: request.key, lease, packageId: 'generated-test', packageMetadata: {} }), rejection('generated_speech_stale_fence', 409));
  await assert.rejects(f.journal.releaseLease({ lease: fresh }), rejection('generated_speech_recovery_required', 409));
});

test('budget is never implicit; confirmed empty-only bootstrap does not increase persisted policy', async () => {
  const { journal, pool } = await fixture(), lease = await streamLease(journal);
  await assert.rejects(reserve(journal, lease), rejection('generated_speech_budget_policy_missing', 409));
  assert.equal(pool.state.sessions.size, 0); assert.equal(pool.state.policies.size, 0);
  await assert.rejects(journal.initializeBudgetPolicy({ dailyBudgetMicroUsd: 1000000 }), rejection('generated_speech_budget_bootstrap_required', 409));
  await initPolicy(journal, 500000);
  assert.deepEqual(await initPolicy(journal, 1000000), { dailyBudgetMicroUsd: 500000, savedBudgetMicroUsd: 500000 });
  assert.deepEqual(await journal.getBudgetPolicy({ currentBudgetMicroUsd: 300000 }), { dailyBudgetMicroUsd: 300000, savedBudgetMicroUsd: 500000 });
  const occupied = await fixture(), file = await streamLease(occupied.journal); await claim(occupied.journal, file, {capability:'stream'});
  await assert.rejects(initPolicy(occupied.journal), rejection('generated_speech_journal_invalid', 409));
  assert.equal(occupied.pool.state.policies.size, 0);
});

test('midnight reserves whole cost on both UTC days, no refund after terminal/cancel; min current/saved budget', async () => {
  const f = await fixture({ stamp: Date.parse('2026-10-03T23:55:00Z') }), lease = await streamLease(f.journal);
  await initPolicy(f.journal, 500000);
  const first = await reserve(f.journal, lease); assert.deepEqual(first.days, ['2026-10-03', '2026-10-04']);
  assert.equal(f.pool.state.reservations.size, 2); assert.ok([...f.pool.state.reservations.values()].every(r => Number(r.reserved_micro_usd) === 250000));
  await f.journal.markSubmissionStarted({ sessionId, lease }); await f.journal.attachJob({ sessionId, lease, jobId: `job-${sessionId}` }); await finish(f.journal, lease);
  await reserve(f.journal, lease, sessionId2); await f.journal.markSubmissionStarted({ sessionId: sessionId2, lease }); await f.journal.attachJob({ sessionId: sessionId2, lease, jobId: `job-${sessionId2}` });
  await f.journal.requestCancel({ sessionId: sessionId2, lease, jobId: `job-${sessionId2}` }); await f.journal.recordProviderStatus({ sessionId: sessionId2, lease, jobId: `job-${sessionId2}`, status: 'CANCELLED' });
  await f.journal.confirmWorkerDrained({ sessionId: sessionId2, lease, proof: proof(sessionId2) });
  assert.equal(f.pool.state.reservations.size, 4);
  await assert.rejects(reserve(f.journal, lease, '3'.repeat(32), { currentBudgetMicroUsd: 9000000 }), rejection('generated_speech_daily_budget_exhausted', 429));
  assert.equal(f.pool.state.reservations.size, 4);
});

test('provider cache permits reservations while pending jobs block reservation and drain without refund', async () => {
  const { journal, pool } = await fixture(), lease = await streamLease(journal); await initPolicy(journal);
  const health = (jobs = {}) => summarizeMovingWorkerHealth({
    workers: { idle: 1, ready: 1, running: 0, initializing: 0, throttled: 0, unhealthy: 0 },
    jobs: { completed: 1, failed: 0, inProgress: 0, inQueue: 0, retried: 0, ...jobs },
  });
  for (const jobs of [{ inQueue: 1 }, { inProgress: 1 }]) {
    await assert.rejects(reserve(journal, lease, sessionId, { workerState: health(jobs) }), rejection('generated_speech_worker_not_drained', 409));
    assert.equal(pool.state.sessions.size, 0); assert.equal(pool.state.reservations.size, 0);
  }
  await reserve(journal, lease, sessionId, { workerState: health() });
  await journal.markSubmissionStarted({ sessionId, lease });
  await journal.attachJob({ sessionId, lease, jobId: 'cache-fixture-job' });
  await journal.recordProviderStatus({ sessionId, lease, jobId: 'cache-fixture-job', status: 'COMPLETED' });
  for (const jobs of [{ inQueue: 1 }, { inProgress: 1 }]) {
    await assert.rejects(journal.confirmWorkerDrained({ sessionId, lease, proof: { ...proof(sessionId), ...health(jobs) } }), rejection('generated_speech_worker_not_drained', 409));
    assert.equal(pool.state.reservations.size, 1);
  }
  await journal.confirmWorkerDrained({ sessionId, lease, proof: { ...proof(sessionId), ...health() } });
  await reserve(journal, lease, sessionId2, { workerState: health() });
  assert.equal(pool.state.reservations.size, 2);
});

test('two writers cannot reserve two open GPU sessions; untracked worker and reservation rollback fail closed', async () => {
  const { journal, pool, options } = await fixture(), second = await createSpeechJournal(options), lease = await streamLease(journal);
  await initPolicy(journal);
  await assert.rejects(reserve(journal, lease, sessionId, { workerState: { ...emptyWorker, workers: 1 } }), rejection('generated_speech_worker_not_drained', 409));
  pool.failNext('insert_reservation');
  await assert.rejects(reserve(journal, lease), rejection('generated_speech_journal_unavailable', 503));
  assert.equal(pool.state.sessions.size, 0); assert.equal(pool.state.reservations.size, 0);
  const result = await Promise.allSettled([reserve(journal, lease), reserve(second, lease, sessionId2)]);
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(result.find(r => r.status === 'rejected').reason.code, 'generated_speech_session_busy');
  assert.equal(pool.state.sessions.size, 1); assert.equal(pool.state.reservations.size, 1);
});

test('moving capacity proof cannot weaken generic GPU reservation or terminal drain', async () => {
  const f=await fixture(),lease=await streamLease(f.journal);
  await initPolicy(f.journal);
  const movingCapacity=movingCapacityFixture({endpointId:'endpoint-fixture',now:f.getTime()});
  const warm={workers:1,busy:0,available:1};
  const initialLease=structuredClone([...f.pool.state.leases.values()]);
  await assert.rejects(reserve(f.journal,lease,sessionId,{workerState:warm,movingCapacity}),rejection('generated_speech_worker_not_drained',409));
  assert.equal(f.pool.state.sessions.size,0);
  assert.equal(f.pool.state.reservations.size,0);
  assert.deepEqual([...f.pool.state.leases.values()],initialLease);
  await running(f.journal,lease);
  await f.journal.recordProviderStatus({sessionId,lease,jobId:`job-${sessionId}`,status:'COMPLETED'});
  const reservations=structuredClone([...f.pool.state.reservations.values()]);
  await assert.rejects(f.journal.confirmWorkerDrained({sessionId,lease,movingCapacity,proof:{...proof(sessionId),...warm}}),rejection('generated_speech_worker_not_drained',409));
  assert.equal((await f.journal.listRecoverableSessions()).length,1);
  await f.journal.confirmWorkerDrained({sessionId,lease,movingCapacity,proof:proof(sessionId)});
  assert.deepEqual([...f.pool.state.reservations.values()],reservations,'draining never refunds the reservation');
  assert.deepEqual([...f.pool.state.leases.values()],initialLease,'proof does not renew or replace a lease');
});

test('moving capacity cannot bypass recovery-only, stale fence or expired-missing drain', async () => {
  const f=await fixture(),lease=await f.journal.acquireLease({resource:'stream-session',holderId:'old',ttlMs:1000});
  await initPolicy(f.journal);await running(f.journal,lease);
  f.setTime(f.getTime()+1001);
  const recovery=await f.journal.acquireLease({resource:'stream-session',holderId:'recovery',recoveryOnly:true,ttlMs:GPU_RESERVATION_WINDOW_MS});
  assert.equal(recovery.fence,lease.fence+1);
  let movingCapacity=movingCapacityFixture({endpointId:'endpoint-fixture',now:f.getTime()});
  const before=structuredClone([...f.pool.state.reservations.values()]);
  await assert.rejects(reserve(f.journal,recovery,sessionId2,{movingCapacity}),rejection('generated_speech_recovery_only',409));
  await assert.rejects(reserve(f.journal,lease,sessionId2,{movingCapacity}),rejection('generated_speech_stale_fence',409));
  f.setTime(f.getTime()+GPU_RESERVATION_WINDOW_MS-1001);
  movingCapacity=movingCapacityFixture({endpointId:'endpoint-fixture',now:f.getTime()});
  const args={sessionId,lease:recovery,jobId:`job-${sessionId}`,providerStatus:'not_found',movingCapacity};
  await assert.rejects(f.journal.retireExpiredMissingSession({...args,proof:{...proof(sessionId),workers:1,available:1}}),rejection('generated_speech_worker_not_drained',409));
  assert.equal((await f.journal.listRecoverableSessions()).length,1);
  assert.equal((await f.journal.retireExpiredMissingSession({...args,proof:proof(sessionId)})).terminalReason,'expired_missing_status');
  assert.deepEqual([...f.pool.state.reservations.values()],before);
  assert.equal((await f.journal.listRecoverableSessions()).length,0);
});

test('unknown paid submission is spent; recovery-only lease never admits another paid work or guessed attach', async () => {
  const f = await fixture(), lease = await f.journal.acquireLease({ resource: 'stream-session', holderId: 'old', ttlMs: 1000 }); await initPolicy(f.journal);
  await reserve(f.journal, lease); await f.journal.markSubmissionStarted({ sessionId, lease });
  await f.journal.markSubmissionUncertain({ sessionId, lease });
  f.setTime(f.getTime() + 1001); const restarted = await createSpeechJournal(f.options);
  await assert.rejects(streamLease(restarted), rejection('generated_speech_recovery_required', 409));
  const recovery = await restarted.acquireLease({ resource: 'stream-session', holderId: 'recovery', recoveryOnly: true, ttlMs: 60000 });
  assert.ok(recovery.recoveryOnly); assert.equal((await restarted.listRecoverableSessions())[0].state, 'submission_uncertain');
  await assert.rejects(reserve(restarted, recovery, sessionId2), rejection('generated_speech_recovery_only', 409));
  await assert.rejects(restarted.markSubmissionStarted({ sessionId, lease: recovery }), rejection('generated_speech_recovery_only', 409));
  await assert.rejects(restarted.attachJob({ sessionId, lease: recovery, jobId: 'guessed-job' }), rejection('generated_speech_recovery_only', 409));
  await assert.rejects(restarted.confirmWorkerDrained({ sessionId, lease: recovery, proof: proof(sessionId) }), rejection('generated_speech_terminal_required', 409));
  assert.equal(f.pool.state.sessions.size, 1); assert.equal(f.pool.state.reservations.size, 1);
});

test('cancel is intent only; exact terminal receipt plus matching drained worker is required for admission', async () => {
  const { journal, pool } = await fixture(), lease = await streamLease(journal); await initPolicy(journal); await running(journal, lease);
  const args = { sessionId, lease, jobId: `job-${sessionId}` };
  assert.equal((await journal.attachJob(args)).jobId, args.jobId);
  const cancelled = await journal.requestCancel(args); assert.equal(cancelled.state, 'cancelling'); assert.equal(cancelled.terminalStatus, null);
  await assert.rejects(journal.confirmWorkerDrained({ sessionId, lease, proof: proof(sessionId) }), rejection('generated_speech_terminal_required', 409));
  await assert.rejects(journal.recordProviderStatus({ ...args, jobId: 'other-job', status: 'CANCELLED' }), rejection('generated_speech_job_mismatch', 409));
  await journal.recordProviderStatus({ ...args, status: 'IN_PROGRESS' }); assert.equal((await journal.listRecoverableSessions())[0].state, 'cancelling');
  await journal.recordProviderStatus({ ...args, status: 'CANCELLED' });
  await assert.rejects(reserve(journal, lease, sessionId2), rejection('generated_speech_session_busy', 429));
  await assert.rejects(journal.confirmWorkerDrained({ sessionId, lease, proof: { ...proof(sessionId), workers: 1 } }), rejection('generated_speech_worker_not_drained', 409));
  await assert.rejects(journal.confirmWorkerDrained({ sessionId, lease, proof: proof(sessionId2) }), rejection('generated_speech_worker_not_drained', 409));
  await journal.confirmWorkerDrained({ sessionId, lease, proof: proof(sessionId) });
  await assert.rejects(journal.recordProviderStatus({ ...args, status: 'COMPLETED' }), rejection('generated_speech_terminal_conflict', 409));
  await reserve(journal, lease, sessionId2); assert.equal(pool.state.reservations.size, 2);
  await assert.rejects(reserve(journal, lease, sessionId), rejection('generated_speech_session_already_attempted', 409));
});

test('recovery fences former writer; known expired 404 can retire only after full window and worker drain', async () => {
  const f = await fixture(), lease = await f.journal.acquireLease({ resource: 'stream-session', holderId: 'old', ttlMs: 1000 }); await initPolicy(f.journal); await running(f.journal, lease);
  f.setTime(f.getTime() + 1001);
  const recovery = await f.journal.acquireLease({ resource: 'stream-session', holderId: 'recovery', recoveryOnly: true, ttlMs: GPU_RESERVATION_WINDOW_MS });
  await assert.rejects(f.journal.requestCancel({ sessionId, lease, jobId: `job-${sessionId}` }), rejection('generated_speech_stale_fence', 409));
  const args = { sessionId, lease: recovery, jobId: `job-${sessionId}`, providerStatus: 'not_found', proof: proof(sessionId) };
  await assert.rejects(f.journal.retireExpiredMissingSession(args), rejection('generated_speech_session_not_expired', 409));
  f.setTime(f.getTime() + GPU_RESERVATION_WINDOW_MS - 1001);
  await assert.rejects(f.journal.retireExpiredMissingSession({ ...args, proof: { ...args.proof, busy: 1 } }), rejection('generated_speech_worker_not_drained', 409));
  assert.equal((await f.journal.retireExpiredMissingSession(args)).terminalReason, 'expired_missing_status');
  assert.equal((await f.journal.listRecoverableSessions()).length, 0); assert.equal(f.pool.state.reservations.size, 1);
  await f.journal.releaseLease({ lease: recovery }); const fresh = await streamLease(f.journal); assert.ok(fresh.fence > recovery.fence);
  await reserve(f.journal, fresh, sessionId2);
});

test('stream request completion is a permanent spent key, no fresh ticket or full-file fallback', async () => {
  const { journal, options } = await fixture(), lease = await streamLease(journal), request = await claim(journal, lease, { capability: 'stream' });
  await journal.markRequestSubmissionStarted({ key: request.key, lease, ...fileBudget });
  await assert.rejects(journal.completeRequest({ key: request.key, lease, packageId: 'invalid', packageMetadata: {} }), rejection('invalid_generated_speech_package', 422));
  await journal.completeRequest({ key: request.key, lease }); await journal.releaseLease({ lease });
  const restart = await createSpeechJournal(options); assert.equal((await claim(restart, undefined, { capability: 'stream' })).status, 'alreadyAttempted');
  await assert.rejects(claim(restart, undefined), rejection('generated_speech_request_conflict', 409));
});

test('database failures before work/at lost COMMIT are sanitized, never retried or reseeded', async () => {
  const f = await fixture({ dbClock: true });
  f.pool.failNext('connect'); await assert.rejects(fileLease(f.journal), rejection('generated_speech_journal_unavailable', 503));
  const lease = await fileLease(f.journal);
  f.pool.failNext('insert_request'); await assert.rejects(claim(f.journal, lease), rejection('generated_speech_journal_unavailable', 503));
  assert.equal(f.pool.state.requests.size, 0);
  f.pool.failNext('COMMIT', { afterCommit: true }); await assert.rejects(claim(f.journal, lease), rejection('generated_speech_journal_unavailable', 503));
  assert.equal(f.pool.state.requests.size, 1); assert.equal((await claim(f.journal, lease)).status, 'inFlight');
  assert.equal(f.pool.trace.filter(tag => tag === 'insert_request').length, 2);
  assert.equal(f.pool.counts.connects, f.pool.counts.releases);
  assert.ok(f.pool.trace.includes('clock'));
});

test('query-only connected client wrappers serialize transactions and errors release their queue', async () => {
  const pool = memoryPool(), client = await pool.connect(), wrapped = { query: client.query.bind(client) };
  const journal = await createSpeechJournal({ pool: wrapped, environmentId: 'isolated-qa' });
  const results = await Promise.allSettled([fileLease(journal), fileLease(journal)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  pool.failNext('get_policy'); await assert.rejects(journal.getBudgetPolicy({ currentBudgetMicroUsd: 1000000 }), rejection('generated_speech_journal_unavailable', 503));
  await initPolicy(journal); client.release();
});

test('a failed/uncertain durable submission mark never gives permission to call the provider', async () => {
  const f = await fixture(), lease = await streamLease(f.journal); await initPolicy(f.journal); await reserve(f.journal, lease);
  let providerCalls = 0;
  const caller = async () => {
    await f.journal.markSubmissionStarted({ sessionId, lease });
    providerCalls++; // fixture only: the real caller must use this exact order.
  };
  f.pool.failNext('update_session:state');
  await assert.rejects(caller(), rejection('generated_speech_journal_unavailable', 503));
  assert.equal(providerCalls, 0); assert.equal((await f.journal.listRecoverableSessions())[0].state, 'reserved');
  f.pool.failNext('COMMIT', { afterCommit: true });
  await assert.rejects(caller(), rejection('generated_speech_journal_unavailable', 503));
  assert.equal(providerCalls, 0); assert.equal((await f.journal.listRecoverableSessions())[0].state, 'submission_started');
  await assert.rejects(caller(), rejection('generated_speech_session_already_attempted', 409));
  assert.equal(providerCalls, 0); assert.equal(f.pool.state.reservations.size, 1);
});

test('SQL remains additive five tables/three indexes, bounded scopes and narrow PUBLIC revoke; no reset/refund/provider code', async () => {
  const sql = await readFile(new URL('../ops/neon-studio/002-generation-journals.sql', import.meta.url), 'utf8');
  const source = await readFile(new URL('../services/game/postgres-speech-journal.mjs', import.meta.url), 'utf8');
  assert.equal((sql.match(/^CREATE TABLE /gm) ?? []).length, 5); assert.equal((sql.match(/^CREATE (?:UNIQUE )?INDEX /gm) ?? []).length, 3);
  assert.doesNotMatch(sql, /\b(?:BEGIN|COMMIT|IF NOT EXISTS|DROP|TRUNCATE)\b/);
  assert.match(sql, /PRIMARY KEY \(environment_id, request_key\)/); assert.match(sql, /WHERE released_at_ms IS NULL/); assert.match(sql, /REVOKE ALL ON croupier_studio\.speech_execution_leases/);
  assert.doesNotMatch(source, /\b(?:fetch|process\.env|setInterval|setTimeout)\b|\bDELETE FROM\b|\bUPDATE croupier_studio\.gpu_reservations\b/);
});

test('fullfile reservation requires explicit immutable policy and atomically rolls back with its request', async () => {
  const f=await fixture(), lease=await f.journal.acquireLease({resource:'fullfile-provider',holderId:'runtime-a',ttlMs:720000});
  await assert.rejects(claim(f.journal,lease,{reserveMicroUsd:undefined}),rejection('invalid_generated_speech_budget',422));
  await assert.rejects(claim(f.journal,lease),rejection('generated_speech_fullfile_budget_policy_missing',409));
  assert.equal(f.pool.state.requests.size,0);assert.equal(f.pool.state.fileReservations.size,0);
  await initFilePolicy(f.journal);
  await assert.rejects(f.journal.initializeFullfileBudgetPolicy({...fileBudget,reserveMicroUsd:300000,confirmation:'verified-new-empty-cost-journal'}),rejection('generated_speech_fullfile_budget_policy_conflict',409));
  f.pool.failNext('insert_file_reservation');
  await assert.rejects(claim(f.journal,lease),rejection('generated_speech_journal_unavailable',503));
  assert.equal(f.pool.state.requests.size,0);assert.equal(f.pool.state.fileReservations.size,0);
  const request=await claim(f.journal,lease);
  assert.equal(f.pool.state.fileReservations.size,1);assert.equal(f.pool.state.sessions.size,0);
  f.pool.state.fileReservations.clear();
  await assert.rejects(f.journal.markRequestSubmissionStarted({key:request.key,lease,...fileBudget}),rejection('generated_speech_fullfile_reservation_invalid',409));
  assert.equal([...f.pool.state.requests.values()][0].state,'reserved');
});

test('fullfile and GPU share the same immutable daily cap on every charged UTC day', async () => {
  const f=await fixture({stamp:Date.parse('2026-10-03T23:55:00Z')});
  await initPolicy(f.journal,500000);await f.journal.initializeFullfileBudgetPolicy({...fileBudget,confirmation:'verified-new-empty-cost-journal'});
  const file=await f.journal.acquireLease({resource:'fullfile-provider',holderId:'runtime-a',ttlMs:720000});
  const request=await claim(f.journal,file);
  assert.deepEqual([...f.pool.state.fileReservations.values()].map(r=>r.day),['2026-10-03','2026-10-04']);
  await f.journal.failRequest({key:request.key,lease:file});await f.journal.releaseLease({lease:file});
  const stream=await streamLease(f.journal);await running(f.journal,stream);await finish(f.journal,stream);
  await assert.rejects(reserve(f.journal,stream,sessionId2),rejection('generated_speech_daily_budget_exhausted',429));
  const nextFile=await f.journal.acquireLease({resource:'fullfile-provider',holderId:'runtime-a',ttlMs:720000});
  await assert.rejects(claim(f.journal,nextFile,{requestId:'second-file'}),rejection('generated_speech_daily_budget_exhausted',429));
  assert.equal(f.pool.state.fileReservations.size,2);assert.equal(f.pool.state.reservations.size,2);
  assert.equal(f.pool.state.requests.size,1);
});

test('renewed fullfile fence cannot extend provider admission past the original paid window', async () => {
  const f=await fixture({stamp:Date.parse('2026-10-03T23:48:00Z')}), lease=await fileLease(f.journal), request=await claim(f.journal,lease);
  const reservedAt=f.getTime(), args={key:request.key,lease,...fileBudget};
  await f.journal.markRequestSubmissionStarted(args);
  f.setTime(reservedAt+GPU_RESERVATION_WINDOW_MS-FULLFILE_ADMISSION_REMAINING_MS);
  const renewed=await f.journal.renewLease({lease,ttlMs:720000});
  assert.equal((await f.journal.assertFullfileReservation({...args,lease:renewed})).expiresAt,reservedAt+720000);
  f.setTime(f.getTime()+1);
  await assert.rejects(f.journal.assertFullfileReservation({...args,lease:renewed}),rejection('generated_speech_fullfile_reservation_expired',409));
  f.setTime(Date.parse('2026-10-03T23:59:59Z'));
  await assert.rejects(f.journal.assertFullfileReservation({...args,lease:renewed}),rejection('generated_speech_fullfile_reservation_expired',409));
  assert.equal(f.pool.state.fileReservations.size,2);
  assert.equal([...f.pool.state.fileReservations.values()][0].reserved_at_ms,String(reservedAt));
  await assert.rejects(f.journal.assertFullfileReservation({...args,lease:{...renewed,fence:renewed.fence+1}}),rejection('generated_speech_stale_fence',409));
});

test('fullfile row tampering, tightened cap and old unreserved requests fail before submission', async () => {
  const f=await fixture(),lease=await fileLease(f.journal),request=await claim(f.journal,lease),args={key:request.key,lease,...fileBudget};
  for(const [field,value] of [['day','2026-10-04'],['reserved_micro_usd','1'],['reserved_at_ms','0']]){
    const row=[...f.pool.state.fileReservations.values()][0],prior=row[field];row[field]=value;
    await assert.rejects(f.journal.markRequestSubmissionStarted(args),rejection('generated_speech_fullfile_reservation_invalid',409));[...f.pool.state.fileReservations.values()][0][field]=prior;
  }
  await assert.rejects(f.journal.markRequestSubmissionStarted({...args,currentBudgetMicroUsd:249999}),rejection('generated_speech_daily_budget_exhausted',429));
  assert.equal([...f.pool.state.requests.values()][0].state,'reserved');
  const original=[...f.pool.state.fileReservations.values()].map(value=>structuredClone(value));
  f.pool.state.filePolicies.clear();
  await assert.rejects(f.journal.initializeFullfileBudgetPolicy({...fileBudget,confirmation:'verified-new-empty-cost-journal'}),rejection('generated_speech_journal_invalid',409));
  assert.deepEqual([...f.pool.state.fileReservations.values()],original);
  await assert.rejects(f.journal.markRequestSubmissionStarted(args),rejection('generated_speech_fullfile_budget_policy_missing',409));
});

test('lost fullfile COMMIT and uncertain/cancelled jobs keep reserved cost after restart with no fresh claim', async () => {
  const f=await fixture(),lease=await fileLease(f.journal);
  f.pool.failNext('COMMIT',{afterCommit:true});
  await assert.rejects(claim(f.journal,lease),rejection('generated_speech_journal_unavailable',503));
  assert.equal(f.pool.state.fileReservations.size,1);
  const restart=await createSpeechJournal(f.options),key=speechRequestKey(ownerHash,'request-1');
  assert.equal((await claim(restart,lease)).status,'inFlight');
  await restart.markRequestSubmissionStarted({key,lease,...fileBudget});
  await restart.failRequest({key,lease,safeCode:'generated_speech_cancelled'});
  assert.equal((await claim(restart,lease)).status,'alreadyAttempted');
  assert.equal(f.pool.state.fileReservations.size,1);assert.equal([...f.pool.state.requests.values()][0].state,'submission_uncertain');
  assert.equal(f.pool.trace.filter(t=>t==='insert_file_reservation').length,1);
});

 test('20 USD daily policy retains the environment minimum and 10 USD per-job ceiling', async()=>{
   const {journal,pool}=await fixture();
   await initPolicy(journal,20000000);
   const lease=await streamLease(journal);
   await assert.rejects(reserve(journal,lease,sessionId,{reserveMicroUsd:10000001,currentBudgetMicroUsd:20000000}),rejection('invalid_generated_speech_budget',422));
   await assert.rejects(reserve(journal,lease,sessionId,{currentBudgetMicroUsd:20000001}),rejection('invalid_generated_speech_budget',422));
   await reserve(journal,lease,sessionId,{reserveMicroUsd:500000,currentBudgetMicroUsd:20000000});
   await journal.markSubmissionStarted({sessionId,lease});
   await journal.attachJob({sessionId,lease,jobId:'job-'+sessionId});
   await finish(journal,lease);
   await assert.rejects(reserve(journal,lease,sessionId2,{reserveMicroUsd:500000,currentBudgetMicroUsd:500000}),rejection('generated_speech_daily_budget_exhausted',429));
   await reserve(journal,lease,sessionId2,{reserveMicroUsd:500000,currentBudgetMicroUsd:20000000});
   assert.equal(pool.state.reservations.size,2);
 });


const driftScope=Object.freeze({environment:'isolated-qa',workspaceId:'drift-test'});
const driftToken=Object.freeze({revision:7,operationId:'drift-operation',profileId:'fixture',endpointId:'endpoint-fixture'});
const driftBinding=Object.freeze({schemaVersion:1,sessionId,attemptId:'attempt-fixture',nonce:'1'.repeat(64),
  dealerId:'dragan',workerAvatar:'dragan',releaseSha256:'2'.repeat(64),profileRevision:'3'.repeat(64),
  sourceSetSha256:'4'.repeat(64),avatarSha256:'5'.repeat(64),bankReceiptSha256:'6'.repeat(64)});


const driftReferences=[{id:'12345678-1234-1234-1234-123456789abc',revision:'media-fixture',sha256:'a'.repeat(64),pathname:'croupier/media/drift-fixture.mp4'}];
const driftReservation=lease=>({scope:driftScope,sessionId,endpointId:'endpoint-fixture',lease,binding:driftBinding,driftAdmission:driftToken,
  ownerHash,requestId:'drift-request',fingerprint,projectRevision:'project-fixture',mediaReferences:driftReferences,
  budgetId:'drift-budget',totalBudgetMicroUsd:1000000,reserveMicroUsd:250000,currentBudgetMicroUsd:1000000,workerState:emptyWorker});

async function driftJournalFixture(guard,onRejection,{loseRollbackAck=false}={}) {
  const f=await fixture();
  // Only the new lock boundary is intercepted here. Existing journal SQL and
  // rollback accounting still use the deterministic transactional pool above.
  const pool={async connect(){
    const client=await f.pool.connect();
    return {release:()=>client.release(),query:async(sql,values)=>{
      if(sql==='ROLLBACK'&&loseRollbackAck){await client.query(sql,values);throw Error('private lost rollback acknowledgement');}
      if(sql.includes('/* speech:studio_lock */')){f.pool.trace.push('studio_lock');return{rows:[]};}
      const tag=/\/\* speech:([^*]+) \*\//.exec(sql)?.[1];
      const reference=driftReferences[0];
      const movingRows={moving_ready:[{present:true}],moving_project:[{revision:'project-fixture'}],
        moving_media:[{id:reference.id,revision:reference.revision,record:{sha256:reference.sha256,pathname:reference.pathname,
          classification:{dealerId:'dragan',kind:'idle'},contentType:'video/mp4'}}],
        moving_budget:[{used:'0',count:'0',ceiling:null}],moving_amendments_ready:[{present:false}],insert_moving:[],
        get_moving:[{workspace_id:driftScope.workspaceId,project_revision:'project-fixture',binding:driftBinding,
          media_references:driftReferences,request_key:speechRequestKey(ownerHash,'drift-request')}]};
      if(Object.hasOwn(movingRows,tag)){f.pool.trace.push(tag);return{rows:structuredClone(movingRows[tag])};}
      return client.query(sql,values);
    }};
  }};
  const journal=await createSpeechJournal({...f.options,pool,driftControl:{scope:driftScope,onRejection,guard:async input=>{
    f.pool.trace.push('drift-guard:'+input.phase);assert.equal(typeof input.client.query,'function');
    assert.equal(input.driftAdmission,undefined,'guard receives admission, not an accidental second token name');
    assert.equal(input.admission,driftToken);assert.equal(typeof input.endpointId,'string');assert.equal(input.sessionId,sessionId);
    return guard(input);
  }}});
  return {...f,guarded:journal};
}

test('guarded moving reserve/current/submit/dispatch reject atomically before the speech fence and all cost/request writes',async()=>{
  for(const phase of ['reserve','current','submit','dispatch']){
    const f=await driftJournalFixture(()=>{throw Object.assign(Error('private guard diagnostic'),{code:'drift_not_admitting',statusCode:409});});
    await initPolicy(f.journal);const lease=await streamLease(f.journal);
    if(phase!=='reserve')await reserve(f.journal,lease);
    const before=structuredClone(f.pool.state),start=f.pool.trace.length;
    const input={scope:driftScope,sessionId,endpointId:'endpoint-fixture',lease,binding:driftBinding,driftAdmission:driftToken};
    const operation=phase==='reserve'?()=>f.guarded.reserveMovingSession({...input,ownerHash,requestId:'drift-request',fingerprint,
      projectRevision:'project-fixture',mediaReferences:driftReferences,budgetId:'drift-budget',totalBudgetMicroUsd:1000000,
      reserveMicroUsd:250000,currentBudgetMicroUsd:1000000,workerState:emptyWorker}):
      phase==='submit'?()=>f.guarded.markSubmissionStarted(input):()=>f.guarded.assertMovingSession({...input,submissionPhase:phase==='dispatch'});
    await assert.rejects(operation(),rejection('drift_not_admitting',409));
    const trace=f.pool.trace.slice(start);
    assert.ok(trace.indexOf('studio_lock')<trace.indexOf('drift-guard:'+phase));
    assert.equal(trace.includes('lock'),false,'a rejected drift guard cannot enter the cost/request mutation fence');
    assert.equal(trace.at(-1),'ROLLBACK');assert.deepEqual(f.pool.state,before);
  }
});

test('off drift admission never blocks generic Astrid cleanup or recovery methods',async()=>{
  let calls=0;
  const f=await driftJournalFixture(()=>{calls++;throw Error('drift guard must not run during cleanup');});
  await initPolicy(f.journal);const lease=await streamLease(f.journal);
  await running(f.journal,lease);
  await f.guarded.requestCancel({sessionId,lease,jobId:`job-${sessionId}`});
  await finish(f.guarded,lease);await f.guarded.releaseLease({lease});
  assert.equal(calls,0);assert.equal(f.pool.state.sessions.get(`isolated-qa\0${sessionId}`).released_at_ms,f.getTime());
  assert.equal([...f.pool.state.reservations.values()].reduce((sum,row)=>sum+Number(row.reserved_micro_usd),0),250000);
});

test('invalid optional journal drift guard configuration is rejected before any transaction',async()=>{
  const f=await fixture();
  for(const driftControl of [null,{}, {scope:driftScope,guard:1},{scope:driftScope,guard:()=>{},onRejection:1}]){
    await assert.rejects(createSpeechJournal({...f.options,driftControl}),rejection('invalid_generated_speech_journal_input',422));
  }
  assert.equal(f.pool.trace.length,0);
});


test('guarded moving journal commits in Studio-drift-speech order, checks saved endpoints, and limits dispatch-only state',async()=>{
  const seen=[],f=await driftJournalFixture(input=>{seen.push(input.phase);});
  await initPolicy(f.journal);const lease=await streamLease(f.journal),input=driftReservation(lease);
  const start=f.pool.trace.length;
  await f.guarded.reserveMovingSession(input);
  const trace=f.pool.trace.slice(start);
  assert.ok(trace.indexOf('studio_lock')<trace.indexOf('drift-guard:reserve'));
  assert.ok(trace.indexOf('drift-guard:reserve')<trace.indexOf('lock'));
  assert.ok(trace.indexOf('lock')<trace.indexOf('insert_reservation'));
  await f.guarded.assertMovingSession(input);
  await assert.rejects(f.guarded.markSubmissionStarted({...input,endpointId:'another-endpoint'}),rejection('generated_speech_moving_endpoint_mismatch',409));
  assert.equal(f.pool.state.sessions.get(`isolated-qa\0${sessionId}`).state,'reserved');
  await f.guarded.markSubmissionStarted(input);
  await assert.rejects(f.guarded.assertMovingSession(input),rejection('generated_speech_moving_session_inactive',409));
  await assert.rejects(f.guarded.assertMovingSession({...input,endpointId:'another-endpoint',submissionPhase:true}),rejection('generated_speech_moving_endpoint_mismatch',409));
  await f.guarded.assertMovingSession({...input,submissionPhase:true});
  assert.deepEqual(seen,['reserve','current','submit','submit','current','dispatch','dispatch']);
  assert.equal(f.pool.state.sessions.get(`isolated-qa\0${sessionId}`).state,'submission_started');
  assert.equal([...f.pool.state.reservations.values()].reduce((sum,row)=>sum+Number(row.reserved_micro_usd),0),250000);
});

test('guarded moving methods cannot omit endpoint or token and silently become generic operations',async()=>{
  const f=await driftJournalFixture(()=>assert.fail('invalid arguments must fail before transaction'));
  const input=driftReservation({resource:'stream-session',holderId:'fixture',fence:1});
  for(const method of ['reserveMovingSession','assertMovingSession','markSubmissionStarted']){
    for(const omitted of ['endpointId','driftAdmission']){
      const invalid={...input,[omitted]:undefined};
      await assert.rejects(f.guarded[method](invalid),rejection('invalid_generated_speech_journal_input',422));
    }
  }
  assert.deepEqual(f.pool.trace,[]);assert.equal(f.pool.state.requests.size,0);assert.equal(f.pool.state.reservations.size,0);
});

async function finiteDriftRejection() {
  const controller=createMovingDriftController({profiles:[{id:'base',label:'Bas',endpointId:'endpoint-fixture',releaseDigest:'a'.repeat(64),bankHash:'b'.repeat(64)}],
    capabilities:{connected:true,requireExecutor:true},store:{transact:work=>work(null,1800000000000).value}});
  try {await controller.guardAdmission({phase:'dispatch',sessionId,endpointId:'endpoint-fixture',admission:driftToken});}
  catch(error){return error;}
  assert.fail('initial Off must reject');
}

test('guard diagnostic survives error cloning and emits once only after rollback without secret metadata',async()=>{
  const original=await finiteDriftRejection();let extraReads=0,logged=0,before;
  const metadata={...original.driftDiagnostic,token:'private-token',uuid:'private-uuid',hash:'private-hash',url:'https://private.invalid'};
  Object.defineProperty(metadata,'secret',{get(){extraReads++;throw Error('private');}});
  const thrown=Object.assign(Error('private raw diagnostic'),{code:'drift_not_admitting',statusCode:409,driftDiagnostic:metadata});
  const f=await driftJournalFixture(()=>{throw thrown;},diagnostic=>{
    logged++;assert.equal(f.pool.trace.at(-1),'ROLLBACK');assert.deepEqual(f.pool.state,before);
    assert.deepEqual(diagnostic,original.driftDiagnostic);assert.equal(Object.isFrozen(diagnostic),true);
    f.pool.trace.push('safe-diagnostic');throw Error('logger failed privately');
  });
  await initPolicy(f.journal);const lease=await streamLease(f.journal);before=structuredClone(f.pool.state);
  await assert.rejects(f.guarded.reserveMovingSession(driftReservation(lease)),error=>{
    assert.equal(error.message,'drift_not_admitting');assert.deepEqual(error.driftDiagnostic,original.driftDiagnostic);
    assert.equal(Object.getOwnPropertyDescriptor(error,'driftDiagnostic').enumerable,false);return error.code==='drift_not_admitting';
  });
  assert.equal(logged,1);assert.equal(extraReads,0);assert.deepEqual(f.pool.state,before);
  assert.equal(f.pool.trace.at(-1),'safe-diagnostic');assert.equal(f.pool.trace.includes('insert_moving'),false);
});

test('invalid or inaccessible guard metadata cannot replace rejection or produce a log',async()=>{
  const original=await finiteDriftRejection();let reads=0,logs=0;
  const invalid=Object.assign(Error('private'),{code:'drift_not_admitting',statusCode:409,driftDiagnostic:{...original.driftDiagnostic,reason:'private-token'}});
  const accessor=Object.assign(Error('private'),{code:'drift_not_admitting',statusCode:409});
  Object.defineProperty(accessor,'driftDiagnostic',{get(){reads++;throw Error('private');}});
  const proxy=new Proxy(original,{getOwnPropertyDescriptor(){throw Error('private');}});
  for(const error of [invalid,accessor,proxy]){
    const f=await driftJournalFixture(()=>{throw error;},()=>{logs++;});
    await initPolicy(f.journal);const lease=await streamLease(f.journal);
    await assert.rejects(f.guarded.reserveMovingSession(driftReservation(lease)),value=>value.code==='drift_not_admitting'&&value.driftDiagnostic===undefined);
    assert.equal(f.pool.trace.at(-1),'ROLLBACK');
  }
  assert.equal(reads,0);assert.equal(logs,0);
});

test('an asynchronous diagnostic logger failure cannot change the rolled-back rejection',async()=>{
  const original=await finiteDriftRejection();let logged=0;
  const f=await driftJournalFixture(()=>{throw original;},async()=>{logged++;assert.equal(f.pool.trace.at(-1),'ROLLBACK');throw Error('private');});
  await initPolicy(f.journal);const lease=await streamLease(f.journal);
  await assert.rejects(f.guarded.reserveMovingSession(driftReservation(lease)),rejection('drift_not_admitting',409));
  await new Promise(resolve=>setImmediate(resolve));assert.equal(logged,1);
});

test('missing rollback acknowledgement cannot emit a successful rollback diagnostic',async()=>{
  const original=await finiteDriftRejection();let logs=0;
  const f=await driftJournalFixture(()=>{throw original;},()=>{logs++;},{loseRollbackAck:true});
  await initPolicy(f.journal);const lease=await streamLease(f.journal),before=structuredClone(f.pool.state);
  await assert.rejects(f.guarded.reserveMovingSession(driftReservation(lease)),rejection('drift_not_admitting',409));
  assert.equal(logs,0);assert.deepEqual(f.pool.state,before);assert.equal(f.pool.trace.at(-1),'ROLLBACK');
});

test('guard error code and status are captured once before cloning',async()=>{
  const original=await finiteDriftRejection();let codeReads=0,statusReads=0;
  const error=Object.assign(Error('private raw data'),{driftDiagnostic:original.driftDiagnostic});
  Object.defineProperties(error,{code:{get(){return ++codeReads===1?'drift_not_admitting':'private-token';}},
    statusCode:{get(){return ++statusReads===1?409:999;}}});
  const f=await driftJournalFixture(()=>{throw error;});await initPolicy(f.journal);const lease=await streamLease(f.journal);
  await assert.rejects(f.guarded.reserveMovingSession(driftReservation(lease)),rejection('drift_not_admitting',409));
  assert.equal(codeReads,1);assert.equal(statusReads,1);
});

test('non-string or inaccessible guard codes cannot be coerced into a public drift error',async()=>{
  let coerced=0,logs=0;
  const objectCode={toString(){coerced++;return coerced===1?'drift_not_admitting':'private-token';}};
  const throwingCode=Object.assign(Error('private raw error'),{statusCode:409});
  Object.defineProperty(throwingCode,'code',{get(){throw Error('private token');}});
  const throwingStatus=Object.assign(Error('private raw error'),{code:'drift_not_admitting'});
  Object.defineProperty(throwingStatus,'statusCode',{get(){throw Error('private token');}});
  const proxy=new Proxy(Error('private raw error'),{get(){throw Error('private token');}});
  for(const error of [{code:objectCode,statusCode:409},{code:Symbol('private-token'),statusCode:409},throwingCode,throwingStatus,proxy]){
    const f=await driftJournalFixture(()=>{throw error;},()=>{logs++;});await initPolicy(f.journal);const lease=await streamLease(f.journal);
    await assert.rejects(f.guarded.reserveMovingSession(driftReservation(lease)),rejection('generated_speech_journal_unavailable',503));
    assert.equal(f.pool.trace.at(-1),'ROLLBACK');
  }
  assert.equal(coerced,0);assert.equal(logs,0);
});
