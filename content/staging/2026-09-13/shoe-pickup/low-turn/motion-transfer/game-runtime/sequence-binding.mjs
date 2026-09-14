// Staging only: binds already-issued server-visible cards to an exact reviewed
// Astrid ledger. No network, wallet, draw, seat approximation or media playback.
const fail=message=>{throw new Error(message);};
const check=(value,message)=>{if(!value)fail(message);};
const id=value=>typeof value==='string'&&value.length>0;
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const integer=Number.isInteger;
const quad=q=>Array.isArray(q)&&q.length===4&&q.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite));
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
export function ledgerPayload(ledger){const {review,...payload}=ledger;return JSON.stringify(payload);}
export async function ledgerDigest(ledger){const bytes=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(ledgerPayload(ledger)));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}

export async function bindAstridSequence({deliveries,ledger,targets,landingCalibrations=[]}){
 // Snapshot before the asynchronous digest so caller mutation cannot alter the
 // reviewed schedule or replace hidden-card policy during validation.
 const l=structuredClone(ledger),input=structuredClone(deliveries),t=structuredClone(targets),calibrations=structuredClone(landingCalibrations);
 check(l?.dealer==='astrid'&&l.schema==='astrid-staged-sequence-v1','Astrid staged ledger required');
 check(hash(l.sourceSha256)&&Number.isFinite(l.fps)&&l.fps>0&&l.fps<=60,'Invalid source clock');
 check(l.review?.status==='staged-reviewed'&&id(l.review.evidence)&&hash(l.review.payloadSha256),'Reviewed ledger evidence required');
 check(await ledgerDigest(l)===l.review.payloadSha256,'Ledger changed after review');
 check(Array.isArray(l.frames)&&l.frames.length>1&&Array.isArray(l.deliveries)&&l.deliveries.length>0,'Missing frame or delivery ledger');
 check(Array.isArray(input)&&input.length===l.deliveries.length,'Server-visible delivery count mismatch');
 check(Array.isArray(t)&&t.length>0,'Explicit current seat targets required');
 const targetMap=new Map();
 for(const target of t){check(id(target.seatId)&&id(target.targetId)&&quad(target.corners),'Invalid seat target');check(!targetMap.has(target.targetId),'Duplicate target ID');targetMap.set(target.targetId,target);}
 const issued=new Map();
 for(const d of input){
  check(id(d.cardId)&&id(d.seatId)&&id(d.targetId)&&typeof d.faceDown==='boolean','Missing explicit delivery identity');
  check(!issued.has(d.cardId),'Duplicate delivery ID');
  // Copy an allowlist only: hidden rank/suit never enter our returned records,
  // including unexpected nested fields supplied by a caller.
  const out={cardId:d.cardId,seatId:d.seatId,targetId:d.targetId,faceDown:d.faceDown};
  if(!d.faceDown){check(['A','2','3','4','5','6','7','8','9','10','J','Q','K'].includes(d.card?.r)&&['♠','♥','♦','♣'].includes(d.card?.s),'Visible server card required');out.card={r:d.card.r,s:d.card.s};}
  issued.set(d.cardId,freeze(out));
 }
 const schedule=new Map();
 for(const d of l.deliveries){
  check(id(d.cardId)&&!schedule.has(d.cardId),'Duplicate or missing ledger delivery ID');
  const real=issued.get(d.cardId);check(real,'Ledger delivery missing from server-visible records');
  check(real.seatId===d.seatId&&real.targetId===d.targetId,'Unsupported exact seat binding');
  const target=targetMap.get(d.targetId);check(target&&target.seatId===d.seatId&&quad(d.targetCorners)&&JSON.stringify(target.corners)===JSON.stringify(d.targetCorners),'Unsupported exact seat target');
  check([d.pickup,d.release,d.land].every(integer)&&0<=d.pickup&&d.pickup<d.release&&d.release<=d.land&&d.land<l.frames.length,'Invalid pickup/release/land ordering');
  schedule.set(d.cardId,d);
 }
 for(const [i,f] of l.frames.entries()){
  check(f.frame===i&&Array.isArray(f.cards),'Missing or reordered frame');const seen=new Set();
  for(const p of f.cards){check(id(p.cardId)&&!seen.has(p.cardId),'Duplicate frame card');seen.add(p.cardId);const d=schedule.get(p.cardId);check(d&&i>=d.pickup&&i<d.land,'Unissued or out-of-interval moving card');check(quad(p.corners)&&typeof p.faceUp==='boolean','Invalid frame pose');}
  for(const d of schedule.values())if(i>=d.pickup&&i<d.land)check(seen.has(d.cardId),'Missing moving card before explicit land');
 }
 // A declared target is not a physical endpoint. Compare all corresponding
 // corners of the last actually moving pose before handing it to the table.
 check(Array.isArray(calibrations),'Invalid landing calibrations');
 const calibrationMap=new Map();
 for(const c of calibrations){
  check(id(c?.cardId)&&!calibrationMap.has(c.cardId),'Duplicate or missing landing calibration ID');
  check(c.units==='canonical-pixels'&&hash(c.sha256)&&hash(c.sourceSha256)&&id(c.evidence)&&integer(c.frame)&&quad(c.sourceCorners)&&Number.isFinite(c.maxCornerErrorPixels)&&c.maxCornerErrorPixels>0&&c.maxCornerErrorPixels<=2,'Invalid bounded landing calibration evidence');
  const {sha256,...payload}=c;
  check(await ledgerDigest(payload)===sha256,'Landing calibration changed after review');
  check(schedule.has(c.cardId),'Unissued landing calibration');calibrationMap.set(c.cardId,c);
 }
 for(const d of schedule.values()){
  const last=l.frames[d.land-1].cards.find(p=>p.cardId===d.cardId),c=calibrationMap.get(d.cardId);let tolerance=0;
  if(d.landingCalibrationSha256||c){
   check(c&&d.landingCalibrationSha256===c.sha256&&c.sourceSha256===l.sourceSha256&&c.frame===d.land-1&&JSON.stringify(c.sourceCorners)===JSON.stringify(last.corners),'Landing calibration does not bind the actual endpoint');tolerance=c.maxCornerErrorPixels;
  }
  check(last.corners.every((p,i)=>Math.hypot(p[0]-d.targetCorners[i][0],p[1]-d.targetCorners[i][1])<=tolerance),'Moving pose disagrees with landing target: teleport rejected');
 }
 freeze(l);let previous=-1;const landed=new Set();
 return Object.freeze({dealer:'astrid',status:'staged-binding-only',fps:l.fps,frameCount:l.frames.length,ledgerSha256:l.review.payloadSha256,
  present(frame){
   check(integer(frame)&&frame>=0&&frame<l.frames.length,'Invalid presented frame');check(frame>=previous,'Presented sequence cannot rewind');previous=frame;
   const newLandings=[];
   for(const d of schedule.values())if(frame>=d.land&&!landed.has(d.cardId)){landed.add(d.cardId);newLandings.push({...issued.get(d.cardId),landFrame:d.land,corners:structuredClone(d.targetCorners)});}
   const moving=l.frames[frame].cards.map(p=>{const d=schedule.get(p.cardId),real=issued.get(p.cardId);return {...real,phase:frame<d.release?'contact':'released',face:real.faceDown||!p.faceUp?'back':'front',corners:structuredClone(p.corners)};});
   return freeze({frame,moving,newLandings,landed:[...landed].map(cardId=>({...issued.get(cardId),landFrame:schedule.get(cardId).land,corners:structuredClone(schedule.get(cardId).targetCorners)}))});
  }
 });
}
