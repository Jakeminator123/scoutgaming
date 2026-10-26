import {planFilmedDealSequence,orderFilmedPresentationEvents} from './filmed-deal-sequence.mjs';

// Kevin's per-take timeline for main's three-layer player (K = kevin/croupier-scoutgg @ 5aa7ed10).
// readyTimeline (K server/shared-table.mjs:114-135) gives every dealing step the real length of the
// take it plays (meta frames at 24 fps, :129-130), joins REDO->REDO takes back to back and leaves
// 80 ms between takes that do not join (:132); a plan opens 700 ms after its command, 1500 ms when
// it opens on the flip (:150). Main's game window stays the coordinator's startAt + leadMs +
// draws*cardMs (material-revision.mjs): this module never moves a deadline, it reports deviationMs
// and a per-step fit when the real chain would run past the window (K04-mappning G3).
// Pure: no DOM, no clock. Times are milliseconds relative to the plan's startAt (table clock).
export const FILMED_TAKE_GAP_MS=80;                                       // K shared-table.mjs:132
export const FILMED_OPEN_LEAD_MS=Object.freeze({deal:700,reveal:1500});   // K shared-table.mjs:150
export const FILMED_HANDOVER_FRAMES=1.5;                                  // K app.js:192
export const FILMED_SEEK_THRESHOLD_S=.15, FILMED_SEEK_END_MARGIN_S=.04;   // K video-preloader.js:19
export const FILMED_FIT_RATE=Object.freeze({min:.6,max:2});               // K app.js:225
export const FILMED_CATCH_UP_S=.4;                                        // K app.js:184

const finite=value=>Number.isFinite(value);
const refused=(plan,profile,reason)=>({profileId:plan?.profileId??profile?.id??null,complete:false,reason,steps:[]});

// plan: planFilmedDealSequence() result (steps with takeKey per committed deal/reveal).
// Window: endAt - startAt, or the coordinator's leadMs + draws*cardMs (draws = deal steps unless given).
// openLeadMs: time before the first take (Kevin's 700/1500 rule unless given); fps: the profile's.
export function timeFilmedDealSequence(plan,profile,{startAt=0,leadMs,cardMs,draws,endAt,fps,openLeadMs,transitions={}}={}) {
  if (!plan||plan.complete!==true||!Array.isArray(plan.steps)) return refused(plan,profile,plan?.reason??'plan_missing');
  const rate=finite(fps)&&fps>0?fps:profile?.plane?.fps;
  if (!finite(rate)||rate<=0||!Array.isArray(profile?.takes)) return refused(plan,profile,'profile_invalid');
  const takes=new Map(profile.takes.map(take=>[take.key,take]));
  if (plan.steps.some(step=>!takes.has(step.takeKey))) return refused(plan,profile,'take_missing');
  const transitionTimes=new Map(Object.values(transitions).filter(Boolean).map(clip=>[clip.id,clip.durationMs]));
  if(plan.steps.some(step=>[step.beforeVideoId,step.afterVideoId].some(id=>id&&(!finite(transitionTimes.get(id))||transitionTimes.get(id)<=0))))
    return refused(plan,profile,'transition_timing_missing');
  const ms=frames=>frames*1000/rate;
  const lead=finite(openLeadMs)&&openLeadMs>=0?openLeadMs:FILMED_OPEN_LEAD_MS[plan.steps[0]?.type==='reveal'?'reveal':'deal'];
  // A join is two adjacent instructions whose takes meet at REDO without a separate shoe clip between them
  // (planFilmedDealSequence chose the variants on the same adjacency; a speech or boundary breaks it).
  const joined=(left,right)=>Boolean(left&&right&&right.eventIndex===left.eventIndex+1&&takes.get(left.takeKey).endPose==='REDO'
    &&takes.get(right.takeKey).startPose==='REDO'&&!left.afterVideoId&&!right.beforeVideoId);
  let at=lead;const steps=[];
  plan.steps.forEach((step,i)=>{
    const take=takes.get(step.takeKey),joinBefore=joined(plan.steps[i-1],step),joinAfter=joined(step,plan.steps[i+1]);
    const durationMs=ms(take.frames),gapAfterMs=joinAfter?0:FILMED_TAKE_GAP_MS;
    const beforeMs=transitionTimes.get(step.beforeVideoId)??0,afterMs=transitionTimes.get(step.afterVideoId)??0;
    const startMs=at+beforeMs,endMs=startMs+durationMs;
    // Hand over on the last frames (K app.js:192), but never before the card has cleared the hand (clearFrame).
    const handoverFrame=Math.min(take.frames,Math.max(take.frames-FILMED_HANDOVER_FRAMES,take.clearFrame+1));
    steps.push({...step,frames:take.frames,fps:rate,startPose:take.startPose,endPose:take.endPose,joinBefore,joinAfter,
      durationMs,startMs,endMs,gapAfterMs,handoverMs:ms(handoverFrame),
      ...(beforeMs||afterMs?{beforeMs,afterMs,playbackStartMs:at,playbackEndMs:endMs+afterMs}:{}),
      faceMs:ms(take.firstFaceFrame),contactMs:ms(take.contactFrame),landMs:ms(take.landFrame),clearMs:ms(take.clearFrame),fit:null});
    at=endMs+afterMs+gapAfterMs;
  });
  const realEndMs=at,dealt=Number.isInteger(draws)?draws:plan.steps.filter(step=>step.type==='deal').length;
  const windowMs=finite(endAt)?endAt-startAt:finite(leadMs)&&finite(cardMs)?leadMs+dealt*cardMs:null;
  const deviationMs=windowMs===null?null:realEndMs-windowMs;
  let fit=null;
  if (deviationMs!==null&&deviationMs>0) {
    // The window is the game's; the takes play faster (one rate for the whole chain, K app.js:225 clamp) and
    // whatever the clamp cannot absorb stays a reported deviation. Lead, gaps and separate shoe clips never compress.
    const takeMs=steps.reduce((sum,step)=>sum+step.durationMs,0),room=windowMs-(realEndMs-takeMs);
    const rate=Math.min(FILMED_FIT_RATE.max,Math.max(1,room>0?takeMs/room:Infinity));
    let t=lead;
    for (const step of steps) {
      const durationMs=step.durationMs/rate,beforeMs=step.beforeMs??0,afterMs=step.afterMs??0,startMs=t+beforeMs,endMs=startMs+durationMs;
      step.fit={rate,durationMs,startMs,endMs,...(beforeMs||afterMs?{playbackStartMs:t,playbackEndMs:endMs+afterMs}:{})};
      t=endMs+afterMs+step.gapAfterMs;
    }
    fit={rate,endMs:t,residualMs:Math.max(0,t-windowMs)};
  }
  return {profileId:plan.profileId,complete:true,reason:null,startAt,fps:rate,leadMs:lead,gapMs:FILMED_TAKE_GAP_MS,
    windowMs,endAt:windowMs===null?null:startAt+windowMs,realEndMs,deviationMs,fit,steps};
}

// Where a timed step stands when the player reaches it at atMs (ms since startAt on the table clock):
// wait when early, seek into phase when late (K video-preloader.js:19: only past 0.15 s, never into the
// last 0.04 s), and never replay a step whose time is over (K app.js:182, :230). A fitted step counts
// its clock in take time: it plays `rate` times faster (K app.js:226).
export function filmedStepPhase(step,atMs,{fitted=false}={}) {
  const placed=fitted&&step.fit?step.fit:step,rate=fitted&&step.fit?step.fit.rate:1;
  const waitMs=Math.max(0,(placed.playbackStartMs??placed.startMs)-atMs),offsetMs=Math.max(0,atMs-placed.startMs);
  const sourceS=offsetMs*rate/1000,durationS=step.durationMs/1000;
  const seekS=sourceS>FILMED_SEEK_THRESHOLD_S?Math.min(sourceS,Math.max(0,durationS-FILMED_SEEK_END_MARGIN_S)):0;
  return {waitMs,offsetMs,expired:atMs>=(placed.playbackEndMs??placed.endMs),seekS,rate,startMs:placed.startMs,durationMs:placed.durationMs};
}

// Native v2 uses the frozen inventory and measured transitions that also bind server selection.
// Older callers retain their profile-only timeline. Every step is still selected by the server
// (filmed-deal-selection.mjs) when it is played. eventIndex maps a published
// instruction's index to its timed step; a plan whose filmed order differs from the published one, or
// that cannot be planned completely, is not timed and plays as before.
export function planFilmedTimeline({profile,events,dealerId='filmed',inventory,transitions={},...timing}={}) {
  if (!profile||!Array.isArray(events)) return refused(null,profile,'profile_missing');
  inventory??={videos:profile.takes.map(take=>({id:take.key,sha256:take.sha256,available:true,classification:{dealerId}}))};
  const plan=planFilmedDealSequence({profile,events:orderFilmedPresentationEvents(events),inventory,dealerId,transitions});
  const timeline=timeFilmedDealSequence(plan,profile,{...timing,transitions});
  if (!timeline.complete) return timeline;
  const key=event=>`${event?.type}:${event?.shoeDraw}`,byKey=new Map(timeline.steps.map(step=>[key(step),step]));
  const eventIndex=new Map(),played=[];
  events.forEach((event,index)=>{const step=['deal','reveal'].includes(event?.type)?byKey.get(key(event)):null;if(step){eventIndex.set(index,step);played.push(step);}});
  if (played.length!==timeline.steps.length||played.some((step,i)=>step!==timeline.steps[i])) return refused(plan,profile,'order_mismatch');
  return {...timeline,eventIndex};
}
