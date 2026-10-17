import {createHash} from 'node:crypto';
import {planFilmedDealSequence, orderFilmedPresentationEvents} from '../packages/presentation/runtime/filmed-deal-sequence.mjs';
import {registeredFilmedProfile} from './public/dealer-filmed-profiles.mjs';

const fail = code => { throw Object.assign(Error(code), {statusCode:409}); };
export const presentationFingerprint = receipt => createHash('sha256').update(JSON.stringify([receipt.version,receipt.payload])).digest('hex');
function scopeKey(scope){
  const c=scope?.context;
  if(!/^[a-f0-9]{64}$/.test(scope?.ownerHash??'')||typeof scope.sessionRevision!=='string'||!scope.sessionRevision
    ||!c||typeof c.operatorSlug!=='string'||!c.operatorSlug||typeof c.roomId!=='string'||!c.roomId
    ||!Number.isSafeInteger(c.packageRevision)||c.packageRevision<1||typeof c.dealerId!=='string')return null;
  return JSON.stringify([scope.ownerHash,scope.sessionRevision,c.operatorSlug,c.roomId,c.packageRevision,c.dealerId]);
}

// A reservation exists only for a freshly committed opening command in this
// process. Restart, normal playback, another command, or any attempted claim
// closes the window. Browser-supplied events/frames are never accepted.
export function createMovingDealReservations({now=Date.now}={}) {
  const entries=new Map();
  return {
    committed({playerId,view,command,session}) {
      for(const [id,row]of entries)if(row.state!=='reserved'&&row.expires<=now())entries.delete(id);
      if(entries.get(playerId)?.version>=view.version)return;
      entries.delete(playerId);
      if(entries.size>=1000)return; // Fail closed under saturation; never evict an active owner.
      const scope=scopeKey(session?.movingSpeech);
      entries.set(playerId,{version:view.version,dealerId:command.dealer,scope,
        state:command.op==='start'&&scope?'open':'consumed',expires:now()+60000});
    },
    normal(playerId,version) {
      const row=entries.get(playerId);
      if(row?.version!==version)return;
      if(row.state==='reserved')fail('moving_deal_reserved');
      row.state='consumed';
    },
    claim(playerId,dealerId,version,scope) {
      const row=entries.get(playerId);
      if(!row||row.version!==version||row.dealerId!==dealerId||row.state!=='open'||row.expires<=now()
        ||row.scope!==scopeKey(scope))fail('moving_deal_not_available');
      row.state='reserved';
      return {assertCurrent(){if(entries.get(playerId)!==row||row.state!=='reserved')fail('moving_deal_changed');},
        finish(){if(entries.get(playerId)===row)row.state='consumed';}};
    },
    clear(playerId){entries.delete(playerId);},
  };
}

export function prepareMovingDealPlan({receipt,version,frozenContext,sourceSet,publicVideo,profile=registeredFilmedProfile(sourceSet?.dealerId)}={}) {
  if(!Number.isSafeInteger(version)||version<1||receipt?.version!==version||frozenContext?.schemaVersion!==3
    ||!frozenContext.project||typeof publicVideo!=='function')fail('moving_deal_context');
  let events;try{events=JSON.parse(receipt.payload);}catch{fail('moving_deal_instructions');}
  if(!Array.isArray(events)||!events.some(e=>e.type==='deal'&&e.to==='dealer'&&e.faceDown===true)
    ||events.some(e=>e.type==='reveal'))fail('moving_deal_opening_required');
  const refs=new Set(frozenContext.project.lines.filter(l=>l.dealerId===sourceSet.dealerId).flatMap(l=>l.variants.map(v=>v.videoGenerationId)));
  const inventory={videos:frozenContext.inventory.videos.filter(v=>refs.has(v.id))};
  const ordered=orderFilmedPresentationEvents(events);
  const selected=planFilmedDealSequence({profile,events:ordered,inventory,dealerId:sourceSet.dealerId});
  if(!selected.complete||!selected.steps.length)fail('moving_deal_'+(selected.reason??'empty'));
  const frames=[],steps=[],sources=new Map();
  for(const step of selected.steps){
    const take=profile.takes.find(t=>t.key===step.takeKey&&t.sha256===step.sha256);
    const source=sourceSet.clips.find(c=>c.videoId===step.videoId&&c.sha256===step.sha256);
    const published=frozenContext.records.find(r=>r.id===step.videoId);
    const video=publicVideo(step.videoId);
    if(!source||source.frameCount!==take.frames||source.fps!==24||published?.sha256!==source.sha256
      ||published.size!==source.bytes||published.classification?.recordedSpeech||!video?.src)fail('moving_deal_source_mismatch');
    const first=frames.length;
    for(let frame=0;frame<take.frames;frame++)frames.push({videoId:source.videoId,frame});
    sources.set(source.videoId,{...source,url:video.src});
    const event=ordered[step.eventIndex];
    steps.push({first,end:frames.length,video:{...video,filmedTake:{profileId:profile.id,takeKey:take.key}},
      event:{type:event.type,to:event.to,box:event.box??null,faceDown:event.faceDown===true,shoeDraw:event.shoeDraw}});
  }
  if(frames.length>1000)fail('moving_deal_too_long');
  return {version,fingerprint:presentationFingerprint(receipt),frames,steps,sources:[...sources.values()]};
}
