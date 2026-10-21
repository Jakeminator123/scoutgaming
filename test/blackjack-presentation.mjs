// K04 contract tests: committed shared-table outbox rows -> main's presentation instructions,
// exact media identity, stable line identity and the room idle chain. No database (the durable
// receiver is proven on real PostgreSQL in test/postgres-presentation-receiver.mjs), no media
// bytes, no network. Kevin's client modules are byte-verified fixtures of 5aa7ed10.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { newGame, step, publicView } from '../services/game/games/blackjack/core.mjs';
import { createTableCoordinator } from '../services/game/games/blackjack/table/coordinator.mjs';
import { createPresentationGate } from '../services/game/games/blackjack/table/ports.mjs';
import { presentationEvents } from '../services/game/partner-presentation.mjs';
import { orderFilmedPresentationEvents } from '../packages/presentation/runtime/filmed-deal-sequence.mjs';
import { presentationForRow, lineIdOf, reconnectPresentation } from '../services/game/games/blackjack/presentation/outbox-presentation.mjs';
import { MATERIAL_REVISION_CONTRACT, PlanningRefused, assertPublishable, planningRevision, requirePlanningRevision, timingSourceOf }
  from '../services/game/games/blackjack/presentation/material-revision.mjs';
import { createLiveIdleController } from '../packages/presentation/runtime/live-idle.mjs';
import { CATALOGUE_SOURCE, READY_CONTACT, activationSet, bindDeal, bindIdle, bindLine, contactFrame, loadCatalogue, trackFor, variantFrames, verifyActivation }
  from '../services/game/games/blackjack/presentation/media-catalogue.mjs';
import { bindMovingSpeech, createLineMediaTracker } from '../services/game/games/blackjack/presentation/line-identity.mjs';
import { endWait, layChain, roomWait, serverChainEntry, waitClipAt, waitClips } from '../services/game/games/blackjack/presentation/room-idle.mjs';
import { createMemoryTableStore } from './fixtures/blackjack-table-memory-store.mjs';
import { deterministicRandom } from './fixtures/blackjack-deterministic-random.mjs';
import { planDraws, outcomeSpeech } from './fixtures/kevin-5aa7ed1/public/game-events.js';
import * as kevinIdle from './fixtures/kevin-5aa7ed1/public/idle-chain.js';

const fixture = path => readFileSync(new URL(`./fixtures/kevin-5aa7ed1/${path}`, import.meta.url));
const blob = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const catalogue = loadCatalogue();
const order = events => events.filter(e => ['deal', 'reveal'].includes(e.type)).map(e => `${e.type === 'reveal' ? 'reveal' : e.to === 'dealer' ? (e.faceDown ? 'hole' : 'dealer') : `box${e.box}`}#${e.shoeDraw}`);

function setup(funds = { kevin: 1000, john: 1000 }) {
  const store = createMemoryTableStore();
  let time = 100000, n = 0;
  const table = createTableCoordinator({ store, clock: { now: () => time }, random: deterministicRandom('k04-presentation') });
  for (const [p, amount] of Object.entries(funds)) store.test.fund(p, amount);
  const t = {
    store, table, get time() { return time; }, set time(v) { time = v; },
    snap: (who = 'kevin') => table.snapshot('party', who),
    send: (who, op, extra = {}) => table.command({ actorId: who }, { roomId: 'party', op, commandId: `c${++n}`, ...extra }),
    async join(who, seats) { const s = await t.snap(who); return t.send(who, 'join', { seats, seatGens: Object.fromEntries(seats.map(i => [i, s?.seatGen[i] ?? 0])), memberGen: s?.me.memberGen ?? 0 }); },
    async bet(who, seat, chip) { return t.send(who, 'bet', { seat, field: 'main', chip, windowId: (await t.snap(who)).windowId }); },
    async ready(who) { return t.send(who, 'ready', { windowId: (await t.snap(who)).windowId }); },
    async act(who, action) {
      const s = await t.snap(who); time = Math.max(time, s.plan.turnAt);
      return t.send(who, 'act', { action, roundId: s.roundId, turnSeq: s.turnSeq, box: s.round.hands[s.round.active].box, handIndex: s.round.active });
    },
    async drain() { for (let i = 0; i < 50; i++) { const due = await table.dueTicks(); if (!due.length) return; for (const d of due) await table.tick(d); } throw new Error('scheduler did not settle'); },
    // Ranks in draw order (deal: player, dealer up, player, hole, then hits/dealer draws).
    setShoe(ranks) { store.test.mutateRoom('party', r => { const c = r.game.shoe.cards; c.splice(-ranks.length, ranks.length, ...ranks.map((x, i) => ({ r: x, s: ['♠', '♦', '♥', '♣'][i % 4], serial: 900 + i })).reverse()); }); },
    rows: () => store.test.outbox(),
  };
  return t;
}
async function startRound(t, ranks, seat = 3) {
  await t.join('kevin', [seat]); await t.bet('kevin', seat, 10); t.setShoe(ranks); await t.ready('kevin');
}

test('Kevin client fixtures are the frozen 5aa7ed10 blobs and tie the media catalogue to them', () => {
  assert.equal(blob(fixture('public/game-events.js')), 'feeeec469b13d76f0b0b040fd9f8670f21d8dc34');
  assert.equal(blob(fixture('public/idle-chain.js')), 'deec60c205f7422db4d5d0d43516592e1db45435');
  assert.equal(blob(fixture('public/dealers.js')), 'e8751ecdae2f05fbb0d7fc3cebbae834e7f68594');
  const row = path => catalogue.find(r => r.path === path);
  assert.equal(row('public/dealers.js').sha256, sha256(fixture('public/dealers.js')));
  assert.equal(row('public/idle-chain.js').sha256, sha256(fixture('public/idle-chain.js')));
  assert.equal(catalogue.length, 1293);
  assert.deepEqual(catalogue.filter(r => r.path.endsWith('.js')).map(r => r.path).sort(), ['public/dealer-card-tracks-astrid2.js', 'public/dealer-card-tracks-dragge.js',
    'public/dealer-card-tracks-marten.js', 'public/dealer-card-tracks-paow.js', 'public/dealers.js', 'public/idle-chain.js']);
  assert.equal(CATALOGUE_SOURCE.commit, '6bd92d05b0d52032675148519e001b8386110dec');
  // READY_CONTACT is exactly Kevin's dealers.js `in`/`land` per ready dealer.
  const source = fixture('public/dealers.js').toString('utf8');
  for (const [dealer, name] of [['dragge', 'DRAGGE'], ['paow', 'PAOW'], ['astrid2', 'ASTRID2'], ['marten', 'MARTEN']]) {
    const literal = new RegExp(`const ${name}_READY = (\\{.*\\});`).exec(source)[1];
    const ready = Function(`return (${literal})`)();
    assert.deepEqual({ in: ready.in, land: ready.land }, READY_CONTACT[dealer], dealer);
  }
});

// Raw generator errors reproduced on main 95ac98dc (issue #312): reveal was unshifted ahead of every
// instruction, and a two-card 21 after a split was called blackjack. These fail on the old generator.
test('generator: an immediate dealer blackjack reveals after the initial hidden deal, not before goodluck', async () => {
  const t = setup();
  await startRound(t, ['10', '10', '9', 'A']);
  const row = t.rows().at(-1), p = row.payload.presentation;
  assert.equal(p.after.round.phase, 'settled');
  const events = presentationEvents(p.before, p.after, 'start');
  assert.deepEqual(events.map(e => e.type), ['speak', 'deal', 'deal', 'deal', 'deal', 'reveal', 'settle', 'speak']);
  assert.equal(events[0].line, 'goodluck'); assert.equal(events.at(-1).line, 'dealerblackjack');
  assert.deepEqual(order(events), ['box3#2', 'dealer#3', 'box3#4', 'hole#5', 'reveal#5']);
  assert.deepEqual(order(orderFilmedPresentationEvents(events)), order(events), 'the filmed path keeps the same order');
});

test('generator: a hit that ends the turn presents the player card, then the reveal, then extra dealer cards', async () => {
  const t = setup();
  await startRound(t, ['10', '6', '6', '10', '5', '8']);
  await t.act('kevin', 'hit');
  const p = t.rows().at(-1).payload.presentation;
  const events = presentationEvents(p.before, p.after, 'act', { action: 'hit' });
  assert.deepEqual(order(events), ['box3#6', 'reveal#5', 'dealer#7']);
  assert.deepEqual(events.slice(-2).map(e => e.type), ['settle', 'speak']);
  // A stand with nothing new for the player: reveal first, before the dealer draws.
  const s = setup();
  await startRound(s, ['10', '6', '9', '10', '5']);
  await s.act('kevin', 'stand');
  const q = s.rows().at(-1).payload.presentation;
  assert.deepEqual(order(presentationEvents(q.before, q.after, 'act', { action: 'stand' })), ['reveal#5', 'dealer#6']);
});

test('generator: a two-card 21 after a split is a win, never blackjack (core splitFrom natural)', async () => {
  const t = setup();
  await startRound(t, ['A', '6', 'A', '10', '10', 'K', '9']);
  await t.act('kevin', 'split');
  const p = t.rows().at(-1).payload.presentation;
  assert.equal(p.after.round.phase, 'settled');
  assert.ok(p.after.round.hands.every(h => h.cards.length === 2 && h.splitFrom === 3));
  const events = presentationEvents(p.before, p.after, 'act', { action: 'split' });
  const settle = events.find(e => e.type === 'settle');
  assert.deepEqual(settle.hands.map(h => h.outcome), ['win', 'win']);
  assert.equal(events.at(-1).line, 'dealerbust');
  assert.equal(outcomeSpeech(p.after.round), 'dealerbust', 'same line as Kevin');
  // Older stored views without splitFrom (or with the legacy `split` flag) keep their meaning.
  const legacy = structuredClone(p.after); for (const h of legacy.round.hands) { delete h.splitFrom; h.split = true; }
  assert.deepEqual(presentationEvents(p.before, legacy, 'act', { action: 'split' }).find(e => e.type === 'settle').hands.map(h => h.outcome), ['win', 'win']);
});

test('generator deal/reveal order equals Kevin planDraws on 300 core rounds (start, insurance, act)', () => {
  let compared = 0, reveals = 0;
  for (let seed = 0; seed < 300; seed++) {
    const random = deterministicRandom(`k04-parity-${seed}`);
    const boxes = [[3], [0, 6], [1, 2, 5]][seed % 3], bets = Array.from({ length: 7 }, (_, i) => ({ main: boxes.includes(i) ? 10 : 0, pp: 0, tp: 0 }));
    const funding = { available: 1e6, reserved: { stake: Object.fromEntries(boxes.map(b => [b, 10])), insurance: Object.fromEntries(boxes.map(b => [b, 5])) } };
    let state = newGame({ random }).state, before = publicView(state), command = { op: 'start', bets };
    for (let guard = 0; guard < 40 && command; guard++) {
      const out = step(state, command, { limits: {} }, { random, funding }), after = out.view;
      const ours = order(presentationEvents(before, after, command.op, { action: command.action }));
      const kevin = planDraws(command.op === 'start' ? null : before.round, after.round, command.op === 'start')
        .filter(s => ['deal', 'reveal'].includes(s.kind))
        .map(s => s.kind === 'reveal' ? `reveal#${after.round.holeDraw}` : s.card === null ? `hole#${s.shoeDraw}` : s.seat === 'dealer' ? `dealer#${s.shoeDraw}` : `box${s.seat - 1}#${s.shoeDraw}`);
      assert.deepEqual(ours, kevin, `seed ${seed} ${command.op} ${command.action ?? ''}`);
      compared++; reveals += ours.some(x => x.startsWith('reveal'));
      state = out.state; before = after;
      const r = after.round;
      if (r.phase === 'insurance') command = { op: 'insurance', roundId: after.roundId, take: false };
      else if (r.phase === 'decisions') {
        const hand = r.hands[r.active], total = hand.cards.reduce((n, c) => n + (c.r === 'A' ? 11 : ['J', 'Q', 'K'].includes(c.r) ? 10 : Number(c.r)), 0);
        const action = r.legalActions.includes('split') && seed % 2 ? 'split' : r.legalActions.includes('double') && total === 11 ? 'double' : total < 17 ? 'hit' : 'stand';
        command = { op: 'act', action, roundId: after.roundId, turnSeq: after.turnSeq, box: hand.box, handIndex: r.active };
      } else command = null;
    }
  }
  assert.ok(compared > 600 && reveals > 200, `${compared} steps, ${reveals} with a reveal`);
});

test('outbox rows carry sanitized before/after views, a committed collect and a placebets window row', async () => {
  const t = setup();
  await startRound(t, ['10', '6', '9', '10', '5']);
  const opening = t.rows().at(-1);
  const hidden = JSON.stringify(opening.payload.presentation);
  assert.equal(opening.payload.presentation.before.round, null);
  assert.equal(opening.payload.presentation.after.round.dealer.length, 1, 'the hole card is not in the view');
  // The hole card is the 4th stacked card (serial 903): never in the committed presentation before its reveal.
  assert.ok(!hidden.includes('"serial":903') && !hidden.includes('nonce') && !hidden.includes('samples') && !hidden.includes('holeCard') && !hidden.includes('proof'), 'no shoe order, proof or private hole card');
  assert.equal(opening.payload.presentation.after.shoe.cards, undefined);
  const planBefore = (await t.snap()).plan, deadlineBefore = (await t.snap()).actionDeadline;
  assert.equal(deadlineBefore, planBefore.endAt + 15000, 'deadline from config, not media');
  await t.act('kevin', 'stand');
  const settled = await t.snap();
  t.time = settled.plan.endAt; await t.drain();
  const afterSettle = await t.snap();
  assert.equal(afterSettle.phase, 'settled'); assert.deepEqual(afterSettle.plan, settled.plan, 'collect row changes no plan or deadline');
  const collect = t.rows().at(-1);
  assert.equal(collect.payload.presentation.kind, 'collect'); assert.equal(collect.talkId, `${settled.roundId}:collect`);
  assert.equal(collect.payload.presentation.after.round, null);
  assert.deepEqual(presentationForRow(collect).events, [], 'collect does not present placebets');
  await t.send('kevin', 'next', { roundId: settled.roundId });
  const window = t.rows().at(-1), opened = await t.snap();
  assert.equal(window.payload.presentation.kind, 'window'); assert.equal(window.talkId, `${opened.windowId}:window`);
  assert.deepEqual(presentationForRow(window).events.map(e => [e.type, e.line ?? null, e.family ?? null]),
    [['speak', 'placebets', 'speak.other/placebets'], ['idle', null, 'idle.ready/ready']]);
  const vers = t.rows().map(r => r.ver);
  assert.deepEqual(vers, [...vers].sort((a, b) => a - b)); assert.equal(new Set(vers).size, vers.length);
  // Families are main's catalogue slots for every media instruction of a plan row.
  const plan = presentationForRow(t.rows().find(r => r.payload.presentation.op === 'start'));
  assert.deepEqual(plan.events.filter(e => e.family).map(e => e.family), ['speak.goodluck/goodluck', 'deal.player.centre/box3', 'deal.dealer/dealer-up', 'deal.player.centre/box3', 'deal.dealer/dealer-hole']);
  assert.deepEqual(plan.lines.map(l => l.line), ['goodluck']);
});

test('without a sink the outbox stays pending; delivery and replay keep talkId/ver; legacy rows are accepted', async () => {
  const t = setup();
  await startRound(t, ['10', '6', '9', '10', '5']);
  assert.ok((await t.store.outbox.pending()).length > 0, 'nothing delivers without a sink');
  const gate = createPresentationGate(), seen = [];
  const sink = async row => { const a = gate.accept(row); if (a === 'new') seen.push(presentationForRow(row)); return a === 'stale' ? 'stale' : 'applied'; };
  const first = await t.table.deliverOutbox(sink);
  assert.ok(first.delivered.length > 0); assert.deepEqual(await t.store.outbox.pending(), []);
  const again = await sink(first.delivered.at(-1));
  assert.equal(again, 'applied'); assert.equal(seen.length, first.delivered.length, 'identical last ver not applied twice');
  const replay = presentationForRow(first.delivered.at(-1));
  assert.deepEqual(replay.lines, seen.at(-1).lines, 'same row, same line ids');
  assert.equal(presentationForRow({ roomId: 'party', ver: 1, talkId: 'x', payload: { events: [] } }).status, 'legacy');
});

test('media binding is by exact Kevin variant and sha256, not by pose alias', () => {
  const pos = v => bindDeal(catalogue, { dealer: 'dragge', slot: 'deal.player.left/box0', variant: v });
  assert.notEqual(pos('u').sha256, pos('v').sha256, '-u and -v are different takes');
  assert.notEqual(pos('iu').sha256, pos('iv').sha256);
  assert.equal(pos('u').path, 'media/dealers/dragge/v2/pos1-u.mp4'); assert.equal(pos('v').path, 'media/dealers/dragge/v2/pos1-v.mp4');
  assert.equal(pos('v').track, '1v'); assert.equal(pos('u').track, '1');
  assert.throws(() => bindDeal(catalogue, { dealer: 'dragge', slot: 'deal.player.left/box0', variant: 'base' }), /Unknown Kevin variant/);
  assert.throws(() => bindDeal(catalogue, { dealer: 'dragge', slot: 'deal.dealer/dealer-hole', variant: 'v' }), /No media binding/);
  // Every keyed dealer: 7 boxes + dealer-up x 6 variants, hole and flip x 4, each a unique row.
  for (const dealer of ['dragge', 'paow', 'astrid2', 'marten']) {
    const deals = catalogue.filter(r => r.dealer === dealer && r.source === 'deal-tagning');
    assert.equal(deals.length, 56, dealer);
    for (const r of deals) assert.equal(bindDeal(catalogue, { dealer, slot: r.slot, variant: r.variant }).sha256, r.sha256);
  }
  assert.equal(bindDeal(catalogue, { dealer: 'astrid', slot: 'reveal.dealer/dealer-hole', variant: 'bas' }).sha256, '189f67cc15a5d7915cc7a073bbd7653bc1d3147ddb94dd1f00fc05953194427e');
  // Contact: dealers.js land of the variant's own card track plus the -i in-transition; flip is rest to rest.
  assert.equal(contactFrame('dragge', { slot: 'deal.player.left/box0', variant: 'bas' }), 29);
  assert.equal(contactFrame('dragge', { slot: 'deal.player.left/box0', variant: 'i' }), 56);
  assert.equal(contactFrame('dragge', { slot: 'deal.player.left/box0', variant: 'v' }), 36);
  assert.equal(contactFrame('dragge', { slot: 'deal.player.left/box0', variant: 'iv' }), 63);
  assert.equal(contactFrame('paow', { slot: 'reveal.dealer/dealer-hole', variant: 'i' }), 31);
  assert.throws(() => contactFrame('astrid', { slot: 'deal.player.left/box0', variant: 'bas' }), /No ready-dealer contact/);
  assert.equal(trackFor('deal.dealer/dealer-up', 'iv'), 'dealerv');
  assert.equal(variantFrames({ frames: { 1: { '-': 30, '-i': 57, '-v': 44 } } }, { slot: 'deal.player.left/box0', variant: 'v' }), 44);
  assert.throws(() => variantFrames({ frames: {} }, { slot: 'deal.player.left/box0', variant: 'u' }), /meta.json has no length/);
});

test('lines bind only in en/sv; Astrid classic keeps the root repliker; idle takes by exact name', () => {
  assert.equal(bindLine(catalogue, { dealer: 'dragge', line: 'bust', take: 3, language: 'sv' }).path, 'media/dealers/dragge/repliker/sv/bust_3.mp4');
  assert.equal(bindLine(catalogue, { dealer: 'marten', line: 'goodluck', take: 1, language: 'en' }).slot, 'speak.goodluck/goodluck');
  assert.equal(bindLine(catalogue, { dealer: 'astrid', line: 'goodluck', take: 1, language: 'en' }).sha256, 'e01820d0d1ecf578ad06552a2082f28a4c8f62d26d5b08aa3f1e1d0f39cd146f');
  assert.throws(() => bindLine(catalogue, { dealer: 'dragge', line: 'bust', take: 1, language: 'pt' }), /outside en\/sv/);
  assert.throws(() => bindLine(catalogue, { dealer: 'astrid2', line: 'goodluck', take: 1, language: 'sv' }), /No media binding/);
  assert.deepEqual([bindIdle(catalogue, { dealer: 'dragge', take: 'andas' }).calm, bindIdle(catalogue, { dealer: 'dragge', take: 'nick6101' }).calm], [true, false]);
  assert.equal(bindIdle(catalogue, { dealer: 'astrid', take: 'still' }).path, 'media/idle/still.mp4');
});

test('activation verifies the whole binding, including meta.json, card track and texter.json', () => {
  const set = activationSet(catalogue, 'dragge');
  assert.ok(set.some(r => r.path === 'media/dealers/dragge/v2/meta.json') && set.some(r => r.path === 'public/dealer-card-tracks-dragge.js'));
  assert.ok(set.some(r => r.path === 'media/dealers/dragge/repliker/sv/texter.json') && !set.some(r => r.language === 'pt' || r.language === 'ko'));
  const all = new Map(set.map(r => [r.path, r.sha256]));
  assert.equal(verifyActivation(catalogue, 'dragge', all).ok, true);
  const tampered = new Map(all); tampered.set('media/dealers/dragge/v2/meta.json', '0'.repeat(64));
  assert.deepEqual(verifyActivation(catalogue, 'dragge', tampered).mismatched, ['media/dealers/dragge/v2/meta.json']);
  const missing = new Map(all); missing.delete('public/dealer-card-tracks-dragge.js');
  assert.deepEqual(verifyActivation(catalogue, 'dragge', missing).missing, ['public/dealer-card-tracks-dragge.js']);
  assert.ok(activationSet(catalogue, 'astrid').some(r => r.path === 'media/repliker/goodluck_1.mp4'));
  assert.equal(verifyActivation(catalogue, 'nobody', all).ok, false);
});

test('line identity is stable per committed row; media re-plans are revisions; stale mouths are dropped', () => {
  assert.equal(lineIdOf('party', 'plan-1', 0, 'goodluck'), lineIdOf('party', 'plan-1', 0, 'goodluck'));
  assert.notEqual(lineIdOf('party', 'plan-1', 0, 'goodluck'), lineIdOf('party', 'plan-2', 0, 'goodluck'));
  assert.match(lineIdOf('party', 'plan-1', 0, 'goodluck'), /^[a-f0-9]{32}$/);
  const tracker = createLineMediaTracker(), calls = [], closed = [];
  const composition = { setMovingSpeechLayer: layer => calls.push(layer?.id ?? null) };
  const layer = id => ({ id, paint() {}, close() { closed.push(id); } });
  const speech = bindMovingSpeech({ composition, tracker });
  const id = lineIdOf('party', 'plan-1', 0, 'goodluck');
  assert.deepEqual(tracker.open(id), { lineId: id, revision: 0, ended: false });
  assert.deepEqual(tracker.open(id), { lineId: id, revision: 0, ended: false }, 'redelivery does not re-plan');
  assert.equal(speech.offer({ lineId: id, revision: 0, layer: layer('r0') }), true);
  assert.deepEqual(tracker.replan(id), { lineId: id, revision: 1 });
  assert.equal(speech.offer({ lineId: id, revision: 0, layer: layer('late-r0') }), false, 'a late patch of the old revision');
  assert.equal(speech.offer({ lineId: id, revision: 1, layer: layer('r1') }), true);
  assert.equal(speech.end(id), true); assert.equal(speech.end(id), false);
  assert.deepEqual(calls, ['r0', 'r1', null]); assert.deepEqual(closed, ['late-r0']);
  assert.equal(tracker.check({ lineId: 'missing', revision: 0 }), 'unknown');
});

// Review 6328762858 finding 1: open(A) > offer(A,0) > end(A) > late offer(A,0) returned true; after
// offer(B,0) a late A replaced B; close/open(A) made revision 0 current again.
test('a late mouth patch never draws after its line ended, after the next line, or after re-delivery/re-open', () => {
  const rig = () => {
    const tracker = createLineMediaTracker(), calls = [], closed = [];
    const speech = bindMovingSpeech({ composition: { setMovingSpeechLayer: layer => calls.push(layer?.id ?? null) }, tracker });
    return { tracker, speech, calls, closed, layer: id => ({ id, paint() {}, close() { closed.push(id); } }) };
  };
  const A = lineIdOf('party', 'plan-1', 0, 'goodluck'), B = lineIdOf('party', 'plan-2', 0, 'bust'), C = lineIdOf('party', 'plan-3', 0, 'win');
  // End: a late patch of the ended line is closed, not drawn.
  { const { tracker, speech, calls, closed, layer } = rig();
    tracker.open(A); assert.equal(speech.offer({ lineId: A, revision: 0, layer: layer('A0') }), true);
    assert.equal(speech.end(A), true);
    assert.equal(speech.offer({ lineId: A, revision: 0, layer: layer('late-A0') }), false);
    assert.equal(tracker.check({ lineId: A, revision: 0 }), 'ended');
    assert.throws(() => tracker.replan(A), /ended/);
    assert.deepEqual(calls, ['A0', null]); assert.deepEqual(closed, ['late-A0']); assert.equal(speech.owner(), null); }
  // New line: B takes over from A without end(A); a late A can never replace B, before or after end(B).
  { const { tracker, speech, calls, closed, layer } = rig();
    tracker.open(A); tracker.open(B);
    assert.equal(speech.offer({ lineId: A, revision: 0, layer: layer('A0') }), true);
    assert.equal(speech.offer({ lineId: B, revision: 0, layer: layer('B0') }), true);
    assert.equal(tracker.check({ lineId: A, revision: 0 }), 'ended', 'the next line ends the previous generation');
    assert.equal(speech.offer({ lineId: A, revision: 0, layer: layer('late-A0') }), false);
    assert.deepEqual(speech.owner(), { lineId: B, revision: 0 });
    assert.equal(speech.end(B), true);
    assert.equal(speech.offer({ lineId: A, revision: 0, layer: layer('later-A0') }), false);
    // An earlier line that never drew cannot displace a later active one either.
    tracker.open(C); const D = lineIdOf('party', 'plan-4', 0, 'push'); tracker.open(D);
    assert.equal(speech.offer({ lineId: D, revision: 0, layer: layer('D0') }), true);
    assert.equal(speech.offer({ lineId: C, revision: 0, layer: layer('late-C0') }), false);
    assert.equal(tracker.check({ lineId: C, revision: 0 }), 'ended');
    assert.deepEqual(calls, ['A0', 'B0', null, 'D0']); assert.deepEqual(closed, ['late-A0', 'later-A0', 'late-C0']); }
  // Re-delivery and re-open: the same patch twice draws once; a redelivered row after end, or a
  // close/open, keeps the line ended (no revision 0 again); replay of an active line stays idempotent.
  { const { tracker, speech, calls, closed, layer } = rig();
    tracker.open(A); const a0 = layer('A0');
    assert.equal(speech.offer({ lineId: A, revision: 0, layer: a0 }), true);
    assert.equal(speech.offer({ lineId: A, revision: 0, layer: a0 }), true, 'the same layer again is a no-op');
    assert.equal(speech.offer({ lineId: A, revision: 0, layer: layer('dup-A0') }), true, 'a re-delivered patch is acknowledged');
    assert.deepEqual(tracker.open(A), { lineId: A, revision: 0, ended: false }, 'replay of the row while active');
    tracker.replan(A); assert.equal(speech.offer({ lineId: A, revision: 1, layer: layer('A1') }), true);
    speech.end(A);
    assert.deepEqual(tracker.open(A), { lineId: A, revision: 1, ended: true }, 'a redelivered row does not revive the line');
    tracker.close(A); tracker.open(A);
    for (const revision of [0, 1, 2]) assert.equal(speech.offer({ lineId: A, revision, layer: layer(`re-A${revision}`) }), false);
    assert.deepEqual(calls, ['A0', 'A1', null]); assert.deepEqual(closed, ['dup-A0', 're-A0', 're-A1', 're-A2']); }
});

test('room idle chain equals Kevin idle-chain.js and is laid from the accepted plan row', async () => {
  const takes = [{ take: 'andas', frames: 39, vikt: 20, calm: true }, { take: 'andasb', frames: 39, vikt: 20, calm: true },
    { take: 'fingrar', frames: 39, vikt: 4, calm: true }, { take: 'nick6101', frames: 39, vikt: 6, calm: false }];
  for (const seed of ['a', 'plan-1', '3f2c']) {
    assert.deepEqual(layChain(takes, 1000, 60000, seed), kevinIdle.layChain(takes, 1000, 60000, seed));
    const wait = { from: 500, until: 30000, seed, takes };
    assert.deepEqual(waitClips(wait, 0, 40000), kevinIdle.waitClips(wait, 0, 40000));
  }
  const t = setup();
  await startRound(t, ['10', '6', '9', '10', '5']);
  const row = t.rows().at(-1), wait = roomWait(row, takes);
  assert.deepEqual(wait.takes.map(x => x.take), ['andas', 'andasb', 'fingrar'], 'only calm takes while waiting');
  assert.equal(wait.from, row.payload.endAt); assert.equal(wait.seed, row.payload.planId);
  const clip = waitClipAt(wait, wait.from + 2000).clip;
  assert.equal(bindIdle(catalogue, { dealer: 'dragge', take: clip.take }).calm, true);
  const ended = endWait(wait, wait.from + 2000);
  assert.ok(ended.until >= wait.from + 2000 && waitClipAt(ended, ended.until) === null);
  await t.act('kevin', 'stand');
  assert.equal(roomWait(t.rows().at(-1), takes), null, 'a settled plan opens no wait');
});

// Decision (#312 / review 6328762858): current(roomId) + root's snapshot + version check.
test('reconnect never applies an older presentation over newer game state', async () => {
  const t = setup(), accepted = new Map();
  const gate = createPresentationGate();
  const sink = async row => { const a = gate.accept(row); if (a === 'new') accepted.set(row.roomId, presentationForRow(row)); return a === 'stale' ? 'stale' : 'applied'; };
  const current = roomId => accepted.get(roomId) ?? null;
  await t.join('kevin', [3]);
  assert.deepEqual(reconnectPresentation(await t.snap(), current('party')), { apply: false, reason: 'none' }, 'a new room has presented nothing');
  await t.bet('kevin', 3, 10); t.setShoe(['10', '6', '9', '10', '5']); await t.ready('kevin');
  await t.table.deliverOutbox(sink);
  const early = await t.snap();
  const ok = reconnectPresentation(early, current('party'));
  assert.equal(ok.apply, true); assert.equal(ok.presentation.ver, early.presentationVer);
  assert.equal(ok.presentation.talkId, early.plan.id);
  assert.equal(reconnectPresentation(early, current('party'), { appliedVer: early.presentationVer }).reason, 'already_applied');
  // A newer committed step whose row is not yet accepted: the older presentation is refused.
  await t.act('kevin', 'stand');
  const later = await t.snap();
  assert.ok(later.presentationVer > early.presentationVer);
  assert.deepEqual(reconnectPresentation(later, current('party')), { apply: false, reason: 'stale_presentation' });
  await t.table.deliverOutbox(sink);
  // The receiver moved on but the viewer holds the older snapshot: re-read it, never mix.
  assert.deepEqual(reconnectPresentation(early, current('party')), { apply: false, reason: 'stale_snapshot' });
  const fresh = reconnectPresentation(later, current('party'));
  assert.equal(fresh.apply, true); assert.equal(fresh.presentation.talkId, later.plan.id);
  assert.throws(() => reconnectPresentation({ ...later, roomId: 'other' }, current('party')), /another room/);
  assert.equal(reconnectPresentation({ ...later, presentationVer: undefined }, current('party')).apply, false);
});

test("main's live-idle 'server-chain' mode follows the room chain over the whole calm pool; 'own' mode unchanged", async () => {
  // Dragan's 21 idle takes from the catalogue (11 calm): more than the policy's four base loops.
  const takes = catalogue.filter(r => r.dealer === 'dragge' && r.source === 'idle-tagning').map(r => ({ take: r.path.split('/').at(-1).slice(0, -4), frames: 39, vikt: 6, calm: r.note === 'lugn' }));
  assert.equal(takes.length, 21); assert.equal(takes.filter(x => x.calm).length, 11);
  const uuid = i => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const idOf = new Map(takes.map((x, i) => [x.take, uuid(i + 1)]));
  const familyId = 'astrid/idle.ready/ready';
  const policy = { schemaVersion: 1, familyId, base: [{ videoId: uuid(1), weight: 100, durationMs: 1625 }], variants: [] };
  const inventory = { families: [{ id: familyId, dealerId: 'astrid', playbackType: 'idle-pool', standardIds: [uuid(1)], variantIds: [...idOf.values()].slice(1) }],
    videos: [...idOf.values()].map((id, i) => ({ id, familyId, role: i ? 'variant' : 'standard', available: true })) };
  let clock = 0;
  const own = createLiveIdleController({ policy, inventory, now: () => clock, initialScene: { active: true } });
  assert.equal(own.follow, undefined); assert.equal(own.snapshot().clip.kind, 'base');
  assert.throws(() => createLiveIdleController({ policy, inventory, mode: 'random' }), /mode/);
  const idle = createLiveIdleController({ policy, inventory, mode: 'server-chain', now: () => clock, initialScene: { active: true } });
  assert.equal(idle.snapshot().state, 'unavailable', 'nothing of its own until the server chain says');
  assert.equal(idle.offerVariant({ videoId: uuid(2), requestId: 'r1', expiresAt: 1000 }), false);
  const t = setup();
  await startRound(t, ['10', '6', '9', '10', '5']);
  const row = t.rows().at(-1), wait = roomWait(row, takes), seen = new Set();
  for (let now = wait.from; now < wait.from + 60000; now += 250) {
    const entry = serverChainEntry(row.ver, wait, now, take => idOf.get(take));
    if (!entry) continue;
    const before = idle.snapshot().clip;
    const took = idle.follow(entry);
    if (took) { const c = idle.snapshot().clip; assert.equal(c.videoId, entry.videoId); assert.equal(c.reason, 'server-chain'); seen.add(entry.videoId); idle.presented(c.playId); assert.equal(idle.snapshot().idleReady, true); }
    else assert.equal(before?.startAt, entry.startAt, 'only the same clip again is refused');
  }
  const calmIds = new Set(takes.filter(x => x.calm).map(x => idOf.get(x.take)));
  assert.ok(seen.size > 4, `followed ${seen.size} distinct takes, not trimmed to four`);
  assert.ok([...seen].every(id => calmIds.has(id)), 'only calm takes while waiting');
  // An older presentation's chain or an earlier clip is never followed after a newer one.
  const latest = idle.snapshot().clip;
  assert.equal(idle.follow({ ver: row.ver - 1, startAt: latest.startAt + 5000, endAt: latest.startAt + 6625, videoId: latest.videoId }), false);
  assert.equal(idle.follow({ ver: row.ver, startAt: latest.startAt - 1625, endAt: latest.startAt, videoId: latest.videoId }), false);
  assert.equal(idle.follow({ ver: row.ver + 1, startAt: 1, endAt: 2, videoId: 'not-in-family' }), false);
  assert.throws(() => serverChainEntry(row.ver, wait, wait.from + 100, () => undefined), /No inventory video/);
});

test('planning/material revision: leadMs/cardMs + revision per exact dealer, language and media set; no binding, no publication', () => {
  const observed = new Map(catalogue.map(r => [r.path, r.sha256]));
  const docs = dealer => new Map(timingSourceOf(dealer) ? [[timingSourceOf(dealer), fixture(`public/${timingSourceOf(dealer)}`)]] : []);
  const plan = (dealer, language, extra = {}) => planningRevision({ catalogue, dealer, language, observed, documents: docs(dealer), ...extra });
  // The timing documents are Kevin's bytes, verified against the catalogue rows before use.
  for (const dealer of ['dragge', 'paow', 'astrid2', 'marten', 'astrid'])
    assert.equal(sha256(fixture(`public/${timingSourceOf(dealer)}`)), catalogue.find(r => r.path === timingSourceOf(dealer)).sha256, dealer);
  const expected = { dragge: [3205, 3539, 83, 39], paow: [3914, 3455, 81, 56], astrid2: [3205, 3705, 87, 39], marten: [3205, 3539, 83, 39] };
  for (const [dealer, [leadMs, cardMs, cardFrames, flipFrames]] of Object.entries(expected)) {
    const r = plan(dealer, 'en');
    assert.equal(r.ok, true, dealer); assert.equal(r.contract, MATERIAL_REVISION_CONTRACT);
    assert.deepEqual([r.leadMs, r.cardMs, r.timing.cardFrames, r.timing.flipFrames], [leadMs, cardMs, cardFrames, flipFrames], dealer);
    // Upper bound: every deal take of the set fits in cardMs (incl. the 80 ms gap), the flip in leadMs.
    const meta = JSON.parse(fixture(`public/${timingSourceOf(dealer)}`));
    for (const [track, frames] of Object.entries(meta.frames)) for (const n of Object.values(frames))
      assert.ok(n * 1000 / 24 + 80 <= (track === 'flip' ? r.leadMs - 1500 : r.cardMs), `${dealer} ${track}`);
    assert.match(r.revision, /^[a-f0-9]{64}$/);
    assert.deepEqual(plan(dealer, 'en'), r, 'deterministic');
    assert.ok(r.media.every(([path]) => observed.has(path)) && r.media.some(([path]) => path === timingSourceOf(dealer)));
    assert.ok(!r.media.some(([path]) => /\/repliker\/(sv|pt|ko|es)\//.test(path)), 'only the chosen language');
  }
  const classic = plan('astrid', 'en');
  assert.deepEqual([classic.leadMs, classic.cardMs, classic.timing.cardSeconds, classic.timing.flipSeconds], [3910, 3580, 3.5, 2.33]);
  // Language is part of the material: same timing, different identity.
  const sv = plan('dragge', 'sv'), en = plan('dragge', 'en');
  assert.deepEqual([sv.leadMs, sv.cardMs], [en.leadMs, en.cardMs]); assert.notEqual(sv.revision, en.revision);
  assert.ok(sv.media.some(([path]) => path.includes('/repliker/sv/')));
  // Refusals, never a default.
  assert.equal(plan('dragge', 'pt').reason, 'language_outside_en_sv');
  assert.equal(plan('astrid2', 'sv').reason, 'no_recorded_lines_in_language');
  assert.equal(plan('astrid', 'sv').reason, 'no_recorded_lines_in_language');
  assert.equal(plan('nobody', 'en').reason, 'unknown_dealer');
  const take = 'media/dealers/dragge/v2/pos1-u.mp4';
  const without = new Map(observed); without.delete(take);
  assert.deepEqual(plan('dragge', 'en', { observed: without }).missing, [take]);
  const tampered = new Map(observed); tampered.set(take, '0'.repeat(64));
  assert.deepEqual(plan('dragge', 'en', { observed: tampered }).mismatched, [take]);
  assert.equal(plan('dragge', 'en', { documents: new Map() }).reason, 'timing_document_missing');
  const edited = Buffer.from(fixture('public/media/dealers/dragge/v2/meta.json').toString('utf8').replace('"-iu":83', '"-iu":40'));
  assert.equal(plan('dragge', 'en', { documents: new Map([[timingSourceOf('dragge'), edited]]) }).reason, 'timing_document_mismatch');
  assert.equal(planningRevision({ catalogue: [], dealer: 'dragge', language: 'en', observed, documents: docs('dragge') }).reason, 'no_catalogue');
  assert.throws(() => requirePlanningRevision({ catalogue, dealer: 'dragge', language: 'en', observed: without, documents: docs('dragge') }),
    e => e instanceof PlanningRefused && e.code === 'planning_refused' && e.refusal.reason === 'media_set_not_verified');
  // J08 publication gate.
  const pub = { dealer: 'dragge', language: 'en', leadMs: en.leadMs, cardMs: en.cardMs };
  assert.equal(assertPublishable({ binding: en, ...pub }), en.revision);
  assert.equal(assertPublishable({ binding: en, ...pub, revision: en.revision }), en.revision);
  const refused = (args, reason) => assert.throws(() => assertPublishable(args), e => e instanceof PlanningRefused && e.refusal.reason === reason);
  refused({ ...pub }, 'planning_binding_missing');
  refused({ binding: plan('dragge', 'pt'), ...pub }, 'language_outside_en_sv');
  refused({ binding: sv, ...pub }, 'planning_binding_other_material');
  refused({ binding: en, ...pub, leadMs: 700, cardMs: 500 }, 'planning_timing_not_from_binding');
  refused({ binding: en, ...pub, revision: sv.revision }, 'planning_revision_mismatch');
});
