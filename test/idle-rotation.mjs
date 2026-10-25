import test from 'node:test';
import assert from 'node:assert/strict';
import source from '../apps/studio/lib/paow-idle-source-f664c54d.json' with {type:'json'};
import {preparePaowIdleRotation} from '../apps/studio/lib/paow-idle-rotation.mjs';
import {createLiveIdleController} from '../packages/presentation/runtime/live-idle.mjs';
import {validateIdlePolicy, createIdlePreviewPlan, IdlePolicyError} from '../packages/presentation/runtime/idle-policy.mjs';
import {chooseRotationClip} from '../packages/presentation/runtime/idle-rotation.mjs';
import {addDealer,createSeedProject,defaultPresentationLane} from '../packages/presentation/contracts/studio-model.mjs';
import {captureFrozenPresentation} from '../packages/presentation/server/frozen-presentation-capture.mjs';
import {encodePresentationPackage,decodePresentationPackage} from '../packages/presentation/server/presentation-package.mjs';
import {assertFrozenMediaPreconditions} from '../packages/presentation/server/frozen-dealer-idle.mjs';

function fixture() {
  const familyId='paow/idle.ready/ready';
  const videos=source.clips.map((take,index)=>({id:`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,
    dealer:'paow',familyId,available:true,verdict:'unrated',sha256:take.sha256,bytes:take.bytes,
    role:index?'variant':'standard',classification:{dealerId:'paow',kind:'idle',eventId:'idle.ready',playback:'once'}}));
  const inventory={videos,families:[{id:familyId,dealerId:'paow',playbackType:'idle-pool',standardIds:[videos[0].id],variantIds:videos.slice(1).map(row=>row.id)}]};
  const base={schemaVersion:1,familyId,base:[{videoId:videos[0].id,weight:100,durationMs:1625}],variants:[]};
  const policy=preparePaowIdleRotation(base,inventory).policy;
  const controller=createLiveIdleController({policy,inventory,dealerId:'paow',seed:42,now:()=>0,initialScene:{active:true}});
  const row=clip=>policy.rotation.clips.find(item=>item.videoId===clip.videoId);
  const finish=()=>{const clip=controller.snapshot().clip;assert.ok(clip);controller.presented(clip.playId);return controller.completed(clip.playId);};
  return {base,policy,inventory,controller,row,finish};
}

test('all 24 exact originals reuse registered identities; missing, rejected, deleted, foreign or ambiguous bytes block binding',()=>{
  const f=fixture();assert.equal(f.policy.rotation.clips.length,24);assert.equal(f.policy.variants.length,23);
  assert.deepEqual(new Set(f.policy.rotation.clips.map(row=>row.videoId)),new Set(f.inventory.videos.map(row=>row.id)));
  for(const patch of [v=>v.bytes++,v=>v.sha256='f'.repeat(64),v=>v.available=false,v=>v.verdict='no',v=>v.dealer='astrid',
    v=>v.classification.dealerId='astrid',v=>v.classification.playback='loop',v=>v.deletion={state:'pending'}]) {
    const inventory=structuredClone(f.inventory);patch(inventory.videos[17]);assert.equal(preparePaowIdleRotation(f.base,inventory).policy,null);
  }
  const duplicate=structuredClone(f.inventory);duplicate.videos.push({...duplicate.videos[17],id:'duplicate'});
  assert.equal(preparePaowIdleRotation(f.base,duplicate).policy,null);
  assert.equal(preparePaowIdleRotation({...f.base,familyId:'astrid/idle.ready/ready'},f.inventory),null);
});

test('long sessions cover all 24 clips across both phases, join exact poses and space head motion',()=>{
  const f=fixture(),seen=new Set();let pose='rest',sinceHead=Infinity;
  for(let i=0;i<4000;i++) {
    const phase=i<2000?'bets':'decide';f.controller.updateScene({phase});
    const clip=f.controller.snapshot().clip,row=f.row(clip);seen.add(row.videoId);
    assert.equal(row.from,pose);if(row.head)assert.ok(sinceHead>=4);
    if(i>2002) {assert.equal(row.to,'rest');assert.ok(row.calm);assert.notEqual(row.phase,'bets');}
    pose=row.to;sinceHead=row.head?0:sinceHead+1;f.finish();
  }
  assert.equal(seen.size,24);
});

test('speech and changed game phase finish the current clasped take, play its exit, then prove standard idle',()=>{
  for(const patch of [{speechReady:true},{phase:'decide'}]) {
    const f=fixture(),c=f.controller;
    for(let i=0;f.row(c.snapshot().clip).to!=='clasped'&&i<200;i++)f.finish();
    const entry=c.snapshot().clip;assert.equal(f.row(entry).to,'clasped');c.presented(entry.playId);
    assert.equal(c.updateScene(patch).clip.playId,entry.playId);assert.equal(c.snapshot().idleReady,false);
    const exit=c.completed(entry.playId).clip;assert.equal(f.row(exit).from,'clasped');assert.equal(f.row(exit).to,'rest');
    c.presented(exit.playId);assert.equal(c.snapshot().idleReady,false);
    const next=c.completed(exit.playId).clip;assert.equal(f.row(next).from,'rest');
    if(patch.speechReady){assert.equal(next.standardBase,true);assert.equal(c.snapshot().idleReady,false);c.presented(next.playId);assert.equal(c.snapshot().idleReady,true);}
  }
});

test('interruptions resume the same presented frame; stale completion cannot advance the pose',()=>{
  const f=fixture(),c=f.controller;
  for(let i=0;f.row(c.snapshot().clip).to!=='clasped'&&i<200;i++)f.finish();
  const clip=c.snapshot().clip;c.presented(clip.playId);c.progress(clip.playId,.625);
  assert.equal(c.updateScene({actionBusy:true}).clip,null);
  c.completed(clip.playId);
  const resumed=c.updateScene({actionBusy:false}).clip;
  assert.equal(resumed.videoId,clip.videoId);assert.equal(resumed.startOffset,.625);assert.notEqual(resumed.playId,clip.playId);
  c.completed(clip.playId);assert.equal(c.snapshot().clip.playId,resumed.playId);
  c.presented(resumed.playId);assert.equal(f.row(c.completed(resumed.playId).clip).from,'clasped');
});

test('missing exits forbid entry; a partial failure holds its pose until a verified return',()=>{
  const f=fixture();const withoutExits=f.policy.rotation.clips.filter(row=>row.from!=='clasped'||row.to!=='rest');
  for(let i=0;i<100;i++)assert.equal(chooseRotationClip(withoutExits,{primaryId:f.base.base[0].videoId,random:()=>i/100}).to,'rest');
  const c=f.controller;f.finish();const clip=c.snapshot().clip;c.presented(clip.playId);c.failed(clip.playId);
  assert.equal(c.snapshot().state,'unavailable');assert.equal(c.updateScene({actionBusy:true}).clip,null);assert.equal(c.updateScene({actionBusy:false}).clip,null);
  c.resetPose();assert.ok(c.snapshot().clip.standardBase);assert.equal(c.snapshot().idleReady,false);
  const missing=createLiveIdleController({policy:f.policy,inventory:{videos:[],families:[]},dealerId:'paow',initialScene:{active:true}});
  assert.equal(missing.snapshot().state,'unavailable');
});

test('validation rejects inconsistent graphs and the preview uses intact matching clip boundaries',()=>{
  const f=fixture();
  for(const patch of [p=>p.rotation.clips.pop(),p=>p.rotation.clips[0].to='clasped',p=>p.variants[0].use='manual',
    p=>p.rotation.clips.find(r=>r.from==='clasped').phase='decide',p=>p.rotation.clips.push(p.rotation.clips[0])]) {
    const p=structuredClone(f.policy);patch(p);assert.throws(()=>validateIdlePolicy(p),IdlePolicyError);
  }
  for(const phase of ['bets','decide'])for(let seed=0;seed<50;seed++) {
    const plan=createIdlePreviewPlan(f.policy,{phase,seed});let pose='rest';
    for(const clip of plan){const row=f.row(clip);assert.equal(row.from,pose);pose=row.to;assert.equal(clip.endMs-clip.startMs,1625);}
    assert.equal(pose,'rest');
  }
});

test('publishing freezes all 24 original identities and pose policy, and rejects changed media revisions',()=>{
  const f=fixture(),project=addDealer(createSeedProject(),'paow','PAOW');
  const line=project.lines.find(row=>row.dealerId==='paow'&&row.eventId==='idle.ready');
  line.variants.find(row=>row.id===line.baselineVariantId).videoGenerationId=f.policy.base[0].videoId;
  project.dealerIdlePolicies=[{dealerId:'paow',policy:f.policy}];project.lanes=[defaultPresentationLane('paow')];
  const lane=project.lanes[0];lane.dealers=['paow'];lane.layers.dealer={enabled:true,default:'paow',allowed:['paow']};
  const mediaRows=f.inventory.videos.map((video,index)=>{
    Object.assign(video.classification,{role:index?'alternative':'standard',situation:'',label:source.clips[index].id,notes:''});
    return {id:video.id,sha256:video.sha256,size:video.bytes,contentType:'video/mp4',revision:'verified-'+index,
      pathname:`croupier/media/dealers/paow/review/uploads/${video.id}/${video.sha256}.mp4`,classification:video.classification};
  });
  const capture=captureFrozenPresentation({snapshot:{projectDocument:{kind:'project',revision:project.revision,value:project},
    administrationDocument:{kind:'administration',revision:'admin-fixture',value:{rooms:[]}},mediaRows},inventory:f.inventory,selectedLaneIds:[lane.id]});
  const frozen=decodePresentationPackage(encodePresentationPackage(capture.presentation));
  assert.deepEqual(frozen.playback.dealerIdlePolicies,[{dealerId:'paow',policy:f.policy}]);
  assert.equal(capture.mediaPreconditions.length,24);
  mediaRows[20].revision='replaced';assert.throws(()=>assertFrozenMediaPreconditions(capture.mediaPreconditions,mediaRows));
});
