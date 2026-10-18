import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import { createSpeechJournal } from '../../services/game/postgres-speech-journal.mjs';
import { MOVING_TRIAL_BUDGET } from '../../services/game/moving-speech-budget.mjs';

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
    newLimitMicroUsd:MOVING_TRIAL_BUDGET.totalBudgetMicroUsd,otherReservedMicroUsd:21070001};
  await second.authorizeMovingBudgetAmendment({...args,amendment:thirdTrial});
  assert.deepEqual(await history(),beforeThirdTrial,'third production trial preserves all eight released reservations');
  const thirdAdmitted=await second.reserveMovingSession(request(1200000,MOVING_TRIAL_BUDGET.totalBudgetMicroUsd));
  assert.equal(thirdAdmitted.totalBudgetMicroUsd,10800000);assert.equal(thirdAdmitted.totalReservedMicroUsd,10800000);
  await finish(thirdAdmitted);
  await assert.rejects(second.reserveMovingSession(request(1200000,MOVING_TRIAL_BUDGET.totalBudgetMicroUsd)),fail('generated_speech_total_budget_exhausted'));
  const allAmendments=(await pool.query('SELECT amendment FROM croupier_studio.moving_speech_budget_amendments WHERE environment_id=$1 AND budget_id=$2 ORDER BY budget_limit_micro_usd',[scope.environment,budgetId])).rows;
  assert.deepEqual(allAmendments.map(row=>row.amendment),[amendment,next,productionTrial,secondTrial,thirdTrial]);
  await journal.releaseLease({lease});
}
