import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { createHash } from 'node:crypto';
import { setImmediate as turn } from 'node:timers/promises';
import { createSharedRoomPresentationAccess } from '../services/game/shared-room-presentation-access.mjs';
import { createPostgresPresentationReceiver } from '../services/game/games/blackjack/presentation/postgres-receiver.mjs';
import { createPostgresTableRuntime } from '../services/game/games/blackjack/table/postgres-runtime.mjs';
import { createPostgresStore } from '../packages/storage/server/postgres-store.mjs';
import { createStudioRepository } from '../packages/studio-registry/server/document-repository.mjs';

const clone = value => structuredClone(value);
const roomId = 'room-a', playerId = 'alice';
const context = { operatorSlug: 'operator-a', roomId, packageRevision: 1, dealerId: 'astrid' };
const binding = { actorId: playerId, sessionId: 'player-' + 'a'.repeat(64), operatorId: 'operator-id', roomId, packageRevision: 2, expiresAt: 9999999999999 };
const cardEvent = { type: 'deal', to: 'box', box: 0, handIndex: 0, shoeDraw: 1, card: { r: 'K', s: 'H' }, faceDown: false };
const body = () => ({ dealerId: 'astrid', mode: 'off', version: 7, event: { ...cardEvent, card: { r: 'A', s: 'S' } },
  presentationContext: clone(context), sharedRoom: { roomId, ver: 7, talkId: 'talk-a' }, shoeTransitions: true });
const state = () => ({ room: { roomId, presentationVer: 7, configVersion: 'config-a', windowId: 'window-a' },
  presentation: { roomId, ver: 7, talkId: 'talk-a', status: 'ready', kind: 'plan', configVersion: 'config-a', windowId: 'window-a',
    language: 'en', events: [clone(cardEvent), { type: 'speak', line: 'goodluck' }], lines: [{ index: 1, line: 'goodluck', lineId: 'b'.repeat(32) }] },
  config: { roomId, operatorId: binding.operatorId, packageRevision: 1, configVersion: 'config-a', language: 'en', leadMs: 700, cardMs: 500,
    material: { revision: 'material-a', dealerId: 'astrid', language: 'en', leadMs: 700, cardMs: 500,
      media: [{ id: 'video-a', sha256: 'a'.repeat(64) }] } } });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const isCode = expected => error => error?.code === expected;
const args = overrides => ({ request: { headers: new Headers({ cookie: 'private-session' }) }, playerId, body: body(), ...overrides });

function fixture({ authorize, revalidate, onRead, commitFailure, timeoutMs, maxResultBytes } = {}) {
  const stored = state(), trace = [], counters = { transactions: 0, active: false, locked: false };
  const access = {
    async authorize(request, options) {
      trace.push('authorize'); assert.equal(counters.active, false); assert.equal(options.roomId, roomId);
      return authorize ? authorize(request, options) : clone(binding);
    },
    async revalidateLocked(value, options) {
      trace.push('auth'); assert.equal(counters.active, true); assert.equal(counters.locked, true);
      assert.deepEqual(value, binding); return revalidate ? revalidate(value, options) : clone(value);
    },
    async readPresentationContextLocked(value,options) {
      trace.push('context');assert.equal(counters.active,true);assert.equal(counters.locked,true);
      assert.equal(options.configVersion,stored.room?.configVersion??null);await onRead?.('context',counters.transactions);
      return {config:clone(stored.config),context:{...context,packageRevision:stored.config.packageRevision,dealerId:stored.config.material.dealerId},saved:{},authority:{}};
    },
  };
  const repository = { async sharedTransaction(work, options) {
    assert.deepEqual(options, { serialize: true }); assert.equal(counters.active, false);
    counters.transactions++; counters.active = true; trace.push('G', 'S');
    try { const value = await work(); if (commitFailure && counters.transactions === 2) throw commitFailure; trace.push('COMMIT'); return value; }
    catch (error) { trace.push('ROLLBACK'); throw error; }
    finally { counters.active = false; }
  } };
  const withLockedRead = async (plan, work) => {
    assert.equal(counters.active, true); assert.deepEqual(plan, { rooms: [roomId], players: [playerId] });
    counters.locked = true; trace.push('R', 'P', 'A');
    try { return await work(Object.freeze({
      async room(id) { trace.push('room'); assert.equal(id, roomId); await onRead?.('room', counters.transactions); return clone(stored.room); },
      async config(id, version) { trace.push('config'); assert.equal(id, roomId); assert.equal(version, stored.presentation.configVersion);
        await onRead?.('config', counters.transactions); return clone(stored.config); },
    })); } finally { counters.locked = false; }
  };
  const readPresentationLocked = async id => {
    trace.push('presentation'); assert.equal(id, roomId); assert.equal(counters.locked, true);
    await onRead?.('presentation', counters.transactions); return clone(stored.presentation);
  };
  const helper = createSharedRoomPresentationAccess({ access, repository, withLockedRead, readPresentationLocked,createContext:()=>Object.freeze({}),
    ...(timeoutMs ? { timeoutMs } : {}), ...(maxResultBytes ? { maxResultBytes } : {}) });
  return { helper, stored, trace, counters };
}

test('two captures authorize before data and select outside G/S/R/P/A; callback sees only immutable safe metadata', async () => {
  const h = fixture(); let selected;
  const output = await h.helper.withSharedCommittedReceipt(args(), (capture, { signal }) => {
    h.trace.push('select'); assert.equal(h.counters.active, false); assert.equal(h.counters.locked, false); assert.equal(signal.aborted, false);
    assert.deepEqual(Object.keys(capture).sort(), ['configVersion', 'language', 'material', 'operatorId', 'packageRevision', 'presentationContext',
      'published', 'roomId', 'sourceEvent', 'talkId', 'version'].sort());
    assert.equal(capture.sourceEvent.card.r, 'K', 'browser supplied A must not replace committed K');
    assert.equal(capture.packageRevision,1,'the active config chooses its original package although authorization observes package 2');
    assert.equal(Object.isFrozen(capture.material.media[0]), true); assert.equal(Object.isFrozen(capture.published), true);
    assert.throws(() => { capture.material.media[0].sha256 = 'b'.repeat(64); }, TypeError);
    selected = { video: { id: capture.material.media[0].id }, sourceEvent: capture.sourceEvent };
    return selected;
  });
  assert.deepEqual(output, selected); assert.notEqual(output, selected); assert.notEqual(output.video, selected.video);
  assert.deepEqual(h.trace, ['authorize', 'G', 'S', 'R', 'P', 'A', 'auth', 'room', 'presentation', 'config', 'context', 'COMMIT', 'select',
    'G', 'S', 'R', 'P', 'A', 'auth', 'room', 'presentation', 'config', 'context', 'COMMIT']);
  assert.equal(h.counters.transactions, 2);
});

test('shared selector identity requires exact room/version/talk/context and has no native fallback', async () => {
  for (const mutate of [
    value => { delete value.sharedRoom; }, value => { value.sharedRoom.extra = true; }, value => { value.sharedRoom.roomId = 'other'; },
    value => { value.sharedRoom.ver++; }, value => { value.presentationContext.dealerId = 'other'; },
    value => { value.sharedRoom.roomId = '../other'; }, value => { value.presentationContext.roomId = 'other'; },
    value => { value.presentationContext.extra = true; }, value => { value.actorId = 'other'; },
  ]) {
    const h = fixture(), request = args(); mutate(request.body);
    await assert.rejects(h.helper.withSharedCommittedReceipt(request, () => assert.fail('selector called')), isCode('shared_room_presentation_invalid'));
    assert.deepEqual(h.trace, []);
  }
  for (const value of [null, [], 'body']) {
    await assert.rejects(fixture().helper.withSharedCommittedReceipt(args({ body: value }), () => {}), isCode('shared_room_presentation_invalid'));
  }
});

test('actor/invalid publication and locked revocation stop before any room, config or presentation read', async () => {
  for (const alternate of [{ ...binding, actorId: 'mallory' }, { ...binding, packageRevision: 0 }]) {
    const h = fixture({ authorize: () => alternate });
    await assert.rejects(h.helper.withSharedCommittedReceipt(args(), () => {}), isCode('shared_room_presentation_forbidden'));
    assert.deepEqual(h.trace, ['authorize']);
  }
  const revoked = Object.assign(Error('revoked'), { code: 'revoked' });
  const h = fixture({ revalidate: () => { throw revoked; } });
  await assert.rejects(h.helper.withSharedCommittedReceipt(args(), () => {}), error => error === revoked);
  assert.equal(h.trace.includes('room'), false); assert.equal(h.trace.at(-1), 'ROLLBACK');
});

test('missing/stale/legacy K04 and wrong frozen config or material refuse selection', async () => {
  for (const mutate of [
    stored => { stored.presentation = null; }, stored => { stored.presentation.ver++; }, stored => { stored.presentation.talkId = 'other'; },
    stored => { stored.presentation.status = 'legacy'; }, stored => { stored.room.presentationVer--; },
    stored => { stored.room.configVersion = 'other'; }, stored => { stored.config.configVersion = 'other'; },
    stored => { stored.config.roomId = 'other'; }, stored => { stored.config.operatorId = 'other'; },
    stored => { stored.config.material.dealerId = 'other'; }, stored => { stored.config.material.language = 'sv'; },
    stored => { stored.config.material.media[0].sha256 = 'invalid'; }, stored => { stored.config.cardMs++; },
  ]) {
    const h = fixture(); mutate(h.stored);
    await assert.rejects(h.helper.withSharedCommittedReceipt(args(), () => assert.fail('selector called')), isCode('shared_room_presentation_stale'));
    assert.equal(h.counters.transactions, 1); assert.equal(h.trace.at(-1), 'ROLLBACK');
  }
});

test('speak must be committed; ambiguous or absent events cannot fabricate a fallback line', async () => {
  const h = fixture(), request = args(); request.body.event = { type: 'speak', line: 'goodluck', extra: 'browser' };
  await h.helper.withSharedCommittedReceipt(request, capture => {
    assert.deepEqual(capture.sourceEvent, { type: 'speak', line: 'goodluck' }); return { video: null };
  });
  for (const mutate of [
    value => { value.body.event.line = 'fabricated'; }, value => { value.body.event = { type: 'idle' }; },
  ]) {
    const denied = args(); denied.body.event = { type: 'speak', line: 'goodluck' }; mutate(denied);
    await assert.rejects(fixture().helper.withSharedCommittedReceipt(denied, () => {}), isCode('shared_room_presentation_stale'));
  }
  const duplicate = fixture(); duplicate.stored.presentation.events.push({ type: 'speak', line: 'goodluck' });
  await assert.rejects(duplicate.helper.withSharedCommittedReceipt(request, () => {}), isCode('shared_room_presentation_stale'));
});

test('committed face-down cards remain hidden from selected and published event metadata', async () => {
  const h = fixture(); h.stored.presentation.events[0].faceDown = true;
  await h.helper.withSharedCommittedReceipt(args(), capture => {
    assert.equal(capture.sourceEvent.card, null); assert.equal(capture.published[0].card, null); return { video: null };
  });
});

test('revocation during unlocked selection prevents final reads and result release', async () => {
  let revoked = false;
  const h = fixture({ revalidate: value => { if (revoked) throw Object.assign(Error('revoked'), { code: 'revoked' }); return clone(value); } });
  await assert.rejects(h.helper.withSharedCommittedReceipt(args(), () => { revoked = true; return { video: 'private' }; }), isCode('revoked'));
  assert.equal(h.trace.filter(item => item === 'room').length, 1); assert.equal(h.trace.at(-1), 'ROLLBACK');
});

test('lost lease and same-identity presentation/material changes between captures cannot release a selection', async () => {
  for (const mutate of [
    stored => { stored.presentation.ver++; stored.room.presentationVer++; }, stored => { stored.presentation.talkId = 'other'; },
    stored => { stored.presentation.events.push({ type: 'speak', line: 'win' }); },
    stored => { stored.presentation.lines[0].lineId = 'c'.repeat(32); },
    stored => { stored.config.material.media[0].sha256 = 'b'.repeat(64); },
    stored => { stored.config.material.revision = 'material-new'; }, stored => { stored.config.additional = 'changed'; },
  ]) {
    const h = fixture();
    await assert.rejects(h.helper.withSharedCommittedReceipt(args(), () => { mutate(h.stored); return { video: null }; }), isCode('shared_room_presentation_stale'));
    assert.equal(h.counters.transactions, 2); assert.equal(h.trace.at(-1), 'ROLLBACK');
  }
});

test('mutating caller-owned context during selection cannot change the frozen admitted request', async () => {
  const h = fixture(), request = args();
  const result = await h.helper.withSharedCommittedReceipt(request, capture => {
    request.body.presentationContext.roomId = 'other'; request.body.sharedRoom.ver = 900;
    assert.deepEqual(capture.presentationContext, context); return { video: null };
  });
  assert.deepEqual(result, { video: null });
});

test('callback failures, malformed/oversized results and final COMMIT failure cannot return successful data', async () => {
  const fault = Error('selector failed');
  await assert.rejects(fixture().helper.withSharedCommittedReceipt(args(), () => { throw fault; }), error => error === fault);
  for (const output of [{ bad: undefined }, { video: 'x'.repeat(257) }, { get video() { assert.fail('Getter must not run'); } }]) {
    const h = fixture({ maxResultBytes: 256 });
    await assert.rejects(h.helper.withSharedCommittedReceipt(args(), () => output), isCode('shared_room_presentation_unavailable'));
  }
  const commitFailure = Error('connection lost on commit'), h = fixture({ commitFailure });
  await assert.rejects(h.helper.withSharedCommittedReceipt(args(), () => ({ video: null })), error => error === commitFailure);
  assert.equal(h.trace.at(-1), 'ROLLBACK');
});

test('abort is checked before admission and after every read; pending callback timeout cleans all own listeners', async () => {
  const before = new AbortController(); before.abort(); const untouched = fixture();
  await assert.rejects(untouched.helper.withSharedCommittedReceipt(args({ signal: before.signal }), () => {}), { name: 'AbortError' });
  assert.deepEqual(untouched.trace, []); assert.equal(getEventListeners(before.signal, 'abort').length, 0);
  for (const phase of ['room', 'presentation', 'config', 'context']) {
    const controller = new AbortController(), h = fixture({ onRead: name => { if (name === phase) controller.abort(); } });
    await assert.rejects(h.helper.withSharedCommittedReceipt(args({ signal: controller.signal }), () => assert.fail('selector called')), { name: 'AbortError' });
    assert.equal(h.trace.at(-1), 'ROLLBACK'); assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  }
  const h = fixture({ timeoutMs: 10 }), external = new AbortController(); let callbackSignal;
  await assert.rejects(h.helper.withSharedCommittedReceipt(args({ signal: external.signal }), (_capture, { signal }) => {
    callbackSignal = signal; return new Promise(() => {});
  }), { name: 'AbortError' });
  assert.equal(h.counters.transactions, 1); assert.equal(callbackSignal.aborted, true);
  assert.equal(getEventListeners(callbackSignal, 'abort').length, 0); assert.equal(getEventListeners(external.signal, 'abort').length, 0);
});

test('abort during the final SQL phase drains its outstanding read then rolls back without releasing data', async () => {
  const entered = deferred(), release = deferred(), controller = new AbortController();
  const h = fixture({ onRead: async (name, phase) => {
    if (name === 'room' && phase === 2) { entered.resolve(); await release.promise; }
  } });
  let settled = false;
  const pending = h.helper.withSharedCommittedReceipt(args({ signal: controller.signal }), () => ({ video: null })).finally(() => { settled = true; });
  await entered.promise; controller.abort(); await turn();
  assert.equal(settled, false); assert.equal(h.counters.active, true);
  release.resolve(); await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(h.counters.active, false); assert.equal(h.trace.at(-1), 'ROLLBACK');
  assert.equal(h.trace.filter(item => item === 'presentation').length, 1);
});

function sqlFixture({ failReceiver, commitFailureAt = 0 } = {}) {
  const calls = [], clients = [], stored = state(); let commits = 0;
  const pool = { async query() { assert.fail('No raw pool query'); }, async connect() {
    const client = { id: clients.length + 1, released: false, async query(sql, values = []) {
      calls.push({ client: this.id, sql, values });
      if (sql === 'COMMIT') { if (++commits === commitFailureAt) throw Error('commit failed'); return { command: 'COMMIT', rows: [] }; }
      if (sql.includes('SELECT id FROM croupier_game.players')) return { rows: [{ id: values[0] }] };
      if (sql.includes('SELECT body FROM croupier_game.shared_table_rooms')) return { rows: [{ body: JSON.stringify(stored.room) }] };
      if (sql.includes('SELECT body FROM croupier_game.shared_table_configs')) return { rows: [{ body: JSON.stringify(stored.config) }] };
      if (sql.includes('FROM croupier_game.shared_table_presentation_receiver')) {
        if (failReceiver) throw failReceiver;
        return { rows: [{ body: JSON.stringify({ presentation: stored.presentation }) }] };
      }
      return { rows: [] };
    }, release() { assert.equal(this.released, false); this.released = true; } };
    clients.push(client); return client;
  } };
  const storage = createPostgresStore({ pool }), scope = { environment: 'test', workspaceId: 'shared-presentation' };
  const repository = createStudioRepository({ pool, scope });
  const runtime = createPostgresTableRuntime({ pool: storage.gamePool, walletMode: 'demo', random: {} });
  const receiver = createPostgresPresentationReceiver({ pool: storage.gamePool });
  return { calls, clients, stored, pool, storage, scope, repository, runtime, receiver };
}

test('currentLocked uses the shared G/S/R/P/A client and FOR SHARE without another transaction or data write', async () => {
  const h = sqlFixture(); let captured;
  const value = await h.repository.sharedTransaction(() => h.runtime.withLockedRead({ rooms: [roomId], players: [playerId] }, async reader => {
    captured = reader; assert.deepEqual(Object.keys(reader), ['room', 'config']); assert.equal(Object.isFrozen(reader), true);
    await reader.room(roomId); await reader.config(roomId, 'config-a'); return h.receiver.currentLocked(roomId);
  }), { serialize: true });
  assert.deepEqual(value, h.stored.presentation); assert.equal(h.clients.length, 1); assert.equal(h.clients[0].released, true);
  assert.equal(h.calls.filter(call => call.sql === 'BEGIN').length, 1); assert.equal(h.calls.filter(call => call.sql === 'COMMIT').length, 1);
  const locks = h.calls.filter(call => call.sql.includes('pg_advisory_xact_lock') || call.sql.includes('FOR UPDATE') || call.sql.includes('FOR SHARE'));
  assert.equal(locks[0].sql, 'SELECT pg_advisory_xact_lock(1129467984)');
  assert.deepEqual(locks[3].values, [playerId]);
  assert.ok(locks.at(-1).sql.endsWith('FOR SHARE')); assert.deepEqual(locks.at(-1).values, [roomId]);
  const roomHash = createHash('sha256').update(`croupier-shared-table\0room\0${roomId}`).digest();
  assert.deepEqual(locks[2].values, [roomHash.readInt32BE(0), roomHash.readInt32BE(4)]);
  assert.equal(h.calls.some(call => /INSERT|UPDATE croupier|DELETE/.test(call.sql)), false);
  assert.throws(() => captured.room(roomId), /read is closed/); assert.throws(() => captured.config(roomId, 'config-a'), /read is closed/);
});

test('locked receiver refuses absent/foreign/unserialized/undeclared shared contexts without another checkout', async () => {
  const absent = sqlFixture(); await assert.rejects(absent.receiver.currentLocked(roomId), /locked room/); assert.equal(absent.clients.length, 0);
  for (const mode of ['foreign', 'unserialized', 'undeclared']) {
    const h = sqlFixture(), other = sqlFixture();
    await assert.rejects(h.repository.sharedTransaction(() => h.runtime.withLockedRead({ rooms: [roomId], players: [playerId] }, () => {
      const read = mode === 'foreign' ? other.receiver : h.receiver;
      return read.currentLocked(mode === 'undeclared' ? 'other' : roomId);
    }), { serialize: mode !== 'unserialized' }));
    assert.equal(h.clients.length, 1); assert.equal(other.clients.length, 0); assert.equal(h.calls.at(-1).sql, 'ROLLBACK');
  }
});

test('real adapters compose both helper captures, while SQL failures preserve identity and prevent selector execution', async () => {
  const h = sqlFixture();
  const helper = createSharedRoomPresentationAccess({ repository: h.repository, withLockedRead: h.runtime.withLockedRead,
    createContext:()=>Object.freeze({}),readPresentationLocked: h.receiver.currentLocked, access: { async authorize() { return clone(binding); }, async revalidateLocked(value) {
      h.storage.db.assertSharedTransaction({ studioScope: h.scope, serialize: true }); return clone(value);
    },async readPresentationContextLocked(){h.storage.db.assertSharedTransaction({studioScope:h.scope,serialize:true});return{config:clone(h.stored.config),context:clone(context),saved:{},authority:{}};} } });
  assert.deepEqual(await helper.withSharedCommittedReceipt(args(), () => {
    assert.equal(h.clients[0].released, true); return { video: null };
  }), { video: null });
  assert.equal(h.clients.length, 2); assert.ok(h.clients.every(client => client.released));
  const failReceiver = Object.assign(Error('receiver SQL unavailable'), { code: '08006' }), broken = sqlFixture({ failReceiver });
  await assert.rejects(broken.repository.sharedTransaction(() => broken.runtime.withLockedRead({ rooms: [roomId], players: [playerId] },
    () => broken.receiver.currentLocked(roomId)), { serialize: true }), error => error === failReceiver);
  assert.equal(broken.calls.at(-1).sql, 'ROLLBACK');
});

test('presentation access refuses an existing transaction owner so selection can never inherit outer SQL locks', async () => {
  for (const ordinary of [false, true]) {
    const h = sqlFixture(); let authorized = false, selected = false;
    const helper = createSharedRoomPresentationAccess({ repository: h.repository, withLockedRead: h.runtime.withLockedRead,
      readPresentationLocked: h.receiver.currentLocked, access: { async authorize() { authorized = true; return clone(binding); },
        async revalidateLocked(value) { return value; },async readPresentationContextLocked(){assert.fail('outer owner must fail before a context read');} } });
    const work = () => helper.withSharedCommittedReceipt(args(), () => { selected = true; return {}; });
    await assert.rejects(ordinary ? h.repository.transaction(work) : h.repository.sharedTransaction(work, { serialize: true }),
      ordinary ? isCode('studio_storage_unavailable') : /outer unit/);
    assert.equal(authorized, false); assert.equal(selected, false); assert.equal(h.clients.length, 1);
    assert.equal(h.calls.at(-1).sql, 'ROLLBACK');
  }
});

test('bootstrap uses the engine window and active package even after later publication; unopened uses only current head',async()=>{
  const h=fixture(),input={request:args().request,playerId,roomId,expected:{configVersion:'config-a',windowId:'window-a'}};
  const first=await h.helper.withActiveRoomPresentation(input,(capture)=>{
    assert.equal(h.counters.active,false);assert.equal(capture.packageRevision,1);assert.deepEqual(capture.presentationContext,context);return capture;
  });
  assert.equal(first.configVersion,'config-a');assert.equal(first.windowId,'window-a');
  h.stored.room=null;h.stored.config.configVersion='config-b';h.stored.config.packageRevision=2;
  const unopened=await h.helper.withActiveRoomPresentation({...input,expected:{configVersion:'config-b',windowId:'unopened'}},capture=>capture);
  assert.equal(unopened.windowId,'unopened');assert.equal(unopened.configVersion,'config-b');assert.equal(unopened.presentationContext.packageRevision,2);
  h.stored.room={roomId,configVersion:'config-b',windowId:'window-b'};
  const next=await h.helper.withActiveRoomPresentation({...input,expected:{configVersion:'config-b',windowId:'window-b'}},capture=>capture);
  assert.equal(next.packageRevision,2);assert.equal(next.windowId,'window-b');
});

test('bootstrap and shared selection treat client package/window/config values only as stale preconditions',async()=>{
  for(const expected of [{configVersion:'config-b',windowId:'window-a'},{configVersion:'config-a',windowId:'window-b'}]) {
    const h=fixture();await assert.rejects(h.helper.withActiveRoomPresentation({request:args().request,playerId,roomId,expected},()=>assert.fail('stale bootstrap selected')),
      isCode('shared_room_presentation_stale'));
  }
  const h=fixture(),requested={...context,packageRevision:2};
  await assert.rejects(h.helper.withActiveRoomPresentation({request:args().request,playerId,roomId,presentationContext:requested},()=>assert.fail('later package selected')),
    isCode('shared_room_presentation_stale'));
  const input=args();input.body.presentationContext=requested;
  await assert.rejects(h.helper.withSharedCommittedReceipt(input,()=>assert.fail('mixed active material and later branding selected')),isCode('shared_room_presentation_stale'));
});

test('active config exposes only its validated frozen v2 film material and rechecks it after unlocked work',async()=>{
  const h=fixture(),input={request:args().request,playerId,roomId};
  const legacy=await h.helper.withActiveRoomPresentation(input,capture=>capture);
  assert.equal(Object.hasOwn(legacy,'filmedMaterial'),false);
  h.stored.config.material.revision='native-film-v2-'+'c'.repeat(64);
  h.stored.config.material.film={schemaVersion:1,profileId:'fixture-profile',transitions:{toShoe:null,fromShoe:null}};
  const result=await h.helper.withActiveRoomPresentation(input,capture=>{
    assert.equal(Object.isFrozen(capture.filmedMaterial.film.transitions),true);return capture;
  });
  assert.deepEqual(result.filmedMaterial,h.stored.config.material);
  await assert.rejects(h.helper.withActiveRoomPresentation(input,capture=>{
    h.stored.config.material.film.profileId='changed-profile';return capture;
  }),isCode('shared_room_presentation_stale'));
  h.stored.config.material.film.transitions.toShoe={id:'unbound',sha256:'d'.repeat(64),durationMs:1000};
  await assert.rejects(h.helper.withActiveRoomPresentation(input,()=>assert.fail('invalid frozen film exposed')),isCode('shared_room_presentation_stale'));
});

test('private responses are cancelled after unlocked revocation or a window change before final capture',async()=>{
  for(const revoke of [true,false]) {
    let revoked=false,cancelled=0;
    const h=fixture({revalidate:value=>{if(revoked)throw Object.assign(Error('revoked'),{code:'revoked'});return clone(value);}});
    await assert.rejects(h.helper.withActiveRoomPresentation({request:args().request,playerId,roomId},()=>{
      assert.equal(h.counters.active,false);
      if(revoke)revoked=true;else h.stored.room.windowId='window-next';
      return new Response(new ReadableStream({cancel(){cancelled++;}}),{headers:{etag:'"sha256-'+ 'a'.repeat(64)+'"'}});
    }),isCode(revoke?'revoked':'shared_room_presentation_stale'));
    assert.equal(cancelled,1);assert.equal(h.counters.active,false);
  }
});

test('a late unlocked response is cancelled after timeout even when its provider ignores abort',async()=>{
  const release=deferred(),entered=deferred(),h=fixture({timeoutMs:10});let cancelled=0;
  const work=h.helper.withActiveRoomPresentation({request:args().request,playerId,roomId},async()=>{
    entered.resolve();await release.promise;return new Response(new ReadableStream({cancel(){cancelled++;}}));
  });
  await entered.promise;await assert.rejects(work,{name:'AbortError'});release.resolve();await turn();
  assert.equal(cancelled,1);assert.equal(h.counters.transactions,1);
});

test('a response remains owned when abort lands between the settled provider and lease continuation',async()=>{
  const h=fixture(),controller=new AbortController();let cancelled=0;
  await assert.rejects(h.helper.withActiveRoomPresentation({request:args().request,playerId,roomId,signal:controller.signal},()=>{
    queueMicrotask(()=>queueMicrotask(()=>controller.abort()));
    return new Response(new ReadableStream({cancel(){cancelled++;}}));
  }),{name:'AbortError'});
  await turn();assert.equal(cancelled,1);assert.equal(h.counters.active,false);
});

