import test from 'node:test';
import assert from 'node:assert/strict';
import {createMovingDriftController} from '../services/game/moving-drift-controller.mjs';
import {createMovingDriftExecutor} from '../services/game/moving-drift-executor.mjs';
import {createMovingDriftObserver} from '../services/game/moving-drift-observer.mjs';
import {summarizeMovingWorkerHealth} from '../services/game/moving-speech-runpod.mjs';
import {movingCapacityFixture} from './fixtures/moving-capacity.mjs';

const profile={id:'base',label:'Bas',dealerId:'dragan',endpointId:'endpoint-base',releaseDigest:'a'.repeat(64),bankHash:'b'.repeat(64)};
function fixture(executorOptions={}){
  let time=1800000000000,row=null,queue=Promise.resolve(),reads=0,cancels=0;
  const store={transact(fn){const task=queue.then(()=>{const result=fn(structuredClone(row),time);row=structuredClone(result.state);return structuredClone(result.value);});queue=task.catch(()=>{});return task;}};
  const make=()=>createMovingDriftController({store,profiles:[profile],capabilities:{connected:true,requireExecutor:true}});
  const controller=make();
  let snapshot={workers:[],busyJobs:0,queuedJobs:0,workersMin:0,workersMax:1};
  let unresolved=[];
  const observer={async observe(){reads++;return {observedAtMs:time,...structuredClone(snapshot)};}};
  const sessions={async reconcile(){return {recovered:[],unresolved};}};
  const executor=createMovingDriftExecutor({controller,profile,observer,sessions,holderId:'server-a',
    cancelActive:async()=>{cancels++;},readOpenSessions:async()=>unresolved,now:()=>time,...executorOptions});
  return {controller,make,executor,observer,sessions,advance:ms=>time+=ms,
    snapshot:value=>snapshot=value,unresolved:value=>unresolved=value,
    counts:()=>({reads,cancels}),row:()=>structuredClone(row)};
}
const saving=(status)=>({expectedRevision:status.revision,commandId:'save-'+status.revision,mode:'saving',profileId:'base'});
const off=(status)=>({expectedRevision:status.revision,commandId:'off-'+status.revision,mode:'off'});
const rejects=code=>error=>error.code===code;

test('construction is inert and Saving is unavailable until fresh executor readback',async()=>{
  const f=fixture();assert.deepEqual(f.counts(),{reads:0,cancels:0});
  let status=await f.controller.status();
  assert.equal(status.capabilities.connected,false);
  await assert.rejects(f.controller.command(saving(status)),rejects('drift_runtime_unavailable'));
  status=await f.executor.tick();
  assert.equal(status.observed.status,'off');assert.equal(status.capabilities.connected,true);
  assert.deepEqual(status.capabilities.allowedModes,['off','saving']);
  status=await f.controller.command(saving(status));assert.equal(status.admission.allowed,false);
  status=await f.executor.tick();assert.equal(status.admission.allowed,true);
  await assert.rejects(f.controller.command({...saving(status),mode:'warm',durationSeconds:1800}),rejects('drift_warm_unavailable'));
});

test('pinned admission is fenced atomically when Off commits, even across a new controller',async()=>{
  const f=fixture();await f.executor.tick();let status=await f.controller.status();
  await f.controller.command(saving(status));status=await f.executor.tick();
  const admission=await f.controller.authorizeAdmission({revision:status.revision,profileId:'base'});
  const input={sessionId:'session-1',endpointId:profile.endpointId,admission};
  await f.controller.guardAdmission({...input,phase:'reserve'});
  await f.controller.guardAdmission({...input,phase:'submit'});
  status=await f.make().command(off(status));
  for(const phase of ['reserve','current','submit','dispatch']) {
    await assert.rejects(f.controller.guardAdmission({...input,phase}),rejects('drift_not_admitting'));
  }
  assert.equal(status.admission.allowed,false);
});

test('heartbeat expiry and takeover fence stale dispatch and stale observations',async()=>{
  const f=fixture();await f.executor.tick();await f.controller.command(saving(await f.controller.status()));
  let status=await f.executor.tick();
  const admission=await f.controller.authorizeAdmission({revision:status.revision,profileId:'base'});
  const oldLease=await f.controller.claimExecution({holderId:'server-a',profileId:'base',leaseMs:60000});
  f.advance(15001);
  assert.equal((await f.make().status()).capabilities.connected,false);
  await assert.rejects(f.controller.guardAdmission({phase:'dispatch',sessionId:'session-1',endpointId:profile.endpointId,admission}),rejects('drift_not_admitting'));
  f.advance(45000);
  const next=await f.controller.claimExecution({holderId:'server-b',profileId:'base',leaseMs:60000});
  assert.ok(next.fence>oldLease.fence);
  await assert.rejects(f.controller.observe({revision:status.revision,operationId:status.operationId,execution:oldLease}),rejects('drift_executor_stale'));
  await assert.rejects(f.controller.guardAdmission({phase:'dispatch',sessionId:'session-1',endpointId:profile.endpointId,admission}),rejects('drift_not_admitting'));
});

test('Off remains stopping for unresolved journal entries or active GPU and unknown runtime readiness is never fabricated',async()=>{
  const f=fixture();let status=await f.executor.tick();
  await f.controller.command(saving(status));await f.executor.tick();
  status=await f.controller.command(off(await f.controller.status()));
  f.unresolved([{sessionId:'uncertain-post'}]);
  status=await f.executor.tick();assert.equal(status.observed.status,'stopping');
  f.unresolved([]);
  f.snapshot({workers:[{id:'pod-1',profileId:'base',state:'running',gpu:'',releaseDigest:null,bankHash:null,modelReady:false}],
    busyJobs:0,queuedJobs:0,workersMin:0,workersMax:1});
  status=await f.executor.tick();assert.equal(status.observed.status,'stopping');
  assert.deepEqual(status.readiness,{modelReady:false,releaseMatches:false,bankMatches:false});
  f.snapshot({workers:[],busyJobs:0,queuedJobs:0,workersMin:0,workersMax:1});
  status=await f.executor.tick();assert.equal(status.observed.status,'off');
  assert.ok(f.counts().cancels>=3);
});

test('Off revocation survives a quick Saving command before the next executor tick',async()=>{
  const f=fixture();await f.executor.tick();await f.controller.command(saving(await f.controller.status()));
  let status=await f.executor.tick();
  await f.controller.command(off(status));
  status=await f.controller.command(saving(await f.controller.status()));
  assert.equal(status.admission.allowed,false);
  const before=f.counts().cancels;
  f.unresolved([{sessionId:'old-owned-job'}]);
  status=await f.executor.tick();
  assert.equal(f.counts().cancels,before+1);assert.equal(status.observed.status,'stopping');
  assert.equal(status.admission.allowed,false);
  f.unresolved([]);
  status=await f.executor.tick();assert.equal(status.admission.allowed,true);
});

test('a late provider read cannot attest a newer command; provider errors do not produce Off',async()=>{
  const f=fixture();await f.executor.tick();await f.controller.command(saving(await f.controller.status()));
  await f.executor.tick();
  let release,entered;
  const ready=new Promise(resolve=>entered=resolve);
  const slow=createMovingDriftExecutor({controller:f.controller,profile,sessions:f.sessions,holderId:'server-a',
    observer:{async observe(){entered();return await new Promise(resolve=>release=resolve);}},
    cancelActive:async()=>{},readOpenSessions:async()=>[]});
  const pending=slow.tick();await ready;
  const stopped=await f.controller.command(off(await f.controller.status()));
  release({observedAtMs:stopped.serverNowMs,workers:[],busyJobs:0,queuedJobs:0,workersMin:0,workersMax:1});
  await assert.rejects(pending,rejects('drift_revision_conflict'));
  assert.equal((await f.controller.status()).observed.status,'stopping');
  f.observer.observe=async()=>{throw Error('network down');};
  await assert.rejects(f.executor.tick(),/network down/);
  assert.notEqual((await f.controller.status()).observed.status,'off');
});

test('a failed new provider read immediately invalidates even a previously stopped receipt',async()=>{
  const f=fixture();assert.equal((await f.executor.tick()).observed.status,'off');
  f.observer.observe=async()=>{throw Error('network down');};
  await assert.rejects(f.executor.tick(),/network down/);
  const status=await f.controller.status();
  assert.equal(status.observed.status,'unknown');assert.equal(status.capabilities.connected,false);
});

test('a checked cold Saving may start without claiming an already warm bank; mismatch still blocks',async()=>{
  const f=fixture();await f.executor.tick();await f.controller.command(saving(await f.controller.status()));
  f.snapshot({workers:[{id:'pod-1',profileId:'base',state:'running',gpu:'',releaseDigest:null,bankHash:null,modelReady:false}],
    busyJobs:0,queuedJobs:0,workersMin:0,workersMax:1});
  let status=await f.executor.tick();assert.equal(status.admission.allowed,true);
  assert.equal(status.observed.status,'loading');assert.equal(status.readiness.bankMatches,false);
  assert.equal(status.actual.gpu,null);
  f.snapshot({workers:[{id:'pod-1',profileId:'base',state:'running',gpu:'',releaseDigest:'f'.repeat(64),bankHash:null,modelReady:false}],
    busyJobs:0,queuedJobs:0,workersMin:0,workersMax:1});
  status=await f.executor.tick();assert.equal(status.admission.allowed,false);assert.equal(status.observed.reasonCode,'drift_release_mismatch');
});

test('runtime factory binds one verified profile and injects a separate journal with a same-client SQL guard',async()=>{
  const {createMovingDriftRuntime}=await import('../services/game/moving-drift-executor.mjs');
  const f=fixture(),seen={provider:0,client:0},client={query(){throw Error('no network');}};
  let journalOptions,sessionOptions;
  const journal={listMovingSessions:async()=>[]};
  const configuration={profiles:[profile]},scope={environment:'isolated-drift',workspaceId:'qa'};
  const options={pool:{},scope,configuration,dealerId:'dragan',endpointId:profile.endpointId,releaseDigest:profile.releaseDigest,bankHash:profile.bankHash,
    provider:{release(){seen.provider++;},workerState(){seen.provider++;}},
    journalFactory:async args=>{journalOptions=args;return journal;},
    sessionFactory:args=>{sessionOptions=args;return f.sessions;},
    observerFactory:()=>f.observer,
    storeFactory:args=>({transact:work=>args.transaction
      ?args.transaction(c=>{assert.equal(c,client);seen.client++;return f.controllerStore.transact(work);})
      :f.controllerStore.transact(work)})};
  // Use the exact store owned by both the status and transaction-bound controller.
  let row=null;
  f.controllerStore={transact(work){const next=work(structuredClone(row),1800000000000);row=structuredClone(next.state);return Promise.resolve(next.value);}};
  const runtime=await createMovingDriftRuntime(options);
  assert.equal(seen.provider,0);assert.equal(sessionOptions.journal,journal);
  assert.deepEqual(journalOptions.driftControl.scope,scope);
  assert.equal(typeof journalOptions.driftControl.onRejection,'function');
  await assert.rejects(sessionOptions.driftControl.pin({endpointId:profile.endpointId}),rejects('drift_not_admitting'));
  await runtime.tick();
  let status=await runtime.controller.command(saving(await runtime.controller.status()));
  await runtime.tick();
  const admission=await sessionOptions.driftControl.pin({endpointId:profile.endpointId});
  await journalOptions.driftControl.guard({client,phase:'reserve',sessionId:'session-1',endpointId:profile.endpointId,admission});
  assert.equal(seen.client,1);
  await runtime.controller.command(off(status));
  await assert.rejects(journalOptions.driftControl.guard({client,phase:'dispatch',sessionId:'session-1',endpointId:profile.endpointId,admission}),rejects('drift_not_admitting'));
  for(const change of [{configuration:null},{configuration:{profiles:[profile,{...profile,id:'comparison'}]}},
    {dealerId:'paow'},{dealerId:undefined},{configuration:{profiles:[{...profile,dealerId:'paow'}]}},
    {endpointId:'other'},{releaseDigest:'f'.repeat(64)},{bankHash:'f'.repeat(64)}]){
    await assert.rejects(createMovingDriftRuntime({...options,...change}),rejects('drift_invalid_configuration'));
  }
  await runtime.close();assert.equal(seen.provider,0);
});

test('a second dealer gets its own profile, row slot and endpoint, and only its own open sessions keep it busy',async()=>{
  const {createMovingDriftRuntime}=await import('../services/game/moving-drift-executor.mjs');
  const paow={...profile,id:'paow',label:'Paow',dealerId:'paow',endpointId:'endpoint-paow',bankHash:'c'.repeat(64)};
  const configuration={profiles:[profile,paow]},scope={environment:'isolated-drift',workspaceId:'qa'};
  const open=[{sessionId:'dragan-session',endpointId:profile.endpointId},{sessionId:'paow-session',endpointId:paow.endpointId},
    {sessionId:'stale-session',endpointId:'endpoint-retired'}];
  const built=[];
  for(const dealer of [profile,paow]){
    const f=fixture(),seen={};
    const runtime=await createMovingDriftRuntime({pool:{},scope,configuration,dealerId:dealer.dealerId,endpointId:dealer.endpointId,
      releaseDigest:dealer.releaseDigest,bankHash:dealer.bankHash,provider:{release(){},workerState(){}},
      journalFactory:async()=>({listMovingSessions:async()=>open}),
      sessionFactory:args=>{seen.sessions=args;return f.sessions;},
      observerFactory:args=>{seen.observer=args;return f.observer;},
      storeFactory:args=>{(seen.stores??=[]).push(args.dealerId);return {transact:work=>Promise.resolve().then(()=>{
        const next=work(structuredClone(seen.row??null),1800000000000);seen.row=structuredClone(next.state);return next.value;})};}});
    built.push({dealer,runtime,seen,f});
  }
  for(const {dealer,runtime,seen} of built){
    assert.deepEqual(seen.stores,[dealer.dealerId]);
    assert.equal(seen.observer.profile,dealer);assert.equal(seen.sessions.endpointId,dealer.endpointId);
    // Recovery skips only the other configured dealer's endpoint, never its own or a retired one.
    assert.deepEqual(seen.sessions.foreignEndpointIds,[dealer===profile?paow.endpointId:profile.endpointId]);
    const status=await runtime.tick();
    assert.deepEqual(status.profiles,[{id:dealer.id,label:dealer.label}]);
    // Own and retired-endpoint sessions count; the other dealer's session never does.
    assert.equal(seen.row.observation.busyJobs,2);
    await runtime.close();
  }
});

test('connected expires with the provider observation even when the SQL heartbeat is newer',async()=>{
  const f=fixture(),initial=await f.executor.tick();
  f.advance(14000);
  f.snapshot({observedAtMs:initial.serverNowMs,workers:[],busyJobs:0,queuedJobs:0,workersMin:0,workersMax:1});
  assert.equal((await f.executor.tick()).capabilities.connected,true);
  f.advance(1001);
  const status=await f.controller.status();
  assert.equal(status.capabilities.connected,false);assert.equal(status.observed.status,'unknown');
});


test('corroborated cache initialization cannot revoke a pinned running session while new admission stays blocked',async()=>{
  const time=1800000000000,p={...profile,endpointId:'endpointfixture'};let row=null,open=[];
  const store={async transact(work){const result=work(structuredClone(row),time);row=structuredClone(result.state);return structuredClone(result.value);}};
  const controller=createMovingDriftController({store,profiles:[p],capabilities:{connected:true,requireExecutor:true}});
  let proof=movingCapacityFixture({warm:false,now:time});
  const observer=createMovingDriftObserver({profile:p,now:()=>time,provider:{
    release:async()=>structuredClone(proof.release),workerState:async()=>summarizeMovingWorkerHealth(proof.health)}});
  const executor=createMovingDriftExecutor({controller,profile:p,observer,holderId:'owned-server',
    sessions:{reconcile:async()=>({recovered:[],unresolved:[]})},cancelActive:async()=>{},readOpenSessions:async()=>open});
  await executor.tick();await controller.command(saving(await controller.status()));
  let status=await executor.tick();
  const admission=await controller.authorizeAdmission({revision:status.revision,profileId:p.id});
  const owned={sessionId:'owned-session',endpointId:p.endpointId,admission};
  await controller.guardAdmission({...owned,phase:'reserve'});
  await controller.guardAdmission({...owned,phase:'dispatch'});
  open=[{sessionId:owned.sessionId}];
  proof=movingCapacityFixture({warm:true,now:time});proof.health.jobs.inProgress=1;
  proof.health.workers.initializing=1;
  proof.release.workers.workers.push({state:'scaled-down',image:proof.release.expectedImage,version:3,isStale:false});
  status=await executor.tick();
  assert.equal(status.capabilities.connected,true);assert.equal(status.observed.status,'loading');
  assert.equal(status.admission.allowed,false);
  await assert.rejects(controller.authorizeAdmission({revision:status.revision,profileId:p.id}),rejects('drift_not_admitting'));
  await assert.rejects(controller.guardAdmission({...owned,phase:'reserve'}),rejects('drift_not_admitting'));
  await controller.guardAdmission({...owned,phase:'current'});
  await controller.guardAdmission({...owned,phase:'dispatch'});
  await controller.command(off(status));
  for(const phase of ['current','dispatch'])await assert.rejects(controller.guardAdmission({...owned,phase}),rejects('drift_not_admitting'));
  await executor.close();
});


test('readback diagnostics validate optional dependencies and stay silent for fast success',async()=>{
  const events=[],f=fixture({onReadback:event=>events.push(event)});
  await f.executor.tick();
  assert.deepEqual(events,[]);
  for(const change of [{now:0},{onReadback:null}]){
    assert.throws(()=>fixture(change),rejects('drift_invalid_configuration'));
  }
});

test('readback failures report the first failing finite phase and elapsed class without raw errors',async t=>{
  for(const phase of ['claim','configuration','cancel','reconcile','provider_observation','session_read','controller_observe']){
    await t.test(phase,async()=>{
      let time=1800000000000,invalidations=0;
      const events=[],error=Object.assign(Error('private provider text'),{token:'private-token'});
      const fail=()=>{time+=8000;throw error;};
      const execution={desired:{mode:phase==='configuration'?'warm':['cancel','reconcile'].includes(phase)?'off':'saving',profileId:'base'}};
      const controller={claimExecution:phase==='claim'?fail:async()=>execution,status:async()=>{},
        observe:phase==='controller_observe'?fail:async()=>({ok:true}),invalidateExecution:async()=>{invalidations++;}};
      const executor=createMovingDriftExecutor({controller,profile,holderId:'diagnostic-server',now:()=>time,
        observer:{observe:phase==='provider_observation'?fail:async()=>({workers:[],busyJobs:0,queuedJobs:0,workersMin:0,workersMax:1})},
        sessions:{reconcile:phase==='reconcile'?fail:async()=>{}},cancelActive:phase==='cancel'?fail:async()=>{},
        readOpenSessions:phase==='session_read'?fail:async()=>[],onReadback:event=>events.push(event)});
      await assert.rejects(executor.tick(),phase==='configuration'?rejects('drift_profile_unavailable'):value=>value===error);
      assert.deepEqual(events,[{phase,result:'failure',durationClass:phase==='configuration'?'fast':'slow'}]);
      assert.equal(invalidations,phase==='claim'?0:1);
      await executor.close();
    });
  }
});

test('throwing or rejecting readback hooks and broken diagnostic clocks cannot affect tick security outcomes',async()=>{
  for(const hook of [()=>{throw Error('diagnostic failure');},()=>Promise.reject(Error('diagnostic failure'))]){
    const f=fixture({onReadback:hook});
    await f.executor.tick();await f.controller.command(saving(await f.controller.status()));
    f.observer.observe=async()=>{f.advance(8000);return {observedAtMs:f.row().execution.observedAtMs+8000,workers:[],busyJobs:0,queuedJobs:0,workersMin:0,workersMax:1};};
    assert.equal((await f.executor.tick()).admission.allowed,true);
    const error=Error('provider failed');
    f.observer.observe=async()=>{throw error;};
    await assert.rejects(f.executor.tick(),value=>value===error);
    assert.equal((await f.controller.status()).capabilities.connected,false);
    await f.executor.close();
  }
  const events=[],f=fixture({now:()=>{throw Error('clock failed');},onReadback:event=>events.push(event)});
  await f.executor.tick();assert.deepEqual(events,[]);
  f.observer.observe=async()=>{throw Error('provider failed');};
  await assert.rejects(f.executor.tick(),/provider failed/);
  assert.deepEqual(events,[{phase:'provider_observation',result:'failure',durationClass:'invalid'}]);
  assert.equal((await f.controller.status()).capabilities.connected,false);
});

test('a successful 14-second provider read after the 2-second interval reports slow while the previous evidence expires',async()=>{
  let time=1800000000000,row=null,releaseRead=null;
  const p={...profile,endpointId:'endpointfixture'},events=[];
  const store={async transact(work){const result=work(structuredClone(row),time);row=structuredClone(result.state);return structuredClone(result.value);}};
  const controller=createMovingDriftController({store,profiles:[p],capabilities:{connected:true,requireExecutor:true}});
  const observer=createMovingDriftObserver({profile:p,now:()=>time,provider:{
    release:async()=>releaseRead?releaseRead():movingCapacityFixture({warm:false,now:time}).release,
    workerState:async()=>summarizeMovingWorkerHealth(movingCapacityFixture({warm:false,now:time}).health)}});
  const executor=createMovingDriftExecutor({controller,profile:p,observer,holderId:'owned-server',now:()=>time,
    sessions:{reconcile:async()=>{}},cancelActive:async()=>{},readOpenSessions:async()=>[],
    onReadback:event=>events.push(event)});
  await executor.tick();await controller.command(saving(await controller.status()));
  const status=await executor.tick();
  const admission=await controller.authorizeAdmission({revision:status.revision,profileId:p.id});
  const pinned={phase:'dispatch',sessionId:'owned-session',endpointId:p.endpointId,admission};
  await controller.guardAdmission(pinned);
  time+=2000;
  let finish,entered;
  const started=new Promise(resolve=>entered=resolve);
  releaseRead=()=>{entered();return new Promise(resolve=>finish=()=>resolve(movingCapacityFixture({warm:false,now:time}).release));};
  const pending=executor.tick();await started;
  assert.equal(executor.tick(),pending);
  time+=14000;
  assert.ok(row.execution.leaseUntilMs>time,'the executor lease remains valid');
  assert.equal(time-row.observation.observedAtMs,16000);
  assert.equal(row.observation!==null,true,'no failed read invalidated the prior observation');
  await assert.rejects(controller.guardAdmission(pinned),rejects('drift_not_admitting'));
  assert.deepEqual(events,[]);
  finish();
  assert.equal((await pending).capabilities.connected,true);
  assert.deepEqual(events,[{phase:'controller_observe',result:'success',durationClass:'slow'}]);
  await controller.guardAdmission(pinned);
  await executor.close();
});

test('failure telemetry is captured before cleanup but emitted only after the invalidation attempt',async()=>{
  for(const invalidationFails of [false,true]){
    let time=1000;const order=[],error=Error('private provider failure'),events=[];
    const controller={status:async()=>({}),claimExecution:async()=>({desired:{mode:'saving',profileId:'base'}}),observe:async()=>assert.fail('failed read cannot publish'),
      invalidateExecution:async()=>{await Promise.resolve();order.push('invalidate');time+=20000;if(invalidationFails)throw Error('private rollback failure');}};
    const executor=createMovingDriftExecutor({controller,profile,holderId:'owned-server',now:()=>time,
      observer:{observe:async()=>{time+=8000;throw error;}},sessions:{reconcile:async()=>{}},cancelActive:async()=>{},readOpenSessions:async()=>[],
      onReadback:event=>{order.push('report');events.push(event);}});
    await assert.rejects(executor.tick(),value=>value===error);
    assert.deepEqual(order,['invalidate','report']);
    assert.deepEqual(events,[{phase:'provider_observation',result:'failure',durationClass:'slow'}]);
    await executor.close();
  }
});
