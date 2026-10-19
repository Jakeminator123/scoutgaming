import test from 'node:test';
import assert from 'node:assert/strict';
import {createMovingDriftObserver} from '../services/game/moving-drift-observer.mjs';
import {createMovingDriftController} from '../services/game/moving-drift-controller.mjs';
import {createMovingSpeechRunPod,summarizeMovingWorkerHealth} from '../services/game/moving-speech-runpod.mjs';
import {movingCapacityFixture} from './fixtures/moving-capacity.mjs';
import {verifyMovingCapacity} from '../services/game/moving-speech-capacity.mjs';

const stamp=100000;
const profile={id:'base',endpointId:'endpointfixture',releaseDigest:'d'.repeat(64),bankHash:'e'.repeat(64)};
const rejects=error=>error.code==='drift_observation_unverified';
function fixture({warm=false}={}) {
  const proof=movingCapacityFixture({warm,now:stamp}),calls=[];
  const provider={async release(){calls.push('release');return structuredClone(proof.release);},
    async workerState(){calls.push('health');return summarizeMovingWorkerHealth(structuredClone(proof.health));}};
  const observer=createMovingDriftObserver({profile,provider,now:()=>stamp});
  return {proof,calls,provider,observer};
}

test('observer reads without provisioning and reports raw job counts separately from an idle running GPU',async()=>{
  const {observer,calls,proof}=fixture({warm:true});
  assert.deepEqual(calls,[]);
  proof.health.jobs.inQueue=2;
  const result=await observer.observe();
  assert.deepEqual(calls.sort(),['health','release']);
  assert.equal(result.observedAtMs,stamp);assert.equal(result.busyJobs,0);assert.equal(result.queuedJobs,2);
  assert.equal(result.workersMin,0);assert.equal(result.workersMax,1);
  assert.deepEqual(result.workers,[{id:'owned-pod',profileId:'base',state:'running',gpu:'',
    releaseDigest:null,bankHash:null,modelReady:false}]);
});

test('EXITED and TERMINATED cache rows including obsolete images do not occupy GPU capacity',async()=>{
  const {observer,proof}=fixture();
  proof.release.workers.workers=[{state:'scaled-down',image:'old-image',version:1,isStale:true},
    {state:'terminated',image:'old-image',version:1,isStale:true}];
  proof.health.workers.ready=2;proof.health.workers.idle=1;
  assert.deepEqual((await observer.observe()).workers,[]);
});

test('a corroborated starting pod remains occupied and never becomes ready from configured hashes',async()=>{
  const {observer,proof}=fixture({warm:true});
  proof.health.workers.running=0;proof.health.workers.initializing=1;
  const result=await observer.observe();
  assert.equal(result.workers[0].state,'initializing');assert.equal(result.workers[0].modelReady,false);
  assert.equal(result.workers[0].releaseDigest,null);assert.equal(result.workers[0].bankHash,null);
});

test('an unknown provider pod remains unknown and occupied',async()=>{
  const {observer,proof}=fixture({warm:true});
  proof.release.workers.workers[0].state='unknown';proof.release.capacity.activePods[0].state='unknown';
  const result=await observer.observe();
  assert.equal(result.workers.length,1);assert.equal(result.workers[0].state,'unknown');
  assert.equal(result.workers[0].modelReady,false);
});

test('health failures and incomplete health never produce an empty Off receipt',async()=>{
  const failed=fixture();failed.provider.workerState=async()=>{throw Error('private provider diagnostic');};
  await assert.rejects(failed.observer.observe(),rejects);
  const incomplete=fixture();incomplete.provider.workerState=async()=>({workers:0,busy:0,available:0});
  await assert.rejects(incomplete.observer.observe(),rejects);
});

test('a worker health still counts as running after its pod record exited stays busy, never Off and never capacity',async()=>{
  // Live reads 2026-10-19 16:53:04–:24 and 17:04:44–17:05:01 UTC: the idle
  // timeout removed the pod while health kept running=1 for about twenty
  // seconds; a question sent in that window was refused at the guard.
  const f=fixture();
  f.proof.health.workers.running=1;
  const result=await f.observer.observe();
  assert.deepEqual(result.workers,[]);assert.equal(result.busyJobs,1);assert.equal(result.queuedJobs,0);
  const queued=fixture();queued.proof.health.workers.running=1;queued.proof.health.jobs.inQueue=1;
  assert.equal((await queued.observer.observe()).busyJobs,1);
});

test('pod and health contradictions refuse Off instead of dropping occupied evidence',async()=>{
  for(const change of [
    ({proof})=>{proof.health.workers.running=2;},
    ({proof})=>{proof.health.workers.running=1;proof.health.workers.unhealthy=1;},
    ({proof})=>{proof.health.workers.running=1;proof.health.workers.throttled=1;},
    ({proof})=>{proof.health.workers.running=1;proof.health.jobs.inProgress=1;},
    ({proof})=>{proof.health.workers.initializing=1;},
    ({proof})=>{proof.health.workers.unhealthy=1;},
    ({proof})=>{proof.health.jobs.inProgress=1;},
  ]) {
    const f=fixture();change(f);await assert.rejects(f.observer.observe(),rejects);
  }
  const missingHealth=fixture({warm:true});missingHealth.proof.health.workers.running=0;
  await assert.rejects(missingHealth.observer.observe(),rejects);
  const missingPod=fixture({warm:true});missingPod.proof.release.capacity.activePods=[];
  await assert.rejects(missingPod.observer.observe(),rejects);
});

test('missing pod identity, duplicate capacity and contradictory aggregate health are rejected',async()=>{
  const noId=fixture({warm:true});delete noId.proof.release.capacity.activePods[0].id;
  await assert.rejects(noId.observer.observe(),rejects);
  const wrongId=fixture({warm:true});wrongId.proof.release.capacity.activePods[0]={...wrongId.proof.release.capacity.activePods[0],id:'different-pod'};
  await assert.rejects(wrongId.observer.observe(),rejects);
  const duplicate=fixture({warm:true});duplicate.proof.release.capacity.activePods.push({...duplicate.proof.release.capacity.activePods[0]});
  await assert.rejects(duplicate.observer.observe(),rejects);
  const summary=fixture();summary.provider.workerState=async()=>({...summarizeMovingWorkerHealth(summary.proof.health),workers:1});
  await assert.rejects(summary.observer.observe(),rejects);
});

test('the observer rejects a different endpoint, stale evidence and changed min0/max1 limits',async()=>{
  for(const change of [
    ({proof})=>{proof.release.endpoint.id='anotherendpoint';},
    ({proof})=>{proof.release.observedAtMs=stamp-15001;},
    ({proof})=>{proof.release.capacity.workersMin=1;},
    ({proof})=>{proof.release.capacity.workersMax=0;},
    ({proof})=>{proof.release.capacity.idleTimeout=61;},
    ({proof})=>{proof.release.workers.workersMax=2;},
  ]) {
    const f=fixture();change(f);await assert.rejects(f.observer.observe(),rejects);
  }
});

test('actual provider adapter and fetch stubs supply only GET release, template and health evidence',async()=>{
  const proof=movingCapacityFixture({warm:true,now:stamp}),image=proof.release.expectedImage,calls=[];
  const fetchImpl=async(url,options)=>{
    calls.push({url,method:options.method});
    const value=url.endsWith('/health')?proof.health:url.includes('/templates/')?
      {id:'owned-template',imageName:image}:{id:profile.endpointId,workersMin:0,workersMax:1,idleTimeout:60,
        executionTimeoutMs:180000,gpuCount:1,version:3,templateId:'owned-template',
        workers:[{id:'provider-pod',desiredStatus:'RUNNING',imageName:image,slsVersion:3}]};
    return new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});
  };
  const provider=createMovingSpeechRunPod({endpointId:profile.endpointId,apiKey:'fixture-only',expectedImage:image,fetchImpl,now:()=>stamp});
  const result=await createMovingDriftObserver({profile,provider,now:()=>stamp}).observe();
  assert.equal(calls.length,3);assert.ok(calls.every(call=>call.method==='GET'));
  assert.equal(result.workers[0].id,'provider-pod');assert.equal(result.workers[0].modelReady,false);
  assert.equal(result.workers[0].releaseDigest,null);assert.equal(result.workers[0].bankHash,null);
});

test('a slow read or invalid clock cannot stamp old evidence as a fresh observation',async()=>{
  for(const end of [stamp+15001,stamp-1,stamp+0.5,NaN]) {
    const f=fixture();let calls=0;
    const observer=createMovingDriftObserver({profile,provider:f.provider,now:()=>calls++===0?stamp:end});
    await assert.rejects(observer.observe(),rejects);
  }
});

test('collection start survives a fourteen-second read instead of renewing the freshness window',async()=>{
  const f=fixture();let calls=0;
  const observer=createMovingDriftObserver({profile,provider:f.provider,now:()=>calls++===0?stamp:stamp+14000});
  assert.equal((await observer.observe()).observedAtMs,stamp);
});

test('the actual controller loses connected and admission when collected evidence reaches sixteen seconds',async()=>{
  const f=fixture();let calls=0;
  const snapshot=await createMovingDriftObserver({profile,provider:f.provider,now:()=>calls++===0?stamp:stamp+14000}).observe();
  let time=stamp+14000,row=null;
  const store={async transact(work){const result=work(structuredClone(row),time);row=structuredClone(result.state);return structuredClone(result.value);}};
  const controller=createMovingDriftController({store,profiles:[{...profile,label:'Bas'}],capabilities:{connected:true,requireExecutor:true}});
  let execution=await controller.claimExecution({holderId:'clock-test',profileId:profile.id});
  const observe=()=>controller.observe({...snapshot,revision:execution.revision,operationId:execution.operationId,
    observedProfileIds:[profile.id],execution,applied:{revision:execution.revision,operationId:execution.operationId,
      mode:execution.desired.mode,profileId:execution.desired.profileId,workersMin:0,workersMax:1}});
  const off=await observe();assert.equal(off.capabilities.connected,true);
  await controller.command({mode:'saving',profileId:profile.id,commandId:'clock-saving',expectedRevision:off.revision});
  execution=await controller.claimExecution({holderId:'clock-test',profileId:profile.id});
  assert.equal((await observe()).admission.allowed,true);
  time=stamp+16000;
  const stale=await controller.status();
  assert.equal(stale.capabilities.connected,false);assert.equal(stale.admission.allowed,false);
});

test('the oldest release or template evidence is retained even when it predates collection',async()=>{
  for(const [releaseAt,templateAt,end,oldest] of [
    [stamp-1000,stamp-2000,stamp+1000,stamp-2000],
    [stamp-2000,stamp-1000,stamp+1000,stamp-2000],
    [stamp+7000,stamp+8000,stamp+14000,stamp],
  ]){
    const f=fixture();f.proof.release.observedAtMs=releaseAt;f.proof.release.templateCorroboration.observedAtMs=templateAt;let calls=0;
    const observer=createMovingDriftObserver({profile,provider:f.provider,now:()=>calls++===0?stamp:end});
    assert.equal((await observer.observe()).observedAtMs,oldest);
  }
});

test('all source timestamps are checked against completion and malformed or expired evidence stays closed',async()=>{
  for(const source of ['release','template'])for(const at of [undefined,null,NaN,-1,stamp+0.5,stamp+14001,stamp-1001]){
    const f=fixture(),value=source==='release'?f.proof.release:f.proof.release.templateCorroboration;let calls=0;
    if(at===undefined)delete value.observedAtMs;else value.observedAtMs=at;
    const observer=createMovingDriftObserver({profile,provider:f.provider,now:()=>calls++===0?stamp:stamp+14000});
    await assert.rejects(observer.observe(),rejects);
  }
});


test('observer accepts the exact current-image EXITED initialization already admitted by the capacity contract',async()=>{
  const f=fixture();
  f.proof.release.workers.workers=[{state:'scaled-down',image:f.proof.release.expectedImage,version:3,isStale:false}];
  f.proof.health.workers.initializing=1;
  assert.equal(verifyMovingCapacity(f.proof,{endpointId:profile.endpointId,now:stamp}).mode,'cold');
  assert.deepEqual((await f.observer.observe()).workers,[]);
});

test('an initializing cache slot beside the exact running job does not relabel or hide the paid worker',async()=>{
  const f=fixture({warm:true});
  f.proof.release.workers.workers.push({state:'scaled-down',image:f.proof.release.expectedImage,version:3,isStale:false});
  f.proof.health.workers.initializing=1;f.proof.health.jobs.inProgress=1;
  const result=await f.observer.observe();
  assert.equal(result.workers.length,1);assert.equal(result.workers[0].state,'running');
  assert.equal(result.workers[0].id,'owned-pod');assert.equal(result.workers[0].modelReady,false);
  assert.equal(result.busyJobs,1);
});

test('a job dispatched to a cached idle slot stays observable while health still reports the slot as idle',async()=>{
  // Real provider reads 2026-10-19 14:31:01–14:31:12 UTC: pod RUNNING with the
  // exact image/version, jobs.inProgress=1, health idle=1 running=0 initializing=0.
  const f=fixture({warm:true});
  Object.assign(f.proof.health.workers,{idle:1,running:0,initializing:0,ready:1});
  f.proof.health.jobs.inProgress=1;
  const result=await f.observer.observe();
  assert.equal(result.workers.length,1);assert.equal(result.workers[0].id,'owned-pod');
  assert.equal(result.workers[0].state,'initializing');assert.equal(result.workers[0].modelReady,false);
  assert.equal(result.busyJobs,1);
  // Twelve seconds later the counters catch up and the same pod is running.
  Object.assign(f.proof.health.workers,{idle:0,running:1,ready:0});
  assert.equal((await f.observer.observe()).workers[0].state,'running');
  // A live pod that neither initializing nor a cached idle slot can explain is still unverified.
  Object.assign(f.proof.health.workers,{idle:0,running:0,initializing:0,ready:0});
  await assert.rejects(f.observer.observe(),rejects);
  // Two unexplained starting pods or an unhealthy slot never pass either.
  const two=fixture({warm:true});
  Object.assign(two.proof.health.workers,{idle:1,running:0,initializing:0,unhealthy:1});two.proof.health.jobs.inProgress=1;
  const unhealthy=await two.observer.observe();
  assert.equal(unhealthy.workers[0].state,'unknown');
});

test('initialization cannot hide missing, stale or foreign cached evidence or unhealthy capacity',async()=>{
  for(const change of [
    f=>{f.proof.release.workers.workers.pop();},
    f=>{f.proof.release.workers.workers[1].isStale=true;},
    f=>{f.proof.release.workers.workers[1].image='other-image';},
    f=>{f.proof.release.workers.workers[1].version=2;},
    f=>{f.proof.health.workers.initializing=2;},
    f=>{f.proof.health.workers.unhealthy=1;},
  ]){
    const f=fixture({warm:true});
    f.proof.release.workers.workers.push({state:'scaled-down',image:f.proof.release.expectedImage,version:3,isStale:false});
    f.proof.health.workers.initializing=1;change(f);
    await assert.rejects(f.observer.observe(),rejects);
  }
});
