import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createSeedProject,addDealer} from '../../packages/presentation/contracts/studio-model.mjs';
const file=new URL('../components/dealer-media-library.tsx',import.meta.url),require=createRequire(file),{transformSync}=require('next/dist/build/swc');
const compiled=transformSync(readFileSync(file,'utf8'),{filename:file.pathname,jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
const project=addDealer(createSeedProject(),'paow','PAOW');
const video={id:'11111111-1111-4111-8111-111111111111',revision:'r1',sha256:'a'.repeat(64),dealer:'paow',source:'upload',label:'Testklipp',previewUrl:'/video',available:true,classification:{dealerId:'paow',eventId:'idle.ready',situation:'',archived:true,label:'Testklipp'}};
function harness(request){
 const state=[];let cursor=0;
 const react={...React,useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value;}];},useRef(initial){const i=cursor++;if(!(i in state))state[i]={current:initial};return state[i];},useEffect(){}};
 const module={exports:{}};
 vm.runInNewContext(compiled.code,{module,exports:module.exports,Error,require:name=>{
  if(name==='react')return react;
  if(name==='./studio-types')return{requestJson:request,studioHref:()=>'/control/clips'};
  if(name==='./media-removal-feedback')return{mediaRemovalMessage:cause=>typeof cause==='string'?cause:cause?.message??'Fel'};
  if(name==='./video-metadata-fields')return{VideoCompositingFields:()=>null,DealerFramingFields:()=>null};
  if(name==='./dealer-video-surface')return{DealerClipPreview:()=>null};
  if(name==='./dealer-file-settings')return{DealerFileSettings:()=>null};
  if(name.endsWith('.css'))return{default:{}};
  return require(name);
 }});
 return{render(props){cursor=0;return module.exports.DealerMediaLibrary(props);}};
}
function find(tree,match){if(!tree||typeof tree!=='object')return null;if(match(tree))return tree;for(const child of [tree.props?.children].flat(Infinity)){const found=find(child,match);if(found)return found;}return null;}
const button=(tree,text)=>find(tree,node=>node.type==='button'&&node.props.children===text);
const props=()=>({project,inventory:{videos:[video]},dealerId:'paow',onInventory(){},onProjectSaved(){},onLifecycleChange(){},onPendingChange(){}});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function openTrash(h,p){button(h.render(p),'Papperskorg').props.onClick();return h.render(p);}
test('permanent deletion is separate, checks before confirmation, and does not restore or delete automatically',async()=>{
 const calls=[],p=props(),h=harness(async(path,init)=>{calls.push([path,JSON.parse(init.body)]);return{allowed:true};});
 button(openTrash(h,p),'Radera permanent…').props.onClick();await settle();
 assert.deepEqual(calls,[['/api/videos/delete-check',{id:video.id,sha256:video.sha256,expectedRevision:'r1'}]]);
 const tree=h.render(p);assert.equal(button(tree,'Radera permanent').props.disabled,false);
 assert.match(renderToStaticMarkup(tree),/kan inte ångras/);
});
test('incomplete dependency coverage is visible and cannot invoke permanent delete even through a direct callback',async()=>{
 const calls=[],p=props(),h=harness(async path=>{calls.push(path);return{allowed:false,reason:'studio_media_delete_coverage_incomplete'};});
 button(openTrash(h,p),'Radera permanent…').props.onClick();await settle();
 const tree=h.render(p);assert.match(renderToStaticMarkup(tree),/studio_media_delete_coverage_incomplete/);
 const final=button(tree,'Radera permanent');assert.equal(final.props.disabled,true);final.props.onClick();await settle();
 assert.deepEqual(calls,['/api/videos/delete-check']);
});
test('confirmed delete uses current media revision, ignores double clicks, and applies only the confirmed inventory',async()=>{
 const calls=[],applied=[],saved=[],locks=[],p={...props(),onInventory:value=>applied.push(value),onProjectSaved:value=>saved.push(value),onLifecycleChange:value=>locks.push(value)};let finish;
 const h=harness(async(path,init)=>{calls.push([path,JSON.parse(init.body)]);if(path.endsWith('delete-check'))return{allowed:true};return new Promise(resolve=>{finish=resolve;});});
 button(openTrash(h,p),'Radera permanent…').props.onClick();await settle();
 const click=button(h.render(p),'Radera permanent').props.onClick;click();click();
 assert.deepEqual(applied,[]);assert.equal(calls.length,2);assert.equal(calls[1][0],'/api/videos/delete');assert.equal(calls[1][1].expectedRevision,'r1');
 const next={videos:[]},nextProject={...project,revision:'after-delete'};finish({inventory:next,project:nextProject});await settle();assert.deepEqual(applied,[next]);assert.deepEqual(saved,[nextProject]);assert.deepEqual(locks,[true,false]);
});
test('an archived dealer cannot restore one clip or upload new media before the dealer is restored',()=>{
 const p={...props(),archivedDealer:true},h=harness(async()=>{throw Error('No writes');});
 const tree=h.render(p),html=renderToStaticMarkup(tree);
 assert.equal(button(tree,'Återställ'),null);assert.doesNotMatch(html,/Välj filer att ladda upp/);assert.match(html,/Återställ dealern ovan/);
});
