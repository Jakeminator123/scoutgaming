import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createSpeechReplyLibrary } from '../web/speech-reply-library.mjs';
const env = { CROUPIER_MEDIA_STORAGE:'blob', BLOB_READ_WRITE_TOKEN:'fixture-private-token' };
const scope = { environment:'qa',workspaceId:'jakob' };
function input(dealerId='astrid') { return {id:randomUUID(),dealerId,exactText:'Hej! Tack för frågan.',language:'sv',profileRevision:'a'.repeat(64),audio:{bytes:Buffer.from('WAV exact bytes'),contentType:'audio/wav'},video:{bytes:Buffer.from('MP4 exact bytes'),contentType:'video/mp4'}}; }
async function fixture(t) {
  const cacheDir=await mkdtemp(join(tmpdir(),'reply-library-test-')); t.after(()=>rm(cacheDir,{recursive:true,force:true}));
  const objects=new Map(); let revision=0;
  const blob=(pathname,r)=>({pathname,url:`https://fixture.private.blob.vercel-storage.com/${pathname}`,size:r.bytes.length,contentType:r.contentType,etag:r.etag});
  const blobClient={
    async put(pathname,bytes,o) {
      assert.equal(o.access,'private'); assert.equal(o.addRandomSuffix,false);
      const old=objects.get(pathname);
      if((old&&!o.allowOverwrite)||(o.ifMatch&&o.ifMatch!==old?.etag)) throw Object.assign(Error('SECRET provider'),{name:'BlobPreconditionFailedError'});
      if(o.allowOverwrite)assert.ok(o.ifMatch);
      const r={bytes:Buffer.from(bytes),contentType:o.contentType,etag:`"${++revision}"`};objects.set(pathname,r);return blob(pathname,r);
    },
    async get(pathname,o){assert.equal(o.access,'private');const r=objects.get(pathname);return r?{statusCode:200,stream:new Response(r.bytes).body,blob:blob(pathname,r)}:null;},
    async list(o){return{blobs:[...objects].filter(([p])=>p.startsWith(o.prefix)).map(([p,r])=>blob(p,r)),hasMore:false};},
    async del(pathname){objects.delete(pathname);},
  };
  const options={env,...scope,blobClient,cacheDir};return {objects,options,library:createSpeechReplyLibrary(options)};
}
test('private completed reply survives reconstruction; manifest never exposes storage pointers',async t=>{
  const f=await fixture(t), request=input('paow'), saved=await f.library.save(request);
  assert.equal(saved.dealerId,'paow');assert.equal(saved.reviewStatus,'pending');assert.equal(saved.revision,1);
  assert.doesNotMatch(JSON.stringify(saved),/provider|pathname|blob\.vercel|token/);
  const restarted=createSpeechReplyLibrary(f.options);
  assert.deepEqual(await restarted.list({dealerId:'paow'}),{items:[saved],nextCursor:null});
  assert.equal((await restarted.media({dealerId:'paow',id:saved.id,kind:'audio',request:new Request('https://studio.test/api/replies/audio')})).status,200);
  await assert.rejects(restarted.get({dealerId:'astrid',id:saved.id}),{statusCode:404});
  for(const changed of [{environment:'production'},{workspaceId:'emil'}]) {
    const isolated=createSpeechReplyLibrary({...f.options,...changed});assert.deepEqual((await isolated.list({dealerId:'paow'})).items,[]);
    await assert.rejects(isolated.get({dealerId:'paow',id:saved.id}),{statusCode:404});
  }
});
test('categories use revision CAS; concurrent edits cannot overwrite; text and media stay immutable',async t=>{
  const f=await fixture(t), saved=await f.library.save(input());
  let authorized=0;
  const changes=await Promise.allSettled(['player-kind','player-question'].map(category=>f.library.categorize({dealerId:saved.dealerId,id:saved.id,categories:[category],expectedRevision:1,stillAuthorized:async()=>{authorized++;}})));
  assert.equal(changes.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(changes.find(x=>x.status==='rejected').reason.statusCode,409);assert.equal(authorized,2);
  const current=await f.library.get(saved);assert.equal(current.revision,2);assert.equal(current.exactText,saved.exactText);assert.deepEqual(current.media,saved.media);
  await assert.rejects(f.library.categorize({...saved,categories:['player-rude'],expectedRevision:2,stillAuthorized:async()=>{throw Object.assign(Error('revoked'),{statusCode:401});}}),{statusCode:401});
  assert.equal((await f.library.get(saved)).revision,2);
});
test('only ten defined categories and valid scoped identities reach storage',async t=>{
  const f=await fixture(t);
  assert.throws(()=>createSpeechReplyLibrary({env}),{statusCode:400});
  await assert.rejects(f.library.list({dealerId:'../astrid'}),{statusCode:400});
  await assert.rejects(f.library.list({dealerId:'astrid',category:'speech'}),{statusCode:400});
  await assert.rejects(f.library.categorize({dealerId:'astrid',id:randomUUID(),categories:['player-kind','player-kind'],expectedRevision:1}),{statusCode:400});
  assert.equal(f.objects.size,0);
});
test('media range and HEAD use the same private validated bytes; untrusted cross-origin fails',async t=>{
  const f=await fixture(t), saved=await f.library.save(input('dragge'));
  const response=await f.library.media({...saved,kind:'video',request:new Request('https://studio.test/api/replies/video',{headers:{range:'bytes=0-2'}})});
  assert.equal(response.status,206);assert.equal(await response.text(),'MP4');assert.equal(response.headers.get('cache-control'),'private, no-store');
  const head=await f.library.media({...saved,kind:'audio',request:new Request('https://studio.test/api/replies/audio',{method:'HEAD'})});assert.equal(head.body,null);
  const denied=await f.library.media({...saved,kind:'audio',request:new Request('https://studio.test/api/replies/audio',{headers:{origin:'https://other.test'}})});assert.equal(denied.status,403);
});
test('corrupt manifest cannot redirect the private media reader',async t=>{
  const f=await fixture(t), saved=await f.library.save(input());
  const [,r]=[...f.objects].find(([p])=>p.endsWith('.json'));const changed=JSON.parse(r.bytes);changed.media.audio.pathname=changed.media.audio.pathname.replace('/astrid/','/paow/');r.bytes=Buffer.from(JSON.stringify(changed));
  await assert.rejects(f.library.media({...saved,kind:'audio',request:new Request('https://studio.test/api/replies/audio')}),{statusCode:409});
});
