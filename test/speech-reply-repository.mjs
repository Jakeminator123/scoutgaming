import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpeechReplyRepository} from '../packages/presentation/server/speech-reply-repository.mjs';
import {fixture,input,scope} from './fixtures/speech-replies.mjs';
test('SQL category CAS cannot change text, media or another scope',async t=>{
  const f=await fixture(t),saved=await f.library.save(input()),value=await f.repository.read(saved.dealerId,saved.id);
  await assert.rejects(f.repository.update({...value,revision:2,exactText:'Changed'},1),{code:'reply_library_revision_conflict'});
  const foreign=createSpeechReplyRepository({sql:f.sql,scope:{...scope,workspaceId:'emil'}});
  assert.equal(await foreign.read(saved.dealerId,saved.id),null);
  await assert.rejects(foreign.update({...value,revision:2},1),{code:'reply_library_corrupt'});
  assert.deepEqual(await f.repository.read(saved.dealerId,saved.id),value);
});
test('pagination cursor is bound to scope, dealer and category and every row validates its owner',async t=>{
  const f=await fixture(t),saved=await f.library.save(input()),source=await f.repository.read(saved.dealerId,saved.id);f.sql.data.clear();
  for(let i=1;i<=53;i++){const id=`10000000-0000-4000-8000-${String(i).padStart(12,'0')}`,value=structuredClone(source);value.id=id;for(const record of Object.values(value.media))record.pathname=record.pathname.replace(source.id,id);await f.repository.importValue(value);}
  const first=await f.repository.list({dealerId:'astrid'});assert.equal(first.values.length,50);assert.ok(first.nextCursor);
  const second=await f.repository.list({dealerId:'astrid',cursor:first.nextCursor});assert.equal(second.values.length,3);assert.equal(second.nextCursor,null);assert.equal(new Set([...first.values,...second.values].map(row=>row.id)).size,53);
  for(const query of [{dealerId:'paow'},{dealerId:'astrid',category:'player-kind'}])await assert.rejects(f.repository.list({...query,cursor:first.nextCursor}),{code:'reply_library_invalid_cursor'});
  const row=[...f.sql.data.values()][0];row.value.dealerId='paow';await assert.rejects(f.repository.read('astrid',row.id),{code:'reply_library_corrupt'});
});
test('migration retains historical revision, repeats safely and refuses different existing content',async t=>{
  const f=await fixture(t),saved=await f.library.save(input('paow-v2')),value=await f.repository.read(saved.dealerId,saved.id);f.sql.data.clear();value.revision=7;
  assert.equal((await f.repository.importValue(value)).created,true);assert.equal((await f.repository.importValue(value)).created,false);
  await assert.rejects(f.repository.importValue({...value,exactText:'Conflict'}),{code:'reply_library_import_conflict'});assert.equal((await f.repository.read(value.dealerId,value.id)).revision,7);
});
test('SQL transport diagnostics and inconsistent returned row scope never escape',async t=>{
  const repo=createSpeechReplyRepository({scope,sql:async()=>{throw Error('postgres://private-credential');}});
  await assert.rejects(repo.read('astrid','10000000-0000-4000-8000-000000000001'),error=>error.code==='reply_library_unavailable'&&!error.message.includes('postgres'));
  const f=await fixture(t),saved=await f.library.save(input()),original=f.sql.query;f.sql.query=async(sql,args)=>original(sql,args);
  const corrupt=createSpeechReplyRepository({scope,sql:async(sql,args)=>{const result=await original(sql,args);for(const row of result.rows)row.workspace_id='foreign';return result;}});
  await assert.rejects(corrupt.read(saved.dealerId,saved.id),{code:'reply_library_corrupt'});
  const other=await f.library.save(input('paow')),foreign=await f.repository.read(other.dealerId,other.id);
  const wrongOwner=createSpeechReplyRepository({scope,sql:async(sql,args)=>{const result=await original(sql,args);for(const row of result.rows)row.value=foreign;return result;}});
  await assert.rejects(wrongOwner.read(saved.dealerId,saved.id),{code:'reply_library_corrupt'});
});
