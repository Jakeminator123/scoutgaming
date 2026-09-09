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
  const m=take.media ?? {}, c=take.camera ?? {}, e=take.events ?? {};
  check(asset(m.src) && hash(m.sha256), 'Packed media path and SHA-256 are required');
  check(m.layout==='rgb-over-masks-r-actor-g-fingers', 'A single clock must carry RGB and both masks');
  check(integer(m.width)&&m.width>0&&integer(m.height)&&m.height>0, 'Invalid source dimensions');
  check(finite(m.fps)&&m.fps>0&&m.fps<=60&&integer(m.frames)&&m.frames>1, 'Invalid media frame count or rate');
  check(c.width===m.width&&c.height===m.height, 'Camera and source frame dimensions differ');
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
    if(i<=e.release) check(frame?.contact?.measured===true && Array.isArray(frame.contact.finger)&&frame.contact.finger.length===2&&frame.contact.finger.every(finite), `Frame ${i}: measured grip required`);
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
  return JSON.stringify({camera:take.camera,events:take.events,frames:take.frames});
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

export function contactCueClock(events, emit) {
  let previous=null;
  const fired=new Set();
  return (frame,{visible=true,seeking=false}={})=>{
    if(!integer(frame))throw new TypeError('Invalid presented frame');
    for(const [name,at] of [['pickup',events.pickup],['land',events.land]]) {
      if(frame>=at&&!fired.has(name)) {
        fired.add(name);
        // First/late frame, seek, hidden-tab completion: consume silently.
        if(visible&&!seeking&&previous!==null&&previous<at&&frame-previous<=2)emit(name);
      }
    }
    previous=frame;
  };
}

export function uniformRegistration(source, viewport) {
  const portrait=viewport.width<861&&viewport.height>viewport.width;
  const scale=portrait?Math.min(viewport.height*.65/source.height,viewport.width/(source.width*.48))
    :Math.min(viewport.width/source.width,viewport.height/source.height);
  return {scale,x:(viewport.width-source.width*scale)/2,y:portrait?viewport.height*.08:(viewport.height-source.height*scale)/2,
    width:source.width*scale,height:source.height*scale};
}
