import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import { createSpeechJournal, GPU_RESERVATION_WINDOW_MS } from '../../services/game/postgres-speech-journal.mjs';
import { MOVING_TRIAL_BUDGET } from '../../services/game/moving-speech-budget.mjs';
import { movingCapacityFixture } from './moving-capacity.mjs';
import { loadStudioMigrations } from '../../ops/neon-studio/migrations.mjs';

// Called only after the integration harness verifies an empty localhost fixture.
// Exercise immutable014/015 before017, then roll back everything so
// the normal migration runner independently verifies all ledger fingerprints.
export async function runMovingBudgetMigrationSqlChecks({pool}) {
  const migrations=await loadStudioMigrations(),client=await pool.connect();
  try {
    await client.query('BEGIN');
    for(const migration of migrations.filter(row=>row.version<'015'))await client.query(migration.sql);
    const checks=()=>client.query(`SELECT c.relname AS table_name,co.conname AS name,co.convalidated AS validated,
      pg_get_constraintdef(co.oid,true) AS definition FROM pg_constraint co JOIN pg_class c ON c.oid=co.conrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='croupier_studio'
      AND co.conname IN ('moving_speech_bindings_budget_limit_micro_usd_check',
        'moving_speech_budget_amendments_previous_limit_micro_usd_check','moving_speech_budget_amendments_budget_limit_micro_usd_check')
      ORDER BY c.relname,co.conname`).then(result=>result.rows);
    const oldChecks=await checks();assert.equal(oldChecks.length,3);
    assert.ok(oldChecks.every(row=>row.validated&&row.definition.endsWith('<= 15000000)')));
    await runInitialBudgetSqlChecks(client,'014');
    await client.query(`INSERT INTO croupier_studio.moving_speech_budget_amendments
      (environment_id,workspace_id,budget_id,amendment_id,previous_limit_micro_usd,budget_limit_micro_usd,reserved_before_micro_usd,amendment,created_at_ms)
      VALUES('isolated-capacity','qa','existing-grant',$1,10800000,13200000,10800000,'{}',1)`,[randomUUID()]);
    const snapshot=async()=>{
      const data={};
      for(const table of migrations.filter(row=>row.version<'015').flatMap(row=>row.tables)) {
        // Identifiers come only from the reviewed fixed migration manifest.
        data[table]=(await client.query(`SELECT to_jsonb(t) AS row FROM croupier_studio.${table} t ORDER BY to_jsonb(t)::text`)).rows;
      }
      return data;
    };
    const before=await snapshot();
    await client.query(migrations.find(row=>row.version==='015').sql);
    assert.deepEqual(await snapshot(),before,'015 changes no grant, reservation, policy, data or ledger row');
    assert.deepEqual(await checks(),oldChecks.map(row=>({...row,definition:row.definition.replace('15000000','40000000')})));
    await runInitialBudgetSqlChecks(client,'015');
    const insert=async(previous,limit)=>client.query(`INSERT INTO croupier_studio.moving_speech_budget_amendments
      (environment_id,workspace_id,budget_id,amendment_id,previous_limit_micro_usd,budget_limit_micro_usd,reserved_before_micro_usd,amendment,created_at_ms)
      VALUES('isolated-capacity','qa',$1,$2,$3,$4,$3,'{}',1)`,[randomUUID(),randomUUID(),previous,limit]);
    await insert(15600000,16800000);await insert(38800000,40000000);
    for(const [previous,limit] of [[38800000,40000001],[40000001,40000002]]) {
      await client.query('SAVEPOINT invalid_capacity');
      await assert.rejects(insert(previous,limit),error=>error.code==='23514');
      await client.query('ROLLBACK TO SAVEPOINT invalid_capacity');
    }
    const before017=await snapshot();
    await client.query(migrations.find(row=>row.version==='017').sql);
    assert.deepEqual(await snapshot(),before017,'017 changes no grant, reservation, policy, data or ledger row');
    assert.deepEqual(await checks(),oldChecks.map(row=>({...row,definition:row.definition.replace('15000000','45000000')})));
    await runInitialBudgetSqlChecks(client,'017');
    await insert(43800000,45000000);
    for(const [previous,limit] of [[43800000,45000001],[45000001,45000002]]){
      await client.query('SAVEPOINT invalid_capacity45');
      await assert.rejects(insert(previous,limit),error=>error.code==='23514');
      await client.query('ROLLBACK TO SAVEPOINT invalid_capacity45');
    }
    const priorBindings=await snapshot();
    await client.query('SAVEPOINT binding_capacity45');
    const exact=await client.query(`UPDATE croupier_studio.moving_speech_bindings SET budget_limit_micro_usd=45000000
      WHERE environment_id='qa_initial_017' AND session_id=(SELECT session_id FROM croupier_studio.moving_speech_bindings
      WHERE environment_id='qa_initial_017' ORDER BY session_id LIMIT 1) RETURNING session_id`);
    assert.equal(exact.rowCount,1);
    await assert.rejects(client.query(`UPDATE croupier_studio.moving_speech_bindings SET budget_limit_micro_usd=45000001
      WHERE environment_id='qa_initial_017' AND session_id=$1`,[exact.rows[0].session_id]),error=>error.code==='23514');
    await client.query('ROLLBACK TO SAVEPOINT binding_capacity45');
    assert.deepEqual(await snapshot(),priorBindings,'SQL boundary checks leave all prior budget history unchanged');
  } finally {try{await client.query('ROLLBACK');}finally{client.release();}}
}

async function runInitialBudgetSqlChecks(client,version) {
  // Real journal SQL inside the surrounding rollback-only DDL fixture. Replace
  // only transaction boundaries with savepoints; no query or constraint is mocked.
  const pool={async query(sql,values){
    if(sql==='BEGIN ISOLATION LEVEL READ COMMITTED')return client.query('SAVEPOINT initial_budget_call');
    if(sql==='COMMIT')return client.query('RELEASE SAVEPOINT initial_budget_call');
    if(sql==='ROLLBACK'){
      await client.query('ROLLBACK TO SAVEPOINT initial_budget_call');
      return client.query('RELEASE SAVEPOINT initial_budget_call');
    }
    return client.query(sql,values);
  }};
  const scope={environment:`qa_initial_${version}`,workspaceId:'initial-budget-fixture'};
  const journal=await createSpeechJournal({pool,environmentId:scope.environment});
  const id=randomUUID(),sha256='3'.repeat(64),revision='media-fixture',projectRevision='project-fixture';
  const record={id,sha256,contentType:'video/mp4',pathname:`croupier/media/${id}.mp4`,classification:{dealerId:'dragan',kind:'idle'}};
  await client.query("INSERT INTO croupier_studio.documents (environment_id,workspace_id,kind,revision,value) VALUES ($1,$2,'project',$3,jsonb_build_object('revision',$3::text))",[scope.environment,scope.workspaceId,projectRevision]);
  await client.query('INSERT INTO croupier_studio.media_records(environment_id,workspace_id,id,revision,record) VALUES($1,$2,$3,$4,$5::jsonb)',[scope.environment,scope.workspaceId,id,revision,JSON.stringify(record)]);
  await journal.initializeBudgetPolicy({dailyBudgetMicroUsd:20000000,confirmation:'verified-new-empty-cost-journal'});
  const lease=await journal.acquireLease({resource:'stream-session',holderId:'initial-budget-qa'});
  const request=()=>{
    const sessionId=randomBytes(16).toString('hex');
    return {...MOVING_TRIAL_BUDGET,scope,ownerHash:'a'.repeat(64),requestId:randomUUID(),fingerprint:'b'.repeat(64),
      binding:{schemaVersion:1,releaseSha256:'4'.repeat(64),dealerId:'dragan',workerAvatar:'dragan',profileRevision:'5'.repeat(64),
        sourceSetSha256:'6'.repeat(64),avatarSha256:'7'.repeat(64),bankReceiptSha256:'8'.repeat(64),sessionId,attemptId:'attempt-1',nonce:'9'.repeat(64)},
      mediaReferences:[{id,sha256,pathname:record.pathname,revision}],projectRevision,sessionId,endpointId:'initial-fixture',lease,
      currentBudgetMicroUsd:MOVING_TRIAL_BUDGET.currentDailyBudgetMicroUsd,workerState:{workers:0,busy:0,available:0}};
  };
  for(let attempt=1;attempt<=11;attempt++){
    const saved=await journal.reserveMovingSession(request());
    assert.equal(saved.totalBudgetMicroUsd,13200000,`${version}: initial and durable grant must not inherit technical capacity`);
    assert.equal(saved.totalReservedMicroUsd,attempt*1200000);
    const jobId=`initial-${saved.sessionId}`;
    await journal.markRequestSubmissionStarted({key:saved.key,lease});
    await journal.markSubmissionStarted({sessionId:saved.sessionId,lease});
    await journal.attachJob({sessionId:saved.sessionId,lease,jobId});
    await journal.recordProviderStatus({sessionId:saved.sessionId,lease,jobId,status:'COMPLETED'});
    await journal.confirmWorkerDrained({sessionId:saved.sessionId,lease,proof:{workerId:saved.workerId,workers:0,busy:0,available:0}});
    await journal.completeRequest({key:saved.key,lease});
  }
  const history=()=>client.query('SELECT * FROM croupier_studio.moving_speech_bindings WHERE environment_id=$1 ORDER BY session_id',[scope.environment]).then(r=>r.rows);
  const before=await history();assert.equal(before.length,11);
  await assert.rejects(journal.reserveMovingSession(request()),error=>error.code==='generated_speech_total_budget_exhausted');
  await assert.rejects(journal.reserveMovingSession({...request(),initialBudgetMicroUsd:40000000}),error=>error.code==='generated_speech_total_budget_exhausted');
  assert.deepEqual(await history(),before,`${version}: neither runtime nor changed bootstrap can raise an existing13.2 grant`);
  await journal.releaseLease({lease});
}

// Called only by the localhost PostgreSQL fixture after its target assertion.
export async function runMovingBudgetSqlChecks({pool,input,journal}) {
  const scope=input.scope, empty={workers:0,busy:0,available:0};
  const fail=code=>error=>error?.code===code;
  const budgetId=`amendment-${randomUUID()}`;
  let lease=await journal.acquireLease({resource:'stream-session',holderId:'budget-amendment-qa'});
  const request=(reserveMicroUsd,totalBudgetMicroUsd)=>{
    const sessionId=randomBytes(16).toString('hex');
    return {...input,lease,sessionId,requestId:`amendment-${randomUUID()}`,budgetId,
      binding:{...input.binding,sessionId},reserveMicroUsd,totalBudgetMicroUsd,currentBudgetMicroUsd:20000000};
  };
  async function finish(saved) {
    const jobId=`job-${saved.sessionId}`;
    await journal.markRequestSubmissionStarted({key:saved.key,lease});
    await journal.markSubmissionStarted({sessionId:saved.sessionId,lease});
    await journal.attachJob({sessionId:saved.sessionId,lease,jobId});
    await journal.recordProviderStatus({sessionId:saved.sessionId,lease,jobId,status:'COMPLETED'});
    await journal.confirmWorkerDrained({sessionId:saved.sessionId,lease,proof:{workerId:saved.workerId,...empty}});
    await journal.completeRequest({key:saved.key,lease});
  }
  // Keep distinct historical reservations, including eight before trial three.
  for(let index=0;index<3;index++) await finish(await journal.reserveMovingSession(request(1200000,4800000)));
  const previous=await journal.reserveMovingSession(request(1200000,4800000));
  const amendment={amendmentId:randomUUID(),budgetId,actor:'isolated-qa',authorizationId:'fixture-total-15',
    evidenceSha256:'a'.repeat(64),observedAtMs:Date.now(),expectedLimitMicroUsd:4800000,expectedReservedMicroUsd:4800000,
    expectedReservationCount:4,newLimitMicroUsd:6000000,globalLimitMicroUsd:15000000,
    providerSpentMicroUsd:499028,otherReservedMicroUsd:11736667,windowReserveMicroUsd:2333334};
  const args={scope,amendment,workerState:empty,confirmation:'apply-explicit-moving-budget-amendment'};
  await assert.rejects(journal.authorizeMovingBudgetAmendment(args),fail('generated_speech_session_busy'));
  await finish(previous);
  const history=()=>pool.query('SELECT * FROM croupier_studio.moving_speech_bindings WHERE environment_id=$1 AND budget_id=$2 ORDER BY session_id',[scope.environment,budgetId]).then(r=>r.rows);
  const before=await history();
  await assert.rejects(journal.reserveMovingSession(request(1200000,6000000)),fail('generated_speech_total_budget_exhausted'));
  for(const [overrides,code] of [
    [{observedAtMs:Date.now()-300001},'generated_speech_budget_evidence_stale'],
    [{expectedReservationCount:5},'generated_speech_budget_amendment_conflict'],
    [{expectedReservedMicroUsd:4700000},'generated_speech_budget_amendment_conflict'],
    [{newLimitMicroUsd:16000000},'invalid_generated_speech_budget_amendment'],
    [{windowReserveMicroUsd:3000000},'invalid_generated_speech_budget_amendment'],
  ]) await assert.rejects(journal.authorizeMovingBudgetAmendment({...args,amendment:{...amendment,...overrides}}),fail(code));
  await assert.rejects(journal.authorizeMovingBudgetAmendment({...args,confirmation:'not-confirmed'}),fail('invalid_generated_speech_budget_amendment'));
  await assert.rejects(journal.authorizeMovingBudgetAmendment({...args,scope:{...scope,workspaceId:'other'}}),fail('generated_speech_moving_budget_scope_mismatch'));
  await assert.rejects(journal.authorizeMovingBudgetAmendment({...args,workerState:{...empty,busy:1}}),fail('generated_speech_worker_not_drained'));
  assert.deepEqual(await history(),before);
  const second=await createSpeechJournal({pool,environmentId:scope.environment});
  const grants=await Promise.all([journal.authorizeMovingBudgetAmendment(args),second.authorizeMovingBudgetAmendment(args)]);
  assert.deepEqual(grants.map(x=>x.alreadyApplied).sort(),[false,true]);
  assert.deepEqual(await history(),before,'amendment does not rewrite historical bindings');
  await assert.rejects(second.authorizeMovingBudgetAmendment({...args,amendment:{...amendment,amendmentId:randomUUID()}}),fail('generated_speech_budget_amendment_conflict'));
  await assert.rejects(second.authorizeMovingBudgetAmendment({...args,amendment:{...amendment,actor:'changed'}}),fail('generated_speech_budget_amendment_conflict'));
  const attempts=await Promise.allSettled([journal.reserveMovingSession(request(1200000,6000000)),second.reserveMovingSession(request(1200000,6000000))]);
  assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(attempts.find(x=>x.status==='rejected').reason.code,'generated_speech_total_budget_exhausted');
  const saved=attempts.find(x=>x.status==='fulfilled').value;
  assert.equal(saved.totalBudgetMicroUsd,6000000);assert.equal(saved.totalReservedMicroUsd,6000000);
  await finish(saved);
  await assert.rejects(second.reserveMovingSession(request(1200000,15000000)),fail('generated_speech_total_budget_exhausted'));
  assert.equal((await history()).reduce((sum,row)=>sum+Number(row.reserved_micro_usd),0),6000000);
  const rows=(await pool.query('SELECT * FROM croupier_studio.moving_speech_budget_amendments WHERE environment_id=$1 AND budget_id=$2',[scope.environment,budgetId])).rows;
  assert.equal(rows.length,1);assert.deepEqual(rows[0].amendment,amendment);
  assert.equal((await second.authorizeMovingBudgetAmendment(args)).alreadyApplied,true);
  // The new runtime ceiling alone cannot raise the durable six-dollar limit.
  const historical=await history();
  await assert.rejects(second.reserveMovingSession(request(1200000,MOVING_TRIAL_BUDGET.totalBudgetMicroUsd)),fail('generated_speech_total_budget_exhausted'));
  const next={...amendment,amendmentId:randomUUID(),authorizationId:'fixture-total-40',observedAtMs:Date.now(),
    expectedLimitMicroUsd:6000000,expectedReservedMicroUsd:6000000,expectedReservationCount:5,
    newLimitMicroUsd:7200000,globalLimitMicroUsd:40000000,otherReservedMicroUsd:14070001};
  await second.authorizeMovingBudgetAmendment({...args,amendment:next});
  assert.deepEqual(await history(),historical,'raising global authorization does not refund or rewrite reservations');
  const nextAttempt=await second.reserveMovingSession(request(1200000,MOVING_TRIAL_BUDGET.totalBudgetMicroUsd));
  assert.equal(nextAttempt.totalBudgetMicroUsd,7200000);assert.equal(nextAttempt.totalReservedMicroUsd,7200000);
  await finish(nextAttempt);
  await assert.rejects(second.reserveMovingSession(request(1200000,MOVING_TRIAL_BUDGET.totalBudgetMicroUsd)),fail('generated_speech_total_budget_exhausted'));
  const beforeProductionTrial=await history();
  const productionTrial={...next,amendmentId:randomUUID(),observedAtMs:Date.now(),
    expectedLimitMicroUsd:7200000,expectedReservedMicroUsd:7200000,expectedReservationCount:6,
    newLimitMicroUsd:8400000,otherReservedMicroUsd:16403334};
  await second.authorizeMovingBudgetAmendment({...args,amendment:productionTrial});
  assert.deepEqual(await history(),beforeProductionTrial,'another trial preserves every prior reservation');
  const admitted=await second.reserveMovingSession(request(1200000,MOVING_TRIAL_BUDGET.totalBudgetMicroUsd));
  assert.equal(admitted.totalBudgetMicroUsd,8400000);assert.equal(admitted.totalReservedMicroUsd,8400000);
  await finish(admitted);
  await assert.rejects(second.reserveMovingSession(request(1200000,MOVING_TRIAL_BUDGET.totalBudgetMicroUsd)),fail('generated_speech_total_budget_exhausted'));
  const beforeSecondTrial=await history();
  const secondTrial={...productionTrial,amendmentId:randomUUID(),authorizationId:'fixture-trial-two',observedAtMs:Date.now(),
    expectedLimitMicroUsd:8400000,expectedReservedMicroUsd:8400000,expectedReservationCount:7,
    newLimitMicroUsd:9600000,providerSpentMicroUsd:525826,otherReservedMicroUsd:18736668};
  await second.authorizeMovingBudgetAmendment({...args,amendment:secondTrial});
  assert.deepEqual(await history(),beforeSecondTrial,'second production trial retains all consumed reservations');
  const secondAdmitted=await second.reserveMovingSession(request(1200000,MOVING_TRIAL_BUDGET.totalBudgetMicroUsd));
  assert.equal(secondAdmitted.totalBudgetMicroUsd,9600000);assert.equal(secondAdmitted.totalReservedMicroUsd,9600000);
  await finish(secondAdmitted);
  await assert.rejects(second.reserveMovingSession(request(1200000,MOVING_TRIAL_BUDGET.totalBudgetMicroUsd)),fail('generated_speech_total_budget_exhausted'));
  const beforeThirdTrial=await history();
  assert.equal(beforeThirdTrial.length,8);
  const thirdTrial={...secondTrial,amendmentId:randomUUID(),authorizationId:'fixture-trial-three',observedAtMs:Date.now(),
    expectedLimitMicroUsd:9600000,expectedReservedMicroUsd:9600000,expectedReservationCount:8,
    newLimitMicroUsd:10800000,otherReservedMicroUsd:21070001};
  await second.authorizeMovingBudgetAmendment({...args,amendment:thirdTrial});
  assert.deepEqual(await history(),beforeThirdTrial,'third production trial preserves all eight released reservations');
  const thirdAdmitted=await second.reserveMovingSession(request(1200000,MOVING_TRIAL_BUDGET.totalBudgetMicroUsd));
  assert.equal(thirdAdmitted.totalBudgetMicroUsd,10800000);assert.equal(thirdAdmitted.totalReservedMicroUsd,10800000);
  await finish(thirdAdmitted);
  await assert.rejects(second.reserveMovingSession(request(1200000,MOVING_TRIAL_BUDGET.totalBudgetMicroUsd)),fail('generated_speech_total_budget_exhausted'));
  const beforeTwoReplies=await history();
  assert.equal(beforeTwoReplies.length,9);
  const reservationHistory=()=>pool.query('SELECT r.* FROM croupier_studio.gpu_reservations r JOIN croupier_studio.moving_speech_bindings b USING(environment_id,session_id) WHERE b.environment_id=$1 AND b.budget_id=$2 ORDER BY r.session_id,r.day',[scope.environment,budgetId]).then(r=>r.rows);
  const priorCharges=await reservationHistory();
  const twoReplies={...thirdTrial,amendmentId:randomUUID(),authorizationId:'fixture-two-production-replies',observedAtMs:Date.now(),
    expectedLimitMicroUsd:10800000,expectedReservedMicroUsd:10800000,expectedReservationCount:9,
    newLimitMicroUsd:13200000,windowReserveMicroUsd:2400000};
  // Raising either runtime limit alone must not change the durable total ceiling.
  await assert.rejects(second.reserveMovingSession({...request(1200000,MOVING_TRIAL_BUDGET.totalBudgetMicroUsd),currentBudgetMicroUsd:MOVING_TRIAL_BUDGET.currentDailyBudgetMicroUsd}),fail('generated_speech_total_budget_exhausted'));
  await second.authorizeMovingBudgetAmendment({...args,amendment:twoReplies});
  assert.deepEqual(await history(),beforeTwoReplies,'two-reply amendment preserves all nine historical bindings');
  assert.deepEqual(await reservationHistory(),priorCharges,'two-reply amendment does not reset or refund historical charges');
  for(let reply=1;reply<=2;reply++) {
    const saved=await second.reserveMovingSession(request(MOVING_TRIAL_BUDGET.reserveMicroUsd,MOVING_TRIAL_BUDGET.totalBudgetMicroUsd));
    assert.equal(saved.totalBudgetMicroUsd,13200000);
    assert.equal(saved.totalReservedMicroUsd,10800000+reply*1200000);
    await finish(saved);
  }
  const afterTwoReplies=await history(),oldIds=new Set(beforeTwoReplies.map(row=>row.session_id));
  assert.equal(afterTwoReplies.length,11);
  assert.deepEqual(afterTwoReplies.filter(row=>oldIds.has(row.session_id)),beforeTwoReplies);
  assert.deepEqual((await reservationHistory()).filter(row=>oldIds.has(row.session_id)),priorCharges);
  await assert.rejects(second.reserveMovingSession(request(1200000,MOVING_TRIAL_BUDGET.totalBudgetMicroUsd)),fail('generated_speech_total_budget_exhausted'));
  assert.deepEqual(await history(),afterTwoReplies,'a rejected extra reply creates no partial binding');
  const chargesBeforeCapacity=await reservationHistory();
  const fundedCapacity={...twoReplies,amendmentId:randomUUID(),authorizationId:'fixture-funded-capacity',observedAtMs:Date.now(),
    expectedLimitMicroUsd:13200000,expectedReservedMicroUsd:13200000,expectedReservationCount:11,newLimitMicroUsd:15600000};
  await second.authorizeMovingBudgetAmendment({...args,amendment:fundedCapacity});
  assert.deepEqual(await history(),afterTwoReplies,'schema capacity and amendment preserve every historical binding');
  assert.deepEqual(await reservationHistory(),chargesBeforeCapacity,'technical capacity does not refund any prior charge');
  for(let reply=1;reply<=2;reply++) {
    const saved=await second.reserveMovingSession(request(1200000,MOVING_TRIAL_BUDGET.totalBudgetMicroUsd));
    assert.equal(saved.totalBudgetMicroUsd,15600000);
    assert.equal(saved.totalReservedMicroUsd,13200000+reply*1200000);
    await finish(saved);
  }
  const afterCapacity=await history();assert.equal(afterCapacity.length,13);
  await assert.rejects(second.reserveMovingSession(request(1200000,MOVING_TRIAL_BUDGET.totalBudgetMicroUsd)),fail('generated_speech_total_budget_exhausted'));
  assert.deepEqual(await history(),afterCapacity,'45 USD runtime capacity alone cannot spend beyond the explicit 15.6 USD grant');
  const allAmendments=(await pool.query('SELECT amendment FROM croupier_studio.moving_speech_budget_amendments WHERE environment_id=$1 AND budget_id=$2 ORDER BY budget_limit_micro_usd',[scope.environment,budgetId])).rows;
  assert.deepEqual(allAmendments.map(row=>row.amendment),[amendment,next,productionTrial,secondTrial,thirdTrial,twoReplies,fundedCapacity]);
  await journal.releaseLease({lease});
  await runMovingCapacitySqlChecks({pool,input,journal});
}

async function runMovingCapacitySqlChecks({pool,input,journal}) {
  const scope=input.scope,empty={workers:0,busy:0,available:0},warm={workers:1,busy:0,available:1};
  const fail=code=>error=>error?.code===code;
  const budgetId=`capacity-${randomUUID()}`,endpointId='fixtureendpoint';
  const lease=await journal.acquireLease({resource:'stream-session',holderId:'capacity-qa',ttlMs:GPU_RESERVATION_WINDOW_MS});
  const second=await createSpeechJournal({pool,environmentId:scope.environment});
  const proof=(isWarm=true,now=Date.now())=>movingCapacityFixture({warm:isWarm,endpointId,now});
  const initializingProof=()=>{
    const value=proof(false);value.health.workers.initializing=1;
    value.release.workers.workers=[{state:'scaled-down',image:value.release.expectedImage,
      version:value.release.workers.endpointVersion,isStale:false}];
    return value;
  };
  const request=(movingCapacity=proof(),extra={})=>{
    const sessionId=randomBytes(16).toString('hex');
    return {...input,endpointId,lease,sessionId,requestId:`capacity-${randomUUID()}`,budgetId,
      binding:{...input.binding,sessionId},reserveMicroUsd:100000,totalBudgetMicroUsd:1000000,
      currentBudgetMicroUsd:20000000,workerState:movingCapacity.health.workers.running?warm:empty,movingCapacity,...extra};
  };
  const counts=()=>pool.query(`SELECT
    (SELECT count(*) FROM croupier_studio.gpu_sessions WHERE environment_id=$1)::int AS sessions,
    (SELECT count(*) FROM croupier_studio.gpu_reservations WHERE environment_id=$1)::int AS reservations,
    (SELECT count(*) FROM croupier_studio.speech_requests WHERE environment_id=$1)::int AS requests,
    (SELECT count(*) FROM croupier_studio.moving_speech_bindings WHERE environment_id=$1)::int AS bindings`,[scope.environment]).then(r=>r.rows[0]);
  const history=()=>pool.query('SELECT * FROM croupier_studio.moving_speech_bindings WHERE environment_id=$1 ORDER BY session_id',[scope.environment]).then(r=>r.rows);
  const leaseRow=()=>pool.query("SELECT holder_id,fence,expires_at_ms,recovery_only FROM croupier_studio.speech_execution_leases WHERE environment_id=$1 AND resource='stream-session'",[scope.environment]).then(r=>r.rows[0]);
  const priorHistory=await history(),priorLease=await leaseRow();
  async function finish(saved) {
    const jobId=`job-${saved.sessionId}`;
    await journal.markRequestSubmissionStarted({key:saved.key,lease});
    await journal.markSubmissionStarted({sessionId:saved.sessionId,lease});
    await journal.attachJob({sessionId:saved.sessionId,lease,jobId});
    await journal.recordProviderStatus({sessionId:saved.sessionId,lease,jobId,status:'COMPLETED'});
    await journal.confirmWorkerDrained({sessionId:saved.sessionId,lease,proof:{workerId:saved.workerId,...empty}});
    await journal.completeRequest({key:saved.key,lease});
  }
  for(const mutate of [
    value=>{value.health.jobs.inQueue=1;},
    value=>{value.health.jobs.inProgress=1;},
    value=>{value.observedAtMs=Date.now()-15001;},
    value=>{value.release.endpoint.id='foreign-endpoint';},
    value=>{value.release.capacity.activePods[0].image='foreign-image';},
    value=>{value.release.workers.workers[0].state='unknown';},
    value=>{delete value.health.jobs.inQueue;},
  ]) {
    const capacity=proof();mutate(capacity);const before=await counts();
    await assert.rejects(journal.reserveMovingSession(request(capacity)),fail('generated_speech_moving_capacity_unverified'));
    assert.deepEqual(await counts(),before,'invalid capacity leaves no partial request, binding or charge');
    assert.deepEqual(await leaseRow(),priorLease,'capacity checks cannot renew or replace the execution fence');
  }
  await assert.rejects(second.reserveMovingSession(request(proof(),{lease:{...lease,fence:lease.fence+1}})),fail('generated_speech_stale_fence'));
  for(const mutate of [
    value=>{value.release.workers.workers=[];},
    value=>{value.release.workers.workers[0].isStale=true;},
    value=>{value.health.workers.initializing=2;},
    value=>{value.health.jobs.inQueue=1;},
  ]) {
    const capacity=initializingProof();mutate(capacity);const before=await counts();
    await assert.rejects(journal.reserveMovingSession(request(capacity)),fail('generated_speech_moving_capacity_unverified'));
    assert.deepEqual(await counts(),before,'unverified initialization leaves no request, binding or charge');
    assert.deepEqual(await leaseRow(),priorLease);
  }
  await assert.rejects(journal.reserveSession({...request(),workerState:warm}),fail('generated_speech_worker_not_drained'));
  assert.deepEqual(await history(),priorHistory);
  for(const [index,makeProof] of [()=>proof(false),()=>proof(true),initializingProof].entries()) {
    const saved=await journal.reserveMovingSession(request(makeProof()));
    assert.equal(saved.totalReservedMicroUsd,(index+1)*100000);
    assert.equal(saved.totalBudgetMicroUsd,1000000);
    assert.equal(saved.fence,lease.fence);
    await finish(saved);
  }
  // Same valid fence and ample remaining budget: the SQL session lock, not the
  // spending ceiling or application singleton, must exclude the second writer.
  const attempts=await Promise.allSettled([journal.reserveMovingSession(request()),second.reserveMovingSession(request())]);
  assert.equal(attempts.filter(value=>value.status==='fulfilled').length,1);
  assert.equal(attempts.find(value=>value.status==='rejected').reason.code,'generated_speech_session_busy');
  const saved=attempts.find(value=>value.status==='fulfilled').value;
  assert.equal((await journal.listRecoverableSessions()).length,1);
  assert.equal(saved.totalReservedMicroUsd,400000);
  assert.deepEqual(await leaseRow(),priorLease);
  const spentHistory=await history();
  assert.deepEqual(spentHistory.filter(row=>row.budget_id!==budgetId),priorHistory,'other budget histories remain byte-for-byte unchanged');
  assert.equal(spentHistory.filter(row=>row.budget_id===budgetId).length,4);
  const jobId=`job-${saved.sessionId}`;
  await journal.markRequestSubmissionStarted({key:saved.key,lease});
  await journal.markSubmissionStarted({sessionId:saved.sessionId,lease});
  await journal.attachJob({sessionId:saved.sessionId,lease,jobId});
  // Advance only the journal clock; all rows, locks and constraints are real SQL.
  const recoveryNow=Date.now()+GPU_RESERVATION_WINDOW_MS+1000;
  const recovering=await createSpeechJournal({pool,environmentId:scope.environment,now:()=>recoveryNow});
  await assert.rejects(recovering.acquireLease({resource:'stream-session',holderId:'paid-after-expiry'}),fail('generated_speech_recovery_required'));
  const recovery=await recovering.acquireLease({resource:'stream-session',holderId:'capacity-recovery',recoveryOnly:true});
  assert.equal(recovery.fence,lease.fence+1);
  const capacity=proof(true,recoveryNow);
  await assert.rejects(recovering.reserveMovingSession(request(capacity,{lease:recovery})),fail('generated_speech_recovery_only'));
  const retirement={sessionId:saved.sessionId,lease:recovery,jobId,providerStatus:'not_found',movingCapacity:capacity,
    proof:{workerId:saved.workerId,...warm}};
  await assert.rejects(recovering.retireExpiredMissingSession(retirement),fail('generated_speech_worker_not_drained'));
  await assert.rejects(recovering.confirmWorkerDrained(retirement),fail('generated_speech_worker_not_drained'));
  const beforeDrain=await counts();
  await recovering.retireExpiredMissingSession({...retirement,proof:{workerId:saved.workerId,...empty}});
  assert.equal((await recovering.listRecoverableSessions()).length,0);
  assert.deepEqual(await counts(),beforeDrain,'recovery releases capacity without deleting or refunding cost rows');
  assert.deepEqual(await history(),spentHistory);
  await recovering.releaseLease({lease:recovery});
}
