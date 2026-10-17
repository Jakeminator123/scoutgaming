import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { getVideoResponse, loadVideoRegistry } from '../lib/video-registry.mjs';
import { MEDIA_FAMILY_DEFINITIONS, videoIdFromSha256 } from '../../../packages/studio-registry/server/video-manifest.mjs';

const bytes = Buffer.from('test-only-local-video-bytes');
const hash = createHash('sha256').update(bytes).digest('hex');
const id = videoIdFromSha256(hash);
const unknownId = '00000000-0000-0000-0000-000000000000';
const targetPath = 'deal/deal_pos1/deal_pos1.mp4';

async function fixture(t, extra = {}) {
  const root = await mkdtemp(join(tmpdir(), 'croupier-video-registry-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const archiveDir = join(root, 'archive');
  await mkdir(archiveDir);
  const snapshotPath = join(root, 'snapshot.json');
  const items = [];
  for (const definition of MEDIA_FAMILY_DEFINITIONS) for (const relativePath of definition.standardPaths) {
    const content = relativePath === targetPath ? bytes : Buffer.from(`fixture:${relativePath}`);
    const sha256 = createHash('sha256').update(content).digest('hex');
    const item = { id: videoIdFromSha256(sha256), familyId: definition.id, role: 'standard', relativePath, extension: 'mp4', size: content.length, sha256, ...(relativePath === targetPath ? extra : {}) };
    items.push(item);
    const path = join(archiveDir, ...relativePath.split('/'));
    await mkdir(dirname(path), { recursive: true }); await writeFile(path, content);
    await mkdir(join(archiveDir, ...definition.variantDirectory.split('/')), { recursive: true });
  }
  const families = MEDIA_FAMILY_DEFINITIONS.map(definition => ({ id: definition.id, dealerId: definition.dealerId, eventId: definition.eventId, situation: definition.situation, playbackType: definition.playbackType,
    standardIds: definition.standardPaths.map(path => items.find(item => item.relativePath === path).id), variantIds: [] }));
  await writeFile(snapshotPath, JSON.stringify({ schemaVersion: 2, source: 'emil/dealklipp-v1', families, items }));
  const file = join(archiveDir, ...targetPath.split('/'));
  return { root, file, archiveDir, snapshotPath };
}
function request(method = 'GET', headers = {}) {
  return new Request(`http://localhost:4188/api/videos/${id}`, { method, headers });
}

test('inventory has safe bounded family metadata without upgrading media to approval', async t => {
  const options = await fixture(t);
  const result = await loadVideoRegistry(options);
  assert.equal(result.videos.length, 29);
  const video = result.videos.find(item => item.id === id);
  assert.equal(video.verdict, 'unrated');
  assert.equal(video.reviewStatus, 'unreviewed');
  assert.equal(video.integrity, 'unchecked');
  assert.equal(video.available, true);
  assert.equal(video.bindingScope, 'shared-local');
  assert.equal(video.familyId, 'astrid/deal.player.left/box0');
  assert.equal(result.summary.readable, true);
  assert.equal(result.summary.intakeCounts.unrated, 29);
  const json = JSON.stringify(result);
  assert.ok(!json.includes(options.root));
  assert.ok(!json.includes('archiveDir'));
});

test('locked family metadata supplies dealer and exact situation without classification', async t => {
  const options = await fixture(t);
  const { videos } = await loadVideoRegistry(options);
  const video = videos.find(item => item.id === id);
  assert.equal(video.dealer, 'astrid');
  assert.equal(video.eventId, 'deal.player.left');
  assert.equal(video.situation, 'box0');
  assert.equal(video.classification, undefined);
});

test('nested Emil paths stay inside the manifest root and remain unclassified', async t => {
  const options = await fixture(t);
  const { videos, summary } = await loadVideoRegistry(options);
  assert.equal(summary.archiveSource, 'explicit');
  const video = videos.find(item => item.id === id);
  assert.equal(video.source, 'emil');
  assert.equal(video.fileName, 'deal_pos1.mp4');
  assert.equal(video.classification, undefined);
  assert.equal(video.suggestedEventId, undefined);
  const response = await getVideoResponse(id, request(), options);
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
});

test('an explicit archive argument selects one absolute manifest and media root', async t => {
  const { root, archiveDir, snapshotPath } = await fixture(t);
  await writeFile(join(archiveDir, 'lab-video-manifest.json'), await readFile(snapshotPath));
  const options = { archiveDir, env: {}, repositoryRoot: join(root, 'unused'), uploadDir: join(root, 'uploads') };
  const inventory = await loadVideoRegistry(options);
  assert.equal(inventory.summary.archiveSource, Object.hasOwn(options,'archiveDir') ? 'explicit' : 'none');
  assert.equal(inventory.summary.snapshotReadable, true);
  assert.equal(inventory.videos.find(video => video.id === id)?.available, true);
  const response = await getVideoResponse(id, request(), options);
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
});

test('legacy folder environment variables never activate a local dealer bank', async t => {
  const { root } = await fixture(t);
  const options = { env: { LAB_VIDEO_ARCHIVE: 'relative/archive' }, repositoryRoot: root, uploadDir: join(root, 'uploads') };
  const inventory = await loadVideoRegistry(options);
  assert.equal(inventory.summary.archiveSource, Object.hasOwn(options,'archiveDir') ? 'explicit' : 'none');
  assert.equal(inventory.summary.snapshotReadable, true);
  assert.equal(inventory.summary.readable, true);
  assert.deepEqual(inventory.videos, []);
  assert.equal((await getVideoResponse(id, request(), options)).status, 503);
});

test('preview verifies full hash then serves bytes; subsequent metadata marks verified', async t => {
  const options = await fixture(t);
  const response = await getVideoResponse(id, request(), options);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'video/mp4');
  assert.equal(response.headers.get('content-length'), String(bytes.length));
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  assert.equal((await loadVideoRegistry(options)).videos[0].integrity, 'verified');
});

test('supports normal, open-ended, suffix and clamped single byte ranges', async t => {
  const options = await fixture(t);
  for (const [range, start, end] of [['bytes=2-7', 2, 7], ['bytes=3-', 3, bytes.length - 1], ['bytes=-4', bytes.length - 4, bytes.length - 1], ['bytes=0-9999', 0, bytes.length - 1]]) {
    const response = await getVideoResponse(id, request('GET', { Range: range }), options);
    assert.equal(response.status, 206, range);
    assert.equal(response.headers.get('content-range'), `bytes ${start}-${end}/${bytes.length}`);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes.subarray(start, end + 1));
  }
});

test('rejects invalid, out-of-bounds and multiple ranges without content', async t => {
  const options = await fixture(t);
  for (const range of ['bytes=999-', 'bytes=5-2', 'bytes=-0', 'bytes=-', 'bytes=0-1,3-4', 'bytes=9007199254740993-', 'garbage']) {
    const response = await getVideoResponse(id, request('GET', { Range: range }), options);
    assert.equal(response.status, 416, range);
    assert.equal(response.headers.get('content-range'), `bytes */${bytes.length}`);
    assert.ok(!(await response.text()).includes(options.root));
  }
});

test('HEAD verifies the file and has no response body; unmatched If-Range serves full content', async t => {
  const options = await fixture(t);
  const head = await getVideoResponse(id, request('HEAD', { Range: 'bytes=2-7' }), options);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal(head.headers.get('content-length'), String(bytes.length));
  const response = await getVideoResponse(id, request('GET', { Range: 'bytes=2-7', 'If-Range': '"older"' }), options);
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
});

test('unknown IDs, paths and arbitrary URLs cannot address files', async t => {
  const options = await fixture(t);
  for (const target of [unknownId, '../secret', `${id}/../../secret`, 'https://example.com/video.mp4', `${id}.mp4`]) {
    const response = await getVideoResponse(target, request(), options);
    assert.equal(response.status, 404, target);
    assert.ok(!(await response.text()).includes(options.root));
  }
});

test('missing file and unavailable archive remain explicit; unconfigured archive does not leak paths', async t => {
  const options = await fixture(t);
  await rm(options.file);
  const registry = await loadVideoRegistry(options);
  assert.equal(registry.videos[0].available, false);
  assert.equal(registry.videos[0].verdict, 'unrated');
  assert.equal(registry.summary.missing, 1);
  assert.equal((await getVideoResponse(id, request(), options)).status, 404);
  const unconfigured = { ...options, archiveDir: null };
  const unavailable = await loadVideoRegistry(unconfigured);
  assert.equal(unavailable.summary.configured, false);
  assert.equal(unavailable.summary.readable, false);
  assert.equal((await getVideoResponse(id, request(), unconfigured)).status, 503);
});

test('size and hash mismatches block playback including same-size edits after caching', async t => {
  const options = await fixture(t);
  const initial = await getVideoResponse(id, request(), options);
  await initial.arrayBuffer();
  await writeFile(options.file, Buffer.alloc(bytes.length, 45));
  assert.equal((await getVideoResponse(id, request(), options)).status, 409);
  await writeFile(options.file, Buffer.alloc(bytes.length + 1, 45));
  assert.equal((await getVideoResponse(id, request(), options)).status, 409);
  assert.equal((await loadVideoRegistry(options)).videos[0].available, false);
});

test('cross-origin requests and unsupported methods are rejected', async t => {
  const options = await fixture(t);
  assert.equal((await getVideoResponse(id, request('POST'), options)).status, 405);
  assert.equal((await getVideoResponse(id, request('GET', { Origin: 'https://evil.invalid' }), options)).status, 403);
  assert.equal((await getVideoResponse(id, request('GET', { 'Sec-Fetch-Site': 'cross-site' }), options)).status, 403);
});

test('malformed or oversized inventory never exposes paths or arbitrary fields', async t => {
  const options = await fixture(t, { id: '../../private' });
  const registry = await loadVideoRegistry(options);
  assert.equal(registry.summary.snapshotReadable, false);
  assert.deepEqual(registry.videos, []);
  const response = await getVideoResponse(id, request(), options);
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes(options.root));
});

test('archive symlinks/junctions cannot redirect the media boundary', async t => {
  const options = await fixture(t);
  const linkedArchive = join(options.root, 'linked-archive');
  try { await symlink(options.archiveDir, linkedArchive, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('Symlink creation is unavailable'); return; } throw error; }
  assert.equal((await getVideoResponse(id, request(), { ...options, archiveDir: linkedArchive })).status, 403);
  assert.equal((await getVideoResponse(id, request(), { snapshotPath: options.snapshotPath, env: { LAB_VIDEO_ARCHIVE: linkedArchive } })).status, 503);
});

test('file symlinks are rejected even when pointing to an inventory-identical file', async t => {
  const options = await fixture(t);
  const outside = join(options.root, 'outside.mp4');
  await writeFile(outside, bytes);
  await rm(options.file);
  try { await symlink(outside, options.file, 'file'); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('File symlink creation is unavailable'); return; } throw error; }
  assert.equal((await getVideoResponse(id, request(), options)).status, 403);
});
