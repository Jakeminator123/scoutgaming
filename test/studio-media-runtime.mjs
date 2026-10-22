import * as savedGameDocumentContract from '../packages/studio-registry/server/document-contract.mjs';

import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {createStudioMemoryPool} from './fixtures/studio-memory-pool.mjs';
import {readRuntimeCatalogFixture} from './fixtures/runtime-media-catalog.mjs';
import {createStudioRepository} from '../packages/studio-registry/server/document-repository.mjs';
import { createSavedGamePolicy, STUDIO_GAME_CONFIGURATION_SOURCE } from '../packages/presentation/server/saved-game-policy.mjs';
import {createStudioMediaRuntime} from '../services/game/storage/studio-media-runtime.mjs';
import {createSeedProject,isAssetCompatible} from '../packages/presentation/contracts/studio-model.mjs';
import {legacyClipControls} from '../services/game/storage/legacy-clip-inventory.mjs';
import {createPresentationApi} from '../services/game/presentation-api.mjs';
import {createNativeObservation} from '../services/game/public/native-observation.mjs';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const { createStudioGamePolicy } = createSavedGamePolicy({ documentContract: savedGameDocumentContract });

const repositoryRoot=fileURLToPath(new URL('../',import.meta.url));
const scope={environment:'media_source_qa',workspaceId:'croupier'};
const env={CROUPIER_MEDIA_STORAGE:'blob',BLOB_READ_WRITE_TOKEN:'fixture-no-network',
  CROUPIER_MEDIA_BLOB_INDEX:fileURLToPath(new URL('../media/blob-index.json',import.meta.url))};
async function fixture(){
  const pool=createStudioMemoryPool(),repository=createStudioRepository({pool,scope});
  pool.seedRuntimeCatalog(scope,readRuntimeCatalogFixture());
  const project=createSeedProject();project.revision='actual-neon-project-original';
  for(const line of project.lines){
    const event=project.events.find(row=>row.id===line.eventId);
    const asset=project.assets.find(row=>isAssetCompatible(event,row));
    assert.ok(asset,`compatible fixture animation for ${line.eventId}`);
    for(const variant of line.variants)variant.assetId=asset.id;
  }
  await repository.initializeDocument('project',{value:project,revision:project.revision,actor:'fixture-import'});
  await repository.initializeDocument('administration',{value:{tiers:{classic:'vera',high:'astrid',vip:'amira'},rooms:[],
    pitboss:{payout10x:true,streak5:true,randomWalkMin:45},tournaments:[],voiceReview:{},genVerdicts:{},genLandings:{},
    legacyClipReview:{sourceSha256:'a'.repeat(64),neverAgain:{}}},
    revision:'actual-neon-administration-original',actor:'fixture-import'});
  const policy=createStudioGamePolicy({repository,scope,dealerIdle:dealerId=>({dealerId,engineKey:'idle-1/idle/idle',available:true})});
  return {pool,repository,policy,media:createStudioMediaRuntime({repository,scope,env,repositoryRoot})};
}
test('retired legacy HTTP returns 410 while cloud configuration preserves saved Neon CAS revision and source',async()=>{
  const f=await fixture();
  const original=await f.repository.readDocument('project');
  const next=structuredClone(original.value);next.lines[0].label='Second saved revision';
  const saved=await f.repository.saveDocument('project',{value:next,expectedRevision:original.revision,actor:'fixture-admin'});
  assert.notEqual(saved.revision,original.revision);
  const api=createPresentationApi({store:f.policy.projectStore(),legacyControls:f.media.legacyControls,
    registryLoader:async()=>({videos:[],families:[]})});
  const server=createServer((req,res)=>{api(req,res,new URL(req.url,'http://metadata.qa.invalid').pathname,'isolated-qa-player').catch(()=>{res.writeHead(503);res.end();});});
  try{
    server.listen(0,'127.0.0.1');await once(server,'listening');
    const base=`http://127.0.0.1:${server.address().port}`;
    const legacy=await fetch(base+'/api/presentation/legacy-config');assert.equal(legacy.status,410);
    assert.deepEqual(await legacy.json(),{error:'legacy_presentation_retired'});
    const response=await fetch(base+'/api/presentation/config?dealerId=astrid');assert.equal(response.status,200);const config=await response.json();
    assert.equal(config.configurationSource,STUDIO_GAME_CONFIGURATION_SOURCE);assert.equal(config.projectRevision,saved.revision);
    const emitted=[];const observer=createNativeObservation({href:'https://metadata.qa.invalid/blackjack?labObserverOrigin=https%3A%2F%2Fmetadata.qa.invalid&labObserverChannel=11111111-1111-4111-8111-111111111111',
      opener:{postMessage:(message,origin)=>emitted.push({message,origin})}});
    assert.equal(observer.enabled,true);
    observer.emit('playback',{event:'configuration',state:'selected',projectRevision:config.projectRevision,configurationSource:config.configurationSource});
    assert.equal(emitted[0].message.payload.projectRevision,saved.revision);
    assert.equal(emitted[0].message.payload.configurationSource,STUDIO_GAME_CONFIGURATION_SOURCE);
    assert.equal(emitted[0].origin,'https://metadata.qa.invalid');
    assert.equal((await f.repository.readDocument('project')).revision,saved.revision);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
test('ordinary flag-off legacy resolver still attributes disk project and native missing administration fails closed',async()=>{
  const f=await fixture(),project=(await f.policy.projectStore().load());
  const legacy=await legacyClipControls(project,{repository:repositoryRoot,administration:{neverAgain:{}}});
  assert.equal(legacy.runtime.source,'lab/project.json');assert.equal(legacy.runtime.projectRevision,project.revision);
  const absent=createStudioMediaRuntime({repository:{scope,listMedia:()=>f.repository.listMedia(),readRuntimeCatalog:()=>f.repository.readRuntimeCatalog(),readDocument:async()=>null},scope,env,repositoryRoot});
  await assert.rejects(absent.legacyControls(project),error=>error.code==='studio_document_missing');
});

test('ordinary pages and renderer code never read Neon; every imported public media alias still reaches it',async()=>{
  let reads=0;
  const unavailable=Object.assign(Error('catalog unavailable'),{code:'catalog_unavailable'});
  const repository={scope,listMedia:async()=>[],readRuntimeCatalog:async()=>{reads++;throw unavailable;}};
  const media=createStudioMediaRuntime({repository,scope,env,repositoryRoot});
  for(const path of ['/', '/index.html', '/app.js', '/styles.css', '/missing', '/bo/app.js', '/lab/style.css', '/assets/fonts/font.woff2', '/composition-runtime/compositor.js', '/%broken']){
    assert.equal(await media.publicMediaResponse(path,new Request('https://metadata.qa.invalid'+path)),null,path);
  }
  assert.equal(reads,0,'ordinary static requests remain independent of Neon availability');
  const paths=new Set(readRuntimeCatalogFixture().layout.files.filter(row=>row.access==='public').flatMap(row=>[
    '/media/'+row.path,...(row.publicUrl?[row.publicUrl]:[]),
  ]));
  for(const path of paths){
    await assert.rejects(media.publicMediaResponse(path,new Request('https://metadata.qa.invalid'+path)),error=>error===unavailable,path);
  }
  assert.equal(reads,paths.size,'all current public aliases remain catalog-authoritative');
  await assert.rejects(media.publicMediaResponse('/%64ealers/astrid/missing.mp4',new Request('https://metadata.qa.invalid/')),error=>error===unavailable);
});

test('Neon public JSON preserves exact UTF8, HEAD, ETag and Range without local or Blob metadata',async t=>{
  const root=await mkdtemp(join(tmpdir(),'croupier-neon-json-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'web/public'),{recursive:true});await writeFile(join(root,'web/public/take.json'),'local metadata must not be read');
  const source='{ "caption": "Astrids åäö", "calibration": 42 }\n',bytes=Buffer.from(source),sha256=createHash('sha256').update(bytes).digest('hex');
  const row={path:'dealers/astrid/runtime/take.json',legacyPath:'web/public/take.json',publicUrl:'/review/take.json',access:'public',sha256,size:bytes.length};
  const value={schemaVersion:1,layout:{schemaVersion:1,roots:{},files:[row]},blobIndex:{schemaVersion:1,namespace:'croupier/media',verification:'readback-sha256',files:[]},presentation:{},legacy:{schemaVersion:2,entries:{['media/'+row.path]:source}}};
  let reads=0;
  const repository={scope,listMedia:async()=>[],readRuntimeCatalog:async()=>{reads++;return {revision:'a'.repeat(64),value};}};
  const media=createStudioMediaRuntime({repository,scope,env,repositoryRoot:root});
  const request=(method='GET',headers={})=>new Request('https://metadata.qa.invalid/review/take.json',{method,headers});
  assert.deepEqual(await media.readMetadata('review/take.json'),JSON.parse(source));
  const get=await media.publicMediaResponse('/review/take.json',request());assert.equal(get.status,200);assert.deepEqual(Buffer.from(await get.arrayBuffer()),bytes);
  const head=await media.publicMediaResponse('/review/take.json',request('HEAD'));assert.equal(head.headers.get('content-length'),String(bytes.length));assert.equal(await head.text(),'');
  const etag=head.headers.get('etag');assert.equal(etag,`"sha256-${sha256}"`);
  assert.equal((await media.publicMediaResponse('/review/take.json',request('GET',{'if-none-match':etag}))).status,304);
  const range=await media.publicMediaResponse('/review/take.json',request('GET',{range:'bytes=2-8'}));assert.equal(range.status,206);assert.deepEqual(Buffer.from(await range.arrayBuffer()),bytes.subarray(2,9));
  const suffix=await media.publicMediaResponse('/review/take.json',request('GET',{range:'bytes=-5'}));assert.deepEqual(Buffer.from(await suffix.arrayBuffer()),bytes.subarray(-5));
  assert.equal((await media.publicMediaResponse('/review/take.json',request('GET',{range:'bytes=9999-'}))).status,416);
  assert.equal((await media.publicMediaResponse('/review/take.json',request('GET',{range:'bytes=2-8','if-range':'old-version'}))).status,200);
  assert.equal((await media.publicMediaResponse('/review/take.json',request('POST'))).status,405);
  assert.equal((await media.publicMediaResponse('/review/take.json',request('GET',{origin:'https://foreign.invalid'}))).status,403);
  assert.equal(await media.readMetadata('unregistered.json'),null);
  assert.equal(await media.publicMediaResponse('/review/unregistered.json',request()),null);
  assert.equal(await media.hasPublicMedia('unregistered.mp4'),false);
  assert.equal(reads,13,'each operation reads its own current scoped Neon catalog');
  const proxied=createStudioMediaRuntime({repository,scope,env:{...env,CROUPIER_VERCEL_FRONTEND_ORIGIN:'https://frontend.invalid'},repositoryRoot:root});
  assert.equal((await proxied.publicMediaResponse('/review/take.json',request('GET',{origin:'https://frontend.invalid','sec-fetch-site':'same-origin'}))).status,200);
  assert.equal((await proxied.publicMediaResponse('/review/take.json',request('GET',{origin:'https://frontend.invalid','sec-fetch-site':'cross-site'}))).status,403);
  assert.equal((await proxied.publicMediaResponse('/review/take.json',request('GET',{origin:'https://foreign.invalid','sec-fetch-site':'same-origin'}))).status,403);
  value.legacy.entries['media/'+row.path]='{}';
  await assert.rejects(media.readMetadata('review/take.json'),error=>error.code==='studio_media_registry_unavailable');
  delete value.legacy.entries['media/'+row.path];
  await assert.rejects(media.publicMediaResponse('/review/take.json',request()),error=>error.code==='studio_media_registry_unavailable');
  repository.readRuntimeCatalog=async()=>{throw Error('database unavailable');};
  await assert.rejects(media.readMetadata('review/take.json'));
  await assert.rejects(media.hasPublicMedia('review/take.json'),error=>error.code==='studio_media_storage_unavailable');
});

test('Neon-only and cloud calibration routes reject before reading a body or touching local files',async()=>{
  // Exercise the production route in isolation: no database or listening server
  // is needed to prove the early write boundary for each deployment flag.
  const source=await readFile(new URL('../services/game/server.mjs',import.meta.url),'utf8');
  const policy=source.match(/^const localMediaEnabled = .+;$/m)?.[0];
  const begin=source.indexOf("  if (req.method === 'POST' && req.url === '/calibration') {");
  const end=source.indexOf("\n  if (req.method === 'POST' && pathname.startsWith('/api/bo/')",begin);
  assert.ok(policy&&begin>0&&end>begin,'production calibration route exists');
  for(const env of [{CROUPIER_STUDIO_NEON_POLICY:'1'},{CROUPIER_CLOUD_RUNTIME:'1'}]){
    const res={writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=body;}};
    const reject=()=>{throw Error('native calibration must not touch body or disk');};
    vm.runInNewContext(`(()=>{${policy}\n${source.slice(begin,end)}\n})()`,{
      process:{env},cloudRuntime:env.CROUPIER_CLOUD_RUNTIME==='1',req:{method:'POST',url:'/calibration',on:reject},res,
      readCalibrationCss:reject,writeSync:reject,
    });
    assert.equal(res.status,403);assert.equal(res.headers['Cache-Control'],'no-store');
    assert.deepEqual(JSON.parse(res.body),{error:'calibration_unavailable'});
  }
});

import {createVideoRegistry} from '../packages/studio-registry/server/registry-core.mjs';
import {createNeonVideoRegistry as createRegistryReader} from '../packages/studio-registry/server/registry-reader.mjs';
import {createMediaRuntimeServices} from '../packages/studio-registry/server/media-runtime.mjs';
import {createMediaBlobIndex} from '../packages/studio-registry/server/media-blob-index.mjs';
import {createMediaLayout} from '../packages/studio-registry/server/media-layout.mjs';
import {createRuntimeMetadataReader} from '../tools/runtime-media-catalog.mjs';
import {cloudPresentationFixture} from '../apps/studio/test/fixtures/cloud-presentation.mjs';
import {defaultPresentationLane} from '../packages/presentation/contracts/studio-model.mjs';

async function neutralMediaFixture(){
  const localScope={environment:'test',workspaceId:'constructor-media'};
  const pool=createStudioMemoryPool(),repository=createStudioRepository({pool,scope:localScope});
  const cloud=cloudPresentationFixture({lanes:[defaultPresentationLane('linnea')]});
  await repository.initializeDocument('project',{value:cloud.project,revision:cloud.project.revision,actor:'isolated-fixture'});
  await repository.initializeDocument('administration',{value:{rooms:[]},revision:'constructor-admin',actor:'isolated-fixture'});
  const bytes=Buffer.from('cloud-fixture:linnea'),record={...cloud.mediaRows[0],size:bytes.length};
  delete record.revision;delete record.updatedAt;
  await repository.registerMedia(record,{actor:'isolated-fixture'});
  const catalog=readRuntimeCatalogFixture();pool.seedRuntimeCatalog(localScope,catalog);
  const layout=createMediaLayout({repositoryRoot});
  let privateReads=0;
  const getPrivateMedia=async(storage,request)=>{
    privateReads++;assert.equal(storage.pathname,record.pathname);
    assert.equal(storage.sha256,createHash('sha256').update(bytes).digest('hex'));assert.equal(storage.size,bytes.length);
    return new Response(request.method==='HEAD'?null:bytes,{headers:{'content-length':String(bytes.length)}});
  };
  const index=createMediaBlobIndex({repositoryRoot,getPrivateMedia});
  const build=isMediaConfigured=>{
    const port=isMediaConfigured===undefined?{}:{isMediaConfigured};
    const reader=createVideoRegistry({repositoryRoot,previewUrl:id=>'/api/videos/'+id,uploadDirectory:()=>null,
      readUploads:async()=>{throw Error('SQL uploads required');},readClassifications:async()=>[],getPrivateMedia,mediaBlobIndex:index,...port});
    const registry=createRegistryReader({repository,scope:localScope,env:{},reader,getPrivateMedia,...port});
    const services=createMediaRuntimeServices({repositoryRoot,createNeonVideoRegistry:()=>registry,legacyClipControls,
      verifiedMediaBlobStorage:index.verifiedMediaBlobStorage,getPublicMediaBlobResponse:async()=>assert.fail('No provider access'),
      resolvePublicMedia:layout.resolvePublicMedia,createRuntimeMetadataReader,configurationSource:STUDIO_GAME_CONFIGURATION_SOURCE,...port});
    return {reader,registry,media:services.createStudioMediaRuntime({repository,scope:localScope,env:{},repositoryRoot}),services};
  };
  return {pool,repository,scope:localScope,catalog,record,bytes,build,get privateReads(){return privateReads;}};
}

test('neutral media defaults still reject missing Blob config and ignore per-call configuration bypasses',async()=>{
  const f=await neutralMediaFixture(),{reader,registry,media}=f.build();
  await assert.rejects(registry.load(),error=>error.code==='studio_media_storage_unavailable');
  const result=await reader.loadVideoRegistry({runtimeCatalog:f.catalog,env:{},readUploads:async()=>[],
    isMediaConfigured:()=>true});
  assert.equal(result.summary.readable,false);assert.ok(result.videos.every(video=>video.available===false));
  const publicFile=f.catalog.blobIndex.files.find(row=>row.access==='public');
  assert.ok(publicFile);await assert.rejects(media.hasPublicMedia('media/'+publicFile.logicalPath),error=>error.code==='studio_media_storage_unavailable');
  assert.equal(f.privateReads,0);
});

test('explicit local constructor uses the real scoped SQL registry and captured identity validation without a token',async()=>{
  const f=await neutralMediaFixture(),{registry,media}=f.build(()=>true);
  const loaded=await registry.load(),video=loaded.videos.find(row=>row.id===f.record.id);
  assert.ok(video?.available);assert.equal(video.sha256,f.record.sha256);
  const response=await registry.response(f.record.id,new Request('https://fixture.invalid/api/videos/'+f.record.id));
  assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),f.bytes);
  const snapshot=await f.repository.readPresentationSnapshot();
  assert.ok((await registry.loadCaptured(snapshot)).videos.find(row=>row.id===f.record.id)?.available);
  const captured=await registry.responseCaptured(f.record.id,new Request('https://fixture.invalid/api/videos/'+f.record.id,{method:'HEAD'}),snapshot);
  assert.equal(captured.status,200);assert.equal(f.privateReads,2);
  const other=structuredClone(snapshot);other.scope.workspaceId='another-workspace';
  await assert.rejects(registry.loadCaptured(other),error=>error.code==='studio_scope_mismatch');
  const changed=structuredClone(snapshot);changed.mediaRows.find(row=>row.id===f.record.id).sha256='f'.repeat(64);
  await assert.rejects(registry.loadCaptured(changed));assert.equal(f.privateReads,2);
  const publicFile=f.catalog.blobIndex.files.find(row=>row.access==='public');
  assert.equal(await media.hasPublicMedia('media/'+publicFile.logicalPath),true);
  const corrupt=structuredClone(f.catalog);corrupt.blobIndex.files.find(row=>row.logicalPath===publicFile.logicalPath).sha256='f'.repeat(64);
  f.pool.seedRuntimeCatalog(f.scope,corrupt);
  await assert.rejects(media.hasPublicMedia('media/'+publicFile.logicalPath),error=>error.code==='studio_media_storage_unavailable');
});

test('configuration construction rejects invalid ports and false, Promise, truthy or throwing ports grant no availability',async()=>{
  const f=await neutralMediaFixture();
  for(const port of [false,1,{},null])assert.throws(()=>f.build(port),TypeError);
  const publicFile=f.catalog.blobIndex.files.find(row=>row.access==='public');
  for(const port of [()=>false,()=>1,()=>({}),async()=>true,()=>{throw Error('local configuration unavailable');}]){
    const {reader,registry,media}=f.build(port);
    await assert.rejects(registry.load());await assert.rejects(media.hasPublicMedia('media/'+publicFile.logicalPath));
    try {
      const result=await reader.loadVideoRegistry({runtimeCatalog:f.catalog,env:{},readUploads:async()=>[]});
      assert.equal(result.summary.readable,false);assert.ok(result.videos.every(video=>video.available===false));
    } catch(error){assert.equal(error.message,'local configuration unavailable');}
  }
  assert.equal(f.privateReads,0);
});

test('media runtime default preserves its original token truthiness independently of constructor injection',async()=>{
  const f=await neutralMediaFixture(),{services}=f.build();
  const publicFile=f.catalog.blobIndex.files.find(row=>row.access==='public');
  for(const [token,allowed] of [['',false],[' ',true],['configured',true]]){
    const available=services.createStudioPublicMediaAvailability({env:{CROUPIER_MEDIA_STORAGE:'blob',BLOB_READ_WRITE_TOKEN:token},
      repositoryRoot,repository:f.repository,runtimeCatalog:f.catalog});
    if(allowed)assert.equal(await available('media/'+publicFile.logicalPath),true);
    else await assert.rejects(available('media/'+publicFile.logicalPath),error=>error.code==='studio_media_storage_unavailable');
  }
});

test('a partial local manifest grants only exact uploaded and bank storage tuples',async()=>{
  const f=await neutralMediaFixture(),bank=f.catalog.presentation.items[0];
  const bankStorage=f.catalog.blobIndex.files.find(row=>row.id===bank.id)?.storage;assert.ok(bankStorage);
  const uploaded={provider:'vercel-blob',pathname:f.record.pathname,sha256:f.record.sha256,size:f.record.size,contentType:f.record.contentType};
  const manifest=new Map([uploaded,bankStorage].map(row=>[row.pathname,{...row}]));
  const configured=(_env,storage)=>storage===undefined || Boolean(manifest.has(storage?.pathname)
    && ['provider','pathname','sha256','size','contentType'].every(key=>manifest.get(storage.pathname)[key]===storage[key]));
  const {registry}=f.build(configured),loaded=await registry.load();
  assert.equal(loaded.videos.find(row=>row.id===f.record.id).available,true);
  assert.equal(loaded.videos.find(row=>row.id===bank.id).available,true);
  const omitted=loaded.videos.filter(row=>row.id!==f.record.id && row.id!==bank.id);
  assert.ok(omitted.length>0);assert.ok(omitted.every(row=>row.available===false));
  manifest.get(f.record.pathname).sha256='f'.repeat(64);
  assert.equal((await registry.load()).videos.find(row=>row.id===f.record.id).available,false);
  assert.equal(f.privateReads,0,'configuration cannot replace the later byte-verifying reader');
});
