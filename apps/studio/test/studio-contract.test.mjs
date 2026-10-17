import { PROBE_MODELS, validateProbePolicy } from '../../../packages/presentation/contracts/probe-policy.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import contract from '../../../packages/presentation/contracts/policies/studio-contract.json' with { type: 'json' };
import schema from '../../../packages/presentation/contracts/schemas/video.schema.json' with { type: 'json' };
import seed from '../../../packages/presentation/contracts/policies/project.seed.json' with { type: 'json' };
import { validateVideoMetadata, videoFitsLine, videoFitsEvent } from '../../../packages/presentation/contracts/video-intake.mjs';
import {classifyVideo} from '../lib/video-classifications.mjs';
import {readClassifications} from '../lib/video-local-readers.mjs';
import { loadVideoRegistry, getVideoResponse } from '../lib/video-registry.mjs';
import { MEDIA_FAMILY_DEFINITIONS, videoIdFromSha256 } from '../../../packages/studio-registry/server/video-manifest.mjs';
import {ROULETTE_MEDIA_EVENTS} from '../../../packages/presentation/contracts/roulette-media.mjs';
import {blackjackMediaSlots,dealerMediaSlots,mediaClassification} from '../lib/dealer-media-library.mjs';
import {validateProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {isActiveDealerId} from '../../../packages/presentation/contracts/dealer-identity.mjs';

const metadata = { label:'QA left', dealerId:'astrid', eventId:'deal.player.left', kind:'action', role:'standard', situation:'box0', notes:'', playback:'once' };
test('canonical manifest, seed, schema and runtime classifications agree for every dealer/group/situation', async () => {
  const contractUrl = new URL('../../../packages/presentation/contracts/policies/studio-contract.json', import.meta.url);
  const projectSchemaUrl = new URL('../schemas/studio.schema.json', contractUrl);
  const projectSchema = JSON.parse(await readFile(projectSchemaUrl, 'utf8'));
  const probeSchema = JSON.parse(await readFile(new URL(contract.probe.schema, contractUrl), 'utf8'));
  assert.deepEqual(probeSchema, JSON.parse(await readFile(new URL(projectSchema.properties.probePolicy.$ref, projectSchemaUrl), 'utf8')));
  assert.deepEqual(probeSchema.properties.model.enum, PROBE_MODELS.map(model => model.id));
  const probeSeed = JSON.parse(await readFile(new URL(contract.probe.policy, contractUrl), 'utf8'));
  assert.deepEqual(validateProbePolicy(probeSeed), probeSeed);
  assert.deepEqual(contract.dealers.filter(isActiveDealerId), seed.dealers.map(d=>d.id));
  assert.deepEqual(contract.events.map(e=>({id:e.id,sourceType:e.sourceType})),seed.events.map(e=>({id:e.id,sourceType:e.sourceType})));
  assert.deepEqual(schema.properties.eventId.enum,[...contract.events.map(e=>e.id),...ROULETTE_MEDIA_EVENTS.map(e=>e.id)]);
  assert.equal(schema.properties.dealerId.pattern,'^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$');
  assert.doesNotThrow(()=>validateVideoMetadata({...metadata,dealerId:'nora'}));
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
test('roulette intake has its own exact metadata and never widens canonical runtime lines or events',()=>{
  const before=structuredClone(seed),runtime=blackjackMediaSlots(seed),intake=dealerMediaSlots(seed);
  assert.deepEqual(intake.filter(slot=>!slot.eventId.startsWith('roulette.')),runtime);
  const slots=intake.filter(slot=>slot.eventId.startsWith('roulette.'));
  assert.deepEqual(slots.map(slot=>slot.id),['roulette.reference/VILA','roulette.idle/breathing','roulette.idle/glasses-clean','roulette.wheel-start/wheel-start']);
  for(const slot of slots){
    const value=mediaClassification(seed,{dealerId:'astrid',slotId:slot.id,label:'Roulette intake',contentType:slot.eventId==='roulette.reference'?'image/png':'video/webm'});
    assert.doesNotThrow(()=>validateVideoMetadata(value));
    for(const key of ['game','action','startPose','endPose']){const missing={...value};delete missing[key];assert.throws(()=>validateVideoMetadata(missing));}
    for(const event of seed.events){assert.equal(videoFitsLine({classification:value},'astrid',event.id),false);assert.equal(videoFitsEvent({classification:value},event),false);}
    assert.equal(videoFitsLine({classification:value},'astrid',slot.eventId),false);
    assert.equal(seed.events.some(event=>event.id===slot.eventId),false);
  }
  assert.deepEqual(seed,before);
  assert.throws(()=>validateProject({...structuredClone(seed),events:[...seed.events,{...seed.events[0],id:'roulette.wheel-start'}]}));
});
test('unknown, unclassified, wrong kind/dealer/group, imprecise and proposed loop metadata fail closed',()=>{
  assert.equal(videoFitsLine({},'astrid','idle.ready'),false);
  for(const patch of [{kind:'gesture'},{dealerId:'../other'},{eventId:'new.event'},{situation:''},{situation:'box5'},{playback:'loop'},{random:true}]) assert.throws(()=>validateVideoMetadata({...metadata,...patch}));
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
  const targetPath='deal/deal_pos1/deal_pos1.mp4', bytes=Buffer.from('test-only-original-no-mutation');
  const items=[];
  for (const definition of MEDIA_FAMILY_DEFINITIONS) {
    for (const relativePath of definition.standardPaths) {
      const content=relativePath===targetPath?bytes:Buffer.from(`fixture:${relativePath}`);
      const sha256=createHash('sha256').update(content).digest('hex');
      items.push({id:videoIdFromSha256(sha256),familyId:definition.id,role:'standard',relativePath,extension:'mp4',size:content.length,sha256});
      const mediaPath=join(archiveDir,...relativePath.split('/'));await mkdir(dirname(mediaPath),{recursive:true});await writeFile(mediaPath,content);
    }
    await mkdir(join(archiveDir,...definition.variantDirectory.split('/')),{recursive:true});
  }
  const families=MEDIA_FAMILY_DEFINITIONS.map(definition=>({id:definition.id,dealerId:definition.dealerId,eventId:definition.eventId,situation:definition.situation,playbackType:definition.playbackType,standardIds:definition.standardPaths.map(path=>items.find(item=>item.relativePath===path).id),variantIds:[]}));
  const target=items.find(item=>item.relativePath===targetPath),id=target.id,sha256=target.sha256,file=join(archiveDir,...targetPath.split('/'));
  const snapshotPath=join(root,'snapshot.json');await writeFile(snapshotPath,JSON.stringify({schemaVersion:2,source:'emil/dealklipp-v1',families,items}));
  return {id,sha256,file,bytes,options:{archiveDir,snapshotPath,uploadDir:join(root,'uploads')}};
}
test('manifest-owned media keeps its physical family and cannot be reclassified by an overlay',async t=>{
  const f=await fixture(t),registry=await loadVideoRegistry(f.options);
  const video=registry.videos.find(item=>item.id===f.id);
  assert.equal(video.eventId,metadata.eventId);assert.equal(video.situation,metadata.situation);assert.equal(video.familyId,'astrid/deal.player.left/box0');
  await assert.rejects(classifyVideo({id:f.id,sha256:f.sha256,metadata,previous:null},registry,f.options),e=>e.statusCode===409);
  const saved=await loadVideoRegistry(f.options),savedVideo=saved.videos.find(item=>item.id===f.id);
  assert.equal(savedVideo.classification,undefined);assert.equal(savedVideo.source,'emil');assert.equal(savedVideo.available,true);
  assert.deepEqual(await readFile(f.file),f.bytes);
  const response=await getVideoResponse(f.id,new Request(`http://localhost:4188/api/videos/${f.id}`),f.options);
  assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),f.bytes);
  assert.deepEqual(await readClassifications(f.options),[]);
});
test('corrupt overlay remains intact and cannot be overwritten by a new classification',async t=>{
  const f=await fixture(t);await mkdir(f.options.uploadDir);
  const path=join(f.options.uploadDir,'classifications.json');await writeFile(path,'broken');
  const registry=await loadVideoRegistry(f.options);
  assert.equal(registry.videos.find(item=>item.id===f.id).classification,undefined);
  await assert.rejects(readClassifications(f.options),e=>e.statusCode===503);
  assert.equal(await readFile(path,'utf8'),'broken');assert.deepEqual(await readFile(f.file),f.bytes);
});
