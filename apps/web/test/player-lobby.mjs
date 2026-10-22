import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePublicOperatorRooms} from '../../../packages/presentation/contracts/operator-rooms-contract.mjs';
import {createPlayerCatalog} from '../../../packages/player-catalog/index.mjs';
import {isOperatorSlug} from '../../../packages/navigation/operator-slug.mjs';
import {roomSelection,roomLaunch,rememberRoomSelection} from '../../../packages/player-catalog/room-selection.mjs';

const {loadRoomCatalogue}=createPlayerCatalog({isOperatorSlug,validatePublicOperatorRooms});

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
 const stale={getItem:()=>JSON.stringify(choice),setItem(){throw Error('quota');},removeItem(){throw Error('quota');}};
 assert.equal(rememberRoomSelection(stale,'johns-spelbolag',{dealer:'nora'}),false,'failed clearing cannot leave a different saved environment');
});


import {playerLobbyPath} from '../../../packages/navigation/player-lobby.mjs';
test('old catalogue links keep scoped selectors and drop credentials or arbitrary return URLs',()=>{
 assert.equal(playerLobbyPath(),'/lobby');
 assert.equal(playerLobbyPath('?operator=sg-test&table=room-one&dealer=nora&launch=private&returnTo=https://evil.test'),'/lobby?operator=sg-test&room=room-one&dealer=nora');
 assert.equal(playerLobbyPath('?operator=alpha&operator=beta'),'/lobby?operator=alpha&operator=beta');
 assert.equal(playerLobbyPath('?room=one&table=two'),'/lobby?room=one&table=two');
});
test('nullable room defaults do not silently select the first asset',()=>{
 const room=fixture().rooms[0];room.dealers[0].table.default=null;room.dealers[0].background.default=null;
 assert.deepEqual(roomSelection(room),{dealer:'nora'});
 const chosen=roomSelection(room,{dealer:'nora',tableAsset:table2,background:background2});
 assert.deepEqual(chosen,{dealer:'nora',tableAsset:table2,background:background2});
 assert.deepEqual(roomSelection(room,{...chosen,tableAsset:'',background:''}),{dealer:'nora'});
});
