#!/usr/bin/env node
// Compose review/astrid-green-speak/speak.json from the vetted matte manifest
// and install the packed media beside it. The placement is the dealer take's
// (review/astrid-table-v2/take.json), read from disk, never retyped.
//   node build-speak.mjs [--install]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../../../..');
const pub=path.join(repo,'web/public');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const config=JSON.parse(fs.readFileSync(path.join(here,'take-config.json')));
const mask=JSON.parse(fs.readFileSync(path.join(here,'mask/manifest.json')));
const dealer=JSON.parse(fs.readFileSync(path.join(pub,'review/astrid-table-v2/take.json')));
const audioSync=JSON.parse(fs.readFileSync(path.join(here,'registration/audio-sync.json')));
const splice=JSON.parse(fs.readFileSync(path.join(here,'registration/splice.json')));
if(sha(path.join(here,'source.mp4'))!==config.sourceSha256)throw new Error('source.mp4 does not match take-config');
if(mask.sourceSha256!==config.sourceSha256)throw new Error('mask manifest was built from another source');
const packed=path.join(here,'mask/actor-packed.mp4');
if(sha(packed)!==mask.actorPackedSha256)throw new Error('packed media does not match the mask manifest');
const audio='dealers/astrid/audio/en/greeting.mp3';
const [cx,cy,cw,ch]=mask.crop;
const fps=Number(mask.fps.split('/')[0])/Number(mask.fps.split('/')[1]??1);
const take={
  version:1,id:`astrid-green-speak-greeting-${config.generationId}`,dealer:'astrid',action:'speak',status:'review',enabled:true,
  jobId:config.generationId,provider:config.provider,approval:config.status,
  media:{src:'review/astrid-green-speak/actor-packed.mp4',sha256:mask.actorPackedSha256,layout:'rgb-over-alpha',width:cw,height:ch,fps,frames:mask.frameCount,
    sourceSha256:config.sourceSha256,nativeTakeSha256:config.nativeTakeSha256,crop:mask.crop},
  camera:{width:cw,height:ch,placement:{...dealer.camera.placement,x:cx,y:cy}},
  // Rigid 2D translation applied at runtime on top of the source registration
  // (source px, scaled with the fit); tune without re-encoding. 0 = props.
  spliceOffset:[0,0],
  registration:config.registration,
  spliceMeasurement:{method:'phase correlation of head/torso/hand windows, source frame 0 and 115 against the base eye-contact idle frame 0 (the layer shown right before the cut) and the dealer take frame 0; dx/dy in source px',
    windows:{head:[870,26,1050,226],torso:[760,240,1200,520],leftHand:[760,560,960,700],shoeHand:[1080,540,1330,700]},
    ...splice,
    note:'Props register at (0,15) (applied in source.mp4). Against the base idle the take still sits higher: head ~20 px, torso ~20 px, hands 6-10 px. That is a pose difference, not a rigid residual, so no further offset is applied; a cut pop of that size remains.'},
  lines:{greeting:{audio,audioSha256:sha(path.join(pub,audio)),text:"Welcome to Privé Blackjack. Take a seat, I'll be your dealer tonight.",
    cutIn:0,cutOut:mask.frameCount-1,audioOffsetSeconds:audioSync.lagSeconds,
    audioMeasurement:{method:'cross-correlation of the take\'s embedded AAC track against greeting.mp3 (44.1 kHz mono)',lagSamples:audioSync.lagSamples,normalisedPeak:audioSync.normalisedPeak,takeOnsetSec:audioSync.takeOnsetSec,greetingOnsetSec:audioSync.greetingOnsetSec},
    readyPose:config.readyPose}},
  note:'Cut in at frame 0 and out at the last frame, both plate ready poses; the recorded line starts on the first presented frame plus audioOffsetSeconds. Speak plays over the held waiting idle; base idle resumes afterwards.',
};
const out=path.join(pub,'review/astrid-green-speak');
console.log(JSON.stringify({id:take.id,media:take.media,camera:take.camera,line:{cutIn:0,cutOut:take.lines.greeting.cutOut,audioOffsetSeconds:take.lines.greeting.audioOffsetSeconds}},null,1));
if(process.argv.includes('--install')){
  fs.mkdirSync(out,{recursive:true});
  fs.copyFileSync(packed,path.join(out,'actor-packed.mp4'));
  fs.writeFileSync(path.join(out,'speak.json'),JSON.stringify(take,null,2)+'\n');
  fs.writeFileSync(path.join(here,'speak.json'),JSON.stringify(take,null,2)+'\n');
  console.log('installed',out);
}
