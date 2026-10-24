import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {defaultPresentationLane} from '../../../packages/presentation/contracts/studio-model.mjs';
import {defaultCompositionSettings,defaultBlackjackTableGeometry} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {adjustPublishedMobilePlacement} from '../../../packages/presentation/contracts/published-mobile-placement.mjs';
const require = createRequire(import.meta.url);
const {transformSync} = require('next/dist/build/swc');
const fileUrl = new URL('../components/partner-appearance.tsx', import.meta.url);
const localRequire = createRequire(fileUrl);
const compiled = transformSync(readFileSync(fileUrl,'utf8'), {filename:fileURLToPath(fileUrl),jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
const css = {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
const pickerUrl=new URL('../components/appearance-layer-picker.tsx',import.meta.url);
const pickerCompiled=transformSync(readFileSync(pickerUrl,'utf8'),{filename:fileURLToPath(pickerUrl),jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
const pickerModule={exports:{}};
vm.runInNewContext(pickerCompiled.code,{module:pickerModule,exports:pickerModule.exports,require:name=>name.endsWith('.css')?css:localRequire(name)});
const {AppearanceLayerPicker}=pickerModule.exports;
function load(hooks=React, fetcher) {
  const output={exports:{}};
  vm.runInNewContext(compiled.code,{module:output,exports:output.exports,fetch:fetcher,require:name=>name==='react'?hooks:name==='./appearance-layer-picker'?{AppearanceLayerPicker}:name==='./partner-appearance-preview'?{PartnerAppearancePreview:()=>null}:name.endsWith('.css')?css:localRequire(name)},{filename:fileURLToPath(fileUrl)});
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
const withDraft=(extra={})=>initialState({draftRevision:2,draft:{revision:2,basePackageRevision:7,branding:{color:'#445566'},updatedAt:1000},...extra});
function walk(tree,predicate) {
  if(!tree||typeof tree!=='object')return [];
  return [...(predicate(tree)?[tree]:[]),...[tree.props?.children].flat(Infinity).flatMap(child=>walk(child,predicate))];
}
const byAction=(tree,name)=>walk(tree,node=>node.props?.['data-action']===name)[0];
const select=(tree,label)=>walk(tree,node=>node.type==='select'&&node.props?.['aria-label']===label)[0];
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
  assert.match(sv,/Publicerad version.*7/);assert.match(sv,/Sparat utkast 2/);assert.match(sv,/#445566/);
  assert.match(en,/Save draft/);assert.match(en,/Review publication/);assert.match(en,/Restore to draft/);
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
test('full-frame and section views only expose effective supported adjustments',()=>{
  const initial=initialState();delete initial.presentation.lanes[0].composition;
  assert.match(html(initial,{section:'design'}),/Äldre sammansättning/);assert.match(html(initial,{section:'design'}),/gröna bakgrund tas alltid bort/);assert.doesNotMatch(html(initial,{section:'design'}),/aria-label="Bordsfärg"/);
  const background=html(initialState(),{section:'background'});
  assert.match(background,/aria-label="Bakgrund"/);assert.doesNotMatch(background,/aria-label="Bord"|aria-label="Dealer"|aria-label="Bordsfärg"/);
});
test('save creates a draft with full supported state, preserves hidden choices and never reports a live publication',async()=>{
  const initial=initialState({branding:{color:'#112233',dealer:'vera',roomOverrides:{'north-vip':{table:'table-two'}},name:'unused'}}),calls=[],published=[];
  const {render}=stateful(initial,async(url,request)=>{const body=JSON.parse(request.body);calls.push({url,body,request});return response({...initial,draftRevision:1,draft:{revision:1,basePackageRevision:7,branding:body.branding}});},{section:'background',onSaved:receipt=>published.push(receipt)});
  select(render(),'Bakgrund').props.onChange({target:{value:'bg-two'}});
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
  select(render(),'Bordsfärg').props.onChange({target:{value:'#112233'}});
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
  select(render(),'Bordsfärg').props.onChange({target:{value:'#112233'}});await byAction(render(),'save-draft').props.onClick();
  assert.equal(calls[2].expectedDraftRevision,3);assert.equal(calls[2].expectedPackageRevision,8);assert.equal(published.length,1);
});
for(const status of [403,409]) test(`${status} retains local edits and blocks publication until explicit fresh reconciliation`,async()=>{
  const initial=initialState(),calls=[],latest=withDraft({draftRevision:5,draft:{revision:5,basePackageRevision:7,branding:{color:'#112233',background:'bg-one'}}});
  const {render}=stateful(initial,async(_url,request)=>{calls.push(request);return request.method==='POST'?response({},status):response(latest);});
  select(render(),'Bordsfärg').props.onChange({target:{value:'#445566'}});await byAction(render(),'save-draft').props.onClick();
  assert.equal(select(render(),'Bordsfärg').props.value,'#445566');assert.equal(byAction(render(),'save-draft').props.disabled,true);
  await byAction(render(),'refresh').props.onClick();assert.equal(select(render(),'Bordsfärg').props.value,'#445566');assert.equal(byAction(render(),'publish').props.disabled,true);
  byAction(render(),'keep-local').props.onClick();assert.equal(select(render(),'Bordsfärg').props.value,'#445566');assert.equal(byAction(render(),'save-draft').props.disabled,false);
  await byAction(render(),'save-draft').props.onClick();assert.equal(JSON.parse(calls.at(-1).body).expectedDraftRevision,5);
});
test('fresh revocation never re-enables saving and explicit loading can discard local input',async()=>{
  const latest=initialState({canConfigure:false}),{render}=stateful(initialState(),async()=>response(latest));
  select(render(),'Bordsfärg').props.onChange({target:{value:'#445566'}});await byAction(render(),'refresh').props.onClick();
  assert.equal(byAction(render(),'keep-local').props.disabled,true);
  byAction(render(),'load-latest').props.onClick();assert.equal(select(render(),'Bordsfärg').props.value,'#112233');assert.equal(byAction(render(),'save-draft').props.disabled,true);
});
test('restore creates a draft only, protects unsaved input and requires a new review',async()=>{
  const initial=initialState(),published=[],calls=[];
  const {render}=stateful(initial,async(_url,request)=>{calls.push(JSON.parse(request.body));return response(withDraft());},{onSaved:value=>published.push(value)});
  select(render(),'Bordsfärg').props.onChange({target:{value:'#445566'}});await byAction(render(),'restore-5').props.onClick();assert.equal(calls.length,0);
  select(render(),'Bordsfärg').props.onChange({target:{value:'#112233'}});await byAction(render(),'restore-5').props.onClick();
  assert.deepEqual(calls[0],{action:'restore',sourcePackageRevision:5,expectedDraftRevision:0,expectedPackageRevision:7});assert.equal(published.length,0);
  assert.equal(byAction(render(),'publish').props.disabled,true);assert.equal(select(render(),'Bordsfärg').props.value,'#445566');
});
test('room reset removes only that override and room presentation remains server-owned',async()=>{
  const initial=initialState({branding:{color:'#112233',roomOverrides:{'north-main':{color:'#445566'},'north-vip':{table:'table-two'}}}}),calls=[];
  const {render}=stateful(initial,async(_url,request)=>{const body=JSON.parse(request.body);calls.push(body);return response({...initial,draftRevision:1,draft:{revision:1,basePackageRevision:7,branding:body.branding}});});
  select(render(),'Gäller för').props.onChange({target:{value:'north-main'}});assert.equal(select(render(),'Sammansättning').props.disabled,true);
  byAction(render(),'reset-room').props.onClick();await byAction(render(),'save-draft').props.onClick();
  assert.deepEqual(calls[0].branding,{color:'#112233',roomOverrides:{'north-vip':{table:'table-two'}}});
});
test('synchronous lock ignores double clicks, freezes input and suppresses completion after unmount',async()=>{
  let finish;const initial=withDraft(),calls=[],published=[];
  const {render,unmount}=stateful(initial,(_url,request)=>{calls.push(JSON.parse(request.body));return new Promise(resolve=>{finish=resolve;});},{onSaved:value=>published.push(value)});
  const first=byAction(render(),'review').props.onClick();await byAction(render(),'review').props.onClick();assert.equal(calls.length,1);
  select(render(),'Bordsfärg').props.onChange({target:{value:'#112233'}});assert.equal(select(render(),'Bordsfärg').props.value,'#445566');
  finish(response(reviewed(initial)));await first;
  const publish=byAction(render(),'publish').props.onClick();unmount();finish(response({...initial,packageRevision:8,draft:null,draftRevision:3}));await publish;assert.equal(published.length,0);
});
test('foreign receipt and mismatched review fail closed without replacing input or publishing',async()=>{
  for(const invalid of [reviewed(withDraft(),{draftRevision:10}),reviewed(withDraft(),{branding:{color:'#112233'}})]){
    const {render}=stateful(withDraft(),async()=>response(invalid));await byAction(render(),'review').props.onClick();assert.equal(byAction(render(),'publish').props.disabled,true);assert.equal(select(render(),'Bordsfärg').props.value,'#445566');
  }
  const {render}=stateful(initialState(),async()=>response(withDraft({operatorId:'op-foreign'})));
  select(render(),'Bordsfärg').props.onChange({target:{value:'#445566'}});await byAction(render(),'save-draft').props.onClick();assert.equal(select(render(),'Bordsfärg').props.value,'#445566');assert.equal(byAction(render(),'review').props.disabled,true);
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
  assert.match(renderToStaticMarkup(render()),/Bordsfärg \(rumsval\)/);assert.doesNotMatch(renderToStaticMarkup(render()),/roomOverrides.color/);
});
test('room dealers use room-specific choices and frozen schema3 labels',()=>{
  const initial=initialState();initial.presentation={...initial.presentation,schemaVersion:3,registeredDealers:[{id:'astrid',label:'Frozen Astrid',idle:null},{id:'vera',label:'Frozen Vera',idle:null}],playback:{}};
  const {render}=stateful(initial,()=>assert.fail('no request'));select(render(),'Gäller för').props.onChange({target:{value:'north-vip'}});
  const options=select(render(),'Dealer').props.children.flat(Infinity).filter(Boolean);
  assert.equal(options.some(row=>row.props?.value==='vera'),false);assert.equal(options.find(row=>row.props?.value==='astrid').props.children,'Frozen Astrid');
});

test('oversized packages explain how to reduce scope and preserve the draft for another save',async()=>{
  for(const language of ['sv','en']){
    const {render}=stateful(initialState(),async()=>response({},413),{language});
    const label=language==='en'?'Table colour':'Bordsfärg';
    select(render(),label).props.onChange({target:{value:'#445566'}});
    await byAction(render(),'save-draft').props.onClick();
    assert.equal(select(render(),label).props.value,'#445566');assert.equal(byAction(render(),'save-draft').props.disabled,false);assert.equal(byAction(render(),'publish').props.disabled,true);
    const markup=renderToStaticMarkup(render());assert.match(markup,language==='en'?/Reduce the number of room overrides/:/Minska antalet rumsundantag/);assert.match(markup,language==='en'?/20 latest published/:/20 senaste publicerade/);
  }
});

test('parent receives real dirty state and room switches preserve all unsaved room choices',async()=>{
  const changes=[],initial=initialState(),options={roomId:'north-main',onDirtyChange:dirty=>changes.push(dirty)};
  const {render,unmount}=stateful(initial,async(_url,request)=>{const body=JSON.parse(request.body);return response({...initial,draftRevision:1,draft:{revision:1,basePackageRevision:7,branding:body.branding}});},options);
  render();assert.equal(changes.at(-1),false);
  select(render(),'Dealer').props.onChange({target:{value:'vera'}});render();assert.equal(changes.at(-1),true);
  options.roomId='north-vip';assert.equal(select(render(),'Dealer').props.value,'');
  options.roomId='north-main';assert.equal(select(render(),'Dealer').props.value,'vera');
  assert.equal(select(render(),'Gäller för'),undefined,'controlled room selector is not duplicated');
  await byAction(render(),'save-draft').props.onClick();render();assert.equal(changes.at(-1),false);
  unmount();assert.equal(changes.at(-1),false);
});


test('legacy published composition labels are translated in selection and review without changing saved identities',async()=>{
  for(const language of ['sv','en']){
    const initial=initialState({branding:{lane:'mobile-phone',color:'#112233'}});
    const lane=initial.presentation.lanes[0];
    lane.label='Mobile Phone Lane';
    initial.presentation.lanes.push({...structuredClone(lane),id:'layer-preview',label:'Layer Preview Lane'},
      {...structuredClone(lane),id:'company-custom',label:'Bolagets egen sammansättning'});
    initial.lanes=initial.presentation.lanes.map(row=>row.id);
    const before=JSON.stringify(initial),calls=[];
    let saved;
    const {render}=stateful(initial,async(_url,request)=>{
      const body=JSON.parse(request.body);calls.push(body);
      if(body.action==='save-draft'){
        saved={...initial,draftRevision:1,draft:{revision:1,basePackageRevision:7,branding:body.branding}};
        return response(saved);
      }
      assert.equal(body.action,'review');
      return response(reviewed(saved,{changes:[{roomId:null,key:'lane',before:'mobile-phone',after:'layer-preview'}]}));
    },{language});
    const label=language==='en'?'Composition':'Sammansättning';
    const standard=language==='en'?'Standard composition':'Standardsammansättning';
    const layers=language==='en'?'Layer composition':'Lagersammansättning';
    const options=walk(select(render(),label),node=>node.type==='option');
    assert.deepEqual(options.map(row=>[row.props.value,row.props.children]),[
      ['mobile-phone',standard],['layer-preview',layers],['company-custom','Bolagets egen sammansättning'],
    ]);
    select(render(),label).props.onChange({target:{value:'layer-preview'}});
    await byAction(render(),'save-draft').props.onClick();
    assert.equal(calls[0].branding.lane,'layer-preview');
    assert.equal(calls[0].expectedPackageRevision,7);
    await byAction(render(),'review').props.onClick();
    const markup=renderToStaticMarkup(render());
    assert.ok(markup.includes(standard+' → '+layers));
    assert.doesNotMatch(markup,/Mobile Phone Lane|Layer Preview Lane/);
    assert.equal(select(render(),label).props.value,'layer-preview');
    assert.equal(JSON.stringify(initial),before);
  }
});


test('Admin room layout shows one frozen preview and exact locked choices without opening template writes',()=>{
  const initial=initialState();initial.presentation.lanes[0].operatorAdjustable=['table.color'];
  initial.presentation.assets=[{id:'bg-one',label:'Salong'},{id:'table-one',label:'Grön filt'}];
  const content=html(initial,{roomId:'north-main',roomLayout:true});
  assert.match(content,/Salong/);assert.match(content,/Grön filt/);assert.match(content,/Låst i publicerat paket/);
  assert.doesNotMatch(content,/Inte tillgängligt i denna presentation|aria-label="Gäller för"|aria-label="Sammansättning"/);
  assert.equal((content.match(/data-appearance-preview=/g)||[]).length,1);
});

test('Admin room layout saves only its room override and reports busy for the entire existing writer operation',async()=>{
  const initial=initialState({branding:{roomOverrides:{'north-vip':{background:'bg-two'}}}}),busy=[];let finish,body;
  const h=stateful(initial,async(_url,request)=>{body=JSON.parse(request.body);return new Promise(resolve=>{finish=resolve;});},{roomId:'north-main',roomLayout:true,onBusyChange:value=>busy.push(value)});
  select(h.render(),'Bakgrund').props.onChange({target:{value:'bg-two'}});
  const saving=byAction(h.render(),'save-draft').props.onClick();
  assert.equal(busy.at(-1),true);assert.equal(byAction(h.render(),'save-draft').props.disabled,true);
  assert.deepEqual(body.branding.roomOverrides,{'north-main':{background:'bg-two'},'north-vip':{background:'bg-two'}});
  finish(response({...initial,draftRevision:1,draft:{revision:1,basePackageRevision:7,branding:body.branding}}));await saving;
  assert.equal(busy.at(-1),false);assert.equal(byAction(h.render(),'review').props.disabled,false);
});

test('another Studio operation blocks room edits without changing its saved draft or issuing writes',async()=>{
  const h=stateful(initialState(),()=>assert.fail('blocked room write'),{roomId:'north-main',roomLayout:true,disabled:true});
  select(h.render(),'Bakgrund').props.onChange({target:{value:'bg-two'}});
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
  const reviewSection=tree=>walk(tree,node=>node.type==='section'&&node.props?.['aria-label']==='Granskning före publicering')[0];
  assert.equal(reviewSection(h.render()).props.hidden,true);
  await byAction(h.render(),'publish').props.onClick();assert.equal(calls.length,0);
  select(h.render(),'Bakgrund').props.onChange({target:{value:'bg-two'}});
  assert.equal(reviewSection(h.render()).props.hidden,true);
  await byAction(h.render(),'save-draft').props.onClick();
  assert.notEqual(reviewSection(h.render()).props.hidden,true);
  assert.equal(byAction(h.render(),'review').props.disabled,false);assert.equal(byAction(h.render(),'publish').props.disabled,true);
  assert.equal(published.length,0);
  await byAction(h.render(),'review').props.onClick();
  assert.equal(byAction(h.render(),'publish').props.disabled,false);
  await byAction(h.render(),'publish').props.onClick();
  assert.deepEqual(calls.map(call=>call.body),[
    {action:'save-draft',expectedDraftRevision:0,expectedPackageRevision:7,branding:{color:'#112233',roomOverrides:{'north-main':{background:'bg-two'},'north-vip':{background:'bg-one'}}}},
    {action:'review',expectedDraftRevision:1,expectedPackageRevision:7},
    {action:'publish',expectedDraftRevision:1,expectedPackageRevision:7,reviewToken:'a-valid-review-token'},
  ]);
  for(const call of calls){assert.equal(call.url,'/studio/api/partner/branding?operator=north');assert.equal(call.credentials,'same-origin');assert.equal(call.method,'POST');}
  assert.equal(published.length,1);assert.equal(published[0].packageRevision,8);
  assert.equal(reviewSection(h.render()).props.hidden,true);
});


const picker=(tree,kind)=>walk(tree,node=>node.type===AppearanceLayerPicker&&node.props.kind===kind)[0];
test('Admin layer choices preserve composition and room allowlists while partners stay locked',()=>{
  const initial=initialState();initial.presentation.lanes[0].operatorAdjustable=['table.color'];
  const partner=stateful(initial,()=>assert.fail('read only'),{roomId:'north-main',roomLayout:true});
  assert.equal(select(partner.render(),'Bakgrund'),undefined);
  const admin=stateful(initial,()=>assert.fail('read only'),{roomId:'north-main',roomLayout:true,adminChoices:true});
  for(const [kind,ids] of Object.entries({background:['bg-one','bg-two'],table:['table-one','table-two'],dealer:['astrid','vera']})){
    assert.equal(picker(admin.render(),kind).props.locked,false);
    assert.deepEqual(Array.from(picker(admin.render(),kind).props.choices,row=>row.id),ids);
  }
  const baked=initialState();baked.presentation.lanes[0].layers.background={enabled:true,mode:'baked',default:null,allowed:[]};
  const fixed=stateful(baked,()=>assert.fail('read only'),{roomId:'north-main',roomLayout:true,adminChoices:true});
  assert.equal(picker(fixed.render(),'background').props.locked,true);
  assert.equal(picker(fixed.render(),'background').props.choices.length,0);
  const vip=stateful(initialState({roomDealerChoices:{'north-main':['astrid','vera'],'north-vip':[]}}),()=>assert.fail('read only'),{roomId:'north-vip',roomLayout:true,adminChoices:true});
  assert.equal(picker(vip.render(),'dealer').props.locked,true);
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

const mobileTable='00000000-0000-4000-8000-000000000041';
function mobileState(extra={}) {
  const initial=initialState(extra),lane=initial.presentation.lanes[0];
  initial.rooms.forEach(row=>{row.game='blackjack';});
  lane.layers.table={enabled:true,default:mobileTable,allowed:[mobileTable]};
  lane.composition.blackjackTables=[defaultBlackjackTableGeometry(mobileTable)];
  lane.composition.blackjackTables[0].mobile.betMode='under-cards';
  initial.presentation.assets=[{id:mobileTable,role:'table',label:'Oak',width:1672,height:941}];
  return initial;
}
const mobileOptions={roomId:'north-main',roomLayout:true,adminChoices:true};
const mobilePreview=tree=>walk(tree,node=>Boolean(node.props?.onMedia&&node.props?.server))[0];
const mobileInput=tree=>walk(tree,node=>node.type==='input'&&node.props['aria-label']==='Mobilplacering lodrätt i procent')[0];
function supplyMobilePreview(h,initial,extra={}) {
  mobilePreview(h.render()).props.onMedia({operatorSlug:'north',roomId:'north-main',packageRevision:initial.packageRevision,dealer:{id:'astrid'},independentLayers:true,
    settings:structuredClone(initial.presentation.lanes[0].composition),media:{tables:[{id:mobileTable}]},...extra});
}
function mobileReceipt(initial,offsetY=-.07) {
  const presentation=structuredClone(initial.presentation);
  presentation.lanes[0].composition=adjustPublishedMobilePlacement(presentation.lanes[0].composition,mobileTable,offsetY);
  return {ok:true,operatorId:initial.operatorId,packageRevision:initial.packageRevision+1,presentation,adjusted:{roomId:'north-main',tableId:mobileTable,offsetY}};
}
function chooseMobile(h,initial) {
  byAction(h.render(),'open-mobile-placement').props.onClick();
  supplyMobilePreview(h,initial);mobileInput(h.render()).props.onChange({target:{valueAsNumber:-7}});
}

test('published mobile placement is confined to eligible Admin blackjack rooms and respects local dirty state',()=>{
  for(const options of [{...mobileOptions,adminChoices:false},{...mobileOptions,roomLayout:false}]){
    const h=stateful(mobileState(),()=>assert.fail('no write'),options);assert.equal(byAction(h.render(),'open-mobile-placement'),undefined);
  }
  for(const mutate of [state=>state.rooms[0].game='roulette',state=>state.presentation.lanes[0].composition.blackjackTables[0].mobile.autoScale={landing:false,cardSize:false,chips:false},state=>state.presentation.lanes[0].composition.blackjackTables[0].mobile.anchors={},state=>delete state.presentation.lanes[0].composition.blackjackTables[0].mobile.betMode]){
    const initial=mobileState();mutate(initial);const h=stateful(initial,()=>assert.fail('no write'),mobileOptions);
    assert.equal(byAction(h.render(),'open-mobile-placement'),undefined);
  }
  for(const extra of [{canConfigure:false},{}]){
    const h=stateful(mobileState(extra),()=>assert.fail('no write'),mobileOptions);
    if(extra.canConfigure!==false)picker(h.render(),'background').props.onChange('bg-two');
    assert.equal(byAction(h.render(),'open-mobile-placement').props.disabled,true);
    byAction(h.render(),'open-mobile-placement').props.onClick();assert.equal(mobileInput(h.render()),undefined);
  }
});

test('mobile publication uses published choices, preserves saved material draft and confirms with a separate GET',async()=>{
  const draft={revision:3,basePackageRevision:7,branding:{dealer:'vera',table:mobileTable},updatedAt:1000};
  const initial=mobileState({draft,draftRevision:3}),original=structuredClone(initial),receipt=mobileReceipt(initial),calls=[],published=[],busy=[];
  let finishRead;
  const h=stateful(initial,async(url,request)=>{
    calls.push({url,request});if(request.method==='POST')return response(receipt);
    return new Promise(resolve=>{finishRead=resolve;});
  },{...mobileOptions,onSaved:value=>published.push(value),onBusyChange:value=>busy.push(value)});
  chooseMobile(h,initial);
  assert.deepEqual(JSON.parse(JSON.stringify(mobilePreview(h.render()).props.branding)),initial.branding);
  assert.equal(byAction(h.render(),'save-draft').props.disabled,true,'the calibration never submits material choices');
  const saving=byAction(h.render(),'publish-mobile-placement').props.onClick();
  await byAction(h.render(),'publish-mobile-placement').props.onClick();
  await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,2);assert.equal(published.length,0);assert.equal(busy.at(-1),true);
  assert.equal(calls[0].url,'/studio/api/admin/operator-package');assert.equal(calls[0].request.credentials,'same-origin');
  assert.deepEqual(JSON.parse(calls[0].request.body),{action:'adjust-mobile-placement',operatorId:'op-1',roomId:'north-main',tableId:mobileTable,expectedPackageRevision:7,offsetY:-.07});
  assert.equal(calls[1].url,'/studio/api/partner/branding?operator=north');assert.equal(calls[1].request.cache,'no-store');
  finishRead(response({...initial,packageRevision:8,presentation:receipt.presentation}));await saving;
  assert.equal(published.length,1);assert.deepEqual(published[0].draft,draft);assert.equal(published[0].packageRevision,8);assert.equal(busy.at(-1),false);
  assert.equal(mobileInput(h.render()),undefined);assert.equal(picker(h.render(),'dealer').props.effective,'vera','saved draft remains editable and is not published');
  assert.deepEqual(initial,original,'all original frozen data stays immutable');
});

test('mobile publication blocks on mismatched, missing or out-of-range preview without sending a request',async()=>{
  const initial=mobileState(),h=stateful(initial,()=>assert.fail('no write'),mobileOptions);
  byAction(h.render(),'open-mobile-placement').props.onClick();
  for(const value of [-21,21,NaN])mobileInput(h.render()).props.onChange({target:{valueAsNumber:value}});
  assert.equal(mobileInput(h.render()).props.value,0);
  mobileInput(h.render()).props.onChange({target:{valueAsNumber:-7}});
  for(const extra of [{operatorSlug:'other'},{roomId:'north-vip'},{packageRevision:8},{dealer:{id:'vera'}},{settings:defaultCompositionSettings()}]){
    supplyMobilePreview(h,initial,extra);assert.equal(byAction(h.render(),'publish-mobile-placement').props.disabled,true);
    await byAction(h.render(),'publish-mobile-placement').props.onClick();
  }
  supplyMobilePreview(h,initial);assert.equal(byAction(h.render(),'publish-mobile-placement').props.disabled,false);
});

test('mobile publication conflicts and unconfirmed readbacks lock retries until explicit refresh',async()=>{
  for(const failure of ['conflict','foreign-write','foreign-read','old-read','different-geometry','changed-draft','network-read']){
    const initial=mobileState(),receipt=mobileReceipt(initial),calls=[],published=[];
    const h=stateful(initial,async(url,request)=>{
      calls.push({url,request});
      if(request.method==='POST')return response(failure==='foreign-write'?{...receipt,operatorId:'foreign'}:receipt,failure==='conflict'?409:200);
      if(failure==='network-read')throw new Error('offline');
      return response({...initial,packageRevision:failure==='old-read'?7:8,presentation:failure==='different-geometry'?initial.presentation:receipt.presentation,
        ...(failure==='foreign-read'?{operatorId:'foreign'}:{}),...(failure==='changed-draft'?{draftRevision:1,draft:{revision:1,basePackageRevision:7,branding:{}}}:{})});
    },{...mobileOptions,onSaved:value=>published.push(value)});
    chooseMobile(h,initial);await byAction(h.render(),'publish-mobile-placement').props.onClick();
    assert.equal(published.length,0,failure);assert.equal(byAction(h.render(),'publish-mobile-placement').props.disabled,true,failure);
    const count=calls.length;await byAction(h.render(),'publish-mobile-placement').props.onClick();assert.equal(calls.length,count,failure);
    assert.match(renderToStaticMarkup(h.render()),/Mobilpubliceringen kunde inte bekräftas/);
  }
});

test('mobile publication ignores late responses after a room, operator or activity change and unmount',async()=>{
  for(const leave of ['room','operator','inactive','unmount']){
    const initial=mobileState(),options={...mobileOptions},calls=[],published=[];let finish;
    options.onSaved=value=>published.push(value);
    const h=stateful(initial,(url,request)=>{calls.push({url,request});return new Promise(resolve=>{finish=resolve;});},options);
    chooseMobile(h,initial);const saving=byAction(h.render(),'publish-mobile-placement').props.onClick();
    if(leave==='room'){options.roomId='north-vip';h.render();}
    else if(leave==='operator'){options.initial={...initial,operatorId:'different'};options.operatorSlug='other';h.render();}
    else if(leave==='inactive'){options.active=false;h.render();}else h.unmount();
    finish(response(mobileReceipt(initial)));await saving;
    assert.equal(calls.length,1);assert.equal(published.length,0);
  }
});
