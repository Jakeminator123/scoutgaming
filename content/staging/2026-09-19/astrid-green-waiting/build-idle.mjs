import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {idleSegmentErrors} from '../../../../web/public/astrid-idle-scheduler.mjs';

// Compose the waiting idle manifest: the eye-contact loop that was already
// playing stays the base; the green waiting clip contributes glance segments.
//   node build-idle.mjs [--install]
// Both media share the plate 269f8943 crop origin (560,0) and the dealer
// take's placement/framingScale. --install copies the glance media and
// idle.json into web/public/review/astrid-green-waiting/; the base media stays
// where the elevated idle installed it and is verified by hash.
const dir=path.dirname(fileURLToPath(import.meta.url));
const install=process.argv.includes('--install');
const root=path.resolve(dir,'../../../../web/public');
const publicDir=path.join(root,'review/astrid-green-waiting');
const dealerTake=JSON.parse(fs.readFileSync(path.join(root,'review/astrid-table-v2/take.json')));
const config=JSON.parse(fs.readFileSync(path.join(dir,'take-config.json')));
const mask=JSON.parse(fs.readFileSync(path.join(dir,'mask/manifest.json')));
const packed=fs.readFileSync(path.join(dir,'mask/actor-packed.mp4'));
const sha=createHash('sha256').update(packed).digest('hex');
if(mask.sourceSha256!==config.sourceSha256||mask.actorPackedSha256!==sha||mask.fps!=='24/1')throw new Error('Mask does not match the configured source');
const baseManifest=JSON.parse(fs.readFileSync(path.join(root,'review/astrid-elevated-idle/idle.json')));
const baseBytes=fs.readFileSync(path.join(root,baseManifest.src));
const baseSha=createHash('sha256').update(baseBytes).digest('hex');
if(baseManifest.jobId!==config.base.jobId||baseSha!==config.base.sha256||baseManifest.sha256!==baseSha||baseManifest.frames!==config.base.frames)throw new Error('The base idle on disk is not the loop recorded in take-config.json');
const [x,y,width,height]=mask.crop;
const placement={...dealerTake.camera.placement};
const take={
  version:2,id:`astrid-table-v2-waiting-${config.base.jobId.slice(0,8)}+${config.generationId}`,dealer:'astrid',action:'idle',status:'review',enabled:true,
  base:{jobId:baseManifest.jobId,src:baseManifest.src,sha256:baseSha,sourceSha256:baseManifest.sourceSha256,width:baseManifest.width,height:baseManifest.height,fps:baseManifest.fps,frames:baseManifest.frames,crop:baseManifest.crop,loop:true},
  glances:{jobId:config.jobId,src:'review/astrid-green-waiting/actor-packed.mp4',sha256:sha,sourceSha256:config.sourceSha256,width,height,fps:24,frames:mask.frameCount,crop:mask.crop,readyFrames:config.readyFrames,
    camera:{width,height,placement}},
  camera:{width:baseManifest.width,height:baseManifest.height,placement},
  spliceOffset:config.spliceOffset,spliceMeasurement:config.spliceMeasurement,
  segments:config.segments,scheduler:config.scheduler,measured:config.measured,
  ...(config.restManifest?{rest:JSON.parse(fs.readFileSync(path.resolve(dir,config.restManifest)))}:{}),
  note:'Base = the eye-contact loop already in play (every base frame is a ready pose, held at once); glance segments from the waiting clip splice in at the base loop boundary with a rigid 2D offset; no warping.',
};
const errors=idleSegmentErrors(take);if(errors.length)throw new Error(errors.join('\n'));
fs.writeFileSync(path.join(dir,'idle.json'),JSON.stringify(take,null,2)+'\n');
if(install){
  fs.mkdirSync(publicDir,{recursive:true});
  fs.writeFileSync(path.join(publicDir,'actor-packed.mp4'),packed);
  fs.copyFileSync(path.join(dir,'mask/manifest.json'),path.join(publicDir,'mask-manifest.json'));
  fs.writeFileSync(path.join(publicDir,'idle.json'),JSON.stringify(take,null,2)+'\n');
}
console.log(JSON.stringify({id:take.id,installed:install,base:{jobId:take.base.jobId,src:take.base.src,frames:take.base.frames,sha256:baseSha},glances:{crop:mask.crop,frames:take.glances.frames,sha256:sha},spliceOffset:take.spliceOffset,segments:take.segments}));
