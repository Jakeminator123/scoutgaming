// Build a separately staged, measured candidate. This never changes approval
// flags or replaces existing dealer speech streams.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {calibrationPayload,validateContactTake} from '../web/public/performance-contact.mjs';
const [source,action,pickup,release,land,rest]=process.argv.slice(2);
if(!source||!/^deal-(?:centre|dealer|left|right)$/.test(action)||![pickup,release,land,rest].every(v=>/^\d+$/.test(v??'')))
  throw new Error('Usage: node pipeline/build-contact-review.mjs staging-directory action pickup release land rest');
const root=path.resolve(source),publicRoot=path.resolve('web/public');
const target=path.join(publicRoot,'dealers/astrid/performance'),prefix=action.slice(5);
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file)));
const measurements=read('measurements.json'),tracking=read('marker-tracking.json');
const manifestPath=path.join(target,'manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestPath));
const sha=value=>createHash('sha256').update(value).digest('hex');
const packed=path.join(target,`${prefix}-review.mp4`);
execFileSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',path.join(root,'source.mp4'),'-framerate','24','-i',path.join(root,'contact-masks/%04d.png'),'-filter_complex','[0:v]scale=1280:720[rgb];[rgb][1:v]vstack=inputs=2[out]','-map','[out]','-an','-c:v','libx264','-crf','18','-bf','0','-pix_fmt','yuv420p','-movflags','+faststart',packed]);
fs.copyFileSync(path.join(root,'source.mp4'),path.join(target,`${prefix}-source.mp4`));
const take={version:1,id:`astrid-${prefix}-contact-20260909`,dealer:'astrid',action,status:'review',
  media:{src:`dealers/astrid/performance/${prefix}-review.mp4`,sha256:sha(fs.readFileSync(packed)),width:1280,height:720,fps:24,frames:tracking.length,layout:'rgb-over-masks-r-actor-g-fingers'},
  camera:structuredClone(manifest.takes[0].camera),events:{pickup:+pickup,release:+release,land:+land,rest:+rest},frames:[]};
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
take.calibrationSha256=sha(calibrationPayload(take));
take.review={result:'pending',date:'2026-09-09',mediaSha256:take.media.sha256,calibrationSha256:take.calibrationSha256,
  note:'Measured candidate for actual-game review. This metadata is not visual acceptance.'};
const errors=validateContactTake(take);if(errors.length)throw new Error(errors.join('; '));
manifest.takes=manifest.takes.filter(t=>t.action!==action);manifest.takes.push(take);
manifest.reviewCandidates=[...new Set([manifest.reviewCandidate,...(manifest.reviewCandidates??[]),take.id].filter(Boolean))];
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log(`Staged ${action}: ${take.media.frames} measured frames. Existing speech untouched.`);
