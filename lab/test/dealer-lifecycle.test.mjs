import test from 'node:test';
import assert from 'node:assert/strict';
import {addDealer,createSeedProject,defaultPresentationLane,validateProject} from '../lib/studio-model.mjs';
import {lifecycleProject,changeDealerLifecycle,assertLifecyclePackages,checkDealerArchive} from '../lib/dealer-lifecycle.mjs';
import {combinedPool} from './fixtures/lifecycle-pool.mjs';
import {cloudPresentationFixture} from './fixtures/cloud-presentation.mjs';
import {createOperatorStore} from '../../web/storage/operator-store.mjs';
import {withPackagePresentation} from '../../web/storage/presentation-package.mjs';
import {createStudioDealerApi} from '../lib/studio-dealer-api.mjs';
import {createStudioMediaApi} from '../lib/studio-media-api.mjs';
import {checkPermanentMediaDeletion,createStudioMediaDeletion} from '../lib/studio-media-deletion.mjs';
import {createStudioRepository} from '../../web/storage/studio-repository.mjs';
import {validateStudioMedia} from '../../web/storage/studio-contract.mjs';
import {createStudioMemoryPool} from '../../test/fixtures/studio-memory-pool.mjs';
import {seedSavedVideoProject} from './fixtures/video-dealer-project.mjs';
import {savedVideoDealerOwnership} from '../lib/video-dealer-registration.mjs';
import {wrapNativePresentationRepository} from '../lib/presentation-runtime-readiness.mjs';
import {presentationCapabilitiesForVersion} from '../../web/presentation-capability-contract.mjs';
const scope={environment:'test',workspaceId:'lifecycle'},origin='https://studio.example.invalid';
const config={scope,apiBase:'/api/admin',allowedOrigins:['https://public.example.invalid',origin],publicHosts:['public.example.invalid',new URL(origin).host]};
const id='00000000-0000-4000-8000-000000000001',oldId='00000000-0000-4000-8000-000000000002',sha='a'.repeat(64);
const media=(key=id,archived=false)=>({id:key,sha256:sha,size:32,contentType:'video/mp4',pathname:`croupier/media/dealers/paow/review/uploads/${key}/${sha}.mp4`,classification:{dealerId:'paow',eventId:'idle.ready',kind:'idle',role:'alternative',situation:'',label:'Clip',notes:'',...(archived?{archived:true}:{})}});
const req=(path,body,headers={})=>new Request(origin+path,{method:'POST',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json',...headers},body:JSON.stringify(body)});
async function fixture({bind=false}={}){
 const pool=createStudioMemoryPool();
 // This isolated fixture has no operators; historical packages stay in the separate purge fixture.
 const connect=pool.connect.bind(pool);pool.connect=async()=>{const client=await connect(),query=client.query.bind(client);client.query=(sql,values)=>sql.includes('/* operator-store:list-operators */')?Promise.resolve({rows:[]}):query(sql,values);return client;};
 const repository=createStudioRepository({pool,scope});
 const project=addDealer(createSeedProject(),'paow','PAOW');
 if(bind)project.lines.find(row=>row.dealerId==='paow'&&row.eventId==='idle.ready').variants[0].videoGenerationId=id;
 seedSavedVideoProject(pool,scope,project);
 await repository.initializeDocument('administration',{value:{},actor:'operator'});
 await repository.registerMedia(media(),{actor:'operator'});await repository.registerMedia(media(oldId,true),{actor:'operator'});
 const context={repository,config,mutationTransaction:async work=>work(),authorize:async()=>({user:'Admin',role:'admin',scope}),videoRegistry:async()=>({videos:await repository.listMedia()})};
 const operation=(archived,expectedRevision=project.revision)=>({dealerId:'paow',archived,expectedRevision});
 const change=async(body=operation(true),extras={})=>{
  if(body.archived&&body.impactToken===undefined){const {impact}=await checkDealerArchive({repository,body:{dealerId:body.dealerId,expectedRevision:body.expectedRevision}});body={...body,impactToken:impact.token};}
  return changeDealerLifecycle({...context,body,stillAuthorized:async()=> 'Admin',...extras});
 };
 const archiveBody={...operation(true),impactToken:(await checkDealerArchive({repository,body:{dealerId:'paow',expectedRevision:project.revision}})).impact.token};
 return {pool,repository,project,context,operation,change,archiveBody};
}
test('dealer archive and restore preserve own exact lines/settings and only restore previously active uploads',async()=>{
 const f=await fixture({bind:true}),before=structuredClone(f.project);
 const archived=await f.change();
 assert.equal(archived.dealers.some(row=>row.id==='paow'),false);
 assert.deepEqual(archived.dealerTrash[0].activeMediaIds,[id]);
 assert.deepEqual(archived.dealerTrash[0].lines,before.lines.filter(row=>row.dealerId==='paow'));
 assert.equal((await f.repository.getMedia(id)).classification.archived,true);
 assert.deepEqual([...(await savedVideoDealerOwnership(f.repository)).trash],['paow']);
 const restored=await f.change(f.operation(false,archived.revision));
 assert.deepEqual(restored.lines,before.lines);assert.deepEqual(restored.dealers,before.dealers);
 assert.equal(restored.dealerTrash.length,0);
 assert.equal((await f.repository.getMedia(id)).classification.archived,false);
 assert.equal((await f.repository.getMedia(oldId)).classification.archived,true);
});
test('ordinary PUT cannot forge/change trash or remove a dealer owning clips, even when bindings were removed',async()=>{
 const f=await fixture();const next=structuredClone(f.project);next.dealers=next.dealers.filter(row=>row.id!=='paow');next.lines=next.lines.filter(row=>row.dealerId!=='paow');
 await assert.rejects(f.repository.saveDocument('project',{value:next,expectedRevision:f.project.revision,actor:'Admin'}),{code:'studio_dealer_lifecycle_required'});
 const forged=lifecycleProject(f.project,{dealerId:'paow',archived:true,records:await f.repository.listMedia()});
 await assert.rejects(f.repository.saveDocument('project',{value:forged,expectedRevision:f.project.revision,actor:'Admin'}),{code:'studio_dealer_lifecycle_required'});
});
test('archive automatically disables speech and moves affected compositions while keeping historical administration',async()=>{
 const f=await fixture();f.project.dealers.at(-1).speechProfile={schemaVersion:2,state:'enabled',voice:{provider:'elevenlabs',voiceId:'original',modelId:'eleven_v3'},reference:{kind:'video-frame',videoId:id,sha256:sha,offsetMs:0}};
 f.project.lanes=[defaultPresentationLane('paow')];seedSavedVideoProject(f.pool,scope,f.project);
 const doc=await f.repository.readDocument('administration');await f.repository.saveDocument('administration',{value:{genLandings:{dealer:'paow'}},expectedRevision:doc.revision,actor:'Admin'});
 const archived=await f.change();assert.deepEqual(archived.lanes,[]);assert.equal(archived.dealerTrash[0].dealer.speechProfile.state,'preparation');assert.equal(archived.dealerTrash[0].compositions.length,1);
 const restored=await f.change(f.operation(false,archived.revision));assert.equal(restored.dealers.at(-1).speechProfile.state,'preparation');assert.deepEqual(restored.lanes,f.project.lanes);
 assert.deepEqual((await f.repository.readDocument('administration')).value,{genLandings:{dealer:'paow'}});
});

test('historical packages never block reversible archive but still block permanent removal',async()=>{
 for(const pack of [{lanes:'[]',branding:JSON.stringify({dealer:'paow'})},{lanes:'[]',branding:'invalid'}]){
  const f=await fixture();f.pool.packages=[pack];const archived=await f.change();assert.equal(archived.dealerTrash.length,1);
  assert.throws(()=>assertLifecyclePackages([pack],{dealerId:'paow'}));
 }
});

test('concurrent archive attempts have one winner and stale restoration has no partial success',async()=>{
 const f=await fixture();const results=await Promise.allSettled([f.change(),f.change()]);assert.equal(results.filter(row=>row.status==='fulfilled').length,1);
 const before=f.pool.snapshot();await assert.rejects(f.change(f.operation(false)),{code:'studio_conflict'});assert.deepEqual(f.pool.snapshot(),before);
});
test('a failure after the first media change rolls back all media, document, history and audit changes',async()=>{
 const f=await fixture();const before=f.pool.snapshot();f.pool.failNext('history');await assert.rejects(f.change());assert.deepEqual(f.pool.snapshot(),before);
});
test('replayed upload grants and individual restore cannot reactivate a trashed dealer',async()=>{
 const f=await fixture();await f.change();const api=createStudioMediaApi(f.context),row=await f.repository.getMedia(id),before=f.pool.snapshot();
 await assert.rejects(f.repository.registerMedia(media(),{actor:'Admin'}),{code:'studio_dealer_archived'});
 const response=await api.handle(req('/api/videos/archive',{id,sha256:sha,previous:row.classification,archived:false}));assert.equal(response.status,422);assert.deepEqual(f.pool.snapshot(),before);
});
test('missing or changed media makes whole dealer restore conflict',async()=>{
 const f=await fixture();const archived=await f.change(),row=await f.repository.getMedia(id);
 await f.repository.classifyMedia(id,{sha256:sha,expectedRevision:row.revision,metadata:{...row.classification,archived:false},actor:'server-fixture'});
 const before=f.pool.snapshot();await assert.rejects(f.change(f.operation(false,archived.revision)),{code:'studio_dealer_restore_conflict'});assert.deepEqual(f.pool.snapshot(),before);
});
test('authenticated lifecycle API returns project and inventory; cross-site, role and auth changes fail closed',async()=>{
 const f=await fixture();const response=await createStudioDealerApi(f.context).handle(req('/api/dealers/archive',f.archiveBody));assert.equal(response.status,200);const body=await response.json();assert.equal(body.project.dealerTrash.length,1);assert.equal(body.inventory.videos.length,2);
 for(const mode of ['cross-site','reader','changed']){
  const g=await fixture();let calls=0;const context={...g.context,authorize:async()=>({scope,user:mode==='changed'&&calls++?'Other':'Admin',role:mode==='reader'?'reader':'admin'})};const before=g.pool.snapshot();
  const failed=await createStudioDealerApi(context).handle(req('/api/dealers/archive',g.archiveBody,mode==='cross-site'?{origin:'https://evil.invalid'}:{}));assert.equal(failed.status,403);assert.deepEqual(g.pool.snapshot(),before);
 }
});
test('purge checks explicitly reject referenced history and do not mistake zero scoped matches for full coverage',async()=>{
 const f=await fixture();let row=await f.repository.getMedia(oldId);const input={id:oldId,sha256:sha,expectedRevision:row.revision};const before=f.pool.snapshot();
 assert.deepEqual(await checkPermanentMediaDeletion(f.repository,input),{allowed:false,reason:'studio_media_delete_coverage_incomplete'});assert.deepEqual(f.pool.snapshot(),before);
 const api=createStudioMediaApi(f.context);assert.equal((await api.handle(req('/api/videos/delete-check',input))).status,200);
 const deleted=await api.handle(req('/api/videos/delete',input));assert.equal(deleted.status,503);assert.equal((await deleted.json()).code,'studio_media_delete_coverage_incomplete');assert.deepEqual(f.pool.snapshot(),before);
 const g=await fixture({bind:true});await g.change();row=await g.repository.getMedia(id);
 assert.deepEqual(await checkPermanentMediaDeletion(g.repository,{id,sha256:sha,expectedRevision:row.revision}),{allowed:false,reason:'studio_media_in_use'});
});
test('tombstones validate only archived uploads, block registration and cannot be forged as normal classification',async()=>{
 const pending={...media(id,true),deletion:{state:'pending',requestedAt:'2026-10-11T20:00:00.000Z'}};
 assert.equal(validateStudioMedia(pending).deletion.state,'pending');assert.throws(()=>validateStudioMedia({...pending,classification:{...pending.classification,archived:false}}));assert.throws(()=>validateStudioMedia({...pending,deletion:{...pending.deletion,secret:'unrecognized'}}));
 const f=await fixture();await assert.rejects(f.repository.registerMedia(pending,{actor:'Admin'}),{code:'studio_media_deletion_pending'});
});
test('trash ids cannot be reused and malformed saved snapshots fail validation',async()=>{
 const f=await fixture(),archived=await f.change();assert.throws(()=>addDealer(archived,'paow','Duplicate'));
 for(const mutate of [entry=>entry.activeMediaIds.push('not-uuid'),entry=>entry.lines.pop(),entry=>entry.dealer.id='astrid',entry=>entry.schemaVersion=3]){const copy=structuredClone(archived);mutate(copy.dealerTrash[0]);assert.throws(()=>validateProject(copy));}
});
test('runtime capability v7 is required before cascade trash document SQL mutation',async()=>{
 const f=await fixture(),next=lifecycleProject(f.project,{dealerId:'paow',archived:true,records:await f.repository.listMedia()});
 for(const version of [6,7]){let mutations=0,fetches=0;const repo={saveDocument:async()=>mutations++};const wrapped=wrapNativePresentationRepository(repo,{env:{CROUPIER_BACKEND_ORIGIN:'https://render.example.invalid'},fetchImpl:async(_url,options)=>{fetches++;assert.equal(options.headers['X-Presentation-Capability-Version'],'7');return Response.json(presentationCapabilitiesForVersion(version));}});
 if(version===6)await assert.rejects(wrapped.saveDocument('project',{value:next}));else await wrapped.saveDocument('project',{value:next});assert.equal(mutations,version===7?1:0);assert.equal(fetches,1);}
});

test('public rewrite and Next stripped basePath reach the same dealer lifecycle route',async()=>{
 for(const path of ['/api/dealers/archive','/studio/api/dealers/archive']){
  const f=await fixture();const context={...f.context,config:{...config,apiBase:'/studio/api/admin',authBase:'/studio/api/auth'}};
  const response=await createStudioDealerApi(context).handle(req(path,f.archiveBody));
  assert.equal(response.status,200);
 }
});

function deletionFixture(f,{now=Date.now,del=async()=>{},readIndex=()=>new Map(),mutationTransaction=f.context.mutationTransaction}={}){
 return createStudioMediaDeletion({repository:f.repository,mutationTransaction,now,readIndex,
  env:{CROUPIER_MEDIA_STORAGE:'blob',BLOB_READ_WRITE_TOKEN:'fake-fixture-token'},options:{blobClient:{del}}});
}
const deletionInput=row=>({id:row.id,sha256:row.sha256,expectedRevision:row.revision});
test('real deletion adapter commits tombstone and project fence before fakeBlob, then completes without deleting the row',async()=>{
 const f=await fixture(),row=await f.repository.getMedia(oldId),projectRevision=f.project.revision;let deletes=0;
 const service=deletionFixture(f,{del:async path=>{
  deletes++;assert.equal(path,row.pathname);const pending=await f.repository.getMedia(oldId);
  assert.equal(pending.deletion.state,'pending');const saved=await f.repository.readDocument('project');assert.notEqual(saved.revision,projectRevision);assert.deepEqual(saved.value.dealerTrash,[]);
 }});
 assert.deepEqual(await service.check(deletionInput(row)),{allowed:true});
 await service.remove(deletionInput(row),{stillAuthorized:async()=> 'Admin'});
 assert.equal((await f.repository.getMedia(oldId)).deletion.state,'deleted');assert.equal(deletes,1);
 await assert.rejects(f.repository.registerMedia(media(oldId,true),{actor:'Admin'}),{code:'studio_media_deletion_pending'});
 const deleted=await f.repository.getMedia(oldId);await assert.rejects(f.repository.classifyMedia(oldId,{sha256:sha,expectedRevision:deleted.revision,metadata:media(oldId).classification,actor:'Admin'}),{code:'studio_media_deletion_pending'});
});
test('provider error leaves an irreversible pending record, retry uses the same exact object and completes',async()=>{
 const f=await fixture(),row=await f.repository.getMedia(oldId);let calls=0;
 const service=deletionFixture(f,{del:async path=>{assert.equal(path,row.pathname);if(++calls===1)throw Error('private provider detail');}});
 await assert.rejects(service.remove(deletionInput(row),{stillAuthorized:async()=> 'Admin'}),{code:'studio_media_delete_failed'});
 const pending=await f.repository.getMedia(oldId);assert.equal(pending.deletion.state,'pending');assert.deepEqual(await service.check(deletionInput(pending)),{allowed:true});
 await service.remove(deletionInput(pending),{stillAuthorized:async()=> 'Admin'});assert.equal(calls,2);assert.equal((await f.repository.getMedia(oldId)).deletion.state,'deleted');
});
test('post-provider DB failure is retryable while pending remains authoritative',async()=>{
 const f=await fixture(),row=await f.repository.getMedia(oldId);let calls=0;
 const service=deletionFixture(f,{del:async()=>{if(++calls===1)f.pool.failNext('classify-media');}});
 await assert.rejects(service.remove(deletionInput(row),{stillAuthorized:async()=> 'Admin'}));
 const pending=await f.repository.getMedia(oldId);assert.equal(pending.deletion.state,'pending');
 await service.remove(deletionInput(pending),{stillAuthorized:async()=> 'Admin'});assert.equal((await f.repository.getMedia(oldId)).deletion.state,'deleted');
});
test('live upload grants block physical deletion for the full 15-minute window without metadata changes',async()=>{
 const f=await fixture(),row=await f.repository.getMedia(oldId);let calls=0;const at=Date.parse(await f.repository.mediaRegisteredAt(oldId));
 const early=deletionFixture(f,{now:()=>at+899999,del:async()=>calls++}),before=f.pool.snapshot();
 assert.deepEqual(await early.check(deletionInput(row)),{allowed:false,reason:'studio_media_upload_grant_active',retryAfterMs:1});
 await assert.rejects(early.remove(deletionInput(row),{stillAuthorized:async()=> 'Admin'}),{code:'studio_media_upload_grant_active'});assert.equal(calls,0);assert.deepEqual(f.pool.snapshot(),before);
 assert.deepEqual(await deletionFixture(f,{now:()=>at+900000}).check(deletionInput(row)),{allowed:true});
});
test('an old historical binding does not own bytes; restoring it after deletion fails current guards',async()=>{
 const f=await fixture({bind:true}),next=structuredClone(f.project);next.lines.find(row=>row.dealerId==='paow'&&row.eventId==='idle.ready').variants[0].videoGenerationId=null;
 const saved=await f.repository.saveDocument('project',{value:next,expectedRevision:f.project.revision,actor:'Admin'});
 let row=await f.repository.getMedia(id);row=await f.repository.classifyMedia(id,{expectedRevision:row.revision,sha256:sha,metadata:{...row.classification,archived:true},actor:'Admin'});
 const service=deletionFixture(f);assert.deepEqual(await service.check(deletionInput(row)),{allowed:true});await service.remove(deletionInput(row),{stillAuthorized:async()=> 'Admin'});
 const current=await f.repository.readDocument('project'),old={...f.project,dealerTrash:[]};
 await assert.rejects(f.repository.saveDocument('project',{value:old,expectedRevision:current.revision,actor:'Admin'}),{code:'studio_media_in_use'});
});
test('purging an unused trash clip only removes its restore bookkeeping and still allows dealer restoration',async()=>{
 const f=await fixture(),archived=await f.change(),row=await f.repository.getMedia(id),service=deletionFixture(f);
 assert.deepEqual(await service.check(deletionInput(row)),{allowed:true});await service.remove(deletionInput(row),{stillAuthorized:async()=> 'Admin'});
 const current=await f.repository.readDocument('project');assert.deepEqual(current.value.dealerTrash[0].activeMediaIds,[]);
 const restored=await f.change(f.operation(false,current.revision));assert.equal(restored.dealers.at(-1).id,'paow');assert.equal((await f.repository.getMedia(id)).deletion.state,'deleted');
 const archivedAgain=await f.change(f.operation(true,restored.revision));assert.deepEqual(archivedAgain.dealerTrash[0].activeMediaIds,[]);
});
test('any current document or published package in another scope blocks purge',async()=>{
 const f=await fixture(),row=await f.repository.getMedia(oldId),service=deletionFixture(f);
 const other=createStudioRepository({pool:f.pool,scope:{...scope,workspaceId:'other'}}),foreign=addDealer(createSeedProject(),'paow','PAOW');foreign.lines.find(line=>line.dealerId==='paow'&&line.eventId==='idle.ready').variants[0].videoGenerationId=oldId;
 await other.initializeDocument('project',{value:foreign,actor:'Admin'});
 assert.deepEqual(await service.check(deletionInput(row)),{allowed:false,reason:'studio_media_in_use'});
 const g=await fixture(),grow=await g.repository.getMedia(oldId);g.pool.packages=[{environment_id:'other',workspace_id:'elsewhere',lanes:'[]',branding:JSON.stringify({logo:grow.pathname})}];
 assert.deepEqual(await deletionFixture(g).check(deletionInput(grow)),{allowed:false,reason:'studio_media_published'});
});
test('cross-scope registration cannot create another owner or resurrect a tombstone',async()=>{
 const f=await fixture(),row=await f.repository.getMedia(oldId),other=createStudioRepository({pool:f.pool,scope:{...scope,workspaceId:'other'}});
 await assert.rejects(other.registerMedia(media(oldId,true),{actor:'Admin'}),{code:'studio_media_owned_elsewhere'});
 await deletionFixture(f).remove(deletionInput(row),{stillAuthorized:async()=> 'Admin'});
 await assert.rejects(other.registerMedia(media(oldId,true),{actor:'Admin'}),{code:'studio_media_owned_elsewhere'});
});
test('unknown bank index or an upload pointer inside it cannot authorize deletion',async()=>{
 const f=await fixture(),row=await f.repository.getMedia(oldId);let calls=0;
 for(const readIndex of [()=>null,()=>{throw Error('missing index');},()=>new Map([['copy',{storage:{pathname:row.pathname}}]])]){
  const service=deletionFixture(f,{readIndex,del:async()=>calls++}),before=f.pool.snapshot();await assert.rejects(service.remove(deletionInput(row),{stillAuthorized:async()=> 'Admin'}),{code:'studio_media_delete_coverage_incomplete'});assert.deepEqual(f.pool.snapshot(),before);
 }assert.equal(calls,0);
});
test('a failed v5 readiness gate or revoked authorization prevents provider calls',async()=>{
 const f=await fixture(),row=await f.repository.getMedia(oldId);let calls=0;
 const service=deletionFixture(f,{del:async()=>calls++,mutationTransaction:async(_work,options)=>{assert.equal(options.presentationMutation.kind,'project');assert.deepEqual(options.presentationMutation.value.dealerTrash,[]);throw Error('readiness');}}),before=f.pool.snapshot();
 await assert.rejects(service.remove(deletionInput(row),{stillAuthorized:async()=> 'Admin'}));assert.equal(calls,0);assert.deepEqual(f.pool.snapshot(),before);
 const revoked=deletionFixture(f,{del:async()=>calls++});await assert.rejects(revoked.remove(deletionInput(row),{stillAuthorized:async()=>{throw Error('revoked');}}));assert.equal(calls,0);assert.deepEqual(f.pool.snapshot(),before);
});
test('concurrent deletes with the same initial CAS have one winner and one provider request',async()=>{
 const f=await fixture(),row=await f.repository.getMedia(oldId);let calls=0;const service=deletionFixture(f,{del:async()=>calls++});
 const results=await Promise.allSettled([service.remove(deletionInput(row),{stillAuthorized:async()=> 'Admin'}),service.remove(deletionInput(row),{stillAuthorized:async()=> 'Admin'})]);
 assert.equal(results.filter(row=>row.status==='fulfilled').length,1);assert.equal(calls,1);
});

test('successful purge API returns the fenced project and current inventory, and old deployment origins are rejected',async()=>{
 const f=await fixture(),row=await f.repository.getMedia(oldId),mediaDeletion=deletionFixture(f);
 const api=createStudioMediaApi({...f.context,mediaDeletion});
 const response=await api.handle(req('/api/videos/delete',deletionInput(row)));assert.equal(response.status,200);
 const body=await response.json();assert.notEqual(body.project.revision,f.project.revision);assert.equal(body.inventory.videos.find(video=>video.id===oldId).deletion.state,'deleted');
 const old=new Request('https://old-deployment.vercel.app/api/videos/delete-check',{method:'POST',headers:{origin,'x-forwarded-host':new URL(origin).host,'sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify(deletionInput(row))});
 assert.equal((await api.handle(old)).status,403);
});
test('losing authorization after pending commit does not call Blob or restore the file',async()=>{
 const f=await fixture(),row=await f.repository.getMedia(oldId);let auth=0,deletes=0;
 const service=deletionFixture(f,{del:async()=>deletes++});
 await assert.rejects(service.remove(deletionInput(row),{stillAuthorized:async()=>{if(++auth>1)throw Error('revoked');return 'Admin';}}));
 assert.equal(deletes,0);assert.equal((await f.repository.getMedia(oldId)).deletion.state,'pending');
});

test('pending deletion blocks dealer archive until its provider operation has been completed',async()=>{
 const f=await fixture(),row=await f.repository.getMedia(oldId),service=deletionFixture(f,{del:async()=>{throw Error('failed');}});
 await assert.rejects(service.remove(deletionInput(row),{stillAuthorized:async()=> 'Admin'}));
 const current=await f.repository.readDocument('project'),before=f.pool.snapshot();
 await assert.rejects(f.change(f.operation(true,current.revision)),{code:'studio_media_deletion_pending'});assert.deepEqual(f.pool.snapshot(),before);
});

const dealerDeleteInput=(project,dealerId='paow')=>({dealerId,expectedRevision:project.revision});
const afterArchive=project=>Date.parse(project.dealerTrash[0].archivedAt)+16*60*1000;
test('whole dealer purge removes its saved bindings and all own uploads, keeping durable media tombstones',async()=>{
 const f=await fixture({bind:true}),archived=await f.change();let calls=0;
 const service=deletionFixture(f,{now:()=>afterArchive(archived),del:async()=>{
   calls++;const project=(await f.repository.readDocument('project')).value;assert.equal(project.dealerTrash[0].deletion.state,'pending');
   const rows=await f.repository.listMedia();assert.ok(rows.every(row=>row.deletion));
 }});
 assert.deepEqual(await service.checkDealer(dealerDeleteInput(archived)),{allowed:true,count:2});
 const removed=await service.removeDealer(dealerDeleteInput(archived),{stillAuthorized:async()=> 'Admin'});
 assert.equal(calls,2);assert.deepEqual(removed.dealerTrash,[]);assert.ok((await f.repository.listMedia()).every(row=>row.deletion.state==='deleted'));
 const next=addDealer(removed,'paow','New empty PAOW');assert.equal(next.lines.filter(line=>line.dealerId==='paow').every(line=>line.variants.every(variant=>variant.videoGenerationId===null)),true);
});
test('partial provider failure is visible as one pending dealer batch; resume skips completed objects and blocks restore',async()=>{
 const f=await fixture({bind:true}),archived=await f.change();let calls=0;
 const service=deletionFixture(f,{now:()=>afterArchive(archived),del:async()=>{if(++calls===2)throw Error('provider failed');}});
 await assert.rejects(service.removeDealer(dealerDeleteInput(archived),{stillAuthorized:async()=> 'Admin'}),{code:'studio_dealer_delete_pending'});
 const current=(await f.repository.readDocument('project')).value,rows=await f.repository.listMedia();
 assert.equal(current.dealerTrash[0].deletion.mediaIds.length,2);assert.equal(rows.filter(row=>row.deletion.state==='deleted').length,1);
 await assert.rejects(f.change(f.operation(false,current.revision)),{code:'studio_dealer_delete_pending'});
 const pending=rows.find(row=>row.deletion.state==='pending');assert.deepEqual(await service.check(deletionInput(pending)),{allowed:false,reason:'studio_dealer_delete_pending'});
 const done=await service.removeDealer(dealerDeleteInput(current),{stillAuthorized:async()=> 'Admin'});assert.equal(calls,3);assert.deepEqual(done.dealerTrash,[]);
});
test('one external dependency prevents every file in a dealer batch from entering deletion',async()=>{
 const f=await fixture({bind:true}),archived=await f.change(),admin=await f.repository.readDocument('administration');
 await f.repository.saveDocument('administration',{expectedRevision:admin.revision,value:{genLandings:{file:oldId}},actor:'Admin'});
 let calls=0;const service=deletionFixture(f,{now:()=>afterArchive(archived),del:async()=>calls++}),before=f.pool.snapshot();
 assert.equal((await service.checkDealer(dealerDeleteInput(archived))).reason,'studio_media_in_use');
 await assert.rejects(service.removeDealer(dealerDeleteInput(archived),{stillAuthorized:async()=> 'Admin'}),{code:'studio_media_in_use'});
 assert.equal(calls,0);assert.deepEqual(f.pool.snapshot(),before);
});
test('last-file metadata failure rolls back the entire dealer batch before any external delete',async()=>{
 const f=await fixture({bind:true}),archived=await f.change();let calls=0;
 const service=deletionFixture(f,{now:()=>afterArchive(archived),del:async()=>calls++}),before=f.pool.snapshot();f.pool.failNext('classify-media',Error('fault'),1);
 await assert.rejects(service.removeDealer(dealerDeleteInput(archived),{stillAuthorized:async()=> 'Admin'}));assert.equal(calls,0);assert.deepEqual(f.pool.snapshot(),before);
});
test('dealer ID reuse drains uncommitted upload grants even for an empty dealer',async()=>{
 const f=await fixture();const project=addDealer(f.project,'empty','Empty');seedSavedVideoProject(f.pool,scope,project);
 const archived=await f.change({dealerId:'empty',expectedRevision:project.revision,archived:true}),entry=archived.dealerTrash.find(row=>row.dealer.id==='empty'),at=Date.parse(entry.archivedAt);
 const early=deletionFixture(f,{now:()=>at+899999});assert.deepEqual(await early.checkDealer(dealerDeleteInput(archived,'empty')),{allowed:false,reason:'studio_media_upload_grant_active',retryAfterMs:1,count:0});
 await assert.rejects(early.removeDealer(dealerDeleteInput(archived,'empty'),{stillAuthorized:async()=> 'Admin'}),{code:'studio_media_upload_grant_active'});
 const ready=deletionFixture(f,{now:()=>at+900000}),done=await ready.removeDealer(dealerDeleteInput(archived,'empty'),{stillAuthorized:async()=> 'Admin'});assert.deepEqual(done.dealerTrash,[]);assert.equal(addDealer(done,'empty','New').dealers.at(-1).id,'empty');
});
test('dealer purge routes return preflight and fenced project/inventory without an archive-restore detour',async()=>{
 const f=await fixture({bind:true}),archived=await f.change(),mediaDeletion=deletionFixture(f,{now:()=>afterArchive(archived)}),api=createStudioDealerApi({...f.context,mediaDeletion});
 const check=await api.handle(req('/api/dealers/delete-check',dealerDeleteInput(archived)));assert.equal(check.status,200);assert.equal((await check.json()).allowed,true);
 const result=await api.handle(req('/api/dealers/delete',dealerDeleteInput(archived)));assert.equal(result.status,200);const body=await result.json();assert.deepEqual(body.project.dealerTrash,[]);assert.equal(body.inventory.videos.filter(row=>row.deletion.state==='deleted').length,2);
});

test('archive plan API is read-only and confirmation requires the same current token',async()=>{
 const f=await fixture(),api=createStudioDealerApi(f.context),before=f.pool.snapshot();
 const check=await api.handle(req('/api/dealers/archive-check',{dealerId:'paow',expectedRevision:f.project.revision}));assert.equal(check.status,200);
 const {impact}=await check.json();assert.equal(impact.token,f.archiveBody.impactToken);assert.deepEqual(f.pool.snapshot(),before);
 assert.equal((await api.handle(req('/api/dealers/archive',f.operation(true)))).status,400);
 assert.equal((await api.handle(req('/api/dealers/archive',{...f.archiveBody,impactToken:'0'.repeat(64)}))).status,409);
 assert.deepEqual(f.pool.snapshot(),before);
 const admin=await f.repository.readDocument('administration');await f.repository.saveDocument('administration',{value:admin.value,expectedRevision:admin.revision,actor:'Other'});
 const changed=f.pool.snapshot();assert.equal((await api.handle(req('/api/dealers/archive',f.archiveBody))).status,409);assert.deepEqual(f.pool.snapshot(),changed);
});

test('shared archived compositions validate against history but restore waits for active dealer dependencies',()=>{
 let project=addDealer(addDealer(createSeedProject(),'johanna','Johanna'),'elin','Elin');
 const lane=defaultPresentationLane('johanna');lane.dealers.push('elin');lane.layers.dealer.allowed.push('elin');project.lanes=[lane];
 project=lifecycleProject(project,{dealerId:'johanna',archived:true,records:[]});
 project=lifecycleProject(project,{dealerId:'elin',archived:true,records:[]});assert.equal(validateProject(project),project);
 assert.throws(()=>lifecycleProject(project,{dealerId:'johanna',archived:false,records:[]}),{code:'studio_dealer_restore_conflict'});
 project=lifecycleProject(project,{dealerId:'elin',archived:false,records:[]});project=lifecycleProject(project,{dealerId:'johanna',archived:false,records:[]});assert.deepEqual(project.lanes,[lane]);
});

test('explicit baseline dealer archive preserves retained clips and inactive legacy dealers cannot reactivate',()=>{
 const project=createSeedProject(),dealer=project.dealers.find(row=>row.id==='astrid');assert.ok(dealer);
 const retained={id,classification:{dealerId:'astrid'},retainedBank:{immutable:true}};
 const archived=lifecycleProject(project,{dealerId:'astrid',archived:true,records:[retained]});assert.deepEqual(archived.dealerTrash[0].activeMediaIds,[]);
 assert.equal(lifecycleProject(archived,{dealerId:'astrid',archived:false,records:[retained]}).dealers.some(row=>row.id==='astrid'),true);
 const historical=structuredClone(project);
 const retired=lifecycleProject(historical,{dealerId:'amira',archived:true,records:[]});assert.throws(()=>lifecycleProject(retired,{dealerId:'amira',archived:false,records:[]}),{code:'studio_dealer_inactive'});
});

test('composition IDs reused while archived reject restore without partial media changes',async()=>{
 const f=await fixture();f.project.lanes=[defaultPresentationLane('paow')];seedSavedVideoProject(f.pool,scope,f.project);const archived=await f.change();
 const other=defaultPresentationLane('astrid');other.id=f.project.lanes[0].id;archived.lanes=[other];seedSavedVideoProject(f.pool,scope,archived);
 const before=f.pool.snapshot();await assert.rejects(f.change(f.operation(false,archived.revision)),{code:'studio_dealer_restore_conflict'});assert.deepEqual(f.pool.snapshot(),before);
});

test('foreign active dealer clip bindings remain a safe archive blocker',()=>{
 const project=addDealer(createSeedProject(),'paow','PAOW');project.lines.find(row=>row.dealerId==='astrid').variants[0].videoGenerationId=id;
 assert.throws(()=>lifecycleProject(project,{dealerId:'paow',archived:true,records:[media()]}),{code:'studio_media_in_use'});
});

test('dealer, media, room and current publication changes commit together and roll back together',async()=>{
 for(const failure of [null,'classify-media','save-document']){
  const pool=combinedPool(scope),repository=createStudioRepository({pool,scope}),lane={...defaultPresentationLane('paow'),id:'paow-scene'};
  const cloud=cloudPresentationFixture({lanes:[lane]}),project=await repository.initializeDocument('project',{value:cloud.project,actor:'fixture'});
  await repository.initializeDocument('administration',{value:{rooms:[{schemaVersion:2,id:'paow-room',name:'PAOW room',operatorId:'north',presentationLaneId:'paow-scene',gameLaneId:'paow-adapter',state:'live'}],gameLanes:[{schemaVersion:1,id:'paow-adapter',label:'PAOW',renderer:'portrait-video',dealer:'paow',mediaCollection:'paow-presentation'}],gameLane:'paow-adapter'},actor:'fixture'});
  for(const {revision,...row} of cloud.mediaRows)pool.setMedia(row,revision);
  const stored=work=>repository.transaction(()=>repository.withTransactionClient(async client=>work(await createOperatorStore({sql:client,scope,transaction:fn=>repository.withTransactionClient(fn)}))));
  await stored(store=>store.publishPackage({actor:'fixture',operatorId:'north',expectedRevision:null,lanes:['paow-scene'],games:['blackjack'],tables:['paow-room'],branding:withPackagePresentation({},cloud.presentation)}));
  const {impact}=await checkDealerArchive({repository,body:{dealerId:'paow',expectedRevision:project.revision}}),before=pool.snapshot();
  const execute=()=>changeDealerLifecycle({repository,mutationTransaction:work=>work(),stillAuthorized:async()=> 'Admin',body:{dealerId:'paow',expectedRevision:project.revision,archived:true,impactToken:impact.token}});
  if(failure){pool.fail(failure);await assert.rejects(execute());assert.deepEqual(pool.snapshot(),before);continue;}
  const archived=await execute();assert.equal(archived.dealers.length,0);assert.equal(archived.dealerTrash[0].compositions.length,1);
  assert.equal((await repository.getMedia(cloud.mediaRows[0].id)).classification.archived,true);assert.deepEqual((await repository.readDocument('administration')).value.rooms,[]);
  const pack=await stored(store=>store.getCurrentPackage('north'));assert.deepEqual(pack.lanes,[]);assert.deepEqual(pool.snapshot().packages[0],before.packages[0]);
  await changeDealerLifecycle({repository,mutationTransaction:work=>work(),stillAuthorized:async()=> 'Admin',body:{dealerId:'paow',expectedRevision:archived.revision,archived:false}});
  assert.deepEqual((await repository.readDocument('administration')).value.rooms,[]);assert.equal((await stored(store=>store.getCurrentPackage('north'))).revision,pack.revision);
 }
});

test('permanent deletion of cascade trash needs v7 before tombstones or provider work',async()=>{
 for(const version of [5,6,7]){
  const f=await fixture();await f.change();const row=await f.repository.getMedia(id),before=f.pool.snapshot();let calls=0,requested;
  const wrapped=wrapNativePresentationRepository(f.repository,{env:{CROUPIER_BACKEND_ORIGIN:'https://render.example.invalid'},fetchImpl:async(_url,options)=>{requested=options.headers['X-Presentation-Capability-Version'];return Response.json(presentationCapabilitiesForVersion(version));}});
  const service=createStudioMediaDeletion({repository:wrapped,mutationTransaction:(work,options)=>wrapped.withMutationContext(work,options.presentationMutation),readIndex:()=>new Map(),env:{CROUPIER_MEDIA_STORAGE:'blob',BLOB_READ_WRITE_TOKEN:'fake-fixture-token'},options:{blobClient:{del:async()=>calls++}}});
  if(version<7){await assert.rejects(service.remove(deletionInput(row),{stillAuthorized:async()=> 'Admin'}),{code:'studio_presentation_runtime_update_required'});assert.deepEqual(f.pool.snapshot(),before);assert.equal(calls,0);}
  else{await service.remove(deletionInput(row),{stillAuthorized:async()=> 'Admin'});assert.equal((await f.repository.getMedia(id)).deletion.state,'deleted');assert.equal(calls,1);}
  assert.equal(requested,'7');
 }
});

test('a server lifecycle write cannot acquire cascade authority inside an older verified transaction',async()=>{
 const f=await fixture(),next=lifecycleProject(f.project,{dealerId:'paow',archived:true,records:await f.repository.listMedia()});let calls=0;
 const wrapped=wrapNativePresentationRepository(f.repository,{env:{CROUPIER_BACKEND_ORIGIN:'https://render.example.invalid'},fetchImpl:async()=>{calls++;return Response.json(presentationCapabilitiesForVersion(5));}}),before=f.pool.snapshot();
 await wrapped.withMutationContext(async()=>{await assert.rejects(wrapped.saveDealerLifecycle(next,{expectedRevision:f.project.revision,actor:'Admin'}),{code:'studio_presentation_runtime_update_required'});},{kind:'project',value:{...f.project,dealerTrash:[]}});
 assert.deepEqual(f.pool.snapshot(),before);assert.equal(calls,1);
});
