import test from 'node:test';
import assert from 'node:assert/strict';
import {BASE_DEALER_IDS,MAX_DEALERS,isDealerId,registeredDealerIds} from '../../packages/presentation/contracts/dealer-identity.mjs';
import {validateVideoMetadata,validateVideoCompositing,videoCompositing,videoFitsLine} from '../../packages/presentation/contracts/video-intake.mjs';
import {mediaBlobPath,validatePrivateMedia} from '../lib/cloud-media-store.mjs';
import {requireSavedVideoDealer} from '../../packages/studio-registry/server/video-dealer-registration.mjs';
import {createStudioUploadService} from '../lib/studio-upload-service.mjs';
import {DEFAULT_DEALER_COMPOSITING,effectiveDealerCompositing} from '../../packages/presentation/contracts/dealer-compositing.mjs';
const classification={dealerId:'nora',eventId:'idle.ready',kind:'idle',role:'alternative',situation:'',label:'Nora',notes:'',compositing:{mode:'green-screen',threshold:.23,softness:.15,despill:0}};
const project=()=>({dealers:[...BASE_DEALER_IDS,'nora'].map(id=>({id,label:id}))});
const scope={environment:'test',workspaceId:'nora-intake'},id='00000000-0000-4000-8000-000000000001',sha256='d'.repeat(64);
test('registered dealer IDs are bounded and cannot inject unsafe Blob paths',()=>{
  for(const id of [...BASE_DEALER_IDS,'nora','dealer-2'])assert.equal(isDealerId(id),true);
  for(const value of ['Nora','../nora','nora/x','nora%2fx','nora--two','nora-','constructor','prototype','api','a'.repeat(41)]){assert.equal(isDealerId(value),false);assert.throws(()=>mediaBlobPath('dealers/'+value+'/review/uploads',id,sha256,'mp4'));}
  assert.equal(registeredDealerIds(project()).size,5);
  assert.deepEqual([...registeredDealerIds({dealers:[{id:'nora'}]})],['nora'],'the saved roster does not require historical base dealers');
  assert.equal(registeredDealerIds({dealers:[]}).size,0,'an empty installation grants no dealer');
  assert.throws(()=>registeredDealerIds({dealers:Array.from({length:MAX_DEALERS+1},(_,i)=>({id:'dealer-'+i}))}));
  assert.throws(()=>registeredDealerIds({dealers:[...project().dealers,{id:'nora'}]}));
  const pathname=mediaBlobPath('dealers/nora/review/uploads',id,sha256,'mp4');
  assert.equal(validatePrivateMedia({provider:'vercel-blob',pathname,sha256,size:32,contentType:'video/mp4'}).pathname,pathname);
});
test('legacy metadata remains readable while new dealer writes require green-screen or alpha',()=>{
  assert.deepEqual(validateVideoMetadata(classification).compositing,classification.compositing);
  assert.deepEqual(videoCompositing(),{mode:'opaque'});
  assert.deepEqual(videoCompositing({classification:{...classification,compositing:undefined}}),{mode:'opaque'});
  assert.deepEqual(validateVideoCompositing({mode:'opaque'}),{mode:'opaque'});
  const legacy={...classification,compositing:{mode:'opaque'}},before=JSON.stringify(legacy);
  assert.throws(()=>validateVideoMetadata(legacy,{forWrite:true}),/alfa/);
  assert.deepEqual(validateVideoMetadata({...classification,compositing:{mode:'alpha'}},{forWrite:true}).compositing,{mode:'alpha'});
  assert.equal(JSON.stringify(legacy),before);
  assert.deepEqual(validateVideoMetadata({...classification,compositing:undefined},{forWrite:true}).compositing,DEFAULT_DEALER_COMPOSITING);
  assert.deepEqual(effectiveDealerCompositing(legacy.compositing),DEFAULT_DEALER_COMPOSITING);
  assert.equal(effectiveDealerCompositing({...classification.compositing,softness:.0001}).softness,.0001,'legacy renderer thresholds remain readable');
  assert.equal(videoFitsLine({classification},'nora','idle.ready'),true);
  assert.equal(videoFitsLine({classification},'astrid','idle.ready'),false);
  for(const value of [{mode:'opaque',threshold:.2},{mode:'green-screen'},{...classification.compositing,softness:0},{...classification.compositing,threshold:Infinity},{...classification.compositing,despill:2},{...classification.compositing,url:'https://invalid.example'}])assert.throws(()=>validateVideoMetadata({...classification,compositing:value}));
});
test('valid identity syntax cannot substitute for a registered saved dealer',async()=>{
  const repository={readDocument:async()=>({value:{dealers:BASE_DEALER_IDS.map(id=>({id}))}})};
  await assert.rejects(requireSavedVideoDealer(repository,'nora'),error=>error.code==='studio_dealer_not_registered');
  await assert.rejects(requireSavedVideoDealer({readDocument:async()=>null},'astrid'),error=>error.code==='studio_dealer_registry_unavailable');
  repository.readDocument=async()=>({value:project()});await requireSavedVideoDealer(repository,'nora');
});
test('upload token issuance checks saved roster and removal revokes a signed grant before Blob IO',async()=>{
  let saved=project(),tokens=0,reads=0,writes=0;
  const repository={scope,readDocument:async()=>({value:saved}),getMedia:async()=>null,registerMedia:async()=>{writes++;return{duplicate:false};}};
  const service=createStudioUploadService({repository,scope,ticketKey:Buffer.alloc(32,9),env:{CROUPIER_MEDIA_STORAGE:'blob',BLOB_READ_WRITE_TOKEN:'fixture-only'},clientToken:async()=>{tokens++;return'fixture-client';},privateMedia:async()=>{reads++;throw Error('must not read');},now:()=>1000});
  const body={operation:'prepare',sha256,size:32,contentType:'video/mp4',classification};
  saved={dealers:BASE_DEALER_IDS.map(id=>({id}))};
  await assert.rejects(service.prepare(body,{actor:'Operator'}),error=>error.code==='studio_dealer_not_registered');assert.equal(tokens,0);
  saved=project();const grant=await service.prepare(body,{actor:'Operator'});assert.ok(grant.pathname.includes('/dealers/nora/review/uploads/'));
  saved={dealers:BASE_DEALER_IDS.map(id=>({id}))};
  await assert.rejects(service.commit({operation:'commit',ticket:grant.ticket},{actor:'Operator',request:new Request('https://studio.invalid/api/videos/upload',{method:'POST'}),stillAuthorized:async()=>true,mutationTransaction:work=>work()}),error=>error.code==='studio_dealer_not_registered');
  assert.equal(reads,0);assert.equal(writes,0);
});

import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve,basename} from 'node:path';
import {createSeedProject,addDealer} from '../../packages/presentation/contracts/studio-model.mjs';
import {uploadVideo} from '../lib/video-uploads.mjs';
import {readUploads} from '../lib/video-local-readers.mjs';
import {loadVideoRegistry} from '../lib/video-registry.mjs';

test('registered Nora intake survives reload with greenscreen metadata and never binds Astrid footage',async t=>{
  const root=await mkdtemp(join(tmpdir(),'croupier-nora-video-'));
  t.after(()=>{assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.match(basename(root),/^croupier-nora-video-/);return rm(root,{recursive:true,force:true});});
  const original=createSeedProject(),saved=addDealer(original,'nora','Nora');
  const originalLines=JSON.stringify(original.lines),body=Buffer.from('0000ftypisom00000nora-container-fixture');
  const options={uploadDir:join(root,'uploads'),snapshotPath:join(root,'absent.json'),archiveDir:null,project:saved};
  const request=new Request('http://localhost:4192/api/videos',{method:'POST',headers:{'content-type':'video/mp4','x-video-metadata':encodeURIComponent(JSON.stringify(classification))},body,duplex:'half'});
  const uploaded=await uploadVideo(request,options),records=await readUploads(options),registry=await loadVideoRegistry(options);
  assert.deepEqual(records[0].classification,classification);
  const video=registry.videos.find(row=>row.id===uploaded.id);
  assert.deepEqual(video.classification.compositing,classification.compositing);
  assert.equal(video.dealer,'nora');assert.equal(video.available,true);
  assert.equal(videoFitsLine(video,'nora','idle.ready'),true);
  assert.equal(videoFitsLine(video,'astrid','idle.ready'),false);
  assert.equal(JSON.stringify(saved.lines.filter(row=>row.dealerId!=='nora')),originalLines);
  assert.equal(saved.lines.filter(row=>row.dealerId==='nora'&&row.variants.some(variant=>variant.videoGenerationId)).length,0,'intake does not activate any Nora event or speech');
});
