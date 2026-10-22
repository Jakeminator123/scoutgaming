import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, rename, symlink, link } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createQaFixture } from '../../../test/fixtures/k04-shared-room-runtime.mjs';
import { createStudioMemoryPool } from '../../../test/fixtures/studio-memory-pool.mjs';
import { createStudioRepository } from '../../../packages/studio-registry/server/document-repository.mjs';
import { createSeedProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import { MEDIA_FAMILY_DEFINITIONS, videoIdFromSha256 } from '../../../packages/studio-registry/server/video-manifest.mjs';
import { mediaBlobPath } from '../../../packages/studio-registry/server/private-media-contract.mjs';
import { runtimeCatalogRevision } from '../../../packages/studio-registry/server/runtime-catalog.mjs';

// Synthetic bytes and in-memory SQL adapter, NOT media/K04/real-PG acceptance.
const scope = Object.freeze({ environment: 'test', workspaceId: 'shared-qa-localbytes' });
const origin = 'http://127.0.0.1:43879';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const request = (path = '/api/presentation/videos/test', options) => new Request(origin + path, options);
const rejection = error => error instanceof Error;

function catalogFixture() {
  const bytes = new Map(), items = [], families = [], files = [], blobs = [];
  for (const definition of MEDIA_FAMILY_DEFINITIONS) {
    const standardIds = [];
    for (const path of definition.standardPaths) {
      const body = Buffer.from('synthetic byte-port fixture only: ' + path), sha256 = digest(body), id = videoIdFromSha256(sha256);
      standardIds.push(id);
      items.push({ id, familyId: definition.id, role: 'standard', relativePath: path, extension: 'mp4', sha256, size: body.length });
      const logicalPath = 'dealers/astrid/runtime/presentation/' + path;
      const storage = { provider: 'vercel-blob', pathname: mediaBlobPath('dealers/astrid/runtime/presentation/' + path.slice(0, path.lastIndexOf('/')), id, sha256, 'mp4'), sha256, size: body.length, contentType: 'video/mp4' };
      files.push({ path: logicalPath, legacyPath: 'emil/dealklipp-v1/' + path, sha256, size: body.length, access: 'source' });
      blobs.push({ logicalPath, id, access: 'source', sha256, size: body.length, storage });
      bytes.set(logicalPath, body);
    }
    const { id, dealerId, eventId, situation, playbackType } = definition;
    families.push({ id, dealerId, eventId, situation, playbackType, standardIds, variantIds: [] });
  }
  const publicBytes = Buffer.from('synthetic public media bytes, no visual approval'), sha256 = digest(publicBytes), id = videoIdFromSha256(sha256);
  const publicPath = 'game/runtime/k04-preview.mp4';
  const publicStorage = { provider: 'vercel-blob', pathname: mediaBlobPath('game/runtime', id, sha256, 'mp4'), sha256, size: publicBytes.length, contentType: 'video/mp4' };
  files.push({ path: publicPath, legacyPath: 'web/public/qa.mp4', publicUrl: '/assets/qa.mp4', sha256, size: publicBytes.length, access: 'public' });
  blobs.push({ logicalPath: publicPath, id, access: 'public', sha256, size: publicBytes.length, storage: publicStorage });
  bytes.set(publicPath, publicBytes);
  return { bytes, publicPath, publicStorage, value: { schemaVersion: 1, layout: { schemaVersion: 1, roots: {}, files },
    blobIndex: { schemaVersion: 1, namespace: 'croupier/media', verification: 'readback-sha256', files: blobs },
    presentation: { schemaVersion: 2, source: 'emil/dealklipp-v1', families, items }, legacy: { schemaVersion: 2, entries: {} } } };
}
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'k04-local-bytes-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const pool = createStudioMemoryPool(), repository = createStudioRepository({ pool, scope });
  const project = await repository.initializeDocument('project', { value: createSeedProject(), revision: 'fixture-project', actor: 'test-import' });
  await repository.initializeDocument('administration', { value: { rooms: [] }, revision: 'fixture-admin', actor: 'test-import' });
  const catalog = catalogFixture();
  pool.seedRuntimeCatalog(scope, catalog.value);
  const uploadBytes = Buffer.from('synthetic registered clip, not real approved footage'), sha256 = digest(uploadBytes);
  const id = '77777777-7777-4777-8777-777777777777';
  const record = { id, sha256, size: uploadBytes.length, contentType: 'video/mp4', pathname: `croupier/media/dealers/astrid/review/uploads/${id}/${sha256}.mp4`,
    classification: { dealerId: 'astrid', eventId: 'speak.goodluck', kind: 'speech', role: 'alternative', situation: 'goodluck', label: 'Synthetic unit bytes', notes: '', playback: 'once' } };
  const upload = (await repository.registerMedia(record, { actor: 'test-import' })).media;
  const storage = { provider: 'vercel-blob', pathname: record.pathname, sha256, size: record.size, contentType: record.contentType };
  const bank = catalog.value.blobIndex.files[0];
  const manifest = { schemaVersion: 1, scope, origin, files: [
    { source: { kind: 'media', id, revision: upload.revision }, storage, relativePath: 'takes/upload.mp4' },
    { source: { kind: 'catalog', logicalPath: bank.logicalPath, revision: runtimeCatalogRevision(catalog.value) }, storage: bank.storage, relativePath: 'takes/bank.mp4' },
    { source: { kind: 'catalog', logicalPath: catalog.publicPath, revision: runtimeCatalogRevision(catalog.value) }, storage: catalog.publicStorage, relativePath: 'takes/public.mp4' },
  ] };
  await mkdir(join(root, 'takes'));
  await writeFile(join(root, 'takes/upload.mp4'), uploadBytes);
  await writeFile(join(root, 'takes/bank.mp4'), catalog.bytes.get(bank.logicalPath));
  await writeFile(join(root, 'takes/public.mp4'), catalog.bytes.get(catalog.publicPath));
  const saveManifest = () => writeFile(join(root, 'k04-qa-media.json'), JSON.stringify(manifest));
  await saveManifest();
  const options = { pool, scope, origin, mediaRoot: root };
  return { root, pool, repository, project, catalog, upload, record, uploadBytes, storage, bank, manifest, saveManifest, options,
    create: () => createQaFixture(options) };
}

test('real scoped repository and saved-policy compose with local bytes without any SQL mutation', async t => {
  const f = await fixture(t), before = f.pool.snapshot(), callStart = f.pool.calls.length;
  const ports = await f.create();
  assert.deepEqual(Object.keys(ports).sort(), ['privateMedia', 'studioMediaRuntime', 'studioPolicyRuntime']);
  assert.deepEqual(ports.studioPolicyRuntime.repository.scope, scope);
  assert.equal((await ports.studioPolicyRuntime.policy.readSaved()).projectRevision, f.project.revision);
  assert.deepEqual(f.pool.snapshot(), before);
  const calls = f.pool.calls.slice(callStart);
  assert.ok(calls.some(row => row.marker === 'read-runtime-catalog'));
  assert.ok(calls.filter(row => row.marker === 'BEGIN').every(row => row.sql.includes('READ ONLY')));
  assert.equal(calls.filter(row => /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(row.sql)).length, 0);
  assert.equal(f.pool.connects, f.pool.releases);
});

test('exact local bytes support GET, HEAD, ETag, range, suffix and conditional ranges', async t => {
  const f = await fixture(t), { privateMedia } = await f.create();
  const get = await privateMedia(f.storage, request());
  assert.equal(get.status, 200); assert.deepEqual(Buffer.from(await get.arrayBuffer()), f.uploadBytes);
  const head = await privateMedia(f.storage, request(undefined, { method: 'HEAD', headers: { range: 'bytes=2-5' } }));
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
  assert.equal(head.headers.get('content-length'), String(f.uploadBytes.length));
  const etag = head.headers.get('etag'); assert.equal(etag, `"sha256-${f.storage.sha256}"`);
  assert.equal((await privateMedia(f.storage, request(undefined, { headers: { 'if-none-match': etag } }))).status, 304);
  const range = await privateMedia(f.storage, request(undefined, { headers: { range: 'bytes=2-8' } }));
  assert.equal(range.status, 206); assert.equal(range.headers.get('content-range'), `bytes 2-8/${f.uploadBytes.length}`);
  assert.deepEqual(Buffer.from(await range.arrayBuffer()), f.uploadBytes.subarray(2, 9));
  const suffix = await privateMedia(f.storage, request(undefined, { headers: { range: 'bytes=-5' } }));
  assert.deepEqual(Buffer.from(await suffix.arrayBuffer()), f.uploadBytes.subarray(-5));
  assert.equal((await privateMedia(f.storage, request(undefined, { headers: { range: 'bytes=2-5', 'if-range': 'old-etag' } }))).status, 200);
  for (const range of ['bytes=99999-', 'bytes=-0', 'bytes=5-2', 'bytes=1-2,4-5', 'bytes=9007199254740992-', 'none']) {
    const res = await privateMedia(f.storage, request(undefined, { headers: { range } }));
    assert.equal(res.status, 416, range); assert.equal(res.headers.get('content-range'), `bytes */${f.uploadBytes.length}`);
  }
  assert.equal((await privateMedia(f.storage, request(undefined, { method: 'POST' }))).status, 405);
});

test('SQL bank/upload and captured readers share exact mapping; unmapped bank is unavailable', async t => {
  const f = await fixture(t), ports = await f.create(), media = ports.studioMediaRuntime;
  const registry = await media.videoRegistry();
  assert.equal(registry.videos.find(row => row.id === f.upload.id).available, true);
  assert.equal(registry.videos.find(row => row.id === f.bank.id).available, true);
  const unmapped = f.catalog.value.blobIndex.files[1];
  assert.equal(registry.videos.find(row => row.id === unmapped.id).available, false);
  for (const id of [f.upload.id, f.bank.id]) assert.equal((await media.videoResponse(id, request())).status, 200);
  const snapshot = { scope, projectDocument: await f.repository.readDocument('project'), mediaRows: await f.repository.listMedia({ limit: 5000 }), runtimeCatalog: await f.repository.readRuntimeCatalog() };
  assert.equal((await media.videoRegistryCaptured(snapshot)).videos.find(row => row.id === f.upload.id).available, true);
  assert.equal((await media.videoResponseCaptured(f.upload.id, request(), snapshot)).status, 200);
  // Registry-internal HEAD verifies bytes, while exported HTTP ports reject it.
  await media.verifyCapturedMedia([{ record: f.record }]);
  assert.equal((await ports.privateMedia(f.storage, new Request('https://studio.invalid/api/captured-media', { method: 'HEAD' }))).status, 403);
  assert.equal((await media.videoResponse(f.upload.id, new Request('https://studio.invalid/api/captured-media', { method: 'HEAD' }))).status, 403);
  assert.equal(await media.hasPublicMedia('assets/qa.mp4'), true);
  const publicRes = await media.publicMediaResponse('/assets/qa.mp4', request('/assets/qa.mp4'));
  assert.equal(publicRes.status, 200); assert.deepEqual(Buffer.from(await publicRes.arrayBuffer()), f.catalog.bytes.get(f.catalog.publicPath));
  assert.equal(await media.hasPublicMedia('assets/missing.mp4'), false);
});

test('HTTP origin and host are exact; no cross-site/dummy-HEAD or changed tuple bypass', async t => {
  const f = await fixture(t), ports = await f.create();
  for (const req of [new Request('http://localhost:43879/x'), new Request('http://127.0.0.1:43880/x'),
    request(undefined, { headers: { origin: 'https://outside.invalid' } }), request(undefined, { headers: { host: 'outside.invalid' } }),
    request(undefined, { headers: { 'sec-fetch-site': 'cross-site' } }), request(undefined, { headers: { 'sec-fetch-site': 'same-site' } })]) {
    assert.equal((await ports.privateMedia(f.storage, req)).status, 403);
    assert.equal((await ports.studioMediaRuntime.publicMediaResponse('/assets/qa.mp4', req)).status, 403);
  }
  for (const change of [{ size: f.storage.size + 1 }, { contentType: 'audio/mpeg' }, { provider: 'other' }, { pathname: '../outside' }, { extra: true }]) {
    const result = await ports.privateMedia({ ...f.storage, ...change }, request());
    assert.equal(result.status, 503); assert.equal(await result.text(), '');
  }
});

test('request abort before or during async verification is preserved without serving bytes', async t => {
  const f = await fixture(t), ports = await f.create();
  const before = new AbortController(); before.abort();
  await assert.rejects(ports.privateMedia(f.storage, request(undefined, { signal: before.signal })), { name: 'AbortError' });
  const during = new AbortController();
  const pending = ports.privateMedia(f.storage, request(undefined, { signal: during.signal })); during.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  const snapshot = { scope, projectDocument: await f.repository.readDocument('project'), mediaRows: await f.repository.listMedia({ limit: 5000 }), runtimeCatalog: await f.repository.readRuntimeCatalog() };
  await assert.rejects(ports.studioMediaRuntime.videoResponseCaptured(f.upload.id, request(undefined, { signal: before.signal }), snapshot), { name: 'AbortError' });
});

test('same-size replacement, truncation and missing local file fail even after a successful read', async t => {
  const f = await fixture(t), ports = await f.create(), file = join(f.root, 'takes/upload.mp4');
  assert.equal((await ports.privateMedia(f.storage, request())).status, 200);
  await writeFile(file, Buffer.alloc(f.uploadBytes.length, 88));
  assert.equal((await ports.privateMedia(f.storage, request())).status, 503);
  await writeFile(file, 'short'); assert.equal((await ports.privateMedia(f.storage, request())).status, 503);
  await rm(file); assert.equal((await ports.privateMedia(f.storage, request())).status, 503);
  await assert.rejects(ports.studioMediaRuntime.verifyCapturedMedia([{ record: f.record }]), error => error.code === 'studio_media_storage_unavailable');
});

test('manifest cannot invent an SQL identity/revision/tuple, duplicate source or override policy', async t => {
  const f = await fixture(t), original = structuredClone(f.manifest);
  for (const change of [
    manifest => { manifest.files[0].source.id = '88888888-8888-4888-8888-888888888888'; },
    manifest => { manifest.files[0].source.revision = 'stale-revision'; },
    manifest => { manifest.files[0].storage.size++; },
    manifest => { manifest.files[1].source.revision = 'f'.repeat(64); },
    manifest => { manifest.files.push(structuredClone(manifest.files[0])); },
    manifest => { manifest.files[0].approval = true; },
    manifest => { manifest.files[0].storage.url = 'https://outside.invalid'; },
    manifest => { manifest.files = []; },
    manifest => { manifest.scope = { ...scope, workspaceId: 'shared-qa-other' }; },
    manifest => { manifest.origin = 'http://127.0.0.1:43880'; },
  ]) {
    Object.assign(f.manifest, structuredClone(original)); change(f.manifest); await f.saveManifest();
    await assert.rejects(f.create(), rejection);
  }
});

test('manifest UTF8/size and local file size/hash are checked at construction', async t => {
  const f = await fixture(t), path = join(f.root, 'k04-qa-media.json');
  await writeFile(path, Buffer.from([0xff, 0xfe])); await assert.rejects(f.create(), rejection);
  await writeFile(path, ' '.repeat(4 * 1024 * 1024 + 1)); await assert.rejects(f.create(), rejection);
  await f.saveManifest();
  await writeFile(join(f.root, 'takes/upload.mp4'), Buffer.alloc(f.uploadBytes.length, 99));
  await assert.rejects(f.create(), rejection);
});

test('traversal, absolute paths, URL encodings and linked directories/files never escape mediaRoot', async t => {
  const f = await fixture(t), original = f.manifest.files[0].relativePath, ports = await f.create();
  for (const path of ['../outside.mp4', '/outside.mp4', 'C:/outside.mp4', 'takes\\upload.mp4', 'takes/%2e%2e/outside.mp4', 'takes/./upload.mp4', 'takes/upload.mp4:stream', 'takes./upload.mp4']) {
    f.manifest.files[0].relativePath = path; await f.saveManifest(); await assert.rejects(f.create(), rejection, path);
  }
  f.manifest.files[0].relativePath = original; await f.saveManifest();
  const outside = await mkdtemp(join(tmpdir(), 'k04-outside-')); t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(join(outside, 'upload.mp4'), f.uploadBytes);
  await rename(join(f.root, 'takes'), join(f.root, 'original-takes'));
  await symlink(outside, join(f.root, 'takes'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(f.create(), rejection);
  assert.equal((await ports.privateMedia(f.storage, request())).status, 503, 'a link installed after construction also fails');
  await rm(join(f.root, 'takes')); await rename(join(f.root, 'original-takes'), join(f.root, 'takes'));
  await rm(join(f.root, 'takes/upload.mp4')); await link(join(outside, 'upload.mp4'), join(f.root, 'takes/upload.mp4'));
  await assert.rejects(f.create(), rejection);
});

test('ordinary production scopes/origins and missing saved SQL policy/catalog fail closed', async t => {
  const f = await fixture(t);
  for (const change of [{ scope: { environment: 'production', workspaceId: 'shared-qa-localbytes' } },
    { scope: { environment: 'test', workspaceId: 'croupier' } }, { origin: 'https://127.0.0.1:43879' },
    { origin: 'http://localhost:43879' }, { origin: 'http://127.0.0.1:43879/' }, { mediaRoot: '.' }]) {
    await assert.rejects(createQaFixture({ ...f.options, ...change }), rejection);
  }
  const missing = createStudioMemoryPool();
  await assert.rejects(createQaFixture({ ...f.options, pool: missing }), rejection);
  missing.seedRuntimeCatalog(scope, f.catalog.value);
  // Catalog alone cannot create the registered media or saved-policy documents.
  await assert.rejects(createQaFixture({ ...f.options, pool: missing }), rejection);
  f.manifest.files = f.manifest.files.filter(row => row.source.kind === 'catalog'); await f.saveManifest();
  await assert.rejects(createQaFixture({ ...f.options, pool: missing }), error => error.code === 'studio_game_policy_missing');
  assert.equal(missing.snapshot().documents.size, 0);
});
test('linked manifest/root and a catalog changed after startup do not create a local fallback', async t => {
  const f = await fixture(t), ports = await f.create();
  const other = await mkdtemp(join(tmpdir(), 'k04-linked-manifest-')); t.after(() => rm(other, { recursive: true, force: true }));
  await symlink(f.root, join(other, 'linked-root'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(createQaFixture({ ...f.options, mediaRoot: join(other, 'linked-root') }), rejection);
  await writeFile(join(other, 'manifest.json'), JSON.stringify(f.manifest));
  await rm(join(f.root, 'k04-qa-media.json')); await link(join(other, 'manifest.json'), join(f.root, 'k04-qa-media.json'));
  await assert.rejects(f.create(), rejection);
  const changed = structuredClone(f.catalog.value), logicalPath = f.catalog.publicPath;
  const bytes = Buffer.from('changed authoritative catalog media'), sha256 = digest(bytes), id = videoIdFromSha256(sha256);
  Object.assign(changed.layout.files.find(row => row.path === logicalPath), { sha256, size: bytes.length });
  const blob = changed.blobIndex.files.find(row => row.logicalPath === logicalPath);
  Object.assign(blob, { id, sha256, size: bytes.length,
    storage: { provider: 'vercel-blob', pathname: mediaBlobPath('game/runtime', id, sha256, 'mp4'), sha256, size: bytes.length, contentType: 'video/mp4' } });
  f.pool.seedRuntimeCatalog(scope, changed);
  await assert.rejects(ports.studioMediaRuntime.hasPublicMedia('assets/qa.mp4'), error => error.code === 'studio_media_storage_unavailable');
  assert.equal((await ports.studioMediaRuntime.publicMediaResponse('/assets/qa.mp4', request('/assets/qa.mp4'))).status, 503);
});