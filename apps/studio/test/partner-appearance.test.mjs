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
const select=(tree,label)=>walk(tree,node=>node.type==='select'&&node.props?.['aria-label']===label)[0];
// The layer choices are card groups (AppearanceChoices) with the same value/onChange contract as the old selects.
const KINDS={Bakgrund:'background',Background:'background',Dealer:'dealer',Bordsgrafik:'table'};
const choice=(tree,label)=>walk(tree,node=>node.type===AppearanceChoices&&node.props.kind===(KINDS[label]??label))[0];
const textOf=node=>!node?'':typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(textOf).join(''):textOf(node.props?.children);
const reviewSection=tree=>walk(tree,node=>node.type==='section'&&node.props?.['aria-label']==='Granskning före publicering')[0];
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
  assert.match(sv,/Publicerad version 7 · utkast sparat/);assert.match(sv,/Publicera · 2 ändringar/);assert.doesNotMatch(sv,/#445566|Bordsfärg/);
  assert.match(en,/Save draft/);assert.match(en,/Publish · 2 changes/);assert.match(en,/Restore to draft/);
  assert.match(html(initialState()),/Inget att publicera/,'nothing differs from live, so the primary action says so');
  assert.doesNotMatch(sv,/<input[^>]+(?:name|logo|primary)|type="range"|Placering|Ordmarke/);
});
test('read-only and pre-draft backends fail closed but can inspect room scope',async()=>{
  for(const initial of [initialState({canConfigure:false}),initialState({draftRevision:undefined})]){
    const {render}=stateful(initial,()=>assert.fail('unauthorized write'));
    assert.equal(byAction(render(),'save-draft').props.disabled,true);
    await byAction(render(),'save-draft').props.onClick();
    assert.equal(select(render(),'Gäller för').props.disabled,false);
  }
  assert.match(html(initialState({canConfigure:false})),/<fieldset[^>]*disabled=""/);
});
test('legacy scene templates explain the baked layers and the partner editor never shows table colour',()=>{
  const initial=initialState();delete initial.presentation.lanes[0].composition;
  const legacy=html(initial);
  assert.match(legacy,/Scenen är en enda film/);assert.match(legacy,/data-locked="background"/);assert.match(legacy,/data-locked="table"/);assert.doesNotMatch(legacy,/aria-label="Bordsfärg"/);
  const full=html(initialState());
  assert.match(full,/role="radiogroup"[^>]*aria-label="Bakgrund"/);assert.match(full,/role="radiogroup"[^>]*aria-label="Bordsgrafik"/);assert.match(full,/role="radiogroup"[^>]*aria-label="Dealer"/);
  assert.match(full,/role="radio"[^>]*aria-checked="true"[^>]*aria-label="Bakgrund: bg-one"|aria-label="Bakgrund: bg-one"[^>]*aria-checked="true"/);
  assert.doesNotMatch(full,/aria-label="Bordsfärg"|Bordsfärg<|Scenmall/);
});
test('locked layers and settings are quiet lines set by Scoutgaming, two tabs, and the review names every table',()=>{
  const initial=initialState();initial.presentation.lanes[0].operatorAdjustable=['dealer','branding'];
  initial.presentation.assets=[{id:'bg-one',role:'background',label:'Salong'},{id:'table-one',role:'table',label:'Grön filt'}];
  const locked=html(initial,{roomId:'north-main',roomState:'pending',settings:{language:'sv',limitPreset:'prive'}});
  assert.equal((locked.match(/bestäms av Scoutgaming/g)||[]).length,4,'two locked layers and two read-only settings');
  assert.match(locked,/data-locked="background"[\s\S]*?Salong/);assert.match(locked,/data-locked="table"[\s\S]*?Grön filt/);
  assert.doesNotMatch(locked,/aria-label="Bakgrund"|aria-label="Bordsgrafik"|Låst av Scoutgaming|Inte tillgängligt i denna presentation/);
  assert.match(locked,/aria-label="Dealer"/);
  for(const label of ['Utseende','Historik'])assert.match(locked,new RegExp('role="tab"[^>]*>'+label+'<'));
  for(const label of ['Spelinställningar','Tillgänglighet'])assert.doesNotMatch(locked,new RegExp('role="tab"[^>]*>'+label+'<'));
  assert.match(locked,/Bordsspråk<\/dt><dd><span>Svenska<\/span>/);assert.match(locked,/Insatsprofil<\/dt><dd><span>Privé · 5–2\s000<\/span>/);
  assert.match(locked,/data-state="paused"[^>]*title="Pausat: syns inte i lobbyn\. Öppning begärs från Scoutgaming\."/);
  assert.match(locked,/Publicerade versioner/);
  const {render}=stateful(initial,()=>assert.fail('inspection does not write'),{roomId:'north-main',roomState:'pending'});
  assert.match(textOf(reviewSection(render())),/Utkastet är gemensamt för bolagets spelbord[^.]*\(Huvudrum, VIP\)/);
  const open=html(initialState(),{roomId:'north-main',roomState:'live'});
  assert.match(open,/data-state="open"/);assert.doesNotMatch(open,/Bordsspråk|Insatsprofil/,'no settings shown without published settings');
  assert.doesNotMatch(open,/data-locked=/);
  const company=html(initialState(),{roomId:''});
  assert.doesNotMatch(company,/Scenmall|aria-label="Scenmall"/,'the company never chooses a scene template');assert.match(company,/Bolagets standard<\/span><\/h1>/);
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
  assert.match(renderToStaticMarkup(render()),/Utkastet är för stort/);
  await byAction(render(),'discard-draft').props.onClick();
  assert.equal(calls,1);assert.equal(choice(render(),'Bakgrund').props.value,'');assert.doesNotMatch(renderToStaticMarkup(render()),/Utkastet är för stort/);
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
  select(render(),'Gäller för').props.onChange({target:{value:'north-main'}});assert.equal(select(render(),'Scenmall'),undefined);
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
  assert.match(textOf(reviewSection(render())),/Bordsfärg \(spelbordsval\)/);assert.doesNotMatch(textOf(reviewSection(render())),/roomOverrides.color/);
  assert.equal(dialog(render()).props.open,true,'a valid review opens the publish dialog');
});
test('room dealers use room-specific choices and frozen schema3 labels',()=>{
  const initial=initialState();initial.presentation={...initial.presentation,schemaVersion:3,registeredDealers:[{id:'astrid',label:'Frozen Astrid',idle:null},{id:'vera',label:'Frozen Vera',idle:null}],playback:{}};
  const {render}=stateful(initial,()=>assert.fail('no request'));select(render(),'Gäller för').props.onChange({target:{value:'north-vip'}});
  const options=choice(render(),'Dealer').props.choices;
  assert.equal(options.some(row=>row.id==='vera'),false);assert.equal(options.find(row=>row.id==='astrid').label,'Frozen Astrid');
});

test('oversized packages explain how to reduce scope and preserve the draft for another save',async()=>{
  for(const language of ['sv','en']){
    const {render}=stateful(initialState(),async()=>response({},413),{language});
    const label=language==='en'?'Background':'Bakgrund';
    choice(render(),label).props.onChange('bg-two');
    await byAction(render(),'save-draft').props.onClick();
    assert.equal(choice(render(),label).props.value,'bg-two');assert.equal(byAction(render(),'save-draft').props.disabled,false);assert.equal(byAction(render(),'publish').props.disabled,true);
    const markup=renderToStaticMarkup(render());assert.match(markup,language==='en'?/Reduce the number of table choices/:/Minska antalet spelbordsval/);assert.match(markup,language==='en'?/Published versions/:/Publicerade versioner/);
  }
});

test('parent receives real dirty state and room switches preserve all unsaved room choices',async()=>{
  const changes=[],initial=initialState(),options={roomId:'north-main',onDirtyChange:dirty=>changes.push(dirty)};
  const {render,unmount}=stateful(initial,async(_url,request)=>{const body=JSON.parse(request.body);return response({...initial,draftRevision:1,draft:{revision:1,basePackageRevision:7,branding:body.branding}});},options);
  render();assert.equal(changes.at(-1),false);
  choice(render(),'Dealer').props.onChange('vera');render();assert.equal(changes.at(-1),true);
  options.roomId='north-vip';assert.equal(choice(render(),'Dealer').props.value,'');
  options.roomId='north-main';assert.equal(choice(render(),'Dealer').props.value,'vera');
  assert.equal(select(render(),'Gäller för'),undefined,'controlled room selector is not duplicated');
  await byAction(render(),'save-draft').props.onClick();render();assert.equal(changes.at(-1),false);
  unmount();assert.equal(changes.at(-1),false);
});


test('legacy published composition labels are translated in review, and the portal never offers a scene template choice',async()=>{
  for(const language of ['sv','en']){
    const initial=withDraft({branding:{lane:'mobile-phone',color:'#112233'}});initial.draft.branding={lane:'layer-preview',color:'#112233'};
    const lane=initial.presentation.lanes[0];
    lane.label='Mobile Phone Lane';
    initial.presentation.lanes.push({...structuredClone(lane),id:'layer-preview',label:'Layer Preview Lane'},
      {...structuredClone(lane),id:'company-custom',label:'Bolagets egen sammansättning'});
    initial.lanes=initial.presentation.lanes.map(row=>row.id);
    const before=JSON.stringify(initial);
    const {render}=stateful(initial,async(_url,request)=>{const body=JSON.parse(request.body);assert.equal(body.action,'review');return response(reviewed(initial,{changes:[{roomId:null,key:'lane',before:'mobile-phone',after:'layer-preview'}]}));},{language});
    assert.equal(select(render(),language==='en'?'Scene template':'Scenmall'),undefined);
    const standard=language==='en'?'Standard composition':'Standardsammansättning';
    const layers=language==='en'?'Layer composition':'Lagersammansättning';
    await byAction(render(),'review').props.onClick();
    const text=textOf(walk(render(),node=>node.type==='section'&&node.props?.['aria-label']===(language==='en'?'Review before publishing':'Granskning före publicering'))[0]);
    assert.ok(text.includes(standard+' → '+layers),text);
    assert.doesNotMatch(text,/Mobile Phone Lane|Layer Preview Lane/);
    assert.equal(JSON.stringify(initial),before);
  }
});


test('Admin room layout shows one frozen preview and exact locked choices without opening template writes',()=>{
  const initial=initialState();initial.presentation.lanes[0].operatorAdjustable=['table.color'];
  initial.presentation.assets=[{id:'bg-one',label:'Salong'},{id:'table-one',label:'Grön filt'}];
  const content=html(initial,{roomId:'north-main',roomLayout:true});
  assert.match(content,/Salong/);assert.match(content,/Grön filt/);assert.match(content,/låst i publicerat paket/);
  assert.doesNotMatch(content,/Inte tillgängligt i denna presentation|aria-label="Gäller för"|aria-label="Sammansättning"/);
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
  assert.match(textOf(walk(h.render(),node=>node.type===RadixDialog.Title)),/Publicerat · version 8/);
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
  assert.equal(picker(fixed.render(),'background'),undefined);assert.match(textOf(lockedLine(fixed.render(),'background')),/inbakad i dealerfilmen/);
  const vip=stateful(initialState({roomDealerChoices:{'north-main':['astrid','vera'],'north-vip':[]}}),()=>assert.fail('read only'),{roomId:'north-vip',roomLayout:true,adminChoices:true});
  assert.equal(picker(vip.render(),'dealer'),undefined);assert.match(textOf(lockedLine(vip.render(),'dealer')),/ingen dealer är tilldelad/);
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
