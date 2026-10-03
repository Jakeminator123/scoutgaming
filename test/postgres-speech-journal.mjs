import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { speechMemoryPool as memoryPool } from './fixtures/speech-memory-pool.mjs';
import { createSpeechJournal, GPU_RESERVATION_WINDOW_MS, speechRequestKey } from '../web/postgres-speech-journal.mjs';

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
const fileLease = journal => journal.acquireLease({ resource: 'fullfile-provider', holderId: 'runtime-a', ttlMs: GPU_RESERVATION_WINDOW_MS });
const initPolicy = (journal, dailyBudgetMicroUsd = 1000000) => journal.initializeBudgetPolicy({ dailyBudgetMicroUsd, confirmation: 'verified-new-empty-cost-journal' });
const reserve = (journal, lease, id = sessionId, extra = {}) => journal.reserveSession({ sessionId: id, endpointId: 'endpoint-fixture', lease, reserveMicroUsd: 250000, currentBudgetMicroUsd: 1000000, workerState: emptyWorker, ...extra });
const claim = (journal, lease, extra = {}) => journal.claimRequest({ ownerHash, requestId: 'request-1', fingerprint, capability: 'fullfile', lease, ...extra });
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
  await journal.markRequestSubmissionStarted({ key: request.key, lease });
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
  await journal.markRequestSubmissionStarted({ key: request.key, lease });
  const cases = [{ token: 'private' }, { nested: { apiKey: 'private' } }, { audio: 'data:audio/wav;base64,AAA=' }, { authorization: 'Bearer secret' },
    { video: 'https://blob.invalid/file?X-Amz-Signature=private' }, { audio: '/api/audio?token=private' }, { video: 'wss://worker.invalid/private' },
    { ticket: 'single-use-private' }, { video: 'https://user:private@blob.invalid/file' }, { get forbidden() { throw new Error('must not execute'); } }];
  for (const packageMetadata of cases) await assert.rejects(journal.completeRequest({ key: request.key, lease, packageId: 'generated-fixture', packageMetadata }), rejection('invalid_generated_speech_package', 422));
  assert.equal([...pool.state.requests.values()][0].state, 'submission_started');
  await assert.rejects(journal.completeRequest({ key: request.key, lease }), rejection('invalid_generated_speech_package', 422));
});

test('uncertain and failed request keys cannot retry after restart; expiry cannot forgive paid full-file work', async () => {
  const f = await fixture(), lease = await fileLease(f.journal), request = await claim(f.journal, lease);
  await f.journal.markRequestSubmissionStarted({ key: request.key, lease });
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
  const request = await claim(f.journal, fresh); await f.journal.markRequestSubmissionStarted({ key: request.key, lease: fresh });
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
  const occupied = await fixture(), file = await fileLease(occupied.journal); await claim(occupied.journal, file);
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
  await journal.markRequestSubmissionStarted({ key: request.key, lease });
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
  const source = await readFile(new URL('../web/postgres-speech-journal.mjs', import.meta.url), 'utf8');
  assert.equal((sql.match(/^CREATE TABLE /gm) ?? []).length, 5); assert.equal((sql.match(/^CREATE (?:UNIQUE )?INDEX /gm) ?? []).length, 3);
  assert.doesNotMatch(sql, /\b(?:BEGIN|COMMIT|IF NOT EXISTS|DROP|TRUNCATE)\b/);
  assert.match(sql, /PRIMARY KEY \(environment_id, request_key\)/); assert.match(sql, /WHERE released_at_ms IS NULL/); assert.match(sql, /REVOKE ALL ON croupier_studio\.speech_execution_leases/);
  assert.doesNotMatch(source, /\b(?:fetch|process\.env|setInterval|setTimeout)\b|\bDELETE FROM\b|\bUPDATE croupier_studio\.gpu_reservations\b/);
});
