import {createHash} from 'node:crypto';
import {validateProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {registeredFilmedProfile} from '../../../packages/presentation/contracts/filmed-profiles/registry.mjs';
import {validateStudioFilmedProfile,filmedProfileFor} from '../../../packages/presentation/contracts/filmed-profiles/studio-profile.mjs';
import {filmedTakePlacement} from '../../../packages/presentation/contracts/filmed-bank-bindings.mjs';
import {requiredNativeFilmedTakes} from '../../../packages/presentation/runtime/filmed-deal-coverage.mjs';
import {canonicalStudioJson,StudioStorageError,validateRevision} from '../../../packages/studio-registry/server/document-contract.mjs';
import {assertLifecyclePackages} from './dealer-lifecycle.mjs';
import {filmedTableTemplate} from './filmed-table-template.mjs';

// Admin › Dealers › Landningar: dealers[].filmedProfile in the saved project.
// Same CAS and journal as every project save (document_history, audit_events).
// Copy binds the dealer's own clips to a code profile's landings only on an
// exact match; it never guesses a clip. Publication freezes the result.
const fail=(code,status=409,details={})=>{throw Object.assign(new StudioStorageError(code,status),{filmedProfileDetails:details});};
const ownClip=dealerId=>row=>row.classification?.dealerId===dealerId&&row.classification.kind==='action'&&!row.deletion
  &&row.classification.archived!==true&&row.classification.game!=='roulette'&&!row.classification.mediaType;
const studioId=(dealerId,value)=>`studio-${dealerId}-${createHash('sha256').update(canonicalStudioJson(value)).digest('hex').slice(0,8)}`;
const timed=(row,fps,frames)=>row.mediaTiming?.video?.fps===fps&&row.mediaTiming.video.frameCount===frames;

/** Copy a code profile's landings: per take the dealer's one clip in the same slot and poses, at exactly the same frames. */
export function copyFilmedProfile({dealerId,from,records}) {
  const base=registeredFilmedProfile(from);
  if(!base)fail('studio_filmed_profile_source_unknown',422);
  const clips=records.filter(ownClip(dealerId)),takes={},mismatch=[],candidates=[];
  const required=new Set(requiredNativeFilmedTakes({profile:base,dealerId:from}).requiredTakeKeys??[]);
  for(const take of base.takes) {
    const slot=filmedTakePlacement(take),name=take.repositoryPath.split('/').at(-1).replace(/\.mp4$/,'');
    let rows=clips.filter(row=>row.classification.eventId===slot.eventId&&row.classification.situation===slot.situation
      &&row.classification.startPose===take.startPose&&row.classification.endPose===take.endPose);
    // Kevin's file name (pos1-i) separates two clips with the same slot and poses.
    if(rows.length>1&&rows.some(row=>row.classification.label===name))rows=rows.filter(row=>row.classification.label===name);
    if(rows.length>1)candidates.push({key:take.key,videoIds:rows.map(row=>row.id)});
    else if(!rows.length){if(required.has(take.key))mismatch.push({key:take.key,reason:'missing'});}
    else if(!timed(rows[0],base.plane.fps,take.frames))mismatch.push({key:take.key,reason:'frames',videoId:rows[0].id,frames:take.frames,measured:rows[0].mediaTiming?.video?.frameCount??null});
    else takes[take.key]={sha256:rows[0].sha256};
  }
  if(mismatch.length)fail('studio_filmed_profile_mismatch',422,{mismatch});
  if(candidates.length)fail('studio_filmed_profile_candidates',409,{candidates});
  const value={schemaVersion:1,kind:'copy',base:base.id,takes};
  return validateStudioFilmedProfile({...value,id:studioId(dealerId,value)},{dealerId});
}
/** Own measured landings; every take names one of the dealer's clips at its exact frames. */
export function measuredFilmedProfile({dealerId,measurement,records,now=new Date()}) {
  if(!measurement||typeof measurement!=='object'||Object.keys(measurement).sort().join(',')!=='card,plane,positions,takes')fail('studio_invalid_request',400);
  const value={schemaVersion:1,kind:'measured',...structuredClone(measurement),measuredAt:now.toISOString()};
  const profile=validateStudioFilmedProfile({...value,id:studioId(dealerId,{...value,measuredAt:null})},{dealerId});
  const mismatch=Object.entries(profile.takes).filter(([,take])=>!records.some(row=>ownClip(dealerId)(row)&&row.sha256===take.sha256
    &&row.classification.startPose===take.startPose&&row.classification.endPose===take.endPose&&timed(row,profile.plane.fps,take.frames)))
    .map(([key])=>({key,reason:'frames'}));
  if(mismatch.length)fail('studio_filmed_profile_mismatch',422,{mismatch});
  return profile;
}
/** GET: the source, geometry, each take's binding and the landing template. */
export async function readDealerFilmedProfile({repository,dealerId}) {
  const project=(await repository.readDocument('project'))?.value;
  const dealer=project?.dealers.find(row=>row.id===dealerId);
  if(!dealer)fail('studio_dealer_missing');
  const studio=Object.hasOwn(dealer,'filmedProfile'),profile=filmedProfileFor(dealerId,{project});
  if(!profile)return {source:null,profile:null,positions:null,card:null,plane:null,takes:[],template:null};
  const records=(await repository.listMedia({limit:5000})).filter(ownClip(dealerId));
  return {source:studio?'studio':'code',profile:studio?dealer.filmedProfile:{id:profile.id,seed:true},
    positions:profile.positions,card:profile.card,plane:profile.plane,
    takes:profile.takes.map(take=>{const video=records.find(row=>row.sha256===take.sha256);return {key:take.key,...(video?{videoId:video.id}:{}),status:video?'bound':'missing'};}),
    template:filmedTableTemplate(dealerId,{profileFor:id=>filmedProfileFor(id,{project})})};
}
/** PUT ({expectedRevision, copyFrom} | {expectedRevision, measurement}) and DELETE ({expectedRevision}). */
export async function changeDealerFilmedProfile({repository,gamePolicy,mutationTransaction,stillAuthorized,dealerId,body,remove=false}) {
  if(typeof mutationTransaction!=='function'||typeof repository?.readDocument!=='function')fail('studio_mutation_transaction_required',503);
  const fields=body&&typeof body==='object'?Object.keys(body).sort().join(','):'';
  if(!(remove?['expectedRevision']:['copyFrom,expectedRevision','expectedRevision,measurement']).includes(fields))fail('studio_invalid_request',400);
  validateRevision(body.expectedRevision);
  // dragan and paow stay code seeds; they never get a studio copy (no regression).
  if(registeredFilmedProfile(dealerId))fail('studio_filmed_profile_seeded');
  const before=await repository.readDocument('project');
  if(!before||before.revision!==body.expectedRevision)fail('studio_conflict');
  const dealer=before.value.dealers.find(row=>row.id===dealerId);
  if(!dealer)fail('studio_dealer_missing');
  let filmedProfile=null;
  if(remove) {
    if(!Object.hasOwn(dealer,'filmedProfile'))fail('studio_filmed_profile_missing');
    assertLifecyclePackages(await repository.listLifecyclePackages(),{dealerId});
  } else {
    const records=await repository.listMedia({limit:5000});
    filmedProfile=body.copyFrom!==undefined?copyFilmedProfile({dealerId,from:body.copyFrom,records}):measuredFilmedProfile({dealerId,measurement:body.measurement,records});
  }
  const next=structuredClone(before.value),row=next.dealers.find(item=>item.id===dealerId);
  if(remove)delete row.filmedProfile;else row.filmedProfile=filmedProfile;
  try{validateProject(next,{allowIncompatibleAnimations:true});}catch{fail('studio_filmed_profile_invalid',422);}
  return mutationTransaction(async()=>{
    const actor=await stillAuthorized();
    if(gamePolicy)return gamePolicy.projectStore({actor}).save(next,before.revision);
    return (await repository.saveDocument('project',{value:next,expectedRevision:before.revision,actor})).value;
  },{presentationMutation:{kind:'project',value:next}});
}
