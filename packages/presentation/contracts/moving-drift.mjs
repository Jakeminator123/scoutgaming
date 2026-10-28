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

// The same dealer identifier as `croupier/media/dealers/<id>/` in private Blob.
export const MOVING_DRIFT_DEALER_ID=/^[a-z][a-z0-9-]{0,39}$/;

// One shared, explicit configuration parser for Admin and the game runtime.
// No environment reads or connection at module import. Each profile belongs
// to exactly one dealer and one endpoint: drift state is kept per dealer, and
// an endpoint shared between dealers would let one dealer's Off drain the other.
export function movingDriftConfiguration(env={}) {
  if(env.CROUPIER_STUDIO_MOVING_DRIFT_API!=='1') return null;
  const raw=env.CROUPIER_STUDIO_MOVING_DRIFT_PROFILES;
  if(typeof raw!=='string'||new TextEncoder().encode(raw).byteLength>8192) throw driftError('drift_invalid_configuration',422);
  let profiles;
  try {profiles=JSON.parse(raw);} catch {throw driftError('drift_invalid_configuration',422);}
  const keys=['id','label','dealerId','endpointId','releaseDigest','bankHash'];
  const unique=key=>new Set(profiles.map(profile=>profile[key])).size===profiles.length;
  if(!Array.isArray(profiles)||!profiles.length||profiles.length>8||profiles.some(profile=>
    !profile||typeof profile!=='object'||Array.isArray(profile)
    ||Object.keys(profile).length!==keys.length||keys.some(key=>!Object.hasOwn(profile,key))
    ||typeof profile.dealerId!=='string'||!MOVING_DRIFT_DEALER_ID.test(profile.dealerId))
    ||!['id','dealerId','endpointId'].every(unique)) {
    throw driftError('drift_invalid_configuration',422);
  }
  return Object.freeze({profiles:structuredClone(profiles)});
}

/** The one profile of a dealer, or null. The controller catalogue is this profile alone. */
export function movingDriftDealerProfile(configuration,dealerId) {
  const matches=configuration?.profiles?.filter(profile=>profile.dealerId===dealerId)??[];
  return matches.length===1?matches[0]:null;
}
