import test from 'node:test';
import assert from 'node:assert/strict';
import {controlStudioSummary,selectedOverviewOperator,overviewNextStep,createOverviewReader} from '../lib/control-overview.mjs';
const company={id:'a',slug:'alpha',name:'Alpha'};
const empty=slug=>({schemaVersion:1,operator:{slug,name:slug},packageRevision:null,rooms:[]});
const room=slug=>({schemaVersion:1,operator:{slug,name:slug},packageRevision:2,rooms:[{id:'room-one',name:'Room one',laneId:'classic',presentation:{id:'standard',label:'Standard'},dealerDefault:'astrid',dealers:[{id:'astrid',label:'Astrid',presentation:'original',independentLayers:false,table:{enabled:false,default:null,allowed:[]},background:{enabled:false,default:null,allowed:[],mode:'baked'}}],playUrl:'/play/blackjack?operator='+slug+'&table=room-one'}]});
const next=overrides=>overviewNextStep({operatorStatus:'live',operator:company,studio:{dealers:[],lanes:[{id:'standard',label:'Standard'}]},status:'ready',data:empty('alpha'),...overrides});
test('next step handles missing companies, previews, failures, drafts, publication and open rooms separately',()=>{
  assert.equal(next({operatorStatus:'unavailable'}).kind,'retry');
  assert.equal(next({operatorStatus:'demo'}).kind,'studio');
  assert.equal(next({operator:undefined}).kind,'company');
  assert.equal(next({status:'loading'}).kind,'loading');
  assert.equal(next({status:'error'}).kind,'retry');
  assert.equal(next({studio:{dealers:[],lanes:[]}}).kind,'composition');
  assert.equal(next({}).kind,'publish');
  assert.equal(next({data:{...empty('alpha'),packageRevision:2}}).kind,'publish');
  assert.equal(next({data:room('alpha')}).kind,'play');
  assert.equal(next({operator:{...company,publishedPackage:{revision:3,lanes:['standard']}},data:room('alpha')}).kind,'retry');
  assert.equal(next({operator:{...company,publishedPackage:null},data:room('alpha')}).kind,'retry');
});
test('studio summary projects names only and selection accepts a known id or slug',()=>{
  assert.deepEqual(controlStudioSummary({dealers:[{id:'astrid',label:'Astrid',secret:'private'}],lanes:[{id:'standard',label:'Standard',mediaUrl:'private'}],assets:['private']}),{dealers:[{id:'astrid',label:'Astrid'}],lanes:[{id:'standard',label:'Standard'}]});
  assert.equal(controlStudioSummary(null),null);
  const list=[company,{id:'b',slug:'beta',name:'Beta'}];
  assert.equal(selectedOverviewOperator(list,'beta').id,'b');assert.equal(selectedOverviewOperator(list,'b').id,'b');
  assert.equal(selectedOverviewOperator(list,'https://foreign.invalid').id,'a');assert.equal(selectedOverviewOperator([],null),undefined);
});
test('only a validated response for the requested company can become ready; no writes or cache',async()=>{
  const calls=[];const reader=createOverviewReader({fetchImpl:async(url,init)=>{calls.push([url,init]);return Response.json(room('alpha'));}});
  await reader.read('alpha');assert.equal(reader.getSnapshot().status,'ready');assert.equal(reader.getSnapshot().data.rooms.length,1);
  assert.equal(calls[0][0],'/api/operators/alpha/rooms');assert.equal(calls[0][1].method,'GET');assert.equal(calls[0][1].cache,'no-store');assert.equal(calls[0][1].redirect,'error');
  await reader.read('beta');assert.equal(reader.getSnapshot().status,'error');assert.equal(reader.getSnapshot().data,null);
});
test('switching companies clears prior data and a late response cannot restore it',async()=>{
  let resolve;const reader=createOverviewReader({fetchImpl:async url=>url.includes('alpha')?new Promise(r=>{resolve=r;}):Response.json(empty('beta'))});
  const first=reader.read('alpha');const second=reader.read('beta');
  assert.equal(reader.getSnapshot().key,'beta');assert.equal(reader.getSnapshot().data,null);
  await second;resolve(Response.json(room('alpha')));await first;
  assert.equal(reader.getSnapshot().key,'beta');assert.equal(reader.getSnapshot().data.operator.slug,'beta');
});
test('unavailable, malformed and unsafe room responses stay unknown instead of becoming zero rooms',async()=>{
  const unsafe=room('alpha');unsafe.rooms[0].playUrl='https://foreign.invalid';
  for(const response of [new Response('{}',{status:503}),Response.json({}),Response.json(unsafe),Response.json({...empty('alpha'),privateData:'hidden'})]){
    const reader=createOverviewReader({fetchImpl:async()=>response});await reader.read('alpha');assert.equal(reader.getSnapshot().status,'error');assert.equal(reader.getSnapshot().data,null);
  }
});
test('cancellation prevents unmounted updates and a timeout gives a recoverable error',async()=>{
  let resolve;const reader=createOverviewReader({fetchImpl:async()=>new Promise(r=>{resolve=r;})});
  let notifications=0;const stop=reader.subscribe(()=>notifications++);const pending=reader.read('alpha');reader.cancel();stop();resolve(Response.json(empty('alpha')));await pending;assert.equal(notifications,1);assert.equal(reader.getSnapshot().status,'loading');
  const timed=createOverviewReader({timeoutMs:5,fetchImpl:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))))});
  await timed.read('alpha');assert.equal(timed.getSnapshot().status,'error');
});
