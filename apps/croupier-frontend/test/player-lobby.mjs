import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {validatePublicOperatorRooms} from '../../../packages/presentation/contracts/operator-rooms-contract.mjs';
import {loadOperatorCatalogue,loadRoomCatalogue} from '../lib/player-catalog.mjs';
import {roomSelection,roomLaunch,rememberRoomSelection,demoLobbyPath} from '../lib/player-lobby.mjs';

const table1='11111111-1111-4111-8111-111111111111',table2='22222222-2222-4222-8222-222222222222';
const background1='33333333-3333-4333-8333-333333333333',background2='44444444-4444-4444-8444-444444444444';
const emptyLayer=()=>({enabled:false,default:null,allowed:[]});
function fixture(){
 const operator={slug:'johns-spelbolag',name:'Johns spelbolag'};
 const rooms=[{id:'room-johanna',name:'Johannas blackjack',laneId:'room-lane',presentation:{id:'johanna-room',label:'Kvällsmiljö'},dealerDefault:'nora',
  dealers:[
   {id:'nora',label:'Johanna',presentation:'local',independentLayers:true,
    table:{enabled:true,default:table1,allowed:[{id:table1,label:'Grönt bord'},{id:table2,label:'Blått bord'}]},
    background:{enabled:true,mode:'video',default:background1,allowed:[{id:background1,label:'Kvällslounge'},{id:background2,label:'Terrassen'}]}},
   {id:'amira',label:'Amira',presentation:'original',independentLayers:false,table:emptyLayer(),background:{...emptyLayer(),mode:'baked'}},
  ],playUrl:'/play/blackjack?operator=johns-spelbolag&table=room-johanna'}];
 return validatePublicOperatorRooms({schemaVersion:1,operator,packageRevision:3,rooms});
}

test('lobby reads only the scoped published catalogue and rejects another company or malformed response',async()=>{
 const calls=[];
 const loaded=await loadRoomCatalogue('johns-spelbolag',{fetchImpl:async(path,options)=>{calls.push({path,options});return Response.json(fixture());}});
 assert.equal(loaded.status,'ready');
 assert.equal(loaded.catalog.rooms[0].dealers[0].label,'Johanna');
 assert.equal(calls[0].path,'/api/operators/johns-spelbolag/rooms');
 assert.equal(calls[0].options.cache,'no-store');assert.equal(calls[0].options.redirect,'error');
 const other=fixture();other.operator.slug='another';other.rooms[0].playUrl='/play/blackjack?operator=another&table=room-johanna';
 assert.deepEqual(await loadRoomCatalogue('johns-spelbolag',{fetchImpl:async()=>Response.json(other)}),{status:'unavailable'});
 const injected=fixture();injected.rooms[0].playUrl='https://example.test/';
 assert.deepEqual(await loadRoomCatalogue('johns-spelbolag',{fetchImpl:async()=>Response.json(injected)}),{status:'unavailable'});
});

test('empty published rooms, unknown operator and backend failure remain distinct and never invent a demo',async()=>{
 const empty=fixture();empty.rooms=[];empty.packageRevision=null;
 assert.equal((await loadRoomCatalogue('johns-spelbolag',{fetchImpl:async()=>Response.json(empty)})).status,'ready');
 assert.deepEqual(await loadRoomCatalogue('johns-spelbolag',{fetchImpl:async()=>new Response(null,{status:404})}),{status:'not-found'});
 assert.deepEqual(await loadRoomCatalogue('johns-spelbolag',{fetchImpl:async()=>new Response('private error',{status:503})}),{status:'unavailable'});
 assert.deepEqual(await loadRoomCatalogue('johns-spelbolag',{fetchImpl:async()=>{throw Error('private error');}}),{status:'unavailable'});
 assert.deepEqual(await loadRoomCatalogue('bad/company',{fetchImpl:async()=>{throw Error('must not fetch');}}),{status:'not-found'});
});

test('room selections drop stale dealers and assets and use exact per-dealer defaults',()=>{
 const room=fixture().rooms[0];
 assert.deepEqual(roomSelection(room,{dealer:'astrid',tableAsset:'foreign',background:'foreign'}),{dealer:'nora',tableAsset:table1,background:background1});
 assert.deepEqual(roomSelection(room,{dealer:'nora',tableAsset:table2,background:background2}),{dealer:'nora',tableAsset:table2,background:background2});
 assert.deepEqual(roomSelection(room,{dealer:'amira',tableAsset:table2,background:background2}),{dealer:'amira'});
});

test('launch keeps operator, actual room and selected dealer through login without widening catalogue choices',()=>{
 const catalog=fixture(),choice=roomSelection(catalog.rooms[0],{dealer:'nora',tableAsset:table2,background:background2});
 const direct=roomLaunch(catalog,'room-johanna',choice);
 assert.equal(direct.href,'/play/blackjack?operator=johns-spelbolag&table=room-johanna&dealer=nora');
 assert.deepEqual(direct.choices,choice);
 const login=roomLaunch(catalog,'room-johanna',choice,{directPlay:false});
 assert.equal(new URL(login.href,'https://fixture.invalid').searchParams.get('returnTo'),direct.href);
 assert.equal(roomLaunch(catalog,'another-room',choice),null);
 assert.equal(roomLaunch(catalog,'room-johanna',{dealer:'astrid'}),null);
});

test('only allowed chosen layer preferences are saved; unavailable storage blocks losing an explicit environment selection',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 const room=fixture().rooms[0],choice=roomSelection(room,{dealer:'nora',tableAsset:table2});
 assert.equal(rememberRoomSelection(storage,'johns-spelbolag',choice),true);
 assert.deepEqual(JSON.parse(values.get('croupier.choices.johns-spelbolag')),choice);
 assert.equal(rememberRoomSelection(storage,'johns-spelbolag',{dealer:'amira'}),true);
 assert.deepEqual(JSON.parse(values.get('croupier.choices.johns-spelbolag')),{dealer:'amira'});
 const unavailable={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};
 assert.equal(rememberRoomSelection(unavailable,'johns-spelbolag',choice),false);
 assert.equal(rememberRoomSelection(unavailable,'johns-spelbolag',{dealer:'amira'}),true);
});

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(resolve(root,'package.json'));
const ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const modules=new Map();
function load(path){
 const filename=[path,path+'.tsx',path+'.ts',path+'.mjs'].find(existsSync);
 if(!filename)throw Error('Missing fixture: '+path);
 if(filename.endsWith('.mjs'))return createRequire(filename)(filename);
 if(modules.has(filename))return modules.get(filename).exports;
 const module={exports:{}};modules.set(filename,module);
 const source=ts.transpileModule(readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const localRequire=spec=>spec.startsWith('@/')?load(resolve(root,spec.slice(2))):spec.startsWith('.')?load(resolve(dirname(filename),spec)):require(spec);
 vm.runInThisContext('(function(require,module,exports){'+source+'\n})',{filename})(localRequire,module,module.exports);
 return module.exports;
}
const {PlayerOperatorChooser,PlayerRoomCatalogue}=load(resolve(root,'components/player/player-lobby-operator.tsx'));

test('actual lobby room cards use registered names and permitted environment options before play',()=>{
 const html=renderToStaticMarkup(React.createElement(PlayerRoomCatalogue,{catalog:fixture(),directPlay:true}));
 assert.match(html,/Johannas blackjack/);assert.doesNotMatch(html,/Kvällsmiljö/);
 assert.match(html,/Spela med Johanna/);assert.doesNotMatch(html,/>Nora</);
 assert.match(html,/Grönt bord/);assert.match(html,/Kvällslounge/);
 assert.match(html,/operator=johns-spelbolag&amp;table=room-johanna&amp;dealer=nora/);
 assert.doesNotMatch(html,/Astrid|Vera|Mei/);
});

test('opaque dealer cards disable independent layer selection and empty catalogue has no play link',()=>{
 const catalog=fixture();
 const html=renderToStaticMarkup(React.createElement(PlayerRoomCatalogue,{catalog,stored:{dealer:'amira',tableAsset:table1,background:background1},directPlay:false}));
 assert.match(html,/Bord och bakgrund ingår i Amiras dealerfilm/);
 assert.match(html,/Logga in och spela med Amira/);
 assert.doesNotMatch(html,/Grönt bord|Kvällslounge|<label[^>]*>Bord/);
 catalog.rooms=[];
 const empty=renderToStaticMarkup(React.createElement(PlayerRoomCatalogue,{catalog,directPlay:true}));
 assert.match(empty,/inga öppna spelrum ännu/);
 assert.doesNotMatch(empty,/<a |<select|Amira|Johanna/);
});

test('nullable layer defaults render explicit empty options and never choose the first asset silently',()=>{
 const payload=fixture(),dealer=payload.rooms[0].dealers[0];
 dealer.table.default=null;dealer.background.default=null;
 const catalog=validatePublicOperatorRooms(payload),room=catalog.rooms[0];
 assert.deepEqual(roomSelection(room),{dealer:'nora'});
 assert.deepEqual(roomLaunch(catalog,room.id,{dealer:'nora'}).choices,{dealer:'nora'});
 const html=renderToStaticMarkup(React.createElement(PlayerRoomCatalogue,{catalog,directPlay:true}));
 assert.match(html,/Inget bord/);assert.match(html,/<input[^>]*name="room-johanna-table"[^>]*checked=""[^>]*value=""/);
 assert.match(html,/Ingen bakgrund/);assert.match(html,/<input[^>]*name="room-johanna-background"[^>]*checked=""[^>]*value=""/);
 assert.doesNotMatch(html,new RegExp('<option value="'+table1+'" selected'));
 assert.doesNotMatch(html,new RegExp('<option value="'+background1+'" selected'));
 const explicit=roomSelection(room,{dealer:'nora',tableAsset:table1,background:background1});
 assert.deepEqual(explicit,{dealer:'nora',tableAsset:table1,background:background1});
 const cleared=roomSelection(room,{...explicit,tableAsset:'',background:''});
 assert.deepEqual(cleared,{dealer:'nora'});
 assert.deepEqual(roomLaunch(catalog,room.id,cleared).choices,{dealer:'nora'});
});

test('operator chooser loads only the minimal published directory and fails closed on private or ambiguous data',async()=>{
  const operators=[{slug:'johns-spelbolag',name:'Johns spelbolag'},{slug:'sg-test',name:'SG test'}],calls=[];
  const loaded=await loadOperatorCatalogue({fetchImpl:async(path,options)=>{calls.push({path,options});return Response.json({operators});}});
  assert.deepEqual(loaded,{status:'ready',operators});
  assert.equal(calls[0].path,'/api/operators');assert.equal(calls[0].options.cache,'no-store');assert.equal(calls[0].options.redirect,'error');
  assert.deepEqual(await loadOperatorCatalogue({fetchImpl:async()=>Response.json({operators:[]})}),{status:'ready',operators:[]});
  for(const payload of [
    {operators:[{...operators[0],membership:'private'}]}, {operators:[operators[0],operators[0]]},
    {operators:[{slug:'../control',name:'Forged'}]}, {operators,players:[]}, {operators:null},
    {operators:new Array(1001).fill(operators[0])},
  ])assert.deepEqual(await loadOperatorCatalogue({fetchImpl:async()=>Response.json(payload)}),{status:'unavailable'});
  for(const status of [401,404,503])assert.deepEqual(await loadOperatorCatalogue({fetchImpl:async()=>new Response('private failure',{status})}),{status:'unavailable'});
  assert.deepEqual(await loadOperatorCatalogue({fetchImpl:async()=>{throw Error('offline');}}),{status:'unavailable'});
});

test('company cards distinguish loading, empty and unavailable states and require explicit selection',()=>{
  const render=state=>renderToStaticMarkup(React.createElement(PlayerOperatorChooser,{state,current:null,onChoose(){},onRetry(){}}));
  assert.match(render({status:'loading'}),/role="status".*Hämtar spelbolag/);
  assert.match(render({status:'ready',operators:[]}),/Inga spelbolag har öppna spelrum/);
  assert.match(render({status:'unavailable'}),/role="alert".*Spelbolagen kan inte hämtas/);
  assert.match(render({status:'unavailable'}),/>Hämta bolagen igen</);
  const state={status:'ready',operators:[{slug:'johns-spelbolag',name:'Johns spelbolag'},{slug:'sg-test',name:'SG test'}]};
  const html=render(state);assert.match(html,/Välj spelbolag/);assert.match(html,/Utforska spelrummen/);
  assert.match(html,/SG test/);assert.doesNotMatch(html,/<a |player_session|bo_jwt|play\/blackjack/);
  const choices=[],element=PlayerOperatorChooser({state,current:null,onChoose:slug=>choices.push(slug),onRetry(){}});
  function walk(node){return React.isValidElement(node)?[node,...React.Children.toArray(node.props.children).flatMap(walk)]:[];}
  const buttons=walk(element).filter(child=>child.type==='button');
  buttons[1].props.onClick();assert.deepEqual(choices,['sg-test']);
  const filtered=renderToStaticMarkup(React.createElement(PlayerOperatorChooser,{state,current:null,filter:'Johns',onChoose(){},onRetry(){}}));
  assert.match(filtered,/Johns spelbolag/);assert.doesNotMatch(filtered,/SG test/);
  const missing=renderToStaticMarkup(React.createElement(PlayerOperatorChooser,{state,current:null,filter:'missing',onChoose(){},onRetry(){}}));
  assert.match(missing,/Inget spelbolag matchar/);
});

test('demo links preserve only one valid operator and never select an arbitrary game or launch',()=>{
  assert.equal(demoLobbyPath(),'/play');
  assert.equal(demoLobbyPath({operator:'sg-test',dealer:'paow',launch:'untrusted',returnTo:'https://evil.invalid'}),'/play?operator=sg-test');
  for(const operator of [['sg-test','other'],'bad/company','https://evil.invalid','',undefined])
    assert.equal(demoLobbyPath({operator}),'/play');
});

test('room chooser renders all published rooms but configures only the selected room',()=>{
 const catalog=fixture(),second=structuredClone(catalog.rooms[0]);second.id='room-two';second.name='Andra rummet';
 second.playUrl='/play/blackjack?operator=johns-spelbolag&table=room-two';catalog.rooms.push(second);
 const html=renderToStaticMarkup(React.createElement(PlayerRoomCatalogue,{catalog,directPlay:true}));
 assert.match(html,/Andra rummet/);assert.match(html,/aria-pressed="true"/);
 assert.equal((html.match(/<article/g)||[]).length,1);
 assert.match(html,/table=room-johanna/);assert.doesNotMatch(html,/table=room-two/);
});

test('lobby includes a separate administrator preview link without changing the published room launch',()=>{
  const {PlayerAreaDocument}=load(resolve(root,'components/player/player-area-document.tsx'));
  const model={surface:'lobby',eyebrow:'Spela',title:'Spellobby',intro:'Välj bolag',notice:null,fields:[],pills:[],links:[],
    sentence:null,primary:{href:'/player-login',label:'Spela Blackjack'},empty:null,historyLines:[],clientLabel:'Spelklient',
    profileForm:null,profileNote:null,operator:null};
  const html=renderToStaticMarkup(React.createElement(PlayerAreaDocument,{model}));
  assert.match(html,/href="\/control\/preview"[^>]*>Provspela i Sammansättning/);
  assert.match(html,/separat testsaldo/);assert.doesNotMatch(html,/studio-preview\/[a-f0-9]|api\/auth\/bo/);
});

test('operator lobby keeps the age notice on small screens when the account panel is hidden',()=>{
  const {PlayerAreaDocument}=load(resolve(root,'components/player/player-area-document.tsx'));
  const model={surface:'lobby',eyebrow:'Spela',title:'Spellobby',intro:'Välj bolag',notice:null,fields:[],pills:[],links:[],
    sentence:null,primary:{href:'/player-login',label:'Spela Blackjack'},empty:null,historyLines:[],clientLabel:'Spelklient',
    profileForm:null,profileNote:null,operator:{slug:'johns-spelbolag',name:'Johns spelbolag'}};
  const html=renderToStaticMarkup(React.createElement(PlayerAreaDocument,{model}));
  assert.match(html,/<aside[^>]*class="[^"]*hidden lg:block/);
  assert.match(html,/<p class="[^"]*lg:hidden"[^>]*>18\+ · Demo utan riktiga pengar/);
});

test('demo route actually redirects to the shared lobby and retains operator context',async()=>{
 const {default:DemoPage}=load(resolve(root,'app/demo/page.tsx'));
 for(const [query,path] of [[{},'/play'],[{operator:'sg-test'},'/play?operator=sg-test'],[{operator:['sg-test','other']},'/play']]){
  await assert.rejects(()=>DemoPage({searchParams:Promise.resolve(query)}),error=>error.digest==='NEXT_REDIRECT;replace;'+path+';307;');
 }
});
