import test from 'node:test';
import assert from 'node:assert/strict';
import {IDLE_ROTATION_DEALERS,idleRotationSource,prepareIdleRotation,savedIdleRotationSelection,validateIdleRotationSource} from '../apps/studio/lib/idle-rotation-sources.mjs';
import {createLiveIdleController} from '../packages/presentation/runtime/live-idle.mjs';
import {validateIdlePolicy, createIdlePreviewPlan, IdlePolicyError} from '../packages/presentation/runtime/idle-policy.mjs';
import {chooseRotationClip} from '../packages/presentation/runtime/idle-rotation.mjs';
import {addDealer,createSeedProject,defaultPresentationLane} from '../packages/presentation/contracts/studio-model.mjs';
import {captureFrozenPresentation} from '../packages/presentation/server/frozen-presentation-capture.mjs';
import {encodePresentationPackage,decodePresentationPackage} from '../packages/presentation/server/presentation-package.mjs';
import {assertFrozenMediaPreconditions} from '../packages/presentation/server/frozen-dealer-idle.mjs';

const KEVIN_REF='de31659c13ab495e80779c1acbf4efd446b4e565';
const prefix={paow:'00000000',dragan:'11111111'};
// Registered originals with the source's exact bytes, as the native /videos inventory reports them.
function registered(dealerId) {
  const source=idleRotationSource(dealerId),familyId=`${dealerId}/idle.ready/ready`;
  const videos=source.clips.map((take,index)=>({id:`${prefix[dealerId]}-0000-4000-8000-${String(index+1).padStart(12,'0')}`,
    dealer:dealerId,familyId,available:true,verdict:'unrated',sha256:take.sha256,bytes:take.bytes,
    role:index?'variant':'standard',classification:{dealerId,kind:'idle',eventId:'idle.ready',playback:'once'}}));
  const inventory={videos,families:[{id:familyId,dealerId,playbackType:'idle-pool',standardIds:[videos[0].id],variantIds:videos.slice(1).map(row=>row.id)}]};
  return {source,familyId,inventory,base:{schemaVersion:1,familyId,base:[{videoId:videos[0].id,weight:100,durationMs:1625}],variants:[]}};
}
function fixture(dealerId='paow',selection=null) {
  const f=registered(dealerId),prepared=prepareIdleRotation(f.base,f.inventory,{selection}),policy=prepared.policy;
  assert.ok(policy,prepared.error);
  const controller=createLiveIdleController({policy,inventory:f.inventory,dealerId,seed:42,now:()=>0,initialScene:{active:true}});
  const row=clip=>policy.rotation.clips.find(item=>item.videoId===clip.videoId);
  const finish=()=>{const clip=controller.snapshot().clip;assert.ok(clip);controller.presented(clip.playId);return controller.completed(clip.playId);};
  return {...f,prepared,policy,controller,row,finish};
}

test('each dealer source is frozen to Kevin\'s exact ref: PAOW without the three rejected takes, Dragan with his H3 and clasped-hand takes',()=>{
  assert.deepEqual(IDLE_ROTATION_DEALERS,['paow','dragan']);
  const paow=idleRotationSource('paow'),dragan=idleRotationSource('dragan');
  for(const source of [paow,dragan]) {
    assert.equal(source.ref,KEVIN_REF);assert.equal(source.baseline,'andas');assert.equal(source.clips[0].id,'andas');
    assert.ok(source.clips.every(take=>take.frames===39&&take.fps===24&&take.durationMs===1625&&take.path.startsWith('kevin/croupier-scoutgg/public/media/dealers/')));
    assert.equal(validateIdleRotationSource(structuredClone(source)).dealerId,source.dealerId);
  }
  assert.equal(paow.clips.length,21);assert.equal(dragan.clips.length,16);assert.equal(dragan.sourceDealerId,'dragge');
  for(const rejected of ['andasb','rakrygg6101','plattaxlar5101'])assert.equal(paow.clips.some(take=>take.id===rejected),false,rejected);
  const evolution=dragan.clips.filter(take=>take.phase!=='any');
  assert.deepEqual(evolution.map(take=>take.id),['knappin5101','knappin5102','knappandas5102','knappaxlar5102','knapput5101','knapput5102','plattaxlar5101','lutfram5101']);
  assert.deepEqual(dragan.clips.filter(take=>take.head).map(take=>take.id),['blickhoger']);
  assert.equal(new Set([...paow.clips,...dragan.clips].map(take=>take.sha256)).size,37,'no original is shared between dealers');
  paow.clips.pop();assert.equal(idleRotationSource('paow').clips.length,21,'callers get a copy');
  assert.equal(idleRotationSource('astrid'),null);
  for(const patch of [s=>s.clips[3].sha256=s.clips[2].sha256,s=>s.clips[3].extra=1,s=>s.clips[3].durationMs=1600,s=>s.baseline='andasb',
    s=>s.ref='de31659c',s=>s.dealerId='mei',s=>s.clips[3].path=s.clips[3].path.replace('.mp4','x.mp4'),
    s=>s.clips=s.clips.filter(take=>take.from!=='clasped'||take.to!=='rest'),s=>s.clips[0].head=true]) {
    const source=idleRotationSource('dragan');patch(source);assert.throws(()=>validateIdleRotationSource(source),/Ogiltig vilokälla/);
  }
});

test('binding reuses registered identities; wrong bytes, wrong owner, rejected, deleted or ambiguous originals are named and block it',()=>{
  for(const dealerId of IDLE_ROTATION_DEALERS) {
    const f=fixture(dealerId),total=f.source.clips.length;
    assert.equal(f.policy.rotation.clips.length,total);assert.equal(f.policy.variants.length,total-1);
    assert.equal(f.prepared.matched,total);assert.equal(f.prepared.selected,total);assert.equal(f.prepared.error,null);
    assert.deepEqual(f.policy.rotation.clips.map(row=>row.videoId),f.inventory.videos.map(row=>row.id));
    assert.deepEqual(f.prepared.clips.map(row=>row.status),Array(total).fill('registered'));
    for(const patch of [v=>v.bytes++,v=>v.sha256='f'.repeat(64),v=>v.available=false,v=>v.verdict='no',v=>v.dealer='astrid',
      v=>v.classification.dealerId='astrid',v=>v.classification.playback='loop',v=>v.classification.eventId='speak.other',v=>v.deletion={state:'pending'}]) {
      const inventory=structuredClone(f.inventory);patch(inventory.videos[5]);
      const result=prepareIdleRotation(f.base,inventory);
      assert.equal(result.policy,null);assert.equal(result.clips[5].status,'missing');assert.equal(result.matched,total-1);
      assert.match(result.error,new RegExp(`Originalet ${f.source.clips[5].id} saknas`));
    }
    const duplicate=structuredClone(f.inventory);duplicate.videos.push({...duplicate.videos[5],id:'22222222-0000-4000-8000-000000000001'});
    const ambiguous=prepareIdleRotation(f.base,duplicate);
    assert.equal(ambiguous.policy,null);assert.equal(ambiguous.clips[5].status,'ambiguous');assert.match(ambiguous.error,/Flera original matchar/);
    const otherBase=structuredClone(f.base);otherBase.base[0].videoId=f.inventory.videos[3].id;
    assert.match(prepareIdleRotation(otherBase,f.inventory).error,/Välj andas som basklipp/);
  }
  // Each dealer's own bytes: PAOW's originals registered under Dragan never bind Dragan's sequence, and the reverse.
  const paow=registered('paow'),dragan=registered('dragan');
  const crossed=videos=>videos.map(video=>({...structuredClone(video),dealer:'dragan',familyId:dragan.familyId,classification:{...video.classification,dealerId:'dragan'}}));
  const foreign=prepareIdleRotation(dragan.base,{videos:[dragan.inventory.videos[0],...crossed(paow.inventory.videos)]});
  assert.equal(foreign.matched,1);assert.equal(foreign.policy,null);assert.match(foreign.error,/15 valda original saknas/);
  assert.equal(prepareIdleRotation(paow.base,{videos:crossed(paow.inventory.videos)}).clips[0].status,'missing');
  assert.equal(prepareIdleRotation({...paow.base,familyId:'astrid/idle.ready/ready'},paow.inventory),null);
});

test('Admin binds a subset: the baseline always stays and clasped hands need both an entry and an exit to rest',()=>{
  const f=registered('paow'),subset=['andas','knappin5101','knapput5101','plattandas5101'];
  const chosen=prepareIdleRotation(f.base,f.inventory,{selection:[...subset].reverse()});
  assert.equal(chosen.error,null);assert.equal(chosen.selected,4);
  assert.deepEqual(chosen.policy.rotation.clips.map(row=>f.inventory.videos.find(video=>video.id===row.videoId).sha256),
    subset.map(id=>f.source.clips.find(take=>take.id===id).sha256),'source order, exact bytes');
  assert.equal(chosen.policy.variants.length,3);assert.deepEqual(chosen.policy.variants.map(row=>row.description),subset.slice(1));
  assert.deepEqual(savedIdleRotationSelection(chosen,chosen.policy),{ids:subset,outside:0});
  const calm=prepareIdleRotation(f.base,f.inventory,{selection:['andas','djupandetag','fingrar']});
  assert.equal(calm.policy.rotation.clips.length,3);
  for(const [dealerId,selection] of [['paow',['andas','knappin5101','knappandas5101']],['paow',['andas','knappandas5101','knapput5101']],
    ['dragan',idleRotationSource('dragan').clips.filter(take=>!take.id.startsWith('knapput')).map(take=>take.id)]]) {
    const g=registered(dealerId),result=prepareIdleRotation(g.base,g.inventory,{selection});
    assert.equal(result.policy,null);assert.match(result.error,/Knäppta händer kräver minst ett klipp in i posen och ett tillbaka till vila/);
  }
  assert.match(prepareIdleRotation(f.base,f.inventory,{selection:['djupandetag']}).error,/Basklippet andas ingår alltid/);
  for(const selection of [['andas','andasb'],'andas',[1],5,{}])assert.match(prepareIdleRotation(f.base,f.inventory,{selection}).error,/inte finns i dealerns vilokälla/);
  // Missing media blocks only while it is selected; deselecting it is an explicit choice.
  const gap=structuredClone(f.inventory);gap.videos=gap.videos.filter(video=>video.sha256!==f.source.clips.find(take=>take.id==='knappaxlar5101').sha256);
  assert.match(prepareIdleRotation(f.base,gap).error,/Originalet knappaxlar5101 saknas/);
  const without=prepareIdleRotation(f.base,gap,{selection:f.source.clips.map(take=>take.id).filter(id=>id!=='knappaxlar5101')});
  assert.equal(without.error,null);assert.equal(without.policy.rotation.clips.length,20);
  // A saved sequence from an older selection reports the clips outside this source.
  const older=structuredClone(chosen.policy);older.variants.push({videoId:'33333333-0000-4000-8000-000000000001',durationMs:1625,use:'rotation',automatic:null,description:'andasb'});
  older.rotation.clips.push({videoId:'33333333-0000-4000-8000-000000000001',phase:'any',from:'rest',to:'rest',weight:20,head:false,calm:true});
  assert.deepEqual(savedIdleRotationSelection(chosen,validateIdlePolicy(older)),{ids:subset,outside:1});
});

test('long sessions cover every clip of both dealers across both phases, join exact poses and space head motion',()=>{
  for(const dealerId of IDLE_ROTATION_DEALERS) {
    const f=fixture(dealerId),seen=new Set();let pose='rest',sinceHead=Infinity;
    for(let i=0;i<4000;i++) {
      const phase=i<2000?'bets':'decide';f.controller.updateScene({phase});
      const clip=f.controller.snapshot().clip,row=f.row(clip);seen.add(row.videoId);
      assert.equal(row.from,pose);if(row.head)assert.ok(sinceHead>=4);
      if(i>2002) {assert.equal(row.to,'rest');assert.ok(row.calm);assert.notEqual(row.phase,'bets');}
      pose=row.to;sinceHead=row.head?0:sinceHead+1;f.finish();
    }
    assert.equal(seen.size,f.source.clips.length,dealerId);
  }
});

test('speech and changed game phase finish the current clasped take, play its exit, then prove standard idle',()=>{
  for(const dealerId of IDLE_ROTATION_DEALERS)for(const patch of [{speechReady:true},{phase:'decide'}]) {
    const f=fixture(dealerId),c=f.controller;
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
  for(const dealerId of IDLE_ROTATION_DEALERS) {
    const f=fixture(dealerId);
    for(const patch of [p=>p.rotation.clips.pop(),p=>p.rotation.clips[0].to='clasped',p=>p.variants[0].use='manual',
      p=>p.rotation.clips.find(r=>r.from==='clasped').phase='decide',p=>p.rotation.clips.push(p.rotation.clips[0])]) {
      const p=structuredClone(f.policy);patch(p);assert.throws(()=>validateIdlePolicy(p),IdlePolicyError);
    }
    for(const phase of ['bets','decide'])for(let seed=0;seed<50;seed++) {
      const plan=createIdlePreviewPlan(f.policy,{phase,seed});let pose='rest';
      for(const clip of plan){const row=f.row(clip);assert.equal(row.from,pose);pose=row.to;assert.equal(clip.endMs-clip.startMs,1625);}
      assert.equal(pose,'rest');
    }
  }
});

test('publishing freezes exactly the bound original identities and pose policy, and rejects changed media revisions',()=>{
  for(const selection of [null,['andas','knappin5101','knapput5101','plattandas5101']]) {
    const f=fixture('paow',selection),project=addDealer(createSeedProject(),'paow','PAOW'),count=f.policy.rotation.clips.length;
    assert.equal(count,selection?4:21);
    const line=project.lines.find(row=>row.dealerId==='paow'&&row.eventId==='idle.ready');
    line.variants.find(row=>row.id===line.baselineVariantId).videoGenerationId=f.policy.base[0].videoId;
    project.dealerIdlePolicies=[{dealerId:'paow',policy:f.policy}];project.lanes=[defaultPresentationLane('paow')];
    const lane=project.lanes[0];lane.dealers=['paow'];lane.layers.dealer={enabled:true,default:'paow',allowed:['paow']};
    const mediaRows=f.inventory.videos.map((video,index)=>{
      Object.assign(video.classification,{role:index?'alternative':'standard',situation:'',label:f.source.clips[index].id,notes:''});
      return {id:video.id,sha256:video.sha256,size:video.bytes,contentType:'video/mp4',revision:'verified-'+index,
        pathname:`croupier/media/dealers/paow/review/uploads/${video.id}/${video.sha256}.mp4`,classification:video.classification};
    });
    const capture=captureFrozenPresentation({snapshot:{projectDocument:{kind:'project',revision:project.revision,value:project},
      administrationDocument:{kind:'administration',revision:'admin-fixture',value:{rooms:[]}},mediaRows},inventory:f.inventory,selectedLaneIds:[lane.id]});
    const frozen=decodePresentationPackage(encodePresentationPackage(capture.presentation));
    assert.deepEqual(frozen.playback.dealerIdlePolicies,[{dealerId:'paow',policy:f.policy}]);
    assert.deepEqual(capture.mediaPreconditions.map(row=>row.id).sort(),f.policy.rotation.clips.map(row=>row.videoId).sort());
    const bound=mediaRows.findIndex(row=>row.id===f.policy.rotation.clips.at(-1).videoId);
    mediaRows[bound].revision='replaced';assert.throws(()=>assertFrozenMediaPreconditions(capture.mediaPreconditions,mediaRows));
  }
});
