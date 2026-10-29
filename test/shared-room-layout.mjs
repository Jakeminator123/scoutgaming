// Shared table layout rules (K04 F12-F16, K06 O1): where seats stand, which own seat carries the full bet row,
// one decision panel, the stake profile in the heading and the connection sign. The browser layout is proven
// separately in test/shared-room-layout-browser.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { calibration } from '../packages/presentation/contracts/calibration.mjs';
import { ROOM_LIMIT_PRESETS } from '../packages/presentation/contracts/room-game-config.mjs';
import { PAOW_KEVIN_PROFILE as paow } from '../packages/presentation/contracts/filmed-profiles/kevin-paow-c7138759.mjs';
import { crowding, fallbackSeatLayout, primarySeat, seatWindow, tableProfileName, windowLabel } from '../services/game/public/shared-room-layout.mjs';
import { mountSharedRoomPresentation } from '../services/game/public/shared-room-presentation.mjs';
import { createSharedRoomView } from '../services/game/public/shared-room-view.mjs';
import { createSharedRoomController } from '../services/game/public/shared-room-controller.mjs';

const roomId = 'room-a', actor = 'alice';
class Element extends EventTarget {
  constructor(tag = 'div') { super(); this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.attributes = {}; this.hidden = false; this.disabled = false; this.className = ''; this._text = '';
    const styles = new Map(); this.style = { setProperty: (key, value) => styles.set(key, String(value)), getPropertyValue: key => styles.get(key) ?? '', removeProperty: key => styles.delete(key) };
    this.classes = new Set(); this.classList = { add: name => this.classes.add(name), toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name) }; }
  set textContent(value) { this._text = String(value); this.children = []; } get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  setAttribute(name, value) { this.attributes[name] = String(value); } getAttribute(name) { return this.attributes[name] ?? null; } removeAttribute(name) { delete this.attributes[name]; }
  append(...children) { for (const child of children) { child.parentNode?.children && (child.parentNode.children = child.parentNode.children.filter(node => node !== child)); child.parentNode = this; } this.children.push(...children); }
  prepend(...children) { for (const child of children) child.parentNode = this; this.children.unshift(...children); }
  replaceChildren(...children) { this._text = ''; this.children = children; } remove() { this.removed = true; }
  closest(selector) { for (let node = this; node; node = node.parentNode) if (selector === '#' + node.id) return node; return null; }
  click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
}
function snapshot(extra = {}) {
  return { contract: 'blackjack-table/1', roomId, version: 1, presentationVer: 0, configVersion: 'cfg-1', windowId: 'window-1', phase: 'bets', roundId: null, turnSeq: 0,
    owners: Array(7).fill(null), seatGen: Array(7).fill(0), bets: Array.from({ length: 7 }, () => ({ main: 0, pp: 0, tp: 0 })), players: [], deadline: null, actionDeadline: null,
    plan: null, round: null, serverNow: 1000,
    settings: { configVersion: 'cfg-1', language: 'sv', betMs: 20000, actionMs: 15000, limits: { min: 5, max: 2000, sideMax: 200 }, chips: [5, 10, 25, 50, 100, 500], refill: 1000 },
    me: { id: actor, seats: [], memberGen: 0, active: false, available: 1000, pausedUntil: 0, insuranceDue: false, lastSettlement: null }, ...extra };
}
const seatedAt = (seats, extra = {}) => snapshot({ owners: Array.from({ length: 7 }, (_, i) => seats.includes(i) ? actor : null),
  players: [{ id: actor, seats, ready: false, leaving: false }], me: { ...snapshot().me, seats, memberGen: 1, active: true }, ...extra });
const everything = { join: true, leave: true, bet: true, undo: true, clear: true, doubleBets: true, allSeats: true, repeat: true, ready: true, insurance: false, next: true, refill: true, pause: true, act: [] };

test('a seat window shows three boxes around the active hand, the chosen seat or the first own seat', () => {
  assert.deepEqual(seatWindow(seatedAt([6]), null).boxes, [4, 5, 6]);
  assert.deepEqual(seatWindow(seatedAt([0, 6]), 0).boxes, [0, 1, 2]);
  assert.deepEqual(seatWindow(seatedAt([0, 6], { round: { active: 0, hands: [{ box: 3 }] } }), 0).boxes, [2, 3, 4], 'the active hand wins');
  assert.deepEqual(seatWindow(snapshot(), null).boxes, [2, 3, 4]);
  assert.equal(windowLabel(2), 'Visa platser 3–5');
  assert.equal(primarySeat(seatedAt([1, 5]), 5), 5);
  assert.equal(primarySeat(seatedAt([1, 5]), 3, [2, 3, 4, 5]), 5, 'the first own seat on screen when the chosen seat is not own');
  assert.equal(primarySeat(snapshot(), 2), null);
});

// K04 F14: with seven own seats at 1440 px, neighbouring bet rows caught each other's clicks.
test('own seats closer than one bet row are crowded and keep their main bet inside the gap', () => {
  const far = crowding([[0, 100], [6, 900]]), near = crowding([[2, 400], [3, 467], [4, 534]]);
  assert.deepEqual([far.get(0).crowded, far.get(6).crowded], [false, false]);
  for (const box of [2, 3, 4]) { assert.equal(near.get(box).crowded, true); assert.ok(near.get(box).betWidth <= 67 - 4 && near.get(box).betWidth >= 44); }
  assert.equal(crowding([[3, 500]]).get(3).crowded, false, 'one own seat is never crowded');
});

// K04 F16: seats follow the room dealer's filmed landings; a dealer without a profile keeps the calibrated row.
test('without a composition plane the seats stand below the filmed landings of the room dealer, else on the calibrated row', () => {
  const moved = { ...paow, positions: Object.fromEntries(Object.entries(paow.positions).map(([id, p]) => [id, { cx: p.cx * .8 + 108, cy: p.cy }])) };
  const width = 1440, height = 900, scale = height / 1920, x = (width - 1080 * scale) / 2;
  const filmed = fallbackSeatLayout({ width, height, boxes: [0, 1, 2, 3, 4, 5, 6], filmedProfile: moved });
  const row = fallbackSeatLayout({ width, height, boxes: [0, 1, 2, 3, 4, 5, 6] });
  assert.equal(filmed.source, 'filmed-profile'); assert.equal(row.source, 'calibration');
  for (const seat of filmed.seats) {
    const landing = moved.positions[String(seat.box + 1)];
    assert.ok(Math.abs(seat.x - (x + landing.cx * scale)) < 1e-9, 'x is the filmed landing');
    assert.ok(seat.y > landing.cy * scale + calibration.height / 2 * scale, 'the circle sits below the landed card');
  }
  for (const seat of row.seats) assert.ok(Math.abs(seat.x - (x + calibration.positions[String(seat.box + 1)].cx * scale)) < 1e-9);
  assert.deepEqual(filmed.positions, moved.positions, 'the cards land where the seats stand');
  // A phone spreads its three boxes over the width and moves their cards with them.
  const phone = fallbackSeatLayout({ width: 320, height: 568, boxes: [2, 3, 4], filmedProfile: paow, compact: true });
  assert.ok(phone.seats[1].x - phone.seats[0].x >= 88 && phone.seats[2].x - phone.seats[1].x >= 88);
  assert.deepEqual(Object.keys(phone.offsets), ['3', '4', '5']); assert.equal(phone.adjusted, true);
});

function presentationDocument({ width = 1440, height = 900 } = {}) {
  const nodes = new Map(['scene', 'table2d'].map(id => [id, new Element()]));
  for (const node of nodes.values()) node.getBoundingClientRect = () => ({ left: 0, top: 0, width, height, right: width, bottom: height });
  const document = { documentElement: new Element('html'), getElementById: id => nodes.get(id), createElement: tag => new Element(tag), querySelector: () => null };
  const window = new EventTarget(); window.matchMedia = () => ({ matches: width <= 860 });
  return { document, window, nodes };
}
async function mountLayout(dealer, composition = null, size) {
  const { document, window } = presentationDocument(size);
  let projection;
  const cards = { restore() {}, sync() {}, clear() {}, show() {}, reveal() {}, close() {}, setProjection: value => { projection = value; } };
  const selection = { presentation: 'local', dealer, localDealer: dealer, operator: 'north', roomId, packageRevision: 1, registeredDealers: [{ id: dealer, label: dealer }] };
  const port = await mountSharedRoomPresentation({ document, window, selection, onReady() {}, onError() {}, createComposition: () => composition,
    loadAdapters: async () => [{ PerformancePlayer: class { dispose() {} } }, { createLocalPresentation: async () => ({ state() {}, start() {}, close() {} }) }, { createLocalCardOverlay: () => cards }] });
  const seats = Array.from({ length: 7 }, () => new Element());
  port.layout({ snapshot: seatedAt([3]), focusSeat: null, seats });
  return { port, seats, projection: () => projection };
}
const tableGeometry = auto => ({ tableId: 'table-a', mobile: { cardWidth: .045, dealer: { x: .5, y: .2 }, seats: Array.from({ length: 3 }, (_, i) => ({ card: { x: .3 + .2 * i, y: .3 }, bet: { x: .3 + .2 * i, y: .45 } })), ...auto },
  desktop: { cardWidth: .045, dealer: { x: .5, y: .2 }, seats: Array.from({ length: 7 }, (_, i) => ({ card: { x: .22 + .093 * i, y: .3 }, bet: { x: .22 + .093 * i, y: .45 } })), ...auto } });
const plane = auto => ({ referencePlane: () => ({ tableGeometry: tableGeometry(auto), rect: { x: 0, y: 450, width: 1440, height: 450 }, dealerPlane: { x: 420, y: -40, scale: .55 } }),
  onGeometryChange: () => () => {}, setBackground() {}, setTable() {}, close() {} });

test('desktop seats stand on the filmed landings of an automatic table, on Admin\'s drawn boxes of a manual one, else the profile or row', async () => {
  // Automatic landing and chips: the dealer plane carries the film's landing to each seat.
  const automatic = await mountLayout('paow', plane({ autoScale: { landing: true, cardSize: true, chips: true } }));
  for (const [box, node] of automatic.seats.entries())
    assert.equal(Number.parseFloat(node.style.left), 420 + paow.positions[String(box + 1)].cx * .55, `seat ${box + 1} on its filmed landing`);
  automatic.port.close();
  // Manual geometry: Admin placed the bets on the table art's drawn boxes.
  const manual = await mountLayout('paow', plane({}));
  for (const [box, node] of manual.seats.entries()) assert.ok(Math.abs(Number.parseFloat(node.style.left) - (.22 + .093 * box) * 1440) < 1e-6, `seat ${box + 1} on its drawn box`);
  manual.port.close();
  // No plane: the registered profile, else the calibrated row.
  const filmed = await mountLayout('paow'), row = await mountLayout('astrid');
  assert.equal(filmed.projection().source, 'filmed-profile'); assert.equal(row.projection().source, 'calibration');
  assert.equal(filmed.seats.filter(node => node.hidden).length, 0, 'a wide screen shows all seven seats');
  filmed.port.close(); row.port.close();
  const phone = await mountLayout('paow', null, { width: 390, height: 844 });
  assert.deepEqual(phone.seats.map(node => node.hidden), [true, true, false, false, false, true, true], 'a phone shows three boxes');
  phone.port.close();
});

function viewDocument() {
  const ids = ['scene', 'seats', 'chips', 'balance', 'total-bet', 'last-win', 'banner', 'deal-now', 'insurance', 'ins-yes', 'ins-no', 'actions', 'actions-top', 'hud-bottom', 'top-right', 'table-profile', 'limits', 'sound-btn', 'pitboss'];
  const nodes = new Map(ids.map(id => { const node = new Element(); node.id = id; return [id, node]; }));
  const act = parent => ['hit', 'stand', 'double', 'split'].map(action => { const node = new Element('button'); node.dataset.act = action; parent.append(node); return node; });
  const top = act(nodes.get('actions-top')), mini = act(nodes.get('actions'));
  const document = { getElementById: id => nodes.get(id), createElement: tag => new Element(tag), querySelector: () => null, querySelectorAll: selector => selector === '[data-act]' ? [...top, ...mini] : [] };
  return { document, nodes, top, mini };
}

// K04 F15: the native mini bar (#actions), placed by app.mjs on the native table only, showed beside the main panel.
test('a shared table has one decision panel: the native mini bar stays hidden, inert and without listeners', () => {
  const { document, nodes, top, mini } = viewDocument(), calls = [];
  const view = createSharedRoomView({ document }); view.bind({ dispatch: (...args) => calls.push(args) });
  const s = seatedAt([3], { phase: 'round', roundId: 'r1', round: { phase: 'decisions', active: 0, hands: [{ box: 3, cards: [] }], dealer: [] } });
  view.render({ snapshot: s, can: { ...everything, act: ['hit', 'stand'] }, notice: '', connected: true });
  const native = nodes.get('actions');
  assert.equal(native.hidden, true); assert.equal(native.inert, true); assert.equal(native.style.display, 'none');
  assert.equal(nodes.get('actions-top').hidden, false);
  for (const node of mini) { node.disabled = false; node.click(); }
  assert.deepEqual(calls, [], 'the mini bar dispatches nothing');
  top[0].click(); assert.deepEqual(calls, [['act', { action: 'hit' }]]);
  assert.equal(top[2].disabled, true, 'double is not legal here');
  // The panel, the status line and Redo sit in one action zone of the bottom controls.
  const zone = nodes.get('hud-bottom').children.find(node => node.id === 'shared-room-actions');
  assert.ok(zone); for (const id of ['banner', 'deal-now', 'insurance', 'actions-top']) assert.equal(nodes.get(id).parentNode, zone, id);
  view.close();
});

test('the seat controls are labelled for a phone, Lämna platser shows only when seated, and the heading names the stake profile', () => {
  const { document, nodes } = viewDocument(), calls = [];
  const view = createSharedRoomView({ document }); view.bind({ dispatch: (...args) => calls.push(args), focusSeat: seat => calls.push(['focus', seat]) });
  const controls = nodes.get('top-right').children.find(node => node.id === 'shared-room-controls');
  const [picker, windows] = controls.children.filter(node => node.tagName === 'SELECT');
  const leave = controls.children.find(node => node.textContent === 'Lämna platser');
  assert.deepEqual(windows.children.map(option => option.textContent), ['Visa platser 1–3', 'Visa platser 2–4', 'Visa platser 3–5', 'Visa platser 4–6', 'Visa platser 5–7']);
  assert.equal(windows.attributes['aria-label'], 'Visa platser på bordet');
  assert.equal(nodes.get('table-profile').textContent, 'Blackjack', 'no stake profile is named before the first snapshot');
  view.render({ snapshot: snapshot(), can: everything, notice: '', connected: true });
  assert.equal(leave.hidden, true, 'nothing to leave');
  assert.equal(windows.value, '2');
  view.render({ snapshot: seatedAt([6], { settings: { ...snapshot().settings, ...ROOM_LIMIT_PRESETS.casual, limits: { min: 1, max: 500, sideMax: 50 }, chips: [...ROOM_LIMIT_PRESETS.casual.chips] } }),
    can: everything, notice: '', connected: true });
  assert.equal(leave.hidden, false); assert.equal(windows.value, '4');
  assert.equal(nodes.get('table-profile').textContent, 'Casual Blackjack');
  windows.value = '0'; windows.dispatchEvent(new Event('change')); assert.deepEqual(calls.at(-1), ['focus', 1]);
  picker.value = '2'; picker.dispatchEvent(new Event('change')); assert.deepEqual(calls.at(-1), ['join', { seat: 2 }]);
  assert.equal(controls.children.includes(nodes.get('sound-btn')), true, 'the sound button wraps with the seat controls');
  view.close();
  assert.equal(tableProfileName(snapshot().settings), 'Privé Blackjack');
  assert.equal(tableProfileName({ limits: { ...ROOM_LIMIT_PRESETS.high }, chips: [...ROOM_LIMIT_PRESETS.high.chips], refill: ROOM_LIMIT_PRESETS.high.refill }), 'High Blackjack');
  assert.equal(tableProfileName({ ...snapshot().settings, refill: 7 }), 'Blackjack', 'an unknown profile is not named');
  assert.equal(tableProfileName({ ...snapshot().settings, limitPreset: 'casual' }), 'Casual Blackjack', 'a named preset wins over the values');
  assert.equal(tableProfileName({ ...snapshot().settings, limitPreset: 'constructor' }), 'Privé Blackjack', 'an unknown name falls back to the values');
});

test('several own seats: the chosen one shows its side bets and Lämna, another own circle chooses without a server write', () => {
  const { document, nodes } = viewDocument(), calls = [];
  const view = createSharedRoomView({ document }); view.bind({ dispatch: (...args) => calls.push(args), focusSeat: seat => calls.push(['focus', seat]) });
  view.render({ snapshot: seatedAt([2, 3]), focusSeat: null, can: everything, notice: '', connected: true });
  const [two, three] = [2, 3].map(i => nodes.get('seats').children[i].children[0].children[0]);
  // The chosen circle stays focusable: aria-disabled, never disabled, so choosing a seat keeps the focus on it.
  assert.deepEqual([two.disabled, two.attributes['aria-disabled'], two.attributes['aria-pressed']], [false, 'true', 'true'], 'the first own seat is the chosen one');
  assert.deepEqual([three.disabled, three.attributes['aria-disabled']], [false, 'false']);
  three.click(); assert.deepEqual(calls, [['focus', 3]]);
  view.render({ snapshot: seatedAt([2, 3], { phase: 'round', roundId: 'r1' }), focusSeat: 3, can: { ...everything, bet: false, join: false }, notice: '', connected: true });
  const own = nodes.get('seats').children[3].children[0], [pp, main, tp] = own.children[1].children;
  assert.deepEqual([pp.hidden, main.hidden, tp.hidden, own.children[2].hidden], [true, false, true, true], 'a round keeps the main stake only');
  view.close();
});

test('a lost socket shows a reconnecting sign until the next state; a spent budget shows Återanslut', async t => {
  const renders = [], view = { bind() {}, render: value => renders.push(value), close() {} };
  const controller = createSharedRoomController({ roomId, view, commands: { state: 'idle', stop() {} },
    presentation: { restoreSnapshot() {}, present() {}, close() {} }, reconnect: () => {} });
  t.after(() => controller.stop());
  const first = new AbortController();
  await controller.restoreSnapshot(seatedAt([0]), { signal: first.signal });
  assert.equal(renders.at(-1).reconnecting, false);
  first.abort(); assert.equal(renders.at(-1).reconnecting, true); assert.equal(renders.at(-1).offline, false);
  controller.offline(); assert.deepEqual([renders.at(-1).offline, renders.at(-1).reconnecting], [true, false]);
  controller.reconnect(); await controller.restoreSnapshot(seatedAt([0], { version: 2 }), { signal: new AbortController().signal });
  assert.deepEqual([renders.at(-1).offline, renders.at(-1).reconnecting], [false, false]);
  const { document, nodes } = viewDocument(), real = createSharedRoomView({ document });
  const sign = nodes.get('scene').children.find(node => node.id === 'shared-room-connection');
  real.render({ snapshot: seatedAt([0]), can: everything, notice: '', connected: false, reconnecting: true });
  assert.equal(sign.hidden, false); assert.equal(sign.dataset.state, 'reconnecting'); assert.equal(sign.attributes.role, 'alert');
  real.render({ snapshot: seatedAt([0]), can: everything, notice: '', connected: false, offline: true });
  assert.equal(sign.dataset.state, 'offline'); assert.match(sign.textContent, /bröts.*Återanslut/);
  real.render({ snapshot: seatedAt([0]), can: everything, notice: '', connected: true });
  assert.equal(sign.hidden, true); real.close();
});

// Review of #536 (3): on a composition plane without table geometry the seats are fitted above the bottom controls,
// whose height changes with the phase. The plane keeps the tallest seen at the screen size, so cards never move.
test('a composition plane keeps its seat and card layout when the bottom controls shrink, and measures again on resize', async () => {
  const { document, window, nodes } = presentationDocument({ width: 390, height: 844 });
  const hud = new Element();let hudTop = 560;hud.getBoundingClientRect = () => ({ top: hudTop, height: 844 - hudTop, left: 0, width: 390 });nodes.set('hud-bottom', hud);
  const projections = [];
  const cards = { restore() {}, sync() {}, clear() {}, show() {}, reveal() {}, close() {}, setProjection: value => projections.push(structuredClone({ x: value.x, y: value.y, scale: value.scale, seats: value.seats })) };
  const plane = { referencePlane: () => ({ x: -45, y: 0, scale: 844 / 1920, sourceAligned: true }), onGeometryChange: () => () => {}, setBackground() {}, setTable() {}, close() {} };
  const selection = { presentation: 'local', dealer: 'paow', localDealer: 'paow', operator: 'north', roomId, packageRevision: 1, registeredDealers: [{ id: 'paow', label: 'paow' }] };
  const port = await mountSharedRoomPresentation({ document, window, selection, onReady() {}, onError() {}, createComposition: () => plane,
    loadAdapters: async () => [{ PerformancePlayer: class { dispose() {} } }, { createLocalPresentation: async () => ({ state() {}, start() {}, close() {} }) }, { createLocalCardOverlay: () => cards }] });
  const seats = Array.from({ length: 7 }, () => new Element()), value = { snapshot: seatedAt([3]), focusSeat: null, seats };
  port.layout(value);const tall = projections.at(-1);
  assert.ok(Math.max(...tall.seats.map(seat => seat.y)) <= 560 - 28 + 16, 'the seats sit above the tallest bottom controls');
  hudTop = 700;port.layout(value);
  assert.deepEqual(projections.at(-1), tall, 'a shorter bottom row (a round on a phone) moves no card or seat');
  hudTop = 500;port.layout(value);
  assert.ok(projections.at(-1).y < tall.y || projections.at(-1).scale < tall.scale, 'a taller one is kept from then on');
  const kept = projections.at(-1);hudTop = 700;port.layout(value);assert.deepEqual(projections.at(-1), kept);
  for (const node of [nodes.get('scene'), nodes.get('table2d')]) node.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 700, right: 390, bottom: 700 });
  port.layout(value);assert.notDeepEqual(projections.at(-1), kept, 'a resize measures the bottom controls anew');
  port.close();
});

// Review of #536: the 24-hour pause asks first and is not called Spelpaus (the national self-exclusion register).
test('the 24-hour pause is named Ta paus and dispatches only after Ja, pausa in its confirmation', () => {
  const { document, nodes } = viewDocument(), calls = [];
  const view = createSharedRoomView({ document }); view.bind({ dispatch: (...args) => calls.push(args) });
  view.render({ snapshot: seatedAt([3], { phase: 'round', roundId: 'r1' }), can: { ...everything, bet: false }, notice: '', connected: true });
  const pause = nodes.get('pitboss'), ask = nodes.get('scene').children.find(node => node.id === 'shared-room-pause');
  assert.equal(pause.attributes['aria-label'], 'Ta paus i 24 timmar'); assert.match(pause.textContent, /^Ta paus/); assert.doesNotMatch(pause.textContent, /Spelpaus/);
  assert.equal(ask.tagName, 'DIALOG'); assert.equal(ask.hidden, true); assert.equal(ask.attributes['aria-labelledby'], 'shared-room-pause-title');
  assert.ok(ask.textContent.startsWith('Pausa spelet i 24 timmar?Du kan inte spela vid bordet förrän pausen gått ut.'), ask.textContent);
  const [cancel, accept] = ask.children.at(-1).children;
  pause.click(); assert.equal(ask.hidden, false); assert.deepEqual(calls, [], 'opening the question sends nothing');
  cancel.click(); assert.equal(ask.hidden, true); assert.deepEqual(calls, []);
  pause.click(); accept.click(); assert.deepEqual(calls, [['pause']]); assert.equal(ask.hidden, true);
  pause.disabled = true; pause.dispatchEvent(new Event('click')); assert.equal(ask.hidden, true, 'a running pause asks nothing');
  assert.equal(nodes.get('banner').title, nodes.get('banner').textContent, 'the clamped status line keeps its full text');
  view.close();
});
