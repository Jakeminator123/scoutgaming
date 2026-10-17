import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRuntimeMediaCatalog,validateRuntimeCatalogRecord,runtimeCatalogRevision} from '../packages/studio-registry/server/runtime-catalog.mjs';
import {readRuntimeCatalogFixture} from './fixtures/runtime-media-catalog.mjs';
import {createStudioMemoryPool} from './fixtures/studio-memory-pool.mjs';
import {createStudioRepository} from '../web/storage/studio-repository.mjs';
const scope={environment:'fixture',workspaceId:'catalog-owner'};
test('Neon catalogue retains all exact bank identities and UTF8 metadata and detaches inputs',()=>{
 const source=readRuntimeCatalogFixture(),value=validateRuntimeMediaCatalog(source);
 assert.deepEqual(value,source);assert.notEqual(value,source);
 assert.equal(value.presentation.items.length,51);assert.equal(Object.keys(value.legacy.entries).length,18);
 assert.deepEqual(validateRuntimeCatalogRecord({revision:runtimeCatalogRevision(value),value}).value,value);
});
test('cross-linked metadata, missing public JSON, mismatched Blob bytes and revisions fail closed',()=>{
 for(const change of [v=>delete v.legacy.entries[Object.keys(v.legacy.entries)[0]],v=>v.legacy.entries[Object.keys(v.legacy.entries)[0]]+=' ',
  v=>v.blobIndex.files[0].storage.sha256='a'.repeat(64),v=>v.presentation.items[0].id='10000000-0000-4000-8000-000000000001',
  v=>v.layout.files[0].canonicalPath='../other']){
  const value=readRuntimeCatalogFixture();change(value);
  assert.throws(()=>validateRuntimeMediaCatalog(value),e=>e.code==='studio_runtime_catalog_invalid');
 }
 const value=readRuntimeCatalogFixture();assert.throws(()=>validateRuntimeCatalogRecord({revision:'a'.repeat(64),value}),e=>e.code==='studio_runtime_catalog_invalid');
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
