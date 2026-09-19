// The contract is shared by the asset audit and the in-game player. A sparse
// fingertip path or a successful render is deliberately not visual approval.
export const CONTACT_CHECKS = ['identity', 'camera', 'pickup', 'grip', 'release',
  'returnToRest', 'noDuplicateCards', 'foregroundMatte'];
export const TABLE_ACTIONS = ['deal-left', 'deal-centre', 'deal-right', 'deal-dealer',
  'reveal-hole', 'collect', 'change-shoe'];
export const DEAL_ACTIONS = TABLE_ACTIONS.slice(0,4);
const finite = x => typeof x === 'number' && Number.isFinite(x);
const integer = x => Number.isInteger(x) && x >= 0;
const hash = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const asset = x => typeof x === 'string' && /^(?:\.\/)?[\w/-]+\.[\w]+$/.test(x) && !x.includes('..');

export function validateContactTake(take, {approved=false}={}) {
  const errors=[];
  const check=(ok, message)=>{if(!ok)errors.push(message);};
  check(take?.version===1, 'Unsupported contact manifest version');
  if (!take || typeof take!=='object') return errors;
  check(typeof take.id==='string' && DEAL_ACTIONS.includes(take.action), 'Unknown single-card action');
  check(['draft','review','rejected','contact-approved','approved'].includes(take.status), 'Unknown review status');
  check(take.dealer==='astrid', 'This capture belongs to Astrid');
  const proxy=take.tracking?.kind==='hand-proxy';
  const chroma=take.tracking?.kind==='chroma-card';
  if(chroma){
    check(take.status==='review'&&!approved,'Chroma tracking is restricted to staged review');
    check(hash(take.tracking.sourceSha256)&&take.tracking.keepSourceLanding===true,'Chroma source and filmed landing required');
  }else if(take.tracking){
    check(proxy&&take.status==='review'&&!approved, 'Hand proxies are restricted to staged review');
    check(hash(take.tracking.sourceSha256)&&integer(take.tracking.sourceStart)&&integer(take.tracking.sourceStop)&&take.tracking.sourceStop>take.tracking.sourceStart,'Invalid proxy source binding');
    check(Array.isArray(take.tracking.shoulder)&&take.tracking.shoulder.length===2&&take.tracking.shoulder.every(x=>finite(x)&&x>=0&&x<=1),'Invalid proxy shoulder');
  }
  check(take.playbackRate===undefined||(finite(take.playbackRate)&&take.playbackRate>=1&&take.playbackRate<=2), 'Invalid silent-action playback rate');
  check(take.colourGain===undefined||(Array.isArray(take.colourGain)&&take.colourGain.length===3&&take.colourGain.every(v=>finite(v)&&v>=.5&&v<=1.5)), 'Invalid actor colour correction');
  const m=take.media ?? {}, c=take.camera ?? {}, e=take.events ?? {};
  if(take.tracking?.openingCards!==undefined)check(chroma&&Number.isInteger(take.box)&&[1,2].includes(take.tracking.openingCards),'Invalid opening-card routing');
  const presentation=take.tracking?.presentation;
  if(presentation)check(chroma&&finite(presentation.scale)&&presentation.scale>=1&&presentation.scale<=1.5&&finite(presentation.fanStep)&&presentation.fanStep>0&&presentation.fanStep<=1&&integer(presentation.settleFrames)&&presentation.settleFrames>0&&e.land+presentation.settleFrames<e.rest,'Invalid settled-card presentation');
  check(asset(m.src) && hash(m.sha256), 'Packed media path and SHA-256 are required');
  check(m.layout==='rgb-over-masks-r-actor-g-fingers', 'A single clock must carry RGB and both masks');
  check(integer(m.width)&&m.width>0&&integer(m.height)&&m.height>0, 'Invalid source dimensions');
  check(finite(m.fps)&&m.fps>0&&m.fps<=60&&integer(m.frames)&&m.frames>1, 'Invalid media frame count or rate');
  check(c.width===m.width&&c.height===m.height, 'Camera and source frame dimensions differ');
  if(c.placement){const p=c.placement;check(chroma&&['width','height','scale'].every(k=>finite(p[k])&&p[k]>0)&&['x','y'].every(k=>finite(p[k])), 'Invalid rigid source placement');check(p.framingScale===undefined||(finite(p.framingScale)&&p.framingScale>0&&p.framingScale<=1),'Invalid shared composition framing');}
  check(hash(take.calibrationSha256), 'Calibration SHA-256 is required');
  check(Array.isArray(c.shoeOutlet)&&c.shoeOutlet.length===2&&c.shoeOutlet.every(x=>finite(x)&&x>=0&&x<=1), 'Measured shoe outlet is required');
  const ordered=['pickup','release','land','rest'];
  check(ordered.every(k=>integer(e[k])&&e[k]<m.frames)&&e.pickup<e.release&&e.release<=e.land&&e.land<e.rest,
    'Pickup, release, landing and rest must be ordered presented frames');
  check(Array.isArray(take.frames)&&take.frames.length===m.frames, 'Every source frame needs a record');
  for(const [i,frame] of (Array.isArray(take.frames)?take.frames:[]).entries()) {
    check(frame?.frame===i, `Frame ${i} is missing or reordered`);
    if(i<e.pickup || i>e.land) {check(frame?.card===null, `Frame ${i}: card visible outside delivery`);continue;}
    const card=frame?.card;
    check(card && Array.isArray(card.corners)&&card.corners.length===4 && card.corners.every(p=>Array.isArray(p)&&p.length===3&&p.every(finite)&&p[0]>=0&&p[0]<=1&&p[1]>=0&&p[1]<=1), `Frame ${i}: four measured card corners required`);
    check(typeof card?.faceUp==='boolean', `Frame ${i}: card orientation required`);
    if(chroma)check(typeof frame.tracking?.method==='string'&&finite(frame.tracking?.confidence)&&frame.tracking.confidence>=0&&frame.tracking.confidence<=1&&Array.isArray(frame.tracking.inferredCorners),`Frame ${i}: source tracking evidence required`);
    else if(i<=e.release) check((proxy?frame?.contact?.measured===false&&typeof frame.contact.method==='string':frame?.contact?.measured===true) && Array.isArray(frame.contact.finger)&&frame.contact.finger.length===2&&frame.contact.finger.every(finite), `Frame ${i}: measured grip or explicit review proxy required`);
  }
  if(approved) {
    check(['contact-approved','approved'].includes(take.status), 'Take has not passed contact review');
    check(take.review?.result==='passed', 'Contact review has not passed');
    check(take.review?.mediaSha256===m.sha256, 'Visual review belongs to different media');
    check(take.review?.calibrationSha256===take.calibrationSha256, 'Visual review belongs to different tracking');
    check(typeof take.review?.reviewer==='string'&&!!take.review.reviewer.trim()&&typeof take.review?.date==='string', 'Named and dated visual review required');
    for(const key of CONTACT_CHECKS)check(take.review?.checks?.[key]===true, `Visual review pending: ${key}`);
  }
  return errors;
}

export function selectContactTake(manifest, action, {staged=false}={}) {
  if(!manifest || (!staged && manifest.status!=='approved'))return null;
  const take=manifest.takes?.find(t=>t.action===action);
  const reviewing=staged&&take?.status==='review'&&
    (manifest.reviewCandidate===take.id||manifest.reviewCandidates?.includes(take.id));
  if(!take || validateContactTake(take,{approved:!reviewing}).length||validateSharedExtraction(take,manifest.takes).length)return null;
  if(!staged && (take.status!=='approved'||!TABLE_ACTIONS.every(key=>manifest.review?.actions?.[key]===true)||!DEAL_ACTIONS.every(key=>{
    const entry=manifest.takes.find(t=>t.action===key);
    return entry?.status==='approved'&&!validateContactTake(entry,{approved:true}).length;
  })))return null;
  return take;
}

export function calibrationPayload(take) {
  return JSON.stringify({camera:take.camera,events:take.events,frames:take.frames,...(take.colourGain?{colourGain:take.colourGain}:{}),...(take.playbackRate===undefined?{}:{playbackRate:take.playbackRate}),...(take.continuation?{continuation:take.continuation}:{}),...(take.tracking?{tracking:take.tracking}:{})});
}

export function presentationLandFrame(take){
  return take.events.land+(take.tracking?.presentation?.settleFrames??0);
}

// Preserve every tracked pickup/grip/turn frame. Only after the photographed
// landing, ease the released card into its larger, readable table fan. This
// is a presentation adjustment, not a measurement of the source motion.
export function settledContactCard(take,sample,end){
  if(!take.tracking?.presentation||sample.frame<take.events.land)return sample.card;
  const card=take.frames[take.events.land].card;
  const t=Math.min(1,(sample.frame-take.events.land)/take.tracking.presentation.settleFrames);
  const u=t*t*(3-2*t);
  return {...card,corners:card.corners.map((p,i)=>p.map((v,k)=>v+(end[i][k]-v)*u))};
}

// An empty-hand return may replace only the tail after a measured landing.
// It is bound to the exact delivery and next pickup; media edits invalidate
// the join instead of silently seeking into unrelated footage.
export function validateContinuation(take, takes) {
  const c=take?.continuation;
  if(!c)return ['Missing continuation contract'];
  const base=takes?.find(t=>t.id===c.baseId);
  if(!base||base.action!==take.action||base.media.sha256!==c.baseMediaSha256||base.calibrationSha256!==c.baseCalibrationSha256)return ['Continuation base changed'];
  if(!integer(c.preserveThrough)||c.preserveThrough<base.events.land||c.preserveThrough>=base.media.frames||c.preserveThrough>=take.media.frames)return ['Continuation starts before landing'];
  if(JSON.stringify(take.colourGain)!==JSON.stringify(base.colourGain))return ['Continuation actor colour changed'];
  if(JSON.stringify(take.camera)!==JSON.stringify(base.camera)||take.media.fps!==base.media.fps||take.playbackRate!==base.playbackRate)return ['Continuation camera or playback rate changed'];
  if(['pickup','release','land'].some(k=>take.events[k]!==base.events[k])||JSON.stringify(take.frames.slice(0,c.preserveThrough+1))!==JSON.stringify(base.frames.slice(0,c.preserveThrough+1)))return ['Continuation changed measured delivery'];
  if(!Array.isArray(c.resume)||!c.resume.length)return ['Continuation needs a registered next pickup'];
  for(const r of c.resume){
    const next=takes.find(t=>t.id===r.takeId);
    if(!next||next.media.sha256!==r.mediaSha256||next.calibrationSha256!==r.calibrationSha256||JSON.stringify(next.camera)!==JSON.stringify(take.camera)||!integer(r.frame)||r.frame>=next.events.pickup)return ['Continuation pickup changed'];
  }
  return [];
}

export function selectSequenceTake(manifest, take, {staged=false,continues=false}={}) {
  // Sequence candidates are never promoted by the ordinary table approval.
  if(!staged||!continues)return take;
  const candidate=manifest.continuations?.find(t=>t.continuation?.baseId===take.id);
  if(!candidate||candidate.status!=='review'||!manifest.reviewCandidates?.includes(candidate.id)||validateContactTake(candidate).length||validateContinuation(candidate,manifest.takes).length)return take;
  return candidate;
}

export function continuationStartFrame(previous, next) {
  const id=next.continuation?.baseId??next.id;
  const media=next.continuation?.baseMediaSha256??next.media.sha256;
  const calibration=next.continuation?.baseCalibrationSha256??next.calibrationSha256;
  const r=previous?.continuation?.resume?.find(r=>r.takeId===id);
  if(!r||r.mediaSha256!==media||r.calibrationSha256!==calibration||JSON.stringify(previous.camera)!==JSON.stringify(next.camera)||!integer(r.frame)||r.frame>=next.events.pickup)return 0;
  return r.frame;
}

// Route by the actual card-fan destination, including split offsets and camera
// registration. Screen thirds sent inner-right hands to the far-right release.
export function selectPlayerDelivery(manifest,target,viewport,options={}) {
  const takes=['deal-left','deal-centre','deal-right'].map(action=>selectContactTake(manifest,action,options)).filter(Boolean);
  let best=null,distance=Infinity;
  for(const take of takes){
    const fit=uniformRegistration(take.camera,viewport);
    const p=take.frames[take.events.release].card.corners.reduce((a,v)=>[a[0]+v[0]/4,a[1]+v[1]/4],[0,0]);
    const d=(fit.x+p[0]*fit.width-target.x)**2+(fit.y+p[1]*fit.height-target.y)**2;
    if(d<distance){best=take;distance=d;}
  }
  return best;
}

export function validateSharedExtraction(take, takes) {
  if(!take.sharedExtraction)return [];
  const {action,frames,sourceSha256}=take.sharedExtraction;
  const source=takes.find(t=>t.action===action);
  if(!source||source===take||!integer(frames)||frames<=take.events.pickup||frames>=take.events.release||!hash(sourceSha256))return ['Invalid shared extraction source'];
  if(source.events.pickup!==take.events.pickup||JSON.stringify(source.camera.shoeOutlet)!==JSON.stringify(take.camera.shoeOutlet))return ['Shared pickup camera/timing changed'];
  if(JSON.stringify(source.frames.slice(0,frames))!==JSON.stringify(take.frames.slice(0,frames)))return ['Shared extraction tracking changed'];
  return [];
}

// Never advance an attached card with elapsed wall time or interpolate over a
// missing measurement. A dropped video frame selects its corresponding record.
export function contactFrame(take, mediaTime) {
  if(!finite(mediaTime))throw new TypeError('Invalid media timestamp');
  const index=Math.max(0,Math.min(take.media.frames-1,Math.round(mediaTime*take.media.fps)));
  return take.frames[index];
}

export function contactCueClock(events, emit, {fps=24,playbackRate=1}={}) {
  let previous=null;
  const fired=new Set();
  return (frame,{visible=true,seeking=false}={})=>{
    if(!integer(frame))throw new TypeError('Invalid presented frame');
    for(const [name,at] of [['pickup',events.pickup],['land',events.land]]) {
      if(frame>=at&&!fired.has(name)) {
        fired.add(name);
        // Allow ordinary dropped frames at accelerated playback. A fixed
        // two-frame gap discarded on-time contact cues on slower devices.
        // Long stalls, late events, seeks and hidden completion stay silent.
        const framesPerSecond=fps*playbackRate;
        if(visible&&!seeking&&previous!==null&&previous<at&&
          (frame-previous)/framesPerSecond<=.25&&(frame-at)/framesPerSecond<=.08)emit(name);
      }
    }
    previous=frame;
  };
}

export function uniformRegistration(source, viewport) {
  if(source.placement){
    const p=source.placement,base=uniformRegistration({width:p.width,height:p.height,framingScale:p.framingScale},viewport),scale=base.scale*p.scale;
    return {x:base.x+p.x*base.scale,y:base.y+p.y*base.scale,width:source.width*scale,height:source.height*scale,scale};
  }
  const portrait=viewport.width<861&&viewport.height>viewport.width;
  // Reserve a real control band under the scene. Without it, placing totals
  // below the chips forces actions over cards or the wallet at 720px height.
  // Table, actor, shoe and tracked card all use this same transform.
  const sceneHeight=portrait?viewport.height:Math.max(1,viewport.height-136);
  const scale=(portrait?Math.min(viewport.height*.65/source.height,viewport.width/(source.width*.48))
    :Math.min(viewport.width/source.width,sceneHeight/source.height))*(source.framingScale??1);
  return {scale,x:(viewport.width-source.width*scale)/2,y:portrait?viewport.height*.08:(sceneHeight-source.height*scale)/2,
    width:source.width*scale,height:source.height*scale};
}
