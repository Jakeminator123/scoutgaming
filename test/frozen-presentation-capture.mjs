import {cloudPresentationFixture} from '../lab/test/fixtures/cloud-presentation.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createSeedProject, addDealer, defaultPresentationLane} from '../lab/lib/studio-model.mjs';
import {buildPresentationPackage, validatePresentationPackage} from '../web/presentation-layers.mjs';
import {encodePresentationPackage, decodePresentationPackage, readPackagePresentation, withPackagePresentation} from '../web/storage/presentation-package.mjs';
import {captureFrozenPresentation, assertCapturedPresentationMedia, selectedRegisteredIdleDefaults, assertPublishedRoomBindings} from '../web/storage/frozen-presentation-capture.mjs';
const scope={environment:'frozen-fixture',workspaceId:'isolated'};
const id='10000000-0000-4000-8000-000000000001',sha256='a'.repeat(64);
function fixture(){
  const project=addDealer(createSeedProject(),'johanna','Johanna');
  const lane=defaultPresentationLane('johanna');lane.id='johns-presentation';lane.dealers=['johanna'];lane.layers.dealer.default='johanna';lane.layers.dealer.allowed=['johanna'];project.lanes=[lane];
  project.lines.find(row=>row.dealerId==='johanna'&&row.eventId==='idle.ready').variants[0].videoGenerationId=id;
  const classification={dealerId:'johanna',eventId:'idle.ready',kind:'idle',role:'alternative',situation:'',label:'Egen Johanna',notes:'',
    compositing:{mode:'green-screen',threshold:.2,softness:.1,despill:0}};
  const record={id,sha256,size:4096,contentType:'video/mp4',pathname:`croupier/media/dealers/johanna/review/uploads/${id}/${sha256}.mp4`,classification};
  const snapshot={scope,projectDocument:{kind:'project',revision:project.revision,value:project},administrationDocument:{kind:'administration',revision:'admin-initial',value:{rooms:[]}},mediaRows:[{...record,revision:'media-initial'}]};
  const inventory={videos:[{id,sha256,bytes:4096,dealer:'johanna',available:true,classification,kind:'idle',playback:'once'}],families:[],summary:{readable:true,snapshotReadable:true}};
  return {snapshot,inventory,selectedLaneIds:[lane.id],requiredIdleDealerIds:['johanna']};
}
test('v1 canonical bytes and gzip envelope remain exactly compatible with the pre-integration fixture',()=>{
  const project=createSeedProject();project.lanes=[defaultPresentationLane('astrid')];project.revision='v1-frozen-fixture';
  const legacy=buildPresentationPackage(project,[project.lanes[0].id],[]);
  const envelope=encodePresentationPackage(legacy);
  const historicalEnvelope={format:'croupier-lanes-v1',encoding:'gzip-base64url',sha256:'cb46fe439c10e9584e978b784812c83043bec71084e88824eb3121318f359784',
    data:'H4sIAAAAAAAACpVQMW7DMAz8SnCzXCCrt-4tUHToEmSgLDpRLEsGJTttA_-9oJ02bbZuvCN5d-QFlDOXjHq3NwgUWcsLHFNg0RqUi3iHvYF3qNEn6wNXwzFFhq5YDqjxvNCbF6U3T3TtfSwaF1hquoOkMTpFFEI6s1s9Hbc0hoI6jiEYcCQbtFdkZIM-OUYNSx07zOaa66_Ir4Q_Yt_cneBsUBT-K8U8G6SBYxPorIuaQR2a4ic90zsVvOFBklUitS0MhKe7-TwwdTdiVRcqSR7daczXgLs16UOTQhIYWKHofDzomcLRsegf1h_rb_aL8Ymb8sqTzz5F1Ji2VSvpk2PV-vcyymLfHLmnN5Z1Zjt_ATlQy4kEAgAA'};
  const compressed=Buffer.from(envelope.data,'base64url'), historicalCompressed=Buffer.from(historicalEnvelope.data,'base64url');
  assert.deepEqual(gunzipSync(compressed),gunzipSync(historicalCompressed));
  // Only gzip header byte 9 identifies the producing OS (Unix=3, Windows=10).
  // Keep canonical payload/SHA and every other compressed byte exact.
  const normalizedCompressed=Buffer.from(compressed);normalizedCompressed[9]=historicalCompressed[9];
  assert.deepEqual({...envelope,data:normalizedCompressed.toString('base64url')},historicalEnvelope);
  assert.deepEqual(decodePresentationPackage(historicalEnvelope),legacy);
  assert.deepEqual(decodePresentationPackage(envelope),legacy);
});
test('v3 idle UUID, shader metadata, own label and immutable bytes survive envelope round-trip and later Studio edits',()=>{
  const input=fixture(), captured=captureFrozenPresentation(input), lane=input.snapshot.projectDocument.value.lanes[0];
  assert.equal(captured.presentation.schemaVersion,3);assert.equal(captured.presentation.registeredDealers[0].idle.id,id);
  const pack={lanes:[lane.id],branding:withPackagePresentation({name:'Johns'},captured.presentation)};
  input.snapshot.projectDocument.value.lines.find(row=>row.dealerId==='johanna'&&row.eventId==='idle.ready').variants[0].videoGenerationId=null;
  input.inventory.videos=[];input.snapshot.mediaRows[0].classification.compositing.threshold=.9;
  assert.deepEqual(readPackagePresentation(pack),captured.presentation);
  assert.equal(readPackagePresentation(pack).registeredDealers[0].idle.classification.compositing.threshold,.2);
  assert.equal(Object.isFrozen(captured.presentation.registeredDealers[0].idle.classification.compositing),true);
});
test('portable v3 decode requires all and only the selected saved extra registry and refuses descriptor mutations',()=>{
  const pack=captureFrozenPresentation(fixture()).presentation;
  for(const mutate of [p=>p.registeredDealers=[],p=>p.registeredDealers.push({...p.registeredDealers[0],id:'another'}),
    p=>p.registeredDealers[0].idle.classification.dealerId='nora',p=>p.lanes[0].layers.dealer.default='nora',
    p=>p.registeredDealers[0].idle.src='/latest',p=>p.schemaVersion=1,p=>p.projectRevision='invalid revision']){
    const draft=structuredClone(pack);mutate(draft);assert.throws(()=>validatePresentationPackage(draft));
  }
  assert.throws(()=>buildPresentationPackage(fixture().snapshot.projectDocument.value,['johns-presentation'],[]),'browser cannot fabricate frozen authority');
});
test('selected registered default must have own idle but exact card slots remain optional',()=>{
  const input=fixture();
  assert.deepEqual(selectedRegisteredIdleDefaults(input.snapshot.projectDocument.value,input.selectedLaneIds),['johanna']);
  input.inventory.videos[0].available=false;
  assert.throws(()=>captureFrozenPresentation(input),e=>e.code==='studio_dealer_idle_required'&&e.statusCode===422);
  input.requiredIdleDealerIds=[];
  assert.equal(captureFrozenPresentation(input).presentation.registeredDealers[0].idle,null);
});
test('captured media CAS checks only the frozen UUID through the current bound repository client',async()=>{
  const input=fixture(),captured=captureFrozenPresentation(input),calls=[];
  await assertCapturedPresentationMedia({getMedia:async wanted=>(calls.push(wanted),input.snapshot.mediaRows[0])},captured.mediaPreconditions);
  assert.deepEqual(calls,[id]);
  await assert.rejects(assertCapturedPresentationMedia({getMedia:async()=>null},captured.mediaPreconditions),e=>e.statusCode===409);
  await assert.rejects(assertCapturedPresentationMedia({getMedia:async()=>({...input.snapshot.mediaRows[0],revision:'media-new'})},captured.mediaPreconditions),e=>e.statusCode===409);
});
test('advanced republication must preserve every published room lane/default ownership without a same-ID lock',()=>{
  const presentation=captureFrozenPresentation(fixture()).presentation;
  const room={schemaVersion:2,id:'room-10000000-0000-4000-8000-000000000002',name:'Johns',operatorId:'north',presentationLaneId:'johns-presentation',gameLaneId:'server-generated-johanna',state:'live'};
  const administration={rooms:[room],gameLane:room.gameLaneId,gameLanes:[{schemaVersion:1,id:room.gameLaneId,label:'Johanna',renderer:'portrait-video',dealer:'johanna',mediaCollection:'johanna-presentation'}]};
  const input={administration,operatorId:'north',currentPackage:{tables:[room.id]},presentation};
  assert.doesNotThrow(()=>assertPublishedRoomBindings(input));
  for(const change of [p=>p.lanes=[],p=>p.lanes[0].layers.dealer.default='nora']){
    const draft=structuredClone(presentation);change(draft);
    assert.throws(()=>assertPublishedRoomBindings({...input,presentation:draft}),e=>e.statusCode===409);
  }
  assert.doesNotThrow(()=>assertPublishedRoomBindings({...input,operatorId:'other',presentation:{lanes:[]}}));
});

test('portable v3 parser rejects getter-backed authority or decorated arrays without invoking accessors',()=>{
  const source=captureFrozenPresentation(fixture()).presentation;let called=0;
  for(const mutate of [
    p=>Object.defineProperty(p,'schemaVersion',{enumerable:true,get(){called++;return 2;}}),
    p=>Object.defineProperty(p.registeredDealers[0],'id',{enumerable:true,get(){called++;return 'johanna';}}),
    p=>Object.defineProperty(p.registeredDealers,0,{enumerable:true,get(){called++;return source.registeredDealers[0];}}),
    p=>p.registeredDealers.hidden='unknown',
    p=>p.lanes[Symbol('hidden')]='unknown'
  ]){
    const draft=structuredClone(source);mutate(draft);assert.throws(()=>validatePresentationPackage(draft));
  }
  assert.equal(called,0);
});


test('v3 binding admits only a frozen allowed Astrid adapter for the Johanna default and rejects retired or foreign adapters', () => {
  const lane = defaultPresentationLane('johanna'); lane.dealers=['johanna','astrid']; lane.layers.dealer.allowed=[...lane.dealers];
  const presentation = cloudPresentationFixture({lanes:[lane]}).presentation;
  const room = { schemaVersion:2, id:'room-existing', name:'Existing', operatorId:'north', presentationLaneId:presentation.lanes[0].id, gameLaneId:'old-astrid', state:'live' };
  const game = {schemaVersion:1,id:room.gameLaneId,label:'Astrid',renderer:'portrait-video',dealer:'astrid',mediaCollection:'astrid-presentation'};
  const input = { administration:{gameLane:game.id,gameLanes:[game],rooms:[room]}, operatorId:'north', currentPackage:{tables:[room.id]}, presentation };
  assert.doesNotThrow(() => assertPublishedRoomBindings(input));
  for (const change of [
    value => { value.administration.gameLanes=[]; value.administration.gameLane=null; },
    value => { value.administration.gameLanes[0]={...game,renderer:'indexed-video',mediaCollection:'legacy-dealers'}; },
    value => { value.presentation.schemaVersion=2; delete value.presentation.playback; },
    value => { value.presentation.lanes[0].layers.dealer.default='unknown'; },
    value => { value.administration.gameLanes[0]={...game,dealer:'amira',mediaCollection:'amira-presentation'}; },
    value => { value.administration.gameLanes[0]={...game,dealer:'nora',mediaCollection:'nora-presentation'}; },
    value => { value.presentation.lanes[0].layers.dealer.allowed=['johanna']; },
    value => { value.presentation.registeredDealers=value.presentation.registeredDealers.filter(row=>row.id!=='astrid'); },
    value => { value.presentation.registeredDealers[0].idle=null; },
  ]) {
    const invalid=structuredClone(input);change(invalid);
    assert.throws(() => assertPublishedRoomBindings(invalid), error => error.statusCode===409);
  }
  assert.equal(input.administration.rooms[0].gameLaneId, 'old-astrid');
});
