import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TABLE_LAYOUT as L, diagonal, layoutPlayers, pack, placeTotals, dealerRow, topLimit } from '../public/table-layout.js';

// Emil 16 Oct: a ready dealer's table is "diagonal A + split D": the width of the table shared by need, the cards never
// scaled, split hands as compact full-size ladders, every total at full size (reviewed as mockups drawn with this code).
const manifest = JSON.parse(readFileSync(new URL('../public/media/manifest.json', import.meta.url)));
const anchors = Object.fromEntries(manifest.deal.filter(d => /pos\d/.test(d.id)).map(d => [d.id.replace('deal_pos', ''), { cx: d.kort.cx, cy: d.kort.cy }]));
const size = [79, 106], [W, H] = size;
const rects = (boxes, lay = layoutPlayers(boxes, anchors, size)) => Object.entries(lay).flatMap(([k, hs]) =>
  hs.flatMap(h => h.cards.map(c => ({ k, l: anchors[k].cx + c.x - W / 2, r: anchors[k].cx + c.x + W / 2, t: anchors[k].cy + c.y - H / 2, x: anchors[k].cx + c.x }))));

// the reviewed examples (box 1 is the leftmost on the video, x 110)
const FULL = { 1: [6], 2: [7], 3: [5], 4: [7], 5: [6], 6: [2], 7: [9] };
const WORST = { 1: [5], 2: [5], 3: [6], 4: [4, 3, 4, 3], 5: [6], 6: [5], 7: [6] };
const SPLIT4_ROOM = { 2: [3, 3, 2, 4], 4: [2], 6: [3] };
const SPLIT4_TIGHT = { 3: [2], 4: [2], 5: [3, 3, 2, 4], 6: [3], 7: [2] };

test('no hand ever reaches into another box: the areas never overlap, and every card stays inside its own', () => {
  for (const boxes of [FULL, WORST, SPLIT4_ROOM, SPLIT4_TIGHT, { 3: [9], 4: [9], 5: [9] }]) {
    const { areas } = pack(boxes, anchors, W);
    const ks = Object.keys(areas).sort((a, b) => anchors[a].cx - anchors[b].cx);
    for (let i = 1; i < ks.length; i++) assert.ok(areas[ks[i]][0] >= areas[ks[i - 1]][1] + L.gap - 1e-6, `${ks[i - 1]}|${ks[i]}`);
    for (const c of rects(boxes)) assert.ok(c.l >= areas[c.k][0] - 1e-6 && c.r <= areas[c.k][1] + 1e-6, `box ${c.k} card at ${c.x}`);
    for (const k of ks) assert.ok(Math.abs((areas[k][0] + areas[k][1]) / 2 - anchors[k].cx) <= L.maxShift + 1e-6, `box ${k} stays over its ring`);
  }
});

test('no card climbs into her hands, the shoe or her own cards', () => {
  // measured on the rest frame: her two first cards reach y 948 (x 459-618), her hands and the shoe stand down to y 856
  for (const boxes of [FULL, WORST, { 3: [8], 4: [7], 5: [8] }, { 4: [4, 4, 4, 4] }, { 4: [5, 5] }]) for (const c of rects(boxes)) {
    if (c.l < 618 && c.r > 459) assert.ok(c.t >= 948, `box ${c.k} card top ${c.t} under her cards`);
    if (c.l < 705 && c.r > 365 || c.l < 910 && c.r > 740) assert.ok(c.t >= 856, `box ${c.k} card top ${c.t} under her hands`);
  }
});

test('one hand: calm steps up to four cards, the whole width from the fifth, newer cards up and to the right', () => {
  const a = anchors['3'], area = [a.cx - 72, a.cx + 72];
  const four = diagonal(a, 4, area, size);
  assert.deepEqual(four.map(c => c.x), [-27, -9, 9, 27]);   // 18 px apart, centred on the ring
  assert.ok(four.every((c, i) => i === 0 || c.y < four[i - 1].y));
  const five = diagonal(a, 5, area, size);
  assert.ok(Math.abs(a.cx + five[0].x - W / 2 - area[0]) < 1e-6 && Math.abs(a.cx + five[4].x + W / 2 - area[1]) < 1e-6, 'five cards fill the width');
  for (let n = 5; n <= 9; n++) {
    const cards = diagonal(a, n, area, size);
    for (let i = 1; i < n; i++) assert.ok(cards[i - 1].y - cards[i].y >= L.minStep - 1e-6, 'every older card keeps its bottom index');
  }
});

test('split: compact around its own ring even with room to spare, and full-size ladders in one row when the table is full', () => {
  const room = layoutPlayers(SPLIT4_ROOM, anchors, size)['2'];
  const xs = room.map(h => h.cards[0].x);
  assert.deepEqual(xs.map((x, i) => i ? Math.round(x - xs[i - 1]) : 0).slice(1), [48, 48, 48]);
  assert.ok(Math.abs((xs[0] + xs[3]) / 2) < 1e-6, 'centred on the ring');
  const two = layoutPlayers({ 4: [3, 4], 3: [2], 5: [2] }, anchors, size)['4'];
  assert.equal(Math.round(two[1].cards[0].x - two[0].cards[0].x), 82);
  for (const boxes of [SPLIT4_TIGHT, WORST]) {
    const k = Object.keys(boxes).find(k => boxes[k].length > 1), hs = layoutPlayers(boxes, anchors, size)[k];
    assert.ok(hs.every(h => h.row === 0 && h.ladder));
    hs.forEach((h, j) => j && assert.ok(h.cards[0].x - hs[j - 1].cards[0].x >= L.colMin - 1e-6, 'every top index shows'));
    for (const h of hs) for (let i = 1; i < h.cards.length; i++) assert.ok(h.cards[i].y < h.cards[i - 1].y, 'a newer card lies higher (behind)');
  }
});

test('split totals at full size never meet: lifted onto the cards bottom edge, staggered, only as high as needed', () => {
  const base = 1186;
  for (const [gap, widths] of [[48, [61, 61, 61, 61]], [82, [61, 61]], [48, [102, 61, 102, 61]]]) {
    const pills = widths.map((w, i) => ({ x: 500 + gap * i, w }));
    const ys = placeTotals(pills, base);
    for (let i = 0; i < pills.length; i++) for (let j = 0; j < i; j++) {
      const gx = Math.max(0, Math.abs(pills[i].x - pills[j].x) - (pills[i].w / 2 - 24) - (pills[j].w / 2 - 24));
      assert.ok(Math.hypot(gx, ys[i] - ys[j]) >= L.pill.h, `${widths} ${i}/${j}`);
    }
    if (widths.every(w => w === 61)) assert.ok(ys.every(y => base - y <= 40), 'two-digit totals lift no higher than the cards bottom edge');
  }
  assert.deepEqual(placeTotals([{ x: 500, w: 61 }, { x: 582, w: 61 }], base), [base, base]);   // two hands: side by side
});

test("her cards: the upcard steps aside for the hole card, later cards spread right but end before a player's card in her row", () => {
  const a = { cx: 540, cy: 895 };
  assert.deepEqual(dealerRow(1, a, size), [{ x: 0, y: 0 }]);
  assert.deepEqual(dealerRow(2, a, size).map(c => c.x), [-40, 0]);
  const free = dealerRow(6, a, size).map(c => c.x);
  assert.deepEqual(free, [-40, 0, 40, 70, 94, 112]);
  const blocked = dealerRow(6, a, size, [[690, 769, 900]]);
  assert.ok(a.cx + blocked.at(-1).x + W / 2 <= 688 + 1e-6);
  assert.deepEqual(blocked.slice(0, 2).map(c => c.x), [-40, 0]);
  assert.ok(topLimit(400, W) >= L.dealerTotalLow, 'players keep below her total');
});
