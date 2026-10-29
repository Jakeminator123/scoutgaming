import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {writeMediaLayoutFixture} from './fixtures/media-layout-files.mjs';
import {planBlobExport,syncBlobExport,writeBlobIndex} from '../tools/export-media-blob.mjs';
import {validatePrivateMedia,mediaBlobPath} from '../apps/studio/lib/cloud-media-store.mjs';
import {getPublicMediaBlobResponse} from '../apps/studio/lib/media-blob-index.mjs';
import {createRequire} from 'node:module';
import {createReadStream,openAsBlob} from 'node:fs';
const requireLab=createRequire(new URL('../apps/studio/package.json',import.meta.url));
const env={BLOB_READ_WRITE_TOKEN:'isolated-fixture'};
async function fixture(t){const root=await mkdtemp(join(tmpdir(),'croupier-blob-layout-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await writeMediaLayoutFixture(root,{roots:{'web/public/sfx':'media/game/runtime/audio'},files:Array.from({length:8},(_,i)=>({path:`game/runtime/audio/a${i}.wav`,legacyPath:`web/public/sfx/a${i}.wav`,access:'public',publicUrl:`/sfx/a${i}.wav`,body:`original audio ${i}`}))});return root;}
function client(){const objects=new Map(),types=new Map(),calls=[],blob=(path)=>({pathname:path,url:`https://fixture.private.blob.vercel-storage.com/${path}`,contentType:types.get(path),size:objects.get(path)?.length});return{objects,calls,async get(path){calls.push(['get',path]);return objects.has(path)?{statusCode:200,stream:new Response(objects.get(path)).body,blob:blob(path)}:null;},async put(path,body,options){calls.push(['put',path]);assert.equal(options.access,'private');assert.equal(options.allowOverwrite,false);assert.ok(!objects.has(path));assert.ok(body instanceof Blob);const chunks=[];for await(const part of body.stream())chunks.push(part);objects.set(path,Buffer.concat(chunks));types.set(path,options.contentType);return blob(path);},async del(){throw new Error('Existing media must never be deleted.');}};}
test('new Blob hierarchy and older private uploads validate without weakening hash/path checks',()=>{
  const id='11111111-1111-1111-1111-111111111111',sha='a'.repeat(64),newPath=mediaBlobPath('dealers/astrid/review/uploads',id,sha,'mp4');
  for(const pathname of [`croupier/videos/${id}/${sha}.mp4`,newPath,newPath.replace('/astrid/','/nora/')])assert.equal(validatePrivateMedia({provider:'vercel-blob',pathname,sha256:sha,size:32,contentType:'video/mp4'}).pathname,pathname);
  for(const pathname of [newPath.replace('/review/','/../../'),newPath.replace('/astrid/','/../nova/'),newPath.replace(sha,'b'.repeat(64))])assert.throws(()=>validatePrivateMedia({provider:'vercel-blob',pathname,sha256:sha,size:32,contentType:'video/mp4'}));
});
test('dry-run indexes cannot skip verification; checkpoint resumes exact IDs/bytes and public aliases honor ranges',async t=>{
  const root=await fixture(t),plan=await planBlobExport({root}),blobClient=client(),indexPath=join(root,'private-index.json'),options={root,env,blobClient,cacheDir:join(root,'cache'),checkpoint:indexPath};
  await writeBlobIndex(indexPath,plan);const result=await syncBlobExport(plan,options);assert.equal(result.files.length,8);assert.equal(blobClient.calls.filter(call=>call[0]==='put').length,8);
  assert.equal(JSON.parse(await readFile(indexPath,'utf8')).verification,'readback-sha256');const before=blobClient.calls.length;await syncBlobExport(plan,options);assert.equal(blobClient.calls.length,before);
  for(const path of ['/sfx/a0.wav','/media/game/runtime/audio/a0.wav']){const response=await getPublicMediaBlobResponse(path,new Request('http://localhost'+path,{headers:{range:'bytes=0-7'}}),{repositoryRoot:root,indexPath,env,blobClient,cacheDir:join(root,'cache')});assert.equal(response.status,206);assert.equal(await response.text(),'original');}
  assert.equal(await getPublicMediaBlobResponse('/media/game/source/secret.wav',new Request('http://localhost/'),{repositoryRoot:root,indexPath,env,blobClient}),null);
  assert.equal(await getPublicMediaBlobResponse('/sfx/a0.wav',new Request('http://localhost/'),{repositoryRoot:root,env:{}}),null);
});
test('concurrent duplicate bytes retain separate logical paths while uploading the immutable object once',async t=>{
  const root=await fixture(t),plan=await planBlobExport({root}),blobClient=client();
  const first=plan.files[0],second={...first,logicalPath:'game/runtime/audio/duplicate.wav'};await writeFile(join(root,'media',second.logicalPath),await readFile(join(root,'media',first.logicalPath)));
  const result=await syncBlobExport({...plan,files:[first,second]},{root,env,blobClient,cacheDir:join(root,'cache')});assert.equal(result.files.length,2);assert.equal(blobClient.calls.filter(call=>call[0]==='put').length,1);
});

test('a failed object stops new scheduling and checkpoint keeps only readback-verified rows',async t=>{
  const root=await fixture(t),plan=await planBlobExport({root}),blobClient=client(),originalGet=blobClient.get.bind(blobClient);let reads=0;
  blobClient.get=async(path,options)=>{if(++reads===1)throw new Error('provider unavailable');return originalGet(path,options);};
  const checkpoint=join(root,'checkpoint.json');await assert.rejects(syncBlobExport(plan,{root,env,blobClient,cacheDir:join(root,'cache'),checkpoint,concurrency:4}),/verified/);
  assert.ok(blobClient.calls.filter(call=>call[0]==='put').length<=3);
  const saved=JSON.parse(await readFile(checkpoint,'utf8'));assert.equal(saved.verification,'readback-sha256');assert.ok(saved.files.length<8);
});

test('resume verifies a committed object after a lost put response without overwrite or deletion',async t=>{
  const root=await fixture(t),plan=await planBlobExport({root}),one={...plan,files:plan.files.slice(0,1)},blobClient=client(),put=blobClient.put.bind(blobClient);
  let lost=true;blobClient.put=async(...args)=>{const result=await put(...args);if(lost){lost=false;throw Object.assign(new TypeError('fetch failed'),{cause:{code:'ECONNRESET'}});}return result;};
  const options={root,env,blobClient,cacheDir:join(root,'cache'),checkpoint:join(root,'checkpoint.json'),concurrency:1};
  await assert.rejects(syncBlobExport(one,options),/export failed/);assert.equal(blobClient.objects.size,1);
  const resumed=await syncBlobExport(one,options);assert.equal(resumed.files.length,1);assert.equal(blobClient.calls.filter(call=>call[0]==='put').length,1);
  assert.equal(resumed.verification,'readback-sha256');
});

test('actual Blob SDK retry reuses a consumed ReadStream but replays a file-backed Blob without network',async t=>{
  const root=await fixture(t),file=join(root,'media/game/runtime/audio/a0.wav'),expected=await readFile(file);
  const {Dispatcher,setGlobalDispatcher,getGlobalDispatcher}=requireLab('undici'),sdk=requireLab('@vercel/blob');
  const previousDispatcher=getGlobalDispatcher(),previousRetries=process.env.VERCEL_BLOB_RETRIES;process.env.VERCEL_BLOB_RETRIES='1';
  t.after(()=>{setGlobalDispatcher(previousDispatcher);if(previousRetries===undefined)delete process.env.VERCEL_BLOB_RETRIES;else process.env.VERCEL_BLOB_RETRIES=previousRetries;});
  class OfflineDispatcher extends Dispatcher{
    calls=[];
    dispatch(options,handlers){
      handlers.onConnect(()=>{});
      (async()=>{
        const chunks=[];if(options.body)for await(const chunk of options.body)chunks.push(Buffer.from(chunk));
        this.calls.push(Buffer.concat(chunks));const status=this.calls.length===1?500:200;
        const json=status===500?{error:{code:'internal_server_error'}}:{pathname:'fixture.wav',url:'https://fixture.private.blob.vercel-storage.com/fixture.wav',contentType:'audio/wav'};
        handlers.onHeaders(status,[Buffer.from('content-type'),Buffer.from('application/json')],()=>{},status===500?'Internal Server Error':'OK');
        handlers.onData(Buffer.from(JSON.stringify(json)));handlers.onComplete([]);
      })().catch(error=>handlers.onError(error));return true;
    }
  }
  const options={access:'private',token:'vercel_blob_rw_fixture_'+ 'a'.repeat(48),allowOverwrite:false,addRandomSuffix:false,contentType:'audio/wav',abortSignal:AbortSignal.timeout(10000)};
  const broken=new OfflineDispatcher();setGlobalDispatcher(broken);const stream=createReadStream(file);
  try{await assert.rejects(sdk.put('fixture.wav',stream,options),/body object should not be disturbed or locked/);}finally{stream.destroy();}
  assert.equal(broken.calls.length,1);assert.deepEqual(broken.calls[0],expected);
  const replayable=new OfflineDispatcher();setGlobalDispatcher(replayable);
  const result=await sdk.put('fixture.wav',await openAsBlob(file,{type:'audio/wav'}),options);
  assert.equal(result.pathname,'fixture.wav');assert.equal(replayable.calls.length,2);
  for(const body of replayable.calls)assert.deepEqual(body,expected,'both actual SDK attempts send the complete exact source');
});
