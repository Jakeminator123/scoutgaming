import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateContactTake,validateSharedExtraction,validateContinuation,calibrationPayload} from '../web/public/performance-contact.mjs';
import {resolveMediaAbsolutePath} from '../tools/media-layout.mjs';
const root=fileURLToPath(new URL('../web/public/',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(resolveMediaAbsolutePath(path.join(root,'dealers/astrid/performance/manifest.json'))));
const sha=value=>createHash('sha256').update(value).digest('hex');
let failures=0;
for(const take of [...manifest.takes??[],...manifest.continuations??[]]) {
  const errors=validateContactTake(take,{approved:['approved','contact-approved'].includes(take.status)});
  errors.push(...validateSharedExtraction(take,manifest.takes));
  if(take.continuation)errors.push(...validateContinuation(take,manifest.takes));
  if(sha(calibrationPayload(take))!==take.calibrationSha256)errors.push('Tracking/camera checksum mismatch');
  const oldFile=path.resolve(root,take.media.src),file=resolveMediaAbsolutePath(oldFile);
  if(!oldFile.startsWith(root))errors.push('Asset outside public directory');
  else if(!fs.existsSync(file)||sha(fs.readFileSync(file))!==take.media.sha256)errors.push('Packed RGB/mask checksum mismatch');
  else if(process.argv.includes('--probe')) {
    const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=codec_name,width,height,has_b_frames,r_frame_rate,nb_read_frames','-of','json',file],{encoding:'utf8'}));
    const s=probe.streams[0],m=take.media;
    const [numerator,denominator]=s.r_frame_rate.split('/').map(Number);
    if(s.codec_name!=='h264'||s.has_b_frames!==0)errors.push('Expected H.264 without reordered frames');
    if(s.width!==m.width||s.height!==m.height*2||Number(s.nb_read_frames)!==m.frames||Math.abs(numerator/denominator-m.fps)>.001)errors.push('Media dimensions/rate/frame count differ from calibration');
  }
  if(errors.length){failures++;console.error(take.id+': '+errors.join('; '));}
  else console.log(`${take.id}: technical integrity PASS; visual status ${take.status}.`);
}
if(failures)process.exitCode=1;
else console.log('Performance integrity passed. This does not approve card contact, likeness, or device performance.');
