import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicOperatorDirectory} from '../web/public-operators.mjs';
import {createPublicOperatorRooms} from '../web/public-operator-rooms.mjs';
import {createPortraitRoomEntryFixture} from './fixtures/portrait-room-entry.mjs';

function response() {
  return {status: 0, headers: {}, body: '', writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.body = body; }};
}

test('GET /api/operators returns exactly slug and name for an active operator, and 404 otherwise', async () => {
  let calls = 0;
  let now = 1_000;
  const store = {
    async getOperatorBySlug(slug) {
      calls += 1;
      if (slug === 'sg-test') return {slug, name: 'SG test game provider', status: 'active', id: 'secret', environment_id: 'prod'};
      if (slug === 'paused') return {slug, name: 'Paused Co', status: 'suspended', id: 'secret'};
      return null;
    },
  };
  const directory = createPublicOperatorDirectory({store, now: () => now});
  const ok = response();
  await directory.handle({method: 'GET'}, ok, '/api/operators/sg-test');
  assert.equal(ok.status, 200);
  assert.equal(ok.headers['Cache-Control'], 'public, max-age=60');
  const body = JSON.parse(ok.body);
  assert.deepEqual(Object.keys(body).sort(), ['name', 'slug']);
  assert.deepEqual(body, {slug: 'sg-test', name: 'SG test game provider'});
  await directory.handle({method: 'GET'}, response(), '/api/operators/sg-test');
  assert.equal(calls, 1);
  now += 60_000;
  await directory.read('sg-test');
  assert.equal(calls, 2);

  const missing = response();
  await directory.handle({method: 'GET'}, missing, '/api/operators/missing');
  assert.equal(missing.status, 404);
  const paused = response();
  await directory.handle({method: 'GET'}, paused, '/api/operators/paused');
  assert.equal(paused.status, 404);
  assert.doesNotMatch(missing.body + paused.body, /secret|Paused|environment/);
  const denied = response();
  await directory.handle({method: 'POST'}, denied, '/api/operators/sg-test');
  assert.equal(denied.status, 405);
});

test('local fixture resolves sg-test when no operator store is configured', async () => {
  const directory = createPublicOperatorDirectory({store: null, now: () => 0});
  assert.deepEqual(await directory.read('sg-test'), {slug: 'sg-test', name: 'SG test game provider'});
  assert.equal(await directory.read('not-a-company'), null);
  assert.equal(await directory.read('PLAY'), null);
});


async function requestList(directory,{method='GET',url='/api/operators'}={}) {
  const res=response();assert.equal(await directory.handle({method,url},res,url.split('?')[0]),true);return res;
}
function liveDirectory() {
  const fixture=createPortraitRoomEntryFixture({operator:'north'});
  const rows=[
    {id:fixture.room.operatorId,slug:'north',name:'North <VIP>',status:'active',privateToken:'never-expose'},
    {id:'unpublished',slug:'unpublished',name:'No package',status:'active'},
    {id:'suspended',slug:'suspended',name:'Suspended',status:'suspended'},
    {id:'missing',slug:'missing-room',name:'Missing room',status:'active'},
    {id:'foreign',slug:'foreign-room',name:'Someone else owns its room',status:'active'},
    {id:'invalid',slug:'NOT VALID',name:'Invalid slug',status:'active'},
    {id:'invalid-name',slug:'invalid-name',name:'',status:'active'},
  ];
  const calls={lists:0,rooms:[],packages:[]};
  const store={
    async listOperators(){calls.lists++;return rows;},
    async getOperatorBySlug(slug){calls.rooms.push(slug);return rows.find(row=>row.slug===slug)??null;},
    async getCurrentPackage(id){calls.packages.push(id);if(id===fixture.room.operatorId)return fixture.pack;
      if(id==='unpublished')return null;
      return {...fixture.pack,operatorId:id,tables:id==='missing'?['room-missing']:[fixture.room.id]};},
    save(){assert.fail('Public listing must never write');},
  };
  const rooms=createPublicOperatorRooms({store,policy:{readGameConfiguration(){assert.fail('Room catalog must use saved authoritative snapshot');},readSaved:async()=>({project:fixture.project,administration:fixture.administration})}});
  return {directory:createPublicOperatorDirectory({store,readRooms:rooms.read}),rooms,store,rows,calls,fixture};
}

test('anonymous list uses the real room authority and exposes only active published playable companies',async()=>{
  const f=liveDirectory(),before=structuredClone({rows:f.rows,pack:f.fixture.pack,project:f.fixture.project,administration:f.fixture.administration});
  const result=await requestList(f.directory);assert.equal(result.status,200);assert.equal(result.headers['Cache-Control'],'no-store');
  assert.deepEqual(JSON.parse(result.body),{operators:[{slug:'north',name:'North <VIP>'}]});
  assert.doesNotMatch(result.body,/never-expose|operatorId|fixture|package|branding|rooms|sha256|pathname/);
  assert.deepEqual(f.calls.rooms,['north','unpublished','missing-room','foreign-room']);
  assert.deepEqual({rows:f.rows,pack:f.fixture.pack,project:f.fixture.project,administration:f.fixture.administration},before);
  const head=await requestList(f.directory,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.body,undefined);assert.equal(head.headers['Cache-Control'],'no-store');
  assert.equal(f.calls.lists,2,'HEAD also checks current publication, without a cached list');
  f.fixture.pack.tables=[];assert.deepEqual(JSON.parse((await requestList(f.directory)).body),{operators:[]});
  f.fixture.pack.tables=[f.fixture.room.id];f.rows[0].status='suspended';assert.deepEqual(JSON.parse((await requestList(f.directory)).body),{operators:[]});
});

test('list rejects methods and queries before touching storage, and has no offline demo fallback',async()=>{
  let reads=0;const directory=createPublicOperatorDirectory({store:{listOperators(){reads++;throw Error('must not read');}},readRooms(){throw Error('must not read');}});
  for(const method of ['POST','PUT','DELETE','OPTIONS']){
    const result=await requestList(directory,{method});assert.equal(result.status,405);assert.equal(result.headers.Allow,'GET, HEAD');assert.equal(result.headers['Cache-Control'],'no-store');
  }
  for(const url of ['/api/operators?operator=north','/api/operators?token=private','/api/operators?x='])assert.equal((await requestList(directory,{url})).status,400);
  assert.equal(reads,0);
  for(const options of [{},{store:{}},{store:{listOperators:async()=>[]}}]){
    const result=await requestList(createPublicOperatorDirectory(options));assert.equal(result.status,503);assert.deepEqual(JSON.parse(result.body),{error:'operator_directory_unavailable'});assert.equal(result.headers['Cache-Control'],'no-store');
  }
  assert.equal((await requestList(createPublicOperatorDirectory(),{method:'HEAD'})).body,undefined);
  assert.equal(await directory.handle({method:'GET'},response(),'/api/operators/north/rooms'),false);
});

test('corrupt catalogs and storage failures cannot expose a partial or foreign operator list',async()=>{
  const f=liveDirectory(),catalog=await f.rooms.read('north');
  for(const mode of ['list-error','invalid-list','sparse-list','duplicate','rooms-error','invalid-catalog','foreign-catalog','missing-revision']){
    const rows=mode==='invalid-list'?{}:mode==='sparse-list'?new Array(2):[f.rows[0],{...f.rows[0],slug:mode==='duplicate'?'north':'later'}];
    const directory=createPublicOperatorDirectory({store:{listOperators:async()=>{if(mode==='list-error')throw Error('private connection detail');return rows;}},
      readRooms:async slug=>{if(slug==='north')return catalog;if(mode==='rooms-error')throw Error('private storage failure');
        const value=structuredClone(catalog);value.operator.slug=slug;value.rooms[0].playUrl='/play/blackjack?operator='+slug+'&table='+value.rooms[0].id;
        if(mode==='invalid-catalog')value.secret='never-expose';
        if(mode==='foreign-catalog')value.operator.slug='foreign';
        if(mode==='missing-revision')value.packageRevision=null;
        return value;}});
    const result=await requestList(directory);assert.equal(result.status,503,mode);assert.equal(result.body,'{"error":"operator_directory_unavailable"}');assert.equal(result.headers['Cache-Control'],'no-store');
  }
  const deleted=createPublicOperatorDirectory({store:{listOperators:async()=>[f.rows[0]]},readRooms:async()=>null});
  assert.deepEqual(JSON.parse((await requestList(deleted)).body),{operators:[]});
});

test('list response is bounded by operator count and actual UTF-8 bytes without silent truncation',async()=>{
  const f=liveDirectory(),catalog=await f.rooms.read('north');let roomCalls=0;
  const oversized=createPublicOperatorDirectory({store:{listOperators:async()=>Array.from({length:1001},(_,i)=>({...f.rows[0],slug:'company-'+i}))},readRooms:async()=>{roomCalls++;return catalog;}});
  assert.equal((await requestList(oversized)).status,503);assert.equal(roomCalls,0);
  const name='ࠀ'.repeat(120),rows=Array.from({length:800},(_,i)=>({...f.rows[0],slug:'company-'+i,name}));
  const tooManyBytes=createPublicOperatorDirectory({store:{listOperators:async()=>rows},readRooms:async slug=>{const value=structuredClone(catalog);value.operator={slug,name};value.rooms[0].playUrl='/play/blackjack?operator='+slug+'&table='+value.rooms[0].id;return value;}});
  assert.equal((await requestList(tooManyBytes)).status,503);
});
