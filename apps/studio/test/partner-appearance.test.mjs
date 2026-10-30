import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {defaultPresentationLane} from '../../../packages/presentation/contracts/studio-model.mjs';
import {defaultCompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {compositionLabel} from '../../../packages/navigation/control-flow.mjs';
import {ROOM_LIMIT_PRESETS} from '../../../packages/presentation/contracts/room-game-config.mjs';
const require = createRequire(import.meta.url);
const {transformSync} = require('next/dist/build/swc');
const fileUrl = new URL('../components/partner-appearance.tsx', import.meta.url);
const localRequire = createRequire(fileUrl);
const compiled = transformSync(readFileSync(fileUrl,'utf8'), {filename:fileURLToPath(fileUrl),jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
const css = {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
const pickerUrl=new URL('../components/appearance-choices.tsx',import.meta.url);
const pickerCompiled=transformSync(readFileSync(pickerUrl,'utf8'),{filename:fileURLToPath(pickerUrl),jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
const pickerModule={exports:{}};
vm.runInNewContext(pickerCompiled.code,{module:pickerModule,exports:pickerModule.exports,require:name=>name.endsWith('.css')?css:localRequire(name)});
const {AppearanceChoices}=pickerModule.exports;
const RadixDialog=localRequire('@radix-ui/react-dialog');
function load(hooks=React, fetcher) {
  const output={exports:{}};
  vm.runInNewContext(compiled.code,{module:output,exports:output.exports,fetch:fetcher,structuredClone,URLSearchParams,require:name=>name==='react'?hooks:name==='./appearance-choices'?{AppearanceChoices}:name==='./partner-appearance-preview'?{PartnerAppearancePreview:()=>null}:name.endsWith('.css')?css:localRequire(name)},{filename:fileURLToPath(fileUrl)});
  return output.exports.PartnerAppearance;
}
const Panel=load();
const initialState = (extra={}) => {
  const lane={...defaultPresentationLane('astrid'),composition:defaultCompositionSettings(),operatorAdjustable:['background','table','table.color','dealer','branding']};
  lane.layers.background={enabled:true,mode:'image',default:'bg-one',allowed:['bg-one','bg-two']};
  lane.layers.table={enabled:true,default:'table-one',allowed:['table-one','table-two'],colors:['#112233','#445566']};
  lane.layers.dealer={enabled:true,default:'astrid',allowed:['astrid','vera']};
  return {operatorId:'op-1',packageRevision:7,lanes:['mobile-phone'],branding:{color:'#112233'},adjustable:lane.operatorAdjustable,canConfigure:true,dealerChoices:{'mobile-phone':['astrid','vera']},roomDealerChoices:{'north-main':['astrid','vera'],'north-vip':['astrid']},
    presentation:{schemaVersion:1,projectRevision:'r1',assets:[],lanes:[lane]},draft:null,draftRevision:0,history:[{revision:7,publishedAt:1000,branding:{color:'#112233'}},{revision:5,publishedAt:900,branding:{color:'#445566'}}],
    rooms:[{id:'north-main',label:'Huvudrum',presentationLaneId:'mobile-phone'},{id:'north-vip',label:'VIP',presentationLaneId:'mobile-phone'}],...extra};
};
const withDraft=(extra={})=>initialState({draftRevision:2,draft:{revision:2,basePackageRevision:7,branding:{color:'#445566',background:'bg-two'},updatedAt:1000},...extra});
function walk(tree,predicate) {
  if(!tree||typeof tree!=='object')return [];
  return [...(predicate(tree)?[tree]:[]),...[tree.props?.children].flat(Infinity).flatMap(child=>walk(child,predicate))];
}
const byAction=(tree,name)=>walk(tree,node=>node.props?.['data-action']===name)[0];
// The room scope selector and review are found by their data hook or class, never by their words.
const scope=tree=>walk(tree,node=>node.type==='select'&&node.props?.['data-field']==='scope')[0];
const selects=tree=>walk(tree,node=>node.type==='select');
// The layer choices are card groups (AppearanceChoices) with the same value/onChange contract as the old selects.
const KINDS={Bakgrund:'background',Background:'background',Dealer:'dealer',Bordsgrafik:'table'};
const choice=(tree,label)=>walk(tree,node=>node.type===AppearanceChoices&&node.props.kind===(KINDS[label]??label))[0];
const textOf=node=>!node?'':typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(textOf).join(''):textOf(node.props?.children);
const reviewSection=tree=>walk(tree,node=>node.type==='section'&&node.props?.className==='review')[0];
const dialog=tree=>walk(tree,node=>node.type===RadixDialog.Root)[0];
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
const reviewed=(initial,extra={})=>({reviewToken:'a-valid-review-token',draftRevision:initial.draftRevision,packageRevision:initial.packageRevision,branding:initial.draft.branding,changes:[{roomId:null,key:'color',before:'#112233',after:'#445566'}],affectedRooms:['north-main'],...extra});
function stateful(initial,fetcher,options={}) {
  const slots=[];let cursor=0;
  const hooks={...React,useState:value=>{const index=cursor++;if(!(index in slots))slots[index]=typeof value==='function'?value():value;return [slots[index],next=>{slots[index]=typeof next==='function'?next(slots[index]):next;}];},
    useRef:value=>{const index=cursor++;if(!(index in slots))slots[index]={current:value};return slots[index];},
    useEffect:(callback,deps)=>{const index=cursor++,previous=slots[index];if(!previous||deps.some((value,i)=>value!==previous.deps[i])){previous?.cleanup?.();slots[index]={effect:true,deps,cleanup:callback()};}}};
  const Component=load(hooks,fetcher);
  const render=()=>{cursor=0;return Component({initial,apiBase:'/studio/api/partner',operatorSlug:'north',...options});};
  return {render,unmount:()=>slots.filter(slot=>slot?.effect).forEach(slot=>slot.cleanup?.())};
}
function html(initial,options={}) {return renderToStaticMarkup(React.createElement(Panel,{initial,apiBase:'/api/partner',operatorSlug:'north',...options}));}

test('saved draft is loaded separately from the live version with SV and EN workflow labels',()=>{
  const sv=html(withDraft()),en=html(withDraft(),{language:'en'});
  const tree=language=>stateful(withDraft(),()=>assert.fail('render only'),{language}).render();
  const reviewLabel=language=>textOf(byAction(tree(language),'review'));
  assert.match(reviewLabel('sv'),/\b2\b/);assert.match(reviewLabel('en'),/\b2\b/);assert.notEqual(reviewLabel('sv'),reviewLabel('en'),'the workflow follows the language');
  const status=textOf(walk(tree('sv'),node=>node.props?.role==='status')[0]);assert.match(status,/\b7\b/,'the live version is named apart from the draft');
  assert.equal(byAction(tree('sv'),'review').props.disabled,false);assert.ok(byAction(tree('en'),'save-draft'));assert.ok(byAction(tree('en'),'restore-5'),'an older version can be restored to the draft');
  assert.equal(byAction(stateful(initialState(),()=>assert.fail('render only')).render(),'review').props.disabled,true,'nothing differs from live, so there is nothing to publish');
  assert.doesNotMatch(sv,/#445566/);
  assert.doesNotMatch(sv,/<input[^>]+(?:name|logo|primary)|type="range"/);
});
test('read-only and pre-draft backends fail closed but can inspect room scope',async()=>{
  for(const initial of [initialState({canConfigure:false}),initialState({draftRevision:undefined})]){
    const {render}=stateful(initial,()=>assert.fail('unauthorized write'));
    assert.equal(byAction(render(),'save-draft').props.disabled,true);
    await byAction(render(),'save-draft').props.onClick();
    assert.equal(scope(render()).props.disabled,false);
  }
  assert.match(html(initialState({canConfigure:false})),/<fieldset[^>]*disabled=""/);
});
test('legacy scene templates explain the baked layers and the partner editor never shows table colour',()=>{
  const initial=initialState();delete initial.presentation.lanes[0].composition;
  const legacy=html(initial),legacyTree=stateful(initial,()=>assert.fail('render only')).render();
  assert.match(legacy,/data-locked="background"/);assert.match(legacy,/data-locked="table"/);
  assert.equal(picker(legacyTree,'background'),undefined);assert.equal(picker(legacyTree,'table'),undefined,'the baked layers are not offered');
  const full=html(initialState()),fullTree=stateful(initialState(),()=>assert.fail('render only')).render();
  assert.equal((full.match(/role="radiogroup"/g)||[]).length,3);
  assert.deepEqual(walk(fullTree,node=>node.type===AppearanceChoices).map(node=>node.props.kind).sort(),['background','dealer','table'],'no table colour or scene template choice');
  assert.equal(picker(fullTree,'background').props.effective,'bg-one');
});
test('locked layers and settings are quiet lines locked by Scoutgaming, five tabs, and the review names every table',()=>{
  const initial=initialState();initial.presentation.lanes[0].operatorAdjustable=['dealer','branding'];
  initial.presentation.assets=[{id:'bg-one',role:'background',label:'Salong'},{id:'table-one',role:'table',label:'Grön filt'}];
  const options={roomId:'north-main',roomState:'pending',settings:{language:'sv',limitPreset:'prive'}};
  const locked=html(initial,options),lockedTree=stateful(initial,()=>assert.fail('render only'),options).render();
  // Utseende: de två låsta lagren som lugna rader; Spelinställningar: de två publicerade inställningarna, låsta.
  const [layersQuiet,quiet]=walk(lockedTree,node=>node.props?.['data-quiet']!==undefined);
  assert.equal(walk(layersQuiet,node=>node.type==='div').length,2,'two locked layers');
  assert.match(textOf(walk(layersQuiet,node=>node.props?.['data-locked']==='background')[0]),/Salong/);assert.match(textOf(walk(layersQuiet,node=>node.props?.['data-locked']==='table')[0]),/Grön filt/);
  const game=walk(lockedTree,node=>node.props?.['data-readonly']==='spel')[0];
  assert.ok(walk(game,node=>node===quiet).length,'the settings sit in the read-only game settings tab');
  assert.equal(walk(quiet,node=>node.type==='div').length,2,'two read-only settings');assert.match(textOf(game),/Låst av Scoutgaming/);
  assert.match(textOf(walk(lockedTree,node=>node.props?.['data-readonly']==='tillganglighet')[0]),/Låst av Scoutgaming[\s\S]*Pausat/);
  assert.deepEqual(walk(lockedTree,node=>node.type===AppearanceChoices).map(node=>node.props.kind),['dealer'],'only the unlocked dealer can be chosen');
  assert.deepEqual([...locked.matchAll(/role="tab"[^>]*>([^<]+)</g)].map(match=>match[1]),['Utseende','Dealer','Spelinställningar','Tillgänglighet','Historik'],'the room tabs of Admin without Bolagets val');
  assert.doesNotMatch(locked,/bestäms av Scoutgaming/i,'Admin’s word: Låst av Scoutgaming');
  const preset=ROOM_LIMIT_PRESETS.prive,amount=value=>new Intl.NumberFormat('sv-SE').format(value);
  assert.ok(textOf(quiet).includes(`${amount(preset.min)}–${amount(preset.max)}`),'the read-only limit preset shows its published amounts');
  assert.match(locked,/data-state="paused"/);
  const {render}=stateful(initial,()=>assert.fail('inspection does not write'),{roomId:'north-main',roomState:'pending'});
  assert.match(textOf(reviewSection(render())),/\(Huvudrum, VIP\)/,'the shared draft names every company table');
  const open=html(initialState(),{roomId:'north-main',roomState:'live'});
  assert.match(open,/data-state="open"/);assert.doesNotMatch(open,/data-quiet/,'no settings shown without published settings');
  assert.doesNotMatch(open,/data-locked=/);
  const companyTree=stateful(initialState(),()=>assert.fail('render only'),{roomId:''}).render();
  assert.equal(selects(companyTree).length,0,'the company never chooses a scene template');
  assert.doesNotMatch(textOf(walk(companyTree,node=>node.type==='h1')[0]),/Huvudrum|VIP/,'the company default is not a table');
});
test('save creates a draft with full supported state, preserves hidden choices and never reports a live publication',async()=>{
  const initial=initialState({branding:{color:'#112233',dealer:'vera',roomOverrides:{'north-vip':{table:'table-two'}},name:'unused'}}),calls=[],published=[];
  const {render}=stateful(initial,async(url,request)=>{const body=JSON.parse(request.body);calls.push({url,body,request});return response({...initial,draftRevision:1,draft:{revision:1,basePackageRevision:7,branding:body.branding}});},{onSaved:receipt=>published.push(receipt)});
  choice(render(),'Bakgrund').props.onChange('bg-two');
  await byAction(render(),'save-draft').props.onClick();
  assert.deepEqual(calls[0].body,{action:'save-draft',expectedDraftRevision:0,expectedPackageRevision:7,branding:{background:'bg-two',dealer:'vera',color:'#112233',roomOverrides:{'north-vip':{table:'table-two'}}}});
  assert.equal(calls[0].request.credentials,'same-origin');assert.equal(calls[0].url,'/studio/api/partner/branding?operator=north');
  assert.equal(published.length,0);assert.equal(byAction(render(),'save-draft').props.disabled,true);assert.equal(byAction(render(),'review').props.disabled,false);
});
test('publish requires successful exact review and invalidates it immediately after editing',async()=>{
  const initial=withDraft(),calls=[];
  const {render}=stateful(initial,async(_url,request)=>{calls.push(JSON.parse(request.body));return response(reviewed(initial));});
  await byAction(render(),'publish').props.onClick();assert.equal(calls.length,0);
  await byAction(render(),'review').props.onClick();assert.equal(byAction(render(),'publish').props.disabled,false);
  choice(render(),'Bakgrund').props.onChange('');
  assert.equal(byAction(render(),'publish').props.disabled,true);await byAction(render(),'publish').props.onClick();assert.equal(calls.length,1);
});
test('published receipt advances live only once and keeps tombstone revision for the next draft',async()=>{
  const initial=withDraft(),calls=[],published=[];
  const {render}=stateful(initial,async(_url,request)=>{const body=JSON.parse(request.body);calls.push(body);
    if(body.action==='review')return response(reviewed(initial));
    if(body.action==='publish')return response({...initial,packageRevision:8,branding:initial.draft.branding,draft:null,draftRevision:3});
    return response({...initial,packageRevision:8,branding:initial.draft.branding,draftRevision:4,draft:{revision:4,basePackageRevision:8,branding:body.branding}});
  },{onSaved:value=>published.push(value)});
  await byAction(render(),'review').props.onClick();await byAction(render(),'publish').props.onClick();
  assert.deepEqual(calls[1],{action:'publish',expectedDraftRevision:2,expectedPackageRevision:7,reviewToken:'a-valid-review-token'});assert.equal(published.length,1);
  choice(render(),'Bakgrund').props.onChange('');await byAction(render(),'save-draft').props.onClick();
  assert.equal(calls[2].expectedDraftRevision,3);assert.equal(calls[2].expectedPackageRevision,8);assert.equal(published.length,1);
});
for(const status of [403,409]) test(`${status} retains local edits and blocks publication until explicit fresh reconciliation`,async()=>{
  const initial=initialState(),calls=[],latest=withDraft({draftRevision:5,draft:{revision:5,basePackageRevision:7,branding:{color:'#112233',background:'bg-one'}}});
  const {render}=stateful(initial,async(_url,request)=>{calls.push(request);return request.method==='POST'?response({},status):response(latest);});
  choice(render(),'Bakgrund').props.onChange('bg-two');await byAction(render(),'save-draft').props.onClick();
  assert.equal(choice(render(),'Bakgrund').props.value,'bg-two');assert.equal(byAction(render(),'save-draft').props.disabled,true);
  await byAction(render(),'refresh').props.onClick();assert.equal(choice(render(),'Bakgrund').props.value,'bg-two');assert.equal(byAction(render(),'publish').props.disabled,true);
  byAction(render(),'keep-local').props.onClick();assert.equal(choice(render(),'Bakgrund').props.value,'bg-two');assert.equal(byAction(render(),'save-draft').props.disabled,false);
  await byAction(render(),'save-draft').props.onClick();assert.equal(JSON.parse(calls.at(-1).body).expectedDraftRevision,5);
});
test('fresh revocation never re-enables saving and explicit loading can discard local input',async()=>{
  const latest=initialState({canConfigure:false}),{render}=stateful(initialState(),async()=>response(latest));
  choice(render(),'Bakgrund').props.onChange('bg-two');await byAction(render(),'refresh').props.onClick();
  assert.equal(byAction(render(),'keep-local').props.disabled,true);
  byAction(render(),'load-latest').props.onClick();assert.equal(choice(render(),'Bakgrund').props.value,'');assert.equal(byAction(render(),'save-draft').props.disabled,true);
});
test('restore creates a draft only, protects unsaved input and requires a new review',async()=>{
  const initial=initialState(),published=[],calls=[];
  const {render}=stateful(initial,async(_url,request)=>{calls.push(JSON.parse(request.body));return response(withDraft());},{onSaved:value=>published.push(value)});
  choice(render(),'Bakgrund').props.onChange('bg-two');await byAction(render(),'restore-5').props.onClick();assert.equal(calls.length,0);
  choice(render(),'Bakgrund').props.onChange('');await byAction(render(),'restore-5').props.onClick();
  assert.deepEqual(calls[0],{action:'restore',sourcePackageRevision:5,expectedDraftRevision:0,expectedPackageRevision:7});assert.equal(published.length,0);
  assert.equal(byAction(render(),'publish').props.disabled,true);assert.equal(choice(render(),'Bakgrund').props.value,'bg-two');
});

test('currently published history has no restore action while older revisions remain restorable',()=>{
  for(const initial of [initialState(),withDraft()]){
    const {render}=stateful(initial,()=>assert.fail('history inspection does not write'));
    assert.equal(byAction(render(),'restore-7'),undefined);
    assert.equal(byAction(render(),'restore-5').props.disabled,false);
  }
});

test('discarding unsaved local choices resets them without a request or publication callback',async()=>{
  const initial=initialState(),saved=[],dirty=[];
  const {render}=stateful(initial,()=>assert.fail('local discard must not send a request'),{onSaved:value=>saved.push(value),onDirtyChange:value=>dirty.push(value)});
  assert.equal(byAction(render(),'discard-draft'),undefined);
  choice(render(),'Bakgrund').props.onChange('bg-two');render();assert.equal(dirty.at(-1),true);
  await byAction(render(),'discard-draft').props.onClick();
  assert.equal(choice(render(),'Bakgrund').props.value,'');assert.equal(byAction(render(),'discard-draft'),undefined);
  assert.equal(dirty.at(-1),false);assert.equal(saved.length,0);assert.equal(byAction(render(),'save-draft').props.disabled,true);
});

test('local discard clears an obsolete failed-save message without retrying the request',async()=>{
  let calls=0;
  const {render}=stateful(initialState(),async()=>{calls++;return response({},413);});
  choice(render(),'Bakgrund').props.onChange('bg-two');await byAction(render(),'save-draft').props.onClick();
  assert.match(renderToStaticMarkup(render()),/role="alert"/);
  await byAction(render(),'discard-draft').props.onClick();
  assert.equal(calls,1);assert.equal(choice(render(),'Bakgrund').props.value,'');assert.doesNotMatch(renderToStaticMarkup(render()),/role="alert"/);
});

test('discarding a saved or stale company draft keeps live branding and uses the new draft revision for the next save',async()=>{
  for(const initial of [withDraft(),withDraft({packageRevision:9})]){
    const calls=[],saved=[];
    const cleared={...initial,draft:null,draftRevision:3};
    const {render}=stateful(initial,async(url,request)=>{const body=JSON.parse(request.body);calls.push({url,body});return response(body.action==='discard-draft'?cleared:{...cleared,draftRevision:4,draft:{revision:4,basePackageRevision:initial.packageRevision,branding:body.branding}});},{onSaved:value=>saved.push(value)});
    await byAction(render(),'discard-draft').props.onClick();
    assert.deepEqual(calls[0],{url:'/studio/api/partner/branding?operator=north',body:{action:'discard-draft',expectedDraftRevision:2,expectedPackageRevision:initial.packageRevision}});
    assert.equal(choice(render(),'Bakgrund').props.value,'');assert.equal(saved.length,1);assert.equal(saved[0].packageRevision,initial.packageRevision);
    assert.equal(byAction(render(),'discard-draft'),undefined);assert.equal(byAction(render(),'review').props.disabled,true);
    choice(render(),'Bakgrund').props.onChange('bg-two');await byAction(render(),'save-draft').props.onClick();
    assert.equal(calls[1].body.expectedDraftRevision,3);assert.equal(calls[1].body.expectedPackageRevision,initial.packageRevision);
  }
});

test('discard refuses foreign or changed live receipts and conflicts without losing editable values',async()=>{
  const initial=withDraft(),cleared={...initial,draft:null,draftRevision:3};
  for(const [payload,status] of [
    [{...cleared,operatorId:'foreign'},200],
    [{...cleared,packageRevision:8},200],
    [{...cleared,draftRevision:4},200],
    [{...cleared,draft:initial.draft},200],
    [{...cleared,branding:{color:'#445566'}},200],
    [{...cleared,presentation:{...initial.presentation,projectRevision:'changed'}},200],
    [{},409],[{},403],
  ]){
    const saved=[];
    const {render}=stateful(initial,async()=>response(payload,status),{onSaved:value=>saved.push(value)});
    await byAction(render(),'discard-draft').props.onClick();
    assert.equal(choice(render(),'Bakgrund').props.value,'bg-two');assert.equal(saved.length,0);
    assert.equal(byAction(render(),'discard-draft').props.disabled,true);assert.equal(byAction(render(),'review').props.disabled,true);
  }
});

test('discard sends one mutation while pending and ignores a completion after unmount',async()=>{
  const initial=withDraft(),saved=[];let finish,calls=0;
  const {render,unmount}=stateful(initial,()=>{calls++;return new Promise(resolve=>{finish=resolve;});},{onSaved:value=>saved.push(value)});
  const action=byAction(render(),'discard-draft').props.onClick;
  const pending=action();await action();assert.equal(calls,1);
  unmount();finish(response({...initial,draft:null,draftRevision:3}));await pending;assert.equal(saved.length,0);
});
test('room reset removes only that override and room presentation remains server-owned',async()=>{
  const initial=initialState({branding:{color:'#112233',roomOverrides:{'north-main':{color:'#445566'},'north-vip':{table:'table-two'}}}}),calls=[];
  const {render}=stateful(initial,async(_url,request)=>{const body=JSON.parse(request.body);calls.push(body);return response({...initial,draftRevision:1,draft:{revision:1,basePackageRevision:7,branding:body.branding}});});
  scope(render()).props.onChange({target:{value:'north-main'}});assert.equal(selects(render()).length,1,'only the scope selector, no scene template');
  byAction(render(),'reset-room').props.onClick();await byAction(render(),'save-draft').props.onClick();
  assert.deepEqual(calls[0].branding,{color:'#112233',roomOverrides:{'north-vip':{table:'table-two'}}});
});
test('synchronous lock ignores double clicks, freezes input and suppresses completion after unmount',async()=>{
  let finish;const initial=withDraft(),calls=[],published=[];
  const {render,unmount}=stateful(initial,(_url,request)=>{calls.push(JSON.parse(request.body));return new Promise(resolve=>{finish=resolve;});},{onSaved:value=>published.push(value)});
  const first=byAction(render(),'review').props.onClick();await byAction(render(),'review').props.onClick();assert.equal(calls.length,1);
  choice(render(),'Bakgrund').props.onChange('');assert.equal(choice(render(),'Bakgrund').props.value,'bg-two');
  finish(response(reviewed(initial)));await first;
  const publish=byAction(render(),'publish').props.onClick();unmount();finish(response({...initial,packageRevision:8,draft:null,draftRevision:3}));await publish;assert.equal(published.length,0);
});
test('foreign receipt and mismatched review fail closed without replacing input or publishing',async()=>{
  for(const invalid of [reviewed(withDraft(),{draftRevision:10}),reviewed(withDraft(),{branding:{color:'#112233'}})]){
    const {render}=stateful(withDraft(),async()=>response(invalid));await byAction(render(),'review').props.onClick();assert.equal(byAction(render(),'publish').props.disabled,true);assert.equal(choice(render(),'Bakgrund').props.value,'bg-two');
  }
  const {render}=stateful(initialState(),async()=>response(withDraft({operatorId:'op-foreign'})));
  choice(render(),'Bakgrund').props.onChange('bg-two');await byAction(render(),'save-draft').props.onClick();assert.equal(choice(render(),'Bakgrund').props.value,'bg-two');assert.equal(byAction(render(),'review').props.disabled,true);
});
test('stale base requires saving again before review and history is not silently published',async()=>{
  const initial=withDraft({packageRevision:9}),requests=[];
  const {render}=stateful(initial,async(_url,request)=>{requests.push(JSON.parse(request.body));return response({...initial,draftRevision:3,draft:{...initial.draft,revision:3,basePackageRevision:9}});});
  assert.equal(byAction(render(),'review').props.disabled,true);assert.equal(byAction(render(),'save-draft').props.disabled,false);
  await byAction(render(),'save-draft').props.onClick();assert.equal(requests[0].expectedPackageRevision,9);assert.equal(byAction(render(),'review').props.disabled,false);
});

test('inherited room override changes appear in review even without an immediate visual change',async()=>{
  const initial=withDraft(),{render}=stateful(initial,async()=>response(reviewed(initial,{changes:[{roomId:'north-main',key:'roomOverrides.color',before:'#112233',after:null}],affectedRooms:[]})));
  await byAction(render(),'review').props.onClick();assert.equal(byAction(render(),'publish').props.disabled,false);
  const changes=walk(reviewSection(render()),node=>node.type==='li');
  assert.equal(changes.length,1);assert.match(textOf(changes[0]),/Huvudrum/);assert.doesNotMatch(textOf(reviewSection(render())),/roomOverrides/,'the inherited key is named, not shown raw');
  assert.equal(dialog(render()).props.open,true,'a valid review opens the publish dialog');
});
// Utan tables.read: granskningen döljer spelbordsraderna men räknar dem, och
// en tom affectedRooms med tablesHidden betyder dolda spelbord, inte inga.
test('a review with only hidden table changes can publish and names the hidden tables',async()=>{
  const initial=withDraft({rooms:[],roomDealerChoices:{}});
  const {render}=stateful(initial,async()=>response(reviewed(initial,{changes:[],affectedRooms:[],hiddenTableChanges:2,tablesHidden:true})));
  await byAction(render(),'review').props.onClick();assert.equal(dialog(render()).props.open,true);
  assert.equal(byAction(render(),'publish').props.disabled,false);
  const text=textOf(reviewSection(render()));
  assert.match(text,/2 ändringar på spelborden visas inte för din roll\./);assert.doesNotMatch(text,/Inga ändringar att publicera/);
  assert.match(text,/Berörda spelbord: Spelborden visas inte för din roll/);assert.doesNotMatch(text,/inga befintliga spelbord/);
});
test('a review without changes or hidden table changes cannot publish; tables shown keep the old wording',async()=>{
  const initial=withDraft();
  const {render}=stateful(initial,async()=>response(reviewed(initial,{changes:[],affectedRooms:[],hiddenTableChanges:0})));
  await byAction(render(),'review').props.onClick();assert.equal(byAction(render(),'publish').props.disabled,true);
  const text=textOf(reviewSection(render()));
  assert.match(text,/Inga ändringar att publicera\./);assert.match(text,/Berörda spelbord: inga befintliga spelbord/);
});
test('room dealers use room-specific choices and frozen schema3 labels',()=>{
  const initial=initialState();initial.presentation={...initial.presentation,schemaVersion:3,registeredDealers:[{id:'astrid',label:'Frozen Astrid',idle:null},{id:'vera',label:'Frozen Vera',idle:null}],playback:{}};
  const {render}=stateful(initial,()=>assert.fail('no request'));scope(render()).props.onChange({target:{value:'north-vip'}});
  const options=choice(render(),'Dealer').props.choices;
  assert.equal(options.some(row=>row.id==='vera'),false);assert.equal(options.find(row=>row.id==='astrid').label,'Frozen Astrid');
});

test('oversized packages explain how to reduce scope and preserve the draft for another save',async()=>{
  const alerts={};
  for(const language of ['sv','en']){
    const {render}=stateful(initialState(),async()=>response({},413),{language});
    const label=language==='en'?'Background':'Bakgrund';
    choice(render(),label).props.onChange('bg-two');
    await byAction(render(),'save-draft').props.onClick();
    assert.equal(choice(render(),label).props.value,'bg-two');assert.equal(byAction(render(),'save-draft').props.disabled,false);assert.equal(byAction(render(),'publish').props.disabled,true);
    alerts[language]=textOf(walk(render(),node=>node.props?.role==='alert'));assert.ok(alerts[language],'the oversized package is explained');
  }
  assert.notEqual(alerts.sv,alerts.en);
});

test('parent receives real dirty state and room switches preserve all unsaved room choices',async()=>{
  const changes=[],initial=initialState(),options={roomId:'north-main',onDirtyChange:dirty=>changes.push(dirty)};
  const {render,unmount}=stateful(initial,async(_url,request)=>{const body=JSON.parse(request.body);return response({...initial,draftRevision:1,draft:{revision:1,basePackageRevision:7,branding:body.branding}});},options);
  render();assert.equal(changes.at(-1),false);
  choice(render(),'Dealer').props.onChange('vera');render();assert.equal(changes.at(-1),true);
  options.roomId='north-vip';assert.equal(choice(render(),'Dealer').props.value,'');
  options.roomId='north-main';assert.equal(choice(render(),'Dealer').props.value,'vera');
  assert.equal(scope(render()),undefined,'controlled room selector is not duplicated');
  await byAction(render(),'save-draft').props.onClick();render();assert.equal(changes.at(-1),false);
  unmount();assert.equal(changes.at(-1),false);
});


test('legacy published composition labels are translated in review, and the portal never offers a scene template choice',async()=>{
  for(const language of ['sv','en']){
    const initial=withDraft({branding:{lane:'mobile-phone',color:'#112233'}});initial.draft.branding={lane:'layer-preview',color:'#112233'};
    const lane=initial.presentation.lanes[0];
    lane.label='Mobile Phone Lane';
    initial.presentation.lanes.push({...structuredClone(lane),id:'layer-preview',label:'Layer Preview Lane'},
      {...structuredClone(lane),id:'company-custom',label:'Bolagets egen miljö'});
    initial.lanes=initial.presentation.lanes.map(row=>row.id);
    const before=JSON.stringify(initial);
    const {render}=stateful(initial,async(_url,request)=>{const body=JSON.parse(request.body);assert.equal(body.action,'review');return response(reviewed(initial,{changes:[{roomId:null,key:'lane',before:'mobile-phone',after:'layer-preview'}]}));},{language});
    assert.equal(selects(render()).length,1,'only the scope selector, no scene template');
    const standard=compositionLabel('Mobile Phone Lane',language),layers=compositionLabel('Layer Preview Lane',language);
    await byAction(render(),'review').props.onClick();
    const text=textOf(reviewSection(render()));
    assert.ok(text.includes(standard+' → '+layers),text);
    assert.doesNotMatch(text,/Mobile Phone Lane|Layer Preview Lane/);
    assert.equal(JSON.stringify(initial),before);
  }
});


test('Admin room layout shows one frozen preview and exact locked choices without opening template writes',()=>{
  const initial=initialState();initial.presentation.lanes[0].operatorAdjustable=['table.color'];
  initial.presentation.assets=[{id:'bg-one',label:'Salong'},{id:'table-one',label:'Grön filt'}];
  const content=html(initial,{roomId:'north-main',roomLayout:true});
  assert.match(content,/data-locked="background"[\s\S]*?Salong/);assert.match(content,/data-locked="table"[\s\S]*?Grön filt/);
  assert.doesNotMatch(content,/<select/,'no scope or composition selector in the room layout');
  assert.equal((content.match(/data-appearance-preview=/g)||[]).length,1);
});

test('Admin room layout saves only its room override and reports busy for the entire existing writer operation',async()=>{
  const initial=initialState({branding:{roomOverrides:{'north-vip':{background:'bg-two'}}}}),busy=[];let finish,body;
  const h=stateful(initial,async(_url,request)=>{body=JSON.parse(request.body);return new Promise(resolve=>{finish=resolve;});},{roomId:'north-main',roomLayout:true,onBusyChange:value=>busy.push(value)});
  choice(h.render(),'Bakgrund').props.onChange('bg-two');
  const saving=byAction(h.render(),'save-draft').props.onClick();
  assert.equal(busy.at(-1),true);assert.equal(byAction(h.render(),'save-draft').props.disabled,true);
  assert.deepEqual(body.branding.roomOverrides,{'north-main':{background:'bg-two'},'north-vip':{background:'bg-two'}});
  finish(response({...initial,draftRevision:1,draft:{revision:1,basePackageRevision:7,branding:body.branding}}));await saving;
  assert.equal(busy.at(-1),false);assert.equal(byAction(h.render(),'review').props.disabled,false);
});

test('central room publication leaves appearance saving scoped and never publishes from the editor',async()=>{
  const initial=initialState({branding:{roomOverrides:{'north-vip':{background:'bg-one'}}}}),calls=[],dirty=[],busy=[];
  const h=stateful(initial,async(_url,request)=>{
    const body=JSON.parse(request.body);calls.push(body);
    assert.equal(body.action,'save-draft');
    return response({...initial,draftRevision:1,draft:{revision:1,basePackageRevision:7,branding:body.branding}});
  },{roomId:'north-main',roomLayout:true,adminChoices:true,publication:'room',onDirtyChange:value=>dirty.push(value),onBusyChange:value=>busy.push(value)});
  assert.equal(byAction(h.render(),'review'),undefined);
  choice(h.render(),'Bakgrund').props.onChange('bg-two');h.render();assert.equal(dirty.at(-1),true);
  await byAction(h.render(),'save-draft').props.onClick();h.render();
  assert.equal(calls.length,1);assert.equal(calls[0].expectedPackageRevision,7);assert.equal(calls[0].expectedDraftRevision,0);
  assert.deepEqual(calls[0].branding.roomOverrides,{'north-main':{background:'bg-two'},'north-vip':{background:'bg-one'}});
  assert.equal(dirty.at(-1),false);assert.equal(busy.at(-1),false);
  assert.equal(byAction(h.render(),'review'),undefined);assert.equal(byAction(h.render(),'publish'),undefined);
});

test('another Studio operation blocks room edits without changing its saved draft or issuing writes',async()=>{
  const h=stateful(initialState(),()=>assert.fail('blocked room write'),{roomId:'north-main',roomLayout:true,disabled:true});
  choice(h.render(),'Bakgrund').props.onChange('bg-two');
  assert.equal(byAction(h.render(),'save-draft').props.disabled,true);await byAction(h.render(),'save-draft').props.onClick();
});

test('Admin room publication review stays hidden until a room draft is saved and preserves exact review and publish contracts',async()=>{
  const initial=initialState({branding:{color:'#112233',roomOverrides:{'north-vip':{background:'bg-one'}}}}),calls=[],published=[];
  let saved;
  const h=stateful(initial,async(url,request)=>{
    const body=JSON.parse(request.body);calls.push({url,body,credentials:request.credentials,method:request.method});
    if(body.action==='save-draft'){
      saved={...initial,draftRevision:1,draft:{revision:1,basePackageRevision:7,branding:body.branding}};
      return response(saved);
    }
    if(body.action==='review')return response(reviewed(saved,{changes:[{roomId:'north-main',key:'roomOverrides.background',before:'bg-one',after:'bg-two'}]}));
    assert.equal(body.action,'publish');
    return response({...saved,packageRevision:8,branding:saved.draft.branding,draft:null,draftRevision:2});
  },{roomId:'north-main',roomLayout:true,onSaved:value=>published.push(value)});
  assert.equal(dialog(h.render()).props.open,false);
  await byAction(h.render(),'publish').props.onClick();assert.equal(calls.length,0);
  choice(h.render(),'Bakgrund').props.onChange('bg-two');
  assert.equal(dialog(h.render()).props.open,false);assert.equal(byAction(h.render(),'review').props.disabled,true,'unsaved edits are saved before review');
  await byAction(h.render(),'save-draft').props.onClick();
  assert.equal(dialog(h.render()).props.open,false,'saving never opens the publish dialog');
  assert.equal(byAction(h.render(),'review').props.disabled,false);assert.equal(byAction(h.render(),'publish').props.disabled,true);
  assert.equal(published.length,0);
  await byAction(h.render(),'review').props.onClick();
  assert.equal(dialog(h.render()).props.open,true);assert.equal(byAction(h.render(),'publish').props.disabled,false);
  await byAction(h.render(),'publish').props.onClick();
  assert.deepEqual(calls.map(call=>call.body),[
    {action:'save-draft',expectedDraftRevision:0,expectedPackageRevision:7,branding:{color:'#112233',roomOverrides:{'north-main':{background:'bg-two'},'north-vip':{background:'bg-one'}}}},
    {action:'review',expectedDraftRevision:1,expectedPackageRevision:7},
    {action:'publish',expectedDraftRevision:1,expectedPackageRevision:7,reviewToken:'a-valid-review-token'},
  ]);
  for(const call of calls){assert.equal(call.url,'/studio/api/partner/branding?operator=north');assert.equal(call.credentials,'same-origin');assert.equal(call.method,'POST');}
  assert.equal(published.length,1);assert.equal(published[0].packageRevision,8);
  assert.match(textOf(walk(h.render(),node=>node.type===RadixDialog.Title)),/\b8\b/,'the receipt names the new live version');
  assert.equal(byAction(h.render(),'publish'),undefined,'the receipt replaces the publish step');
});


const picker=(tree,kind)=>walk(tree,node=>node.type===AppearanceChoices&&node.props.kind===kind)[0];
const lockedLine=(tree,kind)=>walk(tree,node=>node.props?.['data-locked']===kind)[0];
test('Admin layer choices preserve composition and room allowlists while partners stay locked',()=>{
  const initial=initialState();initial.presentation.lanes[0].operatorAdjustable=['table.color'];
  const partner=stateful(initial,()=>assert.fail('read only'),{roomId:'north-main',roomLayout:true});
  assert.equal(picker(partner.render(),'background'),undefined);assert.ok(lockedLine(partner.render(),'background'));
  const admin=stateful(initial,()=>assert.fail('read only'),{roomId:'north-main',roomLayout:true,adminChoices:true});
  for(const [kind,ids] of Object.entries({background:['bg-one','bg-two'],table:['table-one','table-two'],dealer:['astrid','vera']})){
    assert.deepEqual(Array.from(picker(admin.render(),kind).props.choices,row=>row.id),ids);
  }
  const baked=initialState();baked.presentation.lanes[0].layers.background={enabled:true,mode:'baked',default:null,allowed:[]};
  const fixed=stateful(baked,()=>assert.fail('read only'),{roomId:'north-main',roomLayout:true,adminChoices:true});
  assert.equal(picker(fixed.render(),'background'),undefined);assert.ok(lockedLine(fixed.render(),'background'));
  assert.notEqual(textOf(lockedLine(fixed.render(),'background')),textOf(lockedLine(partner.render(),'background')),'a baked background explains why it is locked');
  const vip=stateful(initialState({roomDealerChoices:{'north-main':['astrid','vera'],'north-vip':[]}}),()=>assert.fail('read only'),{roomId:'north-vip',roomLayout:true,adminChoices:true});
  assert.equal(picker(vip.render(),'dealer'),undefined);assert.ok(lockedLine(vip.render(),'dealer'),'a table without assigned dealers explains it instead of offering a choice');
});

test('Admin room overrides save the unlocked layers through the same draft contract and report the live status to the header',async()=>{
  const initial=initialState({branding:{lane:'mobile-phone',background:'bg-one'}});initial.presentation.lanes[0].operatorAdjustable=['table.color'];
  initial.presentation.assets=[{id:'bg-one',label:'Salong'},{id:'bg-two',label:'Terrass'},{id:'table-one',label:'Grön filt'}];
  const statuses=[],calls=[];
  const h=stateful(initial,async(_url,request)=>{const body=JSON.parse(request.body);calls.push(body);return response({...initial,draftRevision:1,draft:{revision:1,basePackageRevision:7,branding:body.branding}});},
    {roomId:'north-main',roomLayout:true,adminChoices:true,onStatus:value=>statuses.push(value)});
  h.render();
  assert.deepEqual(JSON.parse(JSON.stringify(statuses.at(-1))),{roomId:'north-main',laneId:'mobile-phone',packageRevision:7,draftRevision:0,draft:false,live:{background:'bg-one',dealer:'astrid',table:'table-one'},labels:{background:'Salong',dealer:'astrid',table:'Grön filt'}});
  picker(h.render(),'background').props.onChange('bg-two');picker(h.render(),'dealer').props.onChange('vera');
  assert.equal(statuses.at(-1).live.background,'bg-one','unsaved choices are not what the player meets');
  await byAction(h.render(),'save-draft').props.onClick();
  assert.deepEqual(calls[0].branding,{lane:'mobile-phone',background:'bg-one',roomOverrides:{'north-main':{background:'bg-two',dealer:'vera'}}});
  h.render();
  assert.equal(statuses.at(-1).draft,true);assert.equal(statuses.at(-1).draftRevision,1);assert.equal(statuses.at(-1).live.background,'bg-one','a saved draft is not live until published');
  h.unmount();assert.equal(statuses.at(-1),null);
});

test('changing a visual background preserves the chosen dealer, table, other rooms and company defaults',async()=>{
  const branding={lane:'mobile-phone',background:'bg-one',dealer:'astrid',table:'table-one',roomOverrides:{'north-main':{dealer:'vera',table:'table-two'},'north-vip':{background:'bg-one',dealer:'astrid'}}};
  const initial=initialState({branding}),calls=[];
  const h=stateful(initial,async(_url,request)=>{calls.push(JSON.parse(request.body));return response({...initial,draftRevision:1,draft:{revision:1,basePackageRevision:7,branding:calls[0].branding}});},{roomId:'north-main',roomLayout:true,adminChoices:true});
  picker(h.render(),'background').props.onChange('bg-two');
  assert.equal(picker(h.render(),'dealer').props.effective,'vera');assert.equal(picker(h.render(),'table').props.effective,'table-two');
  await byAction(h.render(),'save-draft').props.onClick();
  assert.deepEqual(calls[0].branding,{...branding,roomOverrides:{...branding.roomOverrides,'north-main':{dealer:'vera',table:'table-two',background:'bg-two'}}});
  assert.equal(calls[0].expectedPackageRevision,7);assert.equal(calls[0].expectedDraftRevision,0);
  assert.equal(initial.branding.roomOverrides['north-main'].background,undefined,'the read snapshot is not mutated');
});

test('Admin room appearance links to Studio without a separate geometry writer',()=>{
 const h=stateful(initialState(),()=>assert.fail('no write'),{roomId:'north-main',roomLayout:true,adminChoices:true});
 const links=walk(h.render(),node=>node.type==='a'&&node.props.href?.startsWith('/admin/scenes?'));
 assert.equal(links.length,1);const query=new URL(links[0].props.href,'https://test.invalid').searchParams;
 assert.equal(query.get('operator'),'op-1');assert.equal(query.get('table'),'north-main');
 assert.equal(byAction(h.render(),'open-scene-layout'),undefined);
});
