import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { MEDIA_FAMILY_DEFINITIONS } from '../../../packages/presentation/runtime/media-families.mjs';
import { mediaLineForEvent, mediaVariantPolicy } from '../../../packages/presentation/runtime/media-family-policy.mjs';
import { buildLabVideoManifest, manifestJson } from '../../../tools/media/build-lab-video-manifest.mjs';
import { createSeedProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import {uploadVideo} from '../lib/video-uploads.mjs';
import {readUploads} from '../lib/video-local-readers.mjs';
import { loadVideoRegistry, getVideoResponse, getLabVideoResponse } from '../lib/video-registry.mjs';
import { createPresentationApi } from '../../../services/game/presentation-api.mjs';
import { NextRequest } from '../node_modules/next/server.js';

const bytes = Buffer.from('0000ftypisom00000private-video-fixture-exact-bytes');
const metadata = { familyId: 'astrid/deal.player.left/box0', label: 'Privat kortvariant', dealerId: 'astrid', eventId: 'deal.player.left', kind: 'action', role: 'alternative', situation: 'box0', playback: 'once', notes: '' };
const request = (fields = metadata, headers = {}) => new Request('http://localhost:4188/api/videos', { method: 'POST', headers: { 'content-type': 'video/mp4', 'x-video-metadata': encodeURIComponent(JSON.stringify(fields)), ...headers }, body: bytes, duplex: 'half' });

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'croupier-cloud-upload-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const archiveDir = join(dir, 'archive');
  for (const family of MEDIA_FAMILY_DEFINITIONS) for (const file of family.standardPaths) {
    const path = join(archiveDir, file); await mkdir(dirname(path), { recursive: true }); await writeFile(path, `fixture:${file}`);
    await mkdir(join(archiveDir, family.variantDirectory), { recursive: true });
  }
  const snapshotPath = join(archiveDir, 'lab-video-manifest.json');
  await writeFile(snapshotPath, manifestJson(await buildLabVideoManifest({ root: archiveDir })));
  const objects = new Map(), calls = [];
  const blobClient = {
    async put(path, stream, options) {
      assert.equal(options.access, 'private'); assert.equal(options.allowOverwrite, false);
      calls.push('put'); const chunks = []; for await (const chunk of stream) chunks.push(chunk);
      objects.set(path, Buffer.concat(chunks));
      return { pathname: path, url: `https://fixture.private.blob.vercel-storage.com/${path}` };
    },
    async get(path) {
      calls.push('get'); const content = objects.get(path); if (!content) return null;
      return { statusCode: 200, stream: new Response(content).body, blob: { pathname: path, url: `https://fixture.private.blob.vercel-storage.com/${path}`, size: content.length, contentType: 'video/mp4' } };
    },
    async del(path) { calls.push('del'); objects.delete(path); },
  };
  const options = { env: { CROUPIER_MEDIA_STORAGE: 'blob', BLOB_READ_WRITE_TOKEN: 'fixture-only' }, blobClient,
    archiveDir, snapshotPath, uploadDir: join(dir, 'uploads'), cacheDir: join(dir, 'cache') };
  return { options, objects, calls };
}

test('private family upload and legacy disk upload coexist, reload and select exact family without policy activation', async t => {
  const { options, objects, calls } = await fixture(t);
  const disk = await uploadVideo(request({ ...metadata, label: 'Legacy disk' }), { ...options, env: {} });
  const before = await readFile(join(options.uploadDir, `${disk.id}.mp4`));
  const cloud = await uploadVideo(request(), options);
  assert.equal(objects.size, 1); assert.deepEqual(calls, ['put', 'get']);
  assert.deepEqual(await uploadVideo(request(), options), { id: cloud.id, duplicate: true });
  assert.equal(objects.size, 1);
  assert.deepEqual((await readdir(options.uploadDir)).sort(), [`${disk.id}.mp4`, 'index.json'].sort());
  const saved = await readUploads(options);
  assert.equal(saved.find(row => row.id === disk.id).storage, undefined);
  assert.equal(saved.find(row => row.id === cloud.id).storage.provider, 'vercel-blob');
  const inventory = await loadVideoRegistry(options);
  const video = inventory.videos.find(row => row.id === cloud.id);
  assert.equal(video.storage, 'private-blob'); assert.equal(video.available, true);
  assert.equal(video.familyId, metadata.familyId); assert.equal(video.bindingScope, 'shared-local');
  assert.ok(!JSON.stringify(inventory).includes('private.blob')); assert.ok(!JSON.stringify(inventory).includes('fixture-only'));
  const family = inventory.families.find(row => row.id === metadata.familyId), project = createSeedProject();
  assert.deepEqual(mediaVariantPolicy(project, family, cloud.id).selection, { rules: false, random: false, model: false });
  const selected = mediaLineForEvent(project, inventory, 'astrid', metadata.eventId, { type: 'deal', to: 'box', box: 0, card: 'AS', handIndex: 0 });
  assert.ok(selected.line.variants.some(row => row.videoGenerationId === cloud.id));
  for (const id of [disk.id, cloud.id, cloud.id]) {
    const response = await getVideoResponse(id, new Request(`http://localhost:4188/api/videos/${id}`, { headers: { range: 'bytes=0-15' } }), options);
    assert.equal(response.status, 206); assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes.subarray(0, 16));
  }
  assert.deepEqual(await readFile(join(options.uploadDir, `${disk.id}.mp4`)), before);
});

test('missing configured token and invalid origins fail closed before staging or cloud writes', async t => {
  const { options, calls } = await fixture(t);
  await assert.rejects(uploadVideo(request(), { ...options, env: { CROUPIER_MEDIA_STORAGE: 'blob' } }), /inte konfigurerad/);
  await assert.rejects(uploadVideo(request(metadata, { origin: 'https://foreign.example' }), options), error => error.statusCode === 403);
  assert.equal(calls.length, 0);
  const response = {};
  const api = createPresentationApi({ env: {}, registryOptions: options, db: {} });
  await api({ method: 'GET', headers: {} }, { writeHead(status) { response.status = status; }, end(value) { response.body = value; } }, '/api/presentation/videos/00000000-0000-0000-0000-000000000000', null);
  assert.equal(response.status, 401); assert.equal(calls.length, 0);
});

test('provider failure preserves existing disk/index, leaves no staged candidate and redacts errors', async t => {
  const { options, objects } = await fixture(t);
  const disk = await uploadVideo(request({ ...metadata, label: 'Preserved' }), { ...options, env: {} });
  const before = await readFile(join(options.uploadDir, 'index.json'));
  options.blobClient.get = async () => { throw new Error('sensitive provider detail fixture-only'); };
  await assert.rejects(uploadVideo(request(), options), error => !error.message.includes('fixture-only') && error.statusCode === 503);
  assert.equal(objects.size, 0);
  assert.deepEqual(await readFile(join(options.uploadDir, 'index.json')), before);
  assert.deepEqual((await readdir(options.uploadDir)).sort(), ['index.json', `${disk.id}.mp4`].sort());
});

test('provider rejecting before consuming the upload closes its staged stream', { timeout: 3000 }, async t => {
  const { options } = await fixture(t);
  options.blobClient.put = async () => { throw new Error('provider unavailable'); };
  await assert.rejects(uploadVideo(request(), options), /kunde inte sparas/);
  assert.deepEqual(await readdir(options.uploadDir), []);
});

test('corrupt cloud registry cannot redirect storage access; old disk remains readable when cloud disabled', async t => {
  const { options, calls } = await fixture(t);
  const disk = await uploadVideo(request({ ...metadata, label: 'Disk' }), { ...options, env: {} });
  const cloud = await uploadVideo(request(), options);
  const disabled = { ...options, env: {} };
  const diskResponse = await getVideoResponse(disk.id, new Request('http://localhost/'), disabled);
  assert.equal(diskResponse.status, 200); await diskResponse.arrayBuffer();
  assert.equal((await getVideoResponse(cloud.id, new Request('http://localhost/'), disabled)).status, 503);
  const file = join(options.uploadDir, 'index.json'), index = JSON.parse(await readFile(file));
  index.videos.find(row => row.id === cloud.id).storage.pathname = 'https://other.example/secret';
  await writeFile(file, JSON.stringify(index));
  const count = calls.length;
  await assert.rejects(readUploads(options), /registret/);
  assert.equal((await getVideoResponse(cloud.id, new Request('http://localhost/'), options)).status, 503);
  assert.equal(calls.length, count);
});

test('real NextRequest keeps public-origin Range for both disk and private Blob behind the authenticated Lab gateway', async t => {
  const { options, calls } = await fixture(t);
  const disk = await uploadVideo(request({ ...metadata, label: 'Disk proxy' }), { ...options, env: {} });
  const cloud = await uploadVideo(request(), options);
  const env = { LAB_PUBLIC_URL: 'https://game.example', CROUPIER_LAB_INTERNAL_SECRET: 'fixture-proxy-secret-at-least-32-characters', CROUPIER_LAB_BASE_PATH: '/studio' };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const headers = { host: 'game.example', origin: env.LAB_PUBLIC_URL, 'x-forwarded-host': 'game.example', 'x-forwarded-proto': 'https',
    'x-croupier-lab-authorized': env.CROUPIER_LAB_INTERNAL_SECRET, 'sec-fetch-site': 'same-origin', range: 'bytes=0-15' };
  for (const id of [disk.id, cloud.id]) {
    const next = new NextRequest(`http://127.0.0.1:4188/studio/api/videos/${id}`, { headers });
    assert.equal(new URL(next.url).hostname, 'localhost');
    const response = await getLabVideoResponse(id, next, options);
    assert.equal(response.status, 206); assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes.subarray(0, 16));
  }
  const count = calls.length;
  for (const change of [{ 'x-croupier-lab-authorized': '' }, { origin: 'https://foreign.example' }, { host: 'other.example' }, { 'sec-fetch-site': 'cross-site' }]) {
    await assert.rejects(getLabVideoResponse(cloud.id, new NextRequest(`http://127.0.0.1:4188/studio/api/videos/${cloud.id}`, { headers: { ...headers, ...change } }), options), error => error.statusCode === 403);
  }
  assert.equal(calls.length, count);
});
