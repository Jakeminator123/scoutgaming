import test from 'node:test';
import assert from 'node:assert/strict';
import {createMovingDriftController} from '../services/game/moving-drift-controller.mjs';
import {createMovingDriftExecutor} from '../services/game/moving-drift-executor.mjs';

const profile={id:'base',label:'Bas',endpointId:'endpoint-base',releaseDigest:'a'.repeat(64),bankHash:'b'.repeat(64)};
function fixture(){
  let time=1800000000000,row=null,queue=Promise.resolve(),reads=0,cancels=0;
  const store={transact(fn){const task=queue.then(()=>{const result=fn(structuredClone(row),time);row=structuredClone(result.state);return structuredClone(result.value);});queue=task.catch(()=>{});return task;}};
  const make=()=>createMovingDriftController({store,profiles:[profile],capabilities:{connected:true,requireExecutor:true}});
  const controller=make();
  let snapshot={workers:[],busyJobs:0,queuedJobs:0,workersMin:0,workersMax:1};
  let unresolved=[];
  const observer={async observe(){reads++;return {observedAtMs:time,...structuredClone(snapshot)};}};
  const sessions={async reconcile(){return {recovered:[],unresolved};}};
  const executor=createMovingDriftExecutor({controller,profile,observer,sessions,holderId:'server-a',
    cancelActive:async()=>{cancels++;},readOpenSessions:async()=>unresolved});
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
  const options={pool:{},scope,configuration,endpointId:profile.endpointId,releaseDigest:profile.releaseDigest,bankHash:profile.bankHash,
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
    {endpointId:'other'},{releaseDigest:'f'.repeat(64)},{bankHash:'f'.repeat(64)}]){
    await assert.rejects(createMovingDriftRuntime({...options,...change}),rejects('drift_invalid_configuration'));
  }
  await runtime.close();assert.equal(seen.provider,0);
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
