// Explicit authoring/capture contract. Timing is a declared, hash-bound profile;
// the player must also check decoded duration before using its cues.
import {validateRouletteForegroundPolygons} from './roulette-idle-contract.mjs';
import {validateDealerFraming} from './dealer-framing.mjs';
import {materialById} from './material-catalog.mjs';

const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const fail=()=>{throw Object.assign(Error('studio_roulette_start_invalid'),{code:'studio_roulette_start_invalid',statusCode:422});};
const required=['tableDesignId','durationMs','wheelImpulseMs','ballReleaseMs'];
function exact(value,keys,optional=[]) {
  if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))
    ||Object.getOwnPropertySymbols(value).length||Object.getOwnPropertyNames(value).length!==Object.keys(value).length
    ||keys.some(key=>!Object.hasOwn(value,key))||Object.keys(value).some(key=>![...keys,...optional].includes(key)))fail();
  for(const key of Object.keys(value))if(!Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'))fail();
}
export function validateRouletteStartProfile(value) {
  exact(value,required,['foregroundPolygons']);
  const design=materialById(value.tableDesignId);
  if(design?.role!=='table'||design.game!=='roulette'
    ||!Number.isSafeInteger(value.durationMs)||value.durationMs<1000||value.durationMs>60000
    ||!Number.isSafeInteger(value.wheelImpulseMs)||!Number.isSafeInteger(value.ballReleaseMs)
    ||value.wheelImpulseMs<0||value.ballReleaseMs<value.wheelImpulseMs||value.ballReleaseMs>=value.durationMs)fail();
  if(Object.hasOwn(value,'foregroundPolygons'))validateRouletteForegroundPolygons(value.foregroundPolygons);
  return structuredClone(value);
}
export function validateRouletteStartBinding(value) {
  exact(value,['videoId',...required],['foregroundPolygons']);
  if(typeof value.videoId!=='string'||!uuid.test(value.videoId))fail();
  const {videoId,...profile}=value;
  return {videoId,...validateRouletteStartProfile(profile)};
}
export function validateFrozenRouletteStart(value,dealerId,validateRecord) {
  exact(value,['clip',...required],['foregroundPolygons']);
  const {clip:source,...profile}=value,clip=validateRecord(source),meta=clip?.classification;
  if(clip?.contentType!=='video/webm'||meta?.dealerId!==dealerId||meta.game!=='roulette'
    ||meta.eventId!=='roulette.wheel-start'||meta.action!=='wheel-start'||meta.situation!=='wheel-start'
    ||meta.kind!=='action'||meta.mediaType!==undefined||meta.archived===true||meta.playback!=='once'
    ||meta.compositing?.mode!=='alpha'||meta.startPose!=='VILA'||meta.endPose!=='VILA'||!meta.framing)fail();
  validateDealerFraming(meta.framing);
  return {clip,...validateRouletteStartProfile(profile)};
}
