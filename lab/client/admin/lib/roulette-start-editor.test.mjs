import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {createSeedProject,defaultPresentationLane} from '../../../../lab/lib/studio-model.mjs';
import {materialById} from '../../../../web/public/material-catalog.mjs';
import {layerAssetPath} from '../../../../web/layer-asset-contract.mjs';
import {mediaClassification} from '../../../../lab/lib/dealer-media-library.mjs';
import {createStudioClient,currentClipId} from './connected-studio.mjs';
import * as slots from './roulette-clip-map.mjs';
import * as editor from './roulette-start-editor.mjs';
const dealerId='astrid',startId='11111111-1111-4111-8111-111111111111',idleId='22222222-2222-4222-8222-222222222222';
function fixture(){
  const project=createSeedProject(),lane=defaultPresentationLane(dealerId),source=materialById('roulette-anna-v1').sources[0];
  const {sha256,size,contentType,width,height}=source;
  const table={schemaVersion:1,id:'33333333-3333-4333-8333-333333333333',role:'table',game:'roulette',label:'Anna roulette',sha256,size,contentType,width,height};
  table.pathname=layerAssetPath(table);project.layerAssets=[table];project.lanes=[lane];lane.layers.table={...lane.layers.table,enabled:true,allowed:[table.id],default:table.id};
  const videos=[['roulette.idle/breathing',idleId],['roulette.wheel-start/wheel-start',startId]].map(([slotId,id])=>({id,sha256:'a'.repeat(64),available:true,integrity:'verified',contentType:'video/webm',label:slotId,previewUrl:'/studio/api/videos/'+id,
    classification:{...mediaClassification(project,{dealerId,slotId,label:slotId,contentType:'video/webm'}),compositing:{mode:'alpha'},framing:{scale:1,x:.2,y:0},startPose:'VILA',endPose:'VILA',playback:'once'}}));
  project.dealers.find(row=>row.id===dealerId).rouletteIdle={videoId:idleId};
  const form={videoId:startId,tableDesignId:'roulette-anna-v1',durationMs:'10042',wheelImpulseMs:'1700',ballReleaseMs:'4600',foregroundPolygons:'[[[0,0],[1,0],[1,1]]]'};
  return {project,inventory:{videos},laneId:lane.id,form,table};
}
test('explicit start binding saves and reloads exact timings, media and mask without touching idle or blackjack',async()=>{
  const f=fixture(),before=structuredClone(f.project),draft=editor.bindRouletteStart(f.project,f.inventory,dealerId,f.laneId,f.form);
  assert.deepEqual(f.project,before);assert.deepEqual(draft.lines,before.lines);
  assert.deepEqual(draft.dealers.find(row=>row.id===dealerId).rouletteIdle,before.dealers.find(row=>row.id===dealerId).rouletteIdle);
  const client=createStudioClient({fetchImpl:async(url,options)=>{
    assert.equal(url,'/studio/api/project');const body=JSON.parse(options.body);assert.equal(body.expectedRevision,f.project.revision);
    return Response.json({project:{...body.project,revision:'saved-start'}});
  }});
  const saved=await client.save(draft);
  assert.deepEqual(editor.rouletteStartForm(saved,dealerId),f.form);
  assert.equal(currentClipId(saved,dealerId,slots.rouletteClipSlots().find(row=>row.eventId==='roulette.wheel-start')),startId);
  const removed=editor.removeRouletteStart(saved,dealerId);assert.deepEqual(removed.lines,saved.lines);
  assert.equal(removed.dealers.find(row=>row.id===dealerId).rouletteStart,undefined);
  assert.deepEqual(removed.dealers.find(row=>row.id===dealerId).rouletteIdle,before.dealers.find(row=>row.id===dealerId).rouletteIdle);
});
test('new start source never inherits another take timing or hand calibration; empty fields remain empty',()=>{
  const f=fixture(),draft=editor.bindRouletteStart(f.project,f.inventory,dealerId,f.laneId,f.form);
  assert.deepEqual(editor.rouletteStartForm(draft,dealerId,idleId),{videoId:idleId,tableDesignId:'',durationMs:'',wheelImpulseMs:'',ballReleaseMs:'',foregroundPolygons:''});
  assert.equal(editor.rouletteStartForm(draft,dealerId,'').videoId,'');
  for(const patch of [{durationMs:''},{wheelImpulseMs:''},{ballReleaseMs:''},{durationMs:'10042.1'},{wheelImpulseMs:'-1'},{wheelImpulseMs:'5000'},{ballReleaseMs:'10042'},{foregroundPolygons:'oops'},{tableDesignId:'blackjack-green-felt'}])
    assert.throws(()=>editor.bindRouletteStart(f.project,f.inventory,dealerId,f.laneId,{...f.form,...patch}));
});
test('start binding refuses cross-game/dealer media, unreviewed poses, missing framing and incompatible tables',()=>{
  for(const mutate of [
    f=>f.inventory.videos[1].classification.dealerId='vera',f=>f.inventory.videos[1].classification.game='blackjack',
    f=>f.inventory.videos[1].classification.startPose='unverified',f=>f.inventory.videos[1].classification.endPose='WHEEL',
    f=>delete f.inventory.videos[1].classification.framing,f=>f.inventory.videos[1].classification.archived=true,
    f=>f.inventory.videos[1].classification.compositing={mode:'opaque'},f=>f.inventory.videos[1].contentType='video/mp4',
    f=>f.inventory.videos[1].available=false,f=>f.project.lanes[0].layers.table.allowed=[],
    f=>f.project.lanes[0].layers.dealer.allowed=['vera'],f=>f.project.lanes[0].layers.dealer.enabled=false,
    f=>f.table.game='blackjack',f=>f.table.sha256='b'.repeat(64),f=>f.table.width++,
    f=>delete f.project.dealers.find(row=>row.id===dealerId).rouletteIdle,
  ]){const f=fixture();mutate(f);assert.throws(()=>editor.bindRouletteStart(f.project,f.inventory,dealerId,f.laneId,f.form));}
});

test('start composition choices require the dealer and an allowed registered roulette table',()=>{
  const f=fixture(),before=structuredClone(f.project);
  assert.deepEqual(editor.rouletteStartCompositions(f.project,dealerId).map(lane=>lane.id),[f.laneId]);
  assert.deepEqual(f.project,before);
  for(const mutate of [
    value=>value.project.lanes[0].layers.dealer.enabled=false,
    value=>value.project.lanes[0].layers.dealer.allowed=['vera'],
    value=>value.project.lanes[0].layers.table.enabled=false,
    value=>value.project.lanes[0].layers.table.allowed=[],
    value=>value.project.layerAssets=[],
    value=>value.table.game='blackjack',
    value=>value.table.sha256='b'.repeat(64),
  ]){
    const invalid=fixture();mutate(invalid);
    assert.deepEqual(editor.rouletteStartCompositions(invalid.project,dealerId),[]);
    assert.throws(()=>editor.bindRouletteStart(invalid.project,invalid.inventory,dealerId,invalid.laneId,invalid.form),/dealer och ett registrerat roulettebord/);
  }
});
test('start editor exposes saved values, missing-data errors and separate metadata review',()=>{
  const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
  const module={exports:{}},source=readFileSync(new URL('../components/studio/roulette-start-editor.tsx',import.meta.url),'utf8');
  runInNewContext(require('esbuild').transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module,exports:module.exports,
    require:name=>name.endsWith('/roulette-clip-map.mjs')?slots:name.endsWith('/roulette-start-editor.mjs')?editor:name==='./roulette-media-review'?{RouletteMediaReview:()=>null}:require(name)});
  const f=fixture();f.project=editor.bindRouletteStart(f.project,f.inventory,dealerId,f.laneId,f.form);
  const render=project=>renderToStaticMarkup(React.createElement(module.exports.RouletteStartEditor,{...f,project,dealerId,videoId:startId,blocked:false,onEdit(){},onDirtyChange(){},onInventory(){},onBusyChange(){}}));
  const html=render(f.project);assert.match(html,/value="10042"/);assert.match(html,/value="1700"/);assert.match(html,/value="4600"/);assert.match(html,/VILA → VILA/);assert.match(html,/skala 1, x 0.2, y 0/);assert.match(html,/Ta bort sparad startkoppling/);
  assert.match(html,/Sammansättning för bordkontroll/);assert.match(html,/href="\/admin\/compositions"/);
  const other={...structuredClone(f.project.lanes[0]),id:'unassigned-anna',label:'Anna without room'};f.project.lanes.push(other);
  assert.match(render(f.project),/Anna without room/,'unassigned compatible templates remain explicitly selectable');
  other.layers.dealer.allowed=['vera'];assert.doesNotMatch(render(f.project),/Anna without room/);
  other.layers.dealer.allowed=[dealerId];other.layers.table.allowed=[];
  assert.doesNotMatch(render(f.project),/Anna without room/,'dealer-compatible templates without a roulette table are excluded');
  assert.match(render(fixture().project),/Ange filmens längd|Välj en registrerad rouletteborddesign/);
});
