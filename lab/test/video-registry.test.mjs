import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { getVideoResponse, loadVideoRegistry } from '../lib/video-registry.mjs';

const id = 'c01866d1-7c93-43a4-9493-73f7c66d3725';
const unknownId = '00000000-0000-0000-0000-000000000000';
const bytes = Buffer.from('test-only-local-video-bytes');
const hash = createHash('sha256').update(bytes).digest('hex');

async function fixture(t, extra = {}) {
  const root = await mkdtemp(join(tmpdir(), 'croupier-video-registry-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const archiveDir = join(root, 'archive');
  await mkdir(archiveDir);
  const snapshotPath = join(root, 'snapshot.json');
  const item = {
    id, size: bytes.length, sha256: hash, duration: 4, verdict: 'want',
    placement: { dealer: 'astrid', node: 'deal.player.left', label: 'Vänster utdelning' },
    prompt: 'PRIVATE_PROMPT', downloadUrl: 'https://private.invalid?token=PRIVATE_TOKEN',
    ...extra,
  };
  await writeFile(snapshotPath, JSON.stringify({ items: [item] }));
  const file = join(archiveDir, `${id}.mp4`);
  await writeFile(file, bytes);
  return { root, file, archiveDir, snapshotPath };
}
function request(method = 'GET', headers = {}) {
  return new Request(`http://localhost:4188/api/videos/${id}`, { method, headers });
}

test('inventory has safe bounded metadata; want never implies approval', async t => {
  const options = await fixture(t);
  const result = await loadVideoRegistry(options);
  assert.equal(result.videos.length, 1);
  assert.equal(result.videos[0].verdict, 'want');
  assert.equal(result.videos[0].reviewStatus, 'unreviewed');
  assert.equal(result.videos[0].integrity, 'unchecked');
  assert.equal(result.videos[0].available, true);
  assert.equal(result.videos[0].bindingScope, 'lab-only');
  assert.equal(result.summary.readable, true);
  assert.equal(result.summary.intakeCounts.want, 1);
  const json = JSON.stringify(result);
  assert.ok(!json.includes('PRIVATE_'));
  assert.ok(!json.includes('private.invalid'));
  assert.ok(!json.includes(options.root));
  assert.ok(!json.includes('archiveDir'));
});

test('dealer labels normalize case without upgrading an intake to approval', async t => {
  const options = await fixture(t, { placement: { dealer: ' Astrid ', node: 'deal.player.right', label: 'Höger' } });
  const { videos } = await loadVideoRegistry(options);
  assert.equal(videos[0].dealer, 'astrid');
  assert.match(videos[0].label, /^Astrid/);
  assert.equal(videos[0].reviewStatus, 'unreviewed');
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
  const options = await fixture(t, { verdict: 'unreviewed' });
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
