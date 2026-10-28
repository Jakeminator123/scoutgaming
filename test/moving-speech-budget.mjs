import test from 'node:test';
import assert from 'node:assert/strict';
import {validMovingBudgetAmendment,freshMovingBudgetAmendment,movingTrialBudget,MOVING_TRIAL_BUDGET_SERIES,MOVING_BUDGET_MAX_MICRO_USD,MOVING_PROVIDER_BUDGET_MAX_MICRO_USD} from '../services/game/moving-speech-budget.mjs';
const DRAGAN_BUDGET = movingTrialBudget('dragan');
// Recorded decision labels, not credentials. Kept apart from the authorization
// field so generic secret scanners do not read the labels as API keys.
const DECISION=Object.freeze({
  d1:'jakob-dragan-runpod-total-15-20261017',
  d2:'fixture-trial-three',
  d3:'fixture-two-production-replies',
  d4:'fixture-funded-capacity',
  d5:'fixture-cumulative-150',
  d6:'fixture-delegated-provider-50',
  d7:'jakob-chat-20261019-satt-pa-alla-flaggor',
  d8:'jakob-chat-20261021-hoj-budgeten',
});
const input={amendmentId:'11111111-1111-4111-8111-111111111111',budgetId:'dragan-test-20261017',actor:'Jakob',
  authorizationId:DECISION.d1,evidenceSha256:'a'.repeat(64),observedAtMs:1000000,
  expectedLimitMicroUsd:4800000,expectedReservedMicroUsd:4800000,expectedReservationCount:4,newLimitMicroUsd:6000000,
  globalLimitMicroUsd:15000000,providerSpentMicroUsd:499028,otherReservedMicroUsd:11736667,windowReserveMicroUsd:2333334};
test('one additional reservation fits the existing ID and cumulative human cap',()=>{
 assert.equal(validMovingBudgetAmendment(input),true);
 assert.equal(DRAGAN_BUDGET.budgetId,input.budgetId);
 assert.equal(input.newLimitMicroUsd-input.expectedReservedMicroUsd,DRAGAN_BUDGET.reserveMicroUsd);
 assert.equal(freshMovingBudgetAmendment(input,1300000),true);
 assert.equal(freshMovingBudgetAmendment(input,1300001),false);
 assert.equal(freshMovingBudgetAmendment(input,999999),false);
});
test('insufficient coverage, grant above 150 USD, provider cap above 250 USD or refund cannot authorize',()=>{
 for(const patch of [{globalLimitMicroUsd:250000001},{newLimitMicroUsd:150000001},{newLimitMicroUsd:4800000},
  {newLimitMicroUsd:4700000},{expectedReservedMicroUsd:4800001},{windowReserveMicroUsd:1199999},
  {otherReservedMicroUsd:14000000},{providerSpentMicroUsd:-1},{expectedReservationCount:0},
  {globalLimitMicroUsd:'15000000'},{authorizationId:''},{evidenceSha256:'unverified'},{unexpected:true}]){
   assert.equal(validMovingBudgetAmendment({...input,...patch}),false,JSON.stringify(patch));
 }
});

// Freeze the historical trial-three amendment independently of current capacity.
test('historical third production trial permitted one additional 1.20 USD reservation',()=>{
 const next={...input,authorizationId:DECISION.d2,
  expectedLimitMicroUsd:9600000,expectedReservedMicroUsd:9600000,expectedReservationCount:8,
  newLimitMicroUsd:10800000,globalLimitMicroUsd:40000000,
  providerSpentMicroUsd:525826,otherReservedMicroUsd:21070001};
 assert.equal(validMovingBudgetAmendment(next),true);
 assert.equal(next.newLimitMicroUsd-next.expectedReservedMicroUsd,DRAGAN_BUDGET.reserveMicroUsd);
 assert.equal(DRAGAN_BUDGET.reserveMicroUsd,1200000);
 assert.equal(MOVING_PROVIDER_BUDGET_MAX_MICRO_USD,250000000);
 assert.equal(validMovingBudgetAmendment({...next,otherReservedMicroUsd:16000000}),true);
 for(const patch of [{newLimitMicroUsd:12000000},{newLimitMicroUsd:40000001},{globalLimitMicroUsd:250000001},
   {providerSpentMicroUsd:45000001},{otherReservedMicroUsd:45000001},{otherReservedMicroUsd:38000000},
  {windowReserveMicroUsd:1199999},{globalLimitMicroUsd:'40000000'}])
  assert.equal(validMovingBudgetAmendment({...next,...patch}),false,JSON.stringify(patch));
});

test('historical two-reply amendment required coverage for both unchanged reservations',()=>{
 const twoReplies={...input,authorizationId:DECISION.d3,
  expectedLimitMicroUsd:10800000,expectedReservedMicroUsd:10800000,expectedReservationCount:9,
  newLimitMicroUsd:13200000,globalLimitMicroUsd:40000000,
  providerSpentMicroUsd:600000,otherReservedMicroUsd:24000000,windowReserveMicroUsd:2400000};
 assert.equal(validMovingBudgetAmendment(twoReplies),true);
 assert.equal(twoReplies.newLimitMicroUsd,13200000);
 assert.equal(twoReplies.newLimitMicroUsd-twoReplies.expectedReservedMicroUsd,2*DRAGAN_BUDGET.reserveMicroUsd);
 assert.equal(DRAGAN_BUDGET.reserveMicroUsd,1200000);
 assert.equal(validMovingBudgetAmendment({...twoReplies,windowReserveMicroUsd:2333334}),false,'old one-trial reserve cannot cover two replies');
 assert.equal(validMovingBudgetAmendment({...twoReplies,newLimitMicroUsd:14400000}),false,'a third reply has no coverage in this amendment');
});

test('technical capacity permits funded amendments beyond 15 USD without granting them',()=>{
 assert.equal(MOVING_BUDGET_MAX_MICRO_USD,150000000);
 assert.equal(DRAGAN_BUDGET.totalBudgetMicroUsd,MOVING_BUDGET_MAX_MICRO_USD);
  assert.equal(DRAGAN_BUDGET.initialBudgetMicroUsd,13200000);
 assert.equal(DRAGAN_BUDGET.currentDailyBudgetMicroUsd,60000000);
 assert.equal(DRAGAN_BUDGET.reserveMicroUsd,1200000);
 const funded={...input,authorizationId:DECISION.d4,globalLimitMicroUsd:40000000,
  expectedLimitMicroUsd:13200000,expectedReservedMicroUsd:13200000,expectedReservationCount:11,
  newLimitMicroUsd:15600000,providerSpentMicroUsd:600000,otherReservedMicroUsd:24000000,windowReserveMicroUsd:2400000};
 assert.equal(validMovingBudgetAmendment(funded),true);
 assert.equal(validMovingBudgetAmendment({...funded,windowReserveMicroUsd:1200000}),false);
 assert.equal(validMovingBudgetAmendment({...funded,otherReservedMicroUsd:37000001}),false);
 const ceiling={...funded,expectedLimitMicroUsd:38800000,expectedReservedMicroUsd:38800000,
  newLimitMicroUsd:40000000,windowReserveMicroUsd:1200000};
 assert.equal(validMovingBudgetAmendment(ceiling),true);
 assert.equal(validMovingBudgetAmendment({...ceiling,newLimitMicroUsd:40000001}),false);
 // The next intended 13.2 -> 14.4 amendment is distinct from the code ceiling.
 assert.equal(validMovingBudgetAmendment({...funded,expectedReservedMicroUsd:12000000,
  expectedReservationCount:10,newLimitMicroUsd:14400000}),true);
});

test('the durable grant still stops at 150 USD while provider accounting has its own ceiling',()=>{
 const ceiling={...input,authorizationId:DECISION.d5,
  expectedLimitMicroUsd:148800000,expectedReservedMicroUsd:148800000,expectedReservationCount:124,
  newLimitMicroUsd:150000000,globalLimitMicroUsd:150000000,
  providerSpentMicroUsd:600000,otherReservedMicroUsd:24000000,windowReserveMicroUsd:1200000};
 const saved=structuredClone(ceiling);
 assert.equal(validMovingBudgetAmendment(ceiling),true);
 for(const patch of [{newLimitMicroUsd:150000001},{globalLimitMicroUsd:250000001},
   {providerSpentMicroUsd:250000001},{otherReservedMicroUsd:250000001}])
  assert.equal(validMovingBudgetAmendment({...ceiling,...patch}),false,JSON.stringify(patch));
 assert.equal(validMovingBudgetAmendment({...ceiling,providerSpentMicroUsd:124800001}),false,'all provider coverage shares the same 150 USD cap');
 assert.deepEqual(ceiling,saved,'validation cannot rewrite historical amounts');
 assert.equal(DRAGAN_BUDGET.totalBudgetMicroUsd,150000000);
});

test('a funded 50 USD provider window retains old reservations without increasing journal capacity',()=>{
 const next={...input,authorizationId:DECISION.d6,
  expectedLimitMicroUsd:20400000,expectedReservedMicroUsd:20400000,expectedReservationCount:17,
  newLimitMicroUsd:21600000,globalLimitMicroUsd:50000000,
  providerSpentMicroUsd:1000000,otherReservedMicroUsd:42203335,windowReserveMicroUsd:2400000};
 const saved=structuredClone(next);
 assert.equal(validMovingBudgetAmendment(next),true);
 assert.equal(next.newLimitMicroUsd-next.expectedReservedMicroUsd,DRAGAN_BUDGET.reserveMicroUsd);
 assert.equal(validMovingBudgetAmendment({...next,globalLimitMicroUsd:45000000}),false,'retained costs cannot be discarded to reuse the old cap');
 const exact={...next,providerSpentMicroUsd:5396665};
 assert.equal(validMovingBudgetAmendment(exact),true,'all retained costs and the new window fit exactly at50USD');
 assert.equal(validMovingBudgetAmendment({...exact,providerSpentMicroUsd:5396666}),false,'one extra micro-dollar is unfunded');
 const grantBoundary={...next,expectedLimitMicroUsd:148800000,expectedReservedMicroUsd:148800000,
  newLimitMicroUsd:150000000,globalLimitMicroUsd:250000000,windowReserveMicroUsd:1200001,otherReservedMicroUsd:0};
 assert.equal(validMovingBudgetAmendment(grantBoundary),true,'the control case has enough window and provider coverage');
 assert.equal(validMovingBudgetAmendment({...grantBoundary,newLimitMicroUsd:150000001}),false,'provider coverage cannot expand durable schema capacity even when the window funds it');
 assert.equal(validMovingBudgetAmendment({...next,globalLimitMicroUsd:250000001}),false);
 // Jakob's 19 October decision: retained windows plus five more 1.20 USD trials fit under 75 USD.
 const widened={...next,authorizationId:DECISION.d7,expectedLimitMicroUsd:24000000,expectedReservedMicroUsd:24000000,
  expectedReservationCount:20,newLimitMicroUsd:30000000,globalLimitMicroUsd:75000000,providerSpentMicroUsd:1015650,otherReservedMicroUsd:47003335,windowReserveMicroUsd:6000000};
 assert.equal(validMovingBudgetAmendment(widened),true);
 assert.equal(validMovingBudgetAmendment({...widened,globalLimitMicroUsd:50000000}),false,'the same window does not fit under the former 50 USD cap');
 // Jakob's 21 October decision: 150 USD grant and 250 USD provider coverage.
 const evening={...widened,authorizationId:DECISION.d8,expectedLimitMicroUsd:45000000,expectedReservedMicroUsd:42000000,
  expectedReservationCount:35,newLimitMicroUsd:150000000,globalLimitMicroUsd:250000000,providerSpentMicroUsd:1800000,otherReservedMicroUsd:47003335,windowReserveMicroUsd:108000000};
 assert.equal(validMovingBudgetAmendment(evening),true);
 assert.equal(validMovingBudgetAmendment({...evening,globalLimitMicroUsd:75000000}),false,'the 150 USD grant does not fit under the former 75 USD coverage');
 assert.deepEqual(next,saved,'validation cannot rewrite historical reservations');
 assert.equal(MOVING_BUDGET_MAX_MICRO_USD,150000000);
 assert.equal(DRAGAN_BUDGET.totalBudgetMicroUsd,150000000);
});

test('each dealer has its own cumulative budget ID in the series; the first dealer keeps its durable ID',()=>{
 assert.equal(MOVING_TRIAL_BUDGET_SERIES,'test-20261017');
 assert.equal(DRAGAN_BUDGET.budgetId,'dragan-test-20261017');
 const paow=movingTrialBudget('paow');
 assert.equal(paow.budgetId,'paow-test-20261017');
 // A new dealer starts at the same initial grant and per-reply reserve; the daily ceiling is the environment's.
 assert.deepEqual({...paow,budgetId:DRAGAN_BUDGET.budgetId},{...DRAGAN_BUDGET});
 assert.equal(Object.isFrozen(paow),true);
 for(const bad of [undefined,'','Dragan','dragan/other','-dragan','x'.repeat(41),'__proto__'])
  assert.throws(()=>movingTrialBudget(bad),/invalid_moving_budget_dealer/);
});
