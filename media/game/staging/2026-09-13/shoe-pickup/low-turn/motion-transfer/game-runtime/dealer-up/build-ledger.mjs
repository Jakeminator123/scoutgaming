import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {ledgerDigest} from '../sequence-binding.mjs';
const p=path.dirname(fileURLToPath(import.meta.url));
const read=n=>JSON.parse(fs.readFileSync(path.join(p,n)));
const sha=b=>createHash('sha256').update(b).digest('hex');
const pace=read('pace/plan.json'),media=read('media-receipt.json');
const M=read('../../next-source-investigation/existing-continuation-search/extended/contact-proof-map.json').contactToCameraLockedSimilarity;
const rightReg=read('seam/registration.json'),R=rightReg.rightToContactUniform;
const combine=(A,B)=>[[A[0][0]*B[0][0]+A[0][1]*B[1][0],A[0][0]*B[0][1]+A[0][1]*B[1][1],A[0][0]*B[0][2]+A[0][1]*B[1][2]+A[0][2]],[A[1][0]*B[0][0]+A[1][1]*B[1][0],A[1][0]*B[0][1]+A[1][1]*B[1][1],A[1][0]*B[0][2]+A[1][1]*B[1][2]+A[1][2]]];
const transform=A=>({scale:Math.hypot(A[0][0],A[1][0]),translation:[A[0][2],A[1][2]],rotation:Math.atan2(A[1][0],A[0][0])});
const registrations={centreEntry:transform(M),contact:transform(M),right:transform(combine(M,R))};
const map=q=>q.map(([x,y])=>[M[0][0]*x+M[0][1]*y+M[0][2],M[1][0]*x+M[1][1]*y+M[1][2]]);
const old=read('../box3/card-fit/selected-output-tracking.json').frames;
const extras=read('seam/prefix-extra-poses.json').poses;
const right=read('seam/full-card-poses.json').records;
const contact=new Map(old.filter(f=>f.sourceNative!=null&&f.cornersNative).map(f=>[f.sourceNative,{quad:f.cornersNative,evidence:f.evidence,uncertainty:f.residual}]));
for(const f of extras)contact.set(f.sourceNative,{quad:f.cornersContactCamera,evidence:f.evidence,uncertainty:f.uncertaintyPx});
const frames=pace.frames.map(row=>{
 let q=null,evidence='No moving card',uncertainty=null;
 if(row.outputFrame>=30&&row.outputFrame<64){if(row.source==='right'){const f=right[row.sourceNative];if(f.sourceNative!==row.sourceNative)throw Error('Right source clock mismatch');q=f.cornersContactCamera;evidence=f.evidence;uncertainty=f.uncertaintyPx;}else{const f=contact.get(row.sourceNative);if(!f)throw Error('Missing prefix pose');q=f.quad;evidence=f.evidence;uncertainty=f.uncertainty;}}
 return {frame:row.outputFrame,native:row.combinedNative,source:row.source,sourceNative:row.sourceNative,sourcePTS:row.sourceNative/24,geometryProvenance:evidence,uncertaintyPx:uncertainty,cards:q?[{cardId:'dealer-up-first',corners:map(q),faceUp:true}]:[]};
});
const corners=map(right[55].cornersContactCamera);
if(JSON.stringify(right[55].cornersContactCamera)!==JSON.stringify(right[56].cornersContactCamera)||frames[63].sourceNative!==55||frames[64].sourceNative!==56)throw Error('Release boundary changed');
const shoe=fs.readFileSync(path.join(p,'../box3/shoe-allowed-canonical.png'));fs.writeFileSync(path.join(p,'shoe-allowed-canonical.png'),shoe);
media.sourceRegistrations=registrations;media.shoeMaskSHA256=sha(shoe);
const target={targetId:'dealer-up',seatId:'dealer',corners,status:'Proposed source-supported first dealer upcard placement; actual layout must pass before playback'};
const ledger={schema:'astrid-staged-sequence-v1',dealer:'astrid',fps:60,nativeFps:24,sourceSha256:media.outputSHA256,sourceBundleSHA256:media.sourceBundleSHA256,sourceRegistrations:registrations,
 shoeOcclusion:{src:'/astrid-dealer-up/shoe-allowed-canonical.png',sha256:sha(shoe),startFrame:30,endFrame:44},
 playbackPolicy:'85 selected original source frames. Same B3 physical card basis. Uniform source-camera registration only; no body warp, generated turn, or new server card.',
 visualAcceptance:'NOT APPROVED. First-upcard candidate only. Raw face/wrist seam, mask remnants, readability and full gameplay remain under review. Face-up extraction has no turnover. Release right54-55 uncertain,56 clear.',
 deliveries:[{cardId:'dealer-up-first',seatId:'dealer',targetId:'dealer-up',pickup:30,release:63,land:64,targetCorners:corners}],frames};
ledger.review={status:'staged-reviewed',evidence:'/astrid-dealer-up/REVIEW.md',payloadSha256:await ledgerDigest(ledger)};
for(const [name,value]of Object.entries({'ledger.json':ledger,'target.json':target,'media-receipt.json':media}))fs.writeFileSync(path.join(p,name),JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify({corners,registrations,enabled:false}));
