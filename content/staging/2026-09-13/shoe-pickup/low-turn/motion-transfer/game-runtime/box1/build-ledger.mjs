import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {ledgerDigest} from '../sequence-binding.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const fit=path.resolve(here,'../../camera-review/seven-targets/box1-trial-spec/card-pose-fit');
const trajectoryPath=path.join(fit,'issued-card-trajectory-complete-v2.json');
const raw=fs.readFileSync(trajectoryPath),source=JSON.parse(raw);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
if(source.frames.length!==97||source.frames.some((f,i)=>f.frame!==i))throw Error('Native frame sequence changed');
const release=63,land=64,sourceCorners=source.frames[release].cards[0].corners;
// Closest affine parallelogram about the SAME observed centre. This permits
// the game's 2D card to represent the source plane, without moving the actor.
const center=[0,1].map(k=>sourceCorners.reduce((sum,p)=>sum+p[k],0)/4);
const u=[0,1].map(k=>(sourceCorners[1][k]-sourceCorners[0][k]+sourceCorners[2][k]-sourceCorners[3][k])/2);
const v=[0,1].map(k=>(sourceCorners[3][k]-sourceCorners[0][k]+sourceCorners[2][k]-sourceCorners[1][k])/2);
const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>center.map((c,k)=>c+(a*u[k]+b*v[k])/2));
const errors=corners.map((p,i)=>Math.hypot(...p.map((n,k)=>n-sourceCorners[i][k])));
if(Math.max(...errors)>1.1)throw Error('Observed landing no longer admits measured subpixel affine fit');
const target={seatId:'seat1',targetId:'box1',corners};
const mediaReceiptPath=path.join(here,'media-receipt.json');
const media=fs.existsSync(mediaReceiptPath)?JSON.parse(fs.readFileSync(mediaReceiptPath)):null;
const ledger={schema:'astrid-staged-sequence-v1',dealer:'astrid',sourceSha256:media?.outputSHA256??source.sourceSha256,
 sourceVideoSha256:source.sourceSha256,trajectorySha256:sha(raw),fps:60,nativeFps:24,
 playbackPolicy:'All97 native samples retained in order at60fps: 2.5x native pace; no invented interpolation',
 visualAcceptance:'NOT APPROVED: early pickup corners inferred; source-specific cleaned actor/hand masks and actual game review required',
 endpointNormalization:{frame:release,sourceCorners,corners,cornerErrors:errors,policy:'Subpixel affine card-only fit about unchanged observed card centre. No actor/shoe transformation.'},
 deliveries:[{cardId:'box1-first',seatId:'seat1',targetId:'box1',pickup:9,release,land,targetCorners:corners}],
 frames:source.frames.map(f=>({frame:f.frame,native:f.frame,sourcePTS:f.pts,geometryProvenance:f.geometryProvenance,
  inferredCornerUncertaintyPx:f.inferredCornerUncertaintyPx,
  cards:f.frame>=9&&f.frame<land?[{cardId:'box1-first',corners:f.frame===release?corners:f.cards[0].corners,faceUp:true}]:[]}))};
ledger.review={status:'staged-reviewed',evidence:'/astrid-box1/REVIEW.md',payloadSha256:await ledgerDigest(ledger)};
const receipt={trajectorySha256:sha(raw),mediaReady:!!media,frameCount:97,pickup:9,release,land,
 landPolicy:'Paint source release63 at final independent card plane; transfer to DOM on next frame64 (16.7ms at playback).',
 cornerErrors:errors,center,requestedCenter:source.deliveries[0].requestedSeatCenter,
 sourceCentreToRequested:source.deliveries[0].landingTranslationProposal,
 limits:'Source centre retained. Existing CSS landing must be explicitly registered; no blanket all-seat mapping. Mask readiness and visual acceptance remain separate.'};
for(const [name,data] of Object.entries({'ledger.json':ledger,'target.json':target,'ledger-receipt.json':receipt}))fs.writeFileSync(path.join(here,name),JSON.stringify(data,null,2));
console.log(JSON.stringify(receipt));
