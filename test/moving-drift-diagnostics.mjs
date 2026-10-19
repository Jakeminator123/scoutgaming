import test from 'node:test';
import assert from 'node:assert/strict';
import {driftAgeClass,driftLeaseClass,driftReadDurationClass,sanitizeDriftGuardDiagnostic} from '../services/game/moving-drift-diagnostics.mjs';

const fixture=()=>({phase:'current',desiredMode:'saving',drainRequired:false,reason:'runtime_unavailable',observedStatus:'unknown',observedReason:'drift_observation_missing',
  executionAge:'missing',observationAge:'fresh',lease:'active',revisionMatches:true,operationMatches:false,
  profileMatches:true,endpointMatches:true,catalogueMatches:true,executorFenceMatches:false,
  appliedRevisionMatches:true,appliedOperationMatches:true,executionIdentityMatches:true,observationCatalogueMatches:true});

test('age and lease classifications retain exact finite boundary semantics',()=>{
  for(const value of [null,undefined]) {
    assert.equal(driftAgeClass(value,20000),'missing');assert.equal(driftLeaseClass(value,20000),'missing');
  }
  for(const value of [-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'1',{},true]) {
    assert.equal(driftAgeClass(value,20000),'invalid');assert.equal(driftAgeClass(1,value),'invalid');
    assert.equal(driftLeaseClass(value,20000),'invalid');assert.equal(driftLeaseClass(1,value),'invalid');
  }
  assert.equal(driftAgeClass(0,0),'fresh');assert.equal(driftAgeClass(5000,20000),'fresh');
  assert.equal(driftAgeClass(4999,20000),'stale');assert.equal(driftAgeClass(20001,20000),'future');
  assert.equal(driftAgeClass(Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER),'fresh');
  assert.equal(driftLeaseClass(19999,20000),'expired');assert.equal(driftLeaseClass(20000,20000),'expired');
  assert.equal(driftLeaseClass(20001,20000),'active');assert.equal(driftLeaseClass(0,0),'expired');
});

test('read duration classifications distinguish the exact slow and overdue boundaries',()=>{
  for(const [value,expected] of [[0,'fast'],[7500,'fast'],[7501,'slow'],[15000,'slow'],[15001,'overdue'],[Number.MAX_SAFE_INTEGER,'overdue']])
    assert.equal(driftReadDurationClass(value),expected);
  for(const value of [null,undefined,-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'7500',{}])assert.equal(driftReadDurationClass(value),'invalid');
});

test('guard metadata is a frozen independent whitelist snapshot without extra secret fields',()=>{
  const input={...fixture(),secret:'private',token:'capability',uuid:'synthetic-uuid',hash:'a'.repeat(64),url:'https://private.invalid/token'};
  let extraReads=0;Object.defineProperty(input,'privateGetter',{get(){extraReads++;throw Error('private');}});
  const output=sanitizeDriftGuardDiagnostic(input);
  assert.deepEqual(output,fixture());assert.notEqual(output,input);assert.equal(Object.isFrozen(output),true);assert.equal(extraReads,0);
  assert.throws(()=>{output.phase='dispatch';},TypeError);input.phase='dispatch';assert.equal(output.phase,'current');
  assert.deepEqual(sanitizeDriftGuardDiagnostic(Object.assign(Object.create(null),fixture())),fixture());
  assert.equal(sanitizeDriftGuardDiagnostic({...fixture(),observedReason:null}).observedReason,null);
});

test('missing, inherited, accessor, invalid enum and nonboolean required fields fail closed',()=>{
  const baseline=fixture();let getterReads=0;
  for(const [key,value] of Object.entries(baseline)) {
    const missing={...baseline};delete missing[key];assert.equal(sanitizeDriftGuardDiagnostic(missing),null,key);
    const accessor={...baseline};Object.defineProperty(accessor,key,{get(){getterReads++;return value;}});
    assert.equal(sanitizeDriftGuardDiagnostic(accessor),null,key);
    for(const bad of typeof value==='boolean'?[0,1,'true',null,undefined]:['secret-token',{},undefined])
      assert.equal(sanitizeDriftGuardDiagnostic({...baseline,[key]:bad}),null,key);
  }
  assert.equal(getterReads,0);assert.equal(sanitizeDriftGuardDiagnostic(Object.create(baseline)),null);
  for(const value of [null,undefined,[],42,'private',()=>{}])assert.equal(sanitizeDriftGuardDiagnostic(value),null);
});

test('proxy errors fail closed and extra properties are never inspected',()=>{
  const {proxy,revoke}=Proxy.revocable(fixture(),{});revoke();assert.equal(sanitizeDriftGuardDiagnostic(proxy),null);
  assert.equal(sanitizeDriftGuardDiagnostic(new Proxy(fixture(),{getOwnPropertyDescriptor(){throw Error('private');}})),null);
  const fields=new Set(Object.keys(fixture()));
  const input=new Proxy({...fixture(),secret:'private'},{
    ownKeys(){throw Error('Must not enumerate input');},get(){throw Error('Must not read input values');},
    getOwnPropertyDescriptor(target,key){assert.equal(fields.has(key),true);return Reflect.getOwnPropertyDescriptor(target,key);},
  });
  assert.deepEqual(sanitizeDriftGuardDiagnostic(input),fixture());
});
