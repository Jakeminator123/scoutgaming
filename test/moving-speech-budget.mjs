import test from 'node:test';
import assert from 'node:assert/strict';
import {validMovingBudgetAmendment,freshMovingBudgetAmendment,MOVING_TRIAL_BUDGET,MOVING_BUDGET_MAX_MICRO_USD,MOVING_PROVIDER_BUDGET_MAX_MICRO_USD} from '../services/game/moving-speech-budget.mjs';
const input={amendmentId:'11111111-1111-4111-8111-111111111111',budgetId:'dragan-test-20261017',actor:'Jakob',
  authorizationId:'jakob-dragan-runpod-total-15-20261017',evidenceSha256:'a'.repeat(64),observedAtMs:1000000,
  expectedLimitMicroUsd:4800000,expectedReservedMicroUsd:4800000,expectedReservationCount:4,newLimitMicroUsd:6000000,
  globalLimitMicroUsd:15000000,providerSpentMicroUsd:499028,otherReservedMicroUsd:11736667,windowReserveMicroUsd:2333334};
test('one additional reservation fits the existing ID and cumulative human cap',()=>{
 assert.equal(validMovingBudgetAmendment(input),true);
 assert.equal(MOVING_TRIAL_BUDGET.budgetId,input.budgetId);
 assert.equal(input.newLimitMicroUsd-input.expectedReservedMicroUsd,MOVING_TRIAL_BUDGET.reserveMicroUsd);
 assert.equal(freshMovingBudgetAmendment(input,1300000),true);
 assert.equal(freshMovingBudgetAmendment(input,1300001),false);
 assert.equal(freshMovingBudgetAmendment(input,999999),false);
});
test('insufficient coverage, grant above 45 USD, provider cap above 75 USD or refund cannot authorize',()=>{
 for(const patch of [{globalLimitMicroUsd:75000001},{newLimitMicroUsd:45000001},{newLimitMicroUsd:4800000},
  {newLimitMicroUsd:4700000},{expectedReservedMicroUsd:4800001},{windowReserveMicroUsd:1199999},
  {otherReservedMicroUsd:14000000},{providerSpentMicroUsd:-1},{expectedReservationCount:0},
  {globalLimitMicroUsd:'15000000'},{authorizationId:''},{evidenceSha256:'unverified'},{unexpected:true}]){
   assert.equal(validMovingBudgetAmendment({...input,...patch}),false,JSON.stringify(patch));
 }
});

// Freeze the historical trial-three amendment independently of current capacity.
test('historical third production trial permitted one additional 1.20 USD reservation',()=>{
 const next={...input,authorizationId:'fixture-trial-three',
  expectedLimitMicroUsd:9600000,expectedReservedMicroUsd:9600000,expectedReservationCount:8,
  newLimitMicroUsd:10800000,globalLimitMicroUsd:40000000,
  providerSpentMicroUsd:525826,otherReservedMicroUsd:21070001};
 assert.equal(validMovingBudgetAmendment(next),true);
 assert.equal(next.newLimitMicroUsd-next.expectedReservedMicroUsd,MOVING_TRIAL_BUDGET.reserveMicroUsd);
 assert.equal(MOVING_TRIAL_BUDGET.reserveMicroUsd,1200000);
 assert.equal(MOVING_PROVIDER_BUDGET_MAX_MICRO_USD,75000000);
 assert.equal(validMovingBudgetAmendment({...next,otherReservedMicroUsd:16000000}),true);
 for(const patch of [{newLimitMicroUsd:12000000},{newLimitMicroUsd:40000001},{globalLimitMicroUsd:75000001},
   {providerSpentMicroUsd:45000001},{otherReservedMicroUsd:45000001},{otherReservedMicroUsd:38000000},
  {windowReserveMicroUsd:1199999},{globalLimitMicroUsd:'40000000'}])
  assert.equal(validMovingBudgetAmendment({...next,...patch}),false,JSON.stringify(patch));
});

test('historical two-reply amendment required coverage for both unchanged reservations',()=>{
 const twoReplies={...input,authorizationId:'fixture-two-production-replies',
  expectedLimitMicroUsd:10800000,expectedReservedMicroUsd:10800000,expectedReservationCount:9,
  newLimitMicroUsd:13200000,globalLimitMicroUsd:40000000,
  providerSpentMicroUsd:600000,otherReservedMicroUsd:24000000,windowReserveMicroUsd:2400000};
 assert.equal(validMovingBudgetAmendment(twoReplies),true);
 assert.equal(twoReplies.newLimitMicroUsd,13200000);
 assert.equal(twoReplies.newLimitMicroUsd-twoReplies.expectedReservedMicroUsd,2*MOVING_TRIAL_BUDGET.reserveMicroUsd);
 assert.equal(MOVING_TRIAL_BUDGET.reserveMicroUsd,1200000);
 assert.equal(validMovingBudgetAmendment({...twoReplies,windowReserveMicroUsd:2333334}),false,'old one-trial reserve cannot cover two replies');
 assert.equal(validMovingBudgetAmendment({...twoReplies,newLimitMicroUsd:14400000}),false,'a third reply has no coverage in this amendment');
});

test('technical capacity permits funded amendments beyond 15 USD without granting them',()=>{
 assert.equal(MOVING_BUDGET_MAX_MICRO_USD,45000000);
 assert.equal(MOVING_TRIAL_BUDGET.totalBudgetMicroUsd,MOVING_BUDGET_MAX_MICRO_USD);
  assert.equal(MOVING_TRIAL_BUDGET.initialBudgetMicroUsd,13200000);
 assert.equal(MOVING_TRIAL_BUDGET.currentDailyBudgetMicroUsd,20000000);
 assert.equal(MOVING_TRIAL_BUDGET.reserveMicroUsd,1200000);
 const funded={...input,authorizationId:'fixture-funded-capacity',globalLimitMicroUsd:40000000,
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

test('the durable grant still stops at 45 USD while provider accounting has its own ceiling',()=>{
 const ceiling={...input,authorizationId:'fixture-cumulative-45',
  expectedLimitMicroUsd:43800000,expectedReservedMicroUsd:43800000,expectedReservationCount:40,
  newLimitMicroUsd:45000000,globalLimitMicroUsd:45000000,
  providerSpentMicroUsd:600000,otherReservedMicroUsd:24000000,windowReserveMicroUsd:1200000};
 const saved=structuredClone(ceiling);
 assert.equal(validMovingBudgetAmendment(ceiling),true);
 for(const patch of [{newLimitMicroUsd:45000001},{globalLimitMicroUsd:75000001},
   {providerSpentMicroUsd:75000001},{otherReservedMicroUsd:75000001}])
  assert.equal(validMovingBudgetAmendment({...ceiling,...patch}),false,JSON.stringify(patch));
 assert.equal(validMovingBudgetAmendment({...ceiling,providerSpentMicroUsd:19800001}),false,'all provider coverage shares the same45USD cap');
 assert.deepEqual(ceiling,saved,'validation cannot rewrite historical amounts');
 assert.equal(MOVING_TRIAL_BUDGET.totalBudgetMicroUsd,45000000);
});

test('a funded 50 USD provider window retains old reservations without increasing journal capacity',()=>{
 const next={...input,authorizationId:'fixture-delegated-provider-50',
  expectedLimitMicroUsd:20400000,expectedReservedMicroUsd:20400000,expectedReservationCount:17,
  newLimitMicroUsd:21600000,globalLimitMicroUsd:50000000,
  providerSpentMicroUsd:1000000,otherReservedMicroUsd:42203335,windowReserveMicroUsd:2400000};
 const saved=structuredClone(next);
 assert.equal(validMovingBudgetAmendment(next),true);
 assert.equal(next.newLimitMicroUsd-next.expectedReservedMicroUsd,MOVING_TRIAL_BUDGET.reserveMicroUsd);
 assert.equal(validMovingBudgetAmendment({...next,globalLimitMicroUsd:45000000}),false,'retained costs cannot be discarded to reuse the old cap');
 const exact={...next,providerSpentMicroUsd:5396665};
 assert.equal(validMovingBudgetAmendment(exact),true,'all retained costs and the new window fit exactly at50USD');
 assert.equal(validMovingBudgetAmendment({...exact,providerSpentMicroUsd:5396666}),false,'one extra micro-dollar is unfunded');
 const grantBoundary={...next,expectedLimitMicroUsd:43800000,expectedReservedMicroUsd:43800000,
  newLimitMicroUsd:45000000,windowReserveMicroUsd:1200001,otherReservedMicroUsd:0};
 assert.equal(validMovingBudgetAmendment(grantBoundary),true,'the control case has enough window and provider coverage');
 assert.equal(validMovingBudgetAmendment({...grantBoundary,newLimitMicroUsd:45000001}),false,'provider coverage cannot expand durable schema capacity even when the window funds it');
 assert.equal(validMovingBudgetAmendment({...next,globalLimitMicroUsd:75000001}),false);
 // Jakob's 19 October decision: retained windows plus five more 1.20 USD trials fit under 75 USD.
 const widened={...next,authorizationId:'jakob-chat-20261019-satt-pa-alla-flaggor',expectedLimitMicroUsd:24000000,expectedReservedMicroUsd:24000000,
  expectedReservationCount:20,newLimitMicroUsd:30000000,globalLimitMicroUsd:75000000,providerSpentMicroUsd:1015650,otherReservedMicroUsd:47003335,windowReserveMicroUsd:6000000};
 assert.equal(validMovingBudgetAmendment(widened),true);
 assert.equal(validMovingBudgetAmendment({...widened,globalLimitMicroUsd:50000000}),false,'the same window does not fit under the former 50 USD cap');
 assert.deepEqual(next,saved,'validation cannot rewrite historical reservations');
 assert.equal(MOVING_BUDGET_MAX_MICRO_USD,45000000);
 assert.equal(MOVING_TRIAL_BUDGET.totalBudgetMicroUsd,45000000);
});
