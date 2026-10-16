import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { get } from 'node:http';
import { byteRange, readMainCatalog, createEditorServer } from './server.mjs';

test('ranges support seek/suffix and reject malformed or unsatisfiable requests', () => {
  assert.deepEqual(byteRange('bytes=2-4', 10), { start: 2, end: 4, partial: true });
  assert.deepEqual(byteRange('bytes=-3', 10), { start: 7, end: 9, partial: true });
  assert.deepEqual(byteRange('bytes=8-', 10), { start: 8, end: 9, partial: true });
  for (const range of ['bytes=10-', 'bytes=-0', 'bytes=-', 'bytes=4-2', 'bytes=0-1,3-4', 'bytes=1e3-', 'anything']) assert.equal(byteRange(range, 10), null);
});

test('viewer freezes main, excludes secrets/other branches and serves only allowlisted Git bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lipsync-viewer-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  let server;
  try {
    git('init', '-q'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid');
    await mkdir(join(root, 'media'), { recursive: true }); await mkdir(join(root, 'arkiv'), { recursive: true });
    await writeFile(join(root, 'media', 'clip.mp4'), 'original-video');
    await writeFile(join(root, 'arkiv', 'private.mp4'), 'private');
    await writeFile(join(root, '.env.local'), 'SECRET=never-serve');
    git('add', '.'); git('-c', 'core.hooksPath=disabled', 'commit', '-qm', 'Fixture main');
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    const main = git('rev-parse', 'HEAD');
    await writeFile(join(root, 'media', 'clip.mp4'), 'dirty-worktree');
    await writeFile(join(root, 'media', 'other.mp4'), 'branch-only');
    git('add', '.'); git('-c', 'core.hooksPath=disabled', 'commit', '-qm', 'Other branch');
    const catalog = readMainCatalog(root);
    assert.equal(catalog.commit, main); assert.equal(catalog.clips.length, 1);
    assert.equal(catalog.clips[0].path, 'media/clip.mp4');
    const viewer = createEditorServer(root, catalog); server = viewer.server;
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const origin = `http://127.0.0.1:${server.address().port}`, base = `${origin}/${viewer.token}/`;
    const page = await fetch(base); assert.equal(page.status, 200);
    assert.match(page.headers.get('content-security-policy'), /default-src 'none'/);
    assert.deepEqual(await (await fetch(base + 'catalog')).json(), catalog);
    const url = base + 'media/' + catalog.clips[0].id;
    assert.equal(await (await fetch(url)).text(), 'original-video');
    const range = await fetch(url, { headers: { Range: 'bytes=0-3' } });
    assert.equal(range.status, 206); assert.equal(range.headers.get('content-range'), 'bytes 0-3/14');
    assert.equal(await range.text(), 'orig');
    assert.equal((await fetch(url, { method: 'HEAD' })).headers.get('content-length'), '14');
    assert.equal((await fetch(url, { headers: { Range: 'bytes=99-' } })).status, 416);
    assert.equal((await fetch(origin + '/catalog')).status, 404);
    for (const path of ['.env.local', 'media/' + '0'.repeat(40), '%2e%2e/.env.local']) assert.equal((await fetch(base + path)).status, 404);
    assert.equal((await fetch(base + 'catalog', { method: 'POST' })).status, 405);
    assert.equal((await fetch(base + 'catalog', { headers: { Origin: 'https://example.invalid' } })).status, 403);
    const wrongHost = await new Promise((resolve, reject) => {
      get(base + 'catalog', { headers: { Host: 'example.invalid' } }, response => {
        response.resume(); resolve(response.statusCode);
      }).on('error', reject);
    });
    assert.equal(wrongHost, 403);
  } finally {
    if (server?.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await rm(root, { recursive: true, force: true });
  }
});
