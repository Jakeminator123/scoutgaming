import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { designPreviewFile, serveDesignPreview } from '../lib/design-preview.mjs';
import { studioLoginReturnTo, studioLoginDestination } from '../lib/studio-login-client.mjs';
import { platformConfiguration, platformRoute } from '../../apps/croupier-frontend/lib/platform-routing.mjs';

test('preview documents and assets have exact route boundaries', () => {
  assert.equal(designPreviewFile([]), 'admin/index.html');
  assert.equal(designPreviewFile(['admin','operators']), 'admin/index.html');
  assert.equal(designPreviewFile(['lobby']), 'lobby/index.html');
  assert.equal(designPreviewFile(['_assets','lobby','images','dealers','astrid.jpg']), 'lobby/images/dealers/astrid.jpg');
  for (const path of [['api'], ['_assets','admin','..','private.js'], ['_assets','admin','.env'],
    ['_assets','admin','index.html'], ['_assets','elsewhere','file.js'], ['%2e%2e'], ['admin','payments','delete'], ['admin\\accounts']])
    assert.equal(designPreviewFile(path), null);
});

test('login returns only to known preview documents; never assets, queries or another origin', () => {
  for (const path of ['/admin', '/admin/structure', '/admin/lobby', '/admin/admin/accounts']) {
    assert.equal(studioLoginReturnTo(path), path);
    assert.equal(studioLoginReturnTo('/studio' + path), path);
    assert.equal(studioLoginDestination(path, '/api/auth'), path);
  }
  for (const value of ['/admin/_assets/admin/app.js', '/admin/unknown', '/admin?returnTo=https://elsewhere.test', '//elsewhere.test/admin', '/admin/../api'])
    assert.equal(studioLoginReturnTo(value), '/studio');
});

test('public admin documents and assets route to Studio without changing control', () => {
  const config = platformConfiguration({ CROUPIER_VERCEL_UI: '1', CROUPIER_BACKEND_ORIGIN: 'https://engine.example', CROUPIER_PUBLIC_ORIGIN: 'https://www.example.com',
    CROUPIER_LAB_UI_ORIGIN: 'https://studio.example', CROUPIER_VERCEL_INGRESS_SECRET: 'a'.repeat(40) });
  assert.ok(config);
  for (const path of ['/admin','/admin/lobby','/admin/_assets/admin/app.js']) {
    assert.deepEqual(platformRoute(new URL(path, config.publicOrigin), config), { kind: 'lab', destination: config.labUiOrigin + '/studio' + path });
  }
});

test('every asset request reauthorizes, rejects writes, streams ranges and sends isolation headers', async () => {
  const root = await mkdtemp(join(tmpdir(), 'croupier-design-preview-'));
  try {
    await mkdir(join(root, 'lobby'));
    await writeFile(join(root, 'lobby', 'clip.mp4'), '0123456789');
    const url = 'http://127.0.0.1/admin/_assets/lobby/clip.mp4';
    const segments = ['_assets', 'lobby', 'clip.mp4'];
    let authorized = 0;
    const authorize = async request => { assert.equal(request.method, 'GET'); authorized++; };
    const denied = Object.assign(new Error('denied'), { statusCode: 401 });
    await assert.rejects(serveDesignPreview(new Request(url), segments, { root, authorize: async () => { throw denied; } }), error => error === denied);
    const response = await serveDesignPreview(new Request(url, { headers: { range: 'bytes=2-5' } }), segments, { root, authorize });
    assert.equal(response.status, 206); assert.equal(await response.text(), '2345');
    assert.equal(response.headers.get('content-range'), 'bytes 2-5/10');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.match(response.headers.get('content-security-policy'), /connect-src 'self'/);
    const head = await serveDesignPreview(new Request(url, { method: 'HEAD' }), segments, { root, authorize });
    assert.equal(head.headers.get('content-length'), '10'); assert.equal(await head.text(), '');
    assert.equal(authorized, 2);
    assert.equal((await serveDesignPreview(new Request(url, { method: 'POST', body: '{}' }), segments, { root, authorize })).status, 405);
    assert.equal(authorized, 2);
    assert.equal((await serveDesignPreview(new Request(url, { headers: { range: 'bytes=100-' } }), segments, { root, authorize })).status, 416);
    assert.equal((await serveDesignPreview(new Request(url), ['_assets','lobby','missing.mp4'], { root, authorize })).status, 404);
  } finally { await rm(root, { recursive: true, force: true }); }
});
