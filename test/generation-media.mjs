import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix, win32 } from 'node:path';
import { openGenerationMedia, closeGenerationMedia, serveGenerationMedia } from '../services/game/generation-media.mjs';
import { publicRoutePaths, isRetiredGenerationRoute, isRetiredLocalDealerRoute } from '../services/game/retired-public-routes.mjs';

// Synthetic catalogue entries: the retired BO catalogue file no longer ships with the server.
const catalog = [{ id: 'c01866d1-7c93-43a4-9493-73f7c66d3725' }, { id: '15777d5f-4085-484e-a170-eb5c9a13d7b0' }];
const [first, second] = catalog;

test('media resolver allows only catalogue names and refuses symlink escapes', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'croupier-media-resolver-'));
  const directory = join(tmp, 'media'); await mkdir(directory);
  const open = fileName => openGenerationMedia({ directory, catalog: [{ id: first.id, thumb: 'https://example.invalid/thumbnail.jpg' }, second], fileName });
  try {
    await writeFile(join(directory, `${first.id}.mp4`), 'fixture bytes');
    await writeFile(join(directory, `${first.id}-thumb.jpg`), 'fixture thumbnail');
    await writeFile(join(directory, `${first.id}-thumb.png`), 'not the declared thumbnail');
    await writeFile(join(tmp, 'outside.mp4'), 'not served');
    await symlink(join(tmp, 'outside.mp4'), join(directory, `${second.id}.mp4`), 'file');
    for (const name of [`${first.id}.mp4`, `${first.id}-thumb.jpg`]) {
      const media = open(name); assert.ok(media); assert.ok(media.size > 0); closeGenerationMedia(media);
    }
    for (const name of [`${second.id}.mp4`, `${first.id}-thumb.png`, '../outside.mp4', `${first.id}.mp4/extra`, 'catalog.json', '.env', '11111111-2222-3333-4444-555555555555.mp4']) assert.equal(open(name), null);
    const linkedDir = join(tmp, 'linked');
    await symlink(directory, linkedDir, process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal(openGenerationMedia({ directory: linkedDir, catalog, fileName: `${first.id}.mp4` }), null);
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('served media honours GET, HEAD and byte ranges and refuses writes and bad ranges', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'croupier-media-serve-'));
  const directory = join(tmp, 'media'); await mkdir(directory);
  const bytes = '0123456789abcdefgh';
  await writeFile(join(directory, `${first.id}.mp4`), bytes);
  const server = createServer((req, res) => {
    const media = openGenerationMedia({ directory, catalog, fileName: `${first.id}.mp4` });
    if (!media) { res.writeHead(404); res.end(); return; }
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
