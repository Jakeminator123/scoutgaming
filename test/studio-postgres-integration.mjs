import { runMovingBudgetSqlChecks,runMovingBudgetMigrationSqlChecks,runMovingDriftMigrationAfterBudgetSqlChecks } from './fixtures/moving-budget-sql-checks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash,randomBytes,randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createStudioRepository } from '../packages/studio-registry/server/document-repository.mjs';
import { createSpeechJournal } from '../services/game/postgres-speech-journal.mjs';
import { summarizeMovingWorkerHealth } from '../services/game/moving-speech-runpod.mjs';
import { loadStudioMigrations, planStudioMigrations, applyStudioMigrations } from '../ops/neon-studio/migrations.mjs';
import {RETAINED_BANK_VARIANTS,createRetainedStudioMedia,canonicalStudioJson} from '../packages/studio-registry/server/document-contract.mjs';
import {runRuntimeRegistrySqlChecks} from './fixtures/studio-runtime-sql-checks.mjs';

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
    const migrations=await loadStudioMigrations();assert.ok(migrations.some(row=>row.version==='012'));
    const initial = await planStudioMigrations({ pool });
    assert.equal(initial.toApply.length, migrations.filter(row=>!row.deploymentOptional).length, 'fixture must start without an existing Studio schema');
    assert.deepEqual(initial.optionalPending.map(row=>row.version), migrations.filter(row=>row.deploymentOptional).map(row=>row.version));
    await runMovingBudgetMigrationSqlChecks({pool});
    assert.deepEqual(await planStudioMigrations({pool}),initial,'historical014 to015 to017 SQL probe rolls back its entire fixture');
    await assert.rejects(applyStudioMigrations({ pool, expectedTarget: 'wrong-target', confirm: true }));
    if (typeof restart === 'function') {
      const sequential = await runMovingDriftMigrationAfterBudgetSqlChecks({pool,restart}); pool = sequential.pool;
      checks.push(...sequential.checks);
    } else {
      // The explicit existing QA connection has no cluster lifecycle control.
      // Retain its ordinary migration proof without claiming a restart check.
      await applyStudioMigrations({ pool, expectedTarget: initial.target, confirm: true });
    }
    const applied = await planStudioMigrations({ pool });
    assert.equal(applied.toApply.length, 0); assert.equal(applied.optionalPending.length, 0);
    await applyStudioMigrations({ pool, expectedTarget: applied.target, confirm: true });
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM croupier_studio.storage_migrations')).rows[0].count, migrations.length);
  });
  const runtimeRegistry=await runRuntimeRegistrySqlChecks({pool});checks.push(...runtimeRegistry.checks);

  await check('013 moving admission shares deletion fence, durable exact references and a nonrefundable total cap',async()=>{
    const scope={environment:`qa_moving_${suffix()}`,workspaceId:'integration'},repo=createStudioRepository({pool,scope});
    const journal=await createSpeechJournal({pool,environmentId:scope.environment});
    const id=randomUUID(),sha256='3'.repeat(64),revision=`media-${randomUUID()}`,projectRevision=`studio-${randomUUID()}`;
    const record={id,sha256,size:32,contentType:'video/mp4',pathname:`croupier/media/dealers/dragan/review/uploads/${id}/${sha256}.mp4`,
      classification:{dealerId:'dragan',eventId:'idle.ready',kind:'idle',role:'alternative',situation:'VILA',label:'Fixture',notes:''}};
    await pool.query("INSERT INTO croupier_studio.documents (environment_id,workspace_id,kind,revision,value) VALUES ($1,$2,'project',$3,jsonb_build_object('revision',$3::text))",[scope.environment,scope.workspaceId,projectRevision]);
    await pool.query('INSERT INTO croupier_studio.media_records(environment_id,workspace_id,id,revision,record) VALUES($1,$2,$3,$4,$5::jsonb)',[scope.environment,scope.workspaceId,id,revision,JSON.stringify(record)]);
    await journal.initializeBudgetPolicy({dailyBudgetMicroUsd:20000000,confirmation:'verified-new-empty-cost-journal'});
    let lease=await journal.acquireLease({resource:'stream-session',holderId:'moving-qa'});
    const binding={schemaVersion:1,releaseSha256:'4'.repeat(64),dealerId:'dragan',workerAvatar:'dragan',profileRevision:'5'.repeat(64),
      sourceSetSha256:'6'.repeat(64),avatarSha256:'7'.repeat(64),bankReceiptSha256:'8'.repeat(64),sessionId:suffix()+suffix(),attemptId:'attempt-1',nonce:'9'.repeat(64)};
    const input={scope,ownerHash:'a'.repeat(64),requestId:'moving-1',fingerprint:'b'.repeat(64),binding,
      mediaReferences:[{id,sha256,pathname:record.pathname,revision}],projectRevision,budgetId:'one-human-authorized-run',
      totalBudgetMicroUsd:400000,sessionId:binding.sessionId,endpointId:'fixture-endpoint',lease,
      reserveMicroUsd:250000,currentBudgetMicroUsd:2000000,workerState:{workers:0,busy:0,available:0}};
    // Hold the real Studio writer fence until pending deletion commits. The
    // paid admission must wait, then reject, leaving no request/cost/session.
    const writer=await pool.connect();let admission;
    try {
      await writer.query('BEGIN');
      const digest=createHash('sha256').update(`croupier-studio\0${canonicalStudioJson(scope)}`).digest();
      await writer.query('SELECT pg_advisory_xact_lock($1::integer,$2::integer)',[digest.readInt32BE(0),digest.readInt32BE(4)]);
      // Prime the transaction's activity snapshot before admission starts. A
      // pg_stat_activity poll would keep this stale view until COMMIT; observe
      // the lock manager directly, matching this exact writer fence instead.
      await writer.query('SELECT count(*) FROM pg_stat_activity');
      admission=journal.reserveMovingSession(input);admission.catch(()=>{});
      let waiting;
      for(let attempt=0;attempt<40&&!waiting;attempt++){
        waiting=(await writer.query(`SELECT candidate.pid,
          EXISTS(SELECT 1 FROM pg_locks held WHERE held.pid=candidate.pid
            AND held.locktype='advisory' AND held.granted) AS holds_advisory
          FROM pg_locks candidate WHERE candidate.locktype='advisory'
            AND candidate.database=(SELECT oid FROM pg_database WHERE datname=current_database())
            AND candidate.classid=$1::oid AND candidate.objid=$2::oid AND candidate.objsubid=2
            AND NOT candidate.granted AND pg_backend_pid()=ANY(pg_blocking_pids(candidate.pid))`,
          [digest.readUInt32BE(0),digest.readUInt32BE(4)])).rows[0];
        if(!waiting)await new Promise(resolve=>setTimeout(resolve,25));
      }
      assert.equal(Number.isInteger(waiting?.pid),true,'admission must acquire the existing Studio advisory lock before its speech lock');
      assert.equal(waiting.holds_advisory,false,'admission must not hold the speech fence while waiting for the Studio fence');
      await writer.query("UPDATE croupier_studio.media_records SET record=jsonb_set(record,'{deletion}','{\"state\":\"pending\"}'::jsonb) WHERE environment_id=$1 AND workspace_id=$2 AND id=$3",[scope.environment,scope.workspaceId,id]);
      await writer.query('COMMIT');
    } finally {await writer.query('ROLLBACK');writer.release();}
    await assert.rejects(admission,hasCode('generated_speech_moving_media_unavailable'));
    const counts=(await pool.query('SELECT (SELECT count(*) FROM croupier_studio.gpu_sessions WHERE environment_id=$1)::int AS sessions,(SELECT count(*) FROM croupier_studio.speech_requests WHERE environment_id=$1)::int AS requests',[scope.environment])).rows[0];
    assert.deepEqual(counts,{sessions:0,requests:0});
    await pool.query("UPDATE croupier_studio.media_records SET record=record-'deletion' WHERE environment_id=$1 AND workspace_id=$2 AND id=$3",[scope.environment,scope.workspaceId,id]);
    const health=(jobs={})=>summarizeMovingWorkerHealth({
      workers:{idle:1,ready:1,running:0,initializing:0,throttled:0,unhealthy:0},
      jobs:{completed:1,failed:0,inQueue:0,inProgress:0,retried:0,...jobs}});
    for(const jobs of [{inQueue:1},{inProgress:1}]){
      await assert.rejects(journal.reserveMovingSession({...input,workerState:health(jobs)}),hasCode('generated_speech_worker_not_drained'));
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM croupier_studio.gpu_sessions WHERE environment_id=$1',[scope.environment])).rows[0].count,0);
    }
    const saved=await journal.reserveMovingSession({...input,workerState:health()});
    const restarted=await createSpeechJournal({pool,environmentId:scope.environment});
    await assert.rejects(restarted.reserveMovingSession(input),hasCode('generated_speech_request_already_attempted'));
    const protectedMedia=await repo.inspectMediaDeletion(record);
    assert.deepEqual(protectedMedia.references.map(row=>row.source),['moving-speech']);assert.equal(protectedMedia.coverage.complete,true);
    const unrelated=await repo.inspectMediaDeletion({id:randomUUID(),pathname:'croupier/media/unrelated.mp4'});
    assert.deepEqual(unrelated.references,[]);assert.equal(unrelated.coverage.complete,true);
    await journal.markRequestSubmissionStarted({key:saved.key,lease});
    await journal.markSubmissionStarted({sessionId:binding.sessionId,lease});
    await journal.markSubmissionUncertain({sessionId:binding.sessionId,lease});
    assert.equal((await repo.inspectMediaDeletion(record)).references.length,1);
    await assert.rejects(journal.confirmWorkerDrained({sessionId:binding.sessionId,lease,proof:{workerId:saved.workerId,workers:0,busy:0,available:0}}),hasCode('generated_speech_terminal_required'));
    // Separate known accepted attempt for terminal/drain and permanent budget.
    // This isolated SQL fixture supplies the provider receipt; never production.
    await pool.query("UPDATE croupier_studio.gpu_sessions SET state='submission_started' WHERE environment_id=$1 AND session_id=$2",[scope.environment,binding.sessionId]);
    await journal.attachJob({sessionId:binding.sessionId,lease,jobId:'moving-fixture-job'});
    await journal.recordProviderStatus({sessionId:binding.sessionId,lease,jobId:'moving-fixture-job',status:'COMPLETED'});
    assert.equal((await repo.inspectMediaDeletion(record)).references.length,1,'terminal status alone is not drain');
    for(const jobs of [{inQueue:1},{inProgress:1}]){
      await assert.rejects(journal.confirmWorkerDrained({sessionId:binding.sessionId,lease,proof:{workerId:saved.workerId,...health(jobs)}}),hasCode('generated_speech_worker_not_drained'));
    }
    await journal.confirmWorkerDrained({sessionId:binding.sessionId,lease,proof:{workerId:saved.workerId,...health()}});
    await journal.completeRequest({key:saved.key,lease});await journal.releaseLease({lease});
    assert.equal((await repo.inspectMediaDeletion(record)).references.length,0);
    lease=await restarted.acquireLease({resource:'stream-session',holderId:'moving-qa-next'});
    const nextSession=suffix()+suffix();
    await assert.rejects(restarted.reserveMovingSession({...input,lease,requestId:'moving-2',sessionId:nextSession,
      binding:{...binding,sessionId:nextSession},totalBudgetMicroUsd:1000000}),hasCode('generated_speech_total_budget_exhausted'));
    assert.equal((await pool.query('SELECT sum(reserved_micro_usd)::int AS used FROM croupier_studio.moving_speech_bindings WHERE environment_id=$1',[scope.environment])).rows[0].used,250000);
    await journal.releaseLease({lease});
    await runMovingBudgetSqlChecks({pool,input,journal});
  });

  await check('media deletion finds exact journal owners and fails closed on unattributed speech activity', async () => {
    const mediaScope={environment:`qa_media_${suffix()}`,workspaceId:'integration'};
    const repo=createStudioRepository({pool,scope:mediaScope}),id=randomUUID(),replyId=randomUUID(),sha256='d'.repeat(64);
    const record={id,sha256,pathname:`croupier/media/dealers/paow/review/uploads/${id}/${sha256}.mp4`};
    const ownersScope={environment:`qa_owners_${suffix()}`,workspaceId:'another-workspace'};
    await pool.query('INSERT INTO croupier_studio.forge_dealers (environment_id,workspace_id,dealer_id,revision,profile,actor_id) VALUES ($1,$2,$3,1,$4::jsonb,$5)',
      [ownersScope.environment,ownersScope.workspaceId,'paow',JSON.stringify({reference:{pathname:record.pathname}}),'qa']);
    for(const [status,request] of [['submit_unknown',{referenceMediaId:id}],['failed',{referenceMediaId:id}],['prepared',{notes:`historic ${id}`,sha256}]]){
      await pool.query(`INSERT INTO croupier_studio.forge_jobs
        (environment_id,workspace_id,job_id,dealer_id,slot_id,kind,status,provider,request,actor_id,created_at_ms,updated_at_ms)
        VALUES ($1,$2,$3,'paow','idle.ready/','clip',$4,'runway',$5::jsonb,'qa',0,0)`,
      [ownersScope.environment,ownersScope.workspaceId,randomUUID(),status,JSON.stringify(request)]);
    }
    await pool.query('INSERT INTO croupier_studio.speech_reply_records (environment_id,workspace_id,dealer_id,id,revision,value) VALUES ($1,$2,$3,$4,1,$5::jsonb)',
      [ownersScope.environment,ownersScope.workspaceId,'paow',replyId,JSON.stringify({schemaVersion:1,dealerId:'paow',id:replyId,revision:1,video:{pathname:record.pathname}})]);
    await pool.query(`INSERT INTO croupier_studio.speech_execution_leases (environment_id,resource,holder_id,fence,expires_at_ms)
      VALUES ($1,'fullfile-provider','qa',1,0)`,[mediaScope.environment]);
    await pool.query(`INSERT INTO croupier_studio.speech_requests
      (environment_id,request_key,owner_hash,request_id,fingerprint,capability,state,lease_resource,holder_id,lease_fence,package_id,package_metadata,created_at_ms,updated_at_ms)
      VALUES ($1,$2,$2,'media-owner',$2,'fullfile','completed','fullfile-provider','qa',1,'saved-package',$3::jsonb,0,0)`,
      [mediaScope.environment,'e'.repeat(64),JSON.stringify({mediaId:id})]);
    const found=await repo.inspectMediaDeletion(record);
    assert.deepEqual(found.references.map(row=>row.source).sort(),['forge-job','forge-profile','speech-package','speech-reply']);
    assert.equal(found.coverage.complete,true);
    await pool.query("UPDATE croupier_studio.speech_requests SET state='submission_uncertain',package_id=NULL,package_metadata=NULL WHERE environment_id=$1",[mediaScope.environment]);
    assert.deepEqual((await repo.inspectMediaDeletion(record)).coverage.unresolved,['unresolved_fullfile']);
    await pool.query("UPDATE croupier_studio.speech_requests SET state='failed' WHERE environment_id=$1",[mediaScope.environment]);
    await pool.query('UPDATE croupier_studio.speech_execution_leases SET expires_at_ms=(extract(epoch FROM clock_timestamp())*1000)::bigint+60000 WHERE environment_id=$1',[mediaScope.environment]);
    assert.deepEqual((await repo.inspectMediaDeletion(record)).coverage.unresolved,['live_lease']);
    await pool.query('UPDATE croupier_studio.speech_execution_leases SET expires_at_ms=0 WHERE environment_id=$1',[mediaScope.environment]);
    // Permanently spent stream keys do not assert an active GPU/media owner.
    await pool.query("UPDATE croupier_studio.speech_requests SET capability='stream',state='submission_uncertain' WHERE environment_id=$1",[mediaScope.environment]);
    assert.equal((await repo.inspectMediaDeletion(record)).coverage.complete,true);
  });

  await check('actual 001-008 media constraint and repository reject PNG and audio without records or audit',async()=>{
    const mimeScope={environment:`qa_mime_${suffix()}`,workspaceId:'integration'},repo=createStudioRepository({pool,scope:mimeScope});
    const constraints=(await pool.query("SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='croupier_studio.media_records'::regclass AND contype='c'")).rows;
    assert.equal(constraints.length,1);assert.equal(constraints[0].conname,'media_records_check');
    assert.match(constraints[0].definition,/'video\/mp4'/);assert.match(constraints[0].definition,/'video\/webm'/);
    for(const contentType of ['video/mp4','video/webm','image/png','audio/wav','audio/mpeg']){
      const id=randomUUID(),sha256='d'.repeat(64),ext=contentType==='image/png'?'png':contentType==='audio/wav'?'wav':contentType==='audio/mpeg'?'mp3':contentType.split('/')[1];
      const classification=contentType==='image/png'?{dealerId:'astrid',eventId:'roulette.reference',kind:'idle',role:'alternative',situation:'VILA',label:'Reference',notes:'',mediaType:'image',game:'roulette',action:'reference',startPose:'VILA',endPose:'VILA',compositing:{mode:'alpha'}}:contentType.startsWith('audio/')?{dealerId:'astrid',eventId:'speak.goodluck',kind:'speech',role:'alternative',situation:'goodluck',label:'Audio',notes:'',mediaType:'audio'}:{dealerId:'astrid',eventId:'idle.ready',kind:'idle',role:'alternative',situation:'',label:'Video',notes:'',compositing:{mode:'green-screen',threshold:.23,softness:.15,despill:0}};
      const record={id,sha256,size:32,contentType,pathname:`croupier/media/dealers/astrid/review/uploads/${id}/${sha256}.${ext}`,classification};
      if(contentType.startsWith('video/'))await repo.registerMedia(record,{actor:'isolated-qa'});
      else{
        await assert.rejects(repo.registerMedia(record,{actor:'isolated-qa'}),error=>error.code==='studio_media_content_type_unsupported'&&error.statusCode===415);
        await assert.rejects(pool.query('INSERT INTO croupier_studio.media_records (environment_id,workspace_id,id,revision,record) VALUES ($1,$2,$3,$4,$5::jsonb)',[mimeScope.environment,mimeScope.workspaceId,id,'raw-fixture',JSON.stringify(record)]),error=>error.code==='23514'&&error.constraint==='media_records_check');
      }
    }
    const counts=(await pool.query('SELECT (SELECT count(*)::int FROM croupier_studio.media_records WHERE environment_id=$1) AS records,(SELECT count(*)::int FROM croupier_studio.audit_events WHERE environment_id=$1) AS audits',[mimeScope.environment])).rows[0];
    assert.deepEqual(counts,{records:2,audits:2});
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
    await runtimeRegistry.assertPersisted(pool);
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
  const { Pool } = createRequire(new URL('../services/game/package.json', import.meta.url))('pg');
  const pool = new Pool({ connectionString: config.databaseUrl, connectionTimeoutMillis: 5000, query_timeout: 10000 });
  try { await runStudioPostgresChecks({ pool }); } finally { await pool.end(); }
});
