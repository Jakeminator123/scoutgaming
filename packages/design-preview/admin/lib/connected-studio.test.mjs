import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedProject, defaultPresentationLane } from '../../../../lab/lib/studio-model.mjs';
import { kindForEvent } from '../../../../lab/lib/video-intake.mjs';
import { bindClip, clipSlots, clipsForSlot, configuredClipIds, createStudioClient, selectLayer, uploadMetadata } from './connected-studio.mjs';
const id1='11111111-1111-4111-8111-111111111111', id2='22222222-2222-4222-8222-222222222222';
function fixture() {
  const project=createSeedProject();
  const classification={label:'A',dealerId:'astrid',eventId:'deal.player.left',kind:kindForEvent(project.events.find(row=>row.id==='deal.player.left')),role:'standard',situation:'box0',playback:'once',notes:'',compositing:{mode:'green-screen',threshold:.38,softness:.12,despill:.6}};
  const video={id:id1,label:'A',available:true,integrity:'verified',previewUrl:'/studio/api/videos/'+id1,classification};
  const inventory={videos:[video],families:[]};
  return {project,inventory,video,slot:clipSlots(project,inventory,'astrid').find(row=>row.id==='deal.player.left/box0')};
}
test('slot candidates reject another dealer, destination, archived and unavailable bytes',()=>{
  const f=fixture(); f.inventory.videos.push(...[
    {...f.video,id:'other',classification:{...f.video.classification,dealerId:'vera'}},
    {...f.video,id:'seat',classification:{...f.video.classification,situation:'box1'}},
    {...f.video,id:'archived',classification:{...f.video.classification,archived:true}},
    {...f.video,id:'missing',available:false},
  ]);
  assert.deepEqual(clipsForSlot(f.inventory,'astrid',f.slot).map(row=>row.id),[id1]);
  assert.throws(()=>bindClip(f.project,f.inventory,'vera',f.slot,id1));
});
test('binding edits only selected existing line; exact IDs survive save and reload',async()=>{
  const f=fixture(), original=structuredClone(f.project);
  let saved=f.project;
  const client=createStudioClient({fetchImpl:async(url,options)=>{
    if(options.method==='PUT') {const body=JSON.parse(options.body);assert.equal(body.expectedRevision,saved.revision);saved={...body.project,revision:'studio.test.2'};return Response.json({project:saved});}
    if(url.endsWith('/catalog'))return Response.json({source:'registered',administration:{revisions:{project:saved.revision}}});
    return Response.json(url.endsWith('/project')?{project:saved}:f.inventory);
  }});
  const draft=bindClip(f.project,f.inventory,'astrid',f.slot,id1);
  assert.deepEqual(f.project,original);
  assert.equal(draft.lines.find(row=>row.dealerId==='astrid'&&row.eventId===f.slot.eventId).variants[0].videoGenerationId,id1);
  assert.deepEqual(draft.lines.filter(row=>row.dealerId!=='astrid'),original.lines.filter(row=>row.dealerId!=='astrid'));
  await client.save(draft); const loaded=await client.load();
  assert.equal(loaded.project.revision,'studio.test.2');assert.deepEqual(loaded.project.lines,draft.lines);
});
test('managed family activation preserves other active variants and reports all bindings',()=>{
  const f=fixture(), family={id:'astrid/deal.player.left/box0',dealerId:'astrid',eventId:'deal.player.left',situation:'box0',playbackType:'once',standardIds:[],variantIds:[id1,id2]};
  f.inventory.families=[family]; f.inventory.videos=[id1,id2].map((id,index)=>({...f.video,id,classification:{...f.video.classification,familyId:family.id,role:'alternative'},familyId:family.id}));
  const slot=clipSlots(f.project,f.inventory,'astrid').find(row=>row.family?.id===family.id);
  const a=bindClip(f.project,f.inventory,'astrid',slot,id1),b=bindClip(a,f.inventory,'astrid',slot,id2);
  assert.deepEqual(configuredClipIds(b,'astrid',slot),[id1,id2]);
  assert.deepEqual(b.mediaPolicy[0].variants[0],a.mediaPolicy[0].variants[0]);
});
test('idle binding requires its exact metadata duration and preserves variant policy',()=>{
  const f=fixture(); f.video.classification={...f.video.classification,eventId:'idle.ready',kind:'idle',situation:''};
  const slot=clipSlots(f.project,f.inventory,'astrid').find(row=>row.eventId==='idle.ready');
  assert.throws(()=>bindClip(f.project,f.inventory,'astrid',slot,id1));
  const next=bindClip(f.project,f.inventory,'astrid',slot,id1,{durationMs:4042});
  assert.equal(next.dealerIdlePolicies[0].policy.base[0].durationMs,4042);
  assert.equal(next.lines.find(row=>row.dealerId==='astrid'&&row.eventId==='idle.ready').variants[0].videoGenerationId,id1);
});
test('layer selection uses only the current composition allowlist; roulette table changes fail closed',()=>{
  const f=fixture(),lane=defaultPresentationLane('astrid');f.project.lanes=[lane];
  lane.layers.background={enabled:true,mode:'image',default:'bg-a',allowed:['bg-a','bg-b']};
  const room={compositionId:lane.id,game:'blackjack'};
  const next=selectLayer(f.project,room,'background','bg-b');assert.equal(next.lanes[0].layers.background.default,'bg-b');
  assert.throws(()=>selectLayer(f.project,room,'background','foreign'));
  assert.throws(()=>selectLayer(f.project,{...room,game:'roulette'},'table',lane.layers.table.default));
});
test('upload metadata remains exact and rejects speech sets and unsupported files',()=>{
  const f=fixture(),file=new File([new Uint8Array(20)],'own.mp4',{type:'video/mp4'});
  const metadata=uploadMetadata(f.project,'astrid',f.slot,file,f.video.classification.compositing);
  assert.equal(metadata.situation,'box0');assert.equal(metadata.dealerId,'astrid');assert.equal(metadata.eventId,'deal.player.left');
  assert.throws(()=>uploadMetadata(f.project,'astrid',{...f.slot,eventId:'speak.goodluck'},file,metadata.compositing));
  assert.throws(()=>uploadMetadata(f.project,'astrid',f.slot,new File(['x'],'wrong.mov'),metadata.compositing));
});
test('upload success is accepted only after exact registered media is reread',async()=>{
  const f=fixture(),file=new File([new Uint8Array(20)],'own.mp4');let calls=0;
  const client=createStudioClient({fetchImpl:async()=>{calls++;return Response.json({...f.inventory,uploadMode:'private-client-blob'});},uploadImpl:async()=>({id:id1,duplicate:false})});
  const result=await client.upload(file,f.video.classification);assert.equal(result.video.id,id1);assert.equal(calls,2);
  f.video.classification={...f.video.classification,situation:'box1'};
  await assert.rejects(client.upload(file,{...f.video.classification,situation:'box0'}),/återläsas/);
});
test('N1 denial and revision conflicts keep the caller draft unchanged; mixed snapshot is rejected',async()=>{
  const f=fixture(),draft=structuredClone(f.project);
  for(const status of [401,403,409,503]){
    const client=createStudioClient({fetchImpl:async()=>Response.json({error:'denied'},{status})});
    await assert.rejects(client.save(draft),error=>error.statusCode===status);assert.deepEqual(draft,f.project);
  }
  const client=createStudioClient({fetchImpl:async url=>Response.json(url.endsWith('/catalog')?{source:'registered',administration:{revisions:{project:'changed'}}}:url.endsWith('/project')?{project:f.project}:f.inventory)});
  await assert.rejects(client.load(),/samma revision/);
});
