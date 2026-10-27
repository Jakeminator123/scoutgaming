import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerChatMemory as createAsyncMemory} from '../services/game/storage/async-player-chat-memory.mjs';

const scope={playerId:'server-owned-player',dealerId:'paow'};
const reply={kind:'generatedText',exactText:'Hej från PAOW.'};
// Exercise the real asynchronous store without an external database: the memory
// tables are plain rows, only the statements the store issues are answered, and a
// failed transaction restores every table. The production SQL dialect adapter is
// independently covered by storage tests.
function memoryDb() {
  let tables={meta:new Map(),profiles:[],requests:[]},inTransaction=false;
  const duplicate=()=>{throw Object.assign(Error('duplicate key value'),{code:'23505'});};
  const owned=(row,playerRef,dealerId)=>row.player_ref===playerRef&&row.dealer_id===dealerId;
  const profile=(playerRef,dealerId)=>tables.profiles.filter(row=>owned(row,playerRef,dealerId));
  const update=(rows,change)=>{for(const row of rows)Object.assign(row,change);return {changes:rows.length};};
  const statements={
    'SELECT 1 FROM player_chat_memory_meta WHERE key=?':key=>tables.meta.has(key)?[{'?column?':1}]:[],
    'SELECT 1 FROM player_chat_memory_profiles LIMIT 1':()=>tables.profiles.slice(0,1).map(()=>({'?column?':1})),
    'SELECT 1 FROM player_chat_memory_requests LIMIT 1':()=>tables.requests.slice(0,1).map(()=>({'?column?':1})),
    'INSERT OR IGNORE INTO player_chat_memory_meta VALUES (?,?)':(key,value)=>{if(tables.meta.has(key))return {changes:0};tables.meta.set(key,value);return {changes:1};},
    'SELECT value FROM player_chat_memory_meta WHERE key=?':key=>tables.meta.has(key)?[{value:tables.meta.get(key)}]:[],
    'DELETE FROM player_chat_memory_requests WHERE started<=?':at=>{const before=tables.requests.length;tables.requests=tables.requests.filter(row=>!(row.started<=at));return {changes:before-tables.requests.length};},
    "UPDATE player_chat_memory_requests SET state='expired' WHERE state='pending' AND started<=?":at=>update(tables.requests.filter(row=>row.state==='pending'&&row.started<=at),{state:'expired'}),
    'DELETE FROM player_chat_memory_profiles WHERE touched<=?':at=>{const before=tables.profiles.length;tables.profiles=tables.profiles.filter(row=>!(row.touched<=at));return {changes:before-tables.profiles.length};},
    'INSERT OR IGNORE INTO player_chat_memory_profiles VALUES (?,?,?,?,?)':(player_ref,dealer_id,history,revision,touched)=>{
      if(profile(player_ref,dealer_id).length)return {changes:0};tables.profiles.push({player_ref,dealer_id,history,revision,touched});return {changes:1};},
    'SELECT * FROM player_chat_memory_profiles WHERE player_ref=? AND dealer_id=?':profile,
    'SELECT * FROM player_chat_memory_requests WHERE player_ref=? AND dealer_id=? AND request_ref=?':(playerRef,dealerId,requestRef)=>tables.requests.filter(row=>owned(row,playerRef,dealerId)&&row.request_ref===requestRef),
    'UPDATE player_chat_memory_profiles SET history=?, revision=? WHERE player_ref=? AND dealer_id=?':(history,revision,playerRef,dealerId)=>update(profile(playerRef,dealerId),{history,revision}),
    'UPDATE player_chat_memory_profiles SET history=?, revision=?, touched=? WHERE player_ref=? AND dealer_id=?':(history,revision,touched,playerRef,dealerId)=>update(profile(playerRef,dealerId),{history,revision,touched}),
    "UPDATE player_chat_memory_requests SET state='forgotten', result_fingerprint=NULL, committed_revision=NULL WHERE player_ref=? AND dealer_id=?":(playerRef,dealerId)=>update(tables.requests.filter(row=>owned(row,playerRef,dealerId)),{state:'forgotten',result_fingerprint:null,committed_revision:null}),
    "SELECT 1 FROM player_chat_memory_requests WHERE player_ref=? AND dealer_id=? AND state='pending'":(playerRef,dealerId)=>tables.requests.filter(row=>owned(row,playerRef,dealerId)&&row.state==='pending').map(()=>({'?column?':1})),
    'SELECT COUNT(*) AS count FROM player_chat_memory_requests WHERE player_ref=? AND dealer_id=? AND started>?':(playerRef,dealerId,at)=>[{count:tables.requests.filter(row=>owned(row,playerRef,dealerId)&&row.started>at).length}],
    'INSERT INTO player_chat_memory_requests VALUES (?,?,?,?,?,?,?, ?,NULL,NULL)':(player_ref,dealer_id,request_ref,fingerprint,reservation,profile_revision,state,started)=>{
      if(tables.requests.some(row=>owned(row,player_ref,dealer_id)&&row.request_ref===request_ref))duplicate();
      tables.requests.push({player_ref,dealer_id,request_ref,fingerprint,reservation,profile_revision,state,started,result_fingerprint:null,committed_revision:null});return {changes:1};},
    'UPDATE player_chat_memory_profiles SET touched=? WHERE player_ref=? AND dealer_id=?':(touched,playerRef,dealerId)=>update(profile(playerRef,dealerId),{touched}),
    "UPDATE player_chat_memory_requests SET state=? WHERE player_ref=? AND dealer_id=? AND request_ref=? AND reservation=? AND state='pending'":(state,playerRef,dealerId,requestRef,reservation)=>
      update(tables.requests.filter(row=>owned(row,playerRef,dealerId)&&row.request_ref===requestRef&&row.reservation===reservation&&row.state==='pending'),{state}),
    'UPDATE player_chat_memory_profiles SET history=?, revision=?, touched=? WHERE player_ref=? AND dealer_id=? AND revision=?':(history,revision,touched,playerRef,dealerId,expected)=>
      update(profile(playerRef,dealerId).filter(row=>row.revision===expected),{history,revision,touched}),
    "UPDATE player_chat_memory_requests SET state='completed', result_fingerprint=?, committed_revision=? WHERE player_ref=? AND dealer_id=? AND request_ref=? AND reservation=?":(result_fingerprint,committed_revision,playerRef,dealerId,requestRef,reservation)=>
      update(tables.requests.filter(row=>owned(row,playerRef,dealerId)&&row.request_ref===requestRef&&row.reservation===reservation),{state:'completed',result_fingerprint,committed_revision}),
  };
  return {
    get tables(){return tables;},
    prepare(sql){const answer=statements[sql];if(!answer)throw Error('unexpected SQL: '+sql);
      assert.equal(inTransaction,true,'memory statements run inside a transaction');
      return {get:async(...args)=>structuredClone(answer(...args)[0]),all:async(...args)=>structuredClone(answer(...args)),run:async(...args)=>answer(...args)};},
    async transaction(work){assert.equal(inTransaction,false,'transactions are not nested');
      const snapshot=structuredClone(tables);inTransaction=true;
      try{return await work();}catch(error){tables=snapshot;throw error;}finally{inTransaction=false;}},
  };
}
async function fixture(options={}) {
  const adapter=memoryDb();
  return {memory:await createAsyncMemory(adapter,options),restart:()=>createAsyncMemory(adapter,options)};
}
test('asynchronous registered dealer memory persists exact text and isolates dealer/player identities',async()=>{
  const {memory,restart}=await fixture();
  const initial=await memory.profile(scope);
  const turn=await memory.begin({...scope,requestId:'turn-1',message:'Hej PAOW.'});
  const receipt=await turn.commit(reply);
  assert.notEqual(receipt.revision,initial.revision);
  const expected=[{role:'user',text:'Hej PAOW.'},{role:'assistant',text:reply.exactText}];
  assert.deepEqual((await memory.profile(scope)).history,expected);
  const restored=await restart();assert.deepEqual(await restored.profile(scope),await memory.profile(scope));
  for(const other of [{...scope,dealerId:'new-dealer'},{...scope,dealerId:'astrid'},{...scope,playerId:'other-player'}]){
    assert.deepEqual((await restored.profile(other)).history,[]);
    const independent=await restored.begin({...other,requestId:'turn-1',message:'Other conversation.'});
    await independent.commit({kind:'generatedText',exactText:'Separate response.'});
  }
  assert.deepEqual((await restored.profile(scope)).history,expected);
  assert.equal('playerId' in await restored.profile(scope),false);
});
test('asynchronous forget invalidates a pending registered turn without touching another dealer',async()=>{
  const {memory}=await fixture();
  const original=await memory.begin({...scope,requestId:'initial',message:'Remember this.'});await original.commit(reply);
  const other={...scope,dealerId:'new-dealer'};
  const otherTurn=await memory.begin({...other,requestId:'initial',message:'Keep this.'});await otherTurn.commit(reply);
  const pending=await memory.begin({...scope,requestId:'pending',message:'In progress.'});
  await memory.forget(scope);
  await assert.rejects(async()=>pending.commit(reply),e=>e.code==='player_memory_request_forgotten');
  assert.deepEqual((await memory.profile(scope)).history,[]);
  assert.equal((await memory.profile(other)).history.length,2);
});
test('asynchronous registered identity storage still rejects malformed and reserved dealer ids',async()=>{
  const {memory}=await fixture();
  for(const dealerId of ['constructor','__proto__','../paow','PAOW','paow/secret','',null,'x'.repeat(65)]){
    await assert.rejects(async()=>memory.profile({...scope,dealerId}),e=>e.code==='player_memory_invalid_identity');
    await assert.rejects(async()=>memory.begin({...scope,dealerId,requestId:'invalid',message:'Hello.'}),e=>e.code==='player_memory_invalid_identity');
  }
});

// Retirement removes a dealer's rows directly, outside the memory store.
const removeDealer=(rows,dealerId)=>{for(let i=rows.length-1;i>=0;i--)if(rows[i].dealer_id===dealerId)rows.splice(i,1);};
const studioScope={environment:'production',workspaceId:'synthetic-memory-test'};
async function registeredFixture(){
  const db=memoryDb();
  const state={project:{dealers:[{id:'paow'},{id:'astrid'}],dealerTrash:[]},trace:[],unavailable:false,beforeLock:null};
  const adapter={prepare(sql){
    if(sql.includes('croupier_studio.documents'))return {async get(...values){
      assert.deepEqual(values,[studioScope.environment,studioScope.workspaceId]);
      state.trace.push('registry');if(state.unavailable)throw Error('private database failure');
      return state.project?{value:state.project}:undefined;
    }};
    state.trace.push(sql);return db.prepare(sql);
  },async transaction(work,options){
    if(options?.studioScope){assert.deepEqual(options.studioScope,studioScope);await state.beforeLock?.();state.trace.push('studio-lock');}
    return db.transaction(work);
  }};
  const memory=await createAsyncMemory(adapter,{studioScope});state.trace=[];
  return {db,state,memory};
}

test('cloud memory rechecks registration after a waiting request and before any memory write',async()=>{
  const {db,state,memory}=await registeredFixture();
  const initial=await memory.profile(scope);
  // The route already authorized this dealer. Retirement commits while the
  // following memory operation waits for the shared Studio scope lock.
  assert(state.project.dealers.some(row=>row.id===scope.dealerId));
  state.beforeLock=()=>{
    state.project.dealers=state.project.dealers.filter(row=>row.id!==scope.dealerId);
    removeDealer(db.tables.profiles,scope.dealerId);
  };
  for(const invoke of [
    ()=>memory.profile(scope),()=>memory.forget(scope),
    ()=>memory.begin({...scope,requestId:'after-retirement',message:'Previously authorized'}),
    ()=>memory.playedInitiative({...scope,expectedRevision:initial.revision,text:'Previously played'}),
  ]){
    state.trace=[];
    await assert.rejects(invoke,e=>e.code==='player_memory_dealer_unavailable'&&e.statusCode===403);
    assert.deepEqual(state.trace,['studio-lock','registry'],'No pruning or creation may precede registration');
    assert.equal(db.tables.profiles.length,0);
    assert.equal(db.tables.requests.length,0);
  }
});

test('missing, malformed or unavailable cloud registry cannot create a memory profile',async()=>{
  const {db,state,memory}=await registeredFixture();
  for(const project of [null,{dealers:null},{dealers:[{id:'paow'},{id:'paow'}]}, {dealers:[{id:'paow'}],dealerTrash:{}}]){
    state.project=project;
    await assert.rejects(()=>memory.profile(scope),e=>e.code==='player_memory_registry_unavailable'&&e.statusCode===503);
  }
  state.unavailable=true;
  await assert.rejects(()=>memory.profile(scope),e=>e.message==='player_memory_registry_unavailable');
  assert.equal(db.tables.profiles.length,0);
});

test('archived dealers are refused while registered dealers retain rollback-safe memory',async()=>{
  const {state,memory}=await registeredFixture();
  state.project.dealerTrash=[{dealer:{id:'paow'}}];
  await assert.rejects(()=>memory.profile(scope),e=>e.code==='player_memory_dealer_unavailable');
  const astrid={...scope,dealerId:'astrid'},before=await memory.profile(astrid);
  await assert.rejects(()=>memory.playedInitiative({...astrid,expectedRevision:before.revision,text:'Must roll back'},()=>{throw Error('receipt failed');}),/receipt failed/);
  assert.deepEqual(await memory.profile(astrid),before);
  const turn=await memory.begin({...astrid,requestId:'still-registered',message:'Keep existing flow'});
  await turn.commit({kind:'generatedText',exactText:'Still registered.'});
  assert.equal((await memory.profile(astrid)).history.length,2);
});

test('a reply reserved before retirement cannot recreate memory or overwrite a re-registered dealer',async()=>{
  const {db,state,memory}=await registeredFixture();
  const input={...scope,requestId:'same-request',message:'Old request.'};
  const pending=await memory.begin(input);
  state.project.dealers=state.project.dealers.filter(row=>row.id!==scope.dealerId);
  removeDealer(db.tables.requests,scope.dealerId);
  removeDealer(db.tables.profiles,scope.dealerId);
  await assert.rejects(()=>pending.commit(reply),e=>e.code==='player_memory_stale');
  assert.equal(await pending.fail(),false);
  assert.equal(db.tables.profiles.length,0);
  await assert.rejects(()=>memory.profile(scope),e=>e.code==='player_memory_dealer_unavailable');
  state.project.dealers.push({id:scope.dealerId});
  const fresh=await memory.begin({...input,message:'New registration.'});
  assert.notEqual(fresh.revision,pending.revision);assert.deepEqual(fresh.history,[]);
  await assert.rejects(()=>pending.commit(reply),e=>e.code==='player_memory_stale');
  assert.equal(await pending.fail(),false,'An old reservation cannot cancel the new one');
  await fresh.commit({kind:'generatedText',exactText:'New reply.'});
  assert.deepEqual((await memory.profile(scope)).history,[
    {role:'user',text:'New registration.'},{role:'assistant',text:'New reply.'},
  ]);
});


test('async chat result may commit after cold start but still expires at ten minutes',async()=>{
  let at=1800000000000;const f=await fixture({now:()=>at});
  const owner={...scope,dealerId:'dragan'};
  const first=await f.memory.begin({...owner,requestId:'cold-first',message:'Hej.'});
  at+=420000;await first.commit(reply);
  assert.equal((await f.memory.profile(owner)).history.length,2);
  const second=await f.memory.begin({...owner,requestId:'cold-expiry',message:'Hej igen.',pendingMs:3600000,ttlMs:3600000});
  at+=599999;const restored=await f.restart();
  await assert.rejects(async()=>restored.begin({...owner,requestId:'overlap',message:'Hej.'}),/busy|pending/);
  at+=1;await assert.rejects(async()=>second.commit(reply),e=>e.code==='player_memory_request_expired');
});


test('async cancelling a late pending chat releases its lock immediately',async()=>{
  let at=1800000000000;const {memory}=await fixture({now:()=>at});
  const owner={...scope,dealerId:'dragan'};
  const cancelled=await memory.begin({...owner,requestId:'cancelled-cold',message:'Hej.'});
  at+=420000;assert.equal(await cancelled.cancel(),true);
  await assert.rejects(async()=>cancelled.commit(reply),e=>e.code==='player_memory_request_cancelled');
  const next=await memory.begin({...owner,requestId:'next-cold',message:'Hej igen.'});await next.commit(reply);
  assert.equal((await memory.profile(owner)).history.length,2);
});
