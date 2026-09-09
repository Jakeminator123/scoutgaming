import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

// The matte is an extension of the original take, never a replacement voice.
const base=path.resolve('web/public/dealers/astrid');
const actor=path.join(base,'actor');
const read=p=>JSON.parse(fs.readFileSync(p));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const main=read(path.join(base,'streams/index.json'));
const masks=read(path.join(actor,'streams/index.json'));
const provenance=read(path.join(actor,'provenance.json'));
const check=(ok,message)=>{if(!ok)throw new Error(message);};
check(masks.fullActor&&masks.width===main.width&&masks.height===main.height,'Actor camera dimensions changed');
check(Object.keys(masks.clips).length===Object.keys(main.clips).length,'Incomplete actor coverage');
for(const [key,clip] of Object.entries(main.clips)){
  const mask=masks.clips[key],record=provenance.sources[key];
  check(mask&&record&&mask.frameCount===clip.frameCount&&mask.frames.length===clip.frameCount&&record.frames===clip.frameCount,`Frame pairing failed: ${key}`);
  check(sha(path.join(base,'streams',clip.file))===record.sha256&&mask.sha256===record.sha256,`Original RGB changed: ${key}`);
  check(sha(path.join(actor,'streams',mask.file))===record.matteSha256&&mask.matteSha256===record.matteSha256,`Matte changed: ${key}`);
}
const audioHash=p=>execFileSync('ffmpeg',['-v','error','-i',p,'-map','0:a','-c','copy','-f','hash','-hash','sha256','-'],{encoding:'utf8'}).trim();
for(const [key,take] of Object.entries(provenance.nativeSpeech)){
  const source=path.join(base,'speech',`${key}.mp4`),packed=path.resolve('web/public',take.src);
  check(sha(source)===take.sourceSha256&&sha(packed)===take.sha256,`Native speech pair changed: ${key}`);
  if(process.argv.includes('--probe')){
    check(audioHash(source)===take.audioHash&&audioHash(packed)===take.audioHash,`Embedded audio changed: ${key}`);
    const metadata=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,nb_frames','-of','json',packed],{encoding:'utf8'})).streams[0];
    check(metadata.width===take.width&&metadata.height===take.height*2&&+metadata.nb_frames===take.frames,`Native frame pairing failed: ${key}`);
  }
}
check(sha(path.resolve('web/public',provenance.room.src))===provenance.room.sha256,'Room plate changed');
console.log(`PASS: ${Object.keys(main.clips).length} Astrid actor mattes, two original embedded audio tracks and one room plate. Visual approval remains separate.`);
