import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {calibrationPayload,validateContactTake} from '../../../../web/public/performance-contact.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url));
const publicDir=path.resolve(dir,'../../../../web/public/review/astrid-elevated-table');
const track=JSON.parse(fs.readFileSync(path.join(dir,'card-track/card-track.json')));
const mask=JSON.parse(fs.readFileSync(path.join(dir,'mask-prep/video/manifest.json')));
if(track.sourceSha256!==mask.sourceSha256)throw new Error('Card tracking and actor matte use different source videos');
const [x,y,width,height]=mask.crop;
const placement={width:1920,height:1080,scale:1,x:0,y:20};
const events={pickup:0,release:57,land:58,rest:96};
const take={
  version:1,id:'astrid-elevated-first-upcard-de1f90a9',dealer:'astrid',action:'deal-dealer',status:'review',enabled:true,
  cameraApproval:'2026-09-19: user explicitly selected Use this angle for reference269f8943. Motion and gameplay remain under review.',
  media:{src:'review/astrid-elevated-table/actor-packed.mp4',sha256:mask.actorPackedSha256,layout:'rgb-over-masks-r-actor-g-fingers',width,height,fps:24,frames:97},
  camera:{width,height,shoeOutlet:[(1265.5-x)/width,(673.5-y)/height],placement:{...placement,x:placement.x+x*placement.scale,y:placement.y+y*placement.scale}},
  events,
  tracking:{kind:'chroma-card',sourceSha256:track.sourceSha256,keepSourceLanding:true,scope:'first-dealer-upcard-only',limitations:track.limits},
  frames:track.frames.map(f=>({frame:f.frame,card:f.frame<events.pickup||f.frame>events.land?null:{corners:f.quad.map(([u,v])=>[(u-x)/width,(v-y)/height,0]),faceUp:f.faceUp},tracking:{method:f.method,confidence:f.confidence,inferredCorners:f.inferredCorners}})),
};
take.calibrationSha256=createHash('sha256').update(calibrationPayload(take)).digest('hex');
const errors=validateContactTake(take);if(errors.length)throw new Error(errors.join('\n'));
const packed=fs.readFileSync(path.join(dir,'mask-prep/video/actor-packed.mp4'));
if(createHash('sha256').update(packed).digest('hex')!==mask.actorPackedSha256)throw new Error('Actor media hash changed');
fs.mkdirSync(publicDir,{recursive:true});
fs.writeFileSync(path.join(publicDir,'actor-packed.mp4'),packed);
fs.copyFileSync(path.join(dir,'mask-prep/video/manifest.json'),path.join(publicDir,'mask-manifest.json'));
fs.writeFileSync(path.join(publicDir,'take.json.tmp'),JSON.stringify(take,null,2)+'\n');
fs.renameSync(path.join(publicDir,'take.json.tmp'),path.join(publicDir,'take.json'));
console.log(JSON.stringify({id:take.id,media:take.media,calibrationSha256:take.calibrationSha256,placement,events}));
