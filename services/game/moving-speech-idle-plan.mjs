import {createHash} from 'node:crypto';
import {ownDealerIdle} from '../../packages/presentation/runtime/registered-idle.mjs';
import {registeredIdlePolicy} from '../../packages/presentation/runtime/registered-idle-policy.mjs';
import {validateIdlePolicy} from '../../packages/presentation/runtime/idle-policy.mjs';

const fail = () => { throw Object.assign(Error('moving_idle_source_mismatch'), {code:'moving_idle_source_mismatch',statusCode:409}); };

// Speech owns the dealer layer while the ordinary idle chain is suspended.
// Its baseline is the frozen publication's explicit speech-ready resting clip,
// never the bank's first clip, a filename, or a browser-selected source.
export function prepareMovingIdleSource({frozenContext,sourceSet,publicVideo}={}) {
  const dealerId=sourceSet?.dealerId;
  if(frozenContext?.schemaVersion!==3||frozenContext.context?.dealerId!==dealerId
    ||frozenContext.dealer?.id!==dealerId||typeof publicVideo!=='function')fail();
  const baseline=ownDealerIdle(frozenContext.project,frozenContext.inventory,dealerId);
  const policy=registeredIdlePolicy(frozenContext.project,dealerId);
  try{validateIdlePolicy(policy);}catch{fail();}
  if(!baseline||policy.base[0].videoId!==baseline.id)fail();
  const source=sourceSet.clips.find(row=>row.videoId===baseline.id);
  const published=frozenContext.records.filter(row=>row.id===baseline.id);
  const video=publicVideo(baseline.id);
  if(!source||source.sha256!==baseline.sha256||source.bytes!==baseline.bytes
    ||published.length!==1||published[0].sha256!==source.sha256||published[0].size!==source.bytes
    ||published[0].classification?.recordedSpeech||source.fps!==24
    ||!Number.isSafeInteger(source.frameCount)||source.frameCount<1||source.frameCount>600
    ||video?.id!==source.videoId||video.sha256!==source.sha256||typeof video.src!=='string')fail();
  const value={source:{...source,url:video.src},video};
  return {...value,fingerprint:createHash('sha256').update(JSON.stringify([policy,value])).digest('hex')};
}

// The original frame count, not idlePolicy.durationMs, defines each complete
// cycle. The PCM/face plan covers `frameCount`; its last body's cycle completes
// with the player's existing explicit silent tail before ordinary idle resumes.
export function prepareMovingIdlePlan(idle,frameCount) {
  if(!idle?.source||!Number.isSafeInteger(frameCount)||frameCount<1||frameCount>600)fail();
  const count=Math.ceil(frameCount/idle.source.frameCount)*idle.source.frameCount;
  if(count>1000)fail();
  const frames=Array.from({length:count},(_,k)=>({take:idle.source.take,
    frame:k%idle.source.frameCount,sourceSha256:idle.source.sha256}));
  return {kind:'idle',steps:[{first:0,end:count,video:idle.video}],sources:[idle.source],frames};
}
