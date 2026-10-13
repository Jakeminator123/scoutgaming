import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir,mkdtemp,rm,writeFile } from 'node:fs/promises';
import { basename,dirname,join,resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createStudioProjectBindings } from '../lib/studio-project-bindings.mjs';
import { createSeedProject } from '../lib/studio-model.mjs';
import { legacyClipControls } from '../lib/legacy-clip-inventory.mjs';

const actionId = '00000000-0000-4000-8000-000000000010';
function fixture() {
  const project = createSeedProject(), idle = project.idlePolicy;
  const videos = [...idle.base.map(row => ({id:row.videoId,role:'standard'})),...idle.variants.map(row => ({id:row.videoId,role:'variant'}))]
    .map(row => ({...row,dealer:'astrid',eventId:'idle.ready',familyId:idle.familyId,available:true,integrity:'unchecked',sha256:'a'.repeat(64),bytes:32}));
  videos.push({id:actionId,role:'variant',dealer:'astrid',eventId:'deal.player.left',familyId:'astrid/deal.player.left/box0',available:true,integrity:'unchecked',sha256:'b'.repeat(64),bytes:32});
  const registry = {videos,families:[{id:idle.familyId,dealerId:'astrid',eventId:'idle.ready',playbackType:'idle-pool',standardIds:idle.base.map(row => row.videoId),variantIds:idle.variants.map(row => row.videoId)},
    {id:'astrid/deal.player.left/box0',dealerId:'astrid',eventId:'deal.player.left',situation:'box0',playbackType:'once',standardIds:[],variantIds:[actionId]}],summary:{archiveSource:'emil-default'}};
  project.mediaPolicy = [{familyId:'astrid/deal.player.left/box0',variants:[{videoId:actionId,selection:{rules:true,model:false,random:false},priority:10,triggerIds:[]}]}];
  return {project,registry,verify:createStudioProjectBindings({videoRegistry:async () => registry})};
}
test('exact available media/idle family references are validated without mutating caller drafts',async () => {
  const {project,registry,verify} = fixture(), before = structuredClone(project), originalRegistry = structuredClone(registry);
  await verify(project); assert.deepEqual(project,before); assert.deepEqual(registry,originalRegistry);
});

function rouletteFixture() {
  const f=fixture(),ids=['20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002'];
  const rows=['breathing','glasses-clean'].map((action,i)=>({id:ids[i],dealer:'astrid',available:true,integrity:'verified',sha256:'d'.repeat(64),bytes:4096,contentType:'video/webm',
    classification:{dealerId:'astrid',eventId:'roulette.idle',game:'roulette',action,situation:action,startPose:'VILA',endPose:'VILA',
      kind:'idle',role:'standard',label:action,notes:'',playback:'once',compositing:{mode:'alpha'},framing:{scale:1,x:0,y:0}}}));
  f.registry.videos.push(...rows);f.project.dealers.find(row=>row.id==='astrid').rouletteIdle={videoId:ids[0],variantVideoIds:[ids[1]],foregroundPolygons:[[[0,0],[1,0],[1,1]]]};
  return {...f,rows};
}
test('server project save verifies the exact roulette base and variants, source availability and common framing',async()=>{
  const good=rouletteFixture(),before=structuredClone(good.project);await good.verify(good.project);assert.deepEqual(good.project,before);
  for(const change of [
    f=>f.rows[0].available=false,f=>f.rows[1].dealer='vera',f=>f.rows[1].classification.dealerId='vera',
    f=>f.rows[1].classification.eventId='idle.ready',f=>f.rows[1].classification.archived=true,
    f=>f.rows[1].contentType='video/mp4',f=>f.rows[1].classification.compositing={mode:'opaque'},
    f=>f.rows[1].classification.framing.y=.4,f=>f.rows[0].sha256='forged',f=>f.registry.videos.pop(),
  ]) {
    const f=rouletteFixture();change(f);await assert.rejects(f.verify(f.project),error=>error.code==='studio_media_binding_invalid'&&error.statusCode===422);
  }
});

test('wheel-start save verifies exact media, poses and independent profile before persistence',async()=>{
  const build=()=>{
    const f=rouletteFixture(),row=structuredClone(f.rows[0]);row.id='30000000-0000-4000-8000-000000000001';
    Object.assign(row.classification,{eventId:'roulette.wheel-start',kind:'action',situation:'wheel-start',action:'wheel-start',framing:{scale:1.1,x:0,y:.1}});
    f.registry.videos.push(row);const dealer=f.project.dealers.find(value=>value.id==='astrid');
    dealer.rouletteStart={videoId:row.id,tableDesignId:'roulette-anna-v1',durationMs:10042,wheelImpulseMs:2100,ballReleaseMs:4000};return {...f,row,dealer};
  };
  const good=build();await good.verify(good.project);
  for(const change of [f=>f.row.available=false,f=>f.row.classification.dealerId='nora',f=>f.row.classification.startPose='unverified',
    f=>f.row.classification.game='blackjack',f=>f.dealer.rouletteStart.videoId=f.rows[0].id,f=>f.dealer.rouletteStart.ballReleaseMs=10042,
    f=>delete f.dealer.rouletteIdle]){
    const f=build();change(f);await assert.rejects(f.verify(f.project));
  }
});
test('wrong family/event/dealer, unavailable bytes and forged hash reject persisted media variants',async () => {
  for (const change of [video => {video.familyId='astrid/deal.player.left/box1';},video => {video.eventId='deal.player.right';},
    video => {video.dealer='vera';},video => {video.available=false;},video => {video.sha256='wrong';},video => {video.bytes=0;}]) {
    const {project,registry,verify} = fixture(); change(registry.videos.find(row => row.id === actionId));
    await assert.rejects(verify(project),error => error.statusCode === 422);
  }
  const {project,registry,verify} = fixture(); registry.families[1].variantIds=[];
  await assert.rejects(verify(project),error => error.code === 'studio_media_binding_invalid');
});
test('idle base/variants cannot swap roles, use an action clip or borrow another dealer',async () => {
  for (const change of [(project,registry) => {registry.families[0].standardIds=[];},(project,registry) => {registry.videos[0].role='variant';},
    (project,registry) => {registry.videos[0].dealer='mei';},project => {project.idlePolicy.base[0].videoId=actionId;}]) {
    const {project,registry,verify} = fixture(); change(project,registry);
    await assert.rejects(verify(project),error => error.statusCode === 422);
  }
});
test('legacy bindings require explicit review receipt and exact same-dealer/part registered source',async () => {
  const {project,registry} = fixture(); project.legacyClipPolicy=[{dealerId:'vera',part:'idle',clipId:'vera:idle-1/idle/idle'}];
  await assert.rejects(createStudioProjectBindings({videoRegistry:async () => registry})(project),error => error.statusCode === 503);
  const clip = {id:project.legacyClipPolicy[0].clipId,dealerId:'vera',exactParts:['idle'],available:true,kind:'engine',engineKey:'idle-1/idle/idle'};
  await assert.rejects(createStudioProjectBindings({videoRegistry:async () => registry,legacyControls:async () => ({clips:[clip]})})(project),error => error.code === 'studio_legacy_review_safety_unavailable');
  await createStudioProjectBindings({videoRegistry:async () => registry,legacyControls:async () => ({clips:[clip],reviewSafetyVerified:true})})(project);
  for (const changed of [{...clip,dealerId:'mei'},{...clip,exactParts:['deal']},{...clip,available:false}]) {
    await assert.rejects(createStudioProjectBindings({videoRegistry:async () => registry,legacyControls:async () => ({clips:[changed],reviewSafetyVerified:true})})(project),error => error.code === 'studio_legacy_binding_invalid');
  }
});
test('native legacy inventory reads injected Neon review safety and Blob availability, never bo.json or local media availability',async t => {
  const root = await mkdtemp(join(tmpdir(),'croupier-native-legacy-'));
  t.after(() => {assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.match(basename(root),/^croupier-native-legacy-/);return rm(root,{recursive:true,force:true});});
  const write = async (file,value) => {const path=join(root,file);await mkdir(dirname(path),{recursive:true});await writeFile(path,typeof value==='string'?value:JSON.stringify(value));};
  for (const base of ['dealer','dealers/astrid','dealers/amira','dealers/mei']) {
    await write(`web/public/${base}/streams/index.json`,{clips:{'idle-1/idle/idle':{file:'idle.h264'}}});
    await write(`web/public/${base}/audio/en/bank.json`,{});
  }
  await write('private/bo.json','invalid old bo disk must not be read');
  const project=createSeedProject();project.legacyClipPolicy=[{dealerId:'vera',part:'idle',clipId:'vera:idle-1/idle/idle'}];
  let sourceReads=0;
  const options={repository:root,dataDirectory:join(root,'private'),mediaAvailable:async file => file?.endsWith('/streams/idle.h264') === true,
    administration:async () => {sourceReads++;return {legacyClipReview:{sourceSha256:'a'.repeat(64),neverAgain:{'vera:idle-1/idle/idle':{reason:'review rejected'}}}};}};
  const controls=await legacyClipControls(project,options);assert.equal(sourceReads,1);assert.equal(controls.reviewSafetyVerified,true);
  assert.equal(controls.clips.find(clip => clip.id==='vera:idle-1/idle/idle').available,false);assert.equal(controls.runtime.conflicts.length,1);
  for (const dealer of ['astrid','amira','mei']) assert.equal(controls.clips.find(clip => clip.id===`${dealer}:idle-1/idle/idle`).available,true);
  await assert.rejects(legacyClipControls(project,{...options,administration:{}}),error => error.code==='studio_legacy_review_safety_unavailable');
});
