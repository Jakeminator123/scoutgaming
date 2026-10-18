import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyMovingCapacity} from '../services/game/moving-speech-capacity.mjs';
import {movingCapacityFixture} from './fixtures/moving-capacity.mjs';

const now=100000, options={endpointId:'endpointfixture',now};
test('moving-only capacity distinguishes a stopped endpoint from one owned idle GPU',()=>{
  for(const warm of [false,true]) {
    const result=verifyMovingCapacity(movingCapacityFixture({warm,now}),options);
    assert.equal(result.mode,warm?'warm':'cold');
    assert.equal(result.workerId,warm?'owned-pod':null);
    assert.equal(result.idleTailMs,60000);
  }
});
test('work, unhealthy/unknown capacity, foreign release, stale observations and unbounded idle cannot admit',()=>{
  const changes=[
    p=>p.health.jobs.inQueue=1, p=>p.health.jobs.inProgress=1,
    p=>p.health.workers.unhealthy=1, p=>p.health.workers.initializing=1,
    p=>p.health.workers.throttled=1, p=>p.health.workers.running=2,
    p=>p.health.workers.running=0, p=>p.health.workers.ready=-1,
    p=>p.health.jobs.inProgress='0', p=>delete p.health.jobs.retried,
    p=>p.observedAtMs=now-15001, p=>p.observedAtMs=now+1,
    p=>p.release.observedAtMs=now-15001,
    p=>p.release.expectedImage='foreign-image', p=>p.release.endpoint.id='foreign123',
    p=>p.release.workers.workers[0].state='unknown',
    p=>p.release.workers.workers[0].version=2,
    p=>p.release.capacity.activePods[0].id='',
    p=>p.release.capacity.activePods=[],
    p=>p.release.capacity.templateId='another-template',
    p=>p.release.capacity.workersMin=1, p=>p.release.capacity.workersMax=2,
    p=>p.release.capacity.idleTimeout=61,
    p=>p.release.templateCorroboration.observedAtMs=now-15001,
  ];
  for(const change of changes){const proof=movingCapacityFixture({now});change(proof);assert.throws(()=>verifyMovingCapacity(proof,options),/capacity_unverified/);}
});

test('Flashboot ready counters neither require nor prove a running GPU',()=>{
  for(const ready of [0,1]) {
    const warm=movingCapacityFixture({now});warm.health.workers.ready=ready;
    assert.equal(verifyMovingCapacity(warm,options).mode,'warm');
  }
  const cached=movingCapacityFixture({warm:false,now});
  cached.health.workers.idle=1;cached.health.workers.ready=1;
  cached.release.workers.workers=[{id:'cached-pod',state:'scaled-down',image:cached.release.expectedImage,version:3,isStale:false}];
  const result=verifyMovingCapacity(cached,options);
  assert.equal(result.mode,'cold');assert.equal(result.workerId,null);
});

function initializingColdProof() {
  const proof=movingCapacityFixture({warm:false,now});
  proof.health.workers.initializing=1;
  proof.release.workers.workers=[{state:'scaled-down',image:proof.release.expectedImage,
    version:proof.release.workers.endpointVersion,isStale:false}];
  return proof;
}
test('one current EXITED slot corroborates cold initialization without claiming a warm model',()=>{
  const value=verifyMovingCapacity(initializingColdProof(),options);
  assert.equal(value.mode,'cold');assert.equal(value.workerId,null);assert.equal(value.idleTailMs,60000);
});
test('initialization needs exactly one current stopped slot and cannot hide activity or uncertainty',()=>{
  for(const change of [
    p=>p.health.workers.initializing=2, p=>p.health.workers.initializing='1',
    p=>p.health.workers.running=1, p=>p.health.workers.unhealthy=1, p=>p.health.workers.throttled=1,
    p=>p.health.jobs.inQueue=1, p=>p.health.jobs.inProgress=1,
    p=>p.release.workers.workers=[], p=>p.release.workers.workers.push({...p.release.workers.workers[0]}),
    p=>p.release.workers.workers[0].state='unknown', p=>p.release.workers.workers[0].state='active',
    p=>p.release.workers.workers[0].state='terminated', p=>p.release.workers.workers[0].isStale=true,
    p=>p.release.workers.workers[0].image='foreign-image', p=>p.release.workers.workers[0].version=99,
    p=>delete p.release.workers.workers[0].isStale,
    p=>p.release.capacity.activePods.push({id:'unexpected',state:'active',image:p.release.expectedImage,version:3}),
  ]) {
    const proof=initializingColdProof();change(proof);assert.throws(()=>verifyMovingCapacity(proof,options),/capacity_unverified/);
  }
  const warm=movingCapacityFixture({now});warm.health.workers.initializing=1;
  assert.throws(()=>verifyMovingCapacity(warm,options),/capacity_unverified/);
});
