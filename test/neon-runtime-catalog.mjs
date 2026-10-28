import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRuntimeMediaCatalog,validateRuntimeCatalogRecord,runtimeCatalogRevision,createEmptyRuntimeMediaCatalog,isEmptyRuntimeMediaCatalog} from '../packages/studio-registry/server/runtime-catalog.mjs';
import {readRuntimeCatalogFixture} from './fixtures/runtime-media-catalog.mjs';
import {syntheticPresentationManifest,withSyntheticBank} from './fixtures/presentation-bank.mjs';
import {createStudioMemoryPool} from './fixtures/studio-memory-pool.mjs';
import {createStudioRepository} from '../packages/studio-registry/server/document-repository.mjs';
const scope={environment:'fixture',workspaceId:'catalog-owner'};
// The repository has no bank; a catalogue that still carries one stays a supported contract.
const withBank=()=>withSyntheticBank(readRuntimeCatalogFixture());
test('Neon catalogue retains all exact bank identities and UTF8 metadata and detaches inputs',()=>{
 const source=withBank(),value=validateRuntimeMediaCatalog(source);
 assert.deepEqual(value,source);assert.notEqual(value,source);
 assert.equal(value.presentation.items.length,syntheticPresentationManifest().items.length);
 const servedJson=value.blobIndex.files.filter(row=>row.access!=='source'&&row.storage.contentType==='application/json');
 assert.ok(servedJson.length>0);assert.equal(Object.keys(value.legacy.entries).length,servedJson.length);
 assert.deepEqual(validateRuntimeCatalogRecord({revision:runtimeCatalogRevision(value),value}).value,value);
});
test('cross-linked metadata, missing public JSON, mismatched Blob bytes and revisions fail closed',()=>{
 for(const change of [v=>delete v.legacy.entries[Object.keys(v.legacy.entries)[0]],v=>v.legacy.entries[Object.keys(v.legacy.entries)[0]]+=' ',
  v=>v.blobIndex.files[0].storage.sha256='a'.repeat(64),v=>v.presentation.items[0].id='10000000-0000-4000-8000-000000000001',
  v=>v.layout.files[0].canonicalPath='../other']){
  const value=withBank();change(value);
  assert.throws(()=>validateRuntimeMediaCatalog(value),e=>e.code==='studio_runtime_catalog_invalid');
 }
 const value=withBank();assert.throws(()=>validateRuntimeCatalogRecord({revision:'a'.repeat(64),value}),e=>e.code==='studio_runtime_catalog_invalid');
});
test('catalogue is scoped Neon state; missing database or scope never becomes a local bank',async()=>{
 const pool=createStudioMemoryPool(),repository=createStudioRepository({pool,scope});
 await assert.rejects(repository.readRuntimeCatalog(),e=>e.code==='studio_runtime_catalog_missing');
 pool.seedRuntimeCatalog(scope,readRuntimeCatalogFixture());
 const current=await repository.readRuntimeCatalog();assert.equal(current.revision,runtimeCatalogRevision(current.value));
 const other=createStudioRepository({pool,scope:{...scope,workspaceId:'other'}});
 await assert.rejects(other.readRuntimeCatalog(),e=>e.code==='studio_runtime_catalog_missing');
 pool.failNext('read-runtime-catalog');await assert.rejects(repository.readRuntimeCatalog(),e=>e.code==='studio_storage_unavailable');
 assert.ok(pool.calls.filter(r=>r.marker==='read-runtime-catalog').every(r=>r.values.length===2));
});


test('explicit empty catalogue is detached, exact and contains no historical bank identity',()=>{
 const source=createEmptyRuntimeMediaCatalog(),value=validateRuntimeMediaCatalog(source);
 assert.equal(isEmptyRuntimeMediaCatalog(value),true);assert.deepEqual(value,source);assert.notEqual(value,source);
 assert.equal(value.presentation.source,'scoutgaming-empty');assert.deepEqual(value.presentation.items,[]);
 assert.equal(validateRuntimeCatalogRecord({revision:runtimeCatalogRevision(value),value}).revision,runtimeCatalogRevision(value));
 source.layout.files.push({});assert.deepEqual(createEmptyRuntimeMediaCatalog().layout.files,[]);
 for(const change of [
  v=>v.layout.files.push({}),v=>v.layout.roots.old='media/old',v=>v.blobIndex.files.push({}),
  v=>v.presentation.items.push({}),v=>v.presentation.families.push({}),v=>v.legacy.entries['media/old']='{}',
  v=>v.extra=true,v=>v.layout.extra=true,v=>v.blobIndex.extra=true,v=>v.presentation.extra=true,v=>v.legacy.extra=true,
  v=>v.blobIndex.verification='unchecked',v=>v.presentation.schemaVersion=2,
  v=>v.presentation.source='emil/dealklipp-v1',v=>delete v.presentation,v=>v.legacy=null,
 ]) {
  const broken=createEmptyRuntimeMediaCatalog();change(broken);
  assert.equal(isEmptyRuntimeMediaCatalog(broken),false);
  assert.throws(()=>validateRuntimeMediaCatalog(broken),{code:'studio_runtime_catalog_invalid'});
 }
 for(const absent of [undefined,null,{}])assert.throws(()=>validateRuntimeMediaCatalog(absent),{code:'studio_runtime_catalog_invalid'});
});

// The game and site assets without any dealer rows or presentation bank.
function withoutDealerBank(value=readRuntimeCatalogFixture()) {
 const dealer=path=>path.startsWith('dealers/');
 value.layout.files=value.layout.files.filter(row=>!dealer(row.path));
 value.blobIndex.files=value.blobIndex.files.filter(row=>!dealer(row.logicalPath));
 value.legacy.entries=Object.fromEntries(Object.entries(value.legacy.entries).filter(([path])=>!dealer(path.slice('media/'.length))));
 value.presentation=createEmptyRuntimeMediaCatalog().presentation;
 return value;
}
test('game and site assets without a presentation bank form a valid, non-empty catalogue',()=>{
 const source=withoutDealerBank(),value=validateRuntimeMediaCatalog(source);
 assert.deepEqual(value,source);assert.notEqual(value,source);assert.equal(isEmptyRuntimeMediaCatalog(value),false);
 assert.ok(value.blobIndex.files.some(row=>row.access==='public'&&row.logicalPath.startsWith('game/')),'public game assets remain indexed');
 assert.deepEqual([value.presentation.families,value.presentation.items],[[],[]]);
 assert.equal(validateRuntimeCatalogRecord({revision:runtimeCatalogRevision(value),value}).revision,runtimeCatalogRevision(value));
 // A bank may leave the presentation before its rows leave the layout.
 const retiring=withBank();retiring.presentation=createEmptyRuntimeMediaCatalog().presentation;
 assert.deepEqual(validateRuntimeMediaCatalog(retiring).presentation.items,[]);
 const bank=syntheticPresentationManifest();
 for(const change of [
  v=>v.presentation.items.push(...bank.items.slice(0,1)),v=>v.presentation.families.push(...bank.families.slice(0,1)),
  v=>v.presentation.extra=true,v=>v.presentation.source='other',v=>v.presentation.schemaVersion=2,
  v=>v.blobIndex.files[0].storage.sha256='a'.repeat(64),v=>delete v.legacy.entries[Object.keys(v.legacy.entries)[0]],
  // Only the exact empty catalogue may carry no media at all.
  v=>{v.layout.files=[];v.blobIndex.files=[];v.legacy.entries={};v.layout.roots={old:'media/old'};},
 ]) {
  const broken=withoutDealerBank();change(broken);
  assert.throws(()=>validateRuntimeMediaCatalog(broken),{code:'studio_runtime_catalog_invalid'});
 }
});

test('an empty catalogue still requires its exact scoped persisted row and revision',async()=>{
 const pool=createStudioMemoryPool(),repository=createStudioRepository({pool,scope});
 pool.seedRuntimeCatalog(scope,createEmptyRuntimeMediaCatalog());
 assert.equal(isEmptyRuntimeMediaCatalog((await repository.readRuntimeCatalog()).value),true);
 const other=createStudioRepository({pool,scope:{...scope,workspaceId:'empty-other'}});
 await assert.rejects(other.readRuntimeCatalog(),{code:'studio_runtime_catalog_missing'});
 pool.failNext('read-runtime-catalog');await assert.rejects(repository.readRuntimeCatalog(),{code:'studio_storage_unavailable'});
 assert.throws(()=>validateRuntimeCatalogRecord({revision:'a'.repeat(64),value:createEmptyRuntimeMediaCatalog()}),{code:'studio_runtime_catalog_invalid'});
});
