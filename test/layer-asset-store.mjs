import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioMemoryPool} from './fixtures/studio-memory-pool.mjs';
import {createStudioRepository} from '../web/storage/studio-repository.mjs';
import {createSeedProject} from '../lab/lib/studio-model.mjs';
import {createLayerUploadService} from '../lab/lib/layer-upload-service.mjs';
import {createLayerAssetApi} from '../lab/lib/layer-asset-api.mjs';
const scope={environment:'test',workspaceId:'layers'},actor='layer-admin';
const config={scope,apiBase:'/studio/api/admin',authBase:'/studio/api/auth',allowedOrigins:['https://public.example','https://studio.example'],publicHosts:['public.example','studio.example']};
const env={CROUPIER_MEDIA_STORAGE:'blob',BLOB_READ_WRITE_TOKEN:'fixture-not-a-secret'};
const prefix=Uint8Array.from([137,80,78,71,13,10,26,10,...new Array(24).fill(0)]);
async function fixture() {
  const pool=createStudioMemoryPool(),repository=createStudioRepository({pool,scope});
  await repository.initializeDocument('project',{actor,value:createSeedProject()});
  let clock=1000000,tokens=0,reads=0;
  const uploads=createLayerUploadService({repository,scope,ticketKey:new Uint8Array(32).fill(7),env,
    now:()=>clock,clientToken:async args=>{tokens++;assert.equal(args.allowOverwrite,false);assert.equal(args.maximumSizeInBytes,128);return 'fixture-capability';},
    privateMedia:async record=>{reads++;assert.match(record.pathname,/^croupier\/media\/backgrounds\//);return new Response(prefix);}});
  const prepare={operation:'prepare',sha256:'a'.repeat(64),size:128,contentType:'image/png',role:'background',label:'Night',width:720,height:1280};
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
