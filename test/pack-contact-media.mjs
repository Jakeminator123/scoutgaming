import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {packContactMedia} from '../pipeline/pack-contact-media.mjs';

test('concatenated RGB and masks retain exactly one frame per tracking record',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'contact-pack-'));
  try{
    const masks=path.join(root,'masks');fs.mkdirSync(masks);
    const ffmpeg=args=>execFileSync('ffmpeg',['-hide_banner','-loglevel','error',...args]);
    const sources=['first.mp4','second.mp4'].map(f=>path.join(root,f));
    for(const [i,file] of sources.entries())ffmpeg(['-f','lavfi','-i',`color=c=${i?'blue':'green'}:s=64x36:r=24`,'-frames:v',String(i?97:169),'-c:v','libx264','-pix_fmt','yuv420p',file]);
    ffmpeg(['-f','lavfi','-i','color=c=red:s=64x36:r=24','-frames:v','180',path.join(masks,'%04d.png')]);
    // These frame intervals previously produced 180 clean frames but 181
    // packed frames because concat and image inputs used different time bases.
    const result=packContactMedia({segments:[{file:sources[0],start:0,end:125},{file:sources[1],start:1,end:56}],masks,
      sourceOutput:path.join(root,'clean.mp4'),packedOutput:path.join(root,'packed.mp4')});
    assert.equal(result.frames,180);assert.equal(result.fps,24);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
