import { DRAGAN_KEVIN_PROFILE } from '../../packages/presentation/contracts/filmed-profiles/kevin-dragan-f15b2af1.mjs';
// Source calibrations are data used by the shared player, never a dealer fork.
export function registeredFilmedProfile(dealerId) {
  return dealerId==='dragan'?DRAGAN_KEVIN_PROFILE:null;
}
