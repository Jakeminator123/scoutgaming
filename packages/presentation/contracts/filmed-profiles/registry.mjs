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
// Jakob 2026-10-29: a dealer without its own filmed profile uses PAOW's as the
// standard instead of being blocked. The copy keeps PAOW's id and is marked
// inherited, so nothing can pass it off as the dealer's own calibration. Its
// takes stay PAOW's exact sha256 files: they give landings and geometry, and a
// dealer's own action clips still have to match them to count as takes.
const INHERITED_PAOW = Object.freeze({...PAOW_KEVIN_PROFILE, inherited: 'paow'});
export function filmedProfileOrPaow(dealerId){
  if (typeof dealerId !== 'string' || !/^[a-z0-9_-]{1,128}$/.test(dealerId)) return null;
  return registeredFilmedProfile(dealerId) ?? INHERITED_PAOW;
}
