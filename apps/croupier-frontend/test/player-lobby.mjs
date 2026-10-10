import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {validatePublicOperatorRooms} from '../../../web/public/operator-rooms-contract.mjs';
import {loadRoomCatalogue,roomSelection,roomLaunch,rememberRoomSelection} from '../lib/player-lobby.mjs';

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
const {PlayerRoomCatalogue}=load(resolve(root,'components/player/player-lobby-operator.tsx'));

test('actual lobby room cards use registered names and permitted environment options before play',()=>{
 const html=renderToStaticMarkup(React.createElement(PlayerRoomCatalogue,{catalog:fixture(),directPlay:true}));
 assert.match(html,/Johannas blackjack/);assert.match(html,/Kvällsmiljö/);
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
 assert.match(html,/<option value="" selected="">Inget bord<\/option>/);
 assert.match(html,/<option value="" selected="">Ingen bakgrund<\/option>/);
 assert.doesNotMatch(html,new RegExp('<option value="'+table1+'" selected'));
 assert.doesNotMatch(html,new RegExp('<option value="'+background1+'" selected'));
 const explicit=roomSelection(room,{dealer:'nora',tableAsset:table1,background:background1});
 assert.deepEqual(explicit,{dealer:'nora',tableAsset:table1,background:background1});
 const cleared=roomSelection(room,{...explicit,tableAsset:'',background:''});
 assert.deepEqual(cleared,{dealer:'nora'});
 assert.deepEqual(roomLaunch(catalog,room.id,cleared).choices,{dealer:'nora'});
});
