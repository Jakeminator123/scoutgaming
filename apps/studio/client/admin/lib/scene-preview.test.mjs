import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {createSeedProject,defaultPresentationLane} from '../../../../../packages/presentation/contracts/studio-model.mjs';
import {defaultBackgroundRule} from '../../../../../packages/presentation/contracts/background-playback-policy.mjs';
import {useScenePreviewMedia} from './scene-preview-media.mjs';

// The real ScenePreview (scene-preview.tsx) with the saved studio handed in, so it renders without reads. Only the
// leaves are stubbed: SavedScenePreview and CompositionPreview show the props they receive, Empty/Note/Loading their text.
const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{transformSync}=require('esbuild');
const compiled=transformSync(readFileSync(new URL('../components/studio/scene-preview.tsx',import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code;
const h=React.createElement;
const leaves={
  '../../../runtime/navigation':{__esModule:true,default:({href,children})=>h('a',{href},children)},
  '../ui/hub':{Empty:({title,text})=>h('section',{'data-empty':title},text),Note:({children})=>h('p',{'data-note':''},children)},
  '../ui/kit':{Loading:({label})=>h('p',{'data-loading':label})},
  '../../../../components/composition-preview':{CompositionPreview:props=>h('section',{'data-composition':[props.dealer?.url,props.background?.url,props.table?.url].map(value=>value??'none').join(' '),
    'data-autoplay':String(Boolean(props.autoplay&&props.loopDealer)),'data-background-playback':props.backgroundPlayback?props.backgroundAssets.map(row=>row.id).join(','):'none'})},
  '../../lib/scene-preview-media.mjs':{useScenePreviewMedia},
  './saved-scene-preview':{SavedScenePreview:props=>h('section',{'data-saved-scene':props.presentationLaneId,'data-revision':props.revision??'none','data-dealer':props.dealerId??'none','data-game':props.game,'data-active':String(props.active)})},
};
const module={exports:{}};
runInNewContext(compiled,{module,exports:module.exports,require:name=>{if(name==='react'||name.startsWith('react/'))return require(name);if(Object.hasOwn(leaves,name))return leaves[name];throw Error('Unexpected import '+name);}});
const {ScenePreview}=module.exports;

const asset=(id,role,contentType='image/png')=>({schemaVersion:1,id,role,label:id,sha256:'0'.repeat(64),size:1,contentType,pathname:role+'s/'+id+'.png',width:1920,height:1080});
const clip='00000000-0000-4000-8000-000000000002';
function saved(){
  const project=createSeedProject(),lane=defaultPresentationLane('astrid');
  lane.layers.background={...lane.layers.background,allowed:['bg-1',clip],default:'bg-1'};
  lane.layers.table={...lane.layers.table,allowed:['table-1'],default:'table-1'};
  lane.backgroundPlayback={schemaVersion:1,rules:[defaultBackgroundRule(clip,'celebration')]};
  project.lanes=[lane];project.layerAssets=[asset('bg-1','background'),asset(clip,'background','video/mp4'),asset('table-1','table')];
  const line=project.lines.find(row=>row.dealerId==='astrid'&&row.eventId==='idle.ready');
  const variant=line.variants.find(item=>item.id===line.baselineVariantId);
  const inventory={videos:[{id:variant.videoGenerationId,label:'Vila',available:true,integrity:'verified',contentType:'video/webm',previewUrl:'/vila.webm',
    classification:{dealerId:'astrid',eventId:'idle.ready',kind:'idle',role:'standard',situation:'ready',label:'Vila',notes:'',compositing:{mode:'alpha'}}}]};
  return {project,inventory,lane};
}
const render=(value,props={})=>renderToStaticMarkup(h(ScenePreview,{active:true,laneId:value.lane.id,dealerId:'astrid',revision:'saved:7',saved:{project:value.project,inventory:value.inventory},...props}));
const handsRevision=(html,laneId,message)=>assert.match(html,new RegExp(`data-saved-scene="${laneId}" data-revision="saved:7" data-dealer="astrid" data-game="blackjack" data-active="true"`),message);

test('the scene preview draws the saved idle, background and table and hands the saved revision to Provspela',()=>{
  const value=saved(),html=render(value);
  assert.match(html,/data-composition="\/vila.webm \/studio\/api\/layer-assets\/bg-1 \/studio\/api\/layer-assets\/table-1" data-autoplay="true"/);
  assert.match(html,new RegExp(`data-background-playback="bg-1,${clip}"`),'the template\'s own background automation plays, as in the scene template editor');
  assert.doesNotMatch(html,/data-note|data-empty/,'nothing is missing');
  handsRevision(html,value.lane.id,'the saved project revision reaches SavedScenePreview');
  assert.match(html,/Startar Blackjack med testsaldo/);assert.doesNotMatch(html,/revisionen/);
});

test('missing media is said, and Provspela still receives the saved revision',()=>{
  const noIdle=saved();noIdle.inventory.videos[0].available=false;
  const idleHtml=render(noIdle);
  assert.match(idleHtml,/data-composition="none \/studio\/api\/layer-assets\/bg-1/,'the background and table still show');
  assert.match(idleHtml,/Dealern saknar viloklipp/);assert.match(idleHtml,/href="\/admin\/dealers\/astrid\?flik=klipp"/);
  handsRevision(idleHtml,noIdle.lane.id,'no idle clip');

  const noBackground=saved();noBackground.lane.layers.background={...noBackground.lane.layers.background,default:null};
  const backgroundHtml=render(noBackground);
  assert.match(backgroundHtml,/Miljön saknar bakgrund/);assert.match(backgroundHtml,/href="\/admin\/scenes\?tab=mallar&amp;composition=/);
  handsRevision(backgroundHtml,noBackground.lane.id,'no background');

  const nothing=saved();nothing.inventory.videos=[];nothing.project.layerAssets=[];
  const emptyHtml=render(nothing);
  assert.match(emptyHtml,/data-empty="Scenen har inget att visa"/);assert.doesNotMatch(emptyHtml,/data-composition/);
  handsRevision(emptyHtml,nothing.lane.id,'nothing to draw');

  const gone=saved(),goneHtml=render(gone,{laneId:'gone'});
  assert.match(goneHtml,/data-empty="Miljön finns inte i det sparade projektet"/);assert.doesNotMatch(goneHtml,/data-composition|data-note/);
  handsRevision(goneHtml,'gone','the lane is missing from the saved project');
});

test('a dealer outside the saved template is said, and roulette links to its own clip map',()=>{
  const value=saved(),stranger=render(value,{dealerId:'stranger'});
  assert.match(stranger,/Den sparade miljön tillåter inte den här dealern/);
  assert.match(stranger,/data-saved-scene="[^"]+" data-revision="saved:7" data-dealer="stranger"/);
  const roulette=saved();roulette.inventory.videos=[];
  const html=render(roulette,{game:'roulette'});
  assert.match(html,/href="\/admin\/dealers\/astrid\?flik=klipp&amp;game=roulette"/);
  assert.match(html,/Provspelning med spelmotorn finns bara för Blackjack/);assert.doesNotMatch(html,/Startar Blackjack|revisionen/);
  assert.match(html,/data-revision="saved:7" data-dealer="astrid" data-game="roulette"/);
});
