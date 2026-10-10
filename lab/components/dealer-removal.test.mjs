import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createSeedProject,addDealer,validateProject,DEALER_IDS} from '../lib/studio-model.mjs';
import {createRegisteredIdlePolicy} from '../../presentation-runtime/registered-idle-policy.mjs';
import {dealerRemovalStatus,removeDealerFromDraft} from '../lib/dealer-removal.mjs';

const own = () => addDealer(addDealer(createSeedProject(),'johanna','Johanna'),'elin','Elin');
test('removing a custom draft dealer deletes only her identity, bindings and own idle policy',()=>{
 const project=own(),before=structuredClone(project);
 const ownPolicy=id=>({dealerId:id,policy:createRegisteredIdlePolicy({dealerId:id,baselineVideoId:'11111111-1111-4111-8111-111111111111',durationMs:1000})});
 project.dealerIdlePolicies=[ownPolicy('johanna'),ownPolicy('elin')];project.clipLabels={'11111111-1111-4111-8111-111111111111':'Bevarad råfilm'};
 const original=structuredClone(project),next=removeDealerFromDraft(project,'johanna');
 assert.equal(validateProject(next),next);assert.equal(next.revision,project.revision);
 assert.deepEqual(next.dealers,original.dealers.filter(row=>row.id!=='johanna'));
 assert.deepEqual(next.lines,original.lines.filter(row=>row.dealerId!=='johanna'));
 assert.deepEqual(next.dealerIdlePolicies,[original.dealerIdlePolicies[1]]);
 for(const key of ['assets','triggers','events','lanes','clipLabels','idlePolicy','mediaPolicy','legacyClipPolicy','probePolicy'])assert.deepEqual(next[key],original[key],key);
 assert.deepEqual(project,original);assert.deepEqual(before.dealers.map(row=>row.id),[...DEALER_IDS,'johanna','elin']);
});
test('base dealers and missing dealers cannot be removed',()=>{
 const project=own(),before=structuredClone(project);
 for(const id of DEALER_IDS){assert.equal(dealerRemovalStatus(project,id).kind,'base');assert.throws(()=>removeDealerFromDraft(project,id),/Grunddealers/);}
 assert.equal(dealerRemovalStatus(project,'missing').kind,'missing');
 assert.throws(()=>removeDealerFromDraft(project,'missing'),/finns inte/);assert.deepEqual(project,before);
});
test('any draft presentation reference blocks removal, including a disabled dealer layer',()=>{
 for(const bind of [lane=>lane.dealers.push('johanna'),lane=>lane.layers.dealer.allowed.push('johanna'),lane=>lane.layers.dealer.default='johanna']){
  const project=own();bind(project.lanes[0]);project.lanes[0].layers.dealer.enabled=false;
  const before=structuredClone(project),status=dealerRemovalStatus(project,'johanna');
  assert.equal(status.kind,'referenced');assert.deepEqual(status.references,[{id:project.lanes[0].id,label:project.lanes[0].label}]);
  assert.match(status.message,/Mobile Phone Lane/);assert.throws(()=>removeDealerFromDraft(project,'johanna'));assert.deepEqual(project,before);
 }
});
test('removal rechecks current references and keeps newly added bindings intact',()=>{
 const project=own();assert.equal(dealerRemovalStatus(project,'johanna').kind,'ready');
 const current=structuredClone(project);current.lanes[0].dealers.push('johanna');
 assert.throws(()=>removeDealerFromDraft(current,'johanna'),/Ta först bort/);
 assert.ok(current.lines.some(row=>row.dealerId==='johanna'));
});

const require=createRequire(import.meta.url),{transformSync}=require('next/dist/build/swc');
const file=new URL('./dealer-removal.tsx',import.meta.url);
const compiled=transformSync(readFileSync(file,'utf8'),{filename:'dealer-removal.tsx',jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
function harness(){
 const state=[],effects=[];let cursor=0,pending=[];
 const react={...React,useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value;}];},
 useEffect(fn,deps){const i=cursor++,old=effects[i];if(!old||deps.some((x,j)=>x!==old[j])){effects[i]=deps;pending.push(fn);}}};
 const module={exports:{}};vm.runInNewContext(compiled.code,{module,exports:module.exports,Error,require:name=>name==='react'?react:name.includes('dealer-removal.mjs')?{dealerRemovalStatus,removeDealerFromDraft}:require(name)});
 return{render(props){cursor=0;pending=[];const tree=module.exports.DealerRemoval(props);return{tree,flush(){pending.forEach(run=>run());}};}};
}
function find(tree,type){if(!tree||typeof tree!=='object')return null;if(tree.type===type)return tree;for(const child of [tree.props?.children].flat(Infinity)){const found=find(child,type);if(found)return found;}return null;}
test('removal UI hides base dealers and explains the exact referenced presentations',()=>{
 const h=harness(),project=own();assert.equal(h.render({project,dealerId:'astrid',onEdit(){}}).tree,null);
 project.lanes[0].dealers.push('johanna');
 const {tree}=h.render({project,dealerId:'johanna',onEdit(){throw Error('must not edit');}}),html=renderToStaticMarkup(tree);
 assert.match(html,/Ta först bort dealern från presentationerna: Mobile Phone Lane/);
 assert.equal(find(tree,'button').props.disabled,true);find(tree,'button').props.onClick();
});
test('removal callback fires only after the parent renders a successfully removed draft',()=>{
 const h=harness(),removed=[];let project=own(),updates=[];
 const props=()=>({project,dealerId:'johanna',onEdit:edit=>updates.push(edit),onRemoved:(...args)=>removed.push(args)});
 let render=h.render(props());find(render.tree,'button').props.onClick();
 assert.equal(updates.length,1);render=h.render(props());render.flush();assert.deepEqual(removed,[]);
 project=updates[0](project);render=h.render(props());render.flush();
 assert.deepEqual(removed,[['johanna','astrid']]);assert.equal(render.tree,null);
 render=h.render(props());render.flush();assert.equal(removed.length,1);
});
test('locked UI never edits, and a stale updater cannot remove a newly referenced dealer',()=>{
 const h=harness();let project=own(),called=0;
 const locked=h.render({project,dealerId:'johanna',disabled:true,onEdit(){called++;}}).tree;
 find(locked,'button').props.onClick();assert.equal(called,0);
 const rendered=h.render({project,dealerId:'johanna',onEdit(edit){project.lanes[0].dealers.push('johanna');edit(project);},onRemoved(){throw Error('must not navigate');}});
 find(rendered.tree,'button').props.onClick();
 const next=h.render({project,dealerId:'johanna',onEdit(){}});next.flush();
 assert.ok(project.dealers.some(row=>row.id==='johanna'));assert.equal(find(next.tree,'button').props.disabled,true);
});
