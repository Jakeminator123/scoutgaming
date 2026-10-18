import test from 'node:test';
import assert from 'node:assert/strict';
import {validMovingBudgetAmendment,freshMovingBudgetAmendment,MOVING_TRIAL_BUDGET,MOVING_PROVIDER_BUDGET_MAX_MICRO_USD} from '../services/game/moving-speech-budget.mjs';
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
test('insufficient coverage, journal capacity above 15 USD, global cap above 40 USD or a refund cannot authorize',()=>{
 for(const patch of [{globalLimitMicroUsd:40000001},{newLimitMicroUsd:16000000},{newLimitMicroUsd:4800000},
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
 assert.equal(MOVING_PROVIDER_BUDGET_MAX_MICRO_USD,40000000);
 assert.equal(validMovingBudgetAmendment({...next,otherReservedMicroUsd:16000000}),true);
 for(const patch of [{newLimitMicroUsd:12000000},{newLimitMicroUsd:15000001},{globalLimitMicroUsd:40000001},
  {providerSpentMicroUsd:40000001},{otherReservedMicroUsd:40000001},{otherReservedMicroUsd:38000000},
  {windowReserveMicroUsd:1199999},{globalLimitMicroUsd:'40000000'}])
  assert.equal(validMovingBudgetAmendment({...next,...patch}),false,JSON.stringify(patch));
});

test('two planned replies fit the existing journal and require coverage for both unchanged reservations',()=>{
 const twoReplies={...input,authorizationId:'fixture-two-production-replies',
  expectedLimitMicroUsd:10800000,expectedReservedMicroUsd:10800000,expectedReservationCount:9,
  newLimitMicroUsd:MOVING_TRIAL_BUDGET.totalBudgetMicroUsd,globalLimitMicroUsd:40000000,
  providerSpentMicroUsd:600000,otherReservedMicroUsd:24000000,windowReserveMicroUsd:2400000};
 assert.equal(validMovingBudgetAmendment(twoReplies),true);
 assert.equal(twoReplies.newLimitMicroUsd,13200000);
 assert.equal(twoReplies.newLimitMicroUsd-twoReplies.expectedReservedMicroUsd,2*MOVING_TRIAL_BUDGET.reserveMicroUsd);
 assert.equal(MOVING_TRIAL_BUDGET.reserveMicroUsd,1200000);
 assert.equal(MOVING_TRIAL_BUDGET.currentDailyBudgetMicroUsd,6000000+2*MOVING_TRIAL_BUDGET.reserveMicroUsd);
 assert.equal(validMovingBudgetAmendment({...twoReplies,windowReserveMicroUsd:2333334}),false,'old one-trial reserve cannot cover two replies');
 assert.equal(validMovingBudgetAmendment({...twoReplies,newLimitMicroUsd:14400000}),false,'a third reply has no coverage in this amendment');
});
