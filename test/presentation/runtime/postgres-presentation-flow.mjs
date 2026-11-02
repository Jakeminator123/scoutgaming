// Shared-table presentation flow, invoked by tools/run-shared-table-qa.mjs on its owned
// loopback cluster after the receiver checks. The real coordinator and PostgreSQL store
// use a synthetic frozen native-film publication with two players. Committed outbox rows
// pass through the durable receiver and the product's filmed/speech selectors.
// The clock and random port are explicit; no production data or media bytes are used.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createTableCoordinator } from '../../../services/game/games/blackjack/table/coordinator.mjs';
import { createPostgresTableStore } from '../../../services/game/games/blackjack/table/postgres-store.mjs';
import { createPostgresPresentationReceiver } from '../../../services/game/games/blackjack/presentation/postgres-receiver.mjs';
import { reconnectPresentation } from '../../../services/game/games/blackjack/presentation/outbox-presentation.mjs';
import { withFilmedSteps, withSpeechTakes } from '../../../services/game/shared-room-filmed-steps.mjs';
import { canonicalStudioJson } from '../../../packages/studio-registry/server/document-contract.mjs';
import { resolveNativeRoomGameMaterial } from '../../../packages/presentation/server/native-room-game-material.mjs';
import { nativeRoomSpeechClips } from '../../../packages/presentation/server/native-room-speech-clips.mjs';
import { readPackagePresentation } from '../../../packages/presentation/server/presentation-package.mjs';
import { validateRoomGameMaterial } from '../../../packages/presentation/contracts/room-game-config.mjs';
import { DEFAULT_CONFIG } from '../../fixtures/blackjack/table-memory-store.mjs';
import { deterministicRandom } from '../../fixtures/blackjack/deterministic-random.mjs';
import { nativeRoomMaterialFixture } from '../../fixtures/native-room-game-material.mjs';

const ROOM = 'presentation-flow', P1 = 'presentation-flow-p1', P2 = 'presentation-flow-p2', DEALER = 'dragan', LANGUAGE = 'sv';
const RECEIVER = 'croupier_game.shared_table_presentation_receiver';
const order = events => events.filter(e => ['deal', 'reveal'].includes(e.type))
  .map(e => `${e.type === 'reveal' ? 'reveal' : e.to === 'dealer' ? (e.faceDown ? 'hole' : 'dealer') : `box${e.box}`}#${e.shoeDraw}`);
const kinds = rows => rows.map(r => [r.payload.presentation.kind, r.payload.presentation.op, r.payload.presentation.action]);

export async function runPostgresPresentationFlowChecks({ pool, restart }) {
  let time = 900000, n = 0, generation = 0;
  const clock = { now: () => time }, checks = [];
  let store, table, receiver;
  const reopen = () => {
    store = createPostgresTableStore({ pool, walletMode: 'demo' });
    table = createTableCoordinator({ store, clock, random: deterministicRandom(`presentation-flow-${++generation}`) });
    receiver = createPostgresPresentationReceiver({ pool });
  };
  reopen(); await receiver.assertInstalled();
  const check = async (name, work) => { await work(); checks.push(name); console.log(`ok - ${name}`); };
  const send = (who, op, fields = {}) => table.command({ actorId: who }, { roomId: ROOM, commandId: `presentation-flow-${++n}`, op, ...fields });
  const snap = (who = P1) => table.snapshot(ROOM, who);
  const pending = async () => (await store.outbox.pending()).filter(r => r.roomId === ROOM);
  const rowXmin = async () => (await pool.query(`SELECT xmin::text AS x FROM ${RECEIVER} WHERE room_id=$1`, [ROOM])).rows[0]?.x;
  const stack = ranks => store.runLocked({ global: false, rooms: [ROOM], players: [] }, async tx => {
    const value = await tx.rooms.read(ROOM);
    value.game.shoe.cards.splice(-ranks.length, ranks.length, ...ranks.map((r, i) => ({ r, s: ['♠', '♦', '♥', '♣'][i % 4], serial: 900 + i })).reverse());
    await tx.rooms.write(ROOM, value);
  });
  const act = async (who, action) => {
    const s = await snap(who); time = Math.max(time, s.plan.turnAt);
    return send(who, 'act', { action, roundId: s.roundId, turnSeq: s.turnSeq, box: s.round.hands[s.round.active].box, handIndex: s.round.active });
  };
  const runTicks = async expected => {
    const due = (await table.dueTicks()).filter(d => d.roomId === ROOM);
    assert.deepEqual(due.map(d => d.kind), expected);
    for (const d of due) assert.equal((await table.tick(d)).outcome, 'applied', d.kind);
  };
  // Delivery through the real coordinator into the durable receiver; returns this room's results.
  const deliver = async (sink = receiver.sink) => {
    const out = await table.deliverOutbox(sink), mine = r => r.roomId === ROOM;
    return { delivered: out.delivered.filter(mine), superseded: out.superseded.filter(mine), failed: out.failed.filter(f => mine(f.row)) };
  };
  const accepted = [];   // every presentation the receiver accepted as current, in acceptance order
  const deliverAll = async expectedKinds => {
    const rows = await pending();
    assert.deepEqual(rows.map(r => r.payload.presentation.kind), expectedKinds);
    const before = await receiver.lastAccepted(ROOM);
    assert.ok(rows.every(r => r.ver > before), 'every new row has a higher ver than the last accepted');
    const out = await deliver();
    assert.deepEqual(out.failed, []); assert.deepEqual(out.superseded, []);
    assert.deepEqual(out.delivered.map(r => r.ver), rows.map(r => r.ver));
    assert.deepEqual(await pending(), []);
    const current = await receiver.current(ROOM);
    assert.equal(current.ver, rows.at(-1).ver); assert.equal(current.talkId, rows.at(-1).talkId);
    assert.equal(await receiver.lastAccepted(ROOM), rows.at(-1).ver);
    accepted.push(current);
    return { rows, current };
  };
  // Sanitized public views: no hidden hole card, shoe order, proof, nonce or private draws.
  const assertSanitized = (row, holeSerial) => {
    const p = row.payload.presentation, text = JSON.stringify(p);
    for (const view of [p.before, p.after].filter(Boolean)) assert.equal(view.shoe?.cards, undefined, 'no shoe order in a view');
    for (const word of ['nonce', 'samples', 'holeCard', 'proof', 'commandDraws']) assert.ok(!text.includes(`"${word}"`), word);
    if (holeSerial !== undefined) assert.ok(!text.includes(`"serial":${holeSerial}`), 'hidden hole card not in the row');
  };

  // Use the product publication resolver and exact registered profile with declared synthetic
  // records. The frozen material reaches the coordinator's real native sequence guard.
  const fixture = nativeRoomMaterialFixture({ dealerId: DEALER, language: LANGUAGE });
  fixture.input.room.id = ROOM;
  fixture.input.package.tables = [ROOM];
  fixture.input.package.rooms = [structuredClone(fixture.input.room)];
  const resolveMaterial = input => resolveNativeRoomGameMaterial(input, { version: 2 });
  const material = resolveMaterial(fixture.input);
  const config = { ...structuredClone(DEFAULT_CONFIG), language: LANGUAGE, leadMs: material.leadMs, cardMs: material.cardMs,
    material, operatorId: fixture.input.package.operatorId, packageRevision: fixture.input.package.revision,
    presentationHash: createHash('sha256').update(canonicalStudioJson(readPackagePresentation(fixture.input.package))).digest('hex') };

  await check('presentation-flow-native-material-requires-measurements-language-and-room-ownership', async () => {
    assert.deepEqual(validateRoomGameMaterial(material, { dealerId: DEALER, language: LANGUAGE }), material);
    assert.match(material.revision, /^native-film-v2-[a-f0-9]{64}$/);
    assert.equal(material.film.profileId, fixture.profile.id);
    const refused = reason => error => error?.code === 'studio_room_game_material_unavailable' && error.reason === reason;
    assert.throws(() => resolveMaterial({ ...fixture.input, language: 'en' }), refused('native_material_speech_unbound'));
    assert.throws(() => resolveMaterial({ ...fixture.input, room: { ...fixture.input.room, operatorId: 'another-operator' } }), refused('native_material_room_mismatch'));
    assert.throws(() => resolveMaterial({ ...fixture.input, package: { ...fixture.input.package, branding: {} } }), refused('native_material_frozen_v3_required'));
    const unmeasured = nativeRoomMaterialFixture({ dealerId: DEALER, language: LANGUAGE, capture: false });
    delete unmeasured.records.find(row => row.classification.kind === 'action').mediaTiming;
    unmeasured.recapture();
    assert.throws(() => resolveMaterial(unmeasured.input), refused('native_material_measurement_missing'));
    await store.config.publish(ROOM, 'presentation-flow-v1', config);
    for (const [id, name] of [[P1, 'Synthetic flow player 1'], [P2, 'Synthetic flow player 2']])
      await pool.query('INSERT INTO croupier_game.players(id,name,balance,created_at) VALUES($1,$2,$3,$4)', [id, name, 1000, '2026-10-22T00:00:00.000Z']);
  });

  let round1;
  await check('presentation-flow-two-players-join-bet-ready-start-plan-sanitized-and-accepted', async () => {
    await send(P1, 'join', { seats: [1], seatGens: { 1: 0 }, memberGen: 0 });
    await send(P2, 'join', { seats: [4], seatGens: { 4: 0 }, memberGen: 0 });
    assert.deepEqual(await pending(), [], 'join opens the room without a presentation row');
    assert.deepEqual(reconnectPresentation(await snap(), await receiver.current(ROOM)), { apply: false, reason: 'none' });
    const windowId = (await snap()).windowId;
    await send(P1, 'bet', { seat: 1, field: 'main', chip: 10, windowId });
    await send(P2, 'bet', { seat: 4, field: 'main', chip: 10, windowId });
    // Draw order: box4, box1, dealer up, box4, box1, hole (serial 905), then split/hit/dealer cards.
    await stack(['A', '9', 'A', 'A', '2', '5', '10', 'K', '5', '3']);
    assert.equal((await send(P1, 'ready', { windowId })).result.started, false, 'the other seated player is online and not ready');
    assert.equal((await send(P2, 'ready', { windowId })).result.started, true);
    const s = await snap(); round1 = s.roundId;
    assert.equal(s.round.phase, 'insurance');
    assert.equal(s.plan.endAt - s.plan.startAt, material.leadMs + 6 * material.cardMs, 'spoken opening uses the frozen material budget');
    const rows = await pending();
    assert.deepEqual(kinds(rows), [['plan', 'start', null]]);
    const p = rows[0].payload.presentation;
    assert.equal(p.before.round, null); assert.equal(p.after.round.dealer.length, 1, 'the hole card is not in the after view');
    assertSanitized(rows[0], 905);
    // Reconnect before delivery: nothing accepted yet for a committed presentation.
    assert.deepEqual(reconnectPresentation(s, await receiver.current(ROOM)), { apply: false, reason: 'stale_presentation' });
    const { current } = await deliverAll(['plan']);
    assert.ok(!(await pool.query(`SELECT body FROM ${RECEIVER} WHERE room_id=$1`, [ROOM])).rows[0].body.includes('"serial":905'), 'receiver body has no hole card');
    assert.deepEqual(current.events.map(e => e.type), ['speak', 'deal', 'deal', 'deal', 'deal', 'deal', 'deal', 'speak']);
    assert.deepEqual(order(current.events), ['box4#2', 'box1#3', 'dealer#4', 'box4#5', 'box1#6', 'hole#7']);
    assert.deepEqual(current.lines.map(l => l.line), ['goodluck', 'insurance']);
    assert.equal(current.language, LANGUAGE);
    const resumed = reconnectPresentation(await snap(), current);
    assert.deepEqual([resumed.apply, resumed.presentation.ver], [true, s.presentationVer]);
  });

  await check('presentation-flow-insurance-split-21-hit-stand-reveal-after-trigger-before-dealer-cards', async () => {
    time = (await snap()).plan.turnAt;
    const s = await snap();
    await send(P1, 'insurance', { take: true, roundId: s.roundId, phase: 'insurance' });
    assert.deepEqual(await pending(), [], 'the first insurance answer commits no presentation');
    await send(P2, 'insurance', { take: false, roundId: s.roundId, phase: 'insurance' });
    let { rows, current } = await deliverAll(['plan']);
    assert.deepEqual(kinds(rows), [['plan', 'insurance', null]]);
    assert.deepEqual(current.events.map(e => e.type), ['turn']); assert.equal(current.events[0].box, 4);
    assertSanitized(rows[0], 905);
    await act(P2, 'split');      // A,A split: 10 and K, two 21s, the turn moves to box 1
    await act(P1, 'hit');        // 2+9 -> +5 = 16
    await act(P1, 'stand');      // the last hand: reveal the 5, the dealer draws the 3 (A+5+3 = 19)
    ({ rows } = await deliverAll(['plan', 'plan', 'plan']));
    assert.deepEqual(kinds(rows), [['plan', 'act', 'split'], ['plan', 'act', 'hit'], ['plan', 'act', 'stand']]);
    const [split, hit, stand] = rows.map(r => r.payload.presentation);
    for (const r of rows.slice(0, 2)) assertSanitized(r, 905);
    assert.equal(stand.before.round.dealer.length, 1); assert.equal(stand.after.round.dealer.length, 3, 'revealed only after the step');
    const ev = (await receiver.current(ROOM)).events;
    assert.deepEqual(order(ev), ['reveal#7', 'dealer#11'], 'stand: reveal first, before the extra dealer card');
    assert.ok(split.after.round.hands.filter(h => h.box === 4).every(h => h.cards.length === 2 && h.splitFrom === 4));
    assert.equal(hit.after.round.phase, 'decisions');
    const settle = ev.find(e => e.type === 'settle');
    assert.deepEqual(settle.hands.map(h => [h.box, h.outcome]), [[1, 'lose'], [4, 'win'], [4, 'win']], 'split 21 is a win, never blackjack');
    assert.equal(ev.at(-1).line, 'win');
    assert.ok(!ev.some(e => e.line === 'blackjack'));
  });

  await check('presentation-flow-receiver-higher-applied-identical-applied-without-rewrite-lower-stale', async () => {
    const all = (await pool.query("SELECT body FROM croupier_game.shared_table_outbox WHERE room_id=$1 AND status='delivered' ORDER BY ver", [ROOM])).rows
      .map(r => (typeof r.body === 'string' ? JSON.parse(r.body) : r.body));
    assert.deepEqual(all.map(r => r.ver), [1, 2, 3, 4, 5]);
    const xmin = await rowXmin();
    assert.equal(await receiver.sink(all.at(-1)), 'applied', 'identical last ver: acknowledged');
    assert.equal(await rowXmin(), xmin, 'identical last ver is not written again');
    for (const older of all.slice(0, -1)) assert.equal(await receiver.sink(older), 'stale');
    assert.equal(await rowXmin(), xmin);
    await assert.rejects(receiver.sink({ ...all.at(-1), talkId: 'forged' }), /presentation_version_conflict/);
    assert.equal(await receiver.lastAccepted(ROOM), 5);
  });

  await check('presentation-flow-settle-collect-row-then-next-window-row-triggers-placebets', async () => {
    const before = await snap();
    time = before.plan.endAt; await runTicks(['round.settle']);
    const settled = await snap();
    assert.equal(settled.phase, 'settled'); assert.deepEqual(settled.plan, before.plan, 'collect changes no plan or deadline');
    await send(P1, 'next', { roundId: round1 });
    const rows = await pending();
    assert.deepEqual(kinds(rows), [['collect', 'collect', null], ['window', null, null]]);
    assert.equal(rows[0].talkId, `${round1}:collect`); assert.equal(rows[0].payload.presentation.after.round, null);
    const opened = await snap();
    assert.equal(rows[1].talkId, `${opened.windowId}:window`);
    // Reconnect while the receiver still holds the older plan: never applied over the new window.
    assert.deepEqual(reconnectPresentation(opened, await receiver.current(ROOM)), { apply: false, reason: 'stale_presentation' });
    const { current } = await deliverAll(['collect', 'window']);
    assert.deepEqual(accepted.at(-1).events, current.events);
    assert.equal(current.kind, 'window');
    assert.deepEqual(current.events.map(e => [e.type, e.line ?? null, e.family]), [['speak', 'placebets', 'speak.other/placebets'], ['idle', null, 'idle.ready/ready']]);
    const resumed = reconnectPresentation(opened, current);
    assert.deepEqual([resumed.apply, resumed.presentation.ver], [true, opened.presentationVer]);
    assert.deepEqual(reconnectPresentation(opened, current, { appliedVer: opened.presentationVer }), { apply: false, reason: 'already_applied' });
    assert.deepEqual(reconnectPresentation({ ...opened, presentationVer: opened.presentationVer + 1 }, current), { apply: false, reason: 'stale_presentation' });
  });

  await check('presentation-flow-crash-rollback-and-lost-ack-leave-outbox-pending-redelivery-applies-once', async () => {
    const windowId = (await snap()).windowId;
    await send(P1, 'bet', { seat: 1, field: 'main', chip: 10, windowId });
    await send(P2, 'bet', { seat: 4, field: 'main', chip: 10, windowId });
    await stack(['10', '6', '6', '9', '5', '10', '10', '8']);
    assert.equal((await send(P1, 'ready', { windowId })).result.started, false);
    time = (await snap()).deadline; await runTicks(['window.close']);   // P2 never readies: the window closes and starts
    const [row] = await pending();
    assert.deepEqual(kinds([row]), [['plan', 'start', null]]);
    assertSanitized(row, 905);
    const lastBefore = await receiver.lastAccepted(ROOM), xminBefore = await rowXmin();
    // (1) The receiver transaction is rolled back (COMMIT answered as ROLLBACK): no write, row pending.
    const rollbackPool = { query: (...a) => pool.query(...a), connect: async () => {
      const client = await pool.connect();
      return { query: (sql, args) => client.query(sql === 'COMMIT' ? 'ROLLBACK' : sql, args), release: e => client.release(e) };
    } };
    const rolledBack = await deliver(createPostgresPresentationReceiver({ pool: rollbackPool }).sink);
    assert.deepEqual(rolledBack.delivered, []); assert.match(rolledBack.failed[0].error.message, /rolled back/);
    assert.deepEqual([await receiver.lastAccepted(ROOM), await rowXmin()], [lastBefore, xminBefore]);
    assert.deepEqual((await pending()).map(r => [r.talkId, r.ver]), [[row.talkId, row.ver]]);
    // (2) The receiver commits, then the delivering process dies before the outbox ack.
    const killed = await deliver(async r => { await receiver.sink(r); throw new Error('killed before ack'); });
    assert.equal(killed.failed.length, 1);
    assert.equal(await receiver.lastAccepted(ROOM), row.ver);
    const xminApplied = await rowXmin();
    // (3) PostgreSQL and every process restart; the row is still pending with the same talkId/ver.
    pool = await restart(); reopen();
    const survivors = await pending();
    assert.deepEqual(survivors.map(r => [r.talkId, r.ver]), [[row.talkId, row.ver]]);
    const again = await deliver();
    assert.deepEqual(again.failed, []); assert.deepEqual(again.delivered.map(r => [r.talkId, r.ver]), [[row.talkId, row.ver]]);
    assert.equal(await rowXmin(), xminApplied, 'applied once: the redelivery did not write the receiver again');
    assert.deepEqual(await pending(), []);
    const current = await receiver.current(ROOM);
    assert.deepEqual([current.talkId, current.ver], [row.talkId, row.ver]);
    accepted.push(current);
    assert.deepEqual(order(current.events), ['box4#12', 'box1#13', 'dealer#14', 'box4#15', 'box1#16', 'hole#17']);
  });

  await check('presentation-flow-hit-to-21-presents-player-card-then-reveal-then-dealer-card', async () => {
    await act(P2, 'stand');      // 10+9 = 19
    await act(P1, 'hit');        // 6+5 -> +10 = 21 ends the last hand: reveal the 10, the dealer draws the 8 (6+10+8 bust)
    const { rows, current } = await deliverAll(['plan', 'plan']);
    assert.deepEqual(kinds(rows), [['plan', 'act', 'stand'], ['plan', 'act', 'hit']]);
    assertSanitized(rows[0], 905);
    assert.deepEqual(order(current.events), ['box1#18', 'reveal#17', 'dealer#19']);
    assert.deepEqual(current.events.find(e => e.type === 'settle').hands.map(h => [h.box, h.outcome]), [[1, 'win'], [4, 'win']]);
    assert.equal(current.events.at(-1).line, 'dealerbust');
    time = (await snap()).plan.endAt; await runTicks(['round.settle']);
    await send(P2, 'next', { roundId: (await snap()).roundId });
    await deliverAll(['collect', 'window']);
    const vers = (await pool.query('SELECT ver FROM croupier_game.shared_table_outbox WHERE room_id=$1 ORDER BY ver', [ROOM])).rows.map(r => Number(r.ver));
    assert.deepEqual(vers, Array.from({ length: vers.length }, (_, i) => i + 1));
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM croupier_game.shared_table_outbox WHERE room_id=$1 AND status<>'delivered'", [ROOM])).rows[0].n, 0);
    assert.equal(await receiver.lastAccepted(ROOM), vers.at(-1));
  });

  await check('presentation-flow-accepted-events-select-only-frozen-native-media-by-identity', async () => {
    const records = new Map(fixture.records.map(row => [row.id, row]));
    const listed = new Map(material.media.map(row => [row.id, row.sha256]));
    const clips = nativeRoomSpeechClips({ package: fixture.input.package, config });
    assert.ok(clips);
    const bound = new Set();
    for (const presentation of accepted) {
      assert.equal(presentation.language, LANGUAGE);
      const enriched = withSpeechTakes(withFilmedSteps(presentation, material), clips);
      for (const event of enriched.events) {
        if (!['deal', 'reveal', 'speak'].includes(event.type)) continue;
        const take = event.type === 'speak' ? event.speechTake : event.filmedTake;
        assert.ok(take, `${event.type}: ${event.family}`);
        const row = records.get(take.id);
        assert.ok(row);
        assert.equal(row.classification.dealerId, DEALER);
        assert.equal(take.sha256, row.sha256);
        assert.equal(listed.get(take.id), take.sha256, 'selected bytes belong to the frozen material');
        if (event.type === 'speak') {
          assert.equal(row.classification.recordedSpeech.lineId, event.line);
          assert.equal(row.classification.recordedSpeech.language, LANGUAGE);
        } else {
          assert.equal(take.profileId, fixture.profile.id);
          assert.equal(fixture.profile.takes.find(item => item.key === take.takeKey)?.sha256, take.sha256);
        }
        bound.add(event.family);
      }
    }
    for (const family of ['speak.goodluck/goodluck', 'speak.insurance/insurance', 'speak.other/win',
      'speak.other/dealerbust', 'speak.other/placebets', 'deal.player.left/box1',
      'deal.player.centre/box4', 'deal.dealer/dealer-up', 'deal.dealer/dealer-hole', 'reveal.dealer/dealer-hole'])
      assert.ok(bound.has(family), family);
    assert.equal(nativeRoomSpeechClips({ package: { ...fixture.input.package, operatorId: 'another-operator' }, config }), null);
    assert.equal(nativeRoomSpeechClips({ package: fixture.input.package, config: { ...config, language: 'en' } }), null);
  });
  return { pool, checks };
}
