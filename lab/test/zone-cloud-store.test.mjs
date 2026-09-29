import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { validateZones, zoneCloudConfigured, loadCloudZones, saveCloudZones, uploadZoneClip, streamZoneClip, probeZoneVideo, MAX_ZONE_CLIP_BYTES } from '../lib/zone-cloud-store.mjs';
import { persistBrowserZones, ZONE_BROWSER_STORAGE, ZONE_CLOUD_DRAFT_STORAGE, persistCloudZoneDraft, readCloudZoneDraft, adoptUploadedZoneClip, restoredCloudDraftState, zoneClipKey, zoneClipSource } from '../lib/zone-workspaces.mjs';

const zone = { id: 'light-2', name: 'Lampa', x: 30, y: 20, width: 16, height: 24, blend: 'screen', playback: 'automatic' };
const mediaBytes = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom00000000zone-fixture')]);
const request = (path = '', options = {}) => new Request(`http://localhost:4188/api/zones${path}`, options);
const save = (zones, revision) => request('', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ zones, revision }) });
const upload = (overrides = {}) => request('/clips', { method: 'POST', headers: { 'content-type': 'video/mp4', 'x-zone-width': '16', 'x-zone-height': '24', ...overrides }, body: mediaBytes });

function fixture() {
  let document = null;
  const clips = new Map(), objects = new Map(), calls = [], deletions = [];
  const query = async (text, values) => {
    calls.push({ text, values });
    if (text.startsWith('SELECT revision')) return document ? [structuredClone(document)] : [];
    if (text.startsWith('SELECT id')) return values[0].flatMap(id => clips.has(id) ? [{ id, ...clips.get(id) }] : []);
    if (text.startsWith('SELECT media')) return clips.has(values[0]) ? [{ media: clips.get(values[0]).media }] : [];
    if (text.startsWith('INSERT INTO croupier_zones.clips')) { clips.set(values[0], { width: values[1], height: values[2], media: JSON.parse(values[3]) }); return []; }
    if (text.startsWith('INSERT INTO croupier_zones.documents')) {
      if (document || values[2] !== 0) return [];
      document = { zones: JSON.parse(values[1]), revision: 1, updated_at: '2026-09-29T08:00:00.000Z' }; return [structuredClone(document)];
    }
    if (text.startsWith('UPDATE croupier_zones.documents')) {
      if (!document || document.revision !== values[2]) return [];
      document.zones = JSON.parse(values[0]); document.revision++; return [structuredClone(document)];
    }
    throw new Error(`Unexpected query: ${text}`);
  };
  const options = {
    query, probe: async () => ({ width: 16, height: 24 }),
    putMedia: async (pathname, bytes, { sha256, size, contentType }) => {
      const record = { provider: 'vercel-blob', pathname, sha256, size, contentType };
      objects.set(pathname, bytes); return record;
    },
    deleteMedia: async record => { deletions.push(record.pathname); objects.delete(record.pathname); },
  };
  return { options, calls, clips, objects, deletions };
}

test('zone configuration uses only dedicated database plus explicitly enabled private Blob', async () => {
  assert.equal(zoneCloudConfigured({ DATABASE_URL: 'postgres://unrelated', POSTGRES_URL: 'postgres://game', BLOB_READ_WRITE_TOKEN: 'private', CROUPIER_MEDIA_STORAGE: 'blob' }), false);
  assert.equal(zoneCloudConfigured({ CROUPIER_ZONES_DATABASE_URL: 'postgres://zones', BLOB_READ_WRITE_TOKEN: 'private', CROUPIER_MEDIA_STORAGE: 'blob' }), true);
  assert.deepEqual(await loadCloudZones(request(), { env: {} }), { configured: false, revision: 0, zones: [] });
  await assert.rejects(saveCloudZones(save([zone], 0), { env: { DATABASE_URL: 'postgres://unrelated' } }), error => error.statusCode === 503);
});

test('zone validation rejects dimensions, duplicate IDs, dangling files and untrusted metadata', () => {
  assert.deepEqual(validateZones([{ ...zone, pathname: 'ignored', url: 'https://evil.invalid/file' }]), [zone]);
  for (const invalid of [{ ...zone, id: undefined }, { ...zone, x: -1 }, { ...zone, width: 1081 }, { ...zone, height: 3 }, { ...zone, y: 1910 }, { ...zone, playback: 'random' }, { ...zone, clipName: 'local-only.mp4' }, { ...zone, cloudClipId: '../evil' }]) {
    assert.throws(() => validateZones([invalid]));
  }
  assert.throws(() => validateZones([zone, zone]));
  assert.throws(() => validateZones(Array(101).fill(zone)));
});

test('unauthorized or cross-origin calls cannot read, upload, stream or save zone data', async () => {
  const f = fixture();
  for (const method of ['GET', 'PUT', 'POST']) {
    const external = new Request('https://evil.invalid/api/zones', { method });
    const run = method === 'GET' ? loadCloudZones : method === 'PUT' ? saveCloudZones : uploadZoneClip;
    await assert.rejects(run(external, f.options), error => error.statusCode === 403);
  }
  await assert.rejects(loadCloudZones(request('', { headers: { origin: 'https://evil.invalid' } }), f.options), error => error.statusCode === 403);
  await assert.rejects(streamZoneClip(new Request('https://evil.invalid/api/zones/clips/id'), '11111111-1111-1111-1111-111111111111', f.options), error => error.statusCode === 403);
  assert.equal(f.calls.length, 0); assert.equal(f.objects.size, 0);
});

test('cloud zone upload, document reread and authenticated Range use the same immutable private media', async t => {
  const f = fixture(), cacheDir = await mkdtemp(join(tmpdir(), 'croupier-zone-range-test-'));
  t.after(() => rm(cacheDir, { recursive: true, force: true }));
  const uploaded = await uploadZoneClip(upload(), f.options);
  assert.deepEqual({ width: uploaded.width, height: uploaded.height }, { width: 16, height: 24 });
  assert.equal(JSON.stringify(uploaded).includes('pathname'), false);
  const linked = { ...zone, clipName: 'light.mp4', clipWidth: 16, clipHeight: 24, cloudClipId: uploaded.id };
  const saved = await saveCloudZones(save([linked], 0), f.options);
  assert.equal(saved.revision, 1);
  assert.deepEqual((await loadCloudZones(request(), f.options)).zones, [linked]);
  const record = f.clips.get(uploaded.id).media;
  const blobClient = { get: async pathname => ({ statusCode: 200, stream: new Response(f.objects.get(pathname)).body, blob: { ...record, url: `https://fixture.private.blob.vercel-storage.com/${pathname}` } }) };
  const options = { ...f.options, cacheDir, blobClient, env: { CROUPIER_MEDIA_STORAGE: 'blob', BLOB_READ_WRITE_TOKEN: 'fixture-only' } };
  for (let play = 0; play < 2; play++) {
    const response = await streamZoneClip(request(`/clips/${uploaded.id}`, { headers: { range: 'bytes=4-11' } }), uploaded.id, options);
    assert.equal(response.status, 206); assert.deepEqual(Buffer.from(await response.arrayBuffer()), mediaBytes.subarray(4, 12));
    assert.equal(response.headers.get('content-range'), `bytes 4-11/${mediaBytes.length}`);
  }
  const head = await streamZoneClip(request(`/clips/${uploaded.id}`, { method: 'HEAD' }), uploaded.id, options);
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
  assert.ok(f.calls.every(call => call.text.includes('croupier_zones.')));
});

test('concurrent zone saves reject stale revision and preserve last accepted geometry', async () => {
  const f = fixture();
  await saveCloudZones(save([zone], 0), f.options);
  const next = { ...zone, x: 100 };
  assert.equal((await saveCloudZones(save([next], 1), f.options)).revision, 2);
  await assert.rejects(saveCloudZones(save([{ ...zone, x: 500 }], 1), f.options), error => error.statusCode === 409);
  assert.deepEqual((await loadCloudZones(request(), f.options)).zones, [next]);
  await assert.rejects(saveCloudZones(save([zone], -1), f.options));
});

test('authenticated cloud proxy origin survives Next internal URL, forged proxy does not', async t => {
  const f = fixture(), uploaded = await uploadZoneClip(upload(), f.options);
  const cacheDir = await mkdtemp(join(tmpdir(), 'croupier-zone-proxy-test-'));
  t.after(() => rm(cacheDir, { recursive: true, force: true }));
  const publicUrl = 'https://lab.example.test', secret = 'test-zone-proxy-secret-'.repeat(3);
  const old = { url: process.env.LAB_PUBLIC_URL, secret: process.env.CROUPIER_LAB_INTERNAL_SECRET };
  process.env.LAB_PUBLIC_URL = publicUrl; process.env.CROUPIER_LAB_INTERNAL_SECRET = secret;
  try {
    const record = f.clips.get(uploaded.id).media;
    const options = { ...f.options, cacheDir, env: { CROUPIER_MEDIA_STORAGE: 'blob', BLOB_READ_WRITE_TOKEN: 'fixture-only' },
      blobClient: { get: async pathname => ({ statusCode: 200, stream: new Response(f.objects.get(pathname)).body, blob: { ...record, url: `https://fixture.private.blob.vercel-storage.com/${pathname}` } }) } };
    const headers = { host: 'lab.example.test', 'x-forwarded-host': 'lab.example.test', 'x-forwarded-proto': 'https', 'x-croupier-lab-authorized': secret, origin: publicUrl, 'sec-fetch-site': 'same-origin', range: 'bytes=0-15' };
    const response = await streamZoneClip(request(`/clips/${uploaded.id}`, { headers }), uploaded.id, options);
    assert.equal(response.status, 206); assert.deepEqual(Buffer.from(await response.arrayBuffer()), mediaBytes.subarray(0, 16));
    for (const changed of [{ origin: 'https://evil.invalid' }, { 'x-croupier-lab-authorized': 'wrong' }, { 'sec-fetch-site': 'same-site' }]) {
      await assert.rejects(streamZoneClip(request(`/clips/${uploaded.id}`, { headers: { ...headers, ...changed } }), uploaded.id, options), error => error.statusCode === 403);
    }
  } finally {
    if (old.url === undefined) delete process.env.LAB_PUBLIC_URL; else process.env.LAB_PUBLIC_URL = old.url;
    if (old.secret === undefined) delete process.env.CROUPIER_LAB_INTERNAL_SECRET; else process.env.CROUPIER_LAB_INTERNAL_SECRET = old.secret;
  }
});

test('zone metadata cannot bind missing clips or clips with another size', async () => {
  const f = fixture(), uploaded = await uploadZoneClip(upload(), f.options);
  const linked = { ...zone, clipName: 'light.mp4', clipWidth: 16, clipHeight: 24, cloudClipId: uploaded.id };
  await assert.rejects(saveCloudZones(save([{ ...linked, width: 32, clipWidth: 32 }], 0), f.options), error => error.statusCode === 409);
  await assert.rejects(saveCloudZones(save([{ ...linked, cloudClipId: '11111111-1111-1111-1111-111111111111' }], 0), f.options), error => error.statusCode === 409);
});

test('bounded video intake checks actual dimensions before Blob and rolls back a failed metadata insert', async () => {
  const f = fixture();
  await assert.rejects(uploadZoneClip(upload({ 'content-length': String(MAX_ZONE_CLIP_BYTES + 1) }), f.options), error => error.statusCode === 413);
  await assert.rejects(uploadZoneClip(upload({ 'content-type': 'text/plain' }), f.options), error => error.statusCode === 415);
  await assert.rejects(uploadZoneClip(upload(), { ...f.options, probe: async () => ({ width: 32, height: 24 }) }), /exakt/);
  assert.equal(f.objects.size, 0);
  await assert.rejects(uploadZoneClip(upload(), { ...f.options, query: async () => { throw new Error('fixture db failure'); } }), /fixture db failure/);
  assert.equal(f.deletions.length, 1); assert.equal(f.objects.size, 0);
});

test('real ffprobe validates MP4 and WebM dimensions and rejects corrupt video', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'croupier-zone-probe-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const exec = promisify(execFile);
  for (const [extension, codec] of [['mp4', 'libx264'], ['webm', 'libvpx-vp9']]) {
    const file = join(dir, `clip.${extension}`);
    await exec('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=16x24:r=2:d=1', '-c:v', codec, file], { windowsHide: true, timeout: 15000 });
    const bytes = await readFile(file);
    assert.deepEqual(await probeZoneVideo(bytes, extension), { width: 16, height: 24 });
  }
  await assert.rejects(probeZoneVideo(mediaBytes, 'mp4'), error => error.statusCode === 415);
});

test('cloud edits and reread preserve independent browser geometry and old clip bytes', () => {
  const entries = new Map(), storage = { setItem: (key, value) => entries.set(key, value) };
  persistBrowserZones(storage, 'local', [zone]);
  persistBrowserZones(storage, 'cloud', [{ ...zone, x: 400 }]);
  assert.deepEqual(JSON.parse(entries.get(ZONE_BROWSER_STORAGE)), [zone]);
  const offlineKey = zoneClipKey('local', zone.id), cloudKey = zoneClipKey('cloud', zone.id);
  assert.notEqual(offlineKey, cloudKey);
  const clips = new Map([[offlineKey, mediaBytes]]); clips.set(cloudKey, Buffer.from('replacement')); clips.delete(cloudKey);
  assert.deepEqual(clips.get(offlineKey), mediaBytes);
  const linked = { ...zone, cloudClipId: 'cloud-new' }, urls = { [`local:${zone.id}`]: 'blob:offline', [`cloud:${zone.id}`]: 'blob:old-draft' }, mediaUrl = id => `/api/zones/clips/${id}`;
  assert.equal(zoneClipSource('local', linked, urls, mediaUrl), 'blob:offline');
  assert.equal(zoneClipSource('cloud', linked, urls, mediaUrl), '/api/zones/clips/cloud-new');
});

test('partial upload retains its private clip ID through draft reload and retries without duplicate upload', async () => {
  const f = fixture(), entries = new Map();
  const storage = { setItem: (key, value) => entries.set(key, value), getItem: key => entries.get(key) ?? null };
  persistBrowserZones(storage, 'local', [zone]);
  const first = { ...zone, clipName: 'light.mp4', clipWidth: 16, clipHeight: 24 };
  const second = { ...first, id: 'light-3', x: 150 };
  let working = [first, second];
  const uploaded = await uploadZoneClip(upload(), f.options);
  working = adoptUploadedZoneClip(working, first.id, uploaded);
  persistCloudZoneDraft(storage, working, 0);
  await assert.rejects(uploadZoneClip(upload(), { ...f.options, putMedia: async () => { throw new Error('second-upload-failed'); } }));
  const restored = readCloudZoneDraft(storage, value => Boolean(value.id));
  assert.equal(restored.revision, 0); assert.equal(restored.zones[0].cloudClipId, uploaded.id);
  assert.equal(restored.zones[1].cloudClipId, undefined);
  assert.deepEqual(restored.zones.filter(zone => zone.clipName && !zone.cloudClipId).map(zone => zone.id), ['light-3']);
  assert.equal(f.objects.size, 1);
  // Reading cloud or returning to the browser does not replace the recoverable draft.
  await loadCloudZones(request(), f.options);
  persistBrowserZones(storage, 'cloud', []);
  assert.deepEqual(JSON.parse(entries.get(ZONE_BROWSER_STORAGE)), [zone]);
  assert.equal(JSON.parse(entries.get(ZONE_CLOUD_DRAFT_STORAGE)).zones[0].cloudClipId, uploaded.id);
  const secondUpload = await uploadZoneClip(upload(), f.options);
  working = adoptUploadedZoneClip(restored.zones, second.id, secondUpload);
  persistCloudZoneDraft(storage, working, restored.revision);
  await saveCloudZones(save(working, restored.revision), f.options);
  await assert.rejects(saveCloudZones(save(working, restored.revision), f.options), error => error.statusCode === 409);
  assert.equal(readCloudZoneDraft(storage, value => Boolean(value.id)).zones.filter(zone => !zone.cloudClipId).length, 0);
  assert.equal(f.objects.size, 2);
});

test('offline cloud-draft restoration retains revision, editable geometry, export and local playback', () => {
  const draft = { revision: 7, zones: [{ ...zone, cloudClipId: '11111111-1111-1111-1111-111111111111', clipName: 'light.mp4', clipWidth: 16, clipHeight: 24 }] };
  for (const unavailable of [null, { configured: false, revision: 0, zones: [] }]) {
    const state = restoredCloudDraftState(draft, unavailable);
    assert.equal(state.configured, false); assert.equal(state.revision, 7);
    assert.deepEqual(JSON.parse(JSON.stringify(state.zones)), draft.zones);
    const urls = { [`cloud:${zone.id}`]: 'blob:offline-draft' };
    assert.equal(zoneClipSource('cloud', state.zones[0], urls, id => `/api/zones/clips/${id}`, !state.configured), 'blob:offline-draft');
  }
  assert.equal(restoredCloudDraftState(draft, { configured: true }).configured, true);
});

test('schema is dedicated, explicit and contains no game tables or destructive migration', async () => {
  const schema = await readFile(new URL('../lib/zone-cloud-schema.sql', import.meta.url), 'utf8');
  assert.match(schema, /CREATE SCHEMA IF NOT EXISTS croupier_zones/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS croupier_zones\.clips/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS croupier_zones\.documents/);
  assert.doesNotMatch(schema, /\b(?:DROP|DELETE|TRUNCATE|wallet|players)\b/i);
});
