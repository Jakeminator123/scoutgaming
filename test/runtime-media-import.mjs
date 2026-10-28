import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {prepareRuntimeMediaImport,prepareEmptyRuntimeMediaImport,planRuntimeMediaImport,applyRuntimeMediaImport} from '../ops/neon-studio/runtime-media-import.mjs';
import {runtimeCatalogJson,runtimeCatalogRevision} from '../packages/studio-registry/server/runtime-catalog.mjs';
import {readRuntimeCatalogFixture} from './fixtures/runtime-media-catalog.mjs';
import {focusedTests,checkPlan} from '../tools/precommit-checks.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const scope={environment:'test',workspaceId:'runtime-import'};
const prepared=await prepareRuntimeMediaImport({scope,sourceRoot:root});
const hash=value=>createHash('sha256').update(value).digest('hex');
const target={database:'croupier_isolated_test',role:'studio_qa',address:'127.0.0.1',port:55432};
const schema={target,schemaPresent:true,toApply:[],applied:['001','002','003','004','005','006','007','008','011','012','013','014','015','017']
  .map(version=>({version,checksum:hash(version),structureChecksum:hash('structure-'+version)}))};
const schemaCheck=async()=>structuredClone(schema);
const key=value=>JSON.stringify([value.environment,value.workspaceId]);
const changed=()=>{const next=structuredClone(prepared);next.value.layout.provenance={...next.value.layout.provenance,importTest:'changed metadata'};
  next.revision=runtimeCatalogRevision(next.value);return next;};

// Domain transaction fixture, not a substitute for the separate real SQL test.
function memoryPool(){
  let state={catalogs:new Map(),audits:[]},tail=Promise.resolve(),failure=null;
  const calls=[];
  const pool={calls,commitRollback:false,target:structuredClone(target),ledger:schema.applied.map(row=>({version:row.version,checksum:row.checksum,structure_checksum:row.structureChecksum})),
    snapshot:()=>structuredClone(state),seed:(scope,row)=>state.catalogs.set(key(scope),structuredClone(row)),failNext:tag=>{failure=tag;},
    async connect(){let working,write=false,unlock;
      return {release(){unlock?.();},async query(sql,values=[]){
        const tag=/\/\* runtime-media-import:([^*]+) \*\//.exec(sql)?.[1]??sql.split(/\s/)[0];calls.push({tag,sql,values:structuredClone(values)});
        if(failure===tag){failure=null;throw Error('PRIVATE postgres://credential@host');}
        const result=(rows=[],command='SELECT')=>({rows:structuredClone(rows),command});
        if(sql.startsWith('BEGIN')){write=!sql.includes('READ ONLY');working=structuredClone(state);return result([],'BEGIN');}
        if(sql.startsWith('SET LOCAL'))return result([],'SET');
        if(tag==='migration-lock'){const previous=tail;tail=new Promise(resolve=>{unlock=resolve;});await previous;working=structuredClone(state);return result();}
        if(tag==='scope-lock')return result();
        if(sql==='COMMIT'||sql==='ROLLBACK'){
          const command=sql==='COMMIT'&&pool.commitRollback?'ROLLBACK':sql;pool.commitRollback=false;
          if(command==='COMMIT'&&write)state=working;working=undefined;unlock?.();unlock=null;return result([],command);
        }
        assert.ok(working,'queries require a transaction');
        if(tag==='target')return result([pool.target]);
        if(tag==='ledger')return result(pool.ledger);
        const rowKey=JSON.stringify(values.slice(0,2));
        if(tag==='catalog')return result(working.catalogs.has(rowKey)?[working.catalogs.get(rowKey)]:[]);
        if(tag==='insert'||tag==='update'){
          assert.equal(write,true);const current=working.catalogs.get(rowKey);
          if(tag==='insert'?Boolean(current):current?.revision!==values[4])return result();
          const row={revision:values[2],value:JSON.parse(values[3])};working.catalogs.set(rowKey,row);return result([row]);
        }
        if(tag==='audit'){assert.equal(write,true);working.audits.push(structuredClone(values));return result();}
        throw Error('Unexpected test query '+tag);
      }};
    }};
  return pool;
}
const plan=(pool,source=prepared)=>planRuntimeMediaImport({pool,prepared:source,schemaCheck});
const apply=(pool,expectedPlan,overrides={})=>applyRuntimeMediaImport({pool,prepared,expectedPlan,confirm:true,actor:'isolated-admin',schemaCheck,...overrides});

test('prepare preserves exact four-file metadata and filters only index paths absent from layout',async()=>{
  const layout=JSON.parse(await readFile(new URL('../media/layout.json',import.meta.url),'utf8'));
  const index=JSON.parse(await readFile(new URL('../media/blob-index.json',import.meta.url),'utf8'));
  const legacy=JSON.parse(await readFile(new URL('../media/catalog/legacy.json',import.meta.url),'utf8'));
  const paths=new Set(layout.files.map(row=>row.path));
  assert.deepEqual(prepared.value.layout,layout);
  for(const [path,text] of Object.entries(legacy.entries))assert.equal(prepared.value.legacy.entries[path],text);
  const jsonRows=index.files.filter(row=>paths.has(row.logicalPath)&&['public','private'].includes(row.access)&&row.storage?.contentType==='application/json');
  assert.ok(jsonRows.length>0);assert.equal(jsonRows.length,Object.keys(legacy.entries).length);
  for(const row of jsonRows){
    const text=prepared.value.legacy.entries['media/'+row.logicalPath];assert.equal(Buffer.byteLength(text),row.size);assert.equal(hash(Buffer.from(text)),row.sha256);
  }
  assert.deepEqual(prepared.value,readRuntimeCatalogFixture(root));
  assert.deepEqual(prepared.value.blobIndex,{...index,files:index.files.filter(row=>paths.has(row.logicalPath))});
  assert.equal(prepared.sourceIndexCount,index.files.length);assert.equal(prepared.revision,runtimeCatalogRevision(prepared.value));
  for(const [path,proof] of Object.entries(prepared.sourceHashes)){
    const bytes=await readFile(new URL('../'+path,import.meta.url));assert.equal(proof.sha256,hash(bytes));assert.equal(proof.size,bytes.length);
  }
  assert.equal(Object.isFrozen(prepared.value.legacy.entries),true);
  await assert.rejects(prepareRuntimeMediaImport({scope}),{code:'studio_runtime_import_source_required'});
});

test('provided metadata reader is used for every exact JSON tuple and corrupt bytes never become catalogue metadata',async()=>{
  const seen=[];
  const reader=async row=>{seen.push(row.logicalPath);assert.equal(Object.isFrozen(row),true);return readFile(new URL('../media/'+row.logicalPath,import.meta.url));};
  const imported=await prepareRuntimeMediaImport({scope,sourceRoot:root,readMetadataBytes:reader});
  const served=Object.keys(prepared.value.legacy.entries).length;assert.ok(served>0);
  assert.equal(seen.length,served);assert.equal(new Set(seen).size,served);assert.equal(imported.revision,prepared.revision);
  for(const readMetadataBytes of [async()=>Buffer.from('{}'),async()=>new Uint8Array(),async()=>'{"not":"bytes"}'])
    await assert.rejects(prepareRuntimeMediaImport({scope,sourceRoot:root,readMetadataBytes}),error=>['studio_runtime_import_metadata_identity_invalid','studio_runtime_import_metadata_bytes_required'].includes(error.code));
  await assert.rejects(prepareRuntimeMediaImport({scope,sourceRoot:root,readMetadataBytes:async()=>{throw Error('PRIVATE credential');}}),
    error=>error.code==='studio_runtime_import_metadata_unavailable'&&!JSON.stringify(error).includes('credential'));
});

// Hook registration of these files is enforced by tools/check-orphan-tests.mjs in CI.
test('focused selection discovers importer/catalog tests and full mode runs the full hook',async()=>{
  const changes=[{status:'M',path:'ops/neon-studio/runtime-media-import.mjs'},{status:'M',path:'packages/studio-registry/server/runtime-catalog.mjs'}];
  const selected=focusedTests(changes,root);
  for(const file of ['test/runtime-media-catalog.mjs','test/runtime-media-import.mjs'])assert.ok(selected.includes(file));
  assert.deepEqual(checkPlan('full',{changes,root}),[['sh','.githooks/pre-commit-full']]);
});

test('plan is read-only, scope-bound and discloses excluded/source-only counts without claiming Blob reads',async()=>{
  const pool=memoryPool(),before=pool.snapshot(),review=await plan(pool);
  assert.deepEqual(pool.snapshot(),before);assert.equal(review.operation,'insert');assert.equal(review.expectedRevision,null);
  assert.deepEqual(review.scope,scope);assert.equal(review.revision,prepared.revision);assert.match(review.planHash,/^[a-f0-9]{64}$/);
  assert.equal(review.counts.sourceIndex,review.counts.importedIndex+review.counts.excludedIndex);
  assert.equal(review.blobVerification,'metadata-only');
  assert.ok(pool.calls.some(row=>row.sql==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'));
  assert.ok(!pool.calls.some(row=>['insert','update','audit','scope-lock','migration-lock'].includes(row.tag)));
});

test('explicit apply preserves exact catalogue bytes, audits once and leaves other scopes untouched',async()=>{
  const pool=memoryPool(),other={environment:'test',workspaceId:'other'};
  pool.seed(other,{revision:prepared.revision,value:prepared.value});const unrelated=pool.snapshot().catalogs.get(key(other));
  const result=await apply(pool,await plan(pool));assert.equal(result.changed,true);
  const state=pool.snapshot();assert.equal(runtimeCatalogJson(state.catalogs.get(key(scope)).value),runtimeCatalogJson(prepared.value));
  assert.deepEqual(state.catalogs.get(key(other)),unrelated);assert.equal(state.audits.length,1);
  assert.deepEqual(state.audits[0].slice(3),['import_document','runtime-media-catalog',prepared.revision,'isolated-admin']);
  const replay=await apply(pool,await plan(pool));assert.equal(replay.changed,false);assert.deepEqual(pool.snapshot(),state);
  const locks=pool.calls.filter(row=>row.tag.endsWith('-lock'));assert.equal(locks[0].tag,'migration-lock');assert.equal(locks[1].tag,'scope-lock');
});

test('review, source, scope, target and ledger changes fail before any data write',async()=>{
  for(const variant of ['source','scope','review','target','ledger']){
    const pool=memoryPool(),review=structuredClone(await plan(pool)),before=pool.snapshot();let options={};
    if(variant==='source')options.prepared=changed();
    if(variant==='scope')options.prepared={...prepared,scope:{...scope,workspaceId:'different'}};
    if(variant==='review')review.expectedRevision='f'.repeat(64);
    if(variant==='target')pool.target={...target,database:'different'};
    if(variant==='ledger')pool.ledger.at(-1).checksum='f'.repeat(64);
    await assert.rejects(apply(pool,review,options),error=>['studio_runtime_import_plan_changed','studio_runtime_import_target_changed','studio_runtime_import_schema_unverified'].includes(error.code));
    assert.deepEqual(pool.snapshot(),before);assert.ok(!pool.calls.some(row=>['insert','update','audit'].includes(row.tag)));
  }
});

test('confirmation and prepared hash are required before opening a connection',async()=>{
  const pool=memoryPool();
  await assert.rejects(apply(pool,{planHash:'a'.repeat(64)},{confirm:false}),{code:'studio_runtime_import_confirmation_required'});
  await assert.rejects(planRuntimeMediaImport({pool,prepared:{...prepared,revision:'f'.repeat(64)},schemaCheck}),{code:'studio_runtime_import_prepared_invalid'});
  assert.equal(pool.calls.length,0);
  const no012={...schema,applied:schema.applied.filter(row=>row.version!=='012'),optionalPending:[{version:'012'}]};
  await assert.rejects(planRuntimeMediaImport({pool,prepared,schemaCheck:async()=>no012}),{code:'studio_runtime_import_schema_unverified'});
  assert.equal(pool.calls.length,0);
});

test('runtime import requires013 and protects its ledger on subsequent writes',async()=>{
  const missing=structuredClone(schema);missing.applied=missing.applied.filter(row=>row.version!=='013');
  missing.optionalPending=[{version:'013'}];
  const blocked=memoryPool();
  await assert.rejects(planRuntimeMediaImport({pool:blocked,prepared,schemaCheck:async()=>missing}),{code:'studio_runtime_import_schema_unverified'});
  assert.equal(blocked.calls.length,0);
  const pool=memoryPool(),review=await plan(pool);
  assert.equal((await apply(pool,review)).changed,true);assert.equal(pool.snapshot().audits.length,1);
  const again=await plan(pool),before=pool.snapshot();pool.ledger.at(-1).checksum='f'.repeat(64);
  await assert.rejects(apply(pool,again),{code:'studio_runtime_import_schema_unverified'});assert.deepEqual(pool.snapshot(),before);
});

test('runtime import rejects required gaps unknown versions and invalid proofs',async()=>{
  const last=schema.applied.at(-1);
  for(const mutate of [
    value=>{value.applied=value.applied.filter(row=>row.version!=='012');},
    value=>{value.applied=value.applied.filter(row=>row.version!=='013');},
    value=>{value.applied=value.applied.filter(row=>row.version!=='014');},
    value=>{value.applied=value.applied.filter(row=>row.version!=='015');},
    value=>value.applied.push({...last,version:'999'}),
    value=>value.applied.push({...last}),
    value=>{value.applied.reverse();},
    value=>{value.applied.at(-1).checksum='invalid';},
    value=>{value.applied.at(-1).structureChecksum='invalid';},
    value=>{value.toApply=[{version:'013'}];},
  ]){
    const pool=memoryPool(),state=structuredClone(schema);mutate(state);
    await assert.rejects(planRuntimeMediaImport({pool,prepared,schemaCheck:async()=>state}),{code:'studio_runtime_import_schema_unverified'});
    assert.equal(pool.calls.length,0);
  }
});

test('015 is required before runtime import and its installed ledger proof is rechecked on every write',async()=>{
  const missing=structuredClone(schema),blocked=memoryPool();
  missing.applied=missing.applied.filter(row=>row.version!=='015');missing.optionalPending=[{version:'015'}];
  await assert.rejects(planRuntimeMediaImport({pool:blocked,prepared,schemaCheck:async()=>missing}),{code:'studio_runtime_import_schema_unverified'});
  assert.equal(blocked.calls.length,0,'missing015 blocks before a write connection is opened');
  for(const mutate of [pool=>{pool.ledger=pool.ledger.filter(row=>row.version!=='015');},
    pool=>{pool.ledger.find(row=>row.version==='015').checksum='f'.repeat(64);},
    pool=>{pool.ledger.find(row=>row.version==='015').structure_checksum='f'.repeat(64);}]) {
    const pool=memoryPool(),review=await plan(pool);
    assert.equal((await apply(pool,review)).changed,true);
    const next=await plan(pool),before=pool.snapshot();mutate(pool);
    await assert.rejects(apply(pool,next),{code:'studio_runtime_import_schema_unverified'});
    assert.deepEqual(pool.snapshot(),before,'changed015 ledger cannot alter an approved import plan');
  }
});

test('required017 cannot be relabeled optional and every017 proof is rechecked under the write lock',async()=>{
  const missing=structuredClone(schema),blocked=memoryPool();
  missing.applied=missing.applied.filter(row=>row.version!=='017');missing.optionalPending=[{version:'017'}];
  await assert.rejects(planRuntimeMediaImport({pool:blocked,prepared,schemaCheck:async()=>missing}),
    {code:'studio_runtime_import_schema_unverified'});
  assert.equal(blocked.calls.length,0,'missing required017 fails before opening an import transaction');
  for(const mutate of [pool=>{pool.ledger=pool.ledger.filter(row=>row.version!=='017');},
    pool=>{pool.ledger.find(row=>row.version==='017').checksum='f'.repeat(64);},
    pool=>{pool.ledger.find(row=>row.version==='017').structure_checksum='f'.repeat(64);}]){
    const pool=memoryPool(),review=await plan(pool);
    assert.equal((await apply(pool,review)).changed,true);
    const next=await plan(pool),before=pool.snapshot(),offset=pool.calls.length;mutate(pool);
    await assert.rejects(apply(pool,next),{code:'studio_runtime_import_schema_unverified'});
    assert.deepEqual(pool.snapshot(),before);
    const trace=pool.calls.slice(offset),migrationLock=trace.findIndex(row=>row.tag==='migration-lock');
    assert.ok(migrationLock>=0&&migrationLock<trace.findIndex(row=>row.tag==='ledger'));
    assert.equal(trace.some(row=>['insert','update','audit'].includes(row.tag)),false);
  }
});

test('runtime import accepts missing or installed optional016 and still rechecks its ledger proof',async()=>{
  for(const installed of [false,true]){
    const state=structuredClone(schema),pool=memoryPool();
    if(installed)state.applied.splice(-1,0,{version:'016',checksum:hash('016'),structureChecksum:hash('structure-016')});
    else state.optionalPending=[{version:'016'}];
    pool.ledger=state.applied.map(row=>({version:row.version,checksum:row.checksum,structure_checksum:row.structureChecksum}));
    const check=async()=>structuredClone(state);
    const review=await planRuntimeMediaImport({pool,prepared,schemaCheck:check});
    assert.equal((await apply(pool,review,{schemaCheck:check})).changed,true);
    if(installed){
      const next=await planRuntimeMediaImport({pool,prepared,schemaCheck:check}),before=pool.snapshot();
      pool.ledger.find(row=>row.version==='016').structure_checksum='f'.repeat(64);
      await assert.rejects(apply(pool,next,{schemaCheck:check}),{code:'studio_runtime_import_schema_unverified'});
      assert.deepEqual(pool.snapshot(),before);
    }
  }
});

test('concurrent reviewed insert has one winner; stale replacement never overwrites a newer catalogue',async()=>{
  const pool=memoryPool(),review=await plan(pool);
  const results=await Promise.allSettled([apply(pool,review),apply(pool,review)]);
  assert.equal(results.filter(row=>row.status==='fulfilled').length,1);assert.equal(pool.snapshot().audits.length,1);
  const next=changed(),nextPlan=await plan(pool,next);
  const newer=structuredClone(next);newer.value.layout.provenance.importTest='another newer metadata';newer.revision=runtimeCatalogRevision(newer.value);
  pool.seed(scope,{revision:newer.revision,value:newer.value});const before=pool.snapshot();
  await assert.rejects(apply(pool,nextPlan,{prepared:next}),{code:'studio_runtime_import_plan_changed'});assert.deepEqual(pool.snapshot(),before);
});

test('reviewed replacement uses CAS and failures/rollback COMMIT never leave partial catalogue or audit',async()=>{
  const pool=memoryPool();await apply(pool,await plan(pool));
  const next=changed(),review=await plan(pool,next),before=pool.snapshot();pool.failNext('audit');
  await assert.rejects(apply(pool,review,{prepared:next}),error=>error.code==='studio_storage_unavailable'&&!JSON.stringify(error).includes('credential'));
  assert.deepEqual(pool.snapshot(),before);
  pool.commitRollback=true;
  await assert.rejects(apply(pool,review,{prepared:next}),{code:'studio_runtime_import_rolled_back'});assert.deepEqual(pool.snapshot(),before);
  assert.equal((await apply(pool,review,{prepared:next})).changed,true);
  assert.equal(pool.snapshot().catalogs.get(key(scope)).revision,next.revision);
  assert.equal(pool.calls.find(row=>row.tag==='update').values[4],prepared.revision);
});

test('a corrupt stored revision/value is rejected rather than overwritten',async()=>{
  const pool=memoryPool();pool.seed(scope,{revision:'f'.repeat(64),value:prepared.value});const before=pool.snapshot();
  await assert.rejects(plan(pool),{code:'studio_runtime_catalog_invalid'});assert.deepEqual(pool.snapshot(),before);
});


test('empty preparation imports generated metadata explicitly, audits once and preserves other scopes',async()=>{
 const source=prepareEmptyRuntimeMediaImport({scope}),pool=memoryPool();
 assert.equal(source.sourceIndexCount,0);assert.equal(Object.isFrozen(source.value.presentation),true);
 assert.deepEqual(source,prepareEmptyRuntimeMediaImport({scope}));
 const other={...scope,workspaceId:'existing-bank'};pool.seed(other,{revision:prepared.revision,value:prepared.value});
 const review=await plan(pool,source);assert.equal(review.operation,'insert');
 assert.ok(Object.values(review.counts).every(value=>value===0));assert.equal(review.blobVerification,'metadata-only');
 const before=pool.snapshot();
 await assert.rejects(apply(pool,review,{prepared:source,confirm:false}),{code:'studio_runtime_import_confirmation_required'});
 assert.deepEqual(pool.snapshot(),before);
 assert.equal((await apply(pool,review,{prepared:source})).changed,true);
 assert.deepEqual(pool.snapshot().catalogs.get(key(other)),before.catalogs.get(key(other)));
 assert.equal(pool.snapshot().audits.length,1);
 assert.equal((await apply(pool,await plan(pool,source),{prepared:source})).changed,false);
 assert.equal(pool.snapshot().audits.length,1);
 // Ordinary reviewed import may add a real bank later; empty init cannot undo it.
 assert.equal((await apply(pool,await plan(pool))).changed,true);
 const populated=pool.snapshot();
 await assert.rejects(plan(pool,source),{code:'studio_runtime_import_empty_target_required'});
 assert.deepEqual(pool.snapshot(),populated);
});

test('empty initialization cannot replace a bank installed after review or accept changed target/scope',async()=>{
 const source=prepareEmptyRuntimeMediaImport({scope});
 for(const mutation of ['bank','target','scope']){
  const pool=memoryPool(),review=await plan(pool,source);let input=source;
  if(mutation==='bank')pool.seed(scope,{revision:prepared.revision,value:prepared.value});
  if(mutation==='target')pool.target={...target,database:'another_database'};
  if(mutation==='scope')input=prepareEmptyRuntimeMediaImport({scope:{...scope,workspaceId:'another_scope'}});
  const before=pool.snapshot();
  await assert.rejects(apply(pool,review,{prepared:input}),error=>['studio_runtime_import_empty_target_required','studio_runtime_import_target_changed','studio_runtime_import_plan_changed'].includes(error.code));
  assert.deepEqual(pool.snapshot(),before);assert.ok(!pool.calls.some(call=>['insert','update','audit'].includes(call.tag)));
 }
});

test('concurrent empty initialization has one winner and rollback leaves no row or audit',async()=>{
 const source=prepareEmptyRuntimeMediaImport({scope}),pool=memoryPool(),review=await plan(pool,source);
 const results=await Promise.allSettled([apply(pool,review,{prepared:source}),apply(pool,review,{prepared:source})]);
 assert.equal(results.filter(row=>row.status==='fulfilled').length,1);assert.equal(pool.snapshot().audits.length,1);
 for(const failure of ['audit','rollback']){
  const targetPool=memoryPool(),targetPlan=await plan(targetPool,source),before=targetPool.snapshot();
  if(failure==='audit')targetPool.failNext('audit');else targetPool.commitRollback=true;
  await assert.rejects(apply(targetPool,targetPlan,{prepared:source}),{code:failure==='audit'?'studio_storage_unavailable':'studio_runtime_import_rolled_back'});
  assert.deepEqual(targetPool.snapshot(),before);
 }
});

// The game's and site's assets from this checkout, without dealer rows or a presentation bank.
async function banklessSource(t){
  const {mkdtemp,mkdir,writeFile,rm,copyFile}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join,dirname}=await import('node:path');
  const {createEmptyPresentationManifest}=await import('../packages/studio-registry/server/video-manifest.mjs');
  const dir=await mkdtemp(join(tmpdir(),'croupier-bankless-import-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const read=async path=>JSON.parse(await readFile(join(root,path),'utf8')),dealer=path=>path.startsWith('dealers/');
  const put=async(path,value)=>{await mkdir(dirname(join(dir,path)),{recursive:true});await writeFile(join(dir,path),JSON.stringify(value,null,2)+'\n');};
  const layout=await read('media/layout.json'),index=await read('media/blob-index.json'),legacy=await read('media/catalog/legacy.json');
  layout.files=layout.files.filter(row=>!dealer(row.path));index.files=index.files.filter(row=>!dealer(row.logicalPath));
  legacy.entries=Object.fromEntries(Object.entries(legacy.entries).filter(([path])=>!dealer(path.slice('media/'.length))));
  await put('media/layout.json',layout);await put('media/blob-index.json',index);await put('media/catalog/legacy.json',legacy);
  await put('media/catalog/presentation.json',createEmptyPresentationManifest());
  const paths=new Set(layout.files.map(row=>row.path));
  for(const row of index.files.filter(row=>paths.has(row.logicalPath)&&row.access!=='source'&&row.storage.contentType==='application/json')){
    await mkdir(dirname(join(dir,'media',row.logicalPath)),{recursive:true});await copyFile(join(root,'media',row.logicalPath),join(dir,'media',row.logicalPath));
  }
  return dir;
}

test('a reviewed replace can remove the presentation bank while the game and site assets stay indexed',async t=>{
  const source=await prepareRuntimeMediaImport({scope,sourceRoot:await banklessSource(t)});
  assert.deepEqual([source.value.presentation.families,source.value.presentation.items],[[],[]]);
  assert.ok(source.value.blobIndex.files.some(row=>row.access==='public'&&row.logicalPath.startsWith('game/')));
  const {withSyntheticBank}=await import('./fixtures/presentation-bank.mjs');
  const value=withSyntheticBank(prepared.value),current={value,revision:runtimeCatalogRevision(value)};assert.ok(value.presentation.items.length>0);
  const pool=memoryPool();pool.seed(scope,current);
  const review=await plan(pool,source);
  assert.equal(review.operation,'replace');assert.equal(review.expectedRevision,current.revision);assert.equal(review.counts.presentation,0);
  const result=await apply(pool,review,{prepared:source});assert.equal(result.changed,true);assert.equal(result.previousRevision,current.revision);
  const saved=pool.snapshot().catalogs.get(key(scope));
  assert.equal(saved.revision,source.revision);assert.equal(runtimeCatalogJson(saved.value),runtimeCatalogJson(source.value));
});

test('the operator runner plans read-only, saves the review and applies only the confirmed plan hash',async t=>{
  const {parseImportArguments,importScope,runRuntimeMediaImport}=await import('../ops/neon-studio/runtime-media-import-run.mjs');
  assert.deepEqual(parseImportArguments(['plan','--out','plan.json']),{command:'plan',out:'plan.json',planFile:undefined,actor:undefined});
  for(const argv of [[],['plan'],['plan','--plan','x'],['apply','--plan','x'],['apply','--plan','x','--actor','--plan'],['prepare','--out','x'],['import']])
    assert.throws(()=>parseImportArguments(argv),{code:'runtime_import_usage'});
  assert.throws(()=>importScope({CROUPIER_STUDIO_ENVIRONMENT_ID:'production'}),{code:'runtime_import_scope_required'});
  assert.deepEqual(importScope({CROUPIER_STUDIO_ENVIRONMENT_ID:'test',CROUPIER_STUDIO_WORKSPACE_ID:'runtime-import'}),scope);
  const local=await runRuntimeMediaImport({command:'prepare',scope});assert.equal(local.revision,prepared.revision);
  const pool=memoryPool(),current=changed();pool.seed(scope,{revision:current.revision,value:current.value});
  const files=new Map(),io={readText:async path=>{if(!files.has(path))throw Error('missing');return files.get(path);},
    writeText:async(path,text)=>{if(files.has(path))throw Error('exists');files.set(path,text);},schemaCheck};
  const summary=await runRuntimeMediaImport({command:'plan',out:'plan.json',scope,pool,...io});
  assert.deepEqual(Object.keys(summary).sort(),['counts','database','expectedRevision','operation','planHash','revision','role','scope']);
  assert.equal(summary.operation,'replace');assert.doesNotMatch(JSON.stringify(summary),/127\.0\.0\.1/);
  const [planPath]=files.keys();assert.equal(JSON.parse(files.get(planPath)).planHash,summary.planHash);
  await assert.rejects(runRuntimeMediaImport({command:'plan',out:'plan.json',scope,pool,...io}),/exists/,'an earlier review is never overwritten');
  const before=pool.snapshot(),applyPlan=overrides=>runRuntimeMediaImport({command:'apply',planFile:'plan.json',actor:'isolated-admin',scope,pool,...io,...overrides});
  for(const confirm of [undefined,'','f'.repeat(64)])await assert.rejects(applyPlan({confirm}),{code:'runtime_import_confirmation_required'});
  await assert.rejects(applyPlan({confirm:summary.planHash,planFile:'other.json'}),{code:'runtime_import_plan_unreadable'});
  files.set(planPath,JSON.stringify({...JSON.parse(files.get(planPath)),revision:'f'.repeat(64)}));
  await assert.rejects(applyPlan({confirm:summary.planHash}),{code:'runtime_import_source_changed'});
  assert.deepEqual(pool.snapshot(),before);assert.ok(!pool.calls.some(row=>['insert','update','audit'].includes(row.tag)));
  files.set(planPath,JSON.stringify({...JSON.parse(files.get(planPath)),revision:prepared.revision}));
  const applied=await applyPlan({confirm:summary.planHash});
  assert.deepEqual(applied,{scope,revision:prepared.revision,previousRevision:current.revision,changed:true,planHash:summary.planHash});
  assert.equal(pool.snapshot().catalogs.get(key(scope)).revision,prepared.revision);
});
