import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createStudioRepository} from '../../web/storage/studio-repository.mjs';
import {createSpeechReplyRepository} from '../../web/storage/speech-reply-repository.mjs';
import {createSpeechReplyLibrary,speechReplyScopeHash} from '../../web/speech-reply-library.mjs';
import {runtimeCatalogJson,runtimeCatalogRevision} from '../../packages/studio-registry/server/runtime-catalog.mjs';
import {mediaBlobPath} from '../../lab/lib/cloud-media-store.mjs';
import {addDealer,createEmptyProject} from '../../packages/presentation/contracts/studio-model.mjs';
import {readRuntimeCatalogFixture} from './runtime-media-catalog.mjs';
import {prepareRuntimeMediaImport,planRuntimeMediaImport,applyRuntimeMediaImport} from '../../ops/neon-studio/runtime-media-import.mjs';

const hasCode=code=>error=>error?.code===code;
function reply(scope,dealerId='astrid'){
  const id=randomUUID(),directory=`dealers/${dealerId}/runtime/conversation-replies/${speechReplyScopeHash(scope)}`;
  return {schemaVersion:1,id,dealerId,exactText:'Exact isolated SQL reference.',language:'en',createdAt:'2026-10-16T00:00:00.000Z',profileRevision:'c'.repeat(64),revision:1,categories:[],reviewStatus:'pending',
    media:Object.fromEntries([['audio','wav','audio/wav','a'],['video','mp4','video/mp4','b']].map(([kind,ext,contentType,hex])=>{
      const sha256=hex.repeat(64);return [kind,{provider:'vercel-blob',pathname:mediaBlobPath(directory,id,sha256,ext),sha256,size:32,contentType}];}))};
}

// Called only after runStudioPostgresChecks verifies the isolated localhost role/database.
// Metadata is synthetic or explicitly copied into this fixture; no Blob/provider is contacted.
export async function runRuntimeRegistrySqlChecks({pool}={}){
  const scope={environment:`qa_runtime_${randomBytes(8).toString('hex')}`,workspaceId:'integration'};
  const repository=createStudioRepository({pool,scope}),replies=createSpeechReplyRepository({sql:pool,scope});
  const library=createSpeechReplyLibrary({repository:replies,...scope,env:{}});
  const catalog=readRuntimeCatalogFixture(),catalogRevision=runtimeCatalogRevision(catalog);
  const checks=[];async function check(name,work){await work();checks.push(name);}
  let project,savedReply,historicalReply,catalogAudit;
  const readCatalogAudit=async sql=>(await sql.query('SELECT event_id,action,subject,revision,actor FROM croupier_studio.audit_events WHERE environment_id=$1 AND workspace_id=$2 AND subject=$3',[scope.environment,scope.workspaceId,'runtime-media-catalog'])).rows;
  await check('runtime catalog SQL import plans read-only, applies with audit, and captures scoped embedded JSON',async()=>{
    await assert.rejects(repository.readRuntimeCatalog(),hasCode('studio_runtime_catalog_missing'));
    project=await repository.initializeDocument('project',{value:addDealer(addDealer(createEmptyProject(),'astrid','Astrid'),'dragan','Dragan'),revision:'runtime-project.1',actor:'isolated-qa'});
    await repository.initializeDocument('administration',{value:{rooms:[]},revision:'runtime-admin.1',actor:'isolated-qa'});
    await assert.rejects(repository.readPresentationSnapshot(),hasCode('studio_runtime_catalog_missing'));
    const prepared=await prepareRuntimeMediaImport({scope,sourceRoot:fileURLToPath(new URL('../../',import.meta.url))});
    assert.equal(prepared.revision,catalogRevision);assert.equal(runtimeCatalogJson(prepared.value),runtimeCatalogJson(catalog));
    const plan=await planRuntimeMediaImport({pool,prepared});assert.equal(plan.operation,'insert');assert.equal(plan.expectedRevision,null);assert.deepEqual(plan.scope,scope);
    await assert.rejects(repository.readRuntimeCatalog(),hasCode('studio_runtime_catalog_missing'));assert.deepEqual(await readCatalogAudit(pool),[]);
    const applied=await applyRuntimeMediaImport({pool,prepared,expectedPlan:plan,confirm:true,actor:'isolated-qa'});
    assert.equal(applied.changed,true);assert.equal(applied.revision,catalogRevision);assert.equal(applied.previousRevision,null);assert.equal(applied.planHash,plan.planHash);
    const expected={revision:catalogRevision,value:catalog};assert.deepEqual(await repository.readRuntimeCatalog(),expected);
    catalogAudit=await readCatalogAudit(pool);assert.equal(catalogAudit.length,1);
    const {event_id,...event}=catalogAudit[0];assert.match(event_id,/^[a-f0-9-]{36}$/);
    assert.deepEqual(event,{action:'import_document',subject:'runtime-media-catalog',revision:catalogRevision,actor:'isolated-qa'});
    const replay=await planRuntimeMediaImport({pool,prepared});assert.equal(replay.operation,'unchanged');assert.equal(replay.expectedRevision,catalogRevision);
    assert.equal((await applyRuntimeMediaImport({pool,prepared,expectedPlan:replay,confirm:true,actor:'isolated-qa'})).changed,false);
    assert.deepEqual(await readCatalogAudit(pool),catalogAudit);assert.deepEqual(await repository.readRuntimeCatalog(),expected);
    const snapshot=await repository.readPresentationSnapshot();assert.deepEqual(snapshot.runtimeCatalog,expected);assert.deepEqual(snapshot.projectDocument,project);assert.deepEqual(snapshot.mediaRows,[]);assert.ok(Object.isFrozen(snapshot.runtimeCatalog.value.legacy.entries));
    const jsonRows=catalog.blobIndex.files.filter(row=>row.access!=='source'&&row.storage.contentType==='application/json');assert.ok(jsonRows.length>0);
    for(const row of jsonRows){const text=snapshot.runtimeCatalog.value.legacy.entries['media/'+row.logicalPath];assert.equal(typeof text,'string');assert.doesNotThrow(()=>JSON.parse(text));}
    for(const otherScope of [{...scope,environment:scope.environment+'_other'},{...scope,workspaceId:'other'}]){
      await assert.rejects(createStudioRepository({pool,scope:otherScope}).readRuntimeCatalog(),hasCode('studio_runtime_catalog_missing'));
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM croupier_studio.runtime_media_catalogs WHERE environment_id=$1 AND workspace_id=$2',[otherScope.environment,otherScope.workspaceId])).rows[0].count,0);
    }
  });
  await check('runtime catalog SQL rollback and changed checksum cannot silently replace a snapshot',async()=>{
    const client=await pool.connect();try{await client.query('BEGIN');await client.query('UPDATE croupier_studio.runtime_media_catalogs SET revision=$3 WHERE environment_id=$1 AND workspace_id=$2',[scope.environment,scope.workspaceId,'0'.repeat(64)]);await client.query('ROLLBACK');}finally{await client.query('ROLLBACK').catch(()=>{});client.release();}
    assert.equal((await repository.readPresentationSnapshot()).runtimeCatalog.revision,catalogRevision);
    await pool.query('UPDATE croupier_studio.runtime_media_catalogs SET revision=$3 WHERE environment_id=$1 AND workspace_id=$2',[scope.environment,scope.workspaceId,'0'.repeat(64)]);
    try{await assert.rejects(repository.readRuntimeCatalog(),hasCode('studio_runtime_catalog_invalid'));await assert.rejects(repository.readPresentationSnapshot(),hasCode('studio_runtime_catalog_invalid'));}
    finally{await pool.query('UPDATE croupier_studio.runtime_media_catalogs SET revision=$3 WHERE environment_id=$1 AND workspace_id=$2',[scope.environment,scope.workspaceId,catalogRevision]);}
  });
  await check('real speech SQL accepts exactly one create and one concurrent category CAS',async()=>{
    const original=reply(scope),created=await Promise.allSettled([replies.create(original),replies.create(original)]);
    assert.equal(created.filter(row=>row.status==='fulfilled').length,1);assert.equal(created.find(row=>row.status==='rejected').reason.code,'reply_library_revision_conflict');
    let writers=0,release,rejectBarrier;const bothAuthorized=new Promise((resolve,reject)=>{release=resolve;rejectBarrier=reject;});
    const timer=setTimeout(()=>rejectBarrier(Error('both SQL writers must reach the CAS barrier')),5000);timer.unref?.();
    let edited;try{edited=await Promise.allSettled(['player-kind','player-question'].map(category=>library.categorize({dealerId:original.dealerId,id:original.id,categories:[category],expectedRevision:1,
      stillAuthorized:async()=>{if(++writers===2)release();await bothAuthorized;}})));}finally{clearTimeout(timer);}
    assert.equal(writers,2);assert.equal(edited.filter(row=>row.status==='fulfilled').length,1);assert.equal(edited.find(row=>row.status==='rejected').reason.code,'reply_library_revision_conflict');
    savedReply=await replies.read(original.dealerId,original.id);assert.equal(savedReply.revision,2);assert.equal(savedReply.exactText,original.exactText);assert.deepEqual(savedReply.media,original.media);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM croupier_studio.speech_reply_records WHERE environment_id=$1 AND workspace_id=$2',[scope.environment,scope.workspaceId])).rows[0].count,1);
    assert.equal((await replies.list({dealerId:'astrid',category:savedReply.categories[0]})).values.length,1);
    assert.equal((await replies.list({dealerId:'astrid',category:'player-help'})).values.length,0);
  });
  await check('speech SQL refuses immutable edits, foreign scope and mismatched JSON identity',async()=>{
    await assert.rejects(replies.update({...savedReply,revision:3,exactText:'Illegal replacement'},2),hasCode('reply_library_revision_conflict'));
    const media=structuredClone(savedReply.media),hash='d'.repeat(64);media.audio={...media.audio,sha256:hash,pathname:media.audio.pathname.replace('a'.repeat(64),hash)};
    await assert.rejects(replies.update({...savedReply,revision:3,media},2),hasCode('reply_library_revision_conflict'));
    for(const otherScope of [{...scope,environment:scope.environment+'_other'},{...scope,workspaceId:'other'}]){
      const foreign=createSpeechReplyRepository({sql:pool,scope:otherScope});assert.equal(await foreign.read(savedReply.dealerId,savedReply.id),null);assert.deepEqual((await foreign.list({dealerId:'astrid'})).values,[]);
    }
    const invalid=reply(scope);await assert.rejects(pool.query('INSERT INTO croupier_studio.speech_reply_records (environment_id,workspace_id,dealer_id,id,revision,value) VALUES ($1,$2,$3,$4,$5,$6::jsonb)',
      [scope.environment,scope.workspaceId,'dragan',invalid.id,1,JSON.stringify(invalid)]),hasCode('23514'));
    await assert.rejects(pool.query('INSERT INTO croupier_studio.speech_reply_records (environment_id,workspace_id,dealer_id,id,revision,value) VALUES ($1,$2,$3,$4,$5,$6::jsonb)',
      [scope.environment,scope.workspaceId,invalid.dealerId,invalid.id,2,JSON.stringify(invalid)]),hasCode('23514'));
    assert.deepEqual(await replies.read(savedReply.dealerId,savedReply.id),savedReply);
  });
  await check('speech SQL transaction rollback preserves both existing and absent identities',async()=>{
    const client=await pool.connect(),created=reply(scope,'dragan');
    try{await client.query('BEGIN');const inside=createSpeechReplyRepository({sql:client,scope});await inside.create(created);await inside.update({...savedReply,revision:3,categories:['player-help']},2);
      assert.equal((await inside.read(savedReply.dealerId,savedReply.id)).revision,3);assert.equal(await replies.read(created.dealerId,created.id),null);assert.deepEqual(await replies.read(savedReply.dealerId,savedReply.id),savedReply);
      await client.query('ROLLBACK');
    }finally{await client.query('ROLLBACK').catch(()=>{});client.release();}
    assert.equal(await replies.read(created.dealerId,created.id),null);assert.deepEqual(await replies.read(savedReply.dealerId,savedReply.id),savedReply);
  });
  await check('historical speech import preserves revision without registering a dealer or overwriting content',async()=>{
    const old={...reply(scope,'paow-v2'),revision:7};historicalReply=old;assert.equal((await replies.importValue(old)).created,true);assert.equal((await replies.importValue(old)).created,false);
    await assert.rejects(replies.importValue({...old,exactText:'Different historical text'}),hasCode('reply_library_import_conflict'));assert.deepEqual(await replies.read(old.dealerId,old.id),old);
    assert.deepEqual(await repository.readDocument('project'),project);
  });
  return {checks,async assertPersisted(nextPool){
    const nextRepository=createStudioRepository({pool:nextPool,scope}),nextReplies=createSpeechReplyRepository({sql:nextPool,scope});
    assert.deepEqual(await nextRepository.readRuntimeCatalog(),{revision:catalogRevision,value:catalog});
    assert.deepEqual(await readCatalogAudit(nextPool),catalogAudit);
    assert.deepEqual(await nextRepository.readDocument('project'),project);assert.deepEqual(await nextReplies.read(savedReply.dealerId,savedReply.id),savedReply);
    assert.deepEqual(await nextReplies.read(historicalReply.dealerId,historicalReply.id),historicalReply);
  }};
}
