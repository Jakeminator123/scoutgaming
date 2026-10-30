import {registeredFilmedProfile,registeredFilmedProfileById} from './registry.mjs';
import {validateFilmedDealProfile} from '../filmed-profile.mjs';

// A dealer's own filmed profile (Admin › Dealers › Landningar), saved compactly
// in dealers[].filmedProfile and frozen with the package row and room material.
// 'copy': geometry, tracks and take timing come from a code profile; only the
// clip binding (sha256) is the dealer's own. 'measured': own geometry, no tracks
// (the card shows at landing). Tracks are never stored in Studio. Code profiles
// (dragan, paow) are seeds and never get a studio profile. Browser-safe.
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,required,optional=[])=>object(value)&&required.every(key=>Object.hasOwn(value,key))
  &&Object.keys(value).every(key=>required.includes(key)||optional.includes(key));
const fail=()=>{throw Object.assign(new Error('studio_filmed_profile_invalid'),{code:'studio_filmed_profile_invalid',statusCode:422});};
const TAKE_KEY=/^(?:[1-7]|dealer|hole|flip):(?:base|i|u|iu|v|iv)$/,POSES=['VILA','REDO'];
// Measured landings share Kevin's portrait plane; the card is a card, not the frame.
export const STUDIO_MEASURED_PLANE=Object.freeze({width:1080,height:1920,fps:24});
export const STUDIO_MEASURED_CARD_MAX=Object.freeze({width:216,height:320});
/** A copy may bind a longer clip than the code take (dealer-fabriken's -iu takes:
 * 68-81 frames against Kevin's 60, frames 0-59 identical). The take's window
 * (offsetFrames + tracked frames, every timed frame) ends at or before take.frames
 * (validateFilmedDealProfile), so any clip at least that long holds it; at most
 * twice as long. Returns the clip's frame count, or null when it does not fit. */
export function copyTakeFrames(take,frameCount) {
  return Number.isInteger(frameCount)&&Number.isInteger(take?.frames)&&frameCount>=take.frames&&frameCount<=take.frames*2?frameCount:null;
}

/** An appended return uses the base/i footage, not the separately filmed v/iv
 * take. Only that same-target, same-entry-pose derivation is supported. Timing
 * and tracks stay registered data; this is provenance, never visual approval. */
export function copiedFilmedTake(base,key,sourceTakeKey) {
  const destination=base?.takes.find(take=>take.key===key);
  if(!destination)return null;
  if(sourceTakeKey===undefined)return destination;
  const variant=destination.variant==='v'?'base':destination.variant==='iv'?'i':null;
  if(variant===null||sourceTakeKey!==`${destination.target}:${variant}`)return null;
  const source=base.takes.find(take=>take.key===sourceTakeKey);
  if(!source||source.startPose!==destination.startPose||source.endPose!=='REDO'||destination.endPose!=='VILA')return null;
  return {...source,key:destination.key,variant:destination.variant,endPose:destination.endPose};
}

function expand(value,dealerId) {
  const source={studio:{dealerId,kind:value.kind,...(value.kind==='copy'?{base:value.base}:{})}};
  const repositoryPath=key=>`studio/${dealerId}/${key}`;
  if(value.kind==='copy') {
    const base=registeredFilmedProfileById(value.base);
    return validateFilmedDealProfile({...base,id:value.id,source,takes:base.takes.filter(take=>Object.hasOwn(value.takes,take.key))
      .map(take=>{
        const binding=value.takes[take.key],sourceTake=copiedFilmedTake(base,take.key,binding.sourceTakeKey);
        return {...sourceTake,sha256:binding.sha256,repositoryPath:repositoryPath(take.key),frames:binding.frames??sourceTake.frames};
      })});
  }
  return validateFilmedDealProfile({version:1,id:value.id,game:'blackjack',source,plane:{...value.plane},card:{...value.card},
    positions:structuredClone(value.positions),tracks:{},timingEvidence:'studio-measured',
    takes:Object.entries(value.takes).map(([key,take])=>{
      const [target,name]=key.split(':'),variant=name==='base'?'':name,contact=take.contactFrame??take.landFrame;
      return {key,target,variant,track:target+(variant.endsWith('v')?'v':''),sha256:take.sha256,repositoryPath:repositoryPath(key),
        frames:take.frames,offsetFrames:0,startPose:take.startPose,endPose:take.endPose,firstFaceFrame:contact,contactFrame:contact,
        landFrame:take.landFrame,clearFrame:take.clearFrame??take.landFrame};
    })});
}
function checked(value,dealerId) {
  if(!object(value)||value.schemaVersion!==1||typeof dealerId!=='string'||registeredFilmedProfile(dealerId)
    ||typeof value.id!=='string'||value.id.length>100||!/^studio-[a-z0-9-]+-[a-f0-9]{8}$/.test(value.id)||!value.id.startsWith(`studio-${dealerId}-`)) fail();
  const takes=object(value.takes)?Object.entries(value.takes):[];
  if(value.kind==='copy') {
    const base=exact(value,['schemaVersion','id','kind','base','takes'])&&registeredFilmedProfileById(value.base);
    // A copy binds the dealer's own clips: never the code profile's own (Kevin's) media.
    const own=new Set(base?base.takes.map(row=>row.sha256):[]);
    if(!base||!takes.length||takes.some(([key,take])=>{
      const row=copiedFilmedTake(base,key,take?.sourceTakeKey);
      return !row||!exact(take,['sha256'],['frames','sourceTakeKey'])||own.has(take.sha256)
        ||Object.hasOwn(take,'sourceTakeKey')&&(!Object.hasOwn(take,'frames')||take.frames<=row.frames)
        ||Object.hasOwn(take,'frames')&&(take.frames===row.frames||copyTakeFrames(row,take.frames)===null);
    })) fail();
  } else if(value.kind==='measured') {
    if(!exact(value,['schemaVersion','id','kind','plane','card','positions','takes','measuredAt'])||!takes.length||takes.length>128
      ||!exact(value.plane,['width','height','fps'])||Object.keys(STUDIO_MEASURED_PLANE).some(key=>value.plane[key]!==STUDIO_MEASURED_PLANE[key])
      ||!exact(value.card,['width','height'])||Object.keys(STUDIO_MEASURED_CARD_MAX).some(key=>!Number.isFinite(value.card[key])||value.card[key]<=0||value.card[key]>STUDIO_MEASURED_CARD_MAX[key])
      ||typeof value.measuredAt!=='string'||!Number.isFinite(Date.parse(value.measuredAt))||new Date(value.measuredAt).toISOString()!==value.measuredAt
      ||takes.some(([key,take])=>!TAKE_KEY.test(key)||!exact(take,['sha256','frames','startPose','endPose','landFrame'],['contactFrame','clearFrame'])
        ||!POSES.includes(take.startPose)||!POSES.includes(take.endPose))) fail();
  } else fail();
  if(takes.some(([,take])=>typeof take.sha256!=='string'||!/^[a-f0-9]{64}$/.test(take.sha256))) fail();
  try { return expand(value,dealerId); } catch { return fail(); }
}
/** The compact profile, unchanged, or a 422 studio_filmed_profile_invalid. */
export function validateStudioFilmedProfile(value,{dealerId}={}) {
  checked(value,dealerId);
  return structuredClone(value);
}
/** The full version-1 profile the engine and player read. */
export function expandStudioFilmedProfile(value,{dealerId}={}) {
  return checked(value,dealerId);
}
/** A frozen package row (or saved project dealer) first, the code profile as seed and fallback. */
export function filmedProfileFor(dealerId,{registeredDealers,project}={}) {
  const row=(registeredDealers??project?.dealers??[]).find(item=>item?.id===dealerId);
  return row&&Object.hasOwn(row,'filmedProfile')?expandStudioFilmedProfile(row.filmedProfile,{dealerId}):registeredFilmedProfile(dealerId);
}
