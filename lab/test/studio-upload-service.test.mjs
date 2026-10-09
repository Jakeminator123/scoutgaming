import test from 'node:test';
import { seedSavedVideoProject } from './fixtures/video-dealer-project.mjs';
import assert from 'node:assert/strict';
import { createHash,createHmac } from 'node:crypto';
import { mkdtemp,rm } from 'node:fs/promises';
import { basename,dirname,join,resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createStudioUploadService } from '../lib/studio-upload-service.mjs';
import { createStudioRepository } from '../../web/storage/studio-repository.mjs';
import { createStudioMemoryPool } from '../../test/fixtures/studio-memory-pool.mjs';
import {RETAINED_BANK_VARIANTS,createRetainedStudioMedia,canonicalStudioJson} from '../../web/storage/studio-contract.mjs';

test('an upload grant cannot register retained bank status even with a valid server signature',async t=>{
  const {settings,context,pool}=await fixture(t),record=createRetainedStudioMedia(RETAINED_BANK_VARIANTS[0].id);
  let providerReads=0;
  const service=createStudioUploadService({...settings,privateMedia:async()=>{providerReads++;throw Error('must not read');}});
  const payload=Buffer.from(canonicalStudioJson({v:1,actor:'Operator',scope,record,expiresAt:2000})).toString('base64url');
  const ticket=`${payload}.${createHmac('sha256',key).update(`studio-upload-v1\0${payload}`).digest('base64url')}`;
  await assert.rejects(service.commit({operation:'commit',ticket},context),error=>error.code==='studio_upload_grant_invalid'&&error.statusCode===403);
  await assert.rejects(service.prepare({operation:'prepare',sha256:record.sha256,size:record.size,contentType:record.contentType,classification:record.classification,retainedBank:record.retainedBank},{actor:'Operator'}),error=>error.statusCode===400);
  assert.equal(providerReads,0);assert.equal(pool.snapshot().media.size,0);assert.equal(pool.snapshot().audits.length,0);
});

const scope=Object.freeze({environment:'test',workspaceId:'studio-test'}),key=Buffer.alloc(32,8),origin='https://studio.example.invalid';
const classification={dealerId:'astrid',eventId:'idle.ready',kind:'idle',role:'alternative',situation:'',label:'Uploaded clip',notes:''};
async function fixture(t,{bytes=Buffer.from('0000ftypisom00000private-upload-fixture')}={}) {
  const cacheDir=await mkdtemp(join(tmpdir(),'croupier-upload-service-'));
  t.after(() => {assert.equal(dirname(resolve(cacheDir)),resolve(tmpdir()));assert.match(basename(cacheDir),/^croupier-upload-service-/);return rm(cacheDir,{recursive:true,force:true});});
  const pool=createStudioMemoryPool(),repository=createStudioRepository({pool,scope}),objects=new Map(),tokenCalls=[];
  seedSavedVideoProject(pool,scope);
  const env={CROUPIER_MEDIA_STORAGE:'blob',BLOB_READ_WRITE_TOKEN:'fixture-read-write-secret'},options={cacheDir,blobClient:{
    async get(path) {
      const content=objects.get(path);if(!content)return null;
      return {statusCode:200,stream:new Response(content).body,blob:{pathname:path,url:`https://fixture.private.blob.vercel-storage.com/${path}`,contentType:'video/mp4',size:content.length}};
    },
  }};
  let at=1000;
  const settings={repository,scope,ticketKey:key,env,options,clientToken:async args => {tokenCalls.push(args);return 'fixture-only-client-capability';},now:() => at};
  const service=createStudioUploadService(settings),sha256=createHash('sha256').update(bytes).digest('hex');
  const prepare=() => service.prepare({operation:'prepare',sha256,size:bytes.length,contentType:'video/mp4',classification},{actor:'Operator'});
  const context={actor:'Operator',request:new Request(`${origin}/studio/api/videos/upload`,{method:'POST'}),stillAuthorized:async () => true,mutationTransaction:async work => work()};
  return {pool,repository,service,settings,bytes,objects,tokenCalls,prepare,context,setTime:value => {at=value;}};
}
test('prepare issues only an immutable private path capability with MIME/byte/time bounds and no metadata commit',async t => {
  const {prepare,tokenCalls,pool,bytes}=await fixture(t),grant=await prepare(),token=tokenCalls[0];
  assert.equal(token.pathname,grant.pathname);assert.equal(token.maximumSizeInBytes,bytes.length);assert.deepEqual(token.allowedContentTypes,['video/mp4']);
  assert.equal(token.addRandomSuffix,false);assert.equal(token.allowOverwrite,false);assert.equal(token.validUntil,grant.expiresAt);
  assert.equal(pool.snapshot().media.size,0);assert.equal(pool.snapshot().audits.length,0);
  assert.ok(!JSON.stringify(grant).includes('fixture-read-write-secret'));
});
test('commit verifies actual Blob hash/header then atomically registers and audits; restart/replay is idempotent',async t => {
  const {prepare,service,settings,objects,bytes,context,pool,repository}=await fixture(t),grant=await prepare();
  objects.set(grant.pathname,bytes);
  assert.deepEqual(await service.commit({operation:'commit',ticket:grant.ticket},context),{id:grant.id,duplicate:false});
  const stored=await repository.getMedia(grant.id);assert.equal(stored.sha256,createHash('sha256').update(bytes).digest('hex'));
  assert.equal(pool.snapshot().audits.length,1);assert.equal(pool.snapshot().audits[0].actor,'Operator');
  const restarted=createStudioUploadService({...settings,repository:createStudioRepository({pool,scope})});
  assert.deepEqual(await restarted.commit({operation:'commit',ticket:grant.ticket},context),{id:grant.id,duplicate:true});
  assert.equal(pool.snapshot().media.size,1);assert.equal(pool.snapshot().audits.length,1);
});
test('forged, expired, another actor/scope grant and public URL injection cannot register media',async t => {
  const {prepare,service,settings,objects,bytes,context,setTime,pool}=await fixture(t),grant=await prepare();objects.set(grant.pathname,bytes);
  const changed=grant.ticket.slice(0,-1)+(grant.ticket.endsWith('A')?'B':'A');
  await assert.rejects(service.commit({operation:'commit',ticket:changed},context),error => error.statusCode===403);
  await assert.rejects(service.commit({operation:'commit',ticket:grant.ticket},{...context,actor:'Other'}),error => error.statusCode===403);
  const otherScope={...scope,workspaceId:'other'},other=createStudioUploadService({...settings,scope:otherScope,repository:createStudioRepository({pool,scope:otherScope})});
  await assert.rejects(other.commit({operation:'commit',ticket:grant.ticket},context),error => error.statusCode===403);
  await assert.rejects(service.commit({operation:'commit',ticket:grant.ticket,url:'https://evil.invalid'},context),error => error.statusCode===400);
  setTime(grant.expiresAt);await assert.rejects(service.commit({operation:'commit',ticket:grant.ticket},context),error => error.statusCode===403);
  assert.equal(pool.snapshot().media.size,0);
});
test('changed actual bytes, invalid format and revoked identity fail before metadata/audit',async t => {
  const {prepare,service,objects,bytes,context,pool}=await fixture(t),grant=await prepare();
  const corrupt=Buffer.from(bytes);corrupt[corrupt.length-1]^=1;objects.set(grant.pathname,corrupt);
  await assert.rejects(service.commit({operation:'commit',ticket:grant.ticket},context),error => error.statusCode===503);
  assert.equal(pool.snapshot().media.size,0);
  objects.set(grant.pathname,bytes);
  await assert.rejects(service.commit({operation:'commit',ticket:grant.ticket},{...context,stillAuthorized:async () => false}),error => error.statusCode===403);
  const wrong=await fixture(t,{bytes:Buffer.from('invalid-mp4-header-with-enough-fixture-bytes')}),wrongGrant=await wrong.prepare();wrong.objects.set(wrongGrant.pathname,wrong.bytes);
  await assert.rejects(wrong.service.commit({operation:'commit',ticket:wrongGrant.ticket},wrong.context),error => error.statusCode===415);
  assert.equal(wrong.pool.snapshot().media.size,0);assert.equal(pool.snapshot().audits.length,0);
});
test('audit failure leaves verified private bytes for explicit retry without an ambiguous automatic deletion',async t => {
  const {prepare,service,objects,bytes,context,pool}=await fixture(t),grant=await prepare();objects.set(grant.pathname,bytes);
  pool.failNext('audit',new Error('private connection detail'));
  await assert.rejects(service.commit({operation:'commit',ticket:grant.ticket},context),error => error.statusCode===503);
  assert.equal(pool.snapshot().media.size,0);assert.equal(objects.size,1);
  assert.deepEqual(await service.commit({operation:'commit',ticket:grant.ticket},context),{id:grant.id,duplicate:false});
});
test('parallel commit of one grant registers exactly one media record and one audit',async t => {
  const {prepare,service,objects,bytes,context,pool}=await fixture(t),grant=await prepare();objects.set(grant.pathname,bytes);
  const results=await Promise.all([service.commit({operation:'commit',ticket:grant.ticket},context),service.commit({operation:'commit',ticket:grant.ticket},context)]);
  assert.equal(results.filter(row => !row.duplicate).length,1);assert.equal(pool.snapshot().media.size,1);assert.equal(pool.snapshot().audits.length,1);
});

test('complete Blob verification stays outside the product lock; revocation at lock acquisition blocks registration',async t => {
  const {prepare,settings,objects,bytes,context,pool,repository}=await fixture(t),grant=await prepare();objects.set(grant.pathname,bytes);
  let locked = false,authorized = true,fetches = 0,reads = 0,writes = 0;
  const service = createStudioUploadService({...settings,
    options:{...settings.options,blobClient:{get:async path => {assert.equal(locked,false);fetches++;return settings.options.blobClient.get(path);}}},
    repository:{...repository,getMedia:async id => {assert.equal(locked,true);reads++;return repository.getMedia(id);},registerMedia:async (...args) => {assert.equal(locked,true);writes++;return repository.registerMedia(...args);}},
  });
  const commitContext = {...context,stillAuthorized:async () => {assert.equal(locked,true);return authorized;},
    mutationTransaction:async work => {authorized = false;locked = true;try{return await work();}finally{locked = false;}},
  };
  await assert.rejects(service.commit({operation:'commit',ticket:grant.ticket},commitContext),error => error.statusCode===403);
  assert.equal(fetches,1);assert.equal(reads,0);assert.equal(writes,0);assert.equal(pool.snapshot().media.size,0);assert.equal(pool.snapshot().audits.length,0);
  commitContext.mutationTransaction = async work => {authorized = true;locked = true;try{return await work();}finally{locked = false;}};
  assert.deepEqual(await service.commit({operation:'commit',ticket:grant.ticket},commitContext),{id:grant.id,duplicate:false});
  assert.equal(reads,1);assert.equal(writes,1);assert.equal(pool.snapshot().audits.length,1);
  await assert.rejects(service.commit({operation:'commit',ticket:grant.ticket},{...context,mutationTransaction:undefined}),error => error.statusCode===503);
  assert.equal(pool.snapshot().audits.length,1);
});
