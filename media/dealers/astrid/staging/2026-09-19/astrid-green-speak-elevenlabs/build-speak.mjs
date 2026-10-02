#!/usr/bin/env node
// Compose review/astrid-green-speak/speak.json (version 2, one keyed take per
// line) from each line's vetted matte manifest and install the packed media
// beside it as <line>.mp4. The placement is the dealer take's
// (review/astrid-table-v2/take.json), read from disk, never retyped.
// The greeting lives in this folder; every other line under lines/<line>/.
//   node build-speak.mjs [--install]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {SPEECH_LINES} from '../../../../web/public/speech-lines.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../../../..');
const pub=path.join(repo,'web/public');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const dealer=JSON.parse(fs.readFileSync(path.join(pub,'review/astrid-table-v2/take.json')));
const jobs=JSON.parse(fs.readFileSync(path.join(here,'jobs.json')));
const lineDirs={greeting:here,...Object.fromEntries(Object.keys(jobs).map(id=>[id,path.join(here,'lines',id)]))};
const out=path.join(pub,'review/astrid-green-speak');
const lines={};
const alignment=JSON.parse(fs.readFileSync(path.join(here,'registration/actor-offset.json')));
for(const [id,dir] of Object.entries(lineDirs)){
  if(!fs.existsSync(path.join(dir,'mask/manifest.json'))){console.warn('skipping',id,'no matte yet');continue;}
  const config=JSON.parse(fs.readFileSync(path.join(dir,'take-config.json')));
  const mask=JSON.parse(fs.readFileSync(path.join(dir,'mask/manifest.json')));
  const audioSync=JSON.parse(fs.readFileSync(path.join(dir,'registration/audio-sync.json')));
  if(sha(path.join(dir,'source.mp4'))!==config.sourceSha256)throw new Error(`${id}: source.mp4 does not match take-config`);
  if(mask.sourceSha256!==config.sourceSha256)throw new Error(`${id}: mask manifest was built from another source`);
  const packed=path.join(dir,'mask/actor-packed.mp4');
  if(sha(packed)!==mask.actorPackedSha256)throw new Error(`${id}: packed media does not match the mask manifest`);
  const text=SPEECH_LINES[id];if(typeof text!=='string')throw new Error(`${id}: no text in speech-lines.mjs`);
  const audio=`dealers/astrid/audio/en/${id}.mp3`;
  const [cx,cy,cw,ch]=mask.crop;
  const fps=Number(mask.fps.split('/')[0])/Number(mask.fps.split('/')[1]??1);
  lines[id]={
    jobId:config.generationId,packedSource:packed,
    media:{src:`review/astrid-green-speak/${mask.faceRepair?`${id}-face-${mask.actorPackedSha256.slice(0,12)}`:id}.mp4`,sha256:mask.actorPackedSha256,...(mask.faceRepair?{matteRevision:'opaque-head-interior-v2'}:{}),layout:'rgb-over-alpha',width:cw,height:ch,fps,frames:mask.frameCount,
      sourceSha256:config.sourceSha256,nativeTakeSha256:config.nativeTakeSha256,crop:mask.crop},
    camera:{width:cw,height:ch,placement:{...dealer.camera.placement,x:cx,y:cy}},
    audio,audioSha256:sha(path.join(pub,audio)),text,
    cutIn:0,cutOut:mask.frameCount-1,audioOffsetSeconds:audioSync.lagSeconds,
    audioMeasurement:{method:'cross-correlation of the take\'s embedded AAC track against the line mp3 (44.1 kHz mono)',lagSamples:audioSync.lagSamples,normalisedPeak:audioSync.normalisedPeak,
      takeOnsetSec:audioSync.takeOnsetSec,lineOnsetSec:audioSync.lineOnsetSec??audioSync.greetingOnsetSec},
    registration:config.registration,readyPose:config.readyPose,
  };
  const joinPath=path.join(here,'transitions',`${id}.json`);
  if(fs.existsSync(joinPath)){
    const join=JSON.parse(fs.readFileSync(joinPath));
    const idle=JSON.parse(fs.readFileSync(path.join(pub,'review/astrid-green-waiting/idle.json')));
    if(join.mediaSha256!==mask.actorPackedSha256||join.idleSha256!==idle.base.sha256)throw new Error(`${id}: stale transition fit`);
    if(alignment.idleSha256!==idle.base.sha256||JSON.stringify(join.actorOffset)!==JSON.stringify(alignment.offset))throw new Error(`${id}: stale actor placement`);
    lines[id].transition=join;
    for(const edge of ['enter','exit']){
      const image=path.join(here,'transitions',join[edge].flow);
      if(sha(image)!==join[edge].sha256)throw new Error(`${id}: transition image mismatch`);
      join[edge].src=`review/astrid-green-speak/${id}-${edge}-${join[edge].sha256.slice(0,12)}.png`;
      if(process.argv.includes('--install'))fs.copyFileSync(image,path.join(pub,join[edge].src));
    }
  }
}
// A reviewed display revision is optional. Validate every parent source and
// paired recording before reusing its calibrated copy on a later rebuild.
const displayPath=path.join(here,'registration/display-revision.json');
let displayRevision=null;
if(fs.existsSync(displayPath)){
  const binding=JSON.parse(fs.readFileSync(displayPath));
  const manifest=path.resolve(here,binding.manifest),folder=path.dirname(manifest);
  if(sha(manifest)!==binding.sha256)throw new Error('Display revision manifest changed');
  displayRevision=JSON.parse(fs.readFileSync(manifest));
  if(Object.keys(displayRevision.lines).sort().join()!==Object.keys(lines).sort().join())throw new Error('Display revision line set is stale');
  for(const [id,line] of Object.entries(lines)){
    const revised=displayRevision.lines[id];
    if(revised.media.parentPackedSha256!==line.media.sha256||revised.audioSha256!==line.audioSha256||revised.audioOffsetSeconds!==line.audioOffsetSeconds||revised.cutIn!==line.cutIn||revised.cutOut!==line.cutOut)throw new Error(`${id}: stale display revision`);
    const packed=path.join(folder,`${id}.mp4`);
    if(sha(packed)!==revised.media.sha256)throw new Error(`${id}: display media changed`);
    lines[id]={...revised,packedSource:packed};
    for(const edge of ['enter','exit']){
      const fit=revised.transition[edge],image=path.join(folder,fit.flow);
      if(sha(image)!==fit.sha256)throw new Error(`${id}: display flow changed`);
      if(process.argv.includes('--install'))fs.copyFileSync(image,path.join(pub,fit.src));
    }
  }
}
const greetingSplice=JSON.parse(fs.readFileSync(path.join(here,'registration/splice.json')));
const take={
  version:2,id:'astrid-green-speak-creatify-aurora',dealer:'astrid',action:'speak',status:'review',enabled:true,
  provider:'ElevenLabs Image & Video API, model creatify-aurora 720p',
  approval:'Kevin 2026-09-19: greeting "mount it, it was perfect"; then all other Astrid lines the same way. Zero generation.',
  // Rigid 2D translation applied at runtime on top of the source registration
  // (source px, scaled with the fit); tune without re-encoding. 0 = props.
  spliceOffset:[0,0],
  actorOffset:alignment.offset,
  spliceMeasurement:{method:'greeting frame 0/115 against the base eye-contact idle frame 0 and the dealer take frame 0; phase correlation of head/torso/hand windows, dx/dy in source px',
    windows:{head:[870,26,1050,226],torso:[760,240,1200,520],leftHand:[760,560,960,700],shoeHand:[1080,540,1330,700]},...greetingSplice,
    note:'Props register at (0,15). The actor is translated down 20 source pixels to match the idle head and torso height. Both playback and silent join endpoints share this rigid offset; size, source frames and audio are unchanged. The small residual hand-pose difference is interpolated during joins.'},
  lines:Object.fromEntries(Object.entries(lines).map(([id,{packedSource,...line}])=>[id,line])),
  note:'Each full recording keeps frame 0 through its last frame with unchanged paired audio. A 220 ms motion-aligned silent join enters and leaves it; the recorded line starts on the first presented speech frame plus audioOffsetSeconds. The destination idle frame is painted before idle resumes.',
};
if(displayRevision)Object.assign(take,{spliceMeasurement:displayRevision.spliceMeasurement,visualRevision:displayRevision.visualRevision,approval:displayRevision.approval,note:displayRevision.note});
console.log(Object.entries(lines).map(([id,l])=>`${id}: ${l.media.frames} frames, crop ${l.media.crop.join(',')}, audio offset ${l.audioOffsetSeconds}s (peak ${l.audioMeasurement.normalisedPeak})`).join('\n'));
if(process.argv.includes('--install')){
  fs.mkdirSync(out,{recursive:true});
  for(const line of Object.values(lines)){const target=path.join(pub,line.media.src);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(line.packedSource,target);}
  fs.writeFileSync(path.join(out,'speak.json'),JSON.stringify(take,null,2)+'\n');
  fs.writeFileSync(path.join(here,'speak.json'),JSON.stringify(take,null,2)+'\n');
  console.log('installed',Object.keys(lines).length,'lines to',out);
}
