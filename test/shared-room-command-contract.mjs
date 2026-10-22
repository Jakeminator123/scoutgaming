import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSharedRoomCommand, projectSharedRoomCommandResult } from '../services/game/shared-room-command-contract.mjs';
import { createTableCoordinator } from '../services/game/games/blackjack/table/coordinator.mjs';
import { fingerprint } from '../services/game/games/blackjack/table/ports.mjs';
import { createMemoryTableStore } from './fixtures/blackjack-table-memory-store.mjs';
import { deterministicRandom } from './fixtures/blackjack-deterministic-random.mjs';

const room = 'room-1';
const commands = {
  join: { memberGen: 0, seats: [3, 1], seatGens: { 1: 0, 3: 0 } }, leave: { memberGen: 1 },
  bet: { windowId: 'window:1', seat: 3, field: 'main', chip: 5 },
  undo: { windowId: 'window:1' }, clear: { windowId: 'window:1' }, doubleBets: { windowId: 'window:1' },
  allSeats: { windowId: 'window:1', chip: 5 }, repeat: { windowId: 'window:1' }, ready: { windowId: 'window:1' },
  act: { roundId: 'round:1', turnSeq: 3, box: 3, handIndex: 2, action: 'stand' },
  insurance: { roundId: 'round:1', phase: 'insurance', take: false }, next: { roundId: 'round:1' }, pause: {}, refill: {},
};
const body = (op, fields = {}) => ({ op, commandId: `request-${op}`, ...structuredClone(commands[op]), ...fields });
const denied = fn => assert.throws(fn, { code: 'shared_room_invalid_command' });
function setup() {
  const store = createMemoryTableStore();
  const table = createTableCoordinator({ store, clock: { now: () => 100000 }, random: deterministicRandom('command-contract') });
  store.test.fund('alice', 1000); store.test.fund('bob', 1000);
  const send = (actorId, value) => table.command({ actorId }, parseSharedRoomCommand(room, value));
  return { store, table, send };
}

test('each coordinator operation has an explicit required input shape and a server-owned room', () => {
  for (const [op, fields] of Object.entries(commands)) {
    const value = body(op), before = structuredClone(value), parsed = parseSharedRoomCommand(room, value);
    assert.deepEqual(parsed, { roomId: room, ...before }); assert.deepEqual(value, before);
    for (const key of ['op', 'commandId', ...Object.keys(fields)]) {
      const missing = { ...value }; delete missing[key]; denied(() => parseSharedRoomCommand(room, missing));
    }
  }
});

test('identity overrides, unknown fields and fields from other operations are rejected before a caller can dispatch', () => {
  let effects = 0;
  const dispatch = value => { const parsed = parseSharedRoomCommand(room, value); effects++; return parsed; };
  const fields = ['actorId', 'roomId', 'configVersion', 'name', 'session', 'sessionId', 'digest', 'snapshot', 'ledgerId', 'unknown'];
  for (const op of Object.keys(commands)) {
    for (const key of fields) denied(() => dispatch({ ...body(op), [key]: room }));
  }
  for (const value of [body('pause', { memberGen: 0 }), body('refill', { chip: 500 }), body('ready', { roundId: 'round:1' }), body('insurance', { takeBoxes: [3] })]) denied(() => dispatch(value));
  denied(() => dispatch(JSON.parse('{"op":"pause","commandId":"x","__proto__":{"actorId":"bob"}}')));
  assert.equal(effects, 0);
});

test('only plain JSON records are accepted and accessors, symbols and non-data input are not evaluated', () => {
  for (const value of [null, [], 'pause', 1, new Date(), Object.create(body('pause')), Object.assign(Object.create(null), body('pause'))]) denied(() => parseSharedRoomCommand(room, value));
  let read = false;
  const getter = { commandId: 'x' }; Object.defineProperty(getter, 'op', { enumerable: true, get() { read = true; return 'pause'; } });
  denied(() => parseSharedRoomCommand(room, getter)); assert.equal(read, false);
  const symbol = body('pause'); symbol[Symbol('private')] = true; denied(() => parseSharedRoomCommand(room, symbol));
  const hidden = body('pause'); Object.defineProperty(hidden, 'actorId', { value: 'bob' }); denied(() => parseSharedRoomCommand(room, hidden));
});

test('room and command IDs preserve existing coordinator limits without trimming or rewriting request identity', () => {
  for (const id of ['', 'ROOM', 'room:1', 'room/a', 'x'.repeat(129), null]) denied(() => parseSharedRoomCommand(id, body('pause')));
  assert.equal(parseSharedRoomCommand('x'.repeat(128), body('pause')).roomId.length, 128);
  for (const commandId of ['', 7, null, 'x'.repeat(101)]) denied(() => parseSharedRoomCommand(room, body('pause', { commandId })));
  const commandId = '  räknare / 1  ';
  assert.equal(parseSharedRoomCommand(room, body('pause', { commandId })).commandId, commandId);
  assert.equal(parseSharedRoomCommand(room, body('pause', { commandId: 'x'.repeat(100) })).commandId.length, 100);
});

test('join retains partial generation records and seat order; nested fields and generation bounds are strict', () => {
  const parsed = parseSharedRoomCommand(room, body('join', { memberGen: 1, seatGens: { 1: 2 } }));
  assert.deepEqual(parsed.seats, [3, 1]); assert.deepEqual(parsed.seatGens, { 1: 2 });
  assert.deepEqual(parseSharedRoomCommand(room, body('join', { seatGens: {} })).seatGens, {});
  for (const seats of [[], [0, 0], [7], [-1], [0.5], ['0'], [0, 1, 2, 3, 4, 5, 6, 7]]) denied(() => parseSharedRoomCommand(room, body('join', { seats })));
  for (const memberGen of [-1, 0.5, '1', Number.MAX_SAFE_INTEGER + 1, null]) denied(() => parseSharedRoomCommand(room, body('join', { memberGen })));
  for (const seatGens of [[], { 7: 0 }, { '01': 0 }, { actorId: 1 }, { 1: -1 }, { 1: '0' }, { 1: Number.MAX_SAFE_INTEGER + 1 }]) denied(() => parseSharedRoomCommand(room, body('join', { seatGens })));
  assert.equal(parseSharedRoomCommand(room, body('leave', { memberGen: Number.MAX_SAFE_INTEGER })).memberGen, Number.MAX_SAFE_INTEGER);
});

test('operation scalar types are strict while configured chips and current state remain server decisions', () => {
  for (const fields of [{ seat: 7 }, { seat: '3' }, { field: 'balance' }, { chip: 0 }, { chip: -1 }, { chip: Infinity }, { chip: '5' }, { windowId: '' }]) denied(() => parseSharedRoomCommand(room, body('bet', fields)));
  for (const fields of [{ turnSeq: -1 }, { turnSeq: '3' }, { box: 7 }, { handIndex: 28 }, { handIndex: 0.1 }, { action: 'surrender' }, { roundId: '' }]) denied(() => parseSharedRoomCommand(room, body('act', fields)));
  for (const fields of [{ take: 0 }, { take: 'false' }, { phase: 'decisions' }]) denied(() => parseSharedRoomCommand(room, body('insurance', fields)));
  assert.equal(parseSharedRoomCommand(room, body('bet', { chip: 0.5 })).chip, 0.5);
  assert.equal(parseSharedRoomCommand(room, body('bet', { chip: 50001 })).chip, 50001);
  for (const action of ['hit', 'stand', 'double', 'split']) assert.equal(parseSharedRoomCommand(room, body('act', { action })).action, action);
});

test('normalization copies nested data, preserves fingerprint semantics and adds no client-selected identity', () => {
  const value = body('join'), parsed = parseSharedRoomCommand(room, value);
  value.seats.reverse(); value.seatGens[1] = 99;
  assert.deepEqual(parsed.seats, [3, 1]); assert.equal(parsed.seatGens[1], 0);
  const reordered = { seatGens: { 3: 0, 1: 0 }, seats: [3, 1], memberGen: 0, commandId: 'request-join', op: 'join' };
  assert.equal(fingerprint({ actorId: 'alice', input: parsed }), fingerprint({ actorId: 'alice', input: parseSharedRoomCommand(room, reordered) }));
  assert.notEqual(fingerprint(parsed), fingerprint(parseSharedRoomCommand(room, body('join', { seats: [1, 3] }))));
  assert.throws(() => { parsed.seats.push(0); }, TypeError);
  assert.throws(() => { parsed.roomId = 'other'; }, TypeError);
});

test('actual coordinator replay, changed-input rejection and pre-dispatch refusal keep idempotency and effects intact', async () => {
  const h = setup(); await h.send('alice', body('join', { seats: [0], seatGens: { 0: 0 } }));
  const snapshot = await h.table.snapshot(room, 'alice');
  const value = body('bet', { seat: 0, windowId: snapshot.windowId, commandId: 'same-id' });
  const first = await h.send('alice', value), count = h.store.test.audit().length;
  const replay = await h.send('alice', { chip: 5, seat: 0, field: 'main', windowId: snapshot.windowId, commandId: 'same-id', op: 'bet' });
  assert.equal(replay.replay, true); assert.deepEqual(replay.result, first.result); assert.equal(h.store.test.audit().length, count);
  await assert.rejects(h.send('alice', { ...value, chip: 10 }), { code: 'REQUEST_REUSED' });
  const before = { receipts: h.store.test.receipts(), audit: h.store.test.audit(), ledger: h.store.test.ledger(), snapshot: await h.table.snapshot(room, 'alice') };
  denied(() => h.send('alice', { ...value, commandId: 'forged', actorId: 'bob' }));
  assert.deepEqual({ receipts: h.store.test.receipts(), audit: h.store.test.audit(), ledger: h.store.test.ledger(), snapshot: await h.table.snapshot(room, 'alice') }, before);
});

test('the parser leaves chip selection, stale membership and window ownership to the coordinator', async () => {
  const h = setup(); await h.send('alice', body('join', { seats: [0], seatGens: { 0: 0 } }));
  const snapshot = await h.table.snapshot(room, 'alice');
  await assert.rejects(h.send('alice', body('bet', { seat: 0, chip: 7, windowId: snapshot.windowId })), { code: 'INVALID_CHIP' });
  await assert.rejects(h.send('alice', body('bet', { seat: 0, windowId: 'stale-window' })), { code: 'STALE_COMMAND' });
  await assert.rejects(h.send('alice', body('leave', { memberGen: 0 })), { code: 'STALE_COMMAND' });
});

test('result projection has explicit public fields and never traverses private ledger/audit/shoe data', () => {
  const fixtures = [
    [{ op: 'join', version: 1, memberGen: 2, seats: [3], seatGen: [0, 0, 0, 2, 0, 0, 0] }, { op: 'join', version: 1, memberGen: 2, seats: [3], seatGen: [0, 0, 0, 2, 0, 0, 0] }],
    [{ op: 'ready', version: 2, started: true, roundId: 'round:1', ledger: { alice: 'secret', bob: 'secret' }, startedSeq: 7 }, { op: 'ready', version: 2, started: true, roundId: 'round:1' }],
    [{ op: 'ready', version: 3, started: false, waitingOn: 'bob' }, { op: 'ready', version: 3, started: false }],
    [{ op: 'refill', version: 4, ledgerId: 'secret' }, { op: 'refill', version: 4 }],
    [{ op: 'insurance', version: 5, resolved: { ledger: { bob: 'secret' } } }, { op: 'insurance', version: 5 }],
    [{ op: 'act', version: 6, debits: [{ kind: 'double', amount: 5, ledgerId: 'secret' }] }, { op: 'act', version: 6, debits: [{ kind: 'double', amount: 5 }] }],
    [{ op: 'pause', pausedUntil: 900000, rooms: ['room-1', 'other-room'], ledgerId: 'secret' }, { op: 'pause', pausedUntil: 900000 }],
  ];
  for (const op of ['bet', 'undo', 'clear', 'doubleBets', 'allSeats', 'repeat']) fixtures.push([{ op, version: 5, reserved: 10 }, { op, version: 5, reserved: 10 }]);
  for (const op of ['leave', 'next']) fixtures.push([{ op, version: 5 }, { op, version: 5 }]);
  let reads = 0;
  for (const [raw, expected] of fixtures) {
    Object.defineProperty(raw, 'shoeProof', { enumerable: true, get() { reads++; throw Error('private'); } });
    Object.defineProperty(raw, 'audit', { enumerable: true, get() { reads++; throw Error('private'); } });
    assert.deepEqual(projectSharedRoomCommandResult(raw), expected);
  }
  assert.equal(reads, 0);
});

test('malformed known result fields fail closed and projected collections never alias the source', () => {
  const bad = value => assert.throws(() => projectSharedRoomCommandResult(value), { code: 'shared_room_invalid_result' });
  for (const value of [null, [], { op: 'unknown' }, { op: 'next', version: -1 }, { op: 'ready', version: 1, started: 'true' }, { op: 'ready', version: 1, started: true }, { op: 'bet', version: 1, reserved: NaN }, { op: 'pause', pausedUntil: null }, { op: 'join', version: 1, memberGen: 1, seats: [0], seatGen: [0] }, { op: 'act', version: 1, debits: [{ kind: 'payout', amount: 1 }] }]) bad(value);
  const raw = { op: 'join', version: 1, memberGen: 1, seats: [0], seatGen: Array(7).fill(0) };
  const projected = projectSharedRoomCommandResult(raw); raw.seats[0] = 6; raw.seatGen[0] = 100;
  assert.deepEqual(projected.seats, [0]); assert.equal(projected.seatGen[0], 0);
});

test('a real multi-player start result drops every ledger and audit identity without changing stored state', async () => {
  const h = setup(); await h.send('alice', body('join', { seats: [0], seatGens: { 0: 0 } }));
  await h.send('bob', body('join', { commandId: 'join-bob', seats: [1], seatGens: { 1: 0 } }));
  const windowId = (await h.table.snapshot(room, 'alice')).windowId;
  await h.send('alice', body('bet', { seat: 0, windowId })); await h.send('bob', body('bet', { commandId: 'bet-bob', seat: 1, windowId }));
  await h.send('bob', body('ready', { commandId: 'ready-bob', windowId }));
  const raw = await h.send('alice', body('ready', { windowId }));
  assert.deepEqual(Object.keys(raw.result.ledger).sort(), ['alice', 'bob']); assert.equal(typeof raw.result.startedSeq, 'number');
  const before = structuredClone(raw), ledger = h.store.test.ledger();
  assert.deepEqual(projectSharedRoomCommandResult(raw.result), { op: 'ready', version: raw.result.version, started: true, roundId: raw.result.roundId });
  assert.deepEqual(raw, before); assert.deepEqual(h.store.test.ledger(), ledger);
});
