import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGameCards } from '../public/game-cards.js';

// A ready dealer's card layer (Emil 16 Oct: diagonal A + split D), on a minimal SVG tree.
class Node {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.style = {}; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  append(...nodes) { for (const n of nodes) this.insertBefore(n, null); }
  insertBefore(n, next) { if (n.parent) n.remove(); const i = next ? this.children.indexOf(next) : this.children.length; this.children.splice(i, 0, n); n.parent = this; }
  remove() { if (this.parent) { this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; } }
  replaceChildren(...nodes) { for (const n of [...this.children]) n.remove(); this.append(...nodes); }
  cloneNode(deep) { const n = new Node(this.tag); n.attrs = { ...this.attrs }; n.textContent = this.textContent; if (deep) n.append(...this.children.map(c => c.cloneNode(true))); return n; }
}
globalThis.document = { createElementNS: (_ns, tag) => new Node(tag) };
const all = n => [n, ...n.children.flatMap(all)];
const manifest = { ...JSON.parse(readFileSync(new URL('../public/media/manifest.json', import.meta.url))), kort_storlek: { bredd: 79, hojd: 106 } };
let draw = 1;
const c = s => ({ r: s.slice(0, -1), s: s.slice(-1), shoeDraw: draw++ });
const setup = () => { const svg = new Node('svg'); svg.id = 't'; return { svg, cards: createGameCards(svg, manifest, { fixed: true }) }; };
const at = (svg, d) => { const g = all(svg).find(n => n.attrs['data-draw'] === String(d)); const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(g.attrs.transform); return { x: +m[1], y: +m[2] }; };
const show = (cards, round) => cards.render(round, new Set([...round.dealer, ...round.hands.flatMap(h => h.cards)].map(x => x.shoeDraw)), true, null);

test('every split total has the size of an ordinary one, without a hand number in front', () => {
  draw = 1;
  const { svg, cards } = setup();
  const round = { phase: 'decisions', active: 2, dealer: [c('3♣')], hands: [{ box: 2, cards: [c('8♠'), c('3♥')] }, { box: 2, cards: [c('8♦'), c('2♣')] }, { box: 2, cards: [c('8♣'), c('10♥')] }, { box: 4, cards: [c('9♠'), c('9♥')] }] };
  show(cards, round);
  const pills = all(svg).find(n => n.attrs.class === 'card-totals').children.filter(n => n.tag === 'g' && n.attrs['data-hand'] !== undefined && n.attrs.class !== 'split-links');
  assert.equal(pills.length, 5);
  for (const p of pills) {
    assert.equal(p.children[0].attrs.height, '48');
    assert.equal(p.children[1].attrs['font-size'], '34');
    assert.doesNotMatch(p.children[1].textContent, /·/);
  }
  assert.ok(all(svg).some(n => n.attrs.class === 'split-link' && n.attrs.d.startsWith('M')), 'the totals are tied to their ring');
});

test("a split hand is a ladder: its newest card lies behind (drawn first), a single hand's newest on top", () => {
  draw = 1;
  const { svg, cards } = setup();
  const round = { phase: 'decisions', active: 0, dealer: [c('3♣')], hands: [{ box: 2, cards: [c('8♠'), c('3♥'), c('5♦')] }, { box: 2, cards: [c('8♦'), c('2♣')] }, { box: 5, cards: [c('2♠'), c('3♠'), c('4♠')] }] };
  show(cards, round);
  const layer = all(svg).find(n => n.attrs.class === 'card-layer').children.map(n => +n.attrs['data-draw']);
  assert.ok(layer.indexOf(4) < layer.indexOf(3) && layer.indexOf(3) < layer.indexOf(2), 'ladder: newest first');
  assert.ok(layer.indexOf(7) < layer.indexOf(8) && layer.indexOf(8) < layer.indexOf(9), 'diagonal: newest last');
  assert.ok(at(svg, 4).y < at(svg, 3).y && at(svg, 3).y < at(svg, 2).y, 'ladder climbs');
  assert.ok(at(svg, 9).x > at(svg, 7).x && at(svg, 9).y < at(svg, 7).y, 'diagonal: up and to the right');
});

test('while a fifth card is dealt the hand makes room in one gliding movement and rests where the layout says', () => {
  draw = 1;
  const { svg, cards } = setup();
  const hand = [c('A♠'), c('2♦'), c('5♦'), c('3♣')], fifth = c('2♠');
  // the server's round already holds the card being dealt; the table shows it once its face lands
  const round = { phase: 'decisions', active: 1, dealer: [c('3♣')], hands: [{ box: 1, cards: [c('10♣'), c('7♦')] }, { box: 2, cards: [...hand, fifth] }, { box: 3, cards: [c('9♠'), c('9♥')] }] };
  const shown = [...round.dealer, ...round.hands.flatMap(h => h.cards)].map(x => x.shoeDraw);
  cards.render(round, new Set(shown.filter(d => d !== fifth.shoeDraw)), true, null);
  const rest4 = hand.map(x => at(svg, x.shoeDraw));
  cards.beginDeal('3', fifth.shoeDraw);
  const track = [];
  for (let f = 0; f <= 72; f++) {
    if (f === 30) cards.render(round, new Set(shown), true, null);   // its face lands
    cards.advanceDeal(f / 24); track.push(hand.map(x => at(svg, x.shoeDraw)));
  }
  cards.endDeal();
  const rest5 = hand.map(x => at(svg, x.shoeDraw));
  assert.deepEqual(track[0], rest4, 'nothing moves before the card comes');
  assert.ok(rest5[0].x < rest4[0].x, 'the hand spreads over the whole width');
  for (let i = 1; i < track.length; i++) for (let k = 0; k < hand.length; k++)
    assert.ok(Math.hypot(track[i][k].x - track[i - 1][k].x, track[i][k].y - track[i - 1][k].y) < 6, `no jump at frame ${i}`);
  assert.deepEqual(track.at(-1), rest5, 'it ends exactly at rest');
});
