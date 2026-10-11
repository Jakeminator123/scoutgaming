import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createSeedProject} from '../lib/studio-model.mjs';
import {registerLibraryLayer,validateLibraryDraft} from '../lib/layer-library-draft.mjs';
import {rebaseProjectDraft} from '../lib/project-rebase.mjs';
import {layerAssetPath} from '../../web/presentation-layers.mjs';

const require=createRequire(import.meta.url),{transformSync}=require('next/dist/build/swc');
function loadTs(fileUrl,overrides={}){
  const output=transformSync(readFileSync(fileUrl,'utf8'),{filename:fileURLToPath(fileUrl),jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
  const module={exports:{}},localRequire=createRequire(fileUrl);
  vm.runInNewContext(output.code,{module,exports:module.exports,structuredClone,URL,URLSearchParams,Request,Headers,AbortController,Error,
    window:new Proxy({},{get:(_target,key)=>globalThis.window?.[key]}),require:name=>{
      if(Object.hasOwn(overrides,name))return overrides[name];
      if(name.endsWith('.module.css'))return {__esModule:true,default:new Proxy({},{get:(_target,key)=>String(key)})};
      if(name.startsWith('./')||name.startsWith('../'))for(const suffix of ['', '.tsx','.ts','.mjs','.js']){
        const candidate=new URL(name+suffix,fileUrl),path=fileURLToPath(candidate);if(!existsSync(path))continue;
        return /\.(mjs|js|json)$/.test(path)?localRequire(path):loadTs(pathToFileURL(path),overrides);
      }
      return localRequire(name);
    }},{filename:fileURLToPath(fileUrl)});return module.exports;
}
function asset(number,role='background'){
  const row={schemaVersion:1,id:`11111111-2222-4333-8444-${String(number).padStart(12,'0')}`,role,label:role==='table'?'Grönt bord':'Kvällsbakgrund',sha256:'a'.repeat(64),size:24,contentType:'image/png',width:640,height:360};
  return {...row,pathname:layerAssetPath(row)};
}
function fixture(){
  const base=createSeedProject(),draft=structuredClone(base),remote=structuredClone(base),uploaded=asset(2);
  remote.layerAssets=[uploaded];remote.revision='uploaded-revision';return {base,draft,remote,uploaded};
}

test('library upload preserves drafts and remote updates without selecting or changing scene defaults',()=>{
  const {base,draft,remote,uploaded}=fixture();draft.lanes[0].label='Mitt scennamn';remote.events[0].label='Sparad rubrik';
  const before=structuredClone({base,draft,remote});
  const result=registerLibraryLayer(base,draft,remote,uploaded);
  assert.deepEqual(result.project.lanes,draft.lanes);assert.deepEqual(result.project.lines,draft.lines);
  assert.equal(result.project.events[0].label,'Sparad rubrik');assert.equal(result.project.revision,remote.revision);
  assert.deepEqual(result.project.layerAssets,[uploaded]);assert.deepEqual(result.conflicts,[]);
  assert.deepEqual({base,draft,remote},before);
});

test('unsaved removal and multiple remote uploads merge by asset id without resurrecting the removed file',()=>{
  const {base,draft,remote,uploaded}=fixture(),old=asset(1),concurrent=asset(3,'table');
  base.layerAssets=[old];draft.layerAssets=[];remote.layerAssets=[old,uploaded,concurrent];
  const result=registerLibraryLayer(base,draft,remote,uploaded);
  assert.deepEqual(result.project.layerAssets,[uploaded,concurrent]);assert.deepEqual(result.conflicts,[]);
  assert.deepEqual(result.project.lanes,base.lanes);
});

test('conflicting scene edits stay explicit and invalid upload receipts cannot modify the draft',()=>{
  const {base,draft,remote,uploaded}=fixture();draft.lanes[0].label='Mitt val';remote.lanes[0].label='Sparat val';
  const result=registerLibraryLayer(base,draft,remote,uploaded);
  assert.deepEqual(result.conflicts,['lanes']);assert.equal(result.project.lanes[0].label,'Mitt val');
  const before=structuredClone(draft);
  assert.throws(()=>registerLibraryLayer(base,draft,remote,{...uploaded,role:'table'}),/registrering kunde inte verifieras/);
  assert.deepEqual(draft,before);
});

test('the same library file changed in both views remains a conflict instead of silently replacing either edit',()=>{
  const {base,draft,remote,uploaded}=fixture(),old=asset(1);
  base.layerAssets=[old];draft.layerAssets=[{...old,label:'Mitt filnamn'}];remote.layerAssets=[{...old,label:'Sparat filnamn'},uploaded];
  const result=registerLibraryLayer(base,draft,remote,uploaded);
  assert.deepEqual(result.conflicts,[`layerAssets.${old.id}.label`]);
  assert.equal(result.project.layerAssets.find(row=>row.id===old.id).label,'Mitt filnamn');
  assert.ok(result.project.layerAssets.some(row=>row.id===uploaded.id));
});

test('a remote scene beginning to use a locally removed file cannot produce an invalid library merge',()=>{
  const {base,draft,remote,uploaded}=fixture(),old=asset(1);
  base.layerAssets=[old];draft.layerAssets=[];remote.layerAssets=[old,uploaded];
  remote.lanes[0].layers.background.allowed=[old.id];remote.lanes[0].layers.background.default=old.id;remote.lanes[0].layers.background.mode='image';
  const before=structuredClone(draft);
  assert.throws(()=>registerLibraryLayer(base,draft,remote,uploaded));assert.deepEqual(draft,before);
});

test('library route keeps shared authorization and renders visible usage/removal with independent role tabs',()=>{
  const source=readFileSync(new URL('../app/control/library/page.tsx',import.meta.url),'utf8');
  assert.match(source,/studioUiInitialData\(/);assert.match(source,/\/control\/library/);
  const project=createSeedProject(),table=asset(1,'table'),background=asset(2);
  project.layerAssets=[table,background];project.lanes[0].layers.table.allowed=[table.id];project.lanes[0].layers.table.default=table.id;
  const {ControlLayerLibraryPage}=loadTs(new URL('../components/control-layer-library-page.tsx',import.meta.url));
  const html=renderToStaticMarkup(React.createElement(ControlLayerLibraryPage,{initialProject:project,initialVideos:{videos:[]},initialStatus:{provider:'neon'},initialRole:'background'}));
  assert.match(html,/<h1>Bord &amp; bakgrunder<\/h1>/);assert.match(html,/role="tablist"/);
  assert.match(html,/id="library-tab-background"[^>]*aria-selected="true"/);
  assert.match(html,/id="library-panel-table"[^>]*hidden=""/);
  assert.match(html,/<h3>Hantera bord · 1 filer<\/h3>/);assert.doesNotMatch(html,/<summary>Hantera/);
  assert.match(html,new RegExp(`/control/preview\\?lane=${project.lanes[0].id}`));
  assert.match(html,/disabled="">Ta bort ur biblioteket/);assert.match(html,/Spara bibliotek/);
});

test('upload callback advances CAS baseline while preserving removal drafts and synchronously blocks save',()=>{
  const {base,draft,remote,uploaded}=fixture(),old=asset(1);base.layerAssets=[old];draft.layerAssets=[];remote.layerAssets=[old,uploaded];
  const projectRef={current:draft},updates={};let saves=0;
  const state={project:draft,projectRef,dirty:true,saving:false,conflict:false,savedJson:JSON.stringify(base),save:async()=>{saves++;},modelEdit:()=>{},
    setProject:value=>{updates.project=value;},setSavedJson:value=>{updates.saved=value;},setConflict:value=>{updates.conflict=value;},setError:()=>{},setNotice:()=>{}};
  const {ControlLayerLibraryPage}=loadTs(new URL('../components/control-layer-library-page.tsx',import.meta.url),{
    react:{useState:value=>[value,()=>{}],useRef:value=>({current:value}),useEffect:()=>{}},'./studio-session':{useStudioSession:()=>state,StudioMessages:()=>null},
  });
  const tree=ControlLayerLibraryPage({initialProject:base,initialVideos:{videos:[]},initialStatus:{provider:'neon'}});
  function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children,node.props?.primary].flat(Infinity)){const match=find(child,predicate);if(match)return match;}return null;}
  const upload=find(tree,node=>node.props?.role==='background'&&typeof node.props?.onRegistered==='function');
  assert.ok(upload);upload.props.onBusyChange(true);tree.props.primary.props.onClick();assert.equal(saves,0);
  upload.props.onRegistered(remote,uploaded.id);assert.deepEqual(updates.project.layerAssets,[uploaded]);assert.deepEqual(updates.project.lanes,draft.lanes);
  assert.equal(projectRef.current,updates.project);assert.equal(JSON.parse(updates.saved).revision,remote.revision);
  assert.deepEqual(JSON.parse(updates.saved).layerAssets,remote.layerAssets);
  upload.props.onBusyChange(false);tree.props.primary.props.onClick();assert.equal(saves,1);
  const goodDraft=projectRef.current,goodBaseline=updates.saved;
  upload.props.onRegistered({...remote,layerAssets:[]},uploaded.id);
  assert.equal(updates.conflict,true);assert.equal(projectRef.current,goodDraft);assert.equal(updates.saved,goodBaseline);
});

test('keeping local conflict choices cannot drop a layer newly used by a remote scene or clear the unresolved draft',()=>{
  const {base,draft,remote,uploaded}=fixture(),old=asset(1);
  base.layerAssets=[old];draft.layerAssets=[];remote.layerAssets=[old,uploaded];
  remote.lanes[0].layers.background.allowed=[old.id];remote.lanes[0].layers.background.default=old.id;remote.lanes[0].layers.background.mode='image';
  const localChoice=rebaseProjectDraft(base,draft,remote,'local').project;
  assert.throws(()=>validateLibraryDraft(localChoice,base,remote),/borttagen biblioteksfil/);
  const remoteChoice=rebaseProjectDraft(base,draft,remote,'remote').project;
  assert.equal(validateLibraryDraft(remoteChoice,base,remote),remoteChoice);
  const projectRef={current:draft},updates={},savedJson=JSON.stringify(base);
  const state={project:draft,projectRef,dirty:true,saving:false,conflict:true,savedJson,save:async()=>{},modelEdit:()=>{},
    setProject:value=>{updates.project=value;},setSavedJson:value=>{updates.saved=value;},setConflict:value=>{updates.conflict=value;},setError:value=>{updates.error=value;},setNotice:()=>{}};
  const {ControlLayerLibraryPage}=loadTs(new URL('../components/control-layer-library-page.tsx',import.meta.url),{
    react:{useState:value=>[value,()=>{}],useRef:value=>({current:value}),useEffect:()=>{}},'./studio-session':{useStudioSession:()=>state,StudioMessages:()=>null},
  });
  const tree=ControlLayerLibraryPage({initialProject:base,initialVideos:{videos:[]},initialStatus:{provider:'neon'}});
  function find(node){if(!node||typeof node!=='object')return null;if(typeof node.props?.onResolve==='function')return node;for(const child of [node.props?.children,node.props?.primary].flat(Infinity)){const match=find(child);if(match)return match;}return null;}
  const conflict=find(tree);assert.ok(conflict);
  conflict.props.onResolve(remote,localChoice);
  assert.equal(projectRef.current,draft);assert.equal(updates.project,undefined);assert.equal(updates.saved,undefined);assert.equal(updates.conflict,undefined);
  assert.match(updates.error,/Välj sparade val/);
  conflict.props.onResolve(remote,remoteChoice);
  assert.equal(projectRef.current,remoteChoice);assert.equal(updates.saved,JSON.stringify(remote));assert.equal(updates.conflict,false);assert.equal(updates.error,'');
});
