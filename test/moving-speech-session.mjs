import test from 'node:test';
import assert from 'node:assert/strict';
import { createMovingSpeechSession } from '../services/game/moving-speech-session.mjs';
import { createMovingSpeechRunPod, summarizeMovingWorkerHealth } from '../services/game/moving-speech-runpod.mjs';
import { movingCapacityFixture } from './fixtures/moving-capacity.mjs';
import { MOVING_TRIAL_BUDGET } from '../services/game/moving-speech-budget.mjs';

const sha = digit => digit.repeat(64);
const image = `ghcr.io/jakeminator123/moving-gpu-worker@sha256:${sha('a')}`;
const binding = { releaseSha256:sha('b'),dealerId:'dragan',workerAvatar:'dragan',profileRevision:sha('c'),
  sourceSetSha256:sha('d'),avatarSha256:sha('e'),bankReceiptSha256:sha('f') };
const receipt = () => ({ expectedImage:image,endpoint:{id:'endpointfixture',image},observedAtMs:Date.now(),
  workers:{endpointVersion:0,workers:[]} });
function fixture(overrides={}) {
  const events=[],state={state:null,released:false,cost:0,request:null}, callbacks={};
  const journal=Object.fromEntries(['findRequest','getCompletedPackageById','retireExpiredMissingSession',
    'getBudgetPolicy','claimRequest','reserveSession','listRecoverableSessions'].map(key=>[key,async()=>{}]));
  Object.assign(journal,{
    async listMovingSessions(){return overrides.recoverable??[];},
    async acquireLease(){events.push('lease');return{resource:'stream-session',holderId:'fixture',fence:1};},
    async renewLease({lease}){return lease;},async releaseLease(){events.push('release');state.released=true;},
    async reserveMovingSession(input){await overrides.driftGuard?.({phase:'reserve',...input});events.push('reserve');state.cost+=input.reserveMicroUsd;state.state='reserved';
      state.input=input;return{key:sha('1'),workerId:`croupier-${input.sessionId}`,...input};},
    async assertMovingSession(input){await overrides.driftGuard?.({phase:input.submissionPhase?'dispatch':'current',...input});
      if(state.state!=='reserved'&&state.state!=='running'&&!(input.submissionPhase&&state.state==='submission_started'))throw Error('inactive');return{};},
    async markRequestSubmissionStarted(){events.push('request-start');state.request='submission_started';},
    async markSubmissionStarted(input){await overrides.driftGuard?.({phase:'submit',...input});events.push('submit-start');state.state='submission_started';await overrides.onMarkSubmission?.();},
    async attachJob({jobId}){events.push('attach');if(overrides.attachFailure)throw Error('generated_speech_journal_unavailable');state.state='running';state.jobId=jobId;},
    async markSubmissionUncertain(){events.push('unknown');state.state='submission_uncertain';},
    async failRequest(){state.request='submission_uncertain';},
    async requestCancel(){events.push('cancel-intent');},
    async recordProviderStatus({status}){events.push('terminal');state.terminal=status;},
    async confirmWorkerDrained(){assert.ok(state.terminal);events.push('drained');state.released=true;},
    async completeRequest(){events.push('request-complete');state.request='completed';},
  });
  const provider={async submit(input){events.push('provider-submit');state.post=input;return overrides.submit?overrides.submit(input):{id:'accepted-job'};},
    async cancel(){events.push('provider-cancel');},async status(input){events.push('provider-status');return overrides.providerStatus?overrides.providerStatus(input):{status:overrides.status??'COMPLETED'};}};
  const create=createMovingSpeechSession({journal,provider,scope:{environment:'qa_moving',workspaceId:'fixture'},
    origin:'https://fixture.example',endpointId:'endpointfixture',release:async()=>receipt(),budgetId:'same-authorized-run',
    totalBudgetMicroUsd:5000000,reserveMicroUsd:250000,currentDailyBudgetMicroUsd:5000000,
    workerState:async()=>({workers:0,busy:0,available:0}),cleanupMs:30,pollMs:1,
    ...overrides.configuration, connectionFactory:async options=>{
      callbacks.options=options;await options.authorize({phase:'prepare',signal:options.signal});
      let finish;const closed=new Promise(resolve=>{finish=resolve;});let finalization;
      const finalize=reason=>finalization??=(async()=>{const result=await options.finalize({reason});finish(result);return result;})();
      return{callbackUrl:'wss://fixture.example/private',handleUpgrade:()=>true,closed,
        async ready(){events.push('worker-ready');await overrides.onReady?.(options);if(overrides.readyFailure){await finalize('cancelled');throw Error('moving_worker_attestation_mismatch');}
          await options.authorize({phase:'send',signal:options.signal});return{jobId:state.jobId};},
        async dispatch(input,{onChunk}){events.push('dispatch');await options.authorize({phase:'output',signal:options.signal});await onChunk({},Buffer.from([1]),{signal:options.signal});await finalize('complete');return{frames:12};},
        cancel:()=>finalize('cancelled')};
    }});
  const admit=(extra={})=>create.admit({ownerHash:sha('1'),userId:'owner',requestId:'request-1',fingerprint:sha('2'),
    binding,mediaReferences:[{id:'fixture'}],projectRevision:'project-fixture',beforeCostly:async({phase})=>events.push(`guard:${phase}`),...extra});
  return{create,admit,state,events,callbacks};
}

test('durable admission and accepted job precede worker readiness, paid voice and awaited chunk delivery',async()=>{
  const f=fixture(),attempt=await f.admit({bankDownload:async({binding,callbackUrl})=>{
    assert.equal(binding.sessionId,attempt.sessionId);assert.match(callbackUrl,/private/);return{schemaVersion:1};}});
  assert.equal(f.state.cost,250000);assert.equal(f.events.includes('provider-submit'),false);
  assert.match(attempt.sessionId,/^[a-f0-9]{32}$/);assert.notEqual(attempt.binding.nonce,binding.nonce);
  assert.deepEqual(await attempt.submit(),{jobId:'accepted-job',sessionId:attempt.sessionId});
  await attempt.ready(); f.events.push('paid-voice');
  let consumed=false;
  const done=await attempt.dispatch({cancel(){}},{onChunk:async()=>{await Promise.resolve();consumed=true;}});
  assert.equal(done.frames,12);assert.equal(consumed,true);
  assert.ok(f.events.indexOf('reserve')<f.events.indexOf('provider-submit'));
  assert.ok(f.events.indexOf('attach')<f.events.indexOf('worker-ready'));
  assert.ok(f.events.indexOf('worker-ready')<f.events.indexOf('paid-voice'));
  assert.equal(f.state.post.input.ttlSeconds,180);assert.equal(f.state.post.input.binding,attempt.binding);
  assert.equal(f.state.released,true);assert.equal(f.state.request,'completed');assert.equal(f.state.cost,250000);
  assert.equal((await attempt.closed).released,true);
});

test('duplicate submit shares one accepted request and never creates another paid POST',async()=>{
  const f=fixture(),attempt=await f.admit();
  const result=await Promise.all([attempt.submit(),attempt.submit(),attempt.ready()]);
  assert.equal(result[0].jobId,result[1].jobId);assert.equal(f.events.filter(x=>x==='provider-submit').length,1);
  await attempt.cancel();assert.equal(f.events.filter(x=>x==='provider-cancel').length,1);
});

test('lost provider response stays uncertain, pinned and charged; raw provider diagnostics do not escape',async()=>{
  const f=fixture({submit:async()=>{throw Error('private provider diagnostic');}}),attempt=await f.admit();
  await assert.rejects(attempt.ready(),{message:'generated_speech_moving_submission_unknown'});
  await assert.rejects(attempt.submit(),{message:'generated_speech_moving_submission_unknown'});
  assert.equal(f.state.state,'submission_uncertain');assert.equal(f.state.released,false);assert.equal(f.state.cost,250000);
  assert.equal(f.events.filter(x=>x==='provider-submit').length,1);assert.equal(f.events.includes('worker-ready'),false);
  assert.equal((await attempt.closed).released,false);
});

test('lost attach COMMIT cancels the observed exact job but never treats its outcome as released',async()=>{
  const f=fixture({attachFailure:true}),attempt=await f.admit();
  await assert.rejects(attempt.submit(),/journal_unavailable/);
  assert.equal(f.events.includes('provider-cancel'),true);assert.equal(f.state.released,false);
  assert.equal(f.events.includes('worker-ready'),false);assert.equal(f.state.cost,250000);
});

test('wrong worker attestation prevents voice and keeps reservations until provider terminal plus drain',async()=>{
  const f=fixture({readyFailure:true,status:'IN_PROGRESS'}),attempt=await f.admit();let voice=0;
  await assert.rejects((async()=>{await attempt.ready();voice++;})(),/attestation_mismatch/);
  assert.equal(voice,0);assert.equal(f.state.released,false);assert.equal(f.state.cost,250000);
  assert.equal((await attempt.closed).reason,'provider_not_terminal');
});

test('aborted admission performs no provider submit and a later attempt can acquire the factory',async()=>{
  const f=fixture();await assert.rejects(f.admit({signal:AbortSignal.abort()}),/admission_timeout/);
  assert.equal(f.events.includes('reserve'),false);assert.equal(f.events.includes('provider-submit'),false);
  const next=await f.admit();await next.cancel();assert.equal(f.state.released,false);
});

test('Dragan admission forwards its bounded initial grant independently of technical capacity',async()=>{
  const f=fixture({configuration:MOVING_TRIAL_BUDGET}),attempt=await f.admit();
  assert.equal(f.state.input.budgetId,MOVING_TRIAL_BUDGET.budgetId);
  assert.equal(f.state.input.initialBudgetMicroUsd,13200000);
  assert.equal(f.state.input.totalBudgetMicroUsd,150000000);
  assert.equal(f.state.input.reserveMicroUsd,1200000);
  await attempt.cancel();
});

test('configuration bounds technical capacity and retains per-job, daily and moving-window limits',()=>{
  assert.doesNotThrow(()=>fixture({configuration:{totalBudgetMicroUsd:150000000,currentDailyBudgetMicroUsd:60000000}}));
  for(const configuration of [{totalBudgetMicroUsd:150000001},{totalBudgetMicroUsd:150000000,reserveMicroUsd:5000001},
    {initialBudgetMicroUsd:0},{initialBudgetMicroUsd:5000001},{initialBudgetMicroUsd:'13200000'},
    {currentDailyBudgetMicroUsd:60000001},{lifetimeMs:480001},{startupMs:450001},
    {startupMs:0},{startupMs:1001,lifetimeMs:1000},{idleMs:15001}])assert.throws(()=>fixture({configuration}),/configuration/);
});

test('restart recovery uses provider health: cache is drained, outstanding work retains ownership',async()=>{
  const saved={sessionId:'1'.repeat(32),endpointId:'endpointfixture',jobId:'prior-job',workerId:'prior-worker'};
  for(const [workers,jobs,blocked] of [[{},{},false],[{running:1},{},true],[{},{inQueue:1},true],
    [{},{inProgress:1},true],[{running:1},{inProgress:2},true],[{unhealthy:1},{},true]]){
    const health={workers:{idle:1,ready:1,running:0,initializing:0,throttled:0,unhealthy:0,...workers},
      jobs:{completed:1,failed:0,inProgress:0,inQueue:0,retried:0,...jobs}};
    const provider=createMovingSpeechRunPod({endpointId:'endpointfixture',apiKey:'fixture-credential',expectedImage:image,
      fetchImpl:async(url,options)=>{assert.equal(options.method,'GET');assert.ok(url.endsWith('/health'));return Response.json(health);}});
    const f=fixture({recoverable:[saved],configuration:{workerState:provider.workerState}});
    assert.deepEqual(await f.create.reconcile(),blocked
      ? {recovered:[],unresolved:[{sessionId:saved.sessionId,reason:'worker_not_drained'}]}
      : {recovered:[saved.sessionId],unresolved:[]},JSON.stringify(health));
    assert.equal(f.state.released,!blocked);assert.equal(f.events.includes('drained'),!blocked);
    assert.equal(f.events.includes('provider-submit'),false);
  }
});

test('restart recovery cancels only the exact known owned job and requires terminal plus empty worker',async()=>{
  const saved={sessionId:'1'.repeat(32),endpointId:'endpointfixture',jobId:'prior-job',workerId:'prior-worker'};
  const f=fixture({recoverable:[saved]});
  assert.deepEqual(await f.create.reconcile(),{recovered:[saved.sessionId],unresolved:[]});
  assert.equal(f.state.released,true);assert.equal(f.events.includes('provider-submit'),false);
  const unknown=fixture({recoverable:[{...saved,jobId:null}]});
  assert.deepEqual(await unknown.create.reconcile(),{recovered:[],unresolved:[{sessionId:saved.sessionId,reason:'submission_unresolved'}]});
  assert.equal(unknown.events.includes('lease'),false);assert.equal(unknown.state.released,false);
  const running=fixture({recoverable:[saved],status:'IN_PROGRESS'});
  assert.deepEqual(await running.create.reconcile(),{recovered:[],unresolved:[{sessionId:saved.sessionId,reason:'provider_not_terminal'}]});
  assert.equal(running.events.includes('provider-cancel'),true);assert.equal(running.state.released,false);
});


test('296 second cold start retains admitted ownership and keeps worker execution at 180 seconds',async t=>{
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1000000});
  const f=fixture(),attempt=await f.admit();await attempt.submit();
  t.mock.timers.tick(296000);
  assert.equal(f.callbacks.options.signal.aborted,false);
  assert.equal(f.callbacks.options.startupMs,450000);assert.equal(f.callbacks.options.lifetimeMs,480000);
  assert.equal(f.state.post.input.ttlSeconds,180);assert.equal(f.state.cost,250000);
  await attempt.ready();await attempt.cancel();
  assert.equal(f.events.filter(x=>x==='provider-submit').length,1);
});

test('absolute session deadline aborts the bank capability signal even without a callback',async t=>{
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1000000});
  let download;
  const f=fixture(),attempt=await f.admit({bankDownload:async args=>{download=args;return{schemaVersion:1};}});
  await attempt.submit();assert.equal(download.ttlMs,480000);
  t.mock.timers.tick(479999);assert.equal(download.sessionSignal.aborted,false);
  t.mock.timers.tick(1);assert.equal(download.sessionSignal.aborted,true);
  await attempt.cancel();assert.equal(f.events.filter(x=>x==='provider-cancel').length,1);
});


test('cancellation during cold start immediately revokes bank access and retains uncertain cost/ownership',async t=>{
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1000000});
  const abort=new AbortController();let download;
  const f=fixture({status:'UNKNOWN'}),attempt=await f.admit({signal:abort.signal,bankDownload:async args=>{download=args;return{};}});
  await attempt.submit();t.mock.timers.tick(296000);abort.abort();
  assert.equal(download.sessionSignal.aborted,true);await attempt.cancel();
  await assert.rejects(attempt.ready(),/cancelled/);
  assert.equal(f.state.released,false);assert.equal(f.state.cost,250000);
  assert.equal(f.events.filter(x=>x==='provider-cancel').length,1);
  assert.equal(f.events.filter(x=>x==='provider-submit').length,1);
});


test('a delayed submit cannot move provider TTL plus paid idle tail outside the original twelve-minute budget coverage',async t=>{
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1000000});
  const f=fixture(),attempt=await f.admit();t.mock.timers.tick(105001);
  await assert.rejects(attempt.submit(),/submission_expired/);
  assert.equal(f.events.includes('provider-submit'),false);assert.equal(f.events.includes('submit-start'),false);
  assert.equal(f.state.cost,250000);assert.equal(f.state.released,false);
});


test('a slow submission journal write cannot bypass the final budget-window check before POST',async t=>{
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1000000});
  const f=fixture({onMarkSubmission:()=>t.mock.timers.tick(105001)}),attempt=await f.admit();
  await assert.rejects(attempt.submit(),/submission_unknown/);
  assert.equal(f.events.includes('provider-submit'),false);assert.equal(f.state.state,'submission_uncertain');
  assert.equal(f.state.cost,250000);assert.equal(f.state.released,false);
});

test('journal lease precedes capacity reads and a completed job permits the next owned warm job',async()=>{
  let observations=0;
  const f=fixture({configuration:{release:async()=>{
    assert.ok(f.events.includes('lease'));observations++;return movingCapacityFixture().release;
  },workerState:async()=>summarizeMovingWorkerHealth(movingCapacityFixture().health)}});
  for(const requestId of ['warm-one','warm-two']){
    const attempt=await f.admit({requestId});
    assert.equal(f.state.input.movingCapacity.release.capacity.activePods[0].id,'owned-pod');
    // The real worker count remains one. It is never relabelled as drained.
    assert.equal(f.state.input.workerState.workers,1);
    await attempt.dispatch({cancel(){}},{onChunk:async()=>{}});
    assert.equal((await attempt.closed).released,true);
  }
  assert.equal(f.events.filter(x=>x==='provider-submit').length,2);
  assert.equal(f.state.cost,500000);assert.ok(observations>=4);
});

test('changed capacity immediately before POST keeps the reservation pinned and never submits',async()=>{
  for(const changed of ['queue','version','missing-proof']){
    let marked=false;
    const current=()=>{
      const value=movingCapacityFixture();
      if(marked&&changed==='queue')value.health.jobs.inQueue=1;
      if(marked&&changed==='version'){
        value.release.workers.endpointVersion++;
        value.release.workers.workers[0].version++;
      }
      if(marked&&changed==='missing-proof')delete value.release.capacity;
      return value;
    };
    const f=fixture({onMarkSubmission:()=>{marked=true;},configuration:{
      release:async()=>current().release,workerState:async()=>summarizeMovingWorkerHealth(current().health)}});
    const attempt=await f.admit();
    await assert.rejects(attempt.submit(),/submission_unknown/);
    assert.equal(f.events.includes('provider-submit'),false,changed);
    assert.equal(f.state.state,'submission_uncertain');assert.equal(f.state.released,false);
    assert.equal(f.state.cost,250000);
  }
});


function driftFixture(overrides={}) {
  const token=Object.freeze({revision:1,operationId:'drift-one',profileId:'fixture',endpointId:'endpointfixture'});
  const drift={current:token,pins:0,phases:[]};
  let f;
  const guard=async input=>{
    drift.phases.push(input.phase);
    assert.equal(input.driftAdmission,token,'the original admission token must survive every await');
    assert.equal(input.endpointId,'endpointfixture');
    if(drift.current!==token)throw Object.assign(Error('drift_not_admitting'),{code:'drift_not_admitting',statusCode:409});
    await overrides.onDriftGuard?.(input);
  };
  f=fixture({...overrides,driftGuard:guard,configuration:{...overrides.configuration,driftControl:{pin:async({endpointId,signal})=>{
    drift.pins++;f.events.push('drift-pin');assert.equal(endpointId,'endpointfixture');assert.equal(signal.aborted,false);
    if(drift.current!==token)throw Object.assign(Error('drift_not_admitting'),{code:'drift_not_admitting',statusCode:409});
    return token;
  }}}});
  return {...f,drift,token};
}

test('moving drift admission pins once before any lease or provider read and guards dispatch immediately before POST',async()=>{
  const f=driftFixture(),attempt=await f.admit();
  assert.ok(f.events.indexOf('guard:admit')<f.events.indexOf('drift-pin'));
  assert.ok(f.events.indexOf('drift-pin')<f.events.indexOf('lease'));
  await attempt.submit();assert.equal(f.drift.pins,1);
  assert.ok(f.drift.phases.includes('reserve'));assert.ok(f.drift.phases.includes('submit'));assert.ok(f.drift.phases.includes('dispatch'));
  await attempt.cancel();assert.equal(f.state.released,true);assert.equal(f.state.cost,250000);
});

test('moving drift off before admission does not acquire a lease or reserve budget',async()=>{
  const f=driftFixture();f.drift.current=null;
  await assert.rejects(f.admit(),/drift_not_admitting/);
  assert.equal(f.drift.pins,1);assert.equal(f.events.includes('lease'),false);
  assert.equal(f.events.includes('reserve'),false);assert.equal(f.events.includes('provider-submit'),false);assert.equal(f.state.cost,0);
});

test('moving drift token changed during delayed provider release rejects reservation without repinning',async()=>{
  let resume,started;
  const wait=new Promise(resolve=>{resume=resolve;}),entered=new Promise(resolve=>{started=resolve;});
  const f=driftFixture({configuration:{release:async()=>{started();await wait;return receipt();}}});
  const pending=f.admit();await entered;f.drift.current={...f.token,revision:2};resume();
  await assert.rejects(pending,/drift_not_admitting/);
  assert.equal(f.drift.pins,1);assert.equal(f.state.cost,0);assert.equal(f.events.includes('provider-submit'),false);
});

test('moving drift off during bank download blocks the prepared submit and never refreshes its token',async()=>{
  const f=driftFixture(),attempt=await f.admit({bankDownload:async()=>{f.drift.current=null;return{};}});
  await assert.rejects(attempt.submit(),/drift_not_admitting/);
  assert.equal(f.drift.pins,1);assert.equal(f.events.includes('provider-submit'),false);
  assert.equal(f.state.cost,250000);assert.equal((await attempt.closed).released,false);
});

test('moving drift final dispatch guard blocks old tokens for both legacy and verified-capacity paths',async()=>{
  for(const verified of [false,true]){
    let f;
    f=driftFixture({onMarkSubmission:()=>{f.drift.current={...f.token,revision:2};},configuration:verified?{
      release:async()=>movingCapacityFixture().release,
      workerState:async()=>summarizeMovingWorkerHealth(movingCapacityFixture().health)}:{}});
    const attempt=await f.admit();await assert.rejects(attempt.submit(),/submission_unknown/);
    assert.ok(f.drift.phases.includes('dispatch'));assert.equal(f.drift.pins,1);
    assert.equal(f.events.includes('provider-submit'),false);assert.equal(f.state.cost,250000);
    assert.equal(f.state.state,'submission_uncertain');assert.equal((await attempt.closed).released,false);
  }
});

test('moving drift change after POST leaves unknown paid work pinned and never retries or refunds',async()=>{
  let f;
  f=driftFixture({submit:async()=>{f.drift.current=null;throw Error('lost provider reply');}});
  const attempt=await f.admit();await assert.rejects(attempt.submit(),/submission_unknown/);
  await assert.rejects(attempt.submit(),/submission_unknown/);
  assert.equal(f.events.filter(value=>value==='provider-submit').length,1);
  assert.equal(f.drift.pins,1);assert.equal(f.state.cost,250000);assert.equal(f.state.state,'submission_uncertain');
  assert.equal((await attempt.closed).released,false);
});

test('invalid optional moving drift hooks are rejected without changing default configuration',()=>{
  for(const driftControl of [null,{}, {pin:1}])assert.throws(()=>fixture({configuration:{driftControl}}),/configuration/);
  assert.doesNotThrow(()=>fixture());
});


test('SQL-only current admission reuses the started session token without reentering beforeCostly after Off',async()=>{
  for(const changed of [null,{revision:2}]){
    const f=driftFixture(),attempt=await f.admit();await attempt.submit();
    const costly=f.events.filter(value=>value.startsWith('guard:')).length;
    await attempt.assertCurrent();
    assert.equal(f.events.filter(value=>value.startsWith('guard:')).length,costly,'SQL-only assertion must not recurse into runtime.current');
    f.drift.current=changed;
    await assert.rejects(attempt.assertCurrent(),/drift_not_admitting/);
    assert.equal(f.events.filter(value=>value.startsWith('guard:')).length,costly);
    assert.equal(f.drift.pins,1);assert.equal(f.events.filter(value=>value==='provider-submit').length,1);
    assert.equal(f.state.cost,250000);await attempt.cancel();
    await assert.rejects(attempt.assertCurrent(),{name:'AbortError'});
  }
});


test('prepared Saving1 admission survives voice wait through Off2 and Saving3 without silently repinning',async()=>{
  const f=driftFixture(),early=f.token;
  f.drift.current={...early,revision:3,operationId:'saving-three'};
  await assert.rejects(f.admit({driftAdmission:early}),/drift_not_admitting/);
  assert.equal(f.drift.pins,0);assert.equal(f.state.cost,0);
  assert.equal(f.events.includes('reserve'),false);assert.equal(f.events.includes('provider-submit'),false);
});

test('explicit null prepared admission fails closed without repinning or leasing',async()=>{
  const f=driftFixture();
  await assert.rejects(f.admit({driftAdmission:null}),/invalid_generated_speech_moving_admission/);
  assert.equal(f.drift.pins,0);assert.equal(f.events.includes('lease'),false);assert.equal(f.state.cost,0);
});

test('a mutable prepared admission is copied once so caller mutation cannot refresh a prepared attempt',async()=>{
  const early={revision:1,operationId:'saving-one',profileId:'fixture',endpointId:'endpointfixture'},original={...early};
  const tokens=[];
  const f=fixture({driftGuard:input=>{
    assert.ok(Object.isFrozen(input.driftAdmission));assert.deepEqual(input.driftAdmission,original);tokens.push(input.driftAdmission);
  },configuration:{driftControl:{pin:()=>assert.fail('prepared admission must never repin')}}});
  const attempt=await f.admit({driftAdmission:early,bankDownload:async()=>{early.revision=3;return{};}});
  await attempt.submit();
  assert.notEqual(tokens[0],early);assert.ok(tokens.every(token=>token===tokens[0]));
  await attempt.cancel();
});


test('private bank authorization accepts submission_started before attach with the original token while normal output and Off fail closed',async()=>{
  let resume,entered;
  const waiting=new Promise(resolve=>{resume=resolve;}),posted=new Promise(resolve=>{entered=resolve;});
  const f=driftFixture({submit:async()=>{entered();await waiting;return{id:'accepted-job'};}}),attempt=await f.admit();
  const submitting=attempt.submit();submitting.catch(()=>{});
  try{
    await posted;assert.equal(f.state.state,'submission_started');assert.equal(f.state.jobId,undefined);
    await assert.rejects(attempt.assertCurrent(),/inactive/);
    const costly=f.events.filter(value=>value.startsWith('guard:')).length;
    await attempt.assertCurrent({submissionPhase:true});
    assert.equal(f.events.filter(value=>value.startsWith('guard:')).length,costly);
    f.drift.current=null;
    await assert.rejects(attempt.assertCurrent({submissionPhase:true}),/drift_not_admitting/);
    assert.equal(f.drift.pins,1);assert.equal(f.events.filter(value=>value==='provider-submit').length,1);
    assert.equal(f.state.cost,250000);assert.equal(f.state.released,false);
  }finally{resume();await submitting;await attempt.cancel();}
});

test('SQL-only current admission requires an explicit boolean submissionPhase',async()=>{
  const f=driftFixture(),attempt=await f.admit();
  for(const submissionPhase of [null,1,'true',{}]){
    await assert.rejects(attempt.assertCurrent({submissionPhase}),{code:'invalid_generated_speech_journal_input',statusCode:422});
  }
  assert.equal(f.drift.pins,1);assert.equal(f.events.includes('provider-submit'),false);await attempt.cancel();
});


test('a terminal provider job before callback rejects preparation promptly without retrying or refunding',async t=>{
  for(const status of ['FAILED','CANCELLED','TIMED_OUT','COMPLETED'])await t.test(status,async()=>{
    const f=fixture({status,onReady:({signal})=>new Promise((resolve,reject)=>{
      if(signal.aborted)reject(signal.reason);
      else signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
    })});
    const attempt=await f.admit();
    try{
      const outcome=await Promise.race([
        attempt.ready().then(()=>({ready:true}),error=>({error})),
        new Promise(resolve=>setTimeout(()=>resolve({pending:true}),150)),
      ]);
      assert.equal(outcome.error?.code,'moving_worker_closed');
      assert.equal(f.events.filter(event=>event==='provider-submit').length,1);
      assert.equal(f.state.cost,250000);
      assert.equal((await attempt.closed).released,true);
      assert.equal(f.state.terminal,status);
      assert.ok(f.events.indexOf('terminal')<f.events.indexOf('drained'));
    }finally{await attempt.cancel();}
  });
});

test('a pending live job can attest normally and terminal monitoring stops after readiness',async()=>{
  let releaseReady,observed,status='IN_PROGRESS';
  const firstStatus=new Promise(resolve=>observed=resolve);
  const f=fixture({onReady:()=>new Promise(resolve=>releaseReady=resolve),
    providerStatus:async()=>{observed();return{status};}});
  const attempt=await f.admit();
  try{
    const waiting=attempt.ready();waiting.catch(()=>{});
    await Promise.race([firstStatus,new Promise((_,reject)=>setTimeout(()=>reject(Error('provider not monitored')),150))]);
    assert.equal(f.state.released,false);assert.equal(f.state.cost,250000);
    releaseReady();assert.equal((await waiting).jobId,'accepted-job');
    const reads=f.events.filter(event=>event==='provider-status').length;
    await new Promise(resolve=>setTimeout(resolve,10));
    assert.equal(f.events.filter(event=>event==='provider-status').length,reads);
    assert.equal(f.state.released,false);
  }finally{status='COMPLETED';releaseReady?.();await attempt.cancel();}
});


test('unknown provider observations cannot hide the callback startup failure or refund ownership',async()=>{
  const f=fixture({providerStatus:async()=>{throw Error('private provider diagnostic');},
    onReady:()=>new Promise((_,reject)=>setTimeout(()=>reject(Object.assign(Error('moving_worker_startup_timeout'),{code:'moving_worker_startup_timeout'})),15))});
  const attempt=await f.admit();
  await assert.rejects(attempt.ready(),{code:'moving_worker_startup_timeout'});
  assert.equal(f.state.released,false);assert.equal(f.state.cost,250000);
  assert.equal((await attempt.closed).reason,'provider_status_unknown');
  assert.equal(f.events.filter(event=>event==='provider-submit').length,1);
});

test('user abort during an in-flight status read preserves cancellation and ignores a late terminal reply',async()=>{
  const abort=new AbortController();let observed,late,reads=0;
  const statusStarted=new Promise(resolve=>observed=resolve);
  const statusReply=new Promise(resolve=>late=resolve);
  const f=fixture({onReady:({signal})=>new Promise((_,reject)=>{
    signal.addEventListener('abort',()=>reject(Object.assign(Error('generated_speech_cancelled'),{code:'generated_speech_cancelled'})),{once:true});
  }),providerStatus:async()=>{
    if(++reads===1){observed();await statusReply;return{status:'COMPLETED'};}
    return{status:'UNKNOWN'};
  }});
  const attempt=await f.admit({signal:abort.signal});
  const waiting=attempt.ready();waiting.catch(()=>{});
  try{
    await Promise.race([statusStarted,new Promise((_,reject)=>setTimeout(()=>reject(Error('status read not started')),150))]);
    abort.abort();
    await assert.rejects(waiting,{code:'generated_speech_cancelled'});
    assert.equal((await attempt.closed).released,false);
    const stoppedReads=reads;
    late();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(reads,stoppedReads);assert.equal(f.state.released,false);
    assert.equal(f.state.cost,250000);assert.equal(f.events.includes('terminal'),false);
    assert.equal(f.events.filter(event=>event==='provider-submit').length,1);
  }finally{late();await attempt.cancel();}
});