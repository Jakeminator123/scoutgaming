import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { openPreviewFile, parseByteRange, previewAuthorizationRequest, previewContentType, previewRelativePath } from '../lib/preview-files.mjs';

test('preview paths allow only single safe segments inside the build directory', async () => {
  assert.equal(previewRelativePath(['..']), null);
  assert.equal(previewRelativePath(['media', '..', 'index.html']), null);
  assert.equal(previewRelativePath(['a..b.js']), null);
  assert.equal(previewRelativePath(['']), null);
  assert.equal(previewRelativePath(['media', '']), null);
  assert.equal(previewRelativePath(['a/b.js']), null);
  assert.equal(previewRelativePath([]), null);
  assert.equal(previewRelativePath(['index.html']), 'index.html');
  const root = await mkdtemp(join(tmpdir(), 'croupier-preview-files-'));
  try {
    await writeFile(join(root, 'index.html'), '<!doctype html>');
    const opened = await openPreviewFile(root, ['index.html']);
    assert.equal(opened?.contentType, 'text/html; charset=utf-8');
    assert.equal(opened?.file, resolve(root, 'index.html'));
    assert.equal(await openPreviewFile(root, ['missing.js']), null);
    assert.equal(await openPreviewFile(root, ['..']), null);
  } finally {
    assert.ok(resolve(root).startsWith(resolve(tmpdir())));
    await rm(root, { recursive: true, force: true });
  }
});

test('preview content types stay on the reviewed file kinds', () => {
  assert.equal(previewContentType('index.html'), 'text/html; charset=utf-8');
  assert.equal(previewContentType('preview.js'), 'text/javascript');
  assert.equal(previewContentType('preview.css'), 'text/css');
  assert.equal(previewContentType('catalog.json'), 'application/json');
  assert.equal(previewContentType('clip.mp4'), 'video/mp4');
  assert.equal(previewContentType('still.webp'), 'image/webp');
  assert.equal(previewContentType('table.png'), 'image/png');
  assert.equal(previewContentType('notes.txt'), null);
  assert.equal(previewContentType('noext'), null);
});

test('a single byte range is accepted and anything else is rejected', () => {
  assert.equal(parseByteRange(null, 10), null);
  assert.deepEqual(parseByteRange('bytes=0-3', 10), { status: 'ok', start: 0, end: 3 });
  assert.deepEqual(parseByteRange('bytes=4-', 10), { status: 'ok', start: 4, end: 9 });
  assert.deepEqual(parseByteRange('bytes=-2', 10), { status: 'ok', start: 8, end: 9 });
  assert.equal(parseByteRange('bytes=abc', 10).status, 'invalid');
  assert.equal(parseByteRange('bytes=0-1,2-3', 10).status, 'invalid');
  assert.equal(parseByteRange('bytes=5-4', 10).status, 'invalid');
  assert.equal(parseByteRange('bytes=20-30', 10).status, 'unsatisfiable');
});

test('same-origin preview iframe is authorized as a page GET and a cross-site frame is not rewritten', () => {
  const same = previewAuthorizationRequest(new Request('https://studio.example/preview/index.html', {
    method: 'HEAD',
    headers: { 'sec-fetch-dest': 'iframe', 'sec-fetch-site': 'same-origin', cookie: 'session=1' },
  }));
  assert.equal(same.method, 'GET');
  assert.equal(same.headers.get('sec-fetch-dest'), null);
  assert.equal(same.headers.get('cookie'), 'session=1');
  const cross = previewAuthorizationRequest(new Request('https://studio.example/preview/clip.mp4', {
    headers: { 'sec-fetch-dest': 'iframe', 'sec-fetch-site': 'cross-site' },
  }));
  assert.equal(cross.headers.get('sec-fetch-dest'), 'iframe');
  assert.equal(cross.headers.get('sec-fetch-site'), 'cross-site');
});
