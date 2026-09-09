// Join an empty-hand pose transition to an existing measured delivery. Contact
// frames and corner measurements are shifted, never retracked or interpolated.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {calibrationPayload,validateContactTake} from '../web/public/performance-contact.mjs';

const [entryDirectory,contactDirectory,strideValue='4']=process.argv.slice(2);
const stride=Number(strideValue);if(![1,4].includes(stride))throw new Error('Entry stride must be 1 or 4');
if(!entryDirectory||!contactDirectory)throw new Error('Usage: prepend-contact-entry.mjs entry-directory contact-directory');
const entry=path.resolve(entryDirectory),contact=path.resolve(contactDirectory);
const output=path.join(entry,'combined');fs.mkdirSync(output,{recursive:true});
const original=JSON.parse(fs.readFileSync(path.join(entry,'original-take.json')));
const prefix=fs.readdirSync(path.join(entry,'frames')).filter(f=>f.endsWith('.png')).sort();
// Only empty-hand preparation may be sampled. The measured contact footage
// always retains its original speed and every original frame.
const selected=prefix.filter((_,i)=>i%stride===0).slice(0,24);
if(selected.length!==24)throw new Error('Entry requires 24 source samples');
for(const folder of ['frames','contact-masks'])fs.mkdirSync(path.join(output,folder),{recursive:true});
const copy=(source,folder,index)=>fs.copyFileSync(source,path.join(output,folder,String(index+1).padStart(4,'0')+'.png'));
selected.forEach((file,index)=>{
  copy(path.join(entry,'frames',file),'frames',index);
  execFileSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',path.join(entry,'person',file),'-vf','format=rgba,lutrgb=g=0:b=0','-frames:v','1','-pix_fmt','rgba',path.join(output,'contact-masks',String(index+1).padStart(4,'0')+'.png')]);
});
for(let index=0;index<original.media.frames;index++){
  const name=String(index+1).padStart(4,'0')+'.png';
  for(const folder of ['frames','contact-masks'])copy(path.join(contact,folder,name),folder,index+selected.length);
}
const target=path.resolve('web/public/dealers/astrid/performance');
const encode=['-an','-c:v','libx264','-crf','18','-bf','0','-pix_fmt','yuv420p','-movflags','+faststart'];
execFileSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-framerate','24','-i',path.join(output,'frames/%04d.png'),...encode,path.join(output,'centre-source.mp4')]);
execFileSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-framerate','24','-i',path.join(output,'frames/%04d.png'),'-framerate','24','-i',path.join(output,'contact-masks/%04d.png'),'-filter_complex','[0:v][1:v]vstack[out]','-map','[out]',...encode,path.join(output,'centre-review.mp4')]);
const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=nb_read_frames,width,height','-of','json',path.join(output,'centre-review.mp4')],{encoding:'utf8'})).streams[0];
if(Number(probe.nb_read_frames)!==selected.length+original.media.frames||probe.width!==original.media.width||probe.height!==original.media.height*2)throw new Error('Packed frame count/dimensions changed; public media was not replaced');
const take=structuredClone(original),offset=selected.length;
take.id='astrid-centre-continuous-20260909';take.status='review';take.entryFrames=offset;
take.frames=[...selected.map((_,frame)=>({frame,card:null})),...take.frames.map(row=>({...row,frame:row.frame+offset}))];
take.media.frames=take.frames.length;
take.events=Object.fromEntries(Object.entries(take.events).map(([key,frame])=>[key,frame+offset]));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
take.media.sha256=sha(fs.readFileSync(path.join(output,'centre-review.mp4')));
take.calibrationSha256=sha(calibrationPayload(take));
take.review={result:'pending',date:'2026-09-09',mediaSha256:take.media.sha256,calibrationSha256:take.calibrationSha256,
  note:'Empty-hand entry joins the existing measured delivery. Contact limitations remain; not default-table approval.'};
const errors=validateContactTake(take);if(errors.length)throw new Error(errors.join('; '));
const manifestFile=path.join(target,'manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestFile));
manifest.takes=manifest.takes.filter(t=>t.action!=='deal-centre');manifest.takes.unshift(take);
manifest.reviewCandidate=take.id;
manifest.reviewCandidates=[...new Set([take.id,...manifest.takes.filter(t=>t.status==='review').map(t=>t.id)])];
for(const name of ['centre-source.mp4','centre-review.mp4'])fs.copyFileSync(path.join(output,name),path.join(target,name));
fs.copyFileSync(path.join(entry,'source.mp4'),path.join(target,'centre-entry-source.mp4'));
fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
console.log(`Joined ${offset} entry frames with ${original.media.frames} unchanged contact frames`);
