import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DRAGAN_KEVIN_PROFILE as profile } from '../packages/presentation/contracts/filmed-profiles/kevin-dragan-f15b2af1.mjs';
import { planFilmedTimeline } from '../packages/presentation/runtime/filmed-deal-timeline.mjs';
import { nativeRoomFilmedPlanning } from '../packages/presentation/contracts/native-room-filmed-planning.mjs';
import { withFilmedSteps, createFilmedStepReader } from '../services/game/shared-room-filmed-steps.mjs';
import { createSharedRoomChannel } from '../services/game/shared-room-channel.mjs';
import { selectSharedRoomPresentation } from '../services/game/shared-room-presentation-selection.mjs';
import { createEmptyProject, addDealer } from '../packages/presentation/contracts/studio-model.mjs';

// K04 F5c: the server attaches each filmed step's choice to the committed plan, so a client
// can play a decision's first step without waiting for POST select (median 3.3 s in staging).
const sha = text => createHash('sha256').update(text).digest('hex');
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const toShoe = { id: id(900), sha256: sha('to-shoe'), durationMs: 1000 }, fromShoe = { id: id(901), sha256: sha('from-shoe'), durationMs: 1000 };
const material = { revision: 'native-film-v2-' + 'c'.repeat(64), dealerId: 'dragan', language: 'sv', leadMs: 1500, cardMs: 1800,
  media: [...profile.takes.map((take, index) => ({ id: id(index + 1), sha256: take.sha256 })), { id: toShoe.id, sha256: toShoe.sha256 }, { id: fromShoe.id, sha256: fromShoe.sha256 }],
  film: { schemaVersion: 1, profileId: profile.id, transitions: { toShoe, fromShoe } } };
const card = (r, s = '♠') => ({ r, s });
const deal = (box, shoeDraw, r) => ({ type: 'deal', to: 'box', box, handIndex: 0, shoeDraw, faceDown: false, card: { ...card(r), shoeDraw }, clip: { action: 'deal-centre' }, family: 'deal' });
const dealer = (shoeDraw, r, faceDown = false) => ({ type: 'deal', to: 'dealer', box: null, handIndex: 0, shoeDraw, faceDown,
  card: faceDown ? null : { ...card(r), shoeDraw }, clip: { action: 'deal-dealer' }, family: 'deal' });
const plan = (events, extra = {}) => ({ roomId: 'room-a', ver: 4, talkId: 'talk-4', auditSeq: 9, kind: 'plan', status: 'ready', windowId: 'window-a',
  configVersion: 'config-a', language: 'sv', startAt: 1000, endAt: 30000, lines: [], events, ...extra });
const opening = holeCard => [{ type: 'speak', line: 'goodluck', blocking: true, family: 'goodluck' }, deal(0, 1, '5'), dealer(2, 'K'), deal(0, 3, '9'),
  { ...dealer(4, null, true), card: holeCard }];

test('a native filmed plan carries the exact take and shoe clips the client timeline and select choose', () => {
  const enriched = withFilmedSteps(plan(opening(null)), material);
  const planning = nativeRoomFilmedPlanning(material);
  const timeline = planFilmedTimeline({ ...planning, events: opening(null), startAt: 1000, endAt: 30000 });
  assert.equal(timeline.complete, true, timeline.reason);
  assert.equal(enriched.events[0].filmedTake, undefined, 'speech has no filmed step');
  for (const [index, step] of timeline.eventIndex) {
    const event = enriched.events[index], media = material.media.find(row => row.sha256 === step.sha256);
    assert.deepEqual(event.filmedTake, { profileId: profile.id, takeKey: step.takeKey, id: media.id, sha256: step.sha256 }, `event ${index}`);
    assert.deepEqual(Object.keys(event.filmedTransitions), ['before', 'after']);
  }
  assert.deepEqual(enriched.events[1].filmedTransitions, { before: { id: toShoe.id, sha256: toShoe.sha256 }, after: null });
  // The committed plan is otherwise unchanged.
  assert.deepEqual(enriched.events.map(({ filmedTake, filmedTransitions, ...rest }) => rest), plan(opening(null)).events);
});

test('the step choices never depend on the hole card and never add its value', () => {
  const hidden = withFilmedSteps(plan(opening(null)), material);
  for (const holeCard of [{ r: 'A', s: '♥', shoeDraw: 4 }, { r: '2', s: '♣', shoeDraw: 4 }]) {
    const leaked = withFilmedSteps(plan(opening(holeCard)), material);
    assert.deepEqual(leaked.events.map(event => [event.filmedTake, event.filmedTransitions]), hidden.events.map(event => [event.filmedTake, event.filmedTransitions]));
    assert.equal(JSON.stringify(leaked.events[4].filmedTake).includes(holeCard.r === 'A' ? '"A"' : '"2"'), false);
  }
});

test('old material, an incomplete plan or another kind is passed on unchanged so select remains the path', () => {
  const original = plan(opening(null));
  assert.equal(withFilmedSteps(original, { ...material, revision: 'native-film-v1-' + 'c'.repeat(64) }), original);
  assert.equal(withFilmedSteps(original, { ...material, media: material.media.slice(0, 1) }), original);
  assert.equal(withFilmedSteps({ ...original, kind: 'window' }, material).events, original.events);
  assert.equal(withFilmedSteps(original, null), original);
});

test('the reader caches frozen config per version and a config failure never withholds the plan', async () => {
  let reads = 0, failing = false;
  const enrich = createFilmedStepReader({ readConfig: async (roomId, version) => { reads++; if (failing) throw Error('unavailable');
    return { roomId, configVersion: version, material }; } });
  const first = await enrich('room-a', plan(opening(null)));
  assert.ok(first.events[1].filmedTake); await enrich('room-a', plan(opening(null))); assert.equal(reads, 1);
  failing = true; const other = plan(opening(null), { configVersion: 'config-b' });
  assert.equal(await enrich('room-a', other), other);
  const foreign = createFilmedStepReader({ readConfig: async () => ({ roomId: 'room-b', configVersion: 'config-a', material }) });
  assert.equal((await foreign('room-a', plan(opening(null)))).events[1].filmedTake, undefined);
});

test('the channel sends the choices to the player and refuses malformed ones', async t => {
  const origin = 'https://game.invalid', binding = { actorId: 'player-a', sessionId: 'session-a', operatorId: 'operator-a', roomId: 'room-a', packageRevision: 7, expiresAt: Date.now() + 60000 };
  const snapshot = { contract: 'blackjack-table/1', roomId: 'room-a', version: 1, presentationVer: 4, configVersion: 'config-a', windowId: 'window-a', phase: 'round',
    roundId: 'round-a', turnSeq: 0, owners: ['player-a', null, null, null, null, null, null], seatGen: [1, 0, 0, 0, 0, 0, 0], bets: Array.from({ length: 7 }, () => ({ main: 0, pp: 0, tp: 0 })),
    deadline: null, actionDeadline: null, plan: null, round: null, shoe: null, players: [], serverNow: 1000,
    me: { id: 'player-a', seats: [0], memberGen: 1, active: true, available: 100, pausedUntil: null, insuranceDue: false, lastSettlement: null } };
  let presentation = withFilmedSteps(plan(opening(null)), material);
  const channel = createSharedRoomChannel({ origin, authorize: async () => binding, revalidate: async () => binding,
    readSnapshot: async () => snapshot, readPresentation: async () => presentation });
  t.after(() => channel.close());
  const frames = [], closed = [];
  const socket = { readyState: 1, bufferedAmount: 0, listeners: {}, on(event, fn) { this.listeners[event] = fn; }, off() {},
    send(text, done) { frames.push(JSON.parse(text)); done?.(); }, close(code, reason) { closed.push({ code, reason }); this.readyState = 3; } };
  (await channel.prepare(new Request(`${origin}/shared-room/room-a`, { headers: { origin } }))).attach(socket);
  for (let n = 0; n < 50 && !frames.length && !closed.length; n++) await new Promise(setImmediate);
  assert.deepEqual(closed, []);
  assert.deepEqual(frames[0].presentation.events[4].filmedTake, presentation.events[4].filmedTake);
  assert.equal(frames[0].presentation.events[4].card, null);
  presentation = { ...presentation, events: presentation.events.map((event, index) => index === 1 ? { ...event, filmedTake: { ...event.filmedTake, sha256: 'not-a-hash' } } : event) };
  channel.emitCommitted('room-a');
  for (let n = 0; n < 50 && !closed.length; n++) await new Promise(setImmediate);
  assert.deepEqual(closed, [{ code: 1011, reason: 'shared_room_unavailable' }]);
});

test('the enriched plan is computed once per (room, ver) for every socket and update', async () => {
  let reads = 0, planned = 0;
  const enrich = createFilmedStepReader({ readConfig: async (roomId, version) => { reads++;
    return { roomId, configVersion: version, material: new Proxy(material, { get(target, key) { if (key === 'film') planned++; return target[key]; } }) }; } });
  // The receiver returns a freshly parsed object on every read.
  const results = [];
  for (let socket = 0; socket < 5; socket++) results.push(await enrich('room-a', structuredClone(plan(opening(null)))));
  assert.equal(reads, 1); assert.equal(planned > 0, true); const once = planned;
  for (let socket = 0; socket < 5; socket++) results.push(await enrich('room-a', structuredClone(plan(opening(null)))));
  assert.equal(planned, once, 'no planning after the first read of this plan version');
  assert.ok(results.every(value => value === results[0]));
  const next = await enrich('room-a', structuredClone(plan(opening(null), { ver: 5, talkId: 'talk-5' })));
  assert.notEqual(next, results[0]); assert.ok(planned > once, 'a new plan version is planned');
  // Same key but different committed events (never expected): recomputed, not reused.
  const changed = plan(opening(null)); changed.events = changed.events.slice(0, 3);
  assert.equal((await enrich('room-a', changed)).events.length, 3);
});

test('a record the channel would refuse never reaches the frame: the plan goes out unchanged and select remains', () => {
  for (const change of [row => ({ ...row, id: 'bad id with spaces' }), row => ({ ...row, id: '-leading-dash' })]) {
    const broken = { ...material, media: material.media.map((row, index) => index === 0 ? change(row) : row) };
    let result;
    try { result = withFilmedSteps(plan(opening(null)), broken); } catch (error) { assert.fail(String(error)); }
    assert.ok(result.events.every(event => event.filmedTake === undefined), 'unchanged plan; select remains');
  }
});

// Equivalence with POST select for a native v2 room whose package registers one video per file.
test('the frame choice equals the select answer: same take, sha256 and video id', async () => {
  const stillMaterial = { ...material, media: material.media.filter(row => ![toShoe.id, fromShoe.id].includes(row.id)),
    film: { ...material.film, transitions: { toShoe: null, fromShoe: null } } };
  const project = addDealer(createEmptyProject(), 'dragan', 'dragan');
  const line = project.lines.find(row => row.dealerId === 'dragan');
  line.variants = stillMaterial.media.map((row, index) => ({ ...structuredClone(line.variants[0]), id: `dragan.fixture.${index}`, videoGenerationId: row.id }));
  const videos = stillMaterial.media.map(row => ({ id: row.id, dealer: 'dragan', sha256: row.sha256, available: true, fileName: `${row.id}.mp4`, contentType: 'video/mp4',
    classification: { dealerId: 'dragan', eventId: line.eventId, kind: 'action', role: 'standard', situation: '', playback: 'once', label: 'take', notes: '' } }));
  const context = { operatorSlug: 'north', roomId: 'room-a', packageRevision: 7, dealerId: 'dragan' };
  const frozen = { context, dealer: { id: 'dragan' }, project, inventory: { videos, families: [] }, projectRevision: 'frozen-7', configurationSource: 'operator-package-v3', lane: { openclaw: {} } };
  const frozenDealerContext = { resolve: async () => frozen, publicVideo: (_frozen, videoId) => {
    const row = videos.find(item => item.id === videoId);
    return row ? { id: row.id, sha256: row.sha256, fileName: row.fileName, src: '/api/presentation/room-video/' + ['north', 'room-a', 7, 'dragan', row.id].join('/') } : null; } };
  const committed = plan(opening(null)), enriched = withFilmedSteps(committed, stillMaterial);
  let compared = 0;
  for (const [index, event] of committed.events.entries()) {
    if (!['deal', 'reveal'].includes(event.type)) continue;
    const capture = { sourceEvent: event, published: committed.events, material: stillMaterial, configVersion: 'config-a', version: 4, roomId: 'room-a',
      talkId: 'talk-4', language: 'sv', presentationContext: context, operatorId: 'operator-a', packageRevision: 7 };
    const body = { dealerId: 'dragan', mode: 'off', version: 4, event, presentationContext: context, sharedRoom: { roomId: 'room-a', ver: 4, talkId: 'talk-4' } };
    const answer = await selectSharedRoomPresentation({ capture, body, frozenDealerContext, select: async () => assert.fail('no Director for a filmed step'),
      request: null, playerId: 'alice', signal: new AbortController().signal });
    const own = enriched.events[index].filmedTake;
    assert.deepEqual({ profileId: own.profileId, takeKey: own.takeKey }, answer.video.filmedTake, `event ${index}`);
    assert.equal(own.id, answer.video.id); assert.equal(own.sha256, answer.video.sha256);
    assert.deepEqual(enriched.events[index].filmedTransitions, { before: answer.transitions.before && { id: answer.transitions.before.id, sha256: answer.transitions.before.sha256 },
      after: answer.transitions.after && { id: answer.transitions.after.id, sha256: answer.transitions.after.sha256 } });
    compared++;
  }
  assert.equal(compared, 4);
});
