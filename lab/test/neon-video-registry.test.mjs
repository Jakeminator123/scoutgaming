import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createNeonVideoRegistry } from '../lib/neon-video-registry.mjs';
import { MEDIA_FAMILY_DEFINITIONS, videoIdFromSha256 } from '../lib/lab-video-manifest.mjs';
import { mediaBlobPath } from '../lib/cloud-media-store.mjs';
import { createStudioRepository } from '../../web/storage/studio-repository.mjs';
import { createStudioMemoryPool } from '../../test/fixtures/studio-memory-pool.mjs';

const scope = Object.freeze({ environment: 'test', workspaceId: 'studio-test' });
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'croupier-neon-registry-'));
  t.after(() => {
    assert.equal(dirname(resolve(root)), resolve(tmpdir())); assert.match(basename(root), /^croupier-neon-registry-/);
    return rm(root, { recursive: true, force: true });
  });
  const archive = join(root, 'media/dealers/astrid/runtime/presentation'); await mkdir(archive, {recursive:true});
  const pool = createStudioMemoryPool(), repository = createStudioRepository({ pool, scope });
  const objects = new Map(), items = [], files = [], layout = [];
  for (const family of MEDIA_FAMILY_DEFINITIONS) for (const relativePath of family.standardPaths) {
    const bytes = Buffer.from(`0000ftypisom00000fixture:${relativePath}`), sha256 = createHash('sha256').update(bytes).digest('hex'), id = videoIdFromSha256(sha256);
    const logicalPath = `dealers/astrid/runtime/presentation/${relativePath}`, directory = logicalPath.slice(0, logicalPath.lastIndexOf('/'));
    const pathname = mediaBlobPath(directory, id, sha256, 'mp4'); objects.set(pathname, bytes);
    items.push({id, familyId:family.id, role:'standard', relativePath, extension:'mp4', size:bytes.length, sha256});
    files.push({logicalPath, id, access:'source', sha256, size:bytes.length, storage:{provider:'vercel-blob',pathname,sha256,size:bytes.length,contentType:'video/mp4'}});
    layout.push({path:logicalPath, legacyPath:`fixture/${relativePath}`, access:'source', sha256, size:bytes.length});
  }
  const families = MEDIA_FAMILY_DEFINITIONS.map(family => ({id:family.id,dealerId:family.dealerId,eventId:family.eventId,situation:family.situation,playbackType:family.playbackType,
    standardIds: family.standardPaths.map(path => items.find(item => item.relativePath === path).id), variantIds:[]}));
  await writeFile(join(archive,'lab-video-manifest.json'), JSON.stringify({schemaVersion:2,source:'emil/dealklipp-v1',families,items}));
  await writeFile(join(root,'media/layout.json'), JSON.stringify({schemaVersion:1,roots:{},files:layout}));
  const indexPath = join(root,'media/blob-index.json');
  await writeFile(indexPath, JSON.stringify({schemaVersion:1,namespace:'croupier/media',verification:'readback-sha256',files}));
  const uploadDir = join(root,'retired-uploads'); await mkdir(uploadDir);
  await writeFile(join(uploadDir,'index.json'), 'deliberately invalid old register must not be read');
  await writeFile(join(uploadDir,'classifications.json'), 'retired classifications must not be read');
  const env = {CROUPIER_MEDIA_STORAGE:'blob',BLOB_READ_WRITE_TOKEN:'fixture-secret',CROUPIER_MEDIA_BLOB_INDEX:indexPath};
  const blobClient = { async get(path) {
    const bytes = objects.get(path); if (!bytes) return null;
    return {statusCode:200,stream:new Response(bytes).body,blob:{pathname:path,url:`https://fixture.private.blob.vercel-storage.com/${path}`,size:bytes.length,contentType:'video/mp4'}};
  }};
  const options = {repositoryRoot:root,uploadDir,cacheDir:join(root,'scratch'),blobClient};
  const registry = createNeonVideoRegistry({repository,scope,env,options});
  async function newMedia() {
    const bytes = Buffer.from('0000ftypisom00000new-upload-fixture'), sha256 = createHash('sha256').update(bytes).digest('hex'), id = randomUUID();
    const record = {id,sha256,size:bytes.length,contentType:'video/mp4',pathname:mediaBlobPath('dealers/astrid/review/uploads',id,sha256,'mp4'),
      classification:{dealerId:'astrid',eventId:'deal.player.left',kind:'action',role:'alternative',situation:'box0',familyId:'astrid/deal.player.left/box0',label:'New exact clip',notes:''}};
    objects.set(record.pathname,bytes); await repository.registerMedia(record,{actor:'Operator'}); return {record,bytes};
  }
  return {root,pool,repository,registry,env,options,items,objects,newMedia};
}
test('native registry preserves the active bank and exact Neon variants without reading retired disk indexes', async t => {
  const {registry,newMedia,items,env,root} = await fixture(t), {record} = await newMedia();
  const result = await registry.load(); assert.equal(result.videos.length, items.length + 1);
  const video = result.videos.find(row => row.id === record.id);
  assert.equal(video.available,true); assert.equal(video.storage,'private-blob'); assert.equal(video.bindingScope,'shared-local');
  assert.equal(video.familyId,'astrid/deal.player.left/box0'); assert.equal(video.role,'variant'); assert.equal(video.reviewStatus,'unreviewed');
  assert.ok(result.families.find(family => family.id === video.familyId).variantIds.includes(record.id));
  assert.deepEqual(result.families.flatMap(family => family.standardIds).sort(),items.map(item => item.id).sort());
  const publicData = JSON.stringify(result); assert.ok(!publicData.includes(env.BLOB_READ_WRITE_TOKEN)); assert.ok(!publicData.includes(root)); assert.ok(!publicData.includes(record.pathname));
});
test('unavailable Neon does not become an empty review library or disk fallback', async t => {
  const {pool,registry} = await fixture(t); pool.failNext('list-media',new Error('private database detail'));
  await assert.rejects(registry.load(), error => error.statusCode === 503 && error.code === 'studio_storage_unavailable');
});
test('missing cloud source, wrong scope or corrupted immutable manifest is rejected', async t => {
  const {registry,repository,env,options,root} = await fixture(t);
  assert.throws(() => createNeonVideoRegistry({repository,scope:{...scope,workspaceId:'other'},env,options}), error => error.statusCode === 503);
  await assert.rejects(createNeonVideoRegistry({repository,scope,env:{...env,CROUPIER_MEDIA_STORAGE:'disk'},options}).load(), error => error.code === 'studio_media_storage_unavailable');
  await writeFile(join(root,'media/dealers/astrid/runtime/presentation/lab-video-manifest.json'),'{corrupt');
  await assert.rejects(registry.load(),error => error.statusCode === 503);
});
test('active bank and new Neon preview use verified private Blob bytes with HEAD/Range', async t => {
  const {registry,newMedia,items,objects} = await fixture(t), {record,bytes} = await newMedia();
  const req = (id,method = 'GET',headers = {}) => new Request(`https://studio.example.invalid/studio/api/videos/${id}`,{method,headers});
  const head = await registry.response(record.id,req(record.id,'HEAD')); assert.equal(head.status,200); assert.equal(head.headers.get('content-length'),String(bytes.length));
  const range = await registry.response(record.id,req(record.id,'GET',{range:'bytes=2-8'})); assert.equal(range.status,206);
  assert.deepEqual(Buffer.from(await range.arrayBuffer()),bytes.subarray(2,9));
  const active = await registry.response(items[0].id,req(items[0].id)); assert.equal(active.status,200);
  assert.equal(createHash('sha256').update(Buffer.from(await active.arrayBuffer())).digest('hex'),items[0].sha256);
  objects.clear();
  assert.equal((await registry.response(randomUUID(),req(randomUUID()))).status,404);
});
