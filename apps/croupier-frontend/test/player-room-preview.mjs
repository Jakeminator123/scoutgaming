import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dealerPortrait,loadRoomPreview} from '../lib/player-room-preview.mjs';
import {previewMediaPath} from '../../../web/public/operator-preview-contract.mjs';
import {defaultCompositionSettings} from '../../../web/public/composition-settings.mjs';
const id='11111111-1111-4111-8111-111111111111';
const context={operatorSlug:'sample',roomId:'room-one',packageRevision:3,dealerId:'paow'};
const room={id:context.roomId,dealers:[{id:'paow',independentLayers:false,table:{allowed:[]},background:{allowed:[]}}]};
const catalog={operator:{slug:'sample'},packageRevision:3};
const payload=()=>({schemaVersion:1,operatorSlug:'sample',roomId:'room-one',packageRevision:3,dealer:{id:'paow',label:'PAOW'},independentLayers:false,settings:null,media:{dealer:{src:previewMediaPath(context,'dealer',id),contentType:'video/mp4'},tables:[],backgrounds:[]}});
test('preview loads only published context with no-store and rejects changed identity',async()=>{
 const calls=[];assert.equal((await loadRoomPreview(catalog,room,'paow',{fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json(payload());}})).status,'ready');
 assert.equal(calls[0].url,'/api/operators/sample/rooms/room-one/preview?dealer=paow&revision=3');assert.equal(calls[0].options.cache,'no-store');assert.equal(calls[0].options.redirect,'error');
 for(const patch of [{operatorSlug:'other'},{roomId:'room-other'},{packageRevision:4},{dealer:{id:'astrid',label:'Astrid'}}])assert.equal((await loadRoomPreview(catalog,room,'paow',{fetchImpl:async()=>Response.json({...payload(),...patch})})).status,'unavailable');
});
test('preview cannot widen an authorized room, disclose a provider URL or accept hidden fields',async()=>{
 const sample=payload();sample.independentLayers=true;sample.settings=defaultCompositionSettings();sample.media.tables=[{id,label:'Unknown table',src:previewMediaPath(context,'table',id),contentType:'image/png'}];
 for(const value of [sample,{...payload(),secret:'private'}, {...payload(),media:{...payload().media,dealer:{src:'https://private.blob.test/clip.mp4',contentType:'video/mp4'}}}])assert.equal((await loadRoomPreview(catalog,room,'paow',{fetchImpl:async()=>Response.json(value)})).status,'unavailable');
 let called=false;assert.equal((await loadRoomPreview(catalog,room,'astrid',{fetchImpl:async()=>{called=true;return Response.json(payload())}})).status,'unavailable');assert.equal(called,false);
});
test('preview distinguishes a stale package and does not surface private error responses',async()=>{
 assert.deepEqual(await loadRoomPreview(catalog,room,'paow',{fetchImpl:async()=>new Response('private',{status:409})}),{status:'changed'});
 for(const status of [401,404,500,503])assert.deepEqual(await loadRoomPreview(catalog,room,'paow',{fetchImpl:async()=>new Response('private',{status})}),{status:'unavailable'});
 assert.deepEqual(await loadRoomPreview(catalog,room,'paow',{fetchImpl:async()=>{throw Error('private')}}),{status:'unavailable'});
});
test('portrait selection is exact ID only and every imported file has provenance',()=>{
 assert.equal(dealerPortrait('astrid'),'/images/lobby/astrid-portrait.jpg');
 for(const name of ['paow','paow-v2','amira','johanna','PAOW','Paow','new-paow','../paow','toString','constructor'])assert.equal(dealerPortrait(name),null);
 const provenance=JSON.parse(readFileSync(new URL('../public/images/lobby/source-provenance.json',import.meta.url)));
 for(const id of ['astrid','vera','mei','dragge','marten']){const data=readFileSync(new URL('../public'+dealerPortrait(id),import.meta.url));assert.ok(data.length>0);assert.ok(provenance.sha256[id+'-portrait.jpg']);}
 for(const id of ['amira','paow'])assert.equal(provenance.sha256[id+'-portrait.jpg'],undefined);
});
