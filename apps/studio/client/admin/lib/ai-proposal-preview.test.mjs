import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {createSeedProject,defaultPresentationLane} from '../../../../../packages/presentation/contracts/studio-model.mjs';
import {defaultCompositionSettings} from '../../../../../packages/presentation/contracts/composition-settings.mjs';
import {filmedTableTemplate} from '../../../lib/filmed-table-template.mjs';
import {useScenePreviewMedia} from './scene-preview-media.mjs';
import * as preview from './ai-proposal-preview.mjs';

// The real AiProposalPreview (ai-proposal-preview.tsx) with the real geometry and scene media; only the kit's
// Badge is a leaf that shows its tone and text.
const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{transformSync}=require('esbuild');
const compiled=transformSync(readFileSync(new URL('../components/studio/ai-proposal-preview.tsx',import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code;
const h=React.createElement;
const leaves={
  '../ui/kit':{Badge:({tone,children,title})=>h('span',{'data-badge':tone,title},children)},
  '../../lib/ai-proposal-preview.mjs':preview,
  '../../lib/scene-preview-media.mjs':{useScenePreviewMedia},
};
const module={exports:{}};
runInNewContext(compiled,{module,exports:module.exports,require:name=>{if(name==='react'||name.startsWith('react/'))return require(name);if(Object.hasOwn(leaves,name))return leaves[name];throw Error('Unexpected import '+name);}});
const {AiProposalPreview,AiLandingBadge}=module.exports;

const asset=(id,role,width,height)=>({schemaVersion:1,id,role,label:id,sha256:'0'.repeat(64),size:1,contentType:'image/png',pathname:role+'s/'+id+'.png',width,height});
function saved({compositing={mode:'alpha'}}={}) {
  const project=createSeedProject(),lane=defaultPresentationLane('astrid');
  lane.layers.background={...lane.layers.background,allowed:['bg-1'],default:'bg-1'};
  lane.layers.table={...lane.layers.table,allowed:['table-1'],default:'table-1'};
  project.lanes=[lane];project.layerAssets=[asset('bg-1','background',1920,1080),asset('table-1','table',1215,2074)];
  const line=project.lines.find(row=>row.dealerId==='astrid'&&row.eventId==='idle.ready');
  const variant=line.variants.find(item=>item.id===line.baselineVariantId);
  const inventory={videos:[{id:variant.videoGenerationId,label:'Vila',available:true,integrity:'verified',contentType:'video/webm',previewUrl:'/vila.webm',
    classification:{dealerId:'astrid',eventId:'idle.ready',kind:'idle',role:'standard',situation:'ready',label:'Vila',notes:'',compositing}}]};
  return {project,inventory,lane};
}
const proposal=(width,height,check)=>({id:'p-1',dataUrl:'data:image/webp;base64,AAAA',width,height,...(check===undefined?{}:{check})});
const zone=(id,ok,reason='busy',score=ok?.4:1.6)=>({zone:id,ok,score,reason,spread:ok?4:30,edges:ok?0:.2,contrast:4});
const warn=(...ids)=>({ok:false,worst:{zone:ids[0],score:1.6,reason:'busy'},zones:['box-1','box-2','box-3','box-4','box-5','box-6','box-7','dealer'].map(id=>zone(id,!ids.includes(id)))});
const frame=(html,layout)=>{const match=new RegExp(`data-layout="${layout}"[^>]*>(.*?)</div>`).exec(html);assert.ok(match,layout);return match[1];};
const style=(html,attribute)=>new RegExp(`${attribute}[^>]*style="([^"]+)"`).exec(html)?.[1]??'';

test('a background proposal renders in a desktop 16:9 and a phone 9:16 frame over the template\'s table and dealer',()=>{
  const value=saved(),html=renderToStaticMarkup(h(AiProposalPreview,{role:'background',proposal:proposal(1920,1080),project:value.project,inventory:value.inventory,laneId:value.lane.id}));
  assert.match(html,/aria-label="Dator · 16:9" data-layout="desktop"[^>]*aspect-ratio:1\.7777/);
  assert.match(html,/aria-label="Mobil · 9:16 · mittremsan" data-layout="mobile"[^>]*aspect-ratio:0\.5625/);
  for (const layout of ['desktop','mobile']) {
    const inside=frame(html,layout);
    assert.deepEqual([...inside.matchAll(/data-layer="(\w+)"/g)].map(match=>match[1]),['background','table','dealer'],'back to front, the dealer over the table');
    assert.match(inside,/<img data-layer="background" src="data:image\/webp;base64,AAAA"/);
    assert.match(inside,/data-layer="table" src="\/studio\/api\/layer-assets\/table-1"/);
    assert.match(inside,/<video data-layer="dealer" src="\/vila.webm#t=1"/);
  }
  // Desktop shows the whole background; the phone cover-crops it to the centre strip (1920 * 1920/1080 = 3413 px wide).
  assert.match(style(frame(html,'desktop'),'data-layer="background"'),/left:0%;top:0%;width:100%;height:100%/);
  assert.match(style(frame(html,'mobile'),'data-layer="background"'),/left:-108\.0\d*%;top:0%;width:316\.0\d*%;height:100%/);
  assert.doesNotMatch(html,/data-badge|Visas inte här/);
});

test('a table proposal is drawn where the server drew it, with the warned box outlined and the yellow badge',()=>{
  const value=saved(),template=filmedTableTemplate('paow');
  const html=renderToStaticMarkup(h(AiProposalPreview,{role:'table',proposal:proposal(template.canvas.width,template.canvas.height,warn('box-4')),project:value.project,inventory:value.inventory,laneId:'',dealerId:'paow'}));
  assert.match(html,/data-layout="desktop"/);assert.match(html,/aria-label="Mobil · 9:16 · 3 av 7 platser" data-layout="mobile"/);
  assert.match(html,/data-badge="warn"[^>]*>Korten kan bli svårlästa: box 4</);
  for (const layout of ['desktop','mobile']) {
    const inside=frame(html,layout);
    assert.match(inside,/<img data-layer="table" src="data:image\/webp;base64,AAAA"/);
    assert.deepEqual([...inside.matchAll(/data-mark="([\w-]+)"/g)].map(match=>match[1]),['box-4'],'only the warned box is outlined');
  }
  // No template: the composition defaults, so the desktop table is 31.640625 % of the frame wide and centred.
  assert.match(style(frame(html,'desktop'),'data-layer="table"'),/left:34\.18%;top:4%;width:31\.641%/);
  assert.match(html,/Visas inte här: dealern \(inget viloklipp\), bakgrund\./,'paow has no idle clip in the seed and there is no template background');
});

test('the badge follows the check: calm, missing or malformed checks show nothing; a background names its zone',()=>{
  const render=(role,check)=>renderToStaticMarkup(h(AiLandingBadge,{role,proposal:proposal(10,10,check)}));
  for (const check of [undefined,null,{ok:true,worst:{zone:'box-1',score:.3,reason:'busy'},zones:[zone('box-1',true)]},{ok:false,zones:'x'},{ok:false,zones:[{zone:'<b>',ok:false,reason:'busy'}]}])
    assert.equal(render('table',check),'',JSON.stringify(check));
  assert.match(render('table',warn('box-2','dealer')),/Korten kan bli svårlästa: box 2, dealerns plats/);
  assert.match(render('background',{ok:false,worst:{zone:'phone',score:2,reason:'edges'},zones:[zone('dealer',true),zone('phone',false,'edges')]}),/Bakgrunden kan bli orolig: mobilremsan/);
  // A green-screen idle is not drawn without the compositor's keying, and says so.
  const green=saved({compositing:{mode:'green-screen',threshold:.2,softness:.1,despill:0}});
  const html=renderToStaticMarkup(h(AiProposalPreview,{role:'background',proposal:proposal(1920,1080),project:green.project,inventory:green.inventory,laneId:green.lane.id}));
  assert.doesNotMatch(html,/data-layer="dealer"/);assert.match(html,/dealern \(grön skärm visas bara i scenen\)/);
});

test('a table with tableFront lies over the dealer, as in the compositor',()=>{
  const settings={...defaultCompositionSettings(),tableFront:true};
  const layout=preview.aiPreviewLayout({layout:'desktop',settings,background:{url:'/bg',width:1920,height:1080},table:{url:'/t',width:1215,height:2074},dealer:{url:'/d',video:true}});
  assert.deepEqual(layout.layers.map(layer=>layer.kind),['background','dealer','table']);
});
