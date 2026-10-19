import test from 'node:test';
import assert from 'node:assert/strict';
import {createMovingDriftObserver} from '../services/game/moving-drift-observer.mjs';
import {createMovingSpeechRunPod,summarizeMovingWorkerHealth} from '../services/game/moving-speech-runpod.mjs';
import {movingCapacityFixture} from './fixtures/moving-capacity.mjs';

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

test('pod and health contradictions refuse Off instead of dropping occupied evidence',async()=>{
  for(const change of [
    ({proof})=>{proof.health.workers.running=1;},
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
