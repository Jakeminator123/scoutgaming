import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioAdminReadouts} from '../lib/studio-admin-readouts.mjs';
import {createStudioAdminApi} from '../lib/studio-admin-api.mjs';
const scope={environment:'readout_fixture',workspaceId:'croupier'};
const actor={user:'reader@example.invalid',role:'reader'};
const row={total:'1',state_type:'object',shoe_type:'object',round_type:'object',paid_type:'boolean',version:'1',
  shoe_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',dealt:'312',remaining:104,cut_reached:'true',phase:'decisions',paid:'false'};
const fixture=rows=>createStudioAdminReadouts({scope,now:()=> '2026-10-03T02:00:00.000Z',db:{prepare(sql){
  assert.match(sql,/jsonb_array_length/);assert.doesNotMatch(sql,/SELECT\s+(?:\*|state[,\s])/i);
  return{all:async()=>structuredClone(rows)};
}}});
test('readouts use Render rules and persisted counts without card or account values',async()=>{
  const handlers=fixture([row]).handlers;
  const state=await handlers.get('GET /studio/api/admin/shoes')({scope,actor});
  assert.deepEqual(state,{rules:{decks:8,cutAfter:312,total:416,burn:1},tableCount:1,sampledTables:1,partial:false,
    shoes:1,activeRounds:1,cutReached:1,observedAt:'2026-10-03T02:00:00.000Z',source:'render-persisted-state',certificationVerified:false});
  assert.doesNotMatch(JSON.stringify(state),/aaaaaaaa|player|cards|hole|balance|certified/i);
  const empty=await fixture([]).handlers.get('GET /studio/api/admin/shoes')({scope,actor});
  assert.equal(empty.tableCount,0);assert.equal(empty.shoes,0);
  const sampled=await fixture([{...row,total:501}]).handlers.get('GET /studio/api/admin/shoes')({scope,actor});
  assert.equal(sampled.partial,true);assert.equal(sampled.sampledTables,1);
});
test('corrupt persisted state and wrong scope cannot produce replacement status',async()=>{
  for(const change of [{remaining:105},{dealt:null},{cut_reached:'false'},{shoe_id:null},{phase:'unknown'},{paid:null},{total:'invalid'},
    {state_type:'array'},{shoe_type:'string'},{round_type:null},{paid_type:'string'},{version:'bad'},
    {shoe_id:null,dealt:null,remaining:null,cut_reached:null},{phase:null}]) {
    await assert.rejects(fixture([{...row,...change}]).handlers.get('GET /studio/api/admin/shoes')({scope,actor}),e=>e.statusCode===503);
  }
  const read=fixture([]).handlers.get('GET /studio/api/admin/shoes');
  await assert.rejects(read({scope:{...scope,environment:'foreign'},actor}),e=>e.statusCode===403);
  await assert.rejects(read({scope,actor:{user:'',role:'reader'}}),e=>e.statusCode===403);
});
test('reader can see four native template previews; anonymous and mutations rejected',async()=>{
  const {handlers}=fixture([]);
  const api=createStudioAdminApi({authorize:async request=>{if(!request.headers.has('cookie'))throw Object.assign(Error('login'),{statusCode:401});return{...actor,scope};},
    handlers,gates:new Map(),apiBase:'/studio/api/admin',allowedOrigins:['https://studio.example.invalid'],publicHosts:['studio.example.invalid']});
  const call=(method='GET',cookie=true)=>api.handle(new Request('https://studio.example.invalid/studio/api/admin/emails',{
    method,headers:{origin:'https://studio.example.invalid',...(cookie?{cookie:'fixture'}:{}),...(method==='POST'?{'content-type':'application/json'}:{})},...(method==='POST'?{body:'{}'}:{})}));
  assert.equal((await call('GET',false)).status,401);
  const result=await call();assert.equal(result.status,200);
  const body=await result.json();assert.equal(body.templates.length,4);assert.equal(body.previewOnly,true);
  assert.doesNotMatch(JSON.stringify(body),/https?:|<iframe|<script|bettalotto|backoffice|@/i);
  assert.equal((await call('POST')).status,405);
});
