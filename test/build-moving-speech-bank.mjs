import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createMovingSpeechSourceSet, movingSpeechHash } from '../services/game/moving-speech-bank.mjs';
import { probeMovingSpeechSource } from '../tools/prepare-moving-speech-sources.mjs';
const exec=promisify(execFile);
test('bank builder preserves exact frames, duplicate media IDs and explicit rest; refuses overwrites and changed sources',async t=>{
  const python=process.platform==='win32'?'python':'python3';
  try {await exec(python,['--version']);await exec('ffmpeg',['-version']);await exec('ffprobe',['-version']);}
  catch {t.skip('Python/ffmpeg/ffprobe are required for the authoring integration fixture');return;}
  const root=await mkdtemp(join(tmpdir(),'croupier-moving-builder-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'sources'));
  const first='11111111-1111-1111-1111-111111111111',second='22222222-2222-2222-2222-222222222222';
  const file=join(root,'sources',first+'.mp4');
  await exec('ffmpeg',['-v','error','-nostdin','-f','lavfi','-i','color=red:s=1080x1920:r=24:d=0.084',
    '-f','lavfi','-i','color=blue:s=1080x1920:r=24:d=0.084','-filter_complex','[0:v][1:v]concat=n=2:v=1:a=0',
    '-frames:v','4','-c:v','libx264','-crf','0','-threads','2','-pix_fmt','yuv420p',file],{windowsHide:true});
  const bytes=await readFile(file),metadata=await probeMovingSpeechSource(file);
  assert.equal(metadata.frameCount,4);
  await writeFile(join(root,'sources',second+'.mp4'),bytes);
  const manifest=createMovingSpeechSourceSet({dealerId:'dragan',rest:{videoId:second,frame:3},
    clips:[first,second].map(videoId=>({videoId,sha256:movingSpeechHash(bytes),bytes:bytes.length,...metadata}))});
  await writeFile(join(root,'sources.json'),JSON.stringify(manifest));
  const output=join(root,'output'),script=resolve('tools/build-moving-speech-bank.py');
  const result=await exec(python,[script,'--sources',root,'--output',output],{windowsHide:true});
  const receipt=JSON.parse(result.stdout);
  assert.equal(receipt.status,'pool-only');assert.equal(receipt.visualApproval,false);
  assert.equal(receipt.clips,2);assert.equal(receipt.poolFrames,2);
  assert.equal(receipt.sourceSetSha256,manifest.sourceSetSha256);
  const mapping=JSON.parse(await readFile(join(output,'dragan','takes.json'),'utf8'));
  assert.deepEqual(mapping.takes['clip-'+first],mapping.takes['clip-'+second]);
  assert.equal(mapping.vila,mapping.takes['clip-'+second][3]);
  assert.notEqual(mapping.vila,mapping.takes['clip-'+second][0]);
  assert.equal(mapping.segs.reduce((a,b)=>a+b,0),receipt.poolFrames);
  const frameHashes=async path=>{
    const {stdout}=await exec('ffmpeg',['-v','error','-i',path,'-map','0:v:0','-an','-f','framemd5','-'],{windowsHide:true});
    return stdout.split(/\r?\n/).filter(line=>line&&!line.startsWith('#')).map(line=>line.split(',').at(-1).trim());
  };
  const originalFrames=await frameHashes(file),poolFrames=await frameHashes(join(output,'dragan','pool.mp4'));
  assert.deepEqual(mapping.takes['clip-'+first].map(index=>poolFrames[index]),originalFrames);
  assert.equal(movingSpeechHash(await readFile(file)),manifest.clips[0].sha256);
  await assert.rejects(exec(python,[script,'--sources',root,'--output',output]));
  // Transfer only the pool and its receipt; the GPU must not need registry
  // credentials or original source files. This stub verifies packaging, not AI.
  const transfer=join(root,'transfer'),worker=join(root,'reviewed-worker');
  await cp(output,transfer,{recursive:true}); await mkdir(worker);
  await writeFile(join(worker,'rorlig.py'),`
import json
from pathlib import Path
def forbered(pool, sigma, cheek, out, segs):
    assert sigma == 1.0 and cheek == 90
    p = Path(out); p.mkdir()
    (p / 'meta.json').write_text(json.dumps({'frames': sum(segs), 'size': [1080, 1920], 'missing': 0}))
    for f in ('latents.pt', 'masks.npz', 'bias.npz'):
        (p / f).write_bytes(b'packaging-test-only')
`);
  const receiptBytes=await readFile(join(transfer,'bank-receipt.json'));
  const receiptHash=movingSpeechHash(receiptBytes);
  const prepareArgs=['--pool',transfer,'--prepare-with',worker,'--expected-receipt-sha256',receiptHash];
  const prepared=join(root,'prepared');
  const preparation=await exec(python,[script,...prepareArgs,'--output',prepared],{windowsHide:true});
  const preparedReceipt=JSON.parse(preparation.stdout);
  assert.equal(preparedReceipt.status,'prepared'); assert.equal(preparedReceipt.visualApproval,false);
  assert.equal(preparedReceipt.inputReceiptSha256,receiptHash);
  assert.equal(preparedReceipt.avatarSha256,movingSpeechHash(await readFile(join(prepared,'dragan.tar'))));
  assert.equal(preparedReceipt.files['pool.mp4'],receipt.files['pool.mp4']);
  assert.equal(movingSpeechHash(await readFile(join(transfer,'bank-receipt.json'))),receiptHash);
  await assert.rejects(exec(python,[script,...prepareArgs,'--output',prepared]));
  await writeFile(join(transfer,'dragan','takes.json'),'{}');
  await assert.rejects(exec(python,[script,...prepareArgs,'--output',join(root,'bad-transfer')]),/moving_bank_pool_changed/);
  await writeFile(join(transfer,'bank-receipt.json'),'{}');
  await assert.rejects(exec(python,[script,...prepareArgs,'--output',join(root,'bad-receipt')]),/moving_bank_receipt_changed/);
  await writeFile(file,Buffer.alloc(bytes.length));
  await assert.rejects(exec(python,[script,'--sources',root,'--output',join(root,'changed')]),/moving_bank_source_changed/);
});
