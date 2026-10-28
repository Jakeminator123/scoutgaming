import test from 'node:test';
import { seedSavedVideoProject } from './fixtures/video-dealer-project.mjs';
import {RETAINED_BANK_VARIANTS,createRetainedStudioMedia} from '../../../packages/studio-registry/server/document-contract.mjs';
import {loadVideoRegistry,getVideoResponse} from './fixtures/local-video-registry.mjs';

test('retained originals join exact families beside current bank bytes without replacing standards',async t=>{
  const {registry,repository,items}=await fixture(t);
  for(const tuple of RETAINED_BANK_VARIANTS)await repository.registerMedia(createRetainedStudioMedia(tuple.id),{actor:'explicit-original-import'});
  const result=await registry.load();assert.equal(result.videos.length,items.length+6);
  assert.deepEqual(result.families.flatMap(family=>family.standardIds).sort(),items.map(item=>item.id).sort());
  for(const original of RETAINED_BANK_VARIANTS){
    const video=result.videos.find(row=>row.id===original.id),family=result.families.find(row=>row.id===original.familyId);
    assert.equal(video.sha256,original.sha256);assert.equal(video.bytes,original.size);assert.equal(video.retainedBank,true);
    assert.equal(video.source,'emil');assert.equal(video.familyId,original.familyId);assert.equal(video.role,'variant');
    assert.equal(video.reviewStatus,'unreviewed');assert.ok(family.variantIds.includes(original.id));
    const response=await registry.response(original.id,new Request(`https://studio.example.invalid/studio/api/videos/${original.id}`,{method:'HEAD'}));
    assert.equal(response.status,404,'missing retained bytes must never substitute current same-name bank files');
  }
});

test('both registry and byte reader reject a substituted retained tuple before provider access',async t=>{
  const {env,options}=await fixture(t),record=createRetainedStudioMedia(RETAINED_BANK_VARIANTS[0].id);
  const row={id:record.id,sha256:record.sha256,size:record.size,extension:'mp4',classification:record.classification,retainedBank:{...record.retainedBank,familyId:'astrid/deal.player.left/box1'},
    storage:{provider:'vercel-blob',pathname:record.pathname,sha256:record.sha256,size:record.size,contentType:record.contentType}};
  let reads=0;
  const configured={...options,env,readUploads:async()=>[row],readClassifications:async()=>[],blobClient:{get:async()=>{reads++;throw Error('must not read');}}};
  await assert.rejects(loadVideoRegistry(configured),error=>error.status===503);
  assert.equal((await getVideoResponse(record.id,new Request(`https://studio.example.invalid/studio/api/videos/${record.id}`),configured)).status,503);
  assert.equal(reads,0);
});
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createNeonVideoRegistry } from '../lib/neon-video-registry.mjs';
import { MEDIA_FAMILY_DEFINITIONS, videoIdFromSha256 } from '../../../packages/studio-registry/server/video-manifest.mjs';
import { mediaBlobPath } from '../lib/cloud-media-store.mjs';
import { createStudioRepository } from '../../../packages/studio-registry/server/document-repository.mjs';
import { createStudioMemoryPool } from '../../../test/fixtures/studio-memory-pool.mjs';
import {createEmptyRuntimeMediaCatalog} from '../../../packages/studio-registry/server/runtime-catalog.mjs';
import {createEmptyProject,addDealer} from '../../../packages/presentation/contracts/studio-model.mjs';
import {createStudioUploadService} from '../lib/studio-upload-service.mjs';
import {wrapNativePresentationRepository} from '../lib/presentation-runtime-readiness.mjs';
import {presentationCapabilitiesForVersion,PRESENTATION_CAPABILITY_VERSION_HEADER} from '../../../packages/presentation/capability-contract.mjs';
import {serveAdminWorkspaceData} from '../lib/admin-workspace-data.mjs';

const scope = Object.freeze({ environment: 'test', workspaceId: 'studio-test' });
async function fixture(t,{empty=false}={}) {
  const root = await mkdtemp(join(tmpdir(), 'croupier-neon-registry-'));
  t.after(() => {
    assert.equal(dirname(resolve(root)), resolve(tmpdir())); assert.match(basename(root), /^croupier-neon-registry-/);
    return rm(root, { recursive: true, force: true });
  });
  const archive = join(root, 'media/dealers/astrid/runtime/presentation'); await mkdir(archive, {recursive:true});
  const pool = createStudioMemoryPool();
  // This registry fixture has no operators or packages. Keep real archive checks,
  // while supplying the scoped empty directory used by the lifecycle test fixture.
  const connect=pool.connect.bind(pool);pool.connect=async()=>{const client=await connect(),query=client.query.bind(client);client.query=(sql,values)=>sql.includes('/* operator-store:list-operators */')?Promise.resolve({rows:[]}):query(sql,values);return client;};
  const repository = createStudioRepository({ pool, scope });
  if(empty)seedSavedVideoProject(pool,scope,createEmptyProject());else seedSavedVideoProject(pool,scope);
  const objects = new Map(), items = [], files = [], layout = [];
  for (const family of empty?[]:MEDIA_FAMILY_DEFINITIONS) for (const relativePath of family.standardPaths) {
    const bytes = Buffer.from(`0000ftypisom00000fixture:${relativePath}`), sha256 = createHash('sha256').update(bytes).digest('hex'), id = videoIdFromSha256(sha256);
    const logicalPath = `dealers/astrid/runtime/presentation/${relativePath}`, directory = logicalPath.slice(0, logicalPath.lastIndexOf('/'));
    const pathname = mediaBlobPath(directory, id, sha256, 'mp4'); objects.set(pathname, bytes);
    items.push({id, familyId:family.id, role:'standard', relativePath, extension:'mp4', size:bytes.length, sha256});
    files.push({logicalPath, id, access:'source', sha256, size:bytes.length, storage:{provider:'vercel-blob',pathname,sha256,size:bytes.length,contentType:'video/mp4'}});
    layout.push({path:logicalPath, legacyPath:`fixture/${relativePath}`, access:'source', sha256, size:bytes.length});
  }
  const families = (empty?[]:MEDIA_FAMILY_DEFINITIONS).map(family => ({id:family.id,dealerId:family.dealerId,eventId:family.eventId,situation:family.situation,playbackType:family.playbackType,
    standardIds: family.standardPaths.map(path => items.find(item => item.relativePath === path).id), variantIds:[]}));
  const runtimeCatalog=empty?createEmptyRuntimeMediaCatalog():{schemaVersion:1,layout:{schemaVersion:1,roots:{},files:layout},
    presentation:{schemaVersion:2,source:'emil/dealklipp-v1',families,items},
    blobIndex:{schemaVersion:1,namespace:'croupier/media',verification:'readback-sha256',files},legacy:{schemaVersion:2,entries:{}}};
  pool.seedRuntimeCatalog(scope,runtimeCatalog);
  await writeFile(join(archive,'lab-video-manifest.json'), JSON.stringify(runtimeCatalog.presentation));
  await writeFile(join(root,'media/layout.json'), JSON.stringify(runtimeCatalog.layout));
  const indexPath = join(root,'media/blob-index.json');
  await writeFile(indexPath, JSON.stringify({schemaVersion:1,namespace:'croupier/media',verification:'readback-sha256',files}));
  const uploadDir = join(root,'retired-uploads'); await mkdir(uploadDir);
  await writeFile(join(uploadDir,'index.json'), 'deliberately invalid old register must not be read');
  await writeFile(join(uploadDir,'classifications.json'), 'retired classifications must not be read');
  const env = {CROUPIER_MEDIA_STORAGE:'blob',BLOB_READ_WRITE_TOKEN:'fixture-secret',CROUPIER_MEDIA_BLOB_INDEX:indexPath};
  const blobClient = { async get(path) {
    const bytes = objects.get(path); if (!bytes) return null;
    return {statusCode:200,stream:new Response(bytes).body,blob:{pathname:path,url:`https://fixture.private.blob.vercel-storage.com/${path}`,size:bytes.length,contentType:'video/mp4'}};
  }};
  const options = {repositoryRoot:root,uploadDir,cacheDir:join(root,'scratch'),blobClient};
  const registry = createNeonVideoRegistry({repository,scope,env,options});
  async function newMedia() {
    const bytes = Buffer.from('0000ftypisom00000new-upload-fixture'), sha256 = createHash('sha256').update(bytes).digest('hex'), id = randomUUID();
    const record = {id,sha256,size:bytes.length,contentType:'video/mp4',pathname:mediaBlobPath('dealers/astrid/review/uploads',id,sha256,'mp4'),
      classification:{dealerId:'astrid',eventId:'deal.player.left',kind:'action',role:'alternative',situation:'box0',familyId:'astrid/deal.player.left/box0',label:'New exact clip',notes:''}};
    objects.set(record.pathname,bytes); await repository.registerMedia(record,{actor:'Operator'}); return {record,bytes};
  }
  return {root,pool,repository,registry,env,options,items,objects,newMedia,runtimeCatalog};
}
test('native registry preserves the active bank and exact Neon variants without reading retired disk indexes', async t => {
  const {registry,newMedia,items,env,root} = await fixture(t), {record} = await newMedia();
  await rm(join(root,'media'),{recursive:true});
  const result = await registry.load(); assert.equal(result.videos.length, items.length + 1);
  const video = result.videos.find(row => row.id === record.id);
  assert.equal(video.available,true); assert.equal(video.storage,'private-blob'); assert.equal(video.bindingScope,'shared-local');
  assert.equal(video.familyId,'astrid/deal.player.left/box0'); assert.equal(video.role,'variant'); assert.equal(video.reviewStatus,'unreviewed');
  assert.ok(result.families.find(family => family.id === video.familyId).variantIds.includes(record.id));
  assert.deepEqual(result.families.flatMap(family => family.standardIds).sort(),items.map(item => item.id).sort());
  const publicData = JSON.stringify(result); assert.ok(!publicData.includes(env.BLOB_READ_WRITE_TOKEN)); assert.ok(!publicData.includes(root)); assert.ok(!publicData.includes(record.pathname));
});
test('unavailable Neon does not become an empty review library or disk fallback', async t => {
  const {pool,registry} = await fixture(t); pool.failNext('list-media',new Error('private database detail'));
  await assert.rejects(registry.load(), error => error.statusCode === 503 && error.code === 'studio_storage_unavailable');
});
test('missing cloud source, wrong scope or corrupted immutable manifest is rejected', async t => {
  const {registry,repository,env,options,pool,runtimeCatalog} = await fixture(t);
  assert.throws(() => createNeonVideoRegistry({repository,scope:{...scope,workspaceId:'other'},env,options}), error => error.statusCode === 503);
  await assert.rejects(createNeonVideoRegistry({repository,scope,env:{...env,CROUPIER_MEDIA_STORAGE:'disk'},options}).load(), error => error.code === 'studio_media_storage_unavailable');
  pool.seedRuntimeCatalog(scope,{...runtimeCatalog,presentation:{invalid:true}});
  await assert.rejects(registry.load(),error => error.statusCode === 503);
  await assert.rejects(createNeonVideoRegistry({repository:{...repository,readRuntimeCatalog:undefined},scope,env,options}).load(),error=>error.statusCode===503);
});
test('active bank and new Neon preview use verified private Blob bytes with HEAD/Range', async t => {
  const {registry,newMedia,items,objects} = await fixture(t), {record,bytes} = await newMedia();
  const req = (id,method = 'GET',headers = {}) => new Request(`https://studio.example.invalid/studio/api/videos/${id}`,{method,headers});
  const head = await registry.response(record.id,req(record.id,'HEAD')); assert.equal(head.status,200); assert.equal(head.headers.get('content-length'),String(bytes.length));
  const range = await registry.response(record.id,req(record.id,'GET',{range:'bytes=2-8'})); assert.equal(range.status,206);
  assert.deepEqual(Buffer.from(await range.arrayBuffer()),bytes.subarray(2,9));
  const active = await registry.response(items[0].id,req(items[0].id)); assert.equal(active.status,200);
  assert.equal(createHash('sha256').update(Buffer.from(await active.arrayBuffer())).digest('hex'),items[0].sha256);
  objects.clear();
  assert.equal((await registry.response(randomUUID(),req(randomUUID()))).status,404);
});

test('captured inventory never rereads a later Studio registry or classification, including media byte verification',async t=>{
  const {repository,registry,newMedia}=await fixture(t),{record}=await newMedia();
  await repository.initializeDocument('administration',{value:{rooms:[]},revision:'admin-capture',actor:'tester'});
  const snapshot=await repository.readPresentationSnapshot();
  const captured=snapshot.mediaRows.find(row=>row.id===record.id);
  await repository.classifyMedia(record.id,{sha256:record.sha256,expectedRevision:captured.revision,metadata:{...record.classification,label:'Later label'},actor:'tester'});
  const beforeReads=repository.readDocument;
  // This separately constructed adapter proves loadCaptured cannot consult
  // current DB registration/media even when the repository methods are broken.
  const {env,options}=await fixture(t);
  const adapter=createNeonVideoRegistry({repository:{scope,listMedia:async()=>{throw Error('latest media forbidden');},readDocument:async()=>{throw Error('latest project forbidden');}},scope,env,options});
  const inventory=await adapter.loadCaptured(snapshot);
  assert.equal(inventory.videos.find(row=>row.id===record.id).classification.label,record.classification.label);
  assert.equal((await registry.load()).videos.find(row=>row.id===record.id).classification.label,'Later label');
  await registry.verifyCapturedMedia([{record,revision:captured.revision,id:record.id}]);
  assert.equal(repository.readDocument,beforeReads);
});
test('captured inventory rejects foreign scope/registration and unavailable selected immutable bytes',async t=>{
  const {repository,registry,newMedia,objects}=await fixture(t),{record}=await newMedia();
  await repository.initializeDocument('administration',{value:{rooms:[]},revision:'admin-capture',actor:'tester'});
  const snapshot=await repository.readPresentationSnapshot();
  await assert.rejects(registry.loadCaptured({...snapshot,scope:{...scope,workspaceId:'other'}}),e=>e.statusCode===409);
  const tampered=structuredClone(snapshot);tampered.mediaRows[0].classification.dealerId='johanna';
  await assert.rejects(registry.loadCaptured(tampered),e=>e.statusCode===503||e.statusCode===422);
  // A fresh UUID/path avoids the verified readback cache of the prior upload.
  objects.delete(record.pathname);
  await assert.rejects(registry.verifyCapturedMedia([{record,id:record.id,revision:snapshot.mediaRows[0].revision}]),e=>e.code==='studio_media_storage_unavailable');
});

test('captured bank response uses its original catalog after current Neon metadata changes',async t=>{
  const f=await fixture(t);
  await f.repository.initializeDocument('administration',{value:{rooms:[]},revision:'admin-capture',actor:'tester'});
  const snapshot=await f.repository.readPresentationSnapshot(),id=f.items[0].id;
  const request=()=>new Request(`https://studio.example.invalid/studio/api/videos/${id}`);
  f.pool.seedRuntimeCatalog(scope,{...f.runtimeCatalog,presentation:{invalid:true}});
  await assert.rejects(f.registry.response(id,request()),error=>error.statusCode===503);
  const response=await f.registry.responseCaptured(id,request(),snapshot);
  assert.equal(response.status,200);
  assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),f.items[0].sha256);
  await assert.rejects(f.registry.loadCaptured({...snapshot,runtimeCatalog:undefined}),error=>error.statusCode===503);
});

test('trash dealer uploads remain readable in live and captured inventory without active registration',async t=>{
 const {addDealer}=await import('../../../packages/presentation/contracts/studio-model.mjs');
 const {changeDealerLifecycle,checkDealerArchive}=await import('../lib/dealer-lifecycle.mjs');
 const f=await fixture(t),current=await f.repository.readDocument('project');
 const project=addDealer(current.value,'paow','PAOW');
 seedSavedVideoProject(f.pool,scope,project);
 await f.repository.initializeDocument('administration',{value:{},actor:'Admin'});
 const {record:original,bytes}=await f.newMedia();
 const id=randomUUID(),record={...original,id,pathname:mediaBlobPath('dealers/paow/review/uploads',id,original.sha256,'mp4'),classification:{dealerId:'paow',eventId:'idle.ready',kind:'idle',role:'alternative',situation:'',label:'PAOW',notes:''}};
 f.objects.set(record.pathname,bytes);await f.repository.registerMedia(record,{actor:'Admin'});
 const {impact}=await checkDealerArchive({repository:f.repository,body:{dealerId:'paow',expectedRevision:project.revision}});
 const archived=await changeDealerLifecycle({repository:f.repository,mutationTransaction:work=>work(),stillAuthorized:async()=> 'Admin',body:{dealerId:'paow',archived:true,expectedRevision:project.revision,impactToken:impact.token}});
 const live=await f.registry.load(),captured=await f.registry.loadCaptured(await f.repository.readPresentationSnapshot());
 for(const inventory of [live,captured]){const video=inventory.videos.find(row=>row.id===id);assert.equal(video.dealer,'paow');assert.equal(video.classification.archived,true);assert.match(video.revision,/^studio-/);}
 assert.equal(archived.dealers.some(row=>row.id==='paow'),false);
 const rows=await f.repository.listMedia();
 const deletedRepo={...f.repository,listMedia:async()=>rows.map(row=>row.id===id?{...row,deletion:{state:'pending',requestedAt:'2026-10-11T20:00:00.000Z'}}:row)};
 const pending=createNeonVideoRegistry({repository:deletedRepo,scope,env:f.env,options:f.options});
 const blocked=(await pending.load()).videos.find(row=>row.id===id);assert.equal(blocked.available,false);assert.equal(blocked.previewUrl,null);
 assert.equal((await pending.response(id,new Request(`https://studio.example.invalid/studio/api/videos/${id}`))).status,410);
 const removedRepo={...f.repository,listMedia:async()=>rows.map(row=>row.id===id?{...row,deletion:{state:'deleted',requestedAt:'2026-10-11T20:00:00.000Z',completedAt:'2026-10-11T20:00:01.000Z'}}:row)};
 const removed=createNeonVideoRegistry({repository:removedRepo,scope,env:f.env,options:f.options});
 assert.equal((await removed.load()).videos.some(row=>row.id===id),false);
 const afterDealerDeletion={...removedRepo,readDocument:async kind=>{const doc=await f.repository.readDocument(kind);if(kind==='project')doc.value.dealerTrash=[];return doc;}};
 assert.equal((await createNeonVideoRegistry({repository:afterDealerDeletion,scope,env:f.env,options:f.options}).load()).videos.some(row=>row.id===id),false);
 assert.equal((await removed.response(id,new Request(`https://studio.example.invalid/studio/api/videos/${id}`))).status,410);
});


test('empty scoped bank supports Admin intake, captured revisions and verified private Blob responses without disk media',async t=>{
 const f=await fixture(t,{empty:true});
 await rm(join(f.root,'media'),{recursive:true});
 await f.repository.initializeDocument('administration',{actor:'Operator',value:{rooms:[],gameLanes:[],gameLane:null}});
 const runtime={videoRegistry:f.registry.load,gamePolicy:{readSaved:async()=>({project:(await f.repository.readDocument('project')).value})}};
 const workspace=await serveAdminWorkspaceData(new Request('https://studio.example.invalid/studio/api/admin/workspace/videos'),{authorize:async()=>{},runtime:async()=>runtime});
 const initial=await workspace.json();assert.equal(workspace.status,200);assert.deepEqual(initial.videos.videos,[]);assert.deepEqual(initial.videos.families,[]);
 assert.deepEqual(initial.project.dealers,[]);assert.equal(initial.videos.summary.readable,true);
 assert.doesNotMatch(JSON.stringify(initial.videos),/emil|astrid/i);
 const saved=await f.repository.readDocument('project');
 await f.repository.saveDocument('project',{actor:'Operator',expectedRevision:saved.revision,value:addDealer(saved.value,'newdealer','Synthetic dealer')});
 const native=wrapNativePresentationRepository(f.repository,{env:{CROUPIER_BACKEND_ORIGIN:'https://render.fixture.invalid'},fetchImpl:async(_url,init)=>Response.json(presentationCapabilitiesForVersion(Number(init.headers[PRESENTATION_CAPABILITY_VERSION_HEADER]??2)))});
 let grants=0;
 const service=createStudioUploadService({repository:native,scope,ticketKey:Buffer.alloc(32,9),env:f.env,options:f.options,
  clientToken:async()=>{grants++;return 'synthetic-private-upload-grant';}});
 const bytes=Buffer.from('0000ftypisom00000empty-bank-upload'),sha256=createHash('sha256').update(bytes).digest('hex');
 const input={operation:'prepare',sha256,size:bytes.length,contentType:'video/mp4',classification:{dealerId:'newdealer',eventId:'idle.ready',kind:'idle',role:'alternative',situation:'',label:'Synthetic idle',notes:''}};
 const grant=await service.prepare(input,{actor:'Operator'});
 const request=new Request('https://studio.example.invalid/studio/api/videos/upload',{method:'POST'});
 const context={actor:'Operator',request,stillAuthorized:async()=>true,
  mutationTransaction:(work,options)=>native.withMutationContext(work,options.presentationMutation)};
 const wrong=Buffer.from(bytes);wrong[wrong.length-1]^=1;f.objects.set(grant.pathname,wrong);
 await assert.rejects(service.commit({operation:'commit',ticket:grant.ticket},context),{code:'studio_upload_bytes_unavailable'});
 assert.equal(f.pool.snapshot().media.size,0);
 f.objects.set(grant.pathname,bytes);
 assert.deepEqual(await service.commit({operation:'commit',ticket:grant.ticket},context),{id:grant.id,duplicate:false});assert.equal(grants,1);
 const inventory=await f.registry.load();assert.equal(inventory.videos.length,1);assert.deepEqual(inventory.families,[]);
 assert.equal(inventory.videos[0].id,grant.id);assert.equal(inventory.videos[0].storage,'private-blob');
 const req=(method='GET',headers={})=>new Request('https://studio.example.invalid/studio/api/videos/'+grant.id,{method,headers});
 assert.equal((await f.registry.response(grant.id,req('HEAD'))).headers.get('content-length'),String(bytes.length));
 const partial=await f.registry.response(grant.id,req('GET',{range:'bytes=2-8'}));assert.equal(partial.status,206);assert.deepEqual(Buffer.from(await partial.arrayBuffer()),bytes.subarray(2,9));
 const snapshot=await f.repository.readPresentationSnapshot(),captured=snapshot.mediaRows[0];
 const {revision,updatedAt,...record}=captured;
 await f.registry.verifyCapturedMedia([{record,revision,id:record.id}]);
 await f.repository.classifyMedia(grant.id,{actor:'Operator',sha256,expectedRevision:captured.revision,metadata:{...captured.classification,label:'Later label'}});
 assert.equal((await f.registry.loadCaptured(snapshot)).videos[0].classification.label,'Synthetic idle');
 assert.equal((await f.registry.load()).videos[0].classification.label,'Later label');
 const response=await f.registry.responseCaptured(grant.id,req(),snapshot);assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
 await assert.rejects(f.registry.loadCaptured({...snapshot,scope:{...scope,workspaceId:'foreign'}}),e=>e.statusCode===409);
 await assert.rejects(f.registry.loadCaptured({...snapshot,runtimeCatalog:{...snapshot.runtimeCatalog,revision:'invalid'}}),e=>e.statusCode===503);
 await assert.rejects(createNeonVideoRegistry({repository:f.repository,scope,env:{...f.env,BLOB_READ_WRITE_TOKEN:''},options:f.options}).load(),{code:'studio_media_storage_unavailable'});
 assert.deepEqual((await f.repository.readRuntimeCatalog()).value,createEmptyRuntimeMediaCatalog(),'uploads never rewrite the immutable bank');
});

test('captured registry preserves optional timing without rereading or rebuilding measured evidence',async t=>{
  const {repository,registry,newMedia}=await fixture(t),{record}=await newMedia();
  await repository.initializeDocument('administration',{value:{rooms:[]},revision:'admin-timing',actor:'tester'});
  const snapshot=structuredClone(await repository.readPresentationSnapshot()),row=snapshot.mediaRows.find(row=>row.id===record.id);
  row.mediaTiming={schemaVersion:1,mediaId:row.id,sha256:row.sha256,size:row.size,recordedSpeechIdentitySha256:null,
    video:{trackId:1,frameCount:24,fps:24,firstPtsUs:0,lastPtsUs:958333,endUs:1000000},audio:[],endUs:1000000,audioTailUs:0};
  const expected=structuredClone(row.mediaTiming),captured=await registry.loadCaptured(snapshot);
  const projected=captured.videos.find(video=>video.id===row.id);
  assert.deepEqual(projected.mediaTiming,expected);
  projected.mediaTiming.video.endUs=9;
  assert.deepEqual(row.mediaTiming,expected,'consumer mutation cannot change the captured receipt');
  assert.equal(Object.hasOwn((await registry.load()).videos.find(video=>video.id===row.id),'mediaTiming'),false,'old live row remains unchanged');
  row.mediaTiming.sha256='d'.repeat(64);
  await assert.rejects(registry.loadCaptured(snapshot));
});
