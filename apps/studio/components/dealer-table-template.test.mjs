import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { getDealerTableGeometry, projectTablePoint, validateDealerTableDefinition } from './dealer-table-geometry.mjs';

const assetDirectory = new URL('./dealer-table-assets/', import.meta.url);
const definition = JSON.parse(await readFile(new URL('olive-blackjack-v1.json', assetDirectory), 'utf8'));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('placement uses the complete image rectangle and scene dimensions', () => {
  for (const layout of ['desktop', 'mobile']) {
    const { width: stageWidth, height: stageHeight } = definition.layouts[layout].scene;
    const geometry = getDealerTableGeometry(definition, layout, { width: .8, x: .1, y: .4 });
    assert.deepEqual(geometry.rect, [stageWidth * .2, stageHeight * .4, stageWidth * .8, stageWidth * .8 * 768 / 2048]);
    assert.deepEqual(projectTablePoint(geometry.rect, { x: 0, y: 0 }), { x: geometry.rect[0], y: geometry.rect[1] });
    assert.deepEqual(projectTablePoint(geometry.rect, { x: 1, y: 1 }), {
      x: geometry.rect[0] + geometry.rect[2], y: geometry.rect[1] + geometry.rect[3],
    });
    close(geometry.visibleRect[0], geometry.rect[0] + geometry.rect[2] * 24 / 2048);
    close(geometry.visibleRect[1], geometry.rect[1] + geometry.rect[3] * 126 / 768);
  }
});

test('desktop composition meets the measured design extent and mobile preserves three visible seats', () => {
  const desktop = getDealerTableGeometry(definition, 'desktop');
  close(desktop.visibleRect[0], 1920 * .08);
  close(desktop.visibleRect[0] + desktop.visibleRect[2], 1920 * .92);
  close(desktop.visibleRect[1], 1080 * .57);
  assert.ok(desktop.visibleRect[1] + desktop.visibleRect[3] < 1080 * .99);
  assert.equal(desktop.seats.length, 7);
  const mobile = getDealerTableGeometry(definition, 'mobile');
  assert.equal(mobile.seats.length, 3);
  for (const { card, bet } of mobile.seats) for (const point of [card, bet]) {
    assert.ok(point.x > 0 && point.x < 1080 && point.y > 0 && point.y < 1920);
  }
});

test('a different aspect ratio and its own anchors remain independent of the room', () => {
  const other = structuredClone(definition);
  other.asset.width = 3000; other.asset.height = 1500;
  other.layouts.desktop.anchors.dealer = { x: .4, y: .2 };
  const geometry = getDealerTableGeometry(other, 'desktop', { width: .5, x: -.1, y: .6 });
  assert.deepEqual(geometry.rect, [288, 648, 960, 480]);
  assert.deepEqual(geometry.dealer, { x: 672, y: 744 });
});

test('invalid versions, dimensions, bounds, placement and anchors fail before rendering', () => {
  for (const mutate of [t => { t.schemaVersion = 2; }, t => { t.asset.width = 0; },
    t => { t.asset.alphaBounds.width = 9999; }, t => { t.layouts.desktop.placement.width = NaN; },
    t => { t.layouts.mobile.anchors.seats.pop(); }, t => { t.layouts.desktop.anchors.dealer.x = 1.01; }]) {
    const invalid = structuredClone(definition); mutate(invalid);
    assert.throws(() => validateDealerTableDefinition(invalid), TypeError);
  }
  assert.throws(() => getDealerTableGeometry(definition, 'tablet'), TypeError);
  assert.throws(() => getDealerTableGeometry(definition, 'desktop', { width: 1, x: Infinity, y: 0 }), TypeError);
});

function boundsFor(data, width, height, threshold) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[y * width + x] < threshold) continue;
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1, threshold };
}

test('PNG and WebP have measured dimensions, identities, bounds and identical real alpha', async () => {
  let originalAlpha;
  for (const [format, source] of Object.entries(definition.asset.sources)) {
    const bytes = await readFile(new URL(source.filename, assetDirectory));
    assert.equal(bytes.length, source.size);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, definition.asset.width); assert.equal(metadata.height, definition.asset.height);
    assert.equal(metadata.hasAlpha, true);
    const alpha = await sharp(bytes).extractChannel('alpha').raw().toBuffer();
    assert.ok(alpha.filter(value => value === 0).length > alpha.length * .3);
    assert.ok(alpha.filter(value => value >= 250).length > alpha.length * .5);
    for (const name of ['alphaBounds', 'visibleBounds']) {
      assert.deepEqual(boundsFor(alpha, metadata.width, metadata.height, definition.asset[name].threshold), definition.asset[name]);
    }
    if (format === 'png') originalAlpha = alpha;
    else assert.deepEqual(alpha, originalAlpha, 'WebP conversion must preserve the PNG alpha exactly');
    for (const { anchors } of Object.values(definition.layouts)) {
      const points = [anchors.dealer, ...anchors.seats.flatMap(seat => [seat.card, seat.bet])];
      for (const point of points) {
        assert.ok(alpha[Math.floor(point.y * metadata.height) * metadata.width + Math.floor(point.x * metadata.width)] >= 250,
          `Anchor ${JSON.stringify(point)} must land inside the table silhouette`);
      }
    }
  }
});
