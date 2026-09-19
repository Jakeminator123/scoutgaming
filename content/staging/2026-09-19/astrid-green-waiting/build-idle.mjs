import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {idleSegmentErrors} from '../../../../web/public/astrid-idle-scheduler.mjs';

// Compose the waiting idle manifest from mask/manifest.json + take-config.json:
//   node build-idle.mjs [--install]
// Same plate 269f8943 and PlateCam placement/framingScale as the dealer take
// so the idle registers with the takes it cuts to. --install copies the packed
// media and idle.json into web/public/review/astrid-green-waiting/.
const dir=path.dirname(fileURLToPath(import.meta.url));
const install=process.argv.includes('--install');
const publicDir=path.resolve(dir,'../../../../web/public/review/astrid-green-waiting');
const dealerTake=JSON.parse(fs.readFileSync(path.resolve(dir,'../../../../web/public/review/astrid-table-v2/take.json')));
const config=JSON.parse(fs.readFileSync(path.join(dir,'take-config.json')));
const mask=JSON.parse(fs.readFileSync(path.join(dir,'mask/manifest.json')));
const packed=fs.readFileSync(path.join(dir,'mask/actor-packed.mp4'));
const sha=createHash('sha256').update(packed).digest('hex');
if(mask.sourceSha256!==config.sourceSha256||mask.actorPackedSha256!==sha||mask.fps!=='24/1')throw new Error('Mask does not match the configured source');
const [x,y,width,height]=mask.crop;
const take={
  version:1,id:`astrid-table-v2-waiting-${config.generationId}`,dealer:'astrid',action:'idle',status:'review',enabled:true,jobId:config.jobId,
  src:'review/astrid-green-waiting/actor-packed.mp4',sha256:sha,layout:'rgb-over-straight-alpha',width,height,fps:24,frames:mask.frameCount,
  sourceSha256:config.sourceSha256,crop:mask.crop,
  camera:{width,height,placement:{...dealerTake.camera.placement}},
  readyFrames:config.readyFrames,segments:config.segments,scheduler:config.scheduler,measured:config.measured,
  note:'Waiting idle for the Blender table; plays segment by segment under a randomized scheduler; any dealing take holds it at the running segment end (ready pose).',
};
const errors=idleSegmentErrors(take);if(errors.length)throw new Error(errors.join('\n'));
fs.writeFileSync(path.join(dir,'idle.json'),JSON.stringify(take,null,2)+'\n');
if(install){
  fs.mkdirSync(publicDir,{recursive:true});
  fs.writeFileSync(path.join(publicDir,'actor-packed.mp4'),packed);
  fs.copyFileSync(path.join(dir,'mask/manifest.json'),path.join(publicDir,'mask-manifest.json'));
  fs.writeFileSync(path.join(publicDir,'idle.json'),JSON.stringify(take,null,2)+'\n');
}
console.log(JSON.stringify({id:take.id,installed:install,crop:mask.crop,frames:take.frames,sha256:sha,segments:take.segments,readyFrames:take.readyFrames}));
