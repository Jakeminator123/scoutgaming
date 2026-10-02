import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {calibrationPayload,validateContactTake} from '../../../../web/public/performance-contact.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url));
const read=p=>JSON.parse(fs.readFileSync(path.join(dir,p)));
const track=read('preview-track.json'),mask=read('preview-mask/manifest.json');
const publicDir=path.resolve(dir,'../../../../web/public/review/astrid-blue-box4');
const base=JSON.parse(fs.readFileSync(path.resolve(publicDir,'../astrid-table-v2/take.json')));
const bytes=fs.readFileSync(path.join(dir,'preview-mask/actor-packed.mp4'));
const sha=createHash('sha256').update(bytes).digest('hex');
if(sha!==mask.actorPackedSha256||track.sourceSha256!==mask.sourceSha256)throw Error('Source/matte mismatch');
const [x,y,width,height]=mask.crop,events=track.authoredEvents;
const take={version:1,id:'astrid-blue-box4-c01866d1-live-experiment',dealer:'astrid',action:'deal-right',box:4,status:'review',enabled:true,
 cameraApproval:'User accepted v1 and requested Box 4 hits and split hands plus dealer cards. Original framing and separate moving/resting sizes preserved.',
 media:{src:'review/astrid-blue-box4/actor-packed.mp4',sha256:sha,layout:'rgb-over-masks-r-actor-g-fingers',width,height,fps:24,frames:97},
 camera:{width,height,shoeOutlet:[(1265.5-x)/width,(673.5-y)/height],placement:{...base.camera.placement,x,y}},events,
 tracking:{kind:'chroma-card',sourceSha256:track.sourceSha256,jobId:track.jobId,keepSourceLanding:true,scope:'box4-opening-hit-double-split-opt-in-v1',deliveries:'all-box-cards',openingCards:2,presentation:{scope:'settled-only',scale:1.25,fanStep:.48},dealingPresentation:{scale:.80,gripAlongLeftEdge:.25},limitations:track.limits},
 frames:track.frames.map(f=>({frame:f.frame,card:f.frame<events.pickup||f.frame>events.land?null:{corners:f.quad.map(([u,v])=>[(u-x)/width,(v-y)/height,0]),faceUp:f.faceUp},tracking:{method:f.method,confidence:f.confidence,inferredCorners:f.inferredCorners}}))};
take.calibrationSha256=createHash('sha256').update(calibrationPayload(take)).digest('hex');
const errors=validateContactTake(take);if(errors.length)throw Error(errors.join('\n'));
fs.mkdirSync(publicDir,{recursive:true});
fs.writeFileSync(path.join(publicDir,'actor-packed.mp4'),bytes);
fs.writeFileSync(path.join(publicDir,'take.json'),JSON.stringify(take,null,2)+'\n');
const dealer={...base,id:'astrid-table-v2-all-dealer-cards-de1f90a9',tracking:{...base.tracking,scope:'dealer-opening-hole-and-draws-opt-in-v1',deliveries:'all-dealer-cards'}};
dealer.calibrationSha256=createHash('sha256').update(calibrationPayload(dealer)).digest('hex');
const dealerErrors=validateContactTake(dealer);if(dealerErrors.length)throw Error(dealerErrors.join('\n'));
fs.writeFileSync(path.join(publicDir,'dealer-take.json'),JSON.stringify(dealer,null,2)+'\n');
fs.writeFileSync(path.join(publicDir,'takes.json'),JSON.stringify({version:1,takes:['take.json','dealer-take.json']},null,2)+'\n');
fs.copyFileSync(path.join(dir,'preview-mask/manifest.json'),path.join(publicDir,'mask-manifest.json'));
console.log(JSON.stringify({id:take.id,mediaSha:sha,calibrationSha:take.calibrationSha256,scope:take.tracking.scope}));
