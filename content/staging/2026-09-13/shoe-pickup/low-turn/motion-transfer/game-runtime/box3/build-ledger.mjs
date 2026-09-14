import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {ledgerDigest} from '../sequence-binding.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const read=name=>JSON.parse(fs.readFileSync(path.join(here,name)));
const digest=data=>createHash('sha256').update(data).digest('hex');
const raw=fs.readFileSync(path.join(here,'card-fit/selected-output-tracking.json'));
const trajectory=JSON.parse(raw),pace=read('pace/receipt.json'),media=read('media-receipt.json');
const reg=JSON.parse(fs.readFileSync(path.resolve(here,'../../next-source-investigation/existing-continuation-search/extended/contact-proof-map.json')));
const M=reg.contactToCameraLockedSimilarity;
const actorTransform={scale:Math.hypot(M[0][0],M[1][0]),rotation:Math.atan2(M[1][0],M[0][0]),translation:[M[0][2],M[1][2]]};
const map=q=>q.map(([x,y])=>[M[0][0]*x+M[0][1]*y+M[0][2],M[1][0]*x+M[1][1]*y+M[1][2]]);
if(trajectory.frames.length!==85||pace.frames.length!==85||trajectory.frames.some((f,i)=>f.outputFrame!==i||f.sourceNative!==pace.frames[i].sourceNative))throw Error('Source clock mismatch');
const pickup=30,release=63,land=64;
if(trajectory.frames[release].sourceNative!==92||!trajectory.frames[pickup].cornersNative)throw Error('Physical event mapping changed');
const corners=map(trajectory.frames[release].cornersNative);
const target={seatId:'seat3',targetId:'box3',corners,layoutStatus:'PROPOSED source-supported deposition. Existing seat layout must be reviewed and changed before enablement; do not expand target tolerance.'};
const ledger={schema:'astrid-staged-sequence-v1',dealer:'astrid',sourceSha256:media.outputSHA256,sourceVideoSha256:media.sourceSha256,rawSourceSHA256:media.rawSourceSHA256,trajectorySha256:digest(raw),fps:60,nativeFps:24,actorTransform,
 playbackPolicy:'85 selected original packed RGB frames from full169-frame entry/action.1.416667s; no interpolation, body warp or turn invented.',
 visualAcceptance:'NOT APPROVED. Source has real low extraction/slide/empty return but no turnover. Early hidden corners inferred; masks and actual seat layout require composite/gameplay review.',
 registration:{method:'Whole-camera similarity from stationary background; applied equally to actor/card/shoe-mask',inliers:reg.inliers,medianInlierResidual:reg.medianInlierResidual},
 deliveries:[{cardId:'box3-first',seatId:'seat3',targetId:'box3',pickup,release,land,targetCorners:corners}],
 frames:trajectory.frames.map((f,i)=>({frame:i,native:pace.frames[i].packedNative,sourceNative:f.sourceNative,sourcePTS:pace.frames[i].packedNative/24,geometryProvenance:f.evidence,confidence:f.confidence,inferredHiddenCorners:f.inferredHiddenCorners,residual:f.residual,
 cards:i>=pickup&&i<land?[{cardId:'box3-first',corners:i===release?corners:map(f.cornersNative),faceUp:true}]:[]}))};
const shoe=read('shoe-mask-receipt.json');ledger.shoeOcclusion={src:'/astrid-box3/shoe-allowed-canonical.png',sha256:shoe.outputSHA256,startSource:38,endSource:48};media.shoeMaskSHA256=shoe.outputSHA256;
ledger.review={status:'staged-reviewed',evidence:'/astrid-box3/REVIEW.md',payloadSha256:await ledgerDigest(ledger)};
media.actorTransform=actorTransform;
for(const [name,value]of Object.entries({'ledger.json':ledger,'target.json':target,'media-receipt.json':media,'render-registration.json':{actorTransform,matrix:M,source:reg.status,medianInlierResidual:reg.medianInlierResidual}}))fs.writeFileSync(path.join(here,name),JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify({pickup,release,land,actorTransform,target:corners,enabled:false}));
