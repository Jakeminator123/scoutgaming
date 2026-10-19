import test from 'node:test';
import assert from 'node:assert/strict';
import {readMovingDriftStatus,driftDraft,driftView,driftCommand} from './moving-drift-ui.mjs';
const fixture=()=>({schemaVersion:1,revision:4,operationId:null,serverNowMs:100000,
  desired:{mode:'off',profileId:null,endsAtMs:null},observed:{status:'unknown',atMs:null,reasonCode:'drift_observation_missing'},
  profiles:[{id:'dragan-standard',label:'Dragan standard'}],selectedProfileId:null,
  actual:{profileId:null,gpu:null,workerId:null},readiness:{modelReady:false,releaseMatches:false,bankMatches:false},
  admission:{allowed:false,reasonCode:'drift_not_admitting'},capabilities:{connected:false,allowedModes:['off'],reasonCode:'drift_runtime_unavailable'},
  cost:{estimatedMicroUsd:null,source:null,quotedAtMs:null,shutdownTailMs:null}});
function running() {
  const value=fixture();value.desired={mode:'saving',profileId:'dragan-standard',endsAtMs:null};value.selectedProfileId='dragan-standard';
  value.observed={status:'ready',atMs:100000,reasonCode:null};value.actual={profileId:'dragan-standard',gpu:'Fixture GPU',workerId:'worker-fixture'};
  value.readiness={modelReady:true,releaseMatches:true,bankMatches:true};value.admission={allowed:true,reasonCode:null};value.capabilities={connected:true,allowedModes:['off','saving'],reasonCode:'drift_warm_unavailable'};
  return value;
}
test('a saved Off request with no observation never claims the GPU is off or free',()=>{
  const status=readMovingDriftStatus(fixture()),view=driftView(status);
  assert.equal(view.label,'Okänd');assert.equal(view.ready,false);assert.equal(view.costLabel,'Okänd');
  status.observed={status:'off',atMs:100000,reasonCode:null};assert.equal(driftView(status).label,'Av');
  assert.equal(driftView(status,15001).label,'Okänd');
});
test('speech readiness expires and requires matching actual profile and admission',()=>{
  const status=readMovingDriftStatus(running());assert.equal(driftView(status).label,'Redo för tal');
  assert.equal(driftView(status,15001).ready,false);assert.equal(driftView(status,15001).recent,false);
  status.actual.profileId='different';assert.equal(driftView(status).ready,false);
  status.actual.profileId='dragan-standard';status.readiness.bankMatches=false;assert.equal(driftView(status).ready,false);
  status.readiness.bankMatches=true;status.admission.allowed=false;assert.equal(driftView(status).ready,false);
});
test('passing a warm deadline never pretends shutdown happened',()=>{
  const status=running();status.desired={mode:'warm',profileId:'dragan-standard',endsAtMs:110000};
  status.capabilities.allowedModes.push('warm');status.cost={estimatedMicroUsd:500000,source:'fixture-quote',quotedAtMs:99000,shutdownTailMs:1000};
  assert.equal(driftView(status).costLabel.includes('0,50'),true);
  const expired=driftView(status,11000);assert.equal(expired.ready,false);assert.equal(expired.label,'Avstängning ej bekräftad');
  status.observed={status:'off',atMs:111000,reasonCode:null};assert.equal(driftView(status,11000).label,'Av');
});
test('unknown and tiny estimates are not rounded into a false zero price',()=>{
  const status=running();status.desired={mode:'warm',profileId:'dragan-standard',endsAtMs:200000};
  assert.equal(driftView(status).costLabel,'Okänd');
  status.cost={estimatedMicroUsd:1,source:'fixture',quotedAtMs:100000,shutdownTailMs:1000};assert.equal(driftView(status).costLabel,'< 0,01 USD');
  status.cost.source=null;assert.equal(driftView(status).costLabel,'Okänd');
});
test('public DTO parsing rejects malformed or contradictory capabilities and drops private fields',()=>{
  for(const mutate of [value=>delete value.observed.atMs,value=>value.profiles.push(value.profiles[0]),value=>value.cost.estimatedMicroUsd=-1,value=>value.observed.atMs=Number.MAX_SAFE_INTEGER,value=>value.capabilities.allowedModes.push('warm')]){
    const value=fixture();mutate(value);assert.throws(()=>readMovingDriftStatus(value),error=>error.status===503);
  }
  const value=fixture();value.executorUrl='https://private.invalid';value.profiles[0].endpointId='secret-endpoint';value.actual.bankHash='private-hash';
  const parsed=readMovingDriftStatus(value);assert.equal('executorUrl' in parsed,false);assert.deepEqual(parsed.profiles,[{id:'dragan-standard',label:'Dragan standard'}]);assert.equal('bankHash' in parsed.actual,false);
});
test('profile drafts never replace a removed saved profile or guess among several profiles',()=>{
  const status=running();status.desired.profileId='removed';status.selectedProfileId='removed';assert.equal(driftDraft(status).profileId,'');
  const off=fixture();off.profiles.push({id:'other',label:'Other'});assert.equal(driftDraft(off).profileId,'');
  off.profiles.pop();assert.equal(driftDraft(off).profileId,'dragan-standard');
});
test('commands retain their edited revision and enforce actual allowed modes and profiles',()=>{
  const status=running(),draft=driftDraft(status);draft.dirty=true;
  assert.deepEqual(driftCommand(status,draft,'command-1'),{expectedRevision:4,commandId:'command-1',mode:'saving',profileId:'dragan-standard'});
  status.revision=5;assert.throws(()=>driftCommand(status,draft,'command-2'),error=>error.status===409);
  draft.revision=5;draft.mode='warm';assert.throws(()=>driftCommand(status,draft,'command-2'),error=>error.status===409);
  draft.mode='saving';draft.profileId='unregistered';assert.throws(()=>driftCommand(status,draft,'command-2'),error=>error.status===422);
});
test('stop carries no client profile, duration, ownership or provider fields',()=>{
  const status=running(),draft={...driftDraft(status),mode:'off',durationSeconds:86400,endpointId:'forbidden',actor:'not-a-server-actor'};
  assert.deepEqual(driftCommand(status,draft,'command-stop'),{expectedRevision:4,commandId:'command-stop',mode:'off'});
});