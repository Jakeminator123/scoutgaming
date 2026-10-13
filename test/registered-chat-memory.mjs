import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createPlayerChatMemory as createSyncMemory} from '../web/player-chat-memory.mjs';
import {createPlayerChatMemory as createAsyncMemory} from '../web/storage/async-player-chat-memory.mjs';

const scope={playerId:'server-owned-player',dealerId:'paow'};
const reply={kind:'generatedText',exactText:'Hej från PAOW.'};
async function fixture(t,asynchronous) {
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());
  const sync=createSyncMemory(db);
  if(!asynchronous)return {memory:sync,restart:()=>createSyncMemory(db)};
  // Exercise the real asynchronous store without an external database. The
  // production SQL dialect adapter is independently covered by storage tests.
  const adapter={prepare:sql=>db.prepare(sql),transaction:async work=>{
    db.exec('BEGIN IMMEDIATE');try{const value=await work();db.exec('COMMIT');return value;}
    catch(error){db.exec('ROLLBACK');throw error;}
  }};
  return {memory:await createAsyncMemory(adapter),restart:()=>createAsyncMemory(adapter)};
}
for(const asynchronous of [false,true]){
  const label=asynchronous?'asynchronous':'synchronous';
  test(label+' registered dealer memory persists exact text and isolates dealer/player identities',async t=>{
    const {memory,restart}=await fixture(t,asynchronous);
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
  test(label+' forget invalidates a pending registered turn without touching another dealer',async t=>{
    const {memory}=await fixture(t,asynchronous);
    const original=await memory.begin({...scope,requestId:'initial',message:'Remember this.'});await original.commit(reply);
    const other={...scope,dealerId:'new-dealer'};
    const otherTurn=await memory.begin({...other,requestId:'initial',message:'Keep this.'});await otherTurn.commit(reply);
    const pending=await memory.begin({...scope,requestId:'pending',message:'In progress.'});
    await memory.forget(scope);
    await assert.rejects(async()=>pending.commit(reply),e=>e.code==='player_memory_request_forgotten');
    assert.deepEqual((await memory.profile(scope)).history,[]);
    assert.equal((await memory.profile(other)).history.length,2);
  });
  test(label+' registered identity storage still rejects malformed and reserved dealer ids',async t=>{
    const {memory}=await fixture(t,asynchronous);
    for(const dealerId of ['constructor','__proto__','../paow','PAOW','paow/secret','',null,'x'.repeat(65)]){
      await assert.rejects(async()=>memory.profile({...scope,dealerId}),e=>e.code==='player_memory_invalid_identity');
      await assert.rejects(async()=>memory.begin({...scope,dealerId,requestId:'invalid',message:'Hello.'}),e=>e.code==='player_memory_invalid_identity');
    }
  });
}

const studioScope={environment:'production',workspaceId:'synthetic-memory-test'};
async function registeredFixture(t){
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());createSyncMemory(db);
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
    db.exec('BEGIN IMMEDIATE');try{const result=await work();db.exec('COMMIT');return result;}
    catch(error){db.exec('ROLLBACK');throw error;}
  }};
  const memory=await createAsyncMemory(adapter,{studioScope});state.trace=[];
  return {db,state,memory};
}

test('cloud memory rechecks registration after a waiting request and before any memory write',async t=>{
  const {db,state,memory}=await registeredFixture(t);
  const initial=await memory.profile(scope);
  // The route already authorized this dealer. Retirement commits while the
  // following memory operation waits for the shared Studio scope lock.
  assert(state.project.dealers.some(row=>row.id===scope.dealerId));
  state.beforeLock=()=>{
    state.project.dealers=state.project.dealers.filter(row=>row.id!==scope.dealerId);
    db.prepare('DELETE FROM player_chat_memory_profiles WHERE dealer_id=?').run(scope.dealerId);
  };
  for(const invoke of [
    ()=>memory.profile(scope),()=>memory.forget(scope),
    ()=>memory.begin({...scope,requestId:'after-retirement',message:'Previously authorized'}),
    ()=>memory.playedInitiative({...scope,expectedRevision:initial.revision,text:'Previously played'}),
  ]){
    state.trace=[];
    await assert.rejects(invoke,e=>e.code==='player_memory_dealer_unavailable'&&e.statusCode===403);
    assert.deepEqual(state.trace,['studio-lock','registry'],'No pruning or creation may precede registration');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM player_chat_memory_profiles').get().n,0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM player_chat_memory_requests').get().n,0);
  }
});

test('missing, malformed or unavailable cloud registry cannot create a memory profile',async t=>{
  const {db,state,memory}=await registeredFixture(t);
  for(const project of [null,{dealers:null},{dealers:[{id:'paow'},{id:'paow'}]}, {dealers:[{id:'paow'}],dealerTrash:{}}]){
    state.project=project;
    await assert.rejects(()=>memory.profile(scope),e=>e.code==='player_memory_registry_unavailable'&&e.statusCode===503);
  }
  state.unavailable=true;
  await assert.rejects(()=>memory.profile(scope),e=>e.message==='player_memory_registry_unavailable');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM player_chat_memory_profiles').get().n,0);
});

test('archived dealers are refused while registered dealers retain rollback-safe memory',async t=>{
  const {state,memory}=await registeredFixture(t);
  state.project.dealerTrash=[{dealer:{id:'paow'}}];
  await assert.rejects(()=>memory.profile(scope),e=>e.code==='player_memory_dealer_unavailable');
  const astrid={...scope,dealerId:'astrid'},before=await memory.profile(astrid);
  await assert.rejects(()=>memory.playedInitiative({...astrid,expectedRevision:before.revision,text:'Must roll back'},()=>{throw Error('receipt failed');}),/receipt failed/);
  assert.deepEqual(await memory.profile(astrid),before);
  const turn=await memory.begin({...astrid,requestId:'still-registered',message:'Keep existing flow'});
  await turn.commit({kind:'generatedText',exactText:'Still registered.'});
  assert.equal((await memory.profile(astrid)).history.length,2);
});

test('a reply reserved before retirement cannot recreate memory or overwrite a re-registered dealer',async t=>{
  const {db,state,memory}=await registeredFixture(t);
  const input={...scope,requestId:'same-request',message:'Old request.'};
  const pending=await memory.begin(input);
  state.project.dealers=state.project.dealers.filter(row=>row.id!==scope.dealerId);
  db.prepare('DELETE FROM player_chat_memory_requests WHERE dealer_id=?').run(scope.dealerId);
  db.prepare('DELETE FROM player_chat_memory_profiles WHERE dealer_id=?').run(scope.dealerId);
  await assert.rejects(()=>pending.commit(reply),e=>e.code==='player_memory_stale');
  assert.equal(await pending.fail(),false);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM player_chat_memory_profiles').get().n,0);
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
