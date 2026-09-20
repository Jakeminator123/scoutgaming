import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import contract from '../policies/studio-contract.json' with { type: 'json' };
import schema from '../schemas/video.schema.json' with { type: 'json' };
import seed from '../policies/project.seed.json' with { type: 'json' };
import { validateVideoMetadata, videoFitsLine, videoFitsEvent } from '../lib/video-intake.mjs';
import { classifyVideo, readClassifications } from '../lib/video-classifications.mjs';
import { loadVideoRegistry, getVideoResponse } from '../lib/video-registry.mjs';

const metadata = { label:'QA left', dealerId:'astrid', eventId:'deal.player.left', kind:'action', role:'standard', situation:'box0', notes:'', playback:'once' };
test('canonical manifest, seed, schema and runtime classifications agree for every dealer/group/situation', () => {
  assert.deepEqual(contract.dealers, seed.dealers.map(d=>d.id));
  assert.deepEqual(contract.events.map(e=>({id:e.id,sourceType:e.sourceType})),seed.events.map(e=>({id:e.id,sourceType:e.sourceType})));
  assert.deepEqual(schema.properties.eventId.enum,contract.events.map(e=>e.id));
  assert.deepEqual(schema.properties.dealerId.enum,contract.dealers);
  assert.deepEqual(schema.properties.kind.enum,Object.keys(contract.videoKinds));
  assert.deepEqual(schema.properties.role.enum,Object.keys(contract.roles));
  assert.deepEqual(schema.properties.playback.enum,contract.playback.supported);
  for(const event of contract.events) {
    const constraint=schema.allOf.find(c=>c.if.properties.eventId.const===event.id).then.properties;
    assert.deepEqual(constraint.situation.enum,event.situations.length?event.situations:['']);
    assert.equal(constraint.kind.const,contract.sourceTypes[event.sourceType].kind);
    for(const dealerId of contract.dealers) for(const situation of constraint.situation.enum) {
      const m=validateVideoMetadata({...metadata,dealerId,eventId:event.id,kind:constraint.kind.const,situation});
      assert.equal(videoFitsLine({classification:m},dealerId,event.id),true);
    }
  }
});
test('unknown, unclassified, wrong kind/dealer/group, imprecise and proposed loop metadata fail closed',()=>{
  assert.equal(videoFitsLine({},'astrid','idle.ready'),false);
  for(const patch of [{kind:'gesture'},{dealerId:'other'},{eventId:'new.event'},{situation:''},{situation:'box5'},{playback:'loop'},{random:true}]) assert.throws(()=>validateVideoMetadata({...metadata,...patch}));
  assert.equal(videoFitsLine({classification:metadata},'vera',metadata.eventId),false);
  assert.equal(videoFitsLine({classification:metadata},'astrid','idle.ready'),false);
  assert.equal(videoFitsEvent({classification:metadata},{type:'deal',to:'box',box:1}),false);
  assert.equal(videoFitsEvent({classification:metadata},{type:'deal',to:'box',box:0}),true);
  assert.doesNotThrow(()=>validateVideoMetadata({...metadata,situation:''},{allowLegacySituation:true}));
  assert.equal(videoFitsLine({classification:{...metadata,situation:''}},'astrid',metadata.eventId),false);
});
async function fixture(t) {
  const root=await mkdtemp(join(tmpdir(),'croupier-classification-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const archiveDir=join(root,'archive');await mkdir(archiveDir);
  const id='c01866d1-7c93-43a4-9493-73f7c66d3725', bytes=Buffer.from('test-only-original-no-mutation');
  const sha256=createHash('sha256').update(bytes).digest('hex');
  const file=join(archiveDir,`${id}.mp4`);await writeFile(file,bytes);
  const snapshotPath=join(root,'snapshot.json');await writeFile(snapshotPath,JSON.stringify({items:[{id,sha256,size:bytes.length,verdict:'want'}]}));
  return {id,sha256,file,bytes,options:{archiveDir,snapshotPath,uploadDir:join(root,'uploads')}};
}
test('classifying an existing archive is durable, exact-hash scoped and does not copy or mutate original media',async t=>{
  const f=await fixture(t),registry=await loadVideoRegistry(f.options);
  assert.equal(videoFitsLine(registry.videos[0],'astrid',metadata.eventId),false);
  await classifyVideo({id:f.id,sha256:f.sha256,metadata,previous:null},registry,f.options);
  const saved=await loadVideoRegistry(f.options);
  assert.deepEqual(saved.videos[0].classification,metadata);assert.equal(saved.videos[0].source,'archive');assert.equal(saved.videos[0].available,true);
  assert.deepEqual(await readFile(f.file),f.bytes);
  const response=await getVideoResponse(f.id,new Request(`http://localhost:4188/api/videos/${f.id}`),f.options);
  assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),f.bytes);
  await assert.rejects(classifyVideo({id:f.id,sha256:f.sha256,metadata:{...metadata,label:'stale'},previous:null},registry,f.options),e=>e.statusCode===409);
  await assert.rejects(classifyVideo({id:f.id,sha256:f.sha256,metadata:{...metadata,playback:'loop'},previous:metadata},saved,f.options),e=>e.statusCode===400);
  await assert.rejects(classifyVideo({id:f.id,sha256:'0'.repeat(64),metadata,previous:metadata},saved,f.options),e=>e.statusCode===409);
  await classifyVideo({id:f.id,sha256:f.sha256,metadata:{...metadata,label:'updated'},previous:metadata},saved,f.options);
  assert.equal((await readClassifications(f.options))[0].metadata.label,'updated');
});
test('corrupt overlay remains intact and cannot be overwritten by a new classification',async t=>{
  const f=await fixture(t);await mkdir(f.options.uploadDir);
  const path=join(f.options.uploadDir,'classifications.json');await writeFile(path,'broken');
  const registry=await loadVideoRegistry(f.options);
  assert.equal(registry.videos[0].classification,undefined);
  await assert.rejects(classifyVideo({id:f.id,sha256:f.sha256,metadata},registry,f.options),e=>e.statusCode===503);
  assert.equal(await readFile(path,'utf8'),'broken');assert.deepEqual(await readFile(f.file),f.bytes);
});
