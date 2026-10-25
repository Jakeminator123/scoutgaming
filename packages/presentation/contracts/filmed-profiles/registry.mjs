import {DRAGAN_KEVIN_PROFILE} from './kevin-dragan-f15b2af1.mjs';
import {PAOW_KEVIN_PROFILE} from './kevin-paow-c7138759.mjs';
// The editor and player use the same source calibration.
export function registeredFilmedProfile(dealerId){
  if(dealerId==='dragan')return DRAGAN_KEVIN_PROFILE;
  if(dealerId==='paow')return PAOW_KEVIN_PROFILE;
  return null;
}
