// Technical capacity, not a new authorization. For an existing budget ID the
// journal uses the lower durable limit until an explicit, funded amendment.
// Migrations 015/017 change only schema capacity; they grant no budget or refund.
export const MOVING_BUDGET_MAX_MICRO_USD = 45000000;
// Provider-wide coverage includes retained windows; durable grants remain capped above.
// This technical capacity never authorizes an amendment or releases reservations.
// Raised 50 → 75 USD on 19 October 2026 at Jakob's instruction so that the
// retained earlier windows (47 USD) leave room for further diagnosed trials.
export const MOVING_PROVIDER_BUDGET_MAX_MICRO_USD = 75000000;
export const MOVING_TRIAL_BUDGET = Object.freeze({
  budgetId: 'dragan-test-20261017', totalBudgetMicroUsd: MOVING_BUDGET_MAX_MICRO_USD,
  initialBudgetMicroUsd: 13200000,
  // Daily ceiling 20 → 40 USD on 19 October 2026 (Jakob: run the trial evening
  // at test cost). Sixteen 1.20 USD reservations had filled the UTC day.
  reserveMicroUsd: 1200000, currentDailyBudgetMicroUsd: 40000000,
});
const id = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const hash = /^[a-f0-9]{64}$/;
const money = (value, minimum = 0, maximum = MOVING_BUDGET_MAX_MICRO_USD) => Number.isSafeInteger(value) && value >= minimum && value <= maximum;
export function validMovingBudgetAmendment(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const fields = ['amendmentId','budgetId','actor','authorizationId','evidenceSha256','observedAtMs',
    'expectedLimitMicroUsd','expectedReservedMicroUsd','expectedReservationCount','newLimitMicroUsd',
    'globalLimitMicroUsd','providerSpentMicroUsd','otherReservedMicroUsd','windowReserveMicroUsd'];
  if (Object.keys(value).length !== fields.length || fields.some(key => !Object.hasOwn(value,key))) return false;
  if (!uuid.test(value.amendmentId) || !id.test(value.budgetId) || !id.test(value.actor)
    || !id.test(value.authorizationId) || !hash.test(value.evidenceSha256)
    || !Number.isSafeInteger(value.observedAtMs) || value.observedAtMs < 0
    || !Number.isSafeInteger(value.expectedReservationCount) || value.expectedReservationCount < 1) return false;
  if (!['expectedLimitMicroUsd','newLimitMicroUsd','windowReserveMicroUsd'].every(key => money(value[key],1))
    || !money(value.expectedReservedMicroUsd)
    || !money(value.globalLimitMicroUsd,1,MOVING_PROVIDER_BUDGET_MAX_MICRO_USD)
    || !['providerSpentMicroUsd','otherReservedMicroUsd'].every(key => money(value[key],0,MOVING_PROVIDER_BUDGET_MAX_MICRO_USD))) return false;
  return value.expectedReservedMicroUsd <= value.expectedLimitMicroUsd
    && value.newLimitMicroUsd > value.expectedLimitMicroUsd && value.newLimitMicroUsd <= value.globalLimitMicroUsd
    && value.newLimitMicroUsd-value.expectedReservedMicroUsd <= value.windowReserveMicroUsd
    && value.providerSpentMicroUsd+value.otherReservedMicroUsd+value.windowReserveMicroUsd <= value.globalLimitMicroUsd;
}
export function freshMovingBudgetAmendment(value, now) {
  return validMovingBudgetAmendment(value) && Number.isSafeInteger(now)
    && value.observedAtMs <= now && now-value.observedAtMs <= 300000;
}
