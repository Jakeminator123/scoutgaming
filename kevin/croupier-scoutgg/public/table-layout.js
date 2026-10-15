// Where every card of a ready dealer's table lies (Emil 16 Oct, "diagonal A + split D", reviewed as mockups drawn with
// this same arithmetic). Pure: no DOM, video pixels (the 1080 x 1920 plate), cards never scaled.
//  - Width by need: every occupied box asks for a preferred and a minimum width; the boxes are laid along the table, each
//    hand at most MAX_SHIFT from its own ring, so a box with small hands gives a neighbour the room it does not use.
//  - One hand = diagonal A: calm steps up to four cards, the whole width from the fifth, closer steps after that;
//    each card newer than the last lies up and to the right, on top.
//  - A split box = full-size ladders kept compact around its own ring (newest card BEHIND, a little higher); two rows,
//    the hand in play in front, only when even the minimum width is not there.
//  - Height: her hands and the shoe stand on the table edge, her own cards lie lower in the middle, elsewhere the felt
//    goes up to the rail (measured on the plate's rest frame).
//  - Her cards: the upcard steps aside for the hole card (Emil #7); later cards spread right only as far as no player
//    card lies in her row.

export const TABLE_LAYOUT = Object.freeze({
  gap: 6,                       // px between two boxes' areas
  maxShift: 36,                 // a hand stays over its own ring
  table: [20, 1060],
  zone: [459, 618], zoneLow: 956,                 // her first three cards (x 459-618, down to y 948): players keep below
  dealerTotal: [330, 466], dealerTotalLow: 921,   // her total, left of her cards (it grows leftwards with a soft total)
  hands: [365, 705], shoe: [740, 910], edgeTop: 862,
  rail: 778,
  strip: 24,                    // a visible strip that holds an index
  minStep: 18,
  colMin: 42,                   // ladders side by side: "10♥" in the top corner needs 41 px
  splitGap: { 2: 82, more: 48 },
  pill: { h: 48, dy: 60, splitDy: 72 },   // a hand's total: height, its centre below the first card's; a split box's row
});
const L = TABLE_LAYOUT;

const overlaps = (a, b, x, w, tol = 0) => a + tol < x + w / 2 && x - w / 2 < b - tol;
/** The highest a card's top edge may reach with its centre at x. */
export function topLimit(x, w) {
  let top = L.rail;
  if (overlaps(...L.hands, x, w) || overlaps(...L.shoe, x, w)) top = L.edgeTop;
  if (overlaps(...L.dealerTotal, x, w)) top = Math.max(top, L.dealerTotalLow);
  if (overlaps(...L.zone, x, w)) top = Math.max(top, L.zoneLow);
  return top;
}

/** The ladders' spacing a split box needs for its totals (pill widths left to right): every other total sits on the same
 *  line, so two totals two hands apart must not meet. */
export function totalsGap(widths = []) {
  let g = 0;
  for (let i = 0; i + 2 < widths.length; i++) g = Math.max(g, (3 + (widths[i] + widths[i + 2]) / 2) / 2);
  return g;
}
const splitGap = (m, widths) => Math.max(m === 2 ? L.splitGap[2] : L.splitGap.more, totalsGap(widths));

/** (preferred, minimum) width of a box's cards. boxHands: [count, …] left to right. */
export function need(counts, w, twoRows = false, widths) {
  if (counts.length === 1) {
    const n = counts[0];
    return [w + (n <= 4 ? 18 : 24) * (n - 1), w + 10 * (n - 1)];
  }
  const m = counts.length;
  if (twoRows && m >= 3) return [w + (w + 8), w + L.colMin];
  return [w + splitGap(m, widths) * (m - 1), w + L.colMin * (m - 1)];   // the totals' spacing is wished for, not required
}

/** {seat: [lo, hi]} card-edge range per occupied box, and whether split boxes go to two rows. */
export function pack(boxes, anchors, w, widths = {}) {
  const ks = Object.keys(boxes).sort((a, b) => anchors[a].cx - anchors[b].cx);
  for (const twoRows of [false, true]) {
    const needs = ks.map(k => need(boxes[k], w, twoRows, widths[k]));
    const place = t => {
      const width = needs.map(([pf, mn]) => mn + t * (pf - mn)), cx = ks.map(k => anchors[k].cx);
      const lo = [], hi = [];
      for (let i = 0; i < ks.length; i++)
        lo[i] = Math.max(cx[i] - L.maxShift, L.table[0] + width[i] / 2, i ? lo[i - 1] + width[i - 1] / 2 + L.gap + width[i] / 2 : -Infinity);
      for (let i = ks.length - 1; i >= 0; i--)
        hi[i] = Math.min(cx[i] + L.maxShift, L.table[1] - width[i] / 2, i < ks.length - 1 ? hi[i + 1] - width[i + 1] / 2 - L.gap - width[i] / 2 : Infinity);
      if (ks.some((_, i) => lo[i] > hi[i] + 1e-6)) return null;
      const at = [];
      for (let i = 0; i < ks.length; i++) {
        const min = Math.max(lo[i], i ? at[i - 1] + width[i - 1] / 2 + L.gap + width[i] / 2 : -Infinity);
        at.push(Math.min(Math.max(cx[i], min), hi[i]));
      }
      return Object.fromEntries(ks.map((k, i) => [k, [at[i] - width[i] / 2, at[i] + width[i] / 2]]));
    };
    if (!place(0)) continue;
    if (place(1)) return { areas: place(1), twoRows };
    let a = 0, b = 1;
    for (let i = 0; i < 30; i++) { const mid = (a + b) / 2; if (place(mid)) a = mid; else b = mid; }
    return { areas: place(a), twoRows };
  }
  // Nothing fits even at the minimum (every box full of long hands and a split): each box keeps its own lane.
  const areas = {};
  for (const k of ks) areas[k] = [anchors[k].cx - 71 + L.gap / 2, anchors[k].cx + 71 - L.gap / 2];
  return { areas, twoRows: true };
}

/** Diagonal A: offsets from the box's anchor for n cards in area [lo, hi]. */
export function diagonal(anchor, n, area, [w, h]) {
  const lo = area[0] + w / 2 - anchor.cx, hi = area[1] - w / 2 - anchor.cx;      // where a card centre may go
  if (n <= 1) return [{ x: Math.min(Math.max(0, lo), Math.max(lo, hi)), y: 0 }];
  const span = Math.max(0, hi - lo);
  let sx, sy;
  if (n <= 4) { sx = Math.min(18, span / (n - 1)); sy = 28; }
  else { sx = Math.min(24, span / (n - 1)); sy = 34; }
  const x0 = Math.min(Math.max(-sx * (n - 1) / 2, lo), hi - sx * (n - 1));
  const xs = Array.from({ length: n }, (_, i) => x0 + sx * i);
  for (let i = 1; i < n; i++) sy = Math.min(sy, (anchor.cy - h / 2 - topLimit(anchor.cx + xs[i], w)) / i);
  sy = Math.max(sy, L.minStep);
  return xs.map((x, i) => ({ x, y: -sy * i }));
}

/** Split ladders: per hand {x (offset), y (offset of its first card), step, row}. */
export function ladders(anchor, counts, area, [w, h], active, twoRows, widths) {
  const lo = area[0] + w / 2 - anchor.cx, hi = area[1] - w / 2 - anchor.cx, m = counts.length;
  const step = (n, x, base = 0) => n <= 1 ? 26 : Math.max(L.minStep, Math.min(26, (anchor.cy + base - h / 2 - topLimit(anchor.cx + x, w)) / (n - 1)));
  const oneRow = () => {
    const g = Math.min(splitGap(m, widths), (hi - lo) / (m - 1));
    const x0 = Math.min(Math.max(-g * (m - 1) / 2, lo), hi - g * (m - 1));
    return counts.map((n, j) => { const x = x0 + g * j; return { x, y: 0, step: step(n, x), row: 0 }; });
  };
  let gap = Math.min(splitGap(m, widths), (hi - lo) / (m - 1));
  if (!twoRows || m <= 2 || gap >= L.colMin) return oneRow();
  let [front, back] = [[0, 1], counts.map((_, j) => j).slice(2)];
  if (active != null && active >= 2) [front, back] = [back, front];             // the hand in play stands in front
  gap = Math.min(w + 8, hi - lo);
  const x0 = Math.min(Math.max(-gap / 2, lo), hi - gap), xs = {};
  front.forEach((j, c) => { xs[j] = x0 + gap * c; }); back.forEach((j, c) => { xs[j] = x0 + gap * c; });
  const nf = Math.max(...front.map(j => counts[j])), nb = Math.max(...back.map(j => counts[j]));
  const room = Math.min(...Object.values(xs).map(x => anchor.cy - h / 2 - topLimit(anchor.cx + x, w)));
  const s = Math.min(26, (room - L.strip - 4) / Math.max(1, nf - 1 + nb - 1));
  if (s < 14) return oneRow();          // no height for a second row (under her cards): one row, closer together
  const backY = -s * (nf - 1) - L.strip - 4;
  return counts.map((_, j) => ({ x: xs[j], y: front.includes(j) ? 0 : backY, step: s, row: front.includes(j) ? 0 : 1 }));
}

/**
 * The whole players' side. boxes: {seat: [count, …]} (a seat's hands left to right; empty hands left out),
 * anchors: {seat: {cx, cy}}, active: {seat: hand index in play}, widths: {seat: [a split hand's total pill width, …]}.
 * -> {seat: [{cards: [{x, y}] offsets from the anchor, ladder: bool, row}]}
 */
export function layoutPlayers(boxes, anchors, size, active = {}, widths = {}) {
  const occupied = Object.fromEntries(Object.entries(boxes).filter(([, c]) => c.length && c.some(n => n > 0)));
  const { areas, twoRows } = pack(occupied, anchors, size[0], widths);
  const out = {};
  for (const [k, counts] of Object.entries(occupied)) {
    const anchor = anchors[k];
    if (counts.length === 1) { out[k] = [{ cards: diagonal(anchor, counts[0], areas[k], size), ladder: false, row: 0 }]; continue; }
    out[k] = ladders(anchor, counts, areas[k], size, active[k], twoRows, widths[k]).map((l, j) => ({
      ladder: true, row: l.row, cards: Array.from({ length: counts[j] }, (_, i) => ({ x: l.x, y: l.y - l.step * i })),
    }));
  }
  return out;
}

const DEALER_STEP_X = [40, 30, 24, 18, 14, 10];
/** Her cards: offsets from her landing spot; the row ends before the first player card that lies in it (rects: absolute
 *  card rectangles [left, right, top] of the players' cards). */
export function dealerRow(n, anchor, [w, h], rects = []) {
  if (n <= 1) return [{ x: 0, y: 0 }];
  const natural = [-DEALER_STEP_X[0], 0];
  for (let i = 2, x = 0; i < n; i++) natural.push(x += DEALER_STEP_X[Math.min(i - 2, DEALER_STEP_X.length - 1)]);
  const bottom = anchor.cy + h / 2, right = anchor.cx + natural.at(-1) + w / 2;
  let limit = right;
  for (const [l, r, t] of rects) if (t < bottom && r > anchor.cx + w / 2 && l - 2 < limit) limit = l - 2;
  limit = Math.max(limit, anchor.cx + w / 2 + 20 * (n - 2));       // never closer than 20 px a card: her index still shows
  const f = natural.at(-1) > 0 && limit < right ? (limit - w / 2 - anchor.cx) / natural.at(-1) : 1;
  return natural.map((x, i) => ({ x: i >= 2 ? x * f : x, y: 0 }));
}

/** Split totals at full size: on one line under the hands, a total that would meet its neighbour lifted onto its own
 *  cards' bottom edge (staggered), lowest first. pills: [{x, w}] left to right; taken: pills already placed [{x, y, w}].
 *  -> [y] per pill. Two pills meet where their rounded shapes do: their straight middles closer than one pill height. */
export function placeTotals(pills, baseY, taken = []) {
  const r = L.pill.h / 2, placed = [...taken], ys = [];
  // how far two pills' outlines are apart (negative: they overlap)
  const apart = (x, w, y) => Math.min(Infinity, ...placed.map(p => (Math.max(0, Math.abs(x - p.x) - (w / 2 - r) - (p.w / 2 - r)) ** 2 + (y - p.y) ** 2) ** .5 - L.pill.h));
  for (const { x, w } of pills) {
    // the lowest place that touches nothing; on a crowded split (four hands with soft totals) up over the cards, and if
    // even that is taken, the place where it overlaps least
    let best = baseY, room = -Infinity;
    for (let dy = 0; dy <= 160; dy += 2) {
      const gap = apart(x, w, baseY - dy);
      if (gap >= 3) { best = baseY - dy; break; }
      if (gap > room) { room = gap; best = baseY - dy; }
    }
    placed.push({ x, y: best, w }); ys.push(best);
  }
  return ys;
}
