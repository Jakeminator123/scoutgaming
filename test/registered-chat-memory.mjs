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
