import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeedProject,defaultPresentationLane} from '../../../../../packages/presentation/contracts/studio-model.mjs';
import {useScenePreviewMedia} from './scene-preview-media.mjs';

const asset=(id,role,extra={})=>({schemaVersion:1,id,role,label:id,sha256:'0'.repeat(64),size:1,contentType:'image/png',pathname:role+'s/'+id+'.png',width:1920,height:1080,...extra});
function scene(){
  const project=createSeedProject(),lane=defaultPresentationLane('astrid');
  lane.layers.background={...lane.layers.background,allowed:['bg-1'],default:'bg-1'};
  lane.layers.table={...lane.layers.table,allowed:['table-1'],default:'table-1'};
  project.lanes=[lane];project.layerAssets=[asset('bg-1','background'),asset('table-1','table')];
  const line=project.lines.find(row=>row.dealerId==='astrid'&&row.eventId==='idle.ready');
  const variant=line.variants.find(item=>item.id===line.baselineVariantId);
  const framing={scale:1.2,x:0,y:.1};
  const inventory={videos:[{id:variant.videoGenerationId,label:'Vila',available:true,integrity:'verified',contentType:'video/webm',previewUrl:'/vila.webm',
    classification:{dealerId:'astrid',eventId:'idle.ready',kind:'idle',role:'standard',situation:'ready',label:'Vila',notes:'',framing,compositing:{mode:'alpha'}}}]};
  return {project,lane,inventory,line,framing};
}

test('the preview shows the dealer\'s saved idle over the template background and table graphics',()=>{
  const {project,lane,inventory,framing}=scene();
  const media=useScenePreviewMedia({project,inventory,lane,game:'blackjack',dealerId:'astrid'});
  assert.deepEqual(media.dealer,{url:'/vila.webm',label:'Vila',contentType:'video/webm'});
  assert.deepEqual(media.background,{url:'/studio/api/layer-assets/bg-1',label:'bg-1',contentType:'image/png'});
  assert.deepEqual(media.table,{url:'/studio/api/layer-assets/table-1',label:'table-1',contentType:'image/png'});
  assert.deepEqual(media.framing,framing);assert.equal(media.compositing.mode,'alpha');
  assert.ok(media.settings.desktop&&media.settings.mobile,'placement for both layouts');
});

test('missing media stays empty: no idle clip, no background, a dealer outside the template falls back to its default',()=>{
  const {project,lane,inventory}=scene();
  inventory.videos[0].available=false;lane.layers.background={...lane.layers.background,default:null};
  const media=useScenePreviewMedia({project,inventory,lane,game:'blackjack',dealerId:'stranger'});
  assert.equal(media.dealer,null,'an unavailable clip is not shown');assert.equal(media.background,null);
  assert.equal(media.dealerId,lane.layers.dealer.default,'a dealer the template does not allow is never shown');
  assert.notEqual(media.table,null,'the table graphics remain');
  const none=useScenePreviewMedia({project:null,inventory:null,lane:undefined});
  assert.equal(none.dealer,null);assert.equal(none.background,null);assert.equal(none.table,null);
});

test('archived, roulette or unsupported idle clips are not used for a blackjack preview',()=>{
  for(const change of [{classification:{archived:true}},{classification:{game:'roulette'}},{contentType:'video/quicktime'},{integrity:'unavailable'}]){
    const {project,lane,inventory}=scene();const video=inventory.videos[0];
    Object.assign(video,{...change,classification:{...video.classification,...change.classification}});
    assert.equal(useScenePreviewMedia({project,inventory,lane,dealerId:'astrid'}).dealer,null,JSON.stringify(change));
  }
});
