import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DRAGAN_KEVIN_PROFILE as profile } from '../packages/presentation/contracts/filmed-profiles/kevin-dragan-f15b2af1.mjs';
import { planFilmedTimeline } from '../packages/presentation/runtime/filmed-deal-timeline.mjs';
import { nativeRoomFilmedPlanning } from '../packages/presentation/contracts/native-room-filmed-planning.mjs';
import { withFilmedSteps, withSpeechTakes, createFilmedStepReader } from '../services/game/shared-room-filmed-steps.mjs';
import { createSharedRoomChannel } from '../services/game/shared-room-channel.mjs';
import { selectSharedRoomPresentation } from '../services/game/shared-room-presentation-selection.mjs';
import { createEmptyProject, addDealer } from '../packages/presentation/contracts/studio-model.mjs';
import { nativeRoomMaterialFixture, withNativeFilmTransitions } from './fixtures/native-room-game-material.mjs';
import { resolveNativeRoomGameMaterial } from '../packages/presentation/server/native-room-game-material.mjs';
import { nativeRoomSpeechClips } from '../packages/presentation/server/native-room-speech-clips.mjs';
import { readPackagePresentation } from '../packages/presentation/server/presentation-package.mjs';
import { frozenPlaybackProject } from '../packages/presentation/contracts/frozen-dealer-playback.mjs';
import { canonicalStudioJson } from '../packages/studio-registry/server/document-contract.mjs';
import { NATIVE_ROOM_SPEECH_SLOTS } from '../packages/presentation/contracts/native-room-game-budget.mjs';
import { selectPresentation } from '../services/game/presentation-selection.mjs';

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

// Speech lag (preview 28 Oct 2026): every spoken line waited for POST select (0.9-4.3 s) before its file was asked
// for. The engine's plan and betting window now carry each line's standard clip as speechTake { id, sha256 }.
const hashJson = value => createHash('sha256').update(canonicalStudioJson(value)).digest('hex');
function speechRoom(dealerId = 'paow') {
  const f = withNativeFilmTransitions(nativeRoomMaterialFixture({ dealerId }));
  const speechMaterial = resolveNativeRoomGameMaterial(f.input, { version: 2 }), pack = f.input.package;
  const config = { configVersion: 'room-config-' + '1'.repeat(8) + '-1111-4111-8111-' + '1'.repeat(12), roomId: f.input.room.id, operatorId: pack.operatorId,
    packageRevision: pack.revision, presentationLaneId: f.input.room.presentationLaneId, presentationHash: hashJson(readPackagePresentation(pack)),
    language: 'sv', material: speechMaterial };
  return { f, pack, config, dealerId, material: speechMaterial };
}

test('a native room\'s speech clips are exactly what POST select chooses for each line in the off mode', async () => {
  const { f, pack, config, dealerId, material: speechMaterial } = speechRoom();
  const clips = nativeRoomSpeechClips({ package: pack, config });
  assert.deepEqual(Object.keys(clips).sort(), [...NATIVE_ROOM_SPEECH_SLOTS].sort(), 'every slot of the native room has its clip');
  // POST select's own path (shared-room-presentation-selection.mjs) over the frozen package, as frozen-dealer-presentation.mjs resolves it.
  const presentation = readPackagePresentation(pack), context = { operatorSlug: 'north', roomId: config.roomId, packageRevision: pack.revision, dealerId };
  const project = frozenPlaybackProject(presentation.playback, { registeredDealers: presentation.registeredDealers, projectRevision: presentation.projectRevision });
  const records = presentation.playback.media.filter(row => row.classification.dealerId === dealerId);
  const videos = records.map(row => ({ id: row.id, dealer: dealerId, sha256: row.sha256, bytes: row.size, available: true, integrity: 'verified', eventId: row.classification.eventId,
    playbackType: 'once', fileName: row.classification.label, classification: structuredClone(row.classification) }));
  const frozen = { context, dealer: { id: dealerId }, project, inventory: { videos, families: [] }, projectRevision: presentation.projectRevision,
    configurationSource: 'operator-package-v3', lane: { openclaw: { speak: 'off', idle: 'off' } } };
  const frozenDealerContext = { resolve: async () => frozen, publicVideo: (_frozen, id) => {
    const row = records.find(item => item.id === id);
    return row ? { id: row.id, sha256: row.sha256, fileName: row.classification.label, src: '/api/presentation/room-video/' + ['north', config.roomId, pack.revision, dealerId, row.id].join('/'),
      recordedSpeech: structuredClone(row.classification.recordedSpeech) } : null; } };
  for (const line of NATIVE_ROOM_SPEECH_SLOTS) {
    const event = { type: 'speak', line };
    const capture = { sourceEvent: event, published: [event], material: speechMaterial, configVersion: config.configVersion, version: 4, roomId: config.roomId, talkId: 'talk-4',
      language: 'sv', presentationContext: context, operatorId: pack.operatorId, packageRevision: pack.revision };
    const body = { dealerId, mode: 'off', version: 4, event, presentationContext: context, sharedRoom: { roomId: config.roomId, ver: 4, talkId: 'talk-4' } };
    const answer = await selectSharedRoomPresentation({ capture, body, frozenDealerContext, select: selectPresentation, request: null, playerId: 'alice', signal: new AbortController().signal });
    assert.deepEqual(clips[line], { id: answer.video.id, sha256: answer.video.sha256 }, line);
  }
  assert.ok(f.records.length > 10);
});

test('speech clips need the config\'s own package, presentation and native material; anything else gives none', () => {
  const { pack, config } = speechRoom();
  assert.equal(nativeRoomSpeechClips({ package: { ...pack, revision: pack.revision + 1 }, config }), null, 'another package revision');
  assert.equal(nativeRoomSpeechClips({ package: { ...pack, operatorId: 'operator-other' }, config }), null, 'another operator');
  assert.equal(nativeRoomSpeechClips({ package: pack, config: { ...config, presentationHash: 'f'.repeat(64) } }), null, 'another frozen presentation');
  assert.equal(nativeRoomSpeechClips({ package: pack, config: { ...config, material: { ...config.material, revision: 'casual-' + 'a'.repeat(16) } } }), null, 'not native material');
  assert.equal(nativeRoomSpeechClips({ package: null, config }), null);
  // A clip the config's material does not list is never offered.
  const listed = { ...config.material, media: config.material.media.filter(row => row.id !== nativeRoomSpeechClips({ package: pack, config }).goodluck.id) };
  assert.equal(Object.hasOwn(nativeRoomSpeechClips({ package: pack, config: { ...config, material: listed } }) ?? {}, 'goodluck'), false);
});

const speechWindow = (extra = {}) => ({ roomId: 'room-a', ver: 5, talkId: 'window-a:window', auditSeq: 10, kind: 'window', status: 'ready', windowId: 'window-a',
  configVersion: 'config-a', language: 'sv', startAt: 1000, endAt: 1000, lines: [], events: [{ type: 'speak', line: 'placebets', family: 'speak.other/placebets' }, { type: 'idle', family: 'idle' }], ...extra });
const speechClipsFixture = { placebets: { id: id(700), sha256: sha('placebets') }, goodluck: { id: id(701), sha256: sha('goodluck') } };

test('a plan and a betting window carry each spoken line\'s clip; other events, kinds and unknown lines are unchanged', () => {
  const window = withSpeechTakes(speechWindow(), speechClipsFixture);
  assert.deepEqual(window.events[0], { type: 'speak', line: 'placebets', family: 'speak.other/placebets', speechTake: speechClipsFixture.placebets });
  assert.deepEqual(window.events[1], { type: 'idle', family: 'idle' });
  const opened = withSpeechTakes(withFilmedSteps(plan(opening(null)), material), speechClipsFixture);
  assert.deepEqual(opened.events[0].speechTake, speechClipsFixture.goodluck);
  assert.ok(opened.events[1].filmedTake, 'the filmed choices stay');
  assert.deepEqual(opened.events.map(({ speechTake, ...event }) => event), withFilmedSteps(plan(opening(null)), material).events, 'nothing else changes');
  const lose = speechWindow({ events: [{ type: 'speak', line: 'lose' }] });
  assert.equal(withSpeechTakes(lose, speechClipsFixture), lose, 'a line without a clip');
  const collect = speechWindow({ kind: 'collect' });
  assert.equal(withSpeechTakes(collect, speechClipsFixture), collect);
  assert.equal(withSpeechTakes(speechWindow(), null).events[0].speechTake, undefined);
  for (const broken of [{ id: 'bad id', sha256: sha('x') }, { id: id(1), sha256: 'not-a-hash' }, null])
    assert.equal(withSpeechTakes(speechWindow(), { placebets: broken }).events[0].speechTake, undefined, 'a clip the channel would refuse is never attached');
});

test('the reader reads a config\'s package once for its speech clips; a failed read is neither fatal nor cached', async () => {
  const room = speechRoom();
  let packageReads = 0, failing = true;
  const enrich = createFilmedStepReader({ readConfig: async (roomId, version) => ({ ...room.config, roomId, configVersion: version }),
    readPackage: async (operatorId, revision) => { packageReads++; assert.deepEqual([operatorId, revision], [room.pack.operatorId, room.pack.revision]);
      if (failing) throw Error('unavailable'); return room.pack; } });
  const window = speechWindow({ roomId: room.config.roomId });
  assert.equal((await enrich(room.config.roomId, window)).events[0].speechTake, undefined, 'the window goes out; select remains');
  failing = false;
  const clips = nativeRoomSpeechClips({ package: room.pack, config: room.config });
  assert.deepEqual((await enrich(room.config.roomId, window)).events[0].speechTake, clips.placebets, 'the next read asks again');
  const opened = await enrich(room.config.roomId, plan([{ type: 'speak', line: 'goodluck', blocking: true }], { roomId: room.config.roomId, ver: 6, talkId: 'talk-6' }));
  assert.deepEqual(opened.events[0].speechTake, clips.goodluck);
  assert.equal(packageReads, 2, 'one successful read per config version');
  const silent = createFilmedStepReader({ readConfig: async (roomId, version) => ({ ...room.config, roomId, configVersion: version }),
    readPackage: async () => assert.fail('a plan without speech reads no package') });
  assert.equal((await silent(room.config.roomId, plan([deal(0, 1, '5')], { roomId: room.config.roomId }))).events[0].speechTake, undefined);
  const legacy = createFilmedStepReader({ readConfig: async (roomId, version) => ({ ...room.config, roomId, configVersion: version }) });
  assert.equal((await legacy(room.config.roomId, window)).events[0].speechTake, undefined, 'without the package port the window is unchanged');
});

test('sockets that read a new config at the same time share one package read; a shared failed read is retried later', async () => {
  const room = speechRoom();
  let packageReads = 0, failing = true, release;
  const gate = new Promise(resolve => { release = resolve; });
  const enrich = createFilmedStepReader({ readConfig: async (roomId, version) => ({ ...room.config, roomId, configVersion: version }),
    readPackage: async () => { packageReads++; await gate; if (failing) throw Error('unavailable'); return room.pack; } });
  const window = speechWindow({ roomId: room.config.roomId });
  const reads = Array.from({ length: 5 }, () => enrich(room.config.roomId, structuredClone(window)));
  release();
  for (const read of await Promise.all(reads)) assert.equal(read.events[0].speechTake, undefined, 'every socket gets the window; select remains');
  assert.equal(packageReads, 1, 'five sockets, one package read');
  failing = false;
  const clips = nativeRoomSpeechClips({ package: room.pack, config: room.config });
  const again = await Promise.all(Array.from({ length: 3 }, () => enrich(room.config.roomId, structuredClone(window))));
  for (const read of again) assert.deepEqual(read.events[0].speechTake, clips.placebets);
  assert.equal(packageReads, 2, 'the failed read was not kept; the next reads share one new read');
});

test('the channel sends a spoken line\'s clip to the player and refuses a malformed one', async t => {
  const origin = 'https://game.invalid', binding = { actorId: 'player-a', sessionId: 'session-a', operatorId: 'operator-a', roomId: 'room-a', packageRevision: 7, expiresAt: Date.now() + 60000 };
  const snapshot = { contract: 'blackjack-table/1', roomId: 'room-a', version: 1, presentationVer: 5, configVersion: 'config-a', windowId: 'window-a', phase: 'bets',
    roundId: null, turnSeq: 0, owners: Array(7).fill(null), seatGen: Array(7).fill(0), bets: Array.from({ length: 7 }, () => ({ main: 0, pp: 0, tp: 0 })),
    deadline: null, actionDeadline: null, plan: null, round: null, shoe: null, players: [], serverNow: 1000,
    me: { id: 'player-a', seats: [], memberGen: 0, active: false, available: 100, pausedUntil: null, insuranceDue: false, lastSettlement: null } };
  let presentation = withSpeechTakes(speechWindow({ lines: [{ index: 0, line: 'placebets', lineId: 'a'.repeat(32) }] }), speechClipsFixture);
  const channel = createSharedRoomChannel({ origin, authorize: async () => binding, revalidate: async () => binding,
    readSnapshot: async () => snapshot, readPresentation: async () => presentation });
  t.after(() => channel.close());
  const frames = [], closed = [];
  const socket = { readyState: 1, bufferedAmount: 0, listeners: {}, on(event, fn) { this.listeners[event] = fn; }, off() {},
    send(text, done) { frames.push(JSON.parse(text)); done?.(); }, close(code, reason) { closed.push({ code, reason }); this.readyState = 3; } };
  (await channel.prepare(new Request(`${origin}/shared-room/room-a`, { headers: { origin } }))).attach(socket);
  for (let n = 0; n < 50 && !frames.length && !closed.length; n++) await new Promise(setImmediate);
  assert.deepEqual(closed, []);
  assert.deepEqual(frames[0].presentation.events[0].speechTake, speechClipsFixture.placebets);
  presentation = { ...presentation, events: [{ ...presentation.events[0], speechTake: { id: 'bad id', sha256: sha('x') } }, presentation.events[1]] };
  channel.emitCommitted('room-a');
  for (let n = 0; n < 50 && !closed.length; n++) await new Promise(setImmediate);
  assert.deepEqual(closed, [{ code: 1011, reason: 'shared_room_unavailable' }]);
});
