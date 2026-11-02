import assert from 'node:assert/strict';
import test from 'node:test';
import { posix, win32 } from 'node:path';
import { publicRoutePaths, isRetiredGenerationRoute, isRetiredLocalDealerRoute } from '../../services/game/retired-public-routes.mjs';

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
