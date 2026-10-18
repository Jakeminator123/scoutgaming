import test from 'node:test';
import assert from 'node:assert/strict';
import {validMovingBudgetAmendment,freshMovingBudgetAmendment,MOVING_TRIAL_BUDGET} from '../services/game/moving-speech-budget.mjs';
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

// Explicit global authorization includes historical provider windows, while the
// existing journal receives only one additional fixed reservation.
test('40 USD accounting permits the next 1.20 USD reservation without widening journal capacity',()=>{
 const next={...input,authorizationId:'jakob-dragan-runpod-total-40-20261018',
  expectedLimitMicroUsd:6000000,expectedReservedMicroUsd:6000000,expectedReservationCount:5,
  newLimitMicroUsd:MOVING_TRIAL_BUDGET.totalBudgetMicroUsd,globalLimitMicroUsd:40000000,otherReservedMicroUsd:14070001};
 assert.equal(validMovingBudgetAmendment(next),true);
 assert.equal(next.newLimitMicroUsd-next.expectedReservedMicroUsd,MOVING_TRIAL_BUDGET.reserveMicroUsd);
 assert.equal(validMovingBudgetAmendment({...next,otherReservedMicroUsd:16000000}),true);
 for(const patch of [{newLimitMicroUsd:15000001},{globalLimitMicroUsd:40000001},
  {providerSpentMicroUsd:40000001},{otherReservedMicroUsd:40000001},{otherReservedMicroUsd:38000000},
  {windowReserveMicroUsd:1199999},{globalLimitMicroUsd:'40000000'}])
  assert.equal(validMovingBudgetAmendment({...next,...patch}),false,JSON.stringify(patch));
});
