import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { seedSavedVideoProject } from './fixtures/video-dealer-project.mjs';
import { createStudioMemoryPool } from '../../../test/fixtures/studio-memory-pool.mjs';
import { createStudioRepository } from '../../../packages/studio-registry/server/document-repository.mjs';
import { canonicalStudioJson } from '../../../packages/studio-registry/server/document-contract.mjs';
import { presentationCapabilitiesForVersion } from '../../../packages/presentation/capability-contract.mjs';
import { extendedDealerMediaFeatures } from '../../../packages/presentation/contracts/dealer-media-features.mjs';
import { wrapNativePresentationRepository, PRESENTATION_RUNTIME_UPDATE_REQUIRED, PRESENTATION_RUNTIME_UPDATE_MESSAGE } from '../lib/presentation-runtime-readiness.mjs';
import { createStudioUploadService } from '../lib/studio-upload-service.mjs';
import { createStudioMediaApi } from '../lib/studio-media-api.mjs';
import { dealerImportCatalog, filenameDealerImportRows, finishDealerImportRows, validateDealerImportInput } from '../lib/dealer-import-catalog.mjs';
import { importClassification } from '../client/admin/lib/dealer-import.mjs';
import { uploadNativeVideo } from '../lib/upload-native-video.mjs';
import { uploadMediaBatch } from '../lib/media-upload-batch.mjs';
import { DEFAULT_DEALER_COMPOSITING } from '../../../packages/presentation/contracts/dealer-compositing.mjs';

const scope = { environment: 'test', workspaceId: 'import-integration' }, origin = 'https://studio.example.invalid';
const config = { scope, apiBase: '/studio/api/admin', authBase: '/studio/api/auth',
  allowedOrigins: ['https://public.example.invalid', origin], publicHosts: ['public.example.invalid', 'studio.example.invalid'] };
// This isolates native services with the SQL memory adapter; it is not a
// PostgreSQL acceptance test. Positive MIME types match immutable migrations
// 001-008. Header/EBML fixtures prove byte and structure checks, not playback.
const cases = [
  { name: 'astrid-pos1.mp4', type: 'video/mp4', slot: 'deal.player.left/box0', bytes: Buffer.from('0000ftypisom00000import-integration-video') },
  { name: 'astrid-dealer-hole.webm', type: 'video/webm', slot: 'deal.dealer/dealer-hole', bytes: Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from('import-integration-webm-header')]) },
];
const audioCases = [
  { name: 'astrid-goodluck.wav', type: 'audio/wav', slot: 'speak.goodluck/goodluck', bytes: Buffer.from('RIFF0000WAVEfmt import-integration-audio') },
  { name: 'astrid-greeting.mp3', type: 'audio/mpeg', slot: 'speak.other/greeting', bytes: Buffer.from('ID3import-integration-mp3-header-fixture') },
];
const png = { name: 'astrid-VILA.png', type: 'image/png', slot: 'pose/vila', bytes: Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(24)]) };
const pngClassification = { dealerId: 'astrid', eventId: 'roulette.reference', situation: 'VILA', kind: 'idle', role: 'alternative', playback: 'once',
  label: 'Storage rejection fixture', notes: '', mediaType: 'image', game: 'roulette', action: 'reference', startPose: 'VILA', endPose: 'VILA', compositing: { mode: 'alpha' } };
const storageTypeCode = 'studio_media_content_type_unsupported';
const storageTypeMessage = 'Studio-databasen stöder ännu bara MP4 och WebM. PNG och ljud kräver en separat databasuppdatering.';
const nativeTypeMessage = 'Välj MP4 eller WebM. PNG och ljud stöds ännu inte i detta mediaregister.';
function ebml(id, ...children) {
  const payload = Buffer.concat(children); assert.ok(payload.length < 127);
  return Buffer.concat([Buffer.from(id, 'hex'), Buffer.from([0x80 | payload.length]), payload]);
}
// Minimal structural VP9 alpha fixture for the real server inspector. The
// payload is deliberately not a decodable or visually approved dealer take.
const alphaWebm = Buffer.concat([
  ebml('1a45dfa3', ebml('4282', Buffer.from('webm'))),
  ebml('18538067',
    ebml('1654ae6b', ebml('ae', ebml('86', Buffer.from('V_VP9')), ebml('e0', ebml('53c0', Buffer.from([1]))))),
    ebml('1f43b675', ebml('a0', ebml('75a1', ebml('a6', ebml('a5', Buffer.from('test-alpha-payload'))))))),
]);
function prepared(mode, input, catalog) {
  const file = new File([input.bytes], input.name, { type: input.type });
  const row = { id: 'local-file', file, label: input.name, slotId: input.slot, background: 'green-screen', state: 'ready' };
  if (mode === 'manual') return { row, classification: importClassification(row, 'astrid', catalog) };
  const body = validateDealerImportInput({ dealerId: 'astrid', files: [{ id: row.id, name: file.name, type: file.type, size: file.size }], context: '' }, catalog);
  const advice = finishDealerImportRows(filenameDealerImportRows(body, catalog), body, catalog)[0];
  assert.equal(advice.slotId, input.slot);
  return { row, classification: advice.classification };
}
async function fixture(t) {
  const cacheDir = await mkdtemp(join(tmpdir(), 'croupier-import-integration-'));
  t.after(() => { assert.equal(dirname(resolve(cacheDir)), resolve(tmpdir())); assert.match(basename(cacheDir), /^croupier-import-integration-/); return rm(cacheDir, { recursive: true, force: true }); });
  const pool = createStudioMemoryPool(), repository = createStudioRepository({ pool, scope });
  const project = seedSavedVideoProject(pool, scope), objects = new Map(), tokens = [], capabilities = [], requests = [], responses = [], errors = [];
  let capability = version => presentationCapabilitiesForVersion(version), beforeCommit, beforeMutation, puts = 0, blobReads = 0, registrations = 0;
  const wrapped = wrapNativePresentationRepository({ ...repository,
    async registerMedia(...args) { registrations++; return repository.registerMedia.call(repository, ...args); },
  }, { env: { CROUPIER_BACKEND_ORIGIN: 'https://runtime.example.invalid' },
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://runtime.example.invalid/api/presentation/capabilities');
      const version = Number(options.headers['X-Presentation-Capability-Version'] ?? 2); capabilities.push(version);
      const result = capability(version); return result instanceof Response ? result : Response.json(result);
    } });
  const uploads = createStudioUploadService({ repository: wrapped, scope, ticketKey: Buffer.alloc(32, 8),
    env: { CROUPIER_MEDIA_STORAGE: 'blob', BLOB_READ_WRITE_TOKEN: 'fixture-only-secret' },
    clientToken: async args => { tokens.push(args); return 'fixture-only-client-token'; },
    options: { cacheDir, blobClient: { async get(pathname) {
      blobReads++; const object = objects.get(pathname); if (!object) return null;
      return { statusCode: 200, stream: new Response(object.bytes).body,
        blob: { pathname, url: `https://fixture.private.blob.vercel-storage.com/${pathname}`, contentType: object.type, size: object.bytes.length } };
    } } } });
  const api = createStudioMediaApi({ repository: wrapped, config,
    uploads: Object.fromEntries(['prepare', 'commit'].map(method => [method, async (...args) => {
      try { return await uploads[method](...args); } catch (error) { errors.push(error); throw error; }
    }])),
    authorize: async () => ({ user: 'Importer', role: 'admin', scope }),
    mutationTransaction: async (work, options) => wrapped.withMutationContext(work, beforeMutation?.() ?? options.presentationMutation) });
  async function fetchImpl(url, options) {
    const body = JSON.parse(options.body); requests.push(body);
    if (body.operation === 'commit') beforeCommit?.();
    const response = await api.handle(new Request(origin + url, { ...options,
      headers: { ...options.headers, origin, 'sec-fetch-site': 'same-origin' } }));
    responses.push({ status: response.status, body: await response.clone().json() }); return response;
  }
  async function putImpl(pathname, file, options) {
    puts++; assert.equal(options.access, 'private'); assert.equal(options.token, 'fixture-only-client-token');
    objects.set(pathname, { bytes: Buffer.from(await file.arrayBuffer()), type: options.contentType });
    return { pathname, contentType: options.contentType };
  }
  return { pool, repository, objects, tokens, capabilities, requests, responses, errors, catalog: dealerImportCatalog(project),
    client: { fetchImpl, putImpl }, counts: () => ({ puts, blobReads }), registrations: () => registrations,
    setCapability: value => { capability = value; }, onCommit: fn => { beforeCommit = fn; }, onMutation: fn => { beforeMutation = fn; },
    post: body => fetchImpl('/studio/api/videos/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) };
}
function assertRuntimeError(result) {
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, { code: PRESENTATION_RUNTIME_UPDATE_REQUIRED, error: PRESENTATION_RUNTIME_UPDATE_MESSAGE });
}
function assertStorageTypeError(result) {
  assert.equal(result.status, 415);
  assert.deepEqual(result.body, { code: storageTypeCode, error: storageTypeMessage });
}
function assertNoUploadEffects(f, sqlBefore) {
  assert.equal(f.pool.calls.length, sqlBefore); assert.equal(f.tokens.length, 0); assert.deepEqual(f.capabilities, []);
  assert.deepEqual(f.counts(), { puts: 0, blobReads: 0 }); assert.equal(f.registrations(), 0);
  assert.equal(f.pool.snapshot().media.size, 0); assert.equal(f.pool.snapshot().audits.length, 0);
}

test('filename proposals and manually reviewed MP4/WebM reach native grants, verified bytes and memory-backed registry rows', async t => {
  for (const mode of ['filename', 'manual']) for (const input of cases) {
    const f = await fixture(t), item = prepared(mode, input, f.catalog), metadata = item.classification;
    assert.deepEqual(extendedDealerMediaFeatures(metadata), { mediaAlpha: false, rouletteMedia: false, recordedSpeech:false });
    assert.equal(metadata.role, 'alternative'); assert.equal(metadata.playback, 'once');
    assert.equal(metadata.dealerId, 'astrid'); assert.equal(`${metadata.eventId}/${metadata.situation}`, input.slot);
    assert.deepEqual(metadata.compositing, DEFAULT_DEALER_COMPOSITING);
    const result = await uploadNativeVideo(item.row.file, metadata, input.type, f.client)
      .catch(error => { throw new Error(error.message, { cause: f.errors.at(-1) }); });
    assert.equal(result.duplicate, false); assert.deepEqual(f.requests.map(row => row.operation), ['prepare', 'commit']);
    assert.deepEqual(f.counts(), { puts: 1, blobReads: 1 }); assert.equal(f.tokens.length, 1);
    assert.deepEqual(f.tokens[0].allowedContentTypes, [input.type]); assert.equal(f.tokens[0].allowOverwrite, false);
    assert.ok(f.capabilities.every(version => version === 2));
    assert.ok(f.capabilities.length > 0);
    const restarted = createStudioRepository({ pool: f.pool, scope }), stored = await restarted.getMedia(result.id);
    assert.deepEqual(stored.classification, metadata); assert.equal(stored.contentType, input.type);
    assert.equal(stored.sha256, createHash('sha256').update(input.bytes).digest('hex'));
    assert.equal(f.pool.snapshot().media.size, 1); assert.equal(f.pool.snapshot().audits.length, 1);
    assert.equal(f.registrations(), 1);
    // Explicit receipt replay registers no duplicate and does not rerun upload.
    const replay = await f.post(f.requests[1]); assert.equal(replay.status, 200);
    assert.deepEqual(await replay.json(), { id: result.id, duplicate: true });
    assert.equal(f.counts().puts, 1); assert.equal(f.pool.snapshot().audits.length, 1);
  }
});

test('storage MIME rejects filename and manual WAV/MP3 prepare before runtime, SQL or Blob', async t => {
  for (const mode of ['filename', 'manual']) for (const input of audioCases) {
    const f = await fixture(t), item = prepared(mode, input, f.catalog), sqlBefore = f.pool.calls.length;
    assert.equal(item.classification.mediaType, 'audio'); assert.equal(item.classification.compositing, undefined);
    await f.post({ operation: 'prepare', sha256: createHash('sha256').update(input.bytes).digest('hex'), size: input.bytes.length,
      contentType: input.type, classification: item.classification });
    assertStorageTypeError(f.responses.at(-1)); assertNoUploadEffects(f, sqlBefore);
    assert.deepEqual(f.requests.map(row => row.operation), ['prepare']);
  }
});

test('native MIME preflight rejects a mixed batch before its first video even when unsupported audio or PNG already has an error', async t => {
  for (const input of [...audioCases, png]) for (const state of ['ready', 'error']) {
    const f = await fixture(t), video = prepared('manual', cases[0], f.catalog);
    const unsupported = input === png ? { row: { id: 'local-pose', file: new File([png.bytes], png.name, { type: png.type }),
      label: png.name, slotId: png.slot }, classification: pngClassification } : prepared('manual', input, f.catalog);
    unsupported.row = { ...unsupported.row, id: 'unsupported', state, message: state === 'error' ? 'Tidigare fel behålls.' : '' };
    const items = [video, unsupported], before = items.map(({ row }) => ({ ...row })), updates = [], sqlBefore = f.pool.calls.length;
    let uploads = 0, hashes = 0;
    await assert.rejects(uploadMediaBatch(items, { onChange: (...args) => updates.push(args),
      upload: (file, metadata) => {
        uploads++;
        return uploadNativeVideo(file, metadata, file.type, { ...f.client,
          cryptoImpl: { subtle: { digest(...args) { hashes++; return crypto.subtle.digest(...args); } } } });
      } }), error => error.message === nativeTypeMessage);
    assert.equal(uploads, 0); assert.equal(hashes, 0); assert.deepEqual(updates, []); assert.deepEqual(f.requests, []);
    assert.deepEqual(items.map(({ row }) => row), before); assert.equal(items[0].row.file, before[0].file); assert.equal(items[1].row.file, before[1].file);
    assertNoUploadEffects(f, sqlBefore);
  }
});

test('native MIME preflight also rejects direct audio and PNG upload before hashing, alpha inspection or a save request', async t => {
  for (const input of [...audioCases, png]) {
    const f = await fixture(t), classification = input === png ? pngClassification : prepared('manual', input, f.catalog).classification;
    const file = new File([input.bytes], input.name, { type: input.type }), sqlBefore = f.pool.calls.length;
    let hashes = 0, inspections = 0;
    await assert.rejects(uploadNativeVideo(file, classification, input.type, { ...f.client,
      cryptoImpl: { subtle: { digest(...args) { hashes++; return crypto.subtle.digest(...args); } } },
      inspectAlpha: async () => { inspections++; },
    }), error => error.message === nativeTypeMessage);
    assert.equal(hashes, 0); assert.equal(inspections, 0); assert.deepEqual(f.requests, []); assertNoUploadEffects(f, sqlBefore);
  }
});

test('storage MIME rejects direct PNG prepare before runtime or upload while the assistant retains it only as a local pose reference', async t => {
  const f = await fixture(t), file = new File([png.bytes], png.name, { type: png.type });
  const row = { id: 'local-pose', file, label: png.name, slotId: png.slot, state: 'ready' }, sqlBefore = f.pool.calls.length;
  assert.throws(() => importClassification(row, 'astrid', f.catalog), /Posebilder/);
  assert.equal(row.file, file); assert.equal(row.slotId, png.slot); assert.equal(row.state, 'ready');
  await f.post({ operation: 'prepare', sha256: createHash('sha256').update(png.bytes).digest('hex'), size: png.bytes.length,
    contentType: png.type, classification: pngClassification });
  assertStorageTypeError(f.responses.at(-1)); assertNoUploadEffects(f, sqlBefore);
});

test('storage MIME also rejects older correctly signed audio and PNG commit tickets before runtime, SQL or Blob reads', async t => {
  for (const input of [...audioCases, png]) {
    const f = await fixture(t), classification = input === png ? pngClassification : prepared('manual', input, f.catalog).classification;
    const id = randomUUID(), sha256 = createHash('sha256').update(input.bytes).digest('hex');
    const record = { id, sha256, size: input.bytes.length, contentType: input.type, classification,
      pathname: `croupier/media/dealers/astrid/review/uploads/${id}/${sha256}.${input.name.split('.').at(-1)}` };
    const encoded = Buffer.from(canonicalStudioJson({ v: 1, actor: 'Importer', scope, record, expiresAt: Date.now() + 60_000 })).toString('base64url');
    const ticket = `${encoded}.${createHmac('sha256', Buffer.alloc(32, 8)).update(`studio-upload-v1\0${encoded}`).digest('base64url')}`;
    const sqlBefore = f.pool.calls.length;
    await f.post({ operation: 'commit', ticket });
    assertStorageTypeError(f.responses.at(-1)); assertNoUploadEffects(f, sqlBefore);
  }
});

test('extended server destinations require exact v12 before grants or SQL while the assistant still rejects alpha and pose imports', async t => {
  const failures = [() => presentationCapabilitiesForVersion(11), () => { const value = { ...presentationCapabilitiesForVersion(12) }; delete value.mediaAlpha; return value; },
    () => ({ ...presentationCapabilitiesForVersion(12), rouletteMedia: 'wrong-contract' })];
  for (const failure of failures) {
    const f = await fixture(t), item = prepared('manual', cases[1], f.catalog);
    assert.throws(() => importClassification({ ...item.row, background: 'alpha' }, 'astrid', f.catalog), /den sparas inte i denna import/);
    assert.throws(() => importClassification({ ...item.row, file: new File([cases[0].bytes], 'VILA.png'), slotId: 'pose/vila' }, 'astrid', f.catalog), /Posebilder/);
    assert.ok(f.catalog.slots.every(slot => !slot.id.startsWith('roulette.')));
    const candidates = [
      { type: 'video/webm', metadata: { ...item.classification, compositing: { mode: 'alpha' } } },
      { type: 'video/mp4', metadata: { ...item.classification, eventId: 'roulette.wheel-start', situation: 'wheel-start', game: 'roulette', action: 'wheel-start', startPose: 'VILA', endPose: 'WHEEL' } },
    ];
    f.setCapability(failure); const sqlBefore = f.pool.calls.length;
    for (const candidate of candidates) {
      await f.post({ operation: 'prepare', sha256: 'a'.repeat(64), size: 32, contentType: candidate.type, classification: candidate.metadata });
      assertRuntimeError(f.responses.at(-1));
    }
    assert.deepEqual(f.capabilities, [12, 12]); assert.equal(f.pool.calls.length, sqlBefore);
    assert.equal(f.tokens.length, 0); assert.deepEqual(f.counts(), { puts: 0, blobReads: 0 });
    assert.equal(f.pool.snapshot().media.size, 0); assert.equal(f.pool.snapshot().audits.length, 0);
    assert.equal(f.registrations(), 0);
  }
});

test('runtime failure before prepare or commit preserves the same batch file and slot without retry, fallback or registry writes', async t => {
  for (const phase of ['prepare', 'commit']) {
    const f = await fixture(t), item = prepared('manual', cases[0], f.catalog), originalFile = item.row.file;
    if (phase === 'prepare') f.setCapability(() => new Response(null, { status: 503 }));
    else f.onCommit(() => f.setCapability(() => new Response(null, { status: 503 })));
    const options = { onChange: (id, patch) => { assert.equal(id, item.row.id); Object.assign(item.row, patch); },
      upload: (file, metadata) => uploadNativeVideo(file, metadata, file.type, f.client) };
    assert.equal(await uploadMediaBatch([item], options), 0);
    assert.equal(item.row.state, 'error'); assert.equal(item.row.file, originalFile); assert.equal(item.row.slotId, cases[0].slot);
    assert.match(item.row.message, /Spelservern behöver uppdateras/); assert.match(item.row.message, /Kontrollera biblioteket/);
    assertRuntimeError(f.responses.at(-1));
    assert.deepEqual(f.requests.map(row => row.operation), phase === 'prepare' ? ['prepare'] : ['prepare', 'commit']);
    assert.deepEqual(f.counts(), { puts: phase === 'prepare' ? 0 : 1, blobReads: 0 });
    assert.equal(f.pool.snapshot().media.size, 0); assert.equal(f.pool.snapshot().audits.length, 0);
    assert.equal(f.registrations(), 0);
    const requests = f.requests.length;
    assert.equal(await uploadMediaBatch([item], options), 0); assert.equal(f.requests.length, requests);
  }
});

test('v12 downgrade after bytes are verified but before transaction admission prevents all registry and audit writes', async t => {
  const f = await fixture(t), bytes = alphaWebm;
  f.setCapability(() => presentationCapabilitiesForVersion(12));
  const metadata = { ...prepared('manual', cases[1], f.catalog).classification, compositing: { mode: 'alpha' } };
  const prepare = await f.post({ operation: 'prepare', sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length, contentType: 'video/webm', classification: metadata });
  assert.equal(prepare.status, 200); const grant = await prepare.json();
  f.objects.set(grant.pathname, { bytes, type: 'video/webm' });
  f.onMutation(() => { assert.equal(f.counts().blobReads, 1); f.setCapability(() => presentationCapabilitiesForVersion(11)); });
  await f.post({ operation: 'commit', ticket: grant.ticket });
  assert.equal(f.errors.at(-1)?.code, PRESENTATION_RUNTIME_UPDATE_REQUIRED, String(f.errors.at(-1)?.stack));
  assertRuntimeError(f.responses.at(-1));
  assert.equal(f.pool.snapshot().media.size, 0); assert.equal(f.pool.snapshot().audits.length, 0);
  assert.equal(f.registrations(), 0);
  assert.deepEqual(f.capabilities, [12, 12, 12]); assert.equal(f.tokens.length, 1);
});

test('an already admitted green-video mutation context cannot register v12 alpha WebM and never fetches readiness inside the context', async t => {
  const f = await fixture(t), bytes = alphaWebm;
  const metadata = { ...prepared('manual', cases[1], f.catalog).classification, compositing: { mode: 'alpha' } };
  const prepare = await f.post({ operation: 'prepare', sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length, contentType: 'video/webm', classification: metadata });
  assert.equal(prepare.status, 200); const grant = await prepare.json();
  f.objects.set(grant.pathname, { bytes, type: 'video/webm' });
  const greenMetadata = prepared('manual', cases[0], f.catalog).classification;
  f.onMutation(() => { assert.equal(f.counts().blobReads, 1); return { metadata: greenMetadata }; });
  await f.post({ operation: 'commit', ticket: grant.ticket });
  assertRuntimeError(f.responses.at(-1));
  assert.equal(f.registrations(), 0); assert.equal(f.pool.snapshot().media.size, 0); assert.equal(f.pool.snapshot().audits.length, 0);
  // Alpha WebM prepare/commit preflights require v12. Admission uses v2 for the
  // deliberately insufficient outer descriptor; the inner guard must reject
  // locally without any fourth capabilities request or registration attempt.
  assert.deepEqual(f.capabilities, [12, 12, 2]); assert.equal(f.tokens.length, 1);
});
