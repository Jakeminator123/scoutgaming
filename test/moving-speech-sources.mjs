import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareMovingSpeechSources } from '../tools/prepare-moving-speech-sources.mjs';
import { movingSpeechHash } from '../web/moving-speech-bank.mjs';
const id='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222';
const bytes=Buffer.from('original source bytes');
const video=(key=id)=>({id:key,dealer:'dragan',sha256:movingSpeechHash(bytes),bytes:bytes.length,available:true,storage:'private-blob',contentType:'video/mp4',classification:{dealerId:'dragan',kind:'action'}});
async function fixture(t) {
  const parent=await mkdtemp(join(tmpdir(),'croupier-moving-sources-'));
  t.after(()=>rm(parent,{recursive:true,force:true}));
  const registry={videos:[video()]};
  return {parent,registry,options:{dealerId:'dragan',rest:{videoId:id,frame:0},output:join(parent,'bank'),
    readRegistry:async()=>registry,readVideoResponse:async()=>new Response(bytes,{headers:{'content-type':'video/mp4'}}),
    probe:async()=>({fps:24,frameCount:4,width:1080,height:1920})}};
}
test('export preserves bytes, excludes recorded speech, and explicitly reports incompatible fps', async t=>{
  const f=await fixture(t);
  f.registry.videos.push(video(other),{...video('33333333-3333-3333-3333-333333333333'),classification:{dealerId:'dragan',kind:'speech'}});
  f.options.probe=async file=>{if(file.includes(other))throw Error('moving_bank_requires_cfr24');return {fps:24,frameCount:4,width:1080,height:1920};};
  const result=await prepareMovingSpeechSources(f.options);
  assert.equal(result.sourceSet.clips.length,1);
  assert.deepEqual(result.skipped,[{videoId:other,sha256:movingSpeechHash(bytes),reason:'moving_bank_requires_cfr24'}]);
  assert.deepEqual(await readFile(join(f.options.output,'sources',id+'.mp4')),bytes);
  const receipt=JSON.parse(await readFile(join(f.options.output,'export-receipt.json'),'utf8'));
  assert.equal(receipt.visualApproval,false);assert.equal(receipt.workerPrepared,false);
  await assert.rejects(prepareMovingSpeechSources(f.options),{code:'EEXIST'});
  assert.deepEqual(await readFile(join(f.options.output,'sources',id+'.mp4')),bytes);
});
test('mismatched Blob bytes and changed registry never emit a complete manifest', async t=>{
  for(const mode of ['hash','registry']){
    const f=await fixture(t);
    if(mode==='hash')f.options.readVideoResponse=async()=>new Response(Buffer.from('wrong'),{headers:{'content-type':'video/mp4'}});
    else {let reads=0;f.options.readRegistry=async()=>++reads===1?f.registry:{videos:[]};}
    await assert.rejects(prepareMovingSpeechSources(f.options),/source_changed/);
    await assert.rejects(stat(join(f.options.output,'sources.json')),{code:'ENOENT'});
  }
});
test('unsupported rest and foreign sources cannot silently select another resting frame', async t=>{
  const f=await fixture(t);
  f.options.rest={videoId:other,frame:0};
  await assert.rejects(prepareMovingSpeechSources(f.options),/invalid_rest/);
  await assert.rejects(stat(join(f.options.output,'sources.json')),{code:'ENOENT'});
  const g=await fixture(t);g.registry.videos[0].classification.dealerId='paow';
  await assert.rejects(prepareMovingSpeechSources(g.options),/source_unavailable/);
  await assert.rejects(stat(g.options.output),{code:'ENOENT'});
});
