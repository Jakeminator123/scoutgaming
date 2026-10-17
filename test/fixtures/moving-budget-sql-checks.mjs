import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import { createSpeechJournal } from '../../web/postgres-speech-journal.mjs';

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
  const previous=await journal.reserveMovingSession(request(4800000,4800000));
  const amendment={amendmentId:randomUUID(),budgetId,actor:'isolated-qa',authorizationId:'fixture-total-15',
    evidenceSha256:'a'.repeat(64),observedAtMs:Date.now(),expectedLimitMicroUsd:4800000,expectedReservedMicroUsd:4800000,
    expectedReservationCount:1,newLimitMicroUsd:6000000,globalLimitMicroUsd:15000000,
    providerSpentMicroUsd:499028,otherReservedMicroUsd:11736667,windowReserveMicroUsd:2333334};
  const args={scope,amendment,workerState:empty,confirmation:'apply-explicit-moving-budget-amendment'};
  await assert.rejects(journal.authorizeMovingBudgetAmendment(args),fail('generated_speech_session_busy'));
  await finish(previous);
  const history=()=>pool.query('SELECT * FROM croupier_studio.moving_speech_bindings WHERE environment_id=$1 AND budget_id=$2 ORDER BY session_id',[scope.environment,budgetId]).then(r=>r.rows);
  const before=await history();
  await assert.rejects(journal.reserveMovingSession(request(1200000,6000000)),fail('generated_speech_total_budget_exhausted'));
  for(const [overrides,code] of [
    [{observedAtMs:Date.now()-300001},'generated_speech_budget_evidence_stale'],
    [{expectedReservationCount:2},'generated_speech_budget_amendment_conflict'],
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
  await journal.releaseLease({lease});
}
