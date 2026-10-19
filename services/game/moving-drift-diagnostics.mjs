import {MOVING_DRIFT_OBSERVATION_MAX_AGE_MS as MAX_AGE} from '../../packages/presentation/contracts/moving-drift.mjs';

const safeTime=value=>Number.isSafeInteger(value)&&value>=0;
export function driftAgeClass(stamp,now) {
  if(stamp===null||stamp===undefined)return 'missing';
  if(!safeTime(stamp)||!safeTime(now))return 'invalid';
  if(stamp>now)return 'future';
  return now-stamp<=MAX_AGE?'fresh':'stale';
}
export function driftLeaseClass(until,now) {
  if(until===null||until===undefined)return 'missing';
  if(!safeTime(until)||!safeTime(now))return 'invalid';
  return until<=now?'expired':'active';
}
export function driftReadDurationClass(ms) {
  if(!safeTime(ms))return 'invalid';
  return ms<=MAX_AGE/2?'fast':ms<=MAX_AGE?'slow':'overdue';
}

const ageClasses=new Set(['missing','invalid','future','fresh','stale']);
const enumFields={
  phase:new Set(['reserve','current','submit','dispatch','invalid']),
  desiredMode:new Set(['off','saving','warm']),
  reason:new Set(['invalid_context','profile_missing','mode_not_saving','draining','runtime_unavailable',
    'revision_changed','operation_changed','profile_changed','endpoint_changed','catalogue_changed',
    'executor_fence_changed','observation_unknown','observation_error','applied_revision_changed',
    'applied_operation_changed','reserve_busy']),
  observedStatus:new Set(['unknown','error','off','stopping','starting','loading','ready']),
  observedReason:new Set([null,'drift_observation_missing','drift_catalogue_changed','drift_observation_stale',
    'drift_capacity_exceeded','drift_worker_unknown','drift_release_mismatch','drift_runtime_unavailable',
    'drift_warm_unavailable','drift_profile_mismatch','drift_warm_coverage_missing']),
  executionAge:ageClasses,observationAge:ageClasses,
  lease:new Set(['missing','invalid','expired','active']),
};
const booleanFields=['drainRequired','revisionMatches','operationMatches','profileMatches','endpointMatches','catalogueMatches',
  'executorFenceMatches','appliedRevisionMatches','appliedOperationMatches','executionIdentityMatches','observationCatalogueMatches'];

/** Internal finite metadata only. Never invoke accessors, coerce values or inspect extra fields. */
export function sanitizeDriftGuardDiagnostic(value) {
  try {
    if(value===null||typeof value!=='object'||Array.isArray(value))return null;
    const output={};
    for(const [key,allowed] of Object.entries(enumFields)) {
      const descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(!descriptor||!Object.hasOwn(descriptor,'value')||!allowed.has(descriptor.value))return null;
      output[key]=descriptor.value;
    }
    for(const key of booleanFields) {
      const descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(!descriptor||!Object.hasOwn(descriptor,'value')||typeof descriptor.value!=='boolean')return null;
      output[key]=descriptor.value;
    }
    return Object.freeze(output);
  } catch {return null;}
}
