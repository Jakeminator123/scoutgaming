import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createSpeechReplyLibrary} from '../web/speech-reply-library.mjs';
import {createSpeechReplyRepository} from '../web/storage/speech-reply-repository.mjs';
import {fixture,input,env,scope} from './fixtures/speech-replies.mjs';
test('Neon completed reply survives reconstruction; Blob contains only bytes and scope cannot leak',async t=>{
  const f=await fixture(t),saved=await f.library.save(input('paow'));
  assert.equal(saved.dealerId,'paow');assert.equal(saved.reviewStatus,'pending');assert.equal(saved.revision,1);
  assert.doesNotMatch(JSON.stringify(saved),/provider|pathname|blob\.vercel|token/);
  assert.equal(f.objects.size,2);assert.ok([...f.objects.keys()].every(path=>!path.endsWith('.json')));
  const restarted=createSpeechReplyLibrary(f.options);assert.deepEqual(await restarted.list({dealerId:'paow'}),{items:[saved],nextCursor:null});
  await assert.rejects(restarted.get({dealerId:'astrid',id:saved.id}),{statusCode:404});
  for(const change of [{environment:'production'},{workspaceId:'emil'}]){
    const changed={...scope,...change},repository=createSpeechReplyRepository({sql:f.sql,scope:changed});
    const isolated=createSpeechReplyLibrary({...f.options,...changed,repository});assert.deepEqual((await isolated.list({dealerId:'paow'})).items,[]);
    await assert.rejects(isolated.get({dealerId:'paow',id:saved.id}),{statusCode:404});
    assert.throws(()=>createSpeechReplyLibrary({...f.options,...changed}),{statusCode:400});
  }
});
test('categories use exact SQL CAS; concurrent edits, revocation and immutable content remain guarded',async t=>{
  const f=await fixture(t),saved=await f.library.save(input());let authorized=0;
  const changes=await Promise.allSettled(['player-kind','player-question'].map(category=>f.library.categorize({...saved,categories:[category],expectedRevision:1,stillAuthorized:async()=>{authorized++;}})));
  assert.equal(changes.filter(row=>row.status==='fulfilled').length,1);assert.equal(changes.find(row=>row.status==='rejected').reason.statusCode,409);assert.equal(authorized,2);
  const current=await f.library.get(saved);assert.equal(current.revision,2);assert.equal(current.exactText,saved.exactText);assert.deepEqual(current.media,saved.media);
  await assert.rejects(f.library.categorize({...saved,categories:['player-rude'],expectedRevision:2,stillAuthorized:async()=>{throw Object.assign(Error('revoked'),{statusCode:401});}}),{statusCode:401});
  assert.equal((await f.library.get(saved)).revision,2);
});
test('missing Neon never falls back to Blob metadata; invalid categories and identities reach no storage',async t=>{
  const f=await fixture(t);assert.throws(()=>createSpeechReplyLibrary({env}),{statusCode:400});
  assert.throws(()=>createSpeechReplyLibrary({...f.options,repository:undefined}),{code:'reply_library_repository_required'});
  assert.throws(()=>createSpeechReplyLibrary({...f.options,mediaStore:undefined}),{code:'reply_library_unavailable'});
  for(const name of ['putPrivateMedia','getPrivateMedia','deletePrivateMedia']) {
    assert.throws(()=>createSpeechReplyLibrary({...f.options,mediaStore:{...f.options.mediaStore,[name]:null}}),{code:'reply_library_unavailable'});
  }
  await assert.rejects(f.library.list({dealerId:'../astrid'}),{statusCode:400});await assert.rejects(f.library.list({dealerId:'astrid',category:'speech'}),{statusCode:400});
  await assert.rejects(f.library.categorize({dealerId:'astrid',id:randomUUID(),categories:['player-kind','player-kind'],expectedRevision:1}),{statusCode:400});assert.equal(f.objects.size,0);assert.equal(f.sql.calls.length,0);
});
test('media Range and HEAD retain exact private bytes and cross-origin denial',async t=>{
  const f=await fixture(t),saved=await f.library.save(input('dragge'));
  const response=await f.library.media({...saved,kind:'video',request:new Request('https://studio.test/api/replies/video',{headers:{range:'bytes=0-2'}})});assert.equal(response.status,206);assert.equal(await response.text(),'MP4');assert.equal(response.headers.get('cache-control'),'private, no-store');
  const head=await f.library.media({...saved,kind:'audio',request:new Request('https://studio.test/api/replies/audio',{method:'HEAD'})});assert.equal(head.body,null);
  assert.equal((await f.library.media({...saved,kind:'audio',request:new Request('https://studio.test/api/replies/audio',{headers:{origin:'https://other.test'}})})).status,403);
});
test('corrupt Neon pointer cannot redirect the private media reader',async t=>{
  const f=await fixture(t),saved=await f.library.save(input()),row=[...f.sql.data.values()][0];row.value.media.audio.pathname=row.value.media.audio.pathname.replace('/astrid/','/paow/');
  await assert.rejects(f.library.media({...saved,kind:'audio',request:new Request('https://studio.test/api/replies/audio')}),{statusCode:409});
});
test('uncertain metadata commit preserves uploaded bytes and redacts SQL diagnostics',async t=>{
  const f=await fixture(t);f.options.repository={...f.repository,create:async()=>{throw Error('postgres://private');}};
  await assert.rejects(createSpeechReplyLibrary(f.options).save(input()),error=>error.code==='reply_library_unavailable'&&!error.message.includes('postgres'));assert.equal(f.objects.size,2);
});
