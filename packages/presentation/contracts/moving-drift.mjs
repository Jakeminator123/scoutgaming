// Public control contract. Profile/worker secrets and provider URLs never enter this DTO.
// Values are API identifiers; Swedish labels belong to Admin.
export const MOVING_DRIFT_MODES = Object.freeze(['off','saving','warm']);
export const MOVING_DRIFT_DURATIONS = Object.freeze([1800,7200,86400]);
export const MOVING_DRIFT_OBSERVATION_MAX_AGE_MS = 15000;
export function driftError(code, statusCode=409) {
  return Object.assign(new Error(code),{code,statusCode});
}
export function parseMovingDriftCommand(input) {
  const fail=()=>{throw driftError('drift_invalid_command',422);};
  if (!input || Object.getPrototypeOf(input)!==Object.prototype) fail();
  const keys=['expectedRevision','commandId','mode',...(input.mode==='off'?[]:['profileId']),
    ...(input.mode==='warm'?['durationSeconds']:[])];
  if(Object.keys(input).length!==keys.length || keys.some(key=>!Object.hasOwn(input,key))) fail();
  if(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0
    || typeof input.commandId!=='string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(input.commandId??'')
    || !MOVING_DRIFT_MODES.includes(input.mode)) fail();
  if(input.mode!=='off' && (typeof input.profileId!=='string'||!/^[a-z][a-z0-9-]{0,31}$/.test(input.profileId))) fail();
  if(input.mode==='warm'&&!MOVING_DRIFT_DURATIONS.includes(input.durationSeconds)) fail();
  return Object.fromEntries(keys.map(key=>[key,input[key]]));
}
