import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { MEDIA_FAMILY_DEFINITIONS, videoIdFromSha256 } from '../../../packages/studio-registry/server/video-manifest.mjs';
import { getVideoResponse, getLabVideoResponse, loadVideoRegistry } from './fixtures/local-video-registry.mjs';
import { mediaBlobPath } from '../lib/cloud-media-store.mjs';
import { presentationBankRoot } from '../../../tools/media-layout.mjs';

const bytes = Buffer.from('0000ftypisom00000-isolated-blob-routing-exact-video-bytes');
const hash = value => createHash('sha256').update(value).digest('hex');
const targetPath = 'deal/deal_pos1/deal_pos1.mp4';
const unknownId = '00000000-0000-0000-0000-000000000000';
const request = (id, method = 'GET', headers = {}) => new Request(`http://localhost:4188/api/videos/${id}`, { method, headers });
const jsonFile = (file, data) => writeFile(file, JSON.stringify(data));

function blobRow(logicalPath, value, access, id = videoIdFromSha256(hash(value))) {
  const sha256 = hash(value);
  return { logicalPath, id, sha256, size: value.length, access, storage: {
    provider: 'vercel-blob', pathname: mediaBlobPath(dirname(logicalPath).replaceAll('\\', '/'), id, sha256, 'mp4'),
    sha256, size: value.length, contentType: 'video/mp4',
  } };
}

async function fixture(t, { localFilm = false, mutateRow } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'croupier-blob-routing-'));
  t.after(async () => {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.match(basename(root), /^croupier-blob-routing-/);
    await rm(root, { recursive: true, force: true });
  });
  const bank = presentationBankRoot(root);
  await mkdir(bank, { recursive: true });
  // Only the complete locked metadata graph is generated. No source film is copied.
  const items = MEDIA_FAMILY_DEFINITIONS.flatMap(definition => definition.standardPaths.map(relativePath => {
    const value = relativePath === targetPath ? bytes : Buffer.from(`metadata-only:${relativePath}`);
    const sha256 = hash(value);
    return { id: videoIdFromSha256(sha256), familyId: definition.id, role: 'standard', relativePath, extension: 'mp4', size: value.length, sha256 };
  }));
  const families = MEDIA_FAMILY_DEFINITIONS.map(definition => ({
    id: definition.id, dealerId: definition.dealerId, eventId: definition.eventId, situation: definition.situation,
    playbackType: definition.playbackType, standardIds: definition.standardPaths.map(path => items.find(item => item.relativePath === path).id), variantIds: [],
  }));
  const manifest = { schemaVersion: 2, source: 'emil/dealklipp-v1', families, items };
  await jsonFile(join(bank, 'lab-video-manifest.json'), manifest);
  const layout = { schemaVersion: 1, roots: {}, files: items.map(item => ({
    path: `dealers/astrid/runtime/presentation/${item.relativePath}`, legacyPath: `emil/dealklipp-v1/${item.relativePath}`,
    sha256: item.sha256, size: item.size, access: 'source',
  })) };
  await jsonFile(join(root, 'media/layout.json'), layout);
  const item = items.find(entry => entry.relativePath === targetPath);
  const row = blobRow(`dealers/astrid/runtime/presentation/${targetPath}`, bytes, 'source', item.id);
  const index = { schemaVersion: 1, namespace: 'croupier/media', verification: 'readback-sha256', files: [row] };
  if (mutateRow) mutateRow(row, index);
  const indexPath = join(root, 'blob-index.json');
  await jsonFile(indexPath, index);
  const film = join(bank, ...targetPath.split('/'));
  if (localFilm) { await mkdir(dirname(film), { recursive: true }); await writeFile(film, bytes); }
  const calls = [], objects = new Map([[row.storage.pathname, { bytes, contentType: 'video/mp4' }]]);
  const env = { CROUPIER_MEDIA_STORAGE: 'blob', BLOB_READ_WRITE_TOKEN: 'test-only-private-token', CROUPIER_MEDIA_BLOB_INDEX: indexPath };
  const blobClient = {
    async get(pathname, options) {
      calls.push(pathname);
      assert.equal(options.access, 'private');
      assert.equal(options.token, env.BLOB_READ_WRITE_TOKEN);
      const object = objects.get(pathname);
      if (!object) return null;
      return { statusCode: 200, stream: new Response(object.bytes).body, blob: {
        pathname, url: `https://routingfixture.private.blob.vercel-storage.com/${pathname}`,
        size: object.bytes.length, contentType: object.contentType,
      } };
    },
  };
  const options = { repositoryRoot: root, env, blobClient, cacheDir: join(root, 'cache'), uploadDir: join(root, 'uploads') };
  return { root, bank, film, item, row, index, indexPath, manifest, layout, calls, objects, options };
}

async function assertBytes(reader, value = bytes) {
  const full = await reader('GET');
  assert.equal(full.status, 200);
  assert.equal(full.headers.get('content-type'), 'video/mp4');
  assert.deepEqual(Buffer.from(await full.arrayBuffer()), value);
  const partial = await reader('GET', { range: 'bytes=3-9' });
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get('content-range'), `bytes 3-9/${value.length}`);
  assert.deepEqual(Buffer.from(await partial.arrayBuffer()), value.subarray(3, 10));
  const head = await reader('HEAD', { range: 'bytes=3-9' });
  assert.equal(head.status, 200);
  assert.equal(Number(head.headers.get('content-length')), value.length);
  assert.equal(await head.text(), '');
}

test('canonical bank and old archive alias serve private Blob bytes without local films or approval upgrades', async t => {
  const f = await fixture(t);
  await assert.rejects(stat(f.film), { code: 'ENOENT' });
  const inventory = await loadVideoRegistry(f.options);
  const video = inventory.videos.find(entry => entry.id === f.item.id);
  assert.equal(inventory.summary.snapshotReadable, true);
  assert.equal(inventory.summary.readable, true);
  assert.equal(video.available, true);
  assert.equal(video.storage, 'private-blob');
  assert.equal(video.integrity, 'unchecked');
  assert.equal(video.reviewStatus, 'unreviewed');
  assert.equal(video.verdict, 'unrated');
  assert.equal(video.familyId, f.item.familyId);
  assert.equal(f.calls.length, 0, 'inventory uses metadata rather than downloading films');
  await assertBytes((method, headers) => getVideoResponse(f.item.id, request(f.item.id, method, headers), f.options));
  const aliasOptions = { ...f.options, env: { ...f.options.env, LAB_VIDEO_ARCHIVE: join(f.root, 'emil/dealklipp-v1') } };
  const alias = await getVideoResponse(f.item.id, request(f.item.id), aliasOptions);
  assert.equal(alias.status, 200);
  assert.deepEqual(Buffer.from(await alias.arrayBuffer()), bytes);
  assert.equal((await loadVideoRegistry(aliasOptions)).videos.find(entry => entry.id === f.item.id).reviewStatus, 'unreviewed');
  assert.deepEqual(f.calls, [f.row.storage.pathname], 'ranges and aliases reuse verified private bytes');
});

test('an opted-in bank rejects missing or mismatched provenance even with exact local bytes', async t => {
  const cases = {
    missing: (_row, index) => { index.files = []; },
    hash: row => {
      row.sha256 = row.storage.sha256 = hash(Buffer.from('other-film'));
      row.storage.pathname = mediaBlobPath(dirname(row.logicalPath).replaceAll('\\', '/'), row.id, row.sha256, 'mp4');
    },
    size: row => { row.size += 1; row.storage.size += 1; },
    access: row => { row.access = 'private'; },
    identity: row => { row.id = unknownId; },
    pathname: row => { row.storage.pathname = mediaBlobPath('dealers/vera/runtime/indexed', row.id, row.sha256, 'mp4'); },
    contentType: row => {
      row.storage.pathname = mediaBlobPath(dirname(row.logicalPath).replaceAll('\\', '/'), row.id, row.sha256, 'webm');
      row.storage.contentType = 'video/webm';
    },
  };
  for (const [name, mutateRow] of Object.entries(cases)) await t.test(name, async nested => {
    const f = await fixture(nested, { localFilm: true, mutateRow });
    assert.equal((await stat(f.film)).size, bytes.length);
    const response = await getVideoResponse(f.item.id, request(f.item.id), f.options);
    assert.equal(response.status, 503);
    assert.equal((await loadVideoRegistry(f.options)).videos.find(entry => entry.id === f.item.id).available, false);
    assert.equal(f.calls.length, 0, 'invalid metadata must not reach the provider or local film');
  });
});

test('missing and corrupt authoritative Blob objects cannot fall back to a local bank film', async t => {
  for (const state of ['missing', 'corrupt']) await t.test(state, async nested => {
    const f = await fixture(nested, { localFilm: true });
    if (state === 'missing') f.objects.clear();
    else f.objects.get(f.row.storage.pathname).bytes = Buffer.alloc(bytes.length, 45);
    const response = await getVideoResponse(f.item.id, request(f.item.id), f.options);
    assert.equal(response.status, 503);
    assert.equal(f.calls.length, 1);
    assert.equal((await stat(f.film)).size, bytes.length);
  });
});

test('custom archives, unknown IDs and foreign origins never inherit canonical Blob routing', async t => {
  const f = await fixture(t, { localFilm: true });
  const archiveDir = join(f.root, 'custom-archive');
  await mkdir(dirname(join(archiveDir, targetPath)), { recursive: true });
  await jsonFile(join(archiveDir, 'lab-video-manifest.json'), f.manifest);
  await writeFile(join(archiveDir, targetPath), bytes);
  const custom = { ...f.options, archiveDir };
  assert.equal((await getVideoResponse(f.item.id, request(f.item.id), custom)).status, 503);
  assert.equal((await loadVideoRegistry(custom)).videos.find(entry => entry.id === f.item.id).available, false);
  assert.equal((await getVideoResponse(unknownId, request(unknownId), f.options)).status, 404);
  assert.equal((await getVideoResponse(f.item.id, request(f.item.id, 'GET', { origin: 'https://foreign.invalid' }), f.options)).status, 403);
  assert.equal((await getVideoResponse(f.item.id, request(f.item.id, 'GET', { 'sec-fetch-site': 'cross-site' }), f.options)).status, 403);
  assert.equal(f.calls.length, 0);
});

test('legacy uploaded storage remains readable independently of the canonical bank index', async t => {
  const f = await fixture(t);
  const id = randomUUID(), sha256 = hash(bytes), pathname = `croupier/videos/${id}/${sha256}.mp4`;
  await mkdir(f.options.uploadDir);
  await jsonFile(join(f.options.uploadDir, 'index.json'), { schemaVersion: 1, videos: [{ id, sha256, size: bytes.length, extension: 'mp4',
    classification: { label: 'Exact uploaded goodluck', dealerId: 'astrid', eventId: 'speak.goodluck', kind: 'speech', role: 'alternative', situation: 'goodluck', notes: '' },
    storage: { provider: 'vercel-blob', pathname, sha256, size: bytes.length, contentType: 'video/mp4' },
  }] });
  f.objects.set(pathname, { bytes, contentType: 'video/mp4' });
  const response = await getVideoResponse(id, request(id), f.options);
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  const uploaded = (await loadVideoRegistry(f.options)).videos.find(entry => entry.id === id);
  assert.equal(uploaded.storage, 'private-blob');
  assert.equal(uploaded.bindingScope, 'lab-only');
  assert.equal(uploaded.reviewStatus, 'unreviewed');
  assert.deepEqual(f.calls, [pathname]);
});

test('cloud gateway authenticates Next loopback alias before bank HEAD and Range routing', async t => {
  const keys = ['LAB_PUBLIC_URL', 'CROUPIER_LAB_INTERNAL_SECRET'];
  const saved = keys.map(key => [key, process.env[key]]);
  t.after(() => { for (const [key, value] of saved) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  process.env.LAB_PUBLIC_URL = 'https://lab.fixture.invalid';
  process.env.CROUPIER_LAB_INTERNAL_SECRET = 'gateway-fixture-secret-at-least-32-characters';
  const f = await fixture(t);
  const headers = { host: 'lab.fixture.invalid', 'x-forwarded-host': 'lab.fixture.invalid', 'x-forwarded-proto': 'https',
    origin: process.env.LAB_PUBLIC_URL, 'sec-fetch-site': 'same-origin', 'x-croupier-lab-authorized': process.env.CROUPIER_LAB_INTERNAL_SECRET,
  };
  for (const authorization of [undefined, 'foreign-secret']) {
    const denied = { ...headers };
    if (authorization === undefined) delete denied['x-croupier-lab-authorized']; else denied['x-croupier-lab-authorized'] = authorization;
    await assert.rejects(getLabVideoResponse(f.item.id, request(f.item.id, 'GET', denied), f.options), { statusCode: 403 });
  }
  assert.equal(f.calls.length, 0);
  const head = await getLabVideoResponse(f.item.id, request(f.item.id, 'HEAD', headers), f.options);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal(Number(head.headers.get('content-length')), bytes.length);
  const partial = await getLabVideoResponse(f.item.id, request(f.item.id, 'GET', { ...headers, range: 'bytes=3-9' }), f.options);
  assert.equal(partial.status, 206);
  assert.deepEqual(Buffer.from(await partial.arrayBuffer()), bytes.subarray(3, 10));
  assert.deepEqual(f.calls, [f.row.storage.pathname]);
});
