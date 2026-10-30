import { randomUUID, createHash } from 'node:crypto';
import { cloneStudioJson, canonicalStudioJson } from '../../packages/studio-registry/server/storage-contract.mjs';
import { validateRoomGameMaterial } from '../../packages/presentation/contracts/room-game-config.mjs';
import { buildRuntimeCatalog } from '../../packages/presentation/contracts/studio-model.mjs';
import { prepareDecision } from '../../packages/director/engine.mjs';
import { gateRecordedSpeechSelection, recordedSpeechResult } from '../../packages/presentation/runtime/recorded-speech-selection.mjs';
import { nativeRoomFilmedPlanning } from '../../packages/presentation/contracts/native-room-filmed-planning.mjs';
import { transitionClipsForDealer } from '../../packages/presentation/runtime/shoe-transitions.mjs';
import { filmedDealSelection } from './filmed-deal-selection.mjs';
import { selectRegisteredIdleRule } from './presentation-selection.mjs';
import { idleGameEvent } from '../../packages/presentation/server/idle-advice.mjs';
const fail=()=>{throw Object.assign(new Error('shared_room_presentation_unavailable'),{code:'shared_room_presentation_unavailable',statusCode:503});};
const same=(a,b)=>canonicalStudioJson(a)===canonicalStudioJson(b);
const SELECTION_MODES=new Set(['off','rules','random','shadow','active']);
const phaseOf=event=>event?.type==='speak'?'speak':event?.type==='reveal'?'reveal':event?.type==='deal'?'deal':'idle';
// A published room selects clips by the composition's saved per-phase mode
// (Admin: Automatik / OpenClaw). The player's request mode never widens or
// narrows it. A frozen package without a saved mode fails closed to 'off'.
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
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
// The room's idle mode active/shadow: a committed turn or settlement asks OpenClaw
// for one idle reaction (no chat needed). Shadow only records the would-be choice.
// Advice is optional: a refusal, rate limit or provider error answers null.
// One answer per room and event: the request id, source and cache scope name the
// room's event, never the player, so every player's request shares one Director
// call. The source time is the event's publication, so the 30 s limit holds.
const logAdvice=entry=>console.info(JSON.stringify(entry));
async function gameEventAdvice({adviseIdle,frozen,project,capture,body,sourceEvent,requestId,mode,directorFetchFactory,request,playerId,signal,log}){
  const reaction=idleGameEvent(sourceEvent);
  if(typeof adviseIdle!=='function'||!reaction||!Array.isArray(frozen.idleInventory?.videos))return null;
  try{
    const fetchImpl=directorFetchFactory?await directorFetchFactory({req:request,playerId,project,readProject:async()=>project,signal}):null;
    if(fetchImpl!==null&&typeof fetchImpl!=='function')return null;
    signal.throwIfAborted();
    if(!Number.isFinite(capture.publishedAt))return null;
    const key=[capture.roomId,capture.talkId,capture.version,sourceEvent.type,sourceEvent.box??null,sourceEvent.handIndex??null];
    const result=await adviseIdle({requestId:'game:'+digest([key,body.dealerId,mode]).slice(0,40),project,dealerId:body.dealerId,mode,
      sourceRef:{kind:'game-event',channel:'room:'+digest(capture.roomId).slice(0,32),revision:capture.version,
        messageId:'event:'+digest(key).slice(0,40),at:new Date(capture.publishedAt).toISOString(),event:reaction},gameEvent:sourceEvent},
      {signal,committedEvent:true,videoRegistry:frozen.idleInventory,cacheScope:digest([body.presentationContext,fetchImpl?.cacheScope??null]),...(fetchImpl?{fetchImpl}:{})});
    const own=id=>typeof id==='string'&&frozen.idleInventory.videos.some(row=>row.id===id&&row.role==='variant')?id:null;
    const advice={requestId,mode,event:reaction,videoId:mode==='active'?own(result?.videoId):null,wouldChooseId:own(result?.wouldChooseId),
      provider:typeof result?.provider==='string'?result.provider:'idle_advice_unavailable_baseline',expiresAt:result?.expiresAt??null,
      version:body.version,presentationContext:body.presentationContext??null};
    // The record of a shadow choice: room, dealer, event and clip ids only, never a player.
    log({event:'idle_game_event_advice',roomId:capture.roomId,dealerId:body.dealerId,mode,reaction,
      videoId:advice.videoId,wouldChooseId:advice.wouldChooseId,provider:advice.provider});
    return advice;
  }catch{signal.throwIfAborted();return null;}
}
// Media/Director work happens outside the access port's two SQL captures.
export async function selectSharedRoomPresentation({capture,body,frozenDealerContext,select,settings={},directorFetchFactory,request,playerId,signal,adviseIdle=null,log=logAdvice}){
  signal.throwIfAborted();
  // Expanded copied profiles carry frame/quad arrays alongside the package's
  // inventory and records (a valid 104-clip package has 25449 nodes). Keep this
  // server-owned snapshot bounded independently of ordinary Studio documents.
  const frozen=cloneStudioJson(await frozenDealerContext.resolve(body.presentationContext),{maxBytes:8*1024*1024,maxNodes:200000});signal.throwIfAborted();
  const {project,inventory,allowed}=narrow(frozen,capture,body),sourceEvent=capture.sourceEvent,published=capture.published;
  const publicVideo=id=>{
    if(id==null)return null;
    const record=allowed.get(id);if(!record)fail();
    const raw=frozenDealerContext.publicVideo(frozen,id);if(!raw)fail();
    const value=cloneStudioJson(raw,{maxBytes:32768});
    const prefix='/api/presentation/room-video/'+[body.presentationContext.operatorSlug,capture.roomId,capture.packageRevision,body.dealerId,id].join('/');
    if(value.id!==id||value.sha256!==record.sha256||value.src!==prefix)fail();
    const keys=['id','sha256','fileName','src','compositing','framing','recordedSpeech'];
    if(value.recordedSpeech?.schemaVersion===2)keys.push('contentType','bytes','mediaTiming');
    return Object.fromEntries(keys.filter(key=>Object.hasOwn(value,key)).map(key=>[key,value[key]]));
  };
  const base={owner:'web',projectRevision:frozen.projectRevision,configurationSource:frozen.configurationSource};
  const finish=async value=>{
    signal.throwIfAborted();const current=await frozenDealerContext.resolve(body.presentationContext);signal.throwIfAborted();
    narrow(current,capture,body);
    if(current.projectRevision!==frozen.projectRevision||!same(current.project,frozen.project)||!same(current.inventory,frozen.inventory))fail();
    return cloneStudioJson({...base,...value},{maxBytes:256*1024});
  };
  const requestId=randomUUID();
  const mode=publishedSelectionMode(frozen.lane,sourceEvent,'off'),idleMode=publishedSelectionMode(frozen.lane,{type:'idle'},'off');
  const rule=()=>{const value=idleRuleFor(body,project,inventory,sourceEvent,requestId,idleMode);return value&&allowed.has(value.videoId)?value:null;};
  if(['turn','settle'].includes(sourceEvent.type)){
    const idleAdvice=['active','shadow'].includes(idleMode)?await gameEventAdvice({adviseIdle,frozen,project,capture,body,sourceEvent,
      requestId,mode:idleMode,directorFetchFactory,request,playerId,signal,log}):null;
    return finish({video:null,standard:null,idleRule:rule(),...(idleAdvice?{idleAdvice}:{}),decision:{requestId,sourceEvent}});
  }
  let nativePlanning;
  try { nativePlanning=nativeRoomFilmedPlanning(capture.material); } catch { fail(); }
  if(nativePlanning) {
    const selected=transitionClipsForDealer(project,inventory,body.dealerId);
    for(const direction of ['toShoe','fromShoe']) {
      const expected=nativePlanning.transitions[direction],actual=selected[direction];
      if(Boolean(expected)!==Boolean(actual)||expected&&(expected.id!==actual.id||expected.sha256!==actual.sha256))fail();
    }
  }
  // The room material's frozen landings, else the package row's (frozen.filmedProfile), else the code profile.
  const filmed=filmedDealSelection({project,inventory,dealerId:body.dealerId,sourceEvent,published,profile:nativePlanning?.dealerId===body.dealerId?nativePlanning.profile:frozen.filmedProfile,
    shoeTransitions:nativePlanning?true:body.shoeTransitions===true});
  if(nativePlanning&&['deal','reveal'].includes(sourceEvent.type)&&!filmed?.video)fail();
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
