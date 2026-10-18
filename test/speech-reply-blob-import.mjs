import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpeechReplyBlobImport} from '../services/game/storage/speech-reply-blob-import.mjs';
import {speechReplyScopeHash} from '../packages/presentation/server/speech-reply-library.mjs';
import {fixture,input,scope,env} from './fixtures/speech-replies.mjs';
async function legacy(t){
  const f=await fixture(t);
  for(const dealer of ['paow','paow-v2']){const saved=await f.library.save(input(dealer)),value=await f.repository.read(saved.dealerId,saved.id);value.revision=4;
    await f.blobClient.put(`croupier/reply-library/${speechReplyScopeHash(scope)}/${dealer}/${saved.id}.json`,Buffer.from(JSON.stringify(value)),{access:'private',addRandomSuffix:false,contentType:'application/json'});}
  f.sql.data.clear();f.sql.calls.length=0;
  return {...f,adapter:createSpeechReplyBlobImport({scope,env,blobClient:f.blobClient,repository:f.repository,cacheDir:f.cacheDir})};
}
test('all historical scoped Blob replies export verified pointers, dry-run defaults and insert-only import rereads exactly',async t=>{
  const f=await legacy(t),snapshot=await f.adapter.exportSnapshot();assert.equal(snapshot.count,2);assert.deepEqual(snapshot.entries.map(row=>row.value.dealerId).sort(),['paow','paow-v2']);assert.ok(snapshot.entries.every(row=>row.verifiedMedia.length===2&&row.sha256.length===64));
  const plan=await f.adapter.importSnapshot(snapshot);assert.equal(plan.apply,false);assert.equal(plan.toCreate,2);assert.equal(f.sql.data.size,0);
  const result=await f.adapter.importSnapshot(snapshot,{apply:true});assert.equal(result.created,2);assert.equal(f.sql.data.size,2);assert.ok([...f.sql.data.values()].every(row=>row.revision===4));
  assert.equal((await f.adapter.importSnapshot(snapshot,{apply:true})).created,0);assert.equal([...f.objects.keys()].filter(path=>path.endsWith('.json')).length,2);
});
test('changed legacy metadata rejects the frozen import before any SQL write',async t=>{
  const f=await legacy(t),snapshot=await f.adapter.exportSnapshot(),row=f.objects.get(snapshot.entries[0].pathname),value=JSON.parse(row.bytes);value.revision++;value.categories=['player-kind'];row.bytes=Buffer.from(JSON.stringify(value));row.etag='"changed"';
  await assert.rejects(f.adapter.importSnapshot(snapshot,{apply:true}),{code:'reply_library_import_source_changed'});assert.equal(f.sql.data.size,0);
});
test('decoded JSON hashes remain authoritative when compressed transport size differs',async t=>{
  const f=await legacy(t),get=f.blobClient.get;f.blobClient.get=async(...args)=>{const result=await get(...args);if(result?.blob.contentType==='application/json'){result.blob.size=17;result.blob.etag='W/'+result.blob.etag;}return result;};
  const snapshot=await f.adapter.exportSnapshot();assert.equal(snapshot.count,2);assert.ok(snapshot.entries.every(row=>row.etag.startsWith('W/')));
  assert.equal((await f.adapter.importSnapshot(snapshot)).toCreate,2);
});
test('foreign manifest path, repeated pagination and corrupt media fail closed',async t=>{
  const f=await legacy(t),list=f.blobClient.list;
  f.blobClient.list=async options=>({...await list(options),blobs:[{pathname:'croupier/reply-library/foreign/paow/id.json'}]});await assert.rejects(f.adapter.exportSnapshot(),{code:'reply_library_import_corrupt'});
  f.blobClient.list=async options=>({...await list(options),hasMore:true,cursor:'same'});await assert.rejects(f.adapter.exportSnapshot(),{code:'reply_library_import_corrupt'});
  const cold=await legacy(t),[,row]=[...cold.objects].find(([path])=>path.endsWith('.wav'));row.bytes=Buffer.from('bad');
  const uncached=createSpeechReplyBlobImport({scope,env,blobClient:cold.blobClient,repository:cold.repository,cacheDir:cold.cacheDir+'/fresh-import'});
  await assert.rejects(uncached.exportSnapshot(),{code:'reply_library_import_media_mismatch'});assert.equal(f.sql.data.size,0);assert.equal(cold.sql.data.size,0);
});
test('explicit historical missing policy preserves 404 evidence but cannot exempt active dealers or corrupt media',async t=>{
  const f=await legacy(t),options={scope,env,blobClient:f.blobClient,repository:f.repository,allowMissingMediaForDealers:new Set(['paow','paow-v2']),activeDealerIds:new Set(['astrid','dragan'])};
  assert.throws(()=>createSpeechReplyBlobImport({...options,activeDealerIds:new Set(['paow'])}),{code:'reply_library_import_missing_policy'});
  assert.throws(()=>createSpeechReplyBlobImport({...options,activeDealerIds:undefined}),{code:'reply_library_import_missing_policy'});
  for(const path of [...f.objects.keys()])if(!path.endsWith('.json'))f.objects.delete(path);
  await assert.rejects(f.adapter.exportSnapshot(),{code:'reply_library_import_media_mismatch'});
  const adapter=createSpeechReplyBlobImport(options),snapshot=await adapter.exportSnapshot();assert.equal(snapshot.count,2);assert.ok(snapshot.entries.every(row=>row.verifiedMedia.every(media=>media.state==='missing'&&media.status===404)));
  assert.equal((await adapter.importSnapshot(snapshot,{apply:true})).created,2);assert.equal(f.sql.data.size,2);
  const get=f.blobClient.get;f.blobClient.get=async(path,...rest)=>{if(path.endsWith('.json'))return get(path,...rest);throw Error('provider failed');};
  await assert.rejects(adapter.exportSnapshot(),{code:'reply_library_import_unavailable'});
  f.blobClient.list=async()=>{throw Error('https://private-provider?credential=secret');};
  await assert.rejects(adapter.exportSnapshot(),error=>error.code==='reply_library_import_unavailable'&&!error.message.includes('credential'));
});
