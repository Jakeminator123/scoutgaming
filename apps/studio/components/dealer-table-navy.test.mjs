import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { getDealerTableGeometry, validateDealerTableDefinition } from './dealer-table-geometry.mjs';

const assetDirectory = new URL('./dealer-table-assets/', import.meta.url);
const definition = JSON.parse(await readFile(new URL('navy-blackjack-v1.json', assetDirectory), 'utf8'));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

function alphaBounds(alpha, width, height, threshold) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (alpha[y * width + x] < threshold) continue;
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1, threshold };
}

test('navy assets decode to the descriptor identities, dimensions and measured alpha', async () => {
  validateDealerTableDefinition(definition);
  let pngAlpha;
  for (const format of ['png', 'webp']) {
    const source = definition.asset.sources[format];
    const bytes = await readFile(new URL(source.filename, assetDirectory));
    const metadata = await sharp(bytes).metadata();
    assert.equal(bytes.length, source.size);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256);
    assert.equal(metadata.format, format);
    assert.equal(source.contentType, `image/${format}`);
    assert.equal(metadata.width, definition.asset.width);
    assert.equal(metadata.height, definition.asset.height);
    assert.equal(metadata.hasAlpha, true);
    const alpha = await sharp(bytes).extractChannel('alpha').raw().toBuffer();
    assert.ok(alpha.filter(value => value === 0).length > alpha.length * .3);
    assert.ok(alpha.filter(value => value >= 250).length > alpha.length * .5);
    for (const name of ['alphaBounds', 'visibleBounds']) {
      assert.deepEqual(alphaBounds(alpha, metadata.width, metadata.height, definition.asset[name].threshold), definition.asset[name]);
    }
    if (format === 'png') pngAlpha = alpha;
    else assert.deepEqual(alpha, pngAlpha, 'WebP conversion must preserve the generated PNG alpha exactly');
    for (const { anchors } of Object.values(definition.layouts)) {
      for (const point of [anchors.dealer, ...anchors.seats.flatMap(seat => [seat.card, seat.bet])]) {
        assert.ok(alpha[Math.floor(point.y * metadata.height) * metadata.width + Math.floor(point.x * metadata.width)] >= 250,
          `Proposed anchor ${JSON.stringify(point)} must land on the table`);
      }
    }
  }
});

test('navy coordinates retain the actual image aspect and project both scene layouts', () => {
  for (const layout of ['desktop', 'mobile']) {
    const { scene, placement, anchors } = definition.layouts[layout];
    const geometry = getDealerTableGeometry(definition, layout);
    const width = placement.width * scene.width;
    const height = width * definition.asset.height / definition.asset.width;
    const x = (scene.width - width) / 2 + placement.x * scene.width;
    const y = placement.y * scene.height;
    assert.deepEqual(geometry.rect, [x, y, width, height]);
    close(geometry.cardWidth, width * anchors.cardWidth);
    const projected = [geometry.dealer, ...geometry.seats.flatMap(seat => [seat.card, seat.bet])];
    const local = [anchors.dealer, ...anchors.seats.flatMap(seat => [seat.card, seat.bet])];
    projected.forEach((point, index) => {
      close(point.x, x + local[index].x * width);
      close(point.y, y + local[index].y * height);
      assert.ok(point.x > 0 && point.x < scene.width && point.y > 0 && point.y < scene.height);
    });
    const bounds = definition.asset.visibleBounds;
    close(geometry.visibleRect[0], x + bounds.x / definition.asset.width * width);
    close(geometry.visibleRect[1], y + bounds.y / definition.asset.height * height);
    close(geometry.visibleRect[2], bounds.width / definition.asset.width * width);
    close(geometry.visibleRect[3], bounds.height / definition.asset.height * height);
    assert.ok(geometry.visibleRect[1] + geometry.visibleRect[3] < scene.height);
  }
});
