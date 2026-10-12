import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { ROULETTE_RULES, describePocket, createSpinResult } from '../web/games/roulette/index.mjs';

const scope = { operatorId: 'sg-test', roomId: 'roulette-1', roundId: 'round-123' };
// Indexed by number, independently of the generator's red-number set.
const colors = 'g r b r b r b r b r b b r b r b r b r r b r b r b r b r b b r b r b r b r'.split(' ');
const colorNames = { g: 'green', r: 'red', b: 'black' };

test('all 37 European pockets have the correct fixed color, including zero', () => {
  assert.deepEqual(ROULETTE_RULES, {
    variant: 'european-single-zero', minNumber: 0, maxNumber: 36, pocketCount: 37,
  });
  for (let number = 0; number < colors.length; number++) {
    const pocket = describePocket(number);
    assert.deepEqual(pocket, { number, color: colorNames[colors[number]] });
    assert.ok(Object.isFrozen(pocket));
  }
  assert.equal(colors.length, 37);
  assert.equal(colors.filter(color => color === 'r').length, 18);
  assert.equal(colors.filter(color => color === 'b').length, 18);
  assert.ok(Object.isFrozen(ROULETTE_RULES));
});

test('invalid pockets are rejected without coercion', () => {
  for (const value of [-1, -0, 37, 0.5, NaN, Infinity, '0', '00', null, undefined, true, {}, 1n]) {
    assert.throws(() => describePocket(value), RangeError);
  }
});

test('each spin makes exactly one unbiased-range crypto draw and preserves every possible number', t => {
  let next = 0;
  const rng = t.mock.method(crypto, 'randomInt', (...args) => {
    assert.deepEqual(args, [0, 37]);
    return next++;
  });
  for (let number = 0; number <= 36; number++) {
    const event = createSpinResult({ ...scope, roundId: `round-${number}` });
    assert.deepEqual(event.outcome, { number, color: colorNames[colors[number]] });
  }
  assert.equal(rng.mock.callCount(), 37);
});

test('result is immutable, JSON-safe and scoped to operator, room and round', t => {
  t.mock.method(crypto, 'randomInt', () => 0);
  const before = Date.now();
  const event = createSpinResult(Object.freeze({ ...scope }));
  assert.deepEqual(Object.keys(event).sort(), [
    'schemaVersion', 'type', 'eventId', 'game', 'variant', 'operatorId', 'roomId', 'roundId', 'occurredAt', 'outcome',
  ].sort());
  assert.equal(event.schemaVersion, 1);
  assert.equal(event.type, 'roulette.spin.resolved');
  assert.equal(event.game, 'roulette');
  assert.equal(event.variant, 'european-single-zero');
  for (const field of Object.keys(scope)) assert.equal(event[field], scope[field]);
  assert.match(event.eventId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(new Date(event.occurredAt).toISOString(), event.occurredAt);
  assert.ok(Date.parse(event.occurredAt) >= before && Date.parse(event.occurredAt) <= Date.now());
  assert.deepEqual(event.outcome, { number: 0, color: 'green' });
  assert.deepEqual(JSON.parse(JSON.stringify(event)), event);
  assert.throws(() => { event.roomId = 'other-room'; }, TypeError);
  assert.throws(() => { event.outcome.number = 10; }, TypeError);
});

test('repeated numbers are legal and each call draws anew, with no hidden round cache', t => {
  const rng = t.mock.method(crypto, 'randomInt', () => 17);
  const first = createSpinResult(scope);
  const second = createSpinResult(scope);
  const otherRoom = createSpinResult({ ...scope, operatorId: 'other-operator', roomId: 'other-room' });
  assert.deepEqual(first.outcome, second.outcome);
  assert.deepEqual(first.outcome, otherRoom.outcome);
  assert.notEqual(first.eventId, second.eventId);
  assert.equal(otherRoom.operatorId, 'other-operator');
  assert.equal(otherRoom.roomId, 'other-room');
  assert.equal(rng.mock.callCount(), 3);
});

test('invalid scope and outcome-control fields fail before consuming entropy', t => {
  const rng = t.mock.method(crypto, 'randomInt', () => { throw Error('must not draw'); });
  const uuid = t.mock.method(crypto, 'randomUUID', () => { throw Error('must not create event'); });
  for (const context of [undefined, null, [], 'room', 123]) {
    assert.throws(() => createSpinResult(context), TypeError);
  }
  for (const field of Object.keys(scope)) {
    for (const value of [undefined, null, '', ' room', 'room ', 'a/b', 'a\nb', 'å', 'x'.repeat(101), 1, {}]) {
      assert.throws(() => createSpinResult({ ...scope, [field]: value }), TypeError);
    }
  }
  for (const field of ['seed', 'number', 'outcome', 'weights', 'variant']) {
    assert.throws(() => createSpinResult({ ...scope, [field]: 0 }), /Unknown roulette context field/);
  }
  assert.equal(rng.mock.callCount(), 0);
  assert.equal(uuid.mock.callCount(), 0);
});

test('valid boundary-length IDs and existing ID punctuation are preserved', t => {
  t.mock.method(crypto, 'randomInt', () => 36);
  const input = { operatorId: 'a', roomId: 'r'.repeat(100), roundId: 'round.1:part_2-3' };
  const event = createSpinResult(input);
  for (const field of Object.keys(input)) assert.equal(event[field], input[field]);
});

test('crypto failure aborts without emitting an event or falling back', t => {
  const failure = new Error('entropy unavailable');
  t.mock.method(crypto, 'randomInt', () => { throw failure; });
  const uuid = t.mock.method(crypto, 'randomUUID', () => { throw Error('must not create event'); });
  assert.throws(() => createSpinResult(scope), error => error === failure);
  assert.equal(uuid.mock.callCount(), 0);
});

test('real Node crypto produces valid result events', () => {
  const event = createSpinResult(scope);
  assert.deepEqual(event.outcome, describePocket(event.outcome.number));
});
