import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { fstatSync, openSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix, win32 } from 'node:path';
import { serveGenerationMedia } from '../services/game/generation-media.mjs';
import { publicRoutePaths, isRetiredGenerationRoute, isRetiredLocalDealerRoute } from '../services/game/retired-public-routes.mjs';

// server.mjs hands serveGenerationMedia the descriptor from media-layout's openPublicMedia;
// this opens one the same way so the test covers only the responder.
function openFixtureMedia(file) {
  const fd = openSync(file, 'r'), { size, mtimeMs } = fstatSync(fd);
  return { fd, size, mtimeMs, contentType: 'video/mp4' };
}

test('served media honours GET, HEAD and byte ranges and refuses writes and bad ranges', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'croupier-media-serve-'));
  const directory = join(tmp, 'media'); await mkdir(directory);
  const bytes = '0123456789abcdefgh';
  const file = join(directory, 'clip.mp4'), opened = [];
  await writeFile(file, bytes);
  const server = createServer((req, res) => {
    const media = openFixtureMedia(file); opened.push(media);
    serveGenerationMedia(req, res, media, { ETag: '"fixture"' });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/media`;
  try {
    const full = await fetch(url);
    assert.equal(full.status, 200); assert.equal(await full.text(), bytes);
    assert.equal(full.headers.get('content-type'), 'video/mp4'); assert.equal(full.headers.get('etag'), '"fixture"');
    assert.equal(full.headers.get('x-content-type-options'), 'nosniff');
    for (const [range, body] of [['bytes=2-5', '2345'], ['bytes=-3', 'fgh'], ['bytes=15-', 'fgh'], ['bytes=16-99', 'gh']]) {
      const partial = await fetch(url, { headers: { range } });
      assert.equal(partial.status, 206, range); assert.equal(await partial.text(), body, range);
      assert.match(partial.headers.get('content-range'), new RegExp(`/${bytes.length}$`));
    }
    for (const range of ['bytes=18-', 'bytes=-0', 'bytes=5-2', 'items=0-1', 'bytes=-']) {
      const refused = await fetch(url, { headers: { range } });
      assert.equal(refused.status, 416, range); assert.equal(refused.headers.get('content-range'), `bytes */${bytes.length}`); await refused.arrayBuffer();
    }
    const head = await fetch(url, { method: 'HEAD' });
    assert.equal(head.status, 200); assert.equal(head.headers.get('content-length'), String(bytes.length)); assert.equal(await head.text(), '');
    const write = await fetch(url, { method: 'POST', body: 'x' });
    assert.equal(write.status, 405); assert.equal(write.headers.get('allow'), 'GET, HEAD'); await write.arrayBuffer();
    // Every branch either closes the descriptor or hands it to the response stream.
    assert.ok(opened.length > 0 && opened.every(media => media.fd === undefined));
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(tmp, { recursive: true, force: true }); }
});

// Formerly proven through the SQLite comparison launcher over HTTP. The route
// table is now checked directly with both Windows and POSIX path semantics, so
// encoded slashes, casing and trailing dots/spaces cannot reach static files.
const normalizers = [['win32', win32.normalize], ['posix', posix.normalize]];
const route = (raw, normalize) => publicRoutePaths(decodeURIComponent(raw), normalize).route;

test('retired BO generation aliases are classified before static files on Windows and POSIX', () => {
  const known = '11111111-2222-3333-4444-555555555555';
  const prefixes = ['/bo/gen/', '/bo%2fgen%2f', '/bo%5cgen%5c', '/BO/GEN/', '/Bo/gEn/', '/BO%2fGEN%2f', '/BO%5cGEN%5c',
    '/bo./gen./', '/bo%20/gen%20/', '/BO.%20/Gen%20./'];
  for (const [platform, normalize] of normalizers) {
    for (const prefix of prefixes) assert.ok(isRetiredGenerationRoute(route(`${prefix}${known}.mp4`, normalize)), `${platform} ${prefix}`);
    for (const raw of ['/bo/generations.json', '/BO/Generations.JSON', '/bo%2fgenerations.json%20', '/bo/gen', '/bo/./gen/x.mp4'])
      assert.ok(isRetiredGenerationRoute(route(raw, normalize)), `${platform} ${raw}`);
    for (const raw of ['/bo/', '/bo/index.html', '/bogen/x.mp4', '/bo/generations.jsonx', '/bo/genx/x.mp4', '/game', '/api/v1/generations'])
      assert.equal(isRetiredGenerationRoute(route(raw, normalize)), false, `${platform} ${raw}`);
  }
});

test('retired local dealer assets stay retired under encoded, cased and dotted aliases', () => {
  const retired = ['/dealer/streams/index.json', '/dealers/astrid/streams/index.json', '/dealers/amira/audio/en/bank.json',
    '/dealers/mei/poster.jpg', '/Dealers/AsTrId/streams/index.json', '/dealers./vera./poster.jpg', '/%64ealers/%61strid/streams/index.json',
    '/dealers%5castrid%5cposter.jpg', '/dealer'];
  for (const [platform, normalize] of normalizers) {
    for (const raw of retired) assert.ok(isRetiredLocalDealerRoute(route(raw, normalize)), `${platform} ${raw}`);
    for (const raw of ['/dealers/linnea/poster.jpg', '/dealerships/x', '/game', '/'])
      assert.equal(isRetiredLocalDealerRoute(route(raw, normalize)), false, `${platform} ${raw}`);
    // Traversal prefixes are stripped before classification, never resolved above the root.
    assert.equal(publicRoutePaths('../../dealers/astrid/x', normalize).route, '/dealers/astrid/x');
  }
});
