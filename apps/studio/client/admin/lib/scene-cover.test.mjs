import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import * as sceneStill from '../../../../../packages/presentation/runtime/scene-still.mjs';
import * as dealerArtwork from './dealer-artwork.mjs';
import {defaultPresentationLane} from '../../../../../packages/presentation/contracts/studio-model.mjs';
import {defaultCompositionSettings} from '../../../../../packages/presentation/contracts/composition-settings.mjs';

// The real SceneCover (scene-cover.tsx), rendered on the server: the shared still geometry and the dealer
// artwork are the real modules; only the icon is a leaf.
const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{transformSync}=require('esbuild');
const compiled=transformSync(readFileSync(new URL('../components/studio/scene-cover.tsx',import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code;
const leaves={'lucide-react':{Layers:()=>React.createElement('svg',{'data-icon':'layers'})},
  '../../../../../../packages/presentation/runtime/scene-still.mjs':sceneStill,'../../lib/dealer-artwork.mjs':dealerArtwork};
const module={exports:{}};
runInNewContext(compiled,{module,exports:module.exports,require:name=>{if(name==='react'||name.startsWith('react/'))return require(name);if(Object.hasOwn(leaves,name))return leaves[name];throw Error('Unexpected import '+name);}});
const {SceneCover}=module.exports;

const asset=(n,role,width=1920,height=1080,contentType='image/png')=>({schemaVersion:1,id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,role,label:'M'+n,sha256:'0'.repeat(64),size:1,contentType,pathname:'x',width,height});
const background=asset(1,'background'),table=asset(2,'table',400,200),picture=asset(3,'illustration');
function lane(extra={}){
  const value=defaultPresentationLane('astrid');
  value.layers.background={enabled:true,mode:'image',default:background.id,allowed:[background.id]};
  value.layers.table={enabled:true,default:table.id,allowed:[table.id]};
  return {...value,composition:defaultCompositionSettings(),...extra};
}
const render=(value,assets=[background,table,picture])=>renderToStaticMarkup(React.createElement(SceneCover,{lane:value,assets,dealer:{id:'astrid',label:'Astrid'}}));
const styleOf=(html,role)=>Object.fromEntries([...new RegExp(`data-cover="${role}"[^>]*style="([^"]*)"`).exec(html)[1].matchAll(/([a-z-]+):([^;]+)/g)].map(([,key,value])=>[key,parseFloat(value)]));

test('an environment with a miljöbild shows only that picture',()=>{
  const html=render(lane({illustration:picture.id}));
  assert.match(html,new RegExp(`src="/studio/api/layer-assets/${picture.id}"[^>]*data-cover="illustration"`));
  assert.doesNotMatch(html,/data-cover="(background|table)"/);
  assert.doesNotMatch(html,/Bakgrund i dealerfilmen|Ingen bakgrund vald/);
});

test('without a miljöbild the card shows the real placement on a computer screen, not the table on the lower half',()=>{
  const value=lane(),html=render(value);
  assert.doesNotMatch(html,/data-cover="illustration"/);
  const still=sceneStill.desktopSceneStill({composition:value.composition,background,table});
  const expected=sceneStill.stillRectPercent(still.layers.find(row=>row.role==='table').rect);
  const shown=styleOf(html,'table');
  for(const key of ['left','top','width','height'])assert.ok(Math.abs(shown[key]-expected[key])<1e-6,key+' follows the saved placement');
  assert.ok(shown.top<10&&shown.height<40,'the default desktop table sits high and small, as in the scene preview');
  assert.deepEqual(styleOf(html,'background'),{left:0,top:0,width:100,height:100});
  // A moved table moves on the card.
  const moved=lane();moved.composition.desktop.table={width:.5,x:.1,y:.5};
  const movedStyle=styleOf(render(moved),'table');
  assert.ok(Math.abs(movedStyle.width-50)<1e-6&&Math.abs(movedStyle.top-50)<1e-6&&Math.abs(movedStyle.left-35)<1e-6);
  // A picture that is not an illustration, or is missing, is never shown as the miljöbild.
  assert.doesNotMatch(render(lane({illustration:background.id})),/data-cover="illustration"/);
});

test('a background baked into the dealer film says so in the new words',()=>{
  const value=lane();value.layers.background={enabled:false,mode:'baked',default:null,allowed:[]};
  const html=render(value);
  assert.match(html,/Bakgrund i dealerfilmen/);assert.doesNotMatch(html,/Miljön i dealerfilmen/);
  const empty=lane();empty.layers.background={enabled:true,mode:'image',default:null,allowed:[]};empty.layers.table={enabled:false,default:null,allowed:[]};
  assert.match(render(empty,[]),/Ingen bakgrund vald/);
});
