import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createStudioRepository } from '../web/storage/studio-repository.mjs';
import { createSpeechJournal } from '../web/postgres-speech-journal.mjs';
import { planStudioMigrations, applyStudioMigrations } from '../ops/neon-studio/migrations.mjs';
import {RETAINED_BANK_VARIANTS,createRetainedStudioMedia,canonicalStudioJson} from '../web/storage/studio-contract.mjs';

const suffix = () => randomBytes(8).toString('hex');
const hasCode = code => error => error?.code === code;

// Real SQL tests may only write to an explicitly isolated localhost fixture.
// This intentionally does not accept the shared-server Neon game QA config.
export async function runStudioPostgresChecks({ pool, restart } = {}) {
  assert.equal(typeof pool?.query, 'function');
  const target = (await pool.query("SELECT host(inet_server_addr()) AS address, current_user AS role, current_database() AS database, current_setting('listen_addresses') AS listeners")).rows[0];
  assert.deepEqual(target, { address: '127.0.0.1', role: 'studio_qa', database: 'postgres', listeners: '127.0.0.1' });
  const checks = [];
  async function check(name, run) { await run(); checks.push(name); }

  await check('atomic versioned migration and repeat plan', async () => {
    const initial = await planStudioMigrations({ pool });
    assert.equal(initial.toApply.length, 8, 'fixture must start without an existing Studio schema');
    assert.deepEqual(initial.optionalPending, []);
    await assert.rejects(applyStudioMigrations({ pool, expectedTarget: 'wrong-target', confirm: true }));
    await applyStudioMigrations({ pool, expectedTarget: initial.target, confirm: true });
    const applied = await planStudioMigrations({ pool });
    assert.equal(applied.toApply.length, 0); assert.equal(applied.optionalPending.length, 0);
    await applyStudioMigrations({ pool, expectedTarget: applied.target, confirm: true });
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM croupier_studio.storage_migrations')).rows[0].count, 8);
  });

  const scope = { environment: `qa_${suffix()}`, workspaceId: 'integration' };
  let repository = createStudioRepository({ pool, scope });
  let saved;
  await check('missing document never implicitly seeds', async () => {
    assert.equal(await repository.readDocument('administration'), null);
    await assert.rejects(repository.saveDocument('administration', { value: { rooms: [] }, expectedRevision: 'missing', actor: 'qa' }), hasCode('studio_document_missing'));
    assert.equal(await repository.readDocument('administration'), null);
  });
  await check('initialize preserves revision and cannot overwrite', async () => {
    saved = await repository.initializeDocument('administration', { value: { rooms: [] }, revision: 'qa-original', actor: 'qa' });
    assert.equal(saved.revision, 'qa-original');
    await assert.rejects(repository.initializeDocument('administration', { value: { rooms: ['overwrite'] }, actor: 'qa' }), hasCode('studio_conflict'));
    assert.deepEqual((await repository.readDocument('administration')).value, { rooms: [] });
  });
  await check('two writers accept exactly one CAS and one history entry', async () => {
    const results = await Promise.allSettled(['a', 'b'].map(label => repository.saveDocument('administration', {
      value: { rooms: [label] }, expectedRevision: saved.revision, actor: `qa-${label}`,
    })));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected' && result.reason.code === 'studio_conflict').length, 1);
    saved = await repository.readDocument('administration');
    const history = await repository.listDocumentHistory('administration');
    assert.equal(history.length, 1);
    assert.equal(history[0].revision, 'qa-original');
    assert.equal(history[0].replacedBy, saved.revision);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM croupier_studio.audit_events WHERE environment_id=$1', [scope.environment])).rows[0].count, 2);
  });
  await check('nested transaction rollback preserves value history and audit', async () => {
    await assert.rejects(repository.transaction(async inner => {
      await inner.saveDocument('administration', { value: { rooms: ['rolled-back'] }, expectedRevision: saved.revision, actor: 'qa' });
      throw Error('intentional fixture rollback');
    }));
    assert.deepEqual(await repository.readDocument('administration'), saved);
    assert.equal((await repository.listDocumentHistory('administration')).length, 1);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM croupier_studio.audit_events WHERE environment_id=$1', [scope.environment])).rows[0].count, 2);
  });
  await check('caught nested failure poisons the transaction', async () => {
    await assert.rejects(repository.transaction(async inner => {
      await inner.saveDocument('administration', { value: { rooms: ['not-committed'] }, expectedRevision: saved.revision, actor: 'qa' });
      try { await inner.saveDocument('administration', { value: { rooms: [] }, expectedRevision: 'stale', actor: 'qa' }); } catch { /* Outer transaction must still roll back. */ }
    }), hasCode('studio_conflict'));
    assert.deepEqual(await repository.readDocument('administration'), saved);
  });
  await check('server scopes cannot read or write each other', async () => {
    const other = createStudioRepository({ pool, scope: { ...scope, workspaceId: 'separate' } });
    assert.equal(await other.readDocument('administration'), null);
    await assert.rejects(repository.transaction(() => other.readDocument('administration')), hasCode('studio_scope_mismatch'));
    assert.deepEqual(await repository.readDocument('administration'), saved);
  });
  await check('explicit document import preserves revision and replays without duplication', async () => {
    const source = await repository.exportSnapshot();
    const importScope = { ...scope, workspaceId: 'explicit-import' };
    const targetRepository = createStudioRepository({ pool, scope: importScope });
    const snapshot = { ...source, scope: importScope };
    await assert.rejects(targetRepository.importSnapshot(snapshot, { actor: 'qa' }), hasCode('studio_import_requires_empty_target'));
    assert.deepEqual(await targetRepository.importSnapshot(snapshot, { actor: 'qa', expectedTargetEmpty: true }), { imported: 1, replayed: false });
    assert.deepEqual(await targetRepository.readDocument('administration'), saved);
    assert.deepEqual(await targetRepository.importSnapshot(snapshot, { actor: 'qa', expectedTargetEmpty: true }), { imported: 0, replayed: true });
    const corrupted = structuredClone(snapshot); corrupted.documents[0].checksum = '0'.repeat(64);
    await assert.rejects(targetRepository.importSnapshot(corrupted, { actor: 'qa', expectedTargetEmpty: true }), hasCode('studio_invalid_snapshot'));
  });

  let retained;
  await check('six exact retained identities persist in scoped SQL with immutable classification and idempotent import',async()=>{
    for(const original of RETAINED_BANK_VARIANTS){
      const record=createRetainedStudioMedia(original.id),first=await repository.registerMedia(record,{actor:'qa-explicit-retained-import'});
      assert.deepEqual(await repository.registerMedia(record,{actor:'qa-explicit-retained-import'}),{media:first.media,duplicate:true});
      await assert.rejects(repository.classifyMedia(record.id,{sha256:record.sha256,expectedRevision:first.media.revision,metadata:record.classification,actor:'qa'}),hasCode('studio_retained_media_immutable'));
    }
    retained=await repository.listMedia();assert.equal(retained.length,6);
    assert.equal((await createStudioRepository({pool,scope:{...scope,workspaceId:'no-retained-sources'}}).listMedia()).length,0);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM croupier_studio.audit_events WHERE environment_id=$1 AND action=$2',[scope.environment,'register_media'])).rows[0].count,6);
  });
  await check('corrupted retained tuple in SQL fails closed and never becomes a review upload',async()=>{
    const record=createRetainedStudioMedia(RETAINED_BANK_VARIANTS[0].id);
    await pool.query("UPDATE croupier_studio.media_records SET record=jsonb_set(record,'{retainedBank,familyId}','\"astrid/deal.player.left/box1\"'::jsonb) WHERE environment_id=$1 AND workspace_id=$2 AND id=$3",[scope.environment,scope.workspaceId,record.id]);
    try{await assert.rejects(repository.getMedia(record.id),hasCode('studio_corrupt_media'));await assert.rejects(repository.listMedia(),hasCode('studio_corrupt_media'));}
    finally{await pool.query('UPDATE croupier_studio.media_records SET record=$4::jsonb WHERE environment_id=$1 AND workspace_id=$2 AND id=$3',[scope.environment,scope.workspaceId,record.id,canonicalStudioJson(record)]);}
    assert.deepEqual(await repository.listMedia(),retained);
  });
  let clock = Date.UTC(2026, 9, 3, 23, 58);
  const environmentId = `qa_${suffix()}`;
  let journal = await createSpeechJournal({ pool, environmentId, now: () => clock });
  let lease, sessionId = suffix() + suffix(), request;
  const ownerHash = 'a'.repeat(64), fingerprint = 'b'.repeat(64);
  const requestId = 'same-request';
  await check('budget bootstrap is explicit and cannot increase saved budget', async () => {
    await assert.rejects(journal.getBudgetPolicy({ currentBudgetMicroUsd: 300 }), hasCode('generated_speech_budget_policy_missing'));
    await assert.rejects(journal.initializeBudgetPolicy({ dailyBudgetMicroUsd: 300 }), hasCode('generated_speech_budget_bootstrap_required'));
    await journal.initializeBudgetPolicy({ dailyBudgetMicroUsd: 300, confirmation: 'verified-new-empty-cost-journal' });
    assert.deepEqual(await journal.getBudgetPolicy({ currentBudgetMicroUsd: 500 }), { dailyBudgetMicroUsd: 300, savedBudgetMicroUsd: 300 });
    assert.deepEqual(await journal.getBudgetPolicy({ currentBudgetMicroUsd: 100 }), { dailyBudgetMicroUsd: 100, savedBudgetMicroUsd: 300 });
  });
  await check('request identity is shared across stream and full-file paths', async () => {
    lease = await journal.acquireLease({ resource: 'stream-session', holderId: 'qa-owner', ttlMs: 60000 });
    request = await journal.claimRequest({ ownerHash, requestId, fingerprint, capability: 'stream', lease });
    assert.equal(request.status, 'new');
    assert.equal((await journal.claimRequest({ ownerHash, requestId, fingerprint, capability: 'stream', lease })).status, 'inFlight');
    await assert.rejects(journal.claimRequest({ ownerHash, requestId, fingerprint, capability: 'fullfile', lease }), hasCode('generated_speech_request_conflict'));
    await assert.rejects(journal.claimRequest({ ownerHash, requestId, fingerprint: 'c'.repeat(64), capability: 'stream', lease }), hasCode('generated_speech_request_conflict'));
  });
  await check('GPU reservation is atomic and charged in both UTC days', async () => {
    const reserve = await journal.reserveSession({ sessionId, endpointId: 'fixture-endpoint', lease, reserveMicroUsd: 200,
      currentBudgetMicroUsd: 500, workerState: { workers: 0, busy: 0, available: 0 } });
    assert.deepEqual(reserve.days, ['2026-10-03', '2026-10-04']);
    const rows = (await pool.query('SELECT day::text AS day,reserved_micro_usd::int AS cost FROM croupier_studio.gpu_reservations WHERE environment_id=$1 ORDER BY day', [environmentId])).rows;
    assert.deepEqual(rows, [{ day: '2026-10-03', cost: 200 }, { day: '2026-10-04', cost: 200 }]);
    await assert.rejects(journal.reserveSession({ sessionId, endpointId: 'fixture-endpoint', lease, reserveMicroUsd: 200,
      currentBudgetMicroUsd: 500, workerState: { workers: 0, busy: 0, available: 0 } }), hasCode('generated_speech_session_already_attempted'));
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM croupier_studio.gpu_reservations WHERE environment_id=$1', [environmentId])).rows[0].count, 2);
  });
  await check('paid submit fence and cancel intent never release a running worker', async () => {
    await journal.markRequestSubmissionStarted({ key: request.key, lease });
    await journal.markSubmissionStarted({ sessionId, lease });
    await assert.rejects(journal.markSubmissionStarted({ sessionId, lease }), hasCode('generated_speech_session_already_attempted'));
    await journal.attachJob({ sessionId, lease, jobId: 'fixture-job' });
    const cancelled = await journal.requestCancel({ sessionId, lease, jobId: 'fixture-job' });
    assert.equal(cancelled.state, 'cancelling'); assert.equal(cancelled.releasedAt, null);
    await assert.rejects(journal.confirmWorkerDrained({ sessionId, lease, proof: { workerId: `croupier-${sessionId}`, workers: 0, busy: 0, available: 0 } }), hasCode('generated_speech_terminal_required'));
    await assert.rejects(journal.releaseLease({ lease }), hasCode('generated_speech_recovery_required'));
  });
  if (restart) await check('actual database restart preserves CAS ledger and unresolved GPU state', async () => {
    pool = await restart();
    repository = createStudioRepository({ pool, scope });
    journal = await createSpeechJournal({ pool, environmentId, now: () => clock });
    assert.deepEqual(await repository.readDocument('administration'), saved);
    assert.deepEqual(await repository.listMedia(),retained);
    assert.equal((await planStudioMigrations({ pool })).toApply.length, 0);
    assert.equal((await journal.listRecoverableSessions()).length, 1);
    assert.equal((await journal.claimRequest({ ownerHash, requestId, fingerprint, capability: 'stream', lease })).status, 'inFlight');
  });
  await check('expired lease only admits recovery and fences the old owner', async () => {
    clock += 60001;
    await assert.rejects(journal.acquireLease({ resource: 'stream-session', holderId: 'qa-new' }), hasCode('generated_speech_recovery_required'));
    const oldLease = lease;
    lease = await journal.acquireLease({ resource: 'stream-session', holderId: 'qa-recovery', recoveryOnly: true });
    assert.equal(lease.recoveryOnly, true); assert.ok(lease.fence > oldLease.fence);
    await assert.rejects(journal.recordProviderStatus({ sessionId, lease: oldLease, jobId: 'fixture-job', status: 'CANCELLED' }), hasCode('generated_speech_stale_fence'));
    await assert.rejects(journal.markSubmissionStarted({ sessionId, lease }), hasCode('generated_speech_recovery_only'));
    await journal.recordProviderStatus({ sessionId, lease, jobId: 'fixture-job', status: 'CANCELLED' });
    await assert.rejects(journal.confirmWorkerDrained({ sessionId, lease, proof: { workerId: 'wrong-worker', workers: 0, busy: 0, available: 0 } }), hasCode('generated_speech_worker_not_drained'));
    await journal.confirmWorkerDrained({ sessionId, lease, proof: { workerId: `croupier-${sessionId}`, workers: 0, busy: 0, available: 0 } });
    assert.equal((await journal.listRecoverableSessions()).length, 0);
    await journal.releaseLease({ lease });
  });
  await check('restart and cancellation cannot refund or increase prior cost', async () => {
    lease = await journal.acquireLease({ resource: 'stream-session', holderId: 'qa-final' });
    await assert.rejects(journal.reserveSession({ sessionId: suffix() + suffix(), endpointId: 'fixture-endpoint', lease, reserveMicroUsd: 101,
      currentBudgetMicroUsd: 500, workerState: { workers: 0, busy: 0, available: 0 } }), hasCode('generated_speech_daily_budget_exhausted'));
    assert.equal((await pool.query('SELECT sum(reserved_micro_usd)::int AS cost FROM croupier_studio.gpu_reservations WHERE environment_id=$1', [environmentId])).rows[0].cost, 400);
    assert.equal((await journal.getBudgetPolicy({ currentBudgetMicroUsd: 500 })).savedBudgetMicroUsd, 300);
  });
  return { checks, pool };
}

const configuration = process.env.CROUPIER_POSTGRES_QA_CONFIG;
test('real isolated PostgreSQL verifies Studio CAS, migrations and speech journals', { skip: !configuration }, async () => {
  const config = JSON.parse(await readFile(configuration, 'utf8'));
  const url = new URL(config.databaseUrl);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.username, 'studio_qa');
  assert.equal(url.password, ''); assert.equal(url.pathname, '/postgres');
  const { Pool } = createRequire(new URL('../web/package.json', import.meta.url))('pg');
  const pool = new Pool({ connectionString: config.databaseUrl, connectionTimeoutMillis: 5000, query_timeout: 10000 });
  try { await runStudioPostgresChecks({ pool }); } finally { await pool.end(); }
});
