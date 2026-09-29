import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Writable } from 'node:stream';
import { once } from 'node:events';
import test from 'node:test';
import { createPresentationApi } from '../web/presentation-api.mjs';
import { MEDIA_FAMILY_DEFINITIONS, videoIdFromSha256 } from '../lab/lib/lab-video-manifest.mjs';

const renderOrigin = 'https://croupier-v2.onrender.com';
const frontendOrigin = 'https://github-work-vercel-entry.vercel.app';
const bytes = Buffer.from('synthetic-video-range-fixture');
const targetPath = 'deal/deal_pos1/deal_pos1.mp4';
const sha256 = data => createHash('sha256').update(data).digest('hex');
const id = videoIdFromSha256(sha256(bytes));

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'croupier-vercel-video-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const archiveDir = join(root, 'archive');
  const items = [];
  for (const definition of MEDIA_FAMILY_DEFINITIONS) {
    for (const relativePath of definition.standardPaths) {
      const data = relativePath === targetPath ? bytes : Buffer.from(`synthetic:${relativePath}`);
      const hash = sha256(data);
      items.push({ id: videoIdFromSha256(hash), familyId: definition.id, role: 'standard',
        relativePath, extension: 'mp4', size: data.length, sha256: hash });
      const file = join(archiveDir, ...relativePath.split('/'));
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, data);
      await mkdir(join(archiveDir, ...definition.variantDirectory.split('/')), { recursive: true });
    }
  }
  const families = MEDIA_FAMILY_DEFINITIONS.map(definition => ({
    id: definition.id, dealerId: definition.dealerId, eventId: definition.eventId,
    situation: definition.situation, playbackType: definition.playbackType,
    standardIds: definition.standardPaths.map(path => items.find(item => item.relativePath === path).id), variantIds: [],
  }));
  const snapshotPath = join(root, 'snapshot.json');
  await writeFile(snapshotPath, JSON.stringify({ schemaVersion: 2, source: 'emil/dealklipp-v1', families, items }));
  return { archiveDir, snapshotPath, uploadDir: join(root, 'uploads') };
}

class CaptureResponse extends Writable {
  constructor() { super(); this.chunks = []; }
  writeHead(status, headers) { this.status = status; this.headers = headers; return this; }
  _write(chunk, encoding, callback) { this.chunks.push(Buffer.from(chunk)); callback(); }
  body() { return Buffer.concat(this.chunks); }
  header(name) { return Object.entries(this.headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1]; }
}

async function videoRequest(api, { host = 'croupier-v2.onrender.com', origin, range, fetchSite = 'same-origin', method = 'GET' } = {}) {
  const headers = { host, ...(origin ? { origin } : {}), ...(range ? { range } : {}),
    ...(fetchSite ? { 'sec-fetch-site': fetchSite } : {}) };
  const response = new CaptureResponse();
  const finished = once(response, 'finish');
  assert.equal(await api({ method, headers }, response, `/api/presentation/videos/${id}`, 'fixture-player'), true);
  await finished;
  return response;
}

test('Render same-origin video and local default retain ranged playback', async t => {
  const registryOptions = await fixture(t);
  const cloud = createPresentationApi({ db: {}, store: {}, registryOptions,
    env: { CROUPIER_CLOUD_RUNTIME: '1', PUBLIC_URL: renderOrigin } });
  const rendered = await videoRequest(cloud, { origin: renderOrigin, range: 'bytes=2-7' });
  assert.equal(rendered.status, 206);
  assert.equal(rendered.header('content-range'), `bytes 2-7/${bytes.length}`);
  assert.deepEqual(rendered.body(), bytes.subarray(2, 8));

  const local = createPresentationApi({ db: {}, store: {}, registryOptions, env: {} });
  const localRange = await videoRequest(local, { host: 'localhost', origin: 'http://localhost', range: 'bytes=0-3' });
  assert.equal(localRange.status, 206);
  assert.deepEqual(localRange.body(), bytes.subarray(0, 4));
});

test('opted-in exact Vercel origin preserves Range 206 and HEAD metadata without CORS', async t => {
  const registryOptions = await fixture(t);
  const api = createPresentationApi({ db: {}, store: {}, registryOptions,
    env: { CROUPIER_CLOUD_RUNTIME: '1', PUBLIC_URL: renderOrigin, CROUPIER_VERCEL_FRONTEND_ORIGIN: frontendOrigin } });
  const ranged = await videoRequest(api, { origin: frontendOrigin, range: 'bytes=3-9' });
  assert.equal(ranged.status, 206);
  assert.equal(ranged.header('content-range'), `bytes 3-9/${bytes.length}`);
  assert.equal(ranged.header('accept-ranges'), 'bytes');
  assert.equal(ranged.header('content-length'), '7');
  assert.match(ranged.header('etag'), /^"sha256-[a-f0-9]{64}"$/);
  assert.equal(ranged.header('access-control-allow-origin'), undefined);
  assert.deepEqual(ranged.body(), bytes.subarray(3, 10));

  const head = await videoRequest(api, { origin: frontendOrigin, method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.header('content-length'), String(bytes.length));
  assert.equal(head.body().length, 0);
});

test('Vercel media opt-in rejects absent config, wrong Host, unknown Origin and cross-site requests', async t => {
  const registryOptions = await fixture(t);
  const create = extra => createPresentationApi({ db: {}, store: {}, registryOptions,
    env: { CROUPIER_CLOUD_RUNTIME: '1', PUBLIC_URL: renderOrigin, ...extra } });
  assert.equal((await videoRequest(create({}), { origin: frontendOrigin })).status, 403);
  const api = create({ CROUPIER_VERCEL_FRONTEND_ORIGIN: frontendOrigin });
  assert.equal((await videoRequest(api, { host: 'attacker.invalid', origin: frontendOrigin })).status, 403);
  assert.equal((await videoRequest(api, { origin: 'https://other.vercel.app' })).status, 403);
  assert.equal((await videoRequest(api, { origin: frontendOrigin, fetchSite: 'same-site' })).status, 403);
  assert.equal((await videoRequest(api, { origin: frontendOrigin, fetchSite: 'cross-site' })).status, 403);
  assert.equal((await videoRequest(create({ CROUPIER_VERCEL_FRONTEND_ORIGIN: 'https://*.vercel.app' }),
    { origin: frontendOrigin })).status, 403);
});
