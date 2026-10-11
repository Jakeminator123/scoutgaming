import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {defaultCompositionSettings} from '../../../web/public/composition-settings.mjs';
import {dealerPortrait} from '../lib/player-room-preview.mjs';

const require=createRequire(import.meta.url),ts=require('typescript');
const filename=fileURLToPath(new URL('../components/player/player-room-preview.tsx',import.meta.url));
const code=ts.transpileModule(readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const canvasType=Symbol('PlayerSceneCanvas');
function componentFixture(){
 const state=[];let cursor=0;
 const localRequire=specifier=>{
  if(specifier==='react')return {useState(initial){const index=cursor++;if(!(index in state))state[index]=initial;return [state[index],value=>{state[index]=value;}];}};
  if(specifier==='react/jsx-runtime')return {jsx:(type,props,key)=>({type,props,key}),jsxs:(type,props,key)=>({type,props,key})};
  if(specifier==='./player-scene-canvas')return {PlayerSceneCanvas:canvasType};
  if(specifier.includes('composition-settings.mjs'))return {defaultCompositionSettings};
  if(specifier==='@/lib/player-room-preview.mjs')return {dealerPortrait};
  throw Error('Unexpected module: '+specifier);
 };
 const module={exports:{}};
 vm.runInNewContext(code,{module,exports:module.exports,require:localRequire},{filename});
 return {...module.exports,render(component,props){cursor=0;return component(props);}};
}
function nodes(tree,predicate){
 if(Array.isArray(tree))return tree.flatMap(child=>nodes(child,predicate));
 if(!tree||typeof tree!=='object')return [];
 return [...(predicate(tree)?[tree]:[]),...nodes(tree.props?.children,predicate)];
}
const dealer={src:'/api/operators/fixture/rooms/one/preview/media/dealer',contentType:'video/mp4'};
const green={...dealer,compositing:{mode:'green-screen',threshold:.24,softness:.1,despill:.3}};
const roomProps=(media=dealer,independentLayers=false)=>({dealerId:'unknown-registered',dealerLabel:'Ny dealer',roomName:'Publicerat rum',operatorName:'Bolag',
 result:{status:'ready',preview:{independentLayers,settings:independentLayers?defaultCompositionSettings():null,media:{dealer:media,tables:[],backgrounds:[]}}}});

test('a broken Kevin portrait falls back to the exact authorized media and then a neutral placeholder',()=>{
 const fixture=componentFixture();
 const props={portrait:'/images/lobby/paow-portrait.jpg',media:dealer,label:'PAOW',className:'portrait'};
 let view=fixture.render(fixture.PreviewImage,props);
 assert.equal(view.type,'img');assert.equal(view.props.src,props.portrait);
 view.props.onError();view=fixture.render(fixture.PreviewImage,props);
 assert.equal(view.type,'video');assert.equal(view.props.src,dealer.src);assert.equal(view.props.muted,true);
 assert.equal(view.props.autoPlay,undefined);assert.equal(view.props.loop,undefined);
 const video={duration:12,currentTime:0};view.props.onLoadedMetadata({currentTarget:video});assert.equal(video.currentTime,.04);
 view.props.onError();view=fixture.render(fixture.PreviewImage,props);
 assert.equal(view.type,'div');assert.equal(view.props['aria-hidden'],'true');
 assert.equal(nodes(view,node=>node.type==='video'||node.type==='img'||node.type===canvasType).length,0);
});

test('a missing portrait for keyed media uses a still composited frame instead of exposing a green source',()=>{
 const fixture=componentFixture();
 const props={portrait:'/images/lobby/paow-portrait.jpg',media:green,label:'PAOW'};
 let view=fixture.render(fixture.PreviewImage,props);view.props.onError();view=fixture.render(fixture.PreviewImage,props);
 const canvas=nodes(view,node=>node.type===canvasType)[0];
 assert.ok(canvas);assert.equal(canvas.props.dealer,green);assert.equal(canvas.props.still,true);assert.equal(canvas.props.controls,false);
 assert.equal(canvas.props.background,null);assert.equal(canvas.props.table,null);assert.deepEqual(canvas.props.settings,defaultCompositionSettings());
 assert.equal(canvas.props.compositing,green.compositing);
 assert.equal(nodes(view,node=>node.type==='video'||node.type==='img').length,0);
 canvas.props.onFailure();view=fixture.render(fixture.PreviewImage,props);
 assert.equal(nodes(view,node=>node.type===canvasType).length,0);
});

test('mixed opaque/green-screen policy never fabricates an independently layered room preview',()=>{
 const fixture=componentFixture();
 const props=roomProps(green,false),view=fixture.render(fixture.PlayerRoomPreview,props);
 assert.equal(nodes(view,node=>node.type===canvasType).length,0);
 const fallback=nodes(view,node=>node.type===fixture.PreviewImage)[0];
 assert.ok(fallback);assert.equal(fallback.props.portrait,null);assert.equal(fallback.props.media,green);
 const thumb=fixture.render(fixture.PreviewImage,fallback.props),canvas=nodes(thumb,node=>node.type===canvasType)[0];
 assert.equal(canvas.props.still,true);assert.equal(canvas.props.background,null);assert.equal(canvas.props.table,null);
});

test('opaque room preview excludes environment layers while a supported keyed scene gets only selected layers',()=>{
 const fixture=componentFixture();
 const opaque=fixture.render(fixture.PlayerRoomPreview,roomProps());
 const fullframe=nodes(opaque,node=>node.type===canvasType)[0];
 assert.ok(fullframe);assert.equal(fullframe.props.settings,null);assert.equal(fullframe.props.table,null);assert.equal(fullframe.props.background,null);
 const props=roomProps(green,true);
 const table={id:'chosen-table',src:'/published/table',contentType:'image/png',label:'Grönt bord'};
 const back={id:'chosen-background',src:'/published/background',contentType:'image/webp',label:'Lounge'};
 props.result.preview.media.tables=[table,{...table,id:'unselected-table',src:'/other/table'}];
 props.result.preview.media.backgrounds=[back];props.tableAsset=table.id;props.background=back.id;
 const layered=fixture.render(fixture.PlayerRoomPreview,props),canvas=nodes(layered,node=>node.type===canvasType)[0];
 assert.equal(canvas.props.dealer,green);assert.equal(canvas.props.table,table);assert.equal(canvas.props.background,back);
 assert.equal(canvas.props.settings,props.result.preview.settings);assert.equal(canvas.props.compositing,green.compositing);
});
