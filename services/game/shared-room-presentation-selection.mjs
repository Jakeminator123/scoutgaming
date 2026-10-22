import { randomUUID } from 'node:crypto';
import { cloneStudioJson, canonicalStudioJson } from '../../packages/studio-registry/server/storage-contract.mjs';
import { validateRoomGameMaterial } from '../../packages/presentation/contracts/room-game-config.mjs';
import { buildRuntimeCatalog } from '../../packages/presentation/contracts/studio-model.mjs';
import { prepareDecision } from '../../packages/director/engine.mjs';
import { gateRecordedSpeechSelection, recordedSpeechResult } from '../../packages/presentation/runtime/recorded-speech-selection.mjs';
import { filmedDealSelection } from './filmed-deal-selection.mjs';
import { selectRegisteredIdleRule } from './presentation-selection.mjs';
const fail=()=>{throw Object.assign(new Error('shared_room_presentation_unavailable'),{code:'shared_room_presentation_unavailable',statusCode:503});};
const same=(a,b)=>canonicalStudioJson(a)===canonicalStudioJson(b);
const SELECTION_MODES=new Set(['off','rules','random','shadow','active']);
const phaseOf=event=>event?.type==='speak'?'speak':event?.type==='reveal'?'reveal':event?.type==='deal'?'deal':'idle';
// A published room selects clips by the composition's saved per-phase mode
// (Admin: Automatik / OpenClaw). The player's request mode never widens or
// narrows it; it only applies where no frozen composition is in force.
export function publishedSelectionMode(lane,event,fallback='off'){
  const value=lane?.openclaw?.[phaseOf(event)];
  return SELECTION_MODES.has(value)?value:fallback;
}
export function idleRuleFor(body,project,inventory,sourceEvent,requestId,mode=body.mode){
  const choice=selectRegisteredIdleRule({project,dealerId:body.dealerId,sourceEvent,mode,requestId},{inventory});
  return choice&&typeof requestId==='string'?{...choice,requestId,mode,version:body.version,presentationContext:body.presentationContext??null,expiresAt:new Date(Date.now()+30000).toISOString()}:null;
}
function narrow(frozen,capture,body){
  if(!['en','sv'].includes(capture.language)||!same(capture.presentationContext,body.presentationContext)||capture.roomId!==body.sharedRoom.roomId||capture.talkId!==body.sharedRoom.talkId
    ||capture.version!==body.version||capture.version!==body.sharedRoom.ver||capture.packageRevision!==body.presentationContext.packageRevision
    ||!same(frozen.context,body.presentationContext)||frozen.dealer?.id!==body.dealerId||!frozen.project||!Array.isArray(frozen.inventory?.videos))fail();
  let material;try{material=validateRoomGameMaterial(capture.material,{dealerId:body.dealerId,language:capture.language});}catch{fail();}
  const wanted=new Map(material.media.map(row=>[row.id,row.sha256]));
  const videos=frozen.inventory.videos.filter(row=>{
    if(wanted.get(row.id)!==row.sha256||row.available!==true)return false;
    if([row.dealer,row.dealerId,row.classification?.dealerId].some(owner=>owner!==undefined&&owner!==body.dealerId))return false;
    if(![row.dealer,row.dealerId,row.classification?.dealerId].includes(body.dealerId))return false;
    const speech=row.recordedSpeech??row.classification?.recordedSpeech;
    return (!speech||speech.language===capture.language)&&(row.classification?.language===undefined||row.classification.language===capture.language);
  });
  if(new Set(videos.map(row=>row.id)).size!==videos.length)fail();
  const allowed=new Map(videos.map(row=>[row.id,row]));
  const families=(frozen.inventory.families??[]).filter(row=>row.dealerId===body.dealerId).map(row=>({...row,
    standardIds:(row.standardIds??[]).filter(id=>allowed.has(id)),variantIds:(row.variantIds??[]).filter(id=>allowed.has(id))}));
  const project=structuredClone(frozen.project);
  project.dealers=project.dealers.filter(row=>row.id===body.dealerId);
  project.lines=project.lines.filter(row=>row.dealerId===body.dealerId);
  if(project.dealerIdlePolicies)project.dealerIdlePolicies=project.dealerIdlePolicies.filter(row=>row.dealerId===body.dealerId);
  for(const line of project.lines)for(const variant of line.variants)if(variant.videoGenerationId&&!allowed.has(variant.videoGenerationId))variant.videoGenerationId=null;
  return {project,inventory:{videos:structuredClone(videos),families:structuredClone(families)},allowed};
}
// Media/Director work happens outside the access port's two SQL captures.
export async function selectSharedRoomPresentation({capture,body,frozenDealerContext,select,settings={},directorFetchFactory,request,playerId,signal}){
  signal.throwIfAborted();
  const frozen=cloneStudioJson(await frozenDealerContext.resolve(body.presentationContext),{maxBytes:8*1024*1024});signal.throwIfAborted();
  const {project,inventory,allowed}=narrow(frozen,capture,body),sourceEvent=capture.sourceEvent,published=capture.published;
  const publicVideo=id=>{
    if(id==null)return null;
    const record=allowed.get(id);if(!record)fail();
    const raw=frozenDealerContext.publicVideo(frozen,id);if(!raw)fail();
    const value=cloneStudioJson(raw,{maxBytes:32768});
    const prefix='/api/presentation/registered-video/'+[body.presentationContext.operatorSlug,capture.roomId,capture.packageRevision,body.dealerId,id].join('/');
    if(value.id!==id||value.sha256!==record.sha256||value.src!==prefix)fail();
    return Object.fromEntries(['id','sha256','fileName','src','compositing','framing','recordedSpeech'].filter(key=>Object.hasOwn(value,key)).map(key=>[key,value[key]]));
  };
  const base={owner:'web',projectRevision:frozen.projectRevision,configurationSource:frozen.configurationSource};
  const finish=async value=>{
    signal.throwIfAborted();const current=await frozenDealerContext.resolve(body.presentationContext);signal.throwIfAborted();
    narrow(current,capture,body);
    if(current.projectRevision!==frozen.projectRevision||!same(current.project,frozen.project)||!same(current.inventory,frozen.inventory))fail();
    return cloneStudioJson({...base,...value},{maxBytes:256*1024});
  };
  const requestId=randomUUID();
  const mode=publishedSelectionMode(frozen.lane,sourceEvent,body.mode),idleMode=publishedSelectionMode(frozen.lane,{type:'idle'},body.mode);
  const rule=()=>{const value=idleRuleFor(body,project,inventory,sourceEvent,requestId,idleMode);return value&&allowed.has(value.videoId)?value:null;};
  if(['turn','settle'].includes(sourceEvent.type))return finish({video:null,standard:null,idleRule:rule(),decision:{requestId,sourceEvent}});
  const filmed=filmedDealSelection({project,inventory,dealerId:body.dealerId,sourceEvent,published,shoeTransitions:body.shoeTransitions===true});
  if(filmed){
    const video=filmed.video?{...publicVideo(filmed.video.id),filmedTake:filmed.filmedTake}:null;
    const transitions=Object.fromEntries(Object.entries(filmed.transitions??{}).map(([key,clip])=>[key,clip?publicVideo(clip.id):null]));
    return finish({video,standard:video,transitions,decision:{requestId,sourceEvent,media:{reason:filmed.result.decision.media.reason}},provider:'filmed-deal-sequence'});
  }
  const eventId=prepareDecision(buildRuntimeCatalog(project,body.dealerId),{event:sourceEvent,mode:'off'}).node.id;
  const fetchImpl=directorFetchFactory?await directorFetchFactory({req:request,playerId,project,readProject:async()=>project,signal}):null;
  if(fetchImpl!==null&&typeof fetchImpl!=='function')fail();signal.throwIfAborted();
  const result=await select({requestId,project,dealerId:body.dealerId,eventId,sourceEvent,mode},{settings,videoRegistry:inventory,...(fetchImpl?{fetchImpl}:{})});
  signal.throwIfAborted();
  const chosen=inventory.videos.find(row=>row.id===result.videoGenerationId);
  if(result.videoGenerationId&&!chosen)fail();
  const baseline=chosen&&mode!=='off'?await select({requestId,project,dealerId:body.dealerId,eventId,sourceEvent,mode:'off'},{settings,videoRegistry:inventory}):result;
  if(baseline.videoGenerationId&&!allowed.has(baseline.videoGenerationId))fail();
  const selected=gateRecordedSpeechSelection({video:chosen,standard:inventory.videos.find(row=>row.id===baseline.videoGenerationId)},
    {project,dealerId:body.dealerId,eventId,sourceEvent});
  const video=publicVideo(selected.video?.id),standard=publicVideo(selected.standard?.id);
  const gated=recordedSpeechResult(result,selected);
  return finish({video,standard,idleRule:rule(),provider:typeof result.provider==='string'?result.provider:'shared-selection',
    decision:{requestId,sourceEvent,mode,media:{videoId:video?.id??null,sha256:video?.sha256??null,
      reason:selected.blocked?'recorded_speech_unavailable':video?'shared_exact_material':gated.decision?.media?.reason==='position_clip_missing'?'position_clip_missing':'frozen_clip_missing'}}});
}
