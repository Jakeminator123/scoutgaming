import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createStudioMemoryPool} from './fixtures/studio-memory-pool.mjs';
import {createStudioRepository} from '../packages/studio-registry/server/document-repository.mjs';
import {createSeedProject,addDealer} from '../packages/presentation/contracts/studio-model.mjs';
import {AsyncLocalStorage} from 'node:async_hooks';
import {wrapNativePresentationRepository} from '../apps/studio/lib/presentation-runtime-readiness.mjs';
import {presentationCapabilitiesForVersion} from '../packages/presentation/capability-contract.mjs';
import {createLayerUploadService} from '../apps/studio/lib/layer-upload-service.mjs';
import {createLayerAssetApi} from '../apps/studio/lib/layer-asset-api.mjs';
import {validateLayerAsset,layerAssetPath,layerAssetFitsGame} from '../packages/presentation/contracts/layer-asset-contract.mjs';
import {materialSource} from '../packages/presentation/contracts/material-catalog.mjs';
import {inspectLayerMedia} from '../apps/studio/lib/layer-media-inspection.mjs';
import {layerImage,layerBlobFixture} from './fixtures/layer-media.mjs';
import {createHmac} from 'node:crypto';
import {canonicalStudioJson} from '../packages/studio-registry/server/document-contract.mjs';
const scope={environment:'test',workspaceId:'layers'},actor='layer-admin';
const config={scope,apiBase:'/studio/api/admin',authBase:'/studio/api/auth',allowedOrigins:['https://public.example','https://studio.example'],publicHosts:['public.example','studio.example']};
const env={CROUPIER_MEDIA_STORAGE:'blob',BLOB_READ_WRITE_TOKEN:'fixture-not-a-secret'};
async function fixture() {
  const pool=createStudioMemoryPool(),repository=createStudioRepository({pool,scope});
  await repository.initializeDocument('project',{actor,value:createSeedProject()});
  let clock=1000000,tokens=0,reads=0;
  const media=await layerBlobFixture(after,await layerImage('png',720,1280));
  const uploads=createLayerUploadService({repository,scope,ticketKey:new Uint8Array(32).fill(7),env,
    now:()=>clock,clientToken:async args=>{tokens++;assert.equal(args.allowOverwrite,false);assert.equal(args.maximumSizeInBytes,media.size);return 'fixture-capability';},
    inspectMedia:async record=>{reads++;assert.match(record.pathname,/^croupier\/media\/backgrounds\//);return inspectLayerMedia(record,media.options);}});
  const prepare={operation:'prepare',sha256:media.sha256,size:media.size,contentType:'image/png',role:'background',label:'Night',width:720,height:1280};
  return {repository,uploads,prepare,counts:()=>({tokens,reads}),expire:()=>clock+=900001};
}
test('direct upload registers exact immutable bytes in the scoped project; replay is idempotent',async()=>{
  const {uploads,repository,prepare}=await fixture();
  const grant=await uploads.prepare(prepare,{actor});assert.match(grant.pathname,/^croupier\/media\/backgrounds\/[a-f0-9-]+\/[a-f0-9]{64}\.png$/);
  const input={operation:'commit',ticket:grant.ticket},context={actor,request:new Request('https://public.example/studio/api/layer-assets/upload'),stillAuthorized:async()=>true,mutationTransaction:work=>work()};
  const result=await uploads.commit(input,context);assert.equal(result.duplicate,false);assert.equal(result.project.layerAssets[0].id,grant.id);
  assert.equal((await uploads.commit(input,context)).duplicate,true);assert.equal((await repository.readDocument('project')).value.layerAssets.length,1);
});
test('expired, altered or foreign actor tickets never register; changed authorization rolls back',async()=>{
  const {uploads,repository,prepare,expire}=await fixture(),grant=await uploads.prepare(prepare,{actor});
  const context={actor,request:new Request('https://public.example/studio/api/layer-assets/upload'),stillAuthorized:async()=>false,mutationTransaction:work=>work()};
  for(const [ticket,user] of [[grant.ticket+'A',actor],[grant.ticket,'other']])await assert.rejects(uploads.commit({operation:'commit',ticket},{...context,actor:user}),error=>error.statusCode===403);
  await assert.rejects(uploads.commit({operation:'commit',ticket:grant.ticket},context),error=>error.statusCode===403);
  expire();await assert.rejects(uploads.commit({operation:'commit',ticket:grant.ticket},{...context,stillAuthorized:async()=>true}),error=>error.statusCode===403);
  assert.equal((await repository.readDocument('project')).value.layerAssets,undefined);
});
test('invalid MIME, SVG, role, dimension and byte limits cannot mint upload capabilities',async()=>{
  const {uploads,prepare,counts}=await fixture();
  for(const changes of [{contentType:'image/svg+xml'},{role:'dealer'},{size:134217729},{width:0},{label:'<script>'},{contentType:'constructor'}])await assert.rejects(uploads.prepare({...prepare,...changes},{actor}));
  assert.equal(counts().tokens,0);
});
test('a layer upload never mints or commits a miljöbild (illustration), which bypasses the v33 check',async()=>{
  const {uploads,repository,prepare,counts}=await fixture();
  await assert.rejects(uploads.prepare({...prepare,role:'illustration',label:'Miljö · miljöbild v1'},{actor}),error=>error.code==='studio_invalid_media'&&error.statusCode===422);
  assert.equal(counts().tokens,0);
  // A ticket signed before this restriction (same key, illustration record) is refused before any read.
  const draft={schemaVersion:1,id:'00000000-0000-4000-8000-0000000000b1',sha256:prepare.sha256,size:prepare.size,contentType:'image/png',role:'illustration',label:'Miljö · miljöbild v1',width:720,height:1280};
  const record={...draft,pathname:layerAssetPath(draft)},encoded=Buffer.from(canonicalStudioJson({v:1,actor,scope,record,expiresAt:1000000+60000})).toString('base64url');
  const ticket=`${encoded}.${createHmac('sha256',Buffer.alloc(32,7)).update(`studio-layer-upload-v1\0${encoded}`).digest('base64url')}`;
  const context={actor,request:new Request('https://public.example/studio/api/layer-assets/upload'),stillAuthorized:async()=>true,mutationTransaction:work=>work()};
  await assert.rejects(uploads.commit({operation:'commit',ticket},context),error=>error.code==='studio_upload_grant_invalid'&&error.statusCode===403);
  assert.equal(counts().reads,0);assert.equal((await repository.readDocument('project')).value.layerAssets,undefined);
});
test('library API keeps native role, scope and Origin gates; IDs cannot escape the scoped library',async()=>{
  const {uploads,repository}=await fixture();
  const runtime={config,repository,layerUploads:uploads,mutationTransaction:work=>work(),authorize:async()=>({user:actor,role:'admin',scope})};
  const api=createLayerAssetApi(runtime);
  assert.equal((await api.handle(new Request('https://public.example/api/layer-assets'))).status,200);
  const body=await (await api.handle(new Request('https://public.example/studio/api/layer-assets'))).json();assert.deepEqual(body.assets,[]);
  assert.equal((await api.handle(new Request('https://public.example/studio/api/layer-assets/00000000-0000-4000-8000-000000000001'))).status,404);
  const reader=createLayerAssetApi({...runtime,authorize:async()=>({user:actor,role:'reader',scope})});
  assert.equal((await reader.handle(new Request('https://public.example/studio/api/layer-assets'))).status,403);
  const foreign=createLayerAssetApi({...runtime,authorize:async()=>({user:actor,role:'admin',scope:{...scope,workspaceId:'other'}})});
  assert.equal((await foreign.handle(new Request('https://public.example/studio/api/layer-assets'))).status,403);
  assert.equal((await api.handle(new Request('https://public.example/studio/api/layer-assets/upload',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:'{}'}))).status,403);
});

async function nativeLayerFixture({capabilityVersion=3,onPreflight,onLock}={}) {
  const pool=createStudioMemoryPool(),rawRepository=createStudioRepository({pool,scope});
  await rawRepository.initializeDocument('project',{actor,value:addDealer(createSeedProject(),'linnea','Linnea')});
  const sqlContext=new AsyncLocalStorage(),events=[],descriptors=[],capabilities=[];
  let tokens=0,blobReads=0,principal={user:actor,role:'admin',scope};
  const media=await layerBlobFixture(after,await layerImage('png',1440,2560));
  const repository=wrapNativePresentationRepository(rawRepository,{env:{CROUPIER_BACKEND_ORIGIN:'https://render.example.invalid'},
    fetchImpl:async(url,options)=>{
      assert.notEqual(sqlContext.getStore(),true,'capability HTTP must finish before product/studio SQL');
      capabilities.push({url,version:options.headers['X-Presentation-Capability-Version']});events.push('capability');
      await onPreflight?.({rawRepository,pool,capabilities,revoke:()=>principal={...principal,role:'reader'}});
      return Response.json(presentationCapabilitiesForVersion(capabilityVersion));
    }});
  const uploads=createLayerUploadService({repository,scope,ticketKey:new Uint8Array(32).fill(7),env,
    clientToken:async()=>{tokens++;return 'fixture-capability';},inspectMedia:async record=>{
      assert.notEqual(sqlContext.getStore(),true,'Blob verification must finish before product/studio SQL');
      assert.match(record.pathname,/^croupier\/media\/tables\//);blobReads++;events.push('blob');return inspectLayerMedia(record,media.options);
    }});
  const mutationTransaction=(work,options={})=>{
    const snapshot=structuredClone(options.presentationMutation);descriptors.push(snapshot);
    return repository.withMutationContext(()=>sqlContext.run(true,async()=>{
      events.push('product-begin');await onLock?.({rawRepository,pool});return work();
    }),snapshot);
  };
  const api=createLayerAssetApi({config,repository,layerUploads:uploads,mutationTransaction,authorize:async()=>principal});
  const post=body=>api.handle(new Request('https://public.example/studio/api/layer-assets/upload',{method:'POST',
    headers:{origin:'https://public.example','sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify(body)}));
  const prepare={operation:'prepare',sha256:media.sha256,size:media.size,contentType:'image/png',role:'table',label:'Bord · Svart och guld',width:1440,height:2560};
  const prepared=await post(prepare);assert.equal(prepared.status,200);const grant=await prepared.json();
  return {api,pool,rawRepository,repository,post,prepare,grant,events,descriptors,capabilities,
    setCapabilityVersion:value=>{capabilityVersion=value;},
    counts:()=>({tokens,blobReads}),commit:()=>post({operation:'commit',ticket:grant.ticket})};
}

test('table game is strict, background-shared and immutable for known catalog hashes',()=>{
  const base={schemaVersion:1,id:'00000000-0000-4000-8000-000000000001',role:'table',label:'Bord',sha256:'a'.repeat(64),size:128,contentType:'video/webm',width:1920,height:1080};
  const record={...base,pathname:layerAssetPath(base)};
  for(const game of ['blackjack','roulette']){
    assert.equal(validateLayerAsset({...record,game}).game,game);
    assert.equal(layerAssetFitsGame({...record,game},game),true);
    assert.equal(layerAssetFitsGame({...record,game},game==='blackjack'?'roulette':'blackjack'),false);
  }
  for(const game of [null,'','shared','baccarat',undefined])assert.throws(()=>validateLayerAsset({...record,game}));
  const background={...base,role:'background'},shared={...background,pathname:layerAssetPath(background)};
  assert.throws(()=>validateLayerAsset({...shared,game:'roulette'}));
  assert.equal(layerAssetFitsGame(shared,'blackjack'),true);assert.equal(layerAssetFitsGame(shared,'roulette'),true);
  assert.equal(layerAssetFitsGame(record,'blackjack'),true);assert.equal(layerAssetFitsGame(record,'roulette'),false);
  const {kind,hasAlpha,...source}=materialSource('blackjack-green-felt');
  const known={...base,...source},saved={...known,pathname:layerAssetPath(known)};
  assert.throws(()=>validateLayerAsset({...saved,game:'roulette'}));
  assert.equal(validateLayerAsset({...saved,game:'blackjack'}).game,'blackjack');
});

test('tagged tables require v13 before grants and fresh v13 before commit Blob reads',async()=>{
  const f=await nativeLayerFixture({capabilityVersion:12}),before=f.pool.snapshot();
  const tagged={...f.prepare,game:'roulette'};
  const rejected=await f.post(tagged);assert.equal(rejected.status,503);
  assert.equal((await rejected.json()).code,'studio_presentation_runtime_update_required');
  assert.deepEqual(f.counts(),{tokens:1,blobReads:0});assert.deepEqual(f.pool.snapshot(),before);
  f.setCapabilityVersion(13);
  const prepared=await f.post(tagged);assert.equal(prepared.status,200);const grant=await prepared.json();
  const payload=JSON.parse(Buffer.from(grant.ticket.split('.')[0],'base64url').toString('utf8'));
  assert.equal(payload.record.game,'roulette');
  f.setCapabilityVersion(12);
  assert.equal((await f.post({operation:'commit',ticket:grant.ticket})).status,503);
  assert.deepEqual(f.counts(),{tokens:2,blobReads:0});assert.deepEqual(f.pool.snapshot(),before);
  f.setCapabilityVersion(13);
  const committed=await f.post({operation:'commit',ticket:grant.ticket});assert.equal(committed.status,200);
  const receipt=await committed.json();assert.equal(receipt.project.layerAssets[0].game,'roulette');
  assert.equal(f.capabilities.every(call=>call.version==='13'),true);
  const replay=await f.post({operation:'commit',ticket:grant.ticket});assert.equal((await replay.json()).duplicate,true);
});

test('an uploaded layer cannot change game or bytes through project PUT, while labels remain editable',async()=>{
  const f=await nativeLayerFixture({capabilityVersion:13});
  const prepared=await f.post({...f.prepare,game:'roulette'}),grant=await prepared.json();
  assert.equal((await f.post({operation:'commit',ticket:grant.ticket})).status,200);
  const saved=await f.rawRepository.readDocument('project');
  for(const patch of [{game:'blackjack'},{game:undefined},{width:800},{size:512}]){
    const value=structuredClone(saved.value);Object.assign(value.layerAssets[0],patch);
    if(patch.game===undefined&&Object.hasOwn(patch,'game'))delete value.layerAssets[0].game;
    await assert.rejects(f.rawRepository.saveDocument('project',{value,expectedRevision:saved.revision,actor}),error=>error.code==='studio_layer_asset_immutable');
  }
  const renamed=structuredClone(saved.value);renamed.layerAssets[0].label='Nytt namn';
  await f.rawRepository.saveDocument('project',{value:renamed,expectedRevision:saved.revision,actor});
});

test('native Linnea layer commit preflights the real project and verified grant before SQL; same-ticket retry is idempotent',async()=>{
  const f=await nativeLayerFixture(),before=f.pool.snapshot();
  const committed=await f.commit();assert.equal(committed.status,200);const first=await committed.json();
  assert.equal(first.duplicate,false);assert.equal(first.id,f.grant.id);
  assert.equal(first.project.layerAssets[0].pathname,f.grant.pathname);
  assert.deepEqual(f.capabilities,[{url:'https://render.example.invalid/api/presentation/capabilities',version:'3'}]);
  assert.deepEqual(f.events,['blob','capability','product-begin']);
  const descriptor=f.descriptors[0];assert.equal(descriptor.kind,'project');
  assert.ok(descriptor.value.dealers.some(row=>row.id==='linnea'));
  assert.deepEqual(descriptor.value.layerAssets,first.project.layerAssets);
  assert.equal(descriptor.value.layerAssets[0].sha256,f.prepare.sha256);
  const after=f.pool.snapshot();assert.equal(after.history.length,before.history.length+1);assert.equal(after.audits.length,before.audits.length+1);
  const replay=await f.commit();assert.equal(replay.status,200);const duplicate=await replay.json();
  assert.equal(duplicate.id,first.id);assert.equal(duplicate.duplicate,true);assert.equal(duplicate.project.layerAssets.length,1);
  assert.deepEqual(f.pool.snapshot(),after);assert.deepEqual(f.counts(),{tokens:1,blobReads:2});
});

test('native layer commit rejects missing v3 before any product transaction or project write',async()=>{
  const f=await nativeLayerFixture({capabilityVersion:2}),before=f.pool.snapshot();
  const response=await f.commit();assert.equal(response.status,503);
  assert.equal((await response.json()).code,'studio_presentation_runtime_update_required');
  assert.deepEqual(f.events,['blob','capability']);assert.deepEqual(f.pool.snapshot(),before);
});

test('native layer commit reauthorizes inside the product lock after capability preflight',async()=>{
  const f=await nativeLayerFixture({onPreflight:async({revoke})=>revoke()}),before=f.pool.snapshot();
  const response=await f.commit();assert.equal(response.status,403);
  assert.deepEqual(f.events,['blob','capability','product-begin']);assert.deepEqual(f.pool.snapshot(),before);
});

test('native layer revision CAS preserves a project edited during preflight; the same ticket retries safely',async()=>{
  const f=await nativeLayerFixture({onPreflight:async({rawRepository,capabilities})=>{
    if(capabilities.length!==1)return;
    const saved=await rawRepository.readDocument('project'),value=structuredClone(saved.value);
    value.dealers.find(row=>row.id==='linnea').label='Linnea edited during preflight';
    await rawRepository.saveDocument('project',{expectedRevision:saved.revision,value,actor});
  }});
  const first=await f.commit();assert.equal(first.status,409);
  const raced=await f.rawRepository.readDocument('project');assert.equal(raced.value.layerAssets,undefined);
  assert.equal(raced.value.dealers.find(row=>row.id==='linnea').label,'Linnea edited during preflight');
  const retried=await f.commit();assert.equal(retried.status,200);const receipt=await retried.json();
  assert.equal(receipt.id,f.grant.id);assert.equal(receipt.duplicate,false);assert.equal(receipt.project.layerAssets.length,1);
  assert.equal(receipt.project.dealers.find(row=>row.id==='linnea').label,'Linnea edited during preflight');
  assert.deepEqual(f.counts(),{tokens:1,blobReads:2});
});

test('native layer audit failure rolls back project, history and audit; exact-ticket retry remains available',async()=>{
  const f=await nativeLayerFixture(),before=f.pool.snapshot();f.pool.failNext('audit');
  const failed=await f.commit();assert.equal(failed.status,503);assert.deepEqual(f.pool.snapshot(),before);
  const retried=await f.commit();assert.equal(retried.status,200);assert.equal((await retried.json()).id,f.grant.id);
  assert.equal((await f.rawRepository.readDocument('project')).value.layerAssets.length,1);
  assert.equal(f.counts().tokens,1);
});

test('concurrent native commits of one ticket register one layer UUID and return one duplicate receipt',async()=>{
  const f=await nativeLayerFixture(),before=f.pool.snapshot();
  const responses=await Promise.all([f.commit(),f.commit()]);assert.ok(responses.every(response=>response.status===200));
  const receipts=await Promise.all(responses.map(response=>response.json()));
  assert.deepEqual(receipts.map(row=>row.duplicate).sort(),[false,true]);assert.ok(receipts.every(row=>row.id===f.grant.id));
  assert.equal((await f.rawRepository.readDocument('project')).value.layerAssets.length,1);
  const after=f.pool.snapshot();assert.equal(after.history.length,before.history.length+1);assert.equal(after.audits.length,before.audits.length+1);
  assert.equal(f.counts().tokens,1);
});
