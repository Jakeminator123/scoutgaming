import {filmedDealTarget,validateFilmedDealProfile} from '../contracts/filmed-profile.mjs';

// Native receipts list reveal first on settlement. The shared player presents
// the player's last action first, then reveal and dealer draws. Reorder only
// these already committed instructions; a boundary is a local pose separator,
// not a card instruction or an event accepted by presentationInput.
export function orderFilmedPresentationEvents(published) {
  if (!Array.isArray(published)) return published;
  const events=structuredClone(published);
  const hole=events.find(event=>event?.type==='deal'&&event.to==='dealer'&&event.faceDown===true);
  const opening=Boolean(hole||events.some(event=>event?.type==='speak'&&event.line==='goodluck'));
  const deal=event=>event?.type==='deal',reveal=event=>event?.type==='reveal';
  if (opening) {
    const first=events.filter(event=>event?.type==='speak'&&event.line==='goodluck');
    const dealt=events.filter(deal),initial=dealt.filter(event=>!hole||event.shoeDraw<=hole.shoeDraw);
    const later=dealt.filter(event=>hole&&event.shoeDraw>hole.shoeDraw);
    return [...first,...initial,...events.filter(reveal),...later,
      ...events.filter(event=>!deal(event)&&!reveal(event)&&!first.includes(event))];
  }
  const double=events.filter(event=>event?.type==='speak'&&event.line==='double');
  const players=events.filter(event=>deal(event)&&event.to==='box'),dealers=events.filter(event=>deal(event)&&event.to==='dealer');
  const reveals=events.filter(reveal);
  return [...double,...players,...(players.length&&dealers.length&&!reveals.length?[{type:'filmed-boundary'}]:[]),
    ...reveals,...dealers,...events.filter(event=>!deal(event)&&!reveal(event)&&!double.includes(event))];
}

// Call only with the complete, server-committed presentation instructions for
// one command. This is presentation selection, never a source of cards/rules.
export function planFilmedDealSequence({profile,events,inventory,dealerId,transitions={}}={}) {
  const reason=invalidProfileReason(profile);
  if (reason) return {profileId:profile?.id??null,complete:false,reason,steps:[]};
  return planValidatedFilmedDealSequence({profile,events,inventory,dealerId,transitions});
}

function invalidProfileReason(profile) {
  if (!profile) return 'profile_missing';
  try { validateFilmedDealProfile(profile); } catch { return 'profile_invalid'; }
  return null;
}

// Synchronous batch of complete commands with one profile validation. The same
// private core handles single and batch planning; no caller can skip validation
// or retain a validated closure/cache after profile or inventory changes.
export function planFilmedDealSequences({profile,eventSequences,inventory,dealerId,transitions={}}={}) {
  const unavailable=reason=>({profileId:profile?.id??null,complete:false,reason,plans:[]});
  const reason=invalidProfileReason(profile);
  if (reason) return unavailable(reason);
  if (!Array.isArray(eventSequences)) return unavailable('instructions_invalid');
  const input={profile,inventory,dealerId,transitions};
  const plans=Array.from(eventSequences,events=>planValidatedFilmedDealSequence({...input,events}));
  const failure=plans.find(plan=>!plan.complete)??(plans.length?null:planValidatedFilmedDealSequence({...input,events:[]}));
  return {profileId:profile.id,complete:failure?.complete!==false,reason:failure?.reason??null,plans};
}

function planValidatedFilmedDealSequence({profile,events,inventory,dealerId,transitions}) {
  const unavailable=reason=>({profileId:profile?.id??null,complete:false,reason,steps:[]});
  if (!Array.isArray(events)||events.length>128||typeof dealerId!=='string'||!dealerId) return unavailable('instructions_invalid');
  const videos=Array.isArray(inventory)?inventory:inventory?.videos;
  if (!Array.isArray(videos)) return unavailable('inventory_missing');
  const targets=events.map(filmedDealTarget), seen=new Set();
  const base=target=>profile.takes.find(take=>take.target===target&&take.variant==='');
  for (let i=0;i<events.length;i++) {
    const event=events[i];
    if (!event||typeof event!=='object'||Array.isArray(event)) return unavailable('instructions_invalid');
    if (!['deal','reveal'].includes(event.type)) continue;
    if (!targets[i]||!base(targets[i])||!Number.isSafeInteger(event.shoeDraw)||event.shoeDraw<1
        ||seen.has(`${event.type}:${event.shoeDraw}`)) return unavailable('instructions_invalid');
    seen.add(`${event.type}:${event.shoeDraw}`);
  }
  const joins=(left,right)=>left&&right&&base(left).endPose==='REDO'&&base(right).startPose==='REDO';
  const steps=[];
  for (let i=0;i<events.length;i++) {
    const target=targets[i];
    if (!target) continue;
    const standard=base(target),before=joins(targets[i-1],target),after=joins(target,targets[i+1]);
    const enter=!before&&standard.startPose==='REDO'&&transitions.toShoe;
    const leave=!after&&standard.endPose==='REDO'&&transitions.fromShoe;
    let variant=(before||enter||standard.startPose==='VILA'?'':'i')+(after||leave||standard.endPose==='VILA'?'':'u');
    if (variant.endsWith('u')&&profile.takes.some(take=>take.key===`${target}:${variant.slice(0,-1)}v`)) variant=variant.slice(0,-1)+'v';
    const take=profile.takes.find(row=>row.target===target&&row.variant===variant);
    if (!take) return unavailable('pose_variant_missing');
    if (take.startPose!==((before||enter)?'REDO':'VILA')||take.endPose!==((after||leave)?'REDO':'VILA')) return unavailable('pose_chain_invalid');
    const matches=videos.filter(video=>video.available===true&&video.sha256===take.sha256&&typeof video.id==='string'&&video.id
      &&video.classification?.dealerId===dealerId&&video.classification.archived!==true
      &&video.classification.game!=='roulette'&&!['audio','image'].includes(video.classification.mediaType));
    // Multiple registrations of identical bytes are equivalent; the stable ID
    // order makes a replay independent of registry iteration order.
    const video=matches.sort((a,b)=>a.id.localeCompare(b.id))[0];
    if (!video) return unavailable('exact_video_missing');
    const event=events[i];
    steps.push({eventIndex:i,shoeDraw:event.shoeDraw,type:event.type,to:event.to,box:event.to==='box'?event.box:null,
      takeKey:take.key,videoId:video.id,sha256:take.sha256,
      ...(enter?{beforeVideoId:enter.id}:{}),...(leave?{afterVideoId:leave.id}:{})});
  }
  return {profileId:profile.id,complete:true,reason:null,steps};
}
