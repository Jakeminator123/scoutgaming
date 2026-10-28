import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {createMovingDriftController} from '../../services/game/moving-drift-controller.mjs';
import {createPostgresMovingDriftStore} from '../../services/game/postgres-moving-drift.mjs';
import {createSpeechJournal,GPU_RESERVATION_WINDOW_MS} from '../../services/game/postgres-speech-journal.mjs';
import {canonicalStudioJson} from '../../packages/studio-registry/server/document-contract.mjs';

const profiles=Object.freeze([{id:'base',label:'SQL fixture',dealerId:'dragan',endpointId:'endpoint-fixture',releaseDigest:'a'.repeat(64),bankHash:'b'.repeat(64)}]);
const capabilities=Object.freeze({connected:true,requireExecutor:true});
const empty=Object.freeze({workers:0,busy:0,available:0});
const reject=code=>error=>error?.code===code&&error.message===code;
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};};
async function bounded(promise){
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('drift_sql_barrier_timeout')),2000);})]);}
  finally{clearTimeout(timer);}
}
const marker=sql=>/\/\* ([^*]+) \*\//.exec(sql)?.[1]??sql.split(/\s/)[0];

/** Existing localhost integration harness supplies its already migrated pool.
 * No credentials, new pool, server, provider calls or schema bootstrap here.
 * Only tiny synthetic rows in uniquely scoped QA environments are inserted.
 */
export async function runMovingDriftExecutorSqlChecks({pool}){
  const target=(await pool.query('SELECT current_user AS role,current_database() AS database,inet_server_addr()::text AS address')).rows[0];
  assert.equal(target.role,'studio_qa');assert.equal(target.database,'postgres');
  assert.ok(['127.0.0.1','127.0.0.1/32','::1','::1/128'].includes(target.address));
  for(const table of ['moving_drift_control','moving_speech_bindings','gpu_sessions']){
    assert.ok((await pool.query('SELECT to_regclass($1) AS relation',['croupier_studio.'+table])).rows[0].relation);
  }
  const runId=randomBytes(4).toString('hex'),checks=[];

  async function setup(name){
    const scope={environment:`drift-exec-${runId}-${name}`,workspaceId:'drift-executor-fixture'};
    const trace=[],guardSpans=[],controls={studio:null,offLock:null,pause:null};let sequence=0;
    const clients=new WeakMap();
    const tracedPool={async connect(){
      const client=await pool.connect(),clientId=++sequence;
      const wrapped={release:()=>client.release(),query(sql,values){
        const tag=marker(sql);trace.push({clientId,tag});
        const result=client.query(sql,values);
        if(tag==='speech:studio_lock')controls.studio?.resolve();
        if(tag==='moving-drift:lock')controls.offLock?.resolve();
        return result;
      }};
      clients.set(wrapped,clientId);return wrapped;
    }};
    const make=()=>createMovingDriftController({store:createPostgresMovingDriftStore({pool:tracedPool,environmentId:scope.environment,dealerId:'dragan'}),profiles,capabilities});
    const controller=make();
    const journal=await createSpeechJournal({pool:tracedPool,environmentId:scope.environment,driftControl:{scope,guard:async({client,...input})=>{
      const span={phase:input.phase,clientId:clients.get(client),start:trace.length};guardSpans.push(span);
      // The controller receives this exact already-transactional client. Its
      // store must neither connect elsewhere nor emit a nested BEGIN/COMMIT.
      const sameClient=createMovingDriftController({store:createPostgresMovingDriftStore({environmentId:scope.environment,dealerId:'dragan',
        transaction:work=>work(client)}),profiles,capabilities});
      try{
        const result=await sameClient.guardAdmission(input);
        if(controls.pause?.phase===input.phase){controls.pause.entered.resolve();await controls.pause.resume.promise;}
        return result;
      }finally{span.end=trace.length;}
    }}});
    // Seed shape follows moving-budget-sql-checks.mjs; all media are metadata.
    const id=randomUUID(),sha256='3'.repeat(64),revision='media-fixture',projectRevision='project-fixture';
    const record={id,sha256,contentType:'video/mp4',pathname:`croupier/media/${id}.mp4`,classification:{dealerId:'dragan',kind:'idle'}};
    await pool.query("INSERT INTO croupier_studio.documents(environment_id,workspace_id,kind,revision,value) VALUES($1,$2,'project',$3,jsonb_build_object('revision',$3::text))",[scope.environment,scope.workspaceId,projectRevision]);
    await pool.query('INSERT INTO croupier_studio.media_records(environment_id,workspace_id,id,revision,record) VALUES($1,$2,$3,$4,$5::jsonb)',[scope.environment,scope.workspaceId,id,revision,JSON.stringify(record)]);
    await journal.initializeBudgetPolicy({dailyBudgetMicroUsd:1000000,confirmation:'verified-new-empty-cost-journal'});
    const lease=await journal.acquireLease({resource:'stream-session',holderId:'drift-sql-journal',ttlMs:GPU_RESERVATION_WINDOW_MS});
    const holderId='drift-sql-executor';
    async function observe(execution,state){
      return controller.observe({revision:state.revision,operationId:state.operationId,execution,observedAtMs:state.serverNowMs,
        observedProfileIds:['base'],workers:[],busyJobs:0,queuedJobs:0,
        applied:{revision:state.revision,operationId:state.operationId,mode:state.desired.mode,profileId:state.desired.profileId,workersMin:0,workersMax:1}});
    }
    let execution=await controller.claimExecution({holderId,profileId:'base',leaseMs:60000});
    await observe(execution,await controller.status());
    const saving=await controller.command({mode:'saving',profileId:'base',expectedRevision:0,commandId:'saving-first'});
    execution=await controller.claimExecution({holderId,profileId:'base',leaseMs:60000});
    const ready=await observe(execution,saving);assert.equal(ready.admission.allowed,true);
    const admission=Object.freeze(await controller.authorizeAdmission({revision:ready.revision,profileId:'base'}));
    const request=()=>{
      const sessionId=randomBytes(16).toString('hex');
      return{scope,sessionId,endpointId:'endpoint-fixture',lease,driftAdmission:admission,ownerHash:'a'.repeat(64),requestId:randomUUID(),fingerprint:'b'.repeat(64),
        binding:{schemaVersion:1,releaseSha256:'4'.repeat(64),dealerId:'dragan',workerAvatar:'dragan',profileRevision:'5'.repeat(64),
          sourceSetSha256:'6'.repeat(64),avatarSha256:'7'.repeat(64),bankReceiptSha256:'8'.repeat(64),sessionId,attemptId:'attempt-fixture',nonce:'9'.repeat(64)},
        mediaReferences:[{id,revision,sha256,pathname:record.pathname}],projectRevision,budgetId:'drift-sql-budget',totalBudgetMicroUsd:1000000,
        reserveMicroUsd:250000,currentBudgetMicroUsd:1000000,workerState:empty};
    };
    const off=()=>controller.command({mode:'off',expectedRevision:ready.revision,commandId:'off-first'});
    const snapshot=async()=>{
      const data={};
      for(const table of ['speech_execution_leases','speech_requests','gpu_budget_policies','gpu_sessions','gpu_reservations','moving_speech_bindings']){
        data[table]=(await pool.query(`SELECT to_jsonb(t) AS row FROM croupier_studio.${table} t WHERE environment_id=$1 ORDER BY to_jsonb(t)::text`,[scope.environment])).rows;
      }
      return data;
    };
    async function startSubmission(input){
      const saved=await journal.reserveMovingSession(input);
      await journal.markRequestSubmissionStarted({key:saved.key,lease});
      await journal.markSubmissionStarted(input);return saved;
    }
    async function assertLockOrder(){
      assert.ok(guardSpans.length>0);
      for(const span of guardSpans){
        const own=trace.filter(row=>row.clientId===span.clientId),tags=own.map(row=>row.tag);
        assert.equal(tags.filter(tag=>tag==='BEGIN').length,1,'one outer journal BEGIN per guarded checkout');
        assert.ok(tags.indexOf('speech:studio_lock')<tags.indexOf('moving-drift:lock'));
        if(tags.includes('speech:lock'))assert.ok(tags.indexOf('moving-drift:lock')<tags.indexOf('speech:lock'));
        assert.ok(!trace.slice(span.start,span.end).filter(row=>row.clientId===span.clientId).some(row=>['BEGIN','COMMIT','ROLLBACK'].includes(row.tag)),
          'SQL-only controller guard must not nest or close the journal transaction');
      }
    }
    return{scope,trace,controls,journal,controller,make,request,off,snapshot,startSubmission,assertLockOrder,admission,holderId,observe};
  }

  // Hold the real Studio advisory fence while Off commits on another SQL
  // client. The queued journal call then acquires its fences and must see Off.
  async function offWins(f,operation){
    const blocker=await pool.connect();let pending,began=false;
    try{
      await blocker.query('BEGIN');began=true;
      const hash=createHash('sha256').update(`croupier-studio\0${canonicalStudioJson(f.scope)}`).digest();
      await blocker.query('SELECT pg_advisory_xact_lock($1::integer,$2::integer)',[hash.readInt32BE(0),hash.readInt32BE(4)]);
      f.controls.studio=deferred();pending=operation();pending.catch(()=>{});
      await bounded(f.controls.studio.promise);const stopped=await bounded(f.off());assert.equal(stopped.desired.mode,'off');
      await blocker.query('COMMIT');began=false;
      await assert.rejects(bounded(pending),reject('drift_not_admitting'));
    }finally{
      f.controls.studio=null;
      try{if(began)await blocker.query('ROLLBACK');}finally{blocker.release();}
      if(pending)await Promise.allSettled([pending]);
    }
  }
  const reserveOff=await setup('reserve-off'),reserveInput=reserveOff.request(),beforeReserve=await reserveOff.snapshot();
  await offWins(reserveOff,()=>reserveOff.journal.reserveMovingSession(reserveInput));
  assert.deepEqual(await reserveOff.snapshot(),beforeReserve,'Off-won reserve rolls back every budget, request and session mutation');
  await reserveOff.assertLockOrder();checks.push('drift-sql-off-wins-reserve-with-no-cost-or-request-write');

  const dispatchOff=await setup('dispatch-off'),dispatchInput=dispatchOff.request();
  await dispatchOff.startSubmission(dispatchInput);const beforeDispatch=await dispatchOff.snapshot();
  await offWins(dispatchOff,()=>dispatchOff.journal.assertMovingSession({...dispatchInput,submissionPhase:true}));
  assert.deepEqual(await dispatchOff.snapshot(),beforeDispatch,'Off-won dispatch keeps the already spent submission and reservation unchanged');
  assert.equal(beforeDispatch.gpu_sessions[0].row.state,'submission_started');
  await dispatchOff.assertLockOrder();checks.push('drift-sql-off-wins-dispatch-without-refund-or-forgotten-submission');

  // Conversely, a journal guard already holding the drift row wins this
  // serialization point. Off waits; the admitted reservation remains durable.
  async function operationWins(f,phase,operation){
    const pause={phase,entered:deferred(),resume:deferred()};f.controls.pause=pause;
    const pending=operation();pending.catch(()=>{});let stopping;
    try{
      await bounded(pause.entered.promise);f.controls.offLock=deferred();stopping=f.off();stopping.catch(()=>{});
      await bounded(f.controls.offLock.promise);pause.resume.resolve();
      const [result,stopped]=await bounded(Promise.all([pending,stopping]));assert.equal(stopped.desired.mode,'off');return result;
    }finally{
      pause.resume.resolve();f.controls.pause=null;f.controls.offLock=null;
      await Promise.allSettled([pending,...(stopping?[stopping]:[])]);
    }
  }
  const reserveFirst=await setup('reserve-first'),firstInput=reserveFirst.request();
  const accepted=await operationWins(reserveFirst,'reserve',()=>reserveFirst.journal.reserveMovingSession(firstInput));
  // reserveGpu charges every UTC day its 12-minute window touches: one row, or
  // two after 23:48 UTC. Compare with the days this reservation reported.
  const retained=await reserveFirst.snapshot();assert.ok([1,2].includes(accepted.days.length));
  assert.deepEqual(retained.gpu_reservations.map(({row})=>row.day).sort(),accepted.days);assert.equal(retained.speech_requests.length,1);
  assert.equal(accepted.reservedMicroUsd,250000);
  await assert.rejects(reserveFirst.journal.assertMovingSession({...firstInput,submissionPhase:true}),reject('drift_not_admitting'));
  assert.deepEqual(await reserveFirst.snapshot(),retained);await reserveFirst.assertLockOrder();
  checks.push('drift-sql-reserve-before-off-keeps-exact-reservation-and-rejects-delayed-dispatch');

  const dispatchFirst=await setup('dispatch-first'),firstDispatchInput=dispatchFirst.request();
  await dispatchFirst.startSubmission(firstDispatchInput);
  await operationWins(dispatchFirst,'dispatch',()=>dispatchFirst.journal.assertMovingSession({...firstDispatchInput,submissionPhase:true}));
  const dispatchRetained=await dispatchFirst.snapshot();
  assert.equal(dispatchRetained.gpu_sessions[0].row.state,'submission_started');assert.equal(dispatchRetained.gpu_sessions[0].row.released_at_ms,null);
  await assert.rejects(dispatchFirst.journal.assertMovingSession({...firstDispatchInput,submissionPhase:true}),reject('drift_not_admitting'));
  assert.deepEqual(await dispatchFirst.snapshot(),dispatchRetained);await dispatchFirst.assertLockOrder();
  checks.push('drift-sql-dispatch-linearization-before-off-retains-inflight-ownership');

  const restart=await setup('restart'),oldInput=restart.request(),beforeRestart=await restart.snapshot();
  // Force only the tiny QA execution lease into the past, as the existing
  // drift expiry fixture does. Fresh controller objects use the real DB clock.
  await pool.query(`UPDATE croupier_studio.moving_drift_control SET state=jsonb_set(state,'{execution,leaseUntilMs}',
    to_jsonb(floor(extract(epoch FROM clock_timestamp())*1000)::bigint-1000)) WHERE environment_id=$1`,[restart.scope.environment]);
  const restarted=restart.make();
  await assert.rejects(restarted.authorizeAdmission({revision:oldInput.driftAdmission.revision,profileId:'base'}),reject('drift_not_admitting'));
  const replacement=await restarted.claimExecution({holderId:'drift-sql-restarted',profileId:'base',leaseMs:60000});
  assert.ok(replacement.fence>oldInput.driftAdmission.executionFence);
  const current=await restarted.status();
  await restarted.observe({revision:current.revision,operationId:current.operationId,execution:replacement,observedAtMs:current.serverNowMs,
    observedProfileIds:['base'],workers:[],queuedJobs:0,busyJobs:0,
    applied:{revision:current.revision,operationId:current.operationId,mode:'saving',profileId:'base',workersMin:0,workersMax:1}});
  const newAdmission=await restarted.authorizeAdmission({revision:current.revision,profileId:'base'});
  assert.equal(newAdmission.executionFence,replacement.fence);
  await assert.rejects(restart.journal.reserveMovingSession(oldInput),reject('drift_not_admitting'));
  assert.deepEqual(await restart.snapshot(),beforeRestart,'old execution token cannot reserve after a fresh controller/executor fence');
  const fresh=await restart.journal.reserveMovingSession({...oldInput,driftAdmission:newAdmission});assert.equal(fresh.reservedMicroUsd,250000);
  await restart.assertLockOrder();checks.push('drift-sql-restarted-controller-rejects-old-execution-fence');
  checks.push('drift-sql-studio-drift-speech-lock-order-without-nested-begin-or-deadlock');
  return{pool,checks};
}
