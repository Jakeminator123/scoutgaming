import {DRAGAN_KEVIN_PROFILE} from './kevin-dragan-f15b2af1.mjs';
import {PAOW_KEVIN_PROFILE} from './kevin-paow-c7138759.mjs';
// The register of filmed dealer profiles: each dealer's profile, named once here.
// The editor and player use the same source calibration; nothing else branches on
// a dealer id. A new filmed dealer is one more row (a profile file and its dealer).
const PROFILES = new Map([
  ['dragan', DRAGAN_KEVIN_PROFILE],
  ['paow', PAOW_KEVIN_PROFILE],
]);
if (new Set([...PROFILES.values()].map(profile => profile.id)).size !== PROFILES.size) throw Error('Invalid filmed profile register');
const BY_ID = new Map([...PROFILES.values()].map(profile => [profile.id, profile]));
export function registeredFilmedProfile(dealerId){
  return typeof dealerId === 'string' ? PROFILES.get(dealerId) ?? null : null;
}
// A dealer's studio profile (studio-profile.mjs) names its code base by profile id.
export function registeredFilmedProfileById(profileId){
  return typeof profileId === 'string' ? BY_ID.get(profileId) ?? null : null;
}
