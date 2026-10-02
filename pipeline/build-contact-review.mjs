// Build a separately staged, measured candidate. This never changes approval
// flags or replaces existing dealer speech streams.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {calibrationPayload,validateContactTake} from '../web/public/performance-contact.mjs';
import {packContactMedia} from './pack-contact-media.mjs';
import {resolveMediaAbsolutePath} from '../tools/media-layout.mjs';
const [source,action,pickup,release,land,rest,publicDirectory='web/public',assetName]=process.argv.slice(2);
if(!source||!/^deal-(?:centre|dealer|left|right)$/.test(action)||![pickup,release,land,rest].every(v=>/^\d+$/.test(v??'')))
  throw new Error('Usage: node pipeline/build-contact-review.mjs staging-directory action pickup release land rest');
const root=resolveMediaAbsolutePath(path.resolve(source)),publicRoot=path.resolve(publicDirectory);
const target=resolveMediaAbsolutePath(path.join(publicRoot,'dealers/astrid/performance')),prefix=assetName??action.slice(5);
if(!/^[a-z0-9-]+$/.test(prefix))throw new Error('Invalid asset name');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file)));
const measurements=read('measurements.json'),tracking=read('marker-tracking.json');
const manifestPath=path.join(target,'manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestPath));
const sha=value=>createHash('sha256').update(value).digest('hex');
const prepared=path.join(root,'prepared');fs.mkdirSync(prepared,{recursive:true});
const packed=path.join(prepared,`${prefix}-review.mp4`),native=path.join(prepared,`${prefix}-source.mp4`);
const recipeFile=path.join(root,'media-recipe.json');
const segments=fs.existsSync(recipeFile)?JSON.parse(fs.readFileSync(recipeFile)).segments:[{file:path.join(root,'source.mp4')}];
const dimensions=packContactMedia({segments,masks:path.join(root,'contact-masks'),sourceOutput:native,packedOutput:packed});
if(dimensions.frames!==tracking.length||measurements.length!==tracking.length)throw new Error('Source and measured frame counts differ');
const take={version:1,id:`astrid-${prefix}-contact-20260909`,dealer:'astrid',action,status:'review',playbackRate:1.75,
  media:{src:`dealers/astrid/performance/${prefix}-review.mp4`,sha256:sha(fs.readFileSync(packed)),...dimensions,layout:'rgb-over-masks-r-actor-g-fingers'},
  camera:{...structuredClone(manifest.takes[0].camera),width:dimensions.width,height:dimensions.height},events:{pickup:+pickup,release:+release,land:+land,rest:+rest},frames:[]};
for(const row of tracking){
  const frame={frame:row.frame,card:null};
  if(row.frame>=+pickup&&row.frame<=+land){
    if(!row.corners)throw new Error(`Missing card measurement at ${row.frame}`);
    frame.card={corners:row.corners,faceUp:true};
    if(row.frame<=+release){
      const centre=row.corners.reduce((a,p)=>[a[0]+p[0]/4,a[1]+p[1]/4],[0,0]);
      const fingers=measurements[row.frame].hands.map(h=>h.points.VNHLKITIP).filter(p=>p?.[2]>.3)
        .sort((a,b)=>Math.hypot(a[0]-centre[0],a[1]-centre[1])-Math.hypot(b[0]-centre[0],b[1]-centre[1]));
      if(!fingers.length)throw new Error(`Missing fingertip measurement at ${row.frame}`);
      frame.contact={measured:true,finger:fingers[0].slice(0,2),confidence:fingers[0][2]};
    }
  }
  take.frames.push(frame);
}
const prefixFile=path.join(root,'shared-prefix.json');
if(fs.existsSync(prefixFile)) {
  const shared=JSON.parse(fs.readFileSync(prefixFile));
  const original=manifest.takes.find(t=>t.action===shared.action);
  if(!original||!Number.isInteger(shared.frames)||shared.frames<=+pickup||shared.frames>=+release||original.events.pickup!==+pickup)throw new Error('Invalid shared extraction prefix');
  take.sharedExtraction=shared;
  for(let i=0;i<shared.frames;i++)take.frames[i]=structuredClone(original.frames[i]);
  // A quad has four equivalent cyclic labels. Retain the card's artwork
  // orientation at the shared boundary without changing any measured point.
  let previous=take.frames[shared.frames-1].card.corners;
  for(const frame of take.frames.slice(shared.frames))if(frame.card) {
    const box=frame.card.corners,candidates=box.map((_,i)=>[...box.slice(i),...box.slice(0,i)]);
    const distance=q=>q.reduce((sum,p,i)=>sum+(p[0]-previous[i][0])**2+(p[1]-previous[i][1])**2,0);
    frame.card.corners=candidates.sort((a,b)=>distance(a)-distance(b))[0];previous=frame.card.corners;
  }
}
take.calibrationSha256=sha(calibrationPayload(take));
take.review={result:'pending',date:'2026-09-09',mediaSha256:take.media.sha256,calibrationSha256:take.calibrationSha256,
  note:'Measured candidate for actual-game review. This metadata is not visual acceptance.'};
const errors=validateContactTake(take);if(errors.length)throw new Error(errors.join('; '));
// Publish only after every measured record and encoded frame has passed. A
// distinct asset name lets existing tabs finish using their cached old take.
fs.copyFileSync(packed,path.join(target,`${prefix}-review.mp4`));
fs.copyFileSync(native,path.join(target,`${prefix}-source.mp4`));
manifest.takes=manifest.takes.filter(t=>t.action!==action);manifest.takes.push(take);
manifest.reviewCandidates=[...new Set([manifest.reviewCandidate,...(manifest.reviewCandidates??[]),take.id].filter(Boolean))];
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log(`Staged ${action}: ${take.media.frames} measured frames. Existing speech untouched.`);
