import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLayerPacksRoute } from '../web/layer-packs.mjs';

function responseRecorder() {
  return {
    statusCode: null,
    headers: null,
    body: '',
    writeHead(statusCode, headers) { this.statusCode = statusCode; this.headers = headers; },
    end(body = '') { this.body += body; },
  };
}

test('layer-packs route denies requests without lane flag', async () => {
  const route = createLayerPacksRoute();
  const res = responseRecorder();
  const handled = await route({ method: 'GET', headers: {} }, res, '/layer-packs/runtime/player.js');
  assert.equal(handled, true);
  assert.equal(res.statusCode, 404);
});

test('layer-packs runtime supports range with lane flag', async () => {
  const route = createLayerPacksRoute();
  const res = responseRecorder();
  const handled = await route({
    method: 'HEAD',
    headers: { cookie: 'croupier_layer_preview=1', range: 'bytes=0-15' },
  }, res, '/layer-packs/runtime/player.js');
  assert.equal(handled, true);
  assert.equal(res.statusCode, 206);
  assert.match(res.headers['Content-Range'], /^bytes 0-15\//);
});

test('layer-packs media traversal returns 404', async () => {
  const root = await mkdtemp(join(tmpdir(), 'layer-packs-route-'));
  try {
    await mkdir(join(root, 'media'), { recursive: true });
    await writeFile(join(root, 'catalog.json'), '{"lanes":[],"assets":[]}');
    const route = createLayerPacksRoute({ previewRoot: root });
    const res = responseRecorder();
    const handled = await route({
      method: 'GET',
      headers: { cookie: 'croupier_layer_preview=1' },
    }, res, '/layer-packs/paow/media/../catalog.json');
    assert.equal(handled, true);
    assert.equal(res.statusCode, 404);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
