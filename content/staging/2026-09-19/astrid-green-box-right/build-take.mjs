import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {calibrationPayload,validateContactTake} from '../../../../web/public/performance-contact.mjs';

// Compose a green player-box take for the Blender table from a take folder:
//   node build-take.mjs <take-dir> [--install]
// The folder holds source.mp4, take-config.json, mask/ and card-track/. Same
// plate 269f8943, same PlateCam placement and framingScale as the de1f90a9
// dealer-upcard take so actor, shoe and card register alike. Without
// --install nothing is written to web/public; the composed take.json stays in
// the take folder as evidence.
const here=path.dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2);
const install=args.includes('--install');
const takeDir=path.resolve(args.find(a=>!a.startsWith('--'))??here);
const publicDir=path.resolve(here,'../../../../web/public/review/astrid-table-v2');
const config=JSON.parse(fs.readFileSync(path.join(takeDir,'take-config.json')));
const BOX=config.box;
if(!Number.isInteger(BOX))throw new Error('take-config.json needs an integer box');
const track=JSON.parse(fs.readFileSync(path.join(takeDir,'card-track/card-track.json')));
const mask=JSON.parse(fs.readFileSync(path.join(takeDir,'mask/manifest.json')));
const dealerTake=JSON.parse(fs.readFileSync(path.join(publicDir,'take.json')));
const packed=fs.readFileSync(path.join(takeDir,'mask/actor-packed.mp4'));
const packedHash=createHash('sha256').update(packed).digest('hex');
if(track.sourceSha256!==config.sourceSha256||mask.sourceSha256!==config.sourceSha256)throw new Error('Card tracking or matte does not use the configured source');
if(mask.actorPackedSha256!==packedHash||mask.frameCount!==track.frameCount||mask.fps!=='24/1')throw new Error('Mask media, geometry or frame clock differs from the tracked take');
const [x,y,width,height]=mask.crop;
const events=track.authoredEvents;
// The shoe's front lower lip sits at (1265.5,673.5) in de1f90a9; each source
// records its own measured lip so the registration note stays honest.
const shoeLipSource=config.shoeLipSource??[1265.5,673.5];
const placement={...dealerTake.camera.placement};
const take={
  version:1,id:`astrid-table-v2-first-card-box${BOX}-${config.generationId}`,dealer:'astrid',action:'deal-right',box:BOX,status:'review',enabled:true,
  cameraApproval:`${dealerTake.cameraApproval} Box-${BOX} take reuses the same placement/framingScale; source registered by the shared plate, not re-fitted.`,
  media:{src:`review/astrid-table-v2/actor-packed-box${BOX}.mp4`,sha256:packedHash,layout:'rgb-over-masks-r-actor-g-fingers',width,height,fps:24,frames:mask.frameCount},
  camera:{width,height,shoeOutlet:[(shoeLipSource[0]-x)/width,(shoeLipSource[1]-y)/height],placement},
  events,
  tracking:{kind:'chroma-card',sourceSha256:config.sourceSha256,keepSourceLanding:config.keepSourceLanding!==false,scope:`first-card-of-box${BOX}-only`,
    landing:config.keepSourceLanding!==false?'filmed-quad-registers-the-box-fan':'dom-fan-of-box',jobId:config.jobId,limitations:track.limits},
  frames:track.frames.map(f=>({frame:f.frame,card:f.frame<events.pickup||f.frame>events.land?null:{corners:f.quad.map(([u,v])=>[(u-x)/width,(v-y)/height,0]),faceUp:f.faceUp},tracking:{method:f.method,confidence:f.confidence,inferredCorners:f.inferredCorners}})),
};
take.calibrationSha256=createHash('sha256').update(calibrationPayload(take)).digest('hex');
const errors=validateContactTake(take);if(errors.length)throw new Error(errors.join('\n'));
if(JSON.stringify(take.camera.placement)!==JSON.stringify(dealerTake.camera.placement))throw new Error('Placement drifted from the dealer take');
fs.writeFileSync(path.join(takeDir,`take-box${BOX}.json`),JSON.stringify(take,null,2)+'\n');
if(install){
  fs.mkdirSync(publicDir,{recursive:true});
  fs.writeFileSync(path.join(publicDir,`actor-packed-box${BOX}.mp4`),packed);
  fs.copyFileSync(path.join(takeDir,'mask/manifest.json'),path.join(publicDir,`mask-manifest-box${BOX}.json`));
  fs.writeFileSync(path.join(publicDir,`take-box${BOX}.json`),JSON.stringify(take,null,2)+'\n');
  const existing=fs.existsSync(path.join(publicDir,'takes.json'))?JSON.parse(fs.readFileSync(path.join(publicDir,'takes.json'))).takes:['take.json'];
  const takes=[...new Set([...existing,`take-box${BOX}.json`])];
  fs.writeFileSync(path.join(publicDir,'takes.json'),JSON.stringify({version:1,takes},null,2)+'\n');
}
console.log(JSON.stringify({id:take.id,box:BOX,installed:install,crop:mask.crop,media:take.media,shoeOutlet:take.camera.shoeOutlet,placement,events,calibrationSha256:take.calibrationSha256}));
