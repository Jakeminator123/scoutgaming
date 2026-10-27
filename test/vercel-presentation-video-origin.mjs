import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Writable } from 'node:stream';
import { once } from 'node:events';
import test from 'node:test';
import { createServer, request as httpRequest } from 'node:http';
import { createFrozenDealerPresentationContext } from '../packages/presentation/server/frozen-dealer-presentation.mjs';
import { captureFrozenPresentation } from '../packages/presentation/server/frozen-presentation-capture.mjs';
import { addDealer, createSeedProject, defaultPresentationLane } from '../packages/presentation/contracts/studio-model.mjs';
import { getVideoResponse } from '../services/game/storage/video-registry.mjs';
import { createPresentationApi } from '../services/game/presentation-api.mjs';
import { MEDIA_FAMILY_DEFINITIONS, videoIdFromSha256 } from '../packages/studio-registry/server/video-manifest.mjs';

const renderOrigin = 'https://croupier-v3.onrender.com';
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

async function videoRequest(api, { host = 'croupier-v3.onrender.com', origin, range, fetchSite = 'same-origin', method = 'GET', ifNoneMatch, playerId='fixture-player' } = {}) {
  const headers = { host, ...(origin ? { origin } : {}), ...(range ? { range } : {}),
    ...(fetchSite ? { 'sec-fetch-site': fetchSite } : {}), ...(ifNoneMatch ? {'if-none-match':ifNoneMatch} : {}) };
  const response = new CaptureResponse();
  const finished = once(response, 'finish');
  assert.equal(await api({ method, headers }, response, `/api/presentation/videos/${id}`, playerId), true);
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

test('warm legacy avatar cache still verifies source bytes, origin and login before 304',async t=>{
  const registryOptions=await fixture(t);
  const api=createPresentationApi({db:{},store:{},registryOptions,env:{CROUPIER_CLOUD_RUNTIME:'1',PUBLIC_URL:renderOrigin}});
  const first=await videoRequest(api,{origin:renderOrigin});
  assert.equal(first.status,200);assert.deepEqual(first.body(),bytes);
  assert.equal(first.header('cache-control'),'private, no-cache, must-revalidate');
  const ifNoneMatch=first.header('etag');
  const repeat=await videoRequest(api,{origin:renderOrigin,ifNoneMatch});
  assert.equal(repeat.status,304);assert.equal(repeat.body().length,0);
  assert.equal(repeat.header('content-length'),undefined);
  assert.equal((await videoRequest(api,{origin:renderOrigin,ifNoneMatch,playerId:null})).status,401);
  assert.equal((await videoRequest(api,{origin:'https://other.invalid',ifNoneMatch})).status,403);
  await writeFile(join(registryOptions.archiveDir,targetPath),Buffer.alloc(bytes.length,120));
  const changed=await videoRequest(api,{origin:renderOrigin,ifNoneMatch});
  assert.equal(changed.status,409);assert.equal(changed.header('cache-control'),'private, no-store');
  await rm(join(registryOptions.archiveDir,targetPath));
  assert.equal((await videoRequest(api,{origin:renderOrigin,ifNoneMatch})).status,404);
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

  const previewHostRange = await videoRequest(api, { host: new URL(frontendOrigin).host,
    origin: frontendOrigin, range: 'bytes=3-9' });
  assert.equal(previewHostRange.status, 206, 'Vercel forwards its own Host through the external rewrite');
  assert.deepEqual(previewHostRange.body(), bytes.subarray(3, 10));

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


async function qaHttpFixture(t, { overrideOrigin, env = {} } = {}) {
  const registryOptions = await fixture(t);
  const server = createServer((req, res) => {
    Promise.resolve(api(req, res, new URL(req.url, origin).pathname, req.headers['x-fixture-player'] === '1' ? 'fixture-player' : null))
      .catch(() => { res.writeHead(500); res.end(); });
  });
  server.listen({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const record = { id, sha256: sha256(bytes), size: bytes.length, contentType: 'video/mp4',
    pathname: `croupier/media/dealers/linnea/review/uploads/${id}/${sha256(bytes)}.mp4`,
    classification: { dealerId: 'linnea', eventId: 'idle.ready', kind: 'idle', role: 'standard',
      situation: '', label: 'Linnea Grundloop', notes: '' } };
  const project = addDealer(createSeedProject(), 'linnea', 'Linnea');
  const lane = defaultPresentationLane('linnea'); lane.id = 'qa-presentation'; project.lanes = [lane];
  project.lines.find(row => row.dealerId === 'linnea' && row.eventId === 'idle.ready').variants[0].videoGenerationId = id;
  const presentation = captureFrozenPresentation({
    snapshot: { projectDocument: { kind: 'project', revision: project.revision, value: project },
      administrationDocument: { kind: 'administration', revision: 'admin-1', value: { rooms: [] } },
      mediaRows: [{ ...record, revision: 'media-1' }] },
    inventory: { families: [], videos: [{ id, sha256: record.sha256, bytes: bytes.length, dealer: 'linnea',
      available: true, integrity: 'verified', classification: record.classification }] },
    selectedLaneIds: [lane.id], requiredIdleDealerIds: ['linnea'],
  }).presentation;
  const saved = { operator: { id: 'north-id', slug: 'north', status: 'active' },
    package: { operatorId: 'north-id', revision: 7, lanes: [lane.id], tables: ['room-linnea'], frozen: presentation },
    administration: { rooms: [{ schemaVersion: 2, id: 'room-linnea', name: 'Linnea', operatorId: 'north-id',
      presentationLaneId: lane.id, gameLaneId: 'portrait-linnea', state: 'live' }],
      gameLanes: [{ schemaVersion: 1, id: 'portrait-linnea', label: 'Linnea', dealer: 'linnea',
        renderer: 'portrait-video', mediaCollection: 'linnea-presentation' }] } };
  const seen = [];
  const frozenDealerContext = createFrozenDealerPresentationContext({
    readCurrentContext: async () => structuredClone(saved), readPresentation: pack => pack.frozen,
    privateMedia: async (storage, request) => {
      seen.push(request);
      const url = new URL(request.url);
      if (url.origin !== origin || request.headers.get('host') !== url.host
        || request.headers.get('origin') && request.headers.get('origin') !== origin
        || ['cross-site', 'same-site'].includes(request.headers.get('sec-fetch-site'))) return new Response(null, { status: 403 });
      assert.equal(storage.sha256, sha256(bytes)); assert.equal(storage.size, bytes.length);
      return getVideoResponse(id, request, registryOptions);
    },
  });
  const api = createPresentationApi({ db: {}, store: {}, registryOptions, frozenDealerContext, env,
    ...(overrideOrigin === false ? {} : { qaPublicOrigin: origin }) });
  const paths = [`/api/presentation/videos/${id}`,
    '/api/presentation/registered-idle/north/room-linnea/7/linnea',
    `/api/presentation/registered-video/north/room-linnea/7/linnea/${id}`];
  const request = (path, { anonymous = false, headers = {}, ...options } = {}) => new Promise((resolve, reject) => {
    // node:http preserves the actual Host; fetch may normalize a supplied Host.
    const request = httpRequest(origin + path, { ...options,
      headers: { connection: 'close', ...(!anonymous ? { 'x-fixture-player': '1' } : {}),
        origin, 'sec-fetch-site': 'same-origin', ...headers } }, response => {
      const chunks = []; response.on('data', chunk => chunks.push(chunk)); response.once('error', reject);
      response.once('end', () => {
        const body = Buffer.concat(chunks);
        resolve({ status: response.statusCode, headers: new Headers(response.headers),
          text: async () => body.toString(), arrayBuffer: async () => body });
      });
    });
    request.setTimeout(5000, () => request.destroy(new Error('QA HTTP fixture timeout')));
    request.once('error', reject); request.end();
  });
  return { origin, paths, request, registryOptions, saved, seen };
}

test('QA constructor origin requires canonical explicit 127.0.0.1 HTTP port, without env/request override', async t => {
  for (const value of ['', 'http://localhost:4321', 'http://127.1:4321', 'http://127.0.0.1',
    'http://127.0.0.1:80', 'http://127.0.0.1:1023', 'http://127.0.0.1:65536', 'http://127.0.0.1:04321',
    'https://127.0.0.1:4321', 'http://127.0.0.1:4321/', 'http://127.0.0.1:4321?x=1',
    'http://user@127.0.0.1:4321', 'http://[::1]:4321', 'https://game.invalid', true, {}]) {
    assert.throws(() => createPresentationApi({ db: {}, store: {}, qaPublicOrigin: value }), TypeError);
  }
  const f = await qaHttpFixture(t, { overrideOrigin: false, env: { QA_PUBLIC_ORIGIN: 'http://127.0.0.1:4321',
    PUBLIC_URL: 'http://127.0.0.1:4321' } });
  assert.equal((await f.request(f.paths[0], { headers: { 'x-qa-public-origin': f.origin } })).status, 403);
  assert.equal((await f.request(f.paths[1], { headers: { 'x-qa-public-origin': f.origin } })).status, 403);
});

test('owned QA HTTP origin serves exact video and frozen registered GET/HEAD/Range without cloud config', async t => {
  const f = await qaHttpFixture(t);
  for (const path of f.paths) {
    const get = await f.request(path); assert.equal(get.status, 200); assert.deepEqual(Buffer.from(await get.arrayBuffer()), bytes);
    const head = await f.request(path, { method: 'HEAD' }); assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-length'), String(bytes.length)); assert.equal(await head.text(), '');
    const range = await f.request(path, { headers: { range: 'bytes=2-7' } }); assert.equal(range.status, 206);
    assert.equal(range.headers.get('content-range'), `bytes 2-7/${bytes.length}`);
    assert.deepEqual(Buffer.from(await range.arrayBuffer()), bytes.subarray(2, 8));
    assert.equal(range.headers.get('access-control-allow-origin'), null);
    const cached = await f.request(path, { headers: { 'if-none-match': get.headers.get('etag') } });
    assert.equal(cached.status, 304); assert.equal(await cached.text(), '');
  }
  assert.ok(f.seen.length > 0); assert.ok(f.seen.every(request => new URL(request.url).origin === f.origin));
});

test('QA HTTP media keeps auth, exact Host/Origin, publication and verified-byte gates', async t => {
  const f = await qaHttpFixture(t, { env: { CROUPIER_CLOUD_RUNTIME: '1', PUBLIC_URL: renderOrigin,
    CROUPIER_VERCEL_FRONTEND_ORIGIN: frontendOrigin } });
  for (const path of f.paths) {
    assert.equal((await f.request(path, { anonymous: true })).status, 401);
    for (const headers of [{ host: 'attacker.invalid' }, { origin: 'http://localhost:' + new URL(f.origin).port },
      { origin: frontendOrigin }, { 'sec-fetch-site': 'cross-site' }, { 'sec-fetch-site': 'same-site' }]) {
      assert.equal((await f.request(path, { headers })).status, 403);
    }
  }
  const registeredReads = f.seen.length;
  f.saved.package.revision = 8;
  for (const path of f.paths.slice(1)) assert.equal((await f.request(path)).status, 409);
  assert.equal(f.seen.length, registeredReads, 'stale publication must not read media bytes');
  f.saved.package.revision = 7;
  await writeFile(join(f.registryOptions.archiveDir, targetPath), Buffer.alloc(bytes.length, 120));
  for (const path of f.paths) assert.equal((await f.request(path)).status, 409);
});
