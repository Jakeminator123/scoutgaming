import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {createStudioMemoryPool} from './fixtures/studio-memory-pool.mjs';
import {createStudioRepository} from '../web/storage/studio-repository.mjs';
import {createStudioGamePolicy,STUDIO_GAME_CONFIGURATION_SOURCE} from '../web/storage/studio-game-policy.mjs';
import {createStudioMediaRuntime} from '../lab/lib/studio-media-runtime.mjs';
import {createSeedProject,isAssetCompatible} from '../lab/lib/studio-model.mjs';
import {legacyClipControls} from '../lab/lib/legacy-clip-inventory.mjs';
import {createPresentationApi} from '../web/presentation-api.mjs';
import {createNativeObservation} from '../web/public/native-observation.mjs';

const repositoryRoot=fileURLToPath(new URL('../',import.meta.url));
const scope={environment:'media_source_qa',workspaceId:'croupier'};
const env={CROUPIER_MEDIA_STORAGE:'blob',BLOB_READ_WRITE_TOKEN:'fixture-no-network',
  CROUPIER_MEDIA_BLOB_INDEX:fileURLToPath(new URL('../media/blob-index.json',import.meta.url))};
async function fixture(){
  const pool=createStudioMemoryPool(),repository=createStudioRepository({pool,scope});
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
test('native legacy HTTP response and observation preserve current saved Neon CAS revision and source',async()=>{
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
    const [legacy,config]=await Promise.all(['/api/presentation/legacy-config','/api/presentation/config'].map(async path=>{
      const response=await fetch(base+path);assert.equal(response.status,200);return response.json();
    }));
    assert.equal(legacy.source,STUDIO_GAME_CONFIGURATION_SOURCE);assert.equal(config.configurationSource,legacy.source);
    assert.equal(legacy.projectRevision,saved.revision);assert.equal(config.projectRevision,saved.revision);
    assert.equal(legacy.actualPlayback,false);
    const emitted=[];const observer=createNativeObservation({href:'https://metadata.qa.invalid/blackjack?labObserverOrigin=https%3A%2F%2Fmetadata.qa.invalid&labObserverChannel=11111111-1111-4111-8111-111111111111',
      opener:{postMessage:(message,origin)=>emitted.push({message,origin})}});
    assert.equal(observer.enabled,true);
    observer.emit('playback',{event:'configuration',state:'selected',projectRevision:legacy.projectRevision,configurationSource:legacy.source});
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
  const absent=createStudioMediaRuntime({repository:{scope,listMedia:()=>f.repository.listMedia(),readDocument:async()=>null},scope,env,repositoryRoot});
  await assert.rejects(absent.legacyControls(project),error=>error.code==='studio_document_missing');
});
