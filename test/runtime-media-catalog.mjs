import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,access} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {buildRuntimeMediaCatalog} from '../tools/build-runtime-media-catalog.mjs';
import {createStudioMediaRuntime} from '../apps/studio/lib/studio-media-runtime.mjs';
import {createRegisteredDealerIdle} from '../packages/presentation/server/registered-dealer-idle.mjs';
import {createRegisteredVoiceLines} from '../apps/studio/lib/studio-voice-lines.mjs';
import {createStudioMemoryPool} from './fixtures/studio-memory-pool.mjs';
import {readRuntimeCatalogFixture} from './fixtures/runtime-media-catalog.mjs';
import {createStudioRepository} from '../packages/studio-registry/server/document-repository.mjs';
import {createSeedProject,addDealer} from '../packages/presentation/contracts/studio-model.mjs';
const source=fileURLToPath(new URL('../',import.meta.url));
test('shared deployment catalog matches original authoring metadata',async()=>{await buildRuntimeMediaCatalog(resolve(source),{check:true});});
test('historical catalog remains readable while only an explicitly saved cloud idle can play without dealer directories',async t=>{
  const root=await mkdtemp(join(tmpdir(),'croupier-catalog-'));
  t.after(async()=>{assert.equal(dirname(root),resolve(tmpdir()));await rm(root,{recursive:true,force:true});});
  await assert.rejects(access(join(root,'media')));
  const scope={environment:'catalog_test',workspaceId:'croupier'},pool=createStudioMemoryPool(),repository=createStudioRepository({pool,scope});
  pool.seedRuntimeCatalog(scope,readRuntimeCatalogFixture());
  const project=addDealer(createSeedProject(),'paow','PAOW');
  const id='11111111-1111-4111-8111-111111111111',sha256='b'.repeat(64);
  const line=project.lines.find(row=>row.dealerId==='paow'&&row.eventId==='idle.ready');
  line.variants.find(row=>row.id===line.baselineVariantId).videoGenerationId=id;
  await repository.initializeDocument('project',{value:project,revision:'catalog-project',actor:'fixture'});
  await repository.initializeDocument('administration',{value:{rooms:[],legacyClipReview:{sourceSha256:'a'.repeat(64),neverAgain:{}}},revision:'catalog-admin',actor:'fixture'});
  await repository.registerMedia({id,sha256,size:32,contentType:'video/mp4',pathname:'croupier/media/dealers/paow/review/uploads/'+id+'/'+sha256+'.mp4',classification:{dealerId:'paow',eventId:'idle.ready',kind:'idle',role:'standard',situation:'',label:'PAOW idle',notes:''}},{actor:'fixture'});
  const env={CROUPIER_MEDIA_STORAGE:'blob',BLOB_READ_WRITE_TOKEN:'fixture'};
  const media=createStudioMediaRuntime({repository,scope,repositoryRoot:root,env});
  const idle=createRegisteredDealerIdle({registryLoader:media.videoRegistry});
  for(const dealer of ['astrid','vera','amira','mei'])assert.equal(await idle(dealer,project),null,'catalog metadata cannot supply a missing saved baseline');
  assert.deepEqual(await idle('paow',project),{dealerId:'paow',mediaId:id,sha256,available:true});
  assert.equal(await idle('paow',{...project,lines:[]}),null,'registered identity alone cannot supply an idle');
  const voices=await createRegisteredVoiceLines({env,repositoryRoot:root,repository})();
  assert.deepEqual(voices.dealers.map(row=>row.dealer),['astrid']);
  for(const dealer of voices.dealers)assert.equal(dealer.lines.length,0);
  const inventory=await media.videoRegistry();assert.equal(inventory.videos.find(row=>row.id===id).dealer,'paow');assert.ok(inventory.families.length>0);
  const legacy=await media.legacyControls(project);
  for(const dealer of ['astrid'])assert.ok(legacy.clips.some(row=>row.dealerId===dealer));
  for(const dealer of ['vera','amira','mei'])assert.equal(legacy.clips.some(row=>row.dealerId===dealer),false);
  assert.equal(legacy.clips.some(row=>row.dealerId==='paow'),false);
});

test('deployment catalog builds after Amira source removal without changing Astrid metadata',async t=>{
 const {readFile,writeFile}=await import('node:fs/promises');
 const root=await mkdtemp(join(tmpdir(),'croupier-retired-catalog-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const put=async(path,content)=>{const file=join(root,path);await mkdir(dirname(file),{recursive:true});await writeFile(file,content);};
 await put('media/layout.json',await readFile(join(source,'media/layout.json')));
 const legacy=JSON.parse(await readFile(join(source,'media/catalog/legacy.json'),'utf8'));
 for(const [path,content]of Object.entries(legacy.entries))if(!path.includes('/amira/'))await put(path,content);
 await put('media/dealers/astrid/runtime/presentation/lab-video-manifest.json',await readFile(join(source,'media/catalog/presentation.json')));
 const result=await buildRuntimeMediaCatalog(root);assert.equal(result.metadataSources,2);
 const generated=JSON.parse(await readFile(join(root,'media/catalog/legacy.json'),'utf8'));
 assert.equal(Object.keys(generated.entries).some(path=>path.includes('/amira/')),false);
 for(const [path,content]of Object.entries(generated.entries))assert.equal(content,legacy.entries[path]);
});
test('retired dealer aliases and Blob pointers disappear while Astrid remains registered',async()=>{
 const {readFile}=await import('node:fs/promises');const {resolvePublicMedia}=await import('../tools/media-layout.mjs');
 assert.equal(resolvePublicMedia('/review/amira-green-speak/win.mp4'),null);assert.ok(resolvePublicMedia('/review/astrid-green-speak/speak.json'));
 for(const url of ['/review/astrid-green-speak/win.mp4','/review/astrid-seam-repair/back-fc3615057eaa.mp4','/lab/astrid-pilot.mp4','/dealers/astrid-hands/streams/index.json'])assert.equal(resolvePublicMedia(url),null);
 const index=JSON.parse(await readFile(join(source,'media/blob-index.json'),'utf8'));
 for(const dealer of ['vera','mei','amira','johanna']){
  assert.equal(index.files.some(row=>row.logicalPath.startsWith(`dealers/${dealer}/`)),false);
  assert.equal(index.files.some(row=>row.logicalPath===`site/runtime/backoffice/img/${dealer}-portrait.jpg`),false);
  for(const url of [`/lab/${dealer}-pilot.mp4`,`/lab/${dealer}-pilot-debug.mp4`,`/bo/img/${dealer}-portrait.jpg`])assert.equal(resolvePublicMedia(url),null);
 }
 assert.equal(resolvePublicMedia('/dealer-hands/streams/index.json'),null);
 assert.equal(index.files.some(row=>row.logicalPath==='dealers/astrid/runtime/composited/2026-09-09/mei-push.mp4'),false);
 assert.equal(index.files.some(row=>row.logicalPath.startsWith('dealers/astrid/')),true);
});
test('old Paow preview cannot return through a registry entry without preview choices',async t=>{
 const {dealerVersionPath}=await import('../services/game/public/dealer-version-switcher.mjs');
 const previous=globalThis.document;t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});
 globalThis.document={documentElement:{dataset:{gamePresentation:'layered',gameLane:'layer-preview',gameRegisteredDealers:JSON.stringify([{id:'paow',label:'PAOW'}])}}};
 assert.throws(()=>dealerVersionPath('paow',1),/not registered/);
 assert.match(dealerVersionPath('dragge',1),/dealer=dragge/);
});
