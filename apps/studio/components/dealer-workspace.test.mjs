import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject as createBaseProject, addDealer, validateProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import { studioNavigationTabs } from '../lib/studio-navigation.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const realStudioTypes=(()=>{
  const source=readFileSync(new URL('./studio-types.ts',import.meta.url),'utf8');
  const output=transformSync(source,{filename:'studio-types.ts',jsc:{parser:{syntax:'typescript'}},module:{type:'commonjs'}});
  const module={exports:{}};vm.runInNewContext(output.code,{module,exports:module.exports,URLSearchParams,require});return module.exports;
})();
const realVoicePicker=(()=>{
  const source=readFileSync(new URL('./dealer-voice-picker.tsx',import.meta.url),'utf8');
  const output=transformSync(source,{filename:'dealer-voice-picker.tsx',jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
  const module={exports:{}};vm.runInNewContext(output.code,{module,exports:module.exports,require});return module.exports.DealerVoicePicker;
})();
const empty = () => null;
const marker = name => props => React.createElement('div', { 'data-component': name, 'data-dealer': props.dealerId }, props.slotEditor);
function harness(file, initialStates = [], overrides = {}) {
  const values = [...initialStates], refs = [], effects = []; let cursor = 0, refCursor = 0, effectCursor = 0;
  const runtimeWindow = overrides.window ?? {location:{hash:''}};
  // Keep the hand-written browser fixtures faithful to URL and History API
  // semantics, including metadata-only replaceState and cancellable events.
  if(runtimeWindow.history&&runtimeWindow.location.href){
    const address=new URL(runtimeWindow.location.href),events=new EventTarget();
    for(const key of ['href','pathname','origin','search','hash'])Object.defineProperty(runtimeWindow.location,key,{configurable:true,get:()=>address[key],set:value=>{address[key]=value;}});
    const add=runtimeWindow.addEventListener?.bind(runtimeWindow),remove=runtimeWindow.removeEventListener?.bind(runtimeWindow);
    runtimeWindow.addEventListener=(type,listener,options)=>{add?.(type,listener,options);events.addEventListener(type,listener,options);};
    runtimeWindow.removeEventListener=(type,listener,options)=>{remove?.(type,listener,options);events.removeEventListener(type,listener,options);};
    runtimeWindow.dispatchEvent=event=>events.dispatchEvent(event);
    let state=runtimeWindow.history.state??null;
    Object.defineProperty(runtimeWindow.history,'state',{configurable:true,get:()=>state});
    for(const method of ['pushState','replaceState']){
      const original=runtimeWindow.history[method].bind(runtimeWindow.history);
      runtimeWindow.history[method]=(value,title,next)=>{state=structuredClone(value);if(next!==undefined){address.href=new URL(next,address).href;original(value,title,next);}};
    }
  }
  const fakeReact = { ...React, useEffect(run,deps) { const index=effectCursor++; const previous=effects[index]; const changed=!previous||!deps||deps.some((value,key)=>value!==previous.deps?.[key]); effects[index]={...previous,run,deps,changed}; }, useCallback: callback => callback, useRef(initial) { return refs[refCursor++] ??= {current:initial}; },
    useState(initial) {
      const index = cursor++;
      if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial;
      return [values[index], next => { values[index] = typeof next === 'function' ? next(values[index]) : next; }];
    },
  };
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const output = transformSync(source, { filename: file, jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const mocks = {
    './dealer-video-surface': {DealerClipPreview: marker('dealer-preview')},
    './activity-log': { ActivityLog: marker('observation') },
    './dealer-media-library': {DealerMediaLibrary: marker('dealer-media')},
    './dealer-forge-page': {DealerMaterialCreator: marker('dealer-material')},
    './dealer-registration': {DealerRegistration: empty},
    './dealer-speech-slot-editor': {DealerSpeechSlotEditor: marker('speech-slot')},
    './dealer-speech-settings': {DealerSpeechSettings: marker('speech-settings')},
    './dealer-voice-picker': {DealerVoicePicker:realVoicePicker},
    './studio-navigation': {StudioNavigation: props => React.createElement('nav', {'aria-label':'Dealerflikar'}, studioNavigationTabs(props).map(tab => React.createElement('a', {key:tab.id,href:tab.href,'aria-current':tab.id===props.active?'page':undefined,onClick:event=>props.onNavigate(event,tab.href)},tab.label)))},
    './dealer-removal': {DealerRemoval: marker('remove-dealer')},
    './registered-idle-editor': {RegisteredIdleEditor: marker('own-idle')},
    './idle-policy-editor': { IdlePolicyEditor: marker('idle') },
    './family-video-library': { FamilyVideoLibrary: marker('families') },
    './family-video-upload': { FamilyVideoUpload: marker('upload') },
    './media-family-editor': { MediaFamilyEditor: empty },
    './probe-editor': { ProbeEditor: empty }, './project-conflict': { ProjectConflict: empty },
    './studio-types': { ...realStudioTypes, requestJson() { throw new Error('Unexpected request'); } },
    ...overrides,
  };
  if (overrides['./studio-types']) mocks['./studio-types'] = { ...realStudioTypes, ...overrides['./studio-types'] };
  const stateNames = [...source.matchAll(/const \[([^,]*),[^\]]*\]\s*=\s*useState/g)].map(match=>match[1].trim());
  const module = { exports: {} };
  vm.runInNewContext(output.code, { module, exports: module.exports, structuredClone, URL, URLSearchParams, AbortController, crypto: webcrypto,
    window: runtimeWindow,
    require: name => name === 'react' ? fakeReact : name.endsWith('.module.css') ? { __esModule: true, default: {} } : mocks[name] ?? require(name),
  });
  return { render(props) { cursor=refCursor=effectCursor=0; return Object.values(module.exports)[0](props); }, values, state(name, ...next) { const index=stateNames.indexOf(name); assert.ok(index>=0,name); if(next.length)values[index]=next[0]; return values[index]; },
    flushEffects() { const pending=effects.filter(effect=>effect.changed); for(const effect of pending)effect.cleanup?.(); for(const effect of pending){effect.changed=false;effect.cleanup=effect.run();} },
  };
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  if (node.type===realVoicePicker) return nodes(realVoicePicker(node.props),predicate);
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate), ...nodes(node.props?.slotEditor, predicate)];
}
function pressDealer(tree, label) {
  const chip = nodes(tree, node => node.type === 'button' && node.props.className === 'sg-chip' && [].concat(node.props.children).join('').includes(label))[0];
  assert.ok(chip, label);
  assert.equal(chip.props['aria-pressed'], false);
  chip.props.onClick();
  return chip;
}
const props = () => ({ initialProject: createSeedProject(), initialVideos: { videos: [] }, initialDealerId: 'astrid', connectedLane: true });













const click=link=>link.props.onClick({preventDefault(){}});





















test('idle first-frame action uses the declared own baseline, requires decoded review and does not save or enable speech',()=>{
  const dealer={id:'paow',label:'PAOW',speechProfile:{schemaVersion:2,state:'preparation',voice:null,reference:{kind:'video-frame',videoId:'old',sha256:'b'.repeat(64),offsetMs:120}}};
  const own={id:'idle-reference',dealer:'paow',available:true,bytes:100,sha256:'a'.repeat(64),previewUrl:'/idle.mp4',label:'Vald grundloop'};
  const old={...own,id:'old',sha256:'b'.repeat(64),previewUrl:'/old.mp4'};let changes=0;
  const h=harness('./dealer-speech-settings.tsx');const p={dealer,inventory:{videos:[own,old]},idleReferenceId:own.id,expanded:true,onEdit(){changes++;}};
  let tree=h.render(p),choose=nodes(tree,node=>node.type==='button'&&node.props.children==='Använd grundloopens första bildruta')[0];assert.ok(choose);
  assert.equal(nodes(tree,node=>node.type==='video')[0].props.src,old.previewUrl);choose.props.onClick();tree=h.render(p);
  let save=nodes(tree,node=>node.type==='button'&&node.props.children==='Använd talunderlag i utkastet')[0];assert.equal(save.props.disabled,true);assert.equal(changes,0);
  const player=nodes(tree,node=>node.type==='video')[0];assert.equal(player.props.src,own.previewUrl);player.props.ref.current={readyState:2,seeking:false,currentTime:0,duration:3};
  player.props.onLoadedMetadata();tree=h.render(p);nodes(tree,node=>node.type==='video')[0].props.onLoadedData();tree=h.render(p);
  save=nodes(tree,node=>node.type==='button'&&node.props.children==='Använd talunderlag i utkastet')[0];assert.equal(save.props.disabled,false);assert.equal(changes,0);
  assert.equal(nodes(tree,node=>node.type==='input'&&node.props.type==='checkbox').at(-1).props.checked,false);
  const wrong=harness('./dealer-speech-settings.tsx');assert.equal(nodes(wrong.render({...p,inventory:{videos:[{...own,dealer:'astrid'}]}}),node=>node.type==='button'&&node.props.children==='Använd grundloopens första bildruta').length,0);
  const absent=harness('./dealer-speech-settings.tsx');assert.equal(nodes(absent.render({...p,idleReferenceId:undefined}),node=>node.type==='button'&&node.props.children==='Använd grundloopens första bildruta').length,0,'no guess from upload order');
});































function ownIdleWorkspace(){
  const p=props();p.initialProject=addDealer(addDealer(p.initialProject,'paow','PAOW'),'nora','Nora');p.initialDealerId='paow';
  const policy=dealerId=>({schemaVersion:1,familyId:dealerId+'/idle.ready/ready',base:[{videoId:'11111111-1111-4111-8111-111111111111',weight:100,durationMs:3000}],variants:[]});
  p.initialProject.dealerIdlePolicies=['paow','nora'].map(dealerId=>({dealerId,policy:policy(dealerId)}));
  for(const line of p.initialProject.lines.filter(row=>['paow','nora'].includes(row.dealerId)&&row.eventId==='idle.ready'))line.variants[0].videoGenerationId=policy(line.dealerId).base[0].videoId;
  p.initialProject.dealers.find(row=>row.id==='paow').speechProfile={schemaVersion:2,state:'preparation',voice:{provider:'elevenlabs',voiceId:'own-voice',modelId:'fixture-model'},reference:null};
  return p;
}
const ownIdleNode=tree=>nodes(tree,row=>row.props?.dealerId==='paow'&&typeof row.props?.onBusyChange==='function')[0];







// Explicit active dealers used by this isolated component fixture.
function createSeedProject(){return addDealer(addDealer(createBaseProject(),'elin','Elin'),'saga','Saga');}
