// Pure transport boundary for coordinator.command(ctx, input), not an executor.
// Room and actor are server-selected. Snapshot projection remains owned by the
// shared room channel; never serialize a raw coordinator response beside this.
const fields = Object.freeze({
  join: ['memberGen', 'seats', 'seatGens'], leave: ['memberGen'],
  bet: ['windowId', 'seat', 'field', 'chip'], undo: ['windowId'], clear: ['windowId'],
  doubleBets: ['windowId'], allSeats: ['windowId', 'chip'], repeat: ['windowId'], ready: ['windowId'],
  act: ['roundId', 'turnSeq', 'box', 'handIndex', 'action'],
  insurance: ['roundId', 'phase', 'take'], next: ['roundId'], pause: [], refill: [],
  // K6: a viewer without a box at a full table waits for one; the channel only reads, so this is a command.
  wait: [],
});
const betting = new Set(['bet', 'undo', 'clear', 'doubleBets', 'allSeats', 'repeat']);
const invalidInput = 'shared_room_invalid_command';
const invalidResult = 'shared_room_invalid_result';
const fail = code => { throw Object.assign(new TypeError(code), { code }); };
const safe = value => Number.isSafeInteger(value) && value >= 0;
const seat = value => Number.isInteger(value) && value >= 0 && value < 7;
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const number = value => typeof value === 'number' && Number.isFinite(value);
const record = value => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
const operation = value => typeof value === 'string' && Object.hasOwn(fields, value);
function property(value, key, code) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail(code);
  return descriptor.value;
}
function jsonRecord(value, code) {
  if (!record(value)) fail(code);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail(code);
  }
  return value;
}
function list(value, min, max, accepts, code) {
  if (!Array.isArray(value) || value.length < min || value.length > max
    || Reflect.ownKeys(value).length !== value.length + 1) fail(code);
  const copy = [];
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value') || !accepts(descriptor.value)) fail(code);
    copy.push(descriptor.value);
  }
  return copy;
}
function seats(value, code) {
  const copy = list(value, 1, 7, seat, code);
  if (new Set(copy).size !== copy.length) fail(code);
  return Object.freeze(copy);
}
function generations(value, code) {
  jsonRecord(value, code);
  const copy = {};
  for (const key of Object.keys(value)) {
    if (!/^[0-6]$/.test(key) || !safe(value[key])) fail(code);
    copy[key] = value[key];
  }
  return Object.freeze(copy);
}
const accepts = {
  memberGen: safe, windowId: id, roundId: id, seat, box: seat, turnSeq: safe,
  handIndex: value => Number.isInteger(value) && value >= 0 && value < 28,
  field: value => ['main', 'pp', 'tp'].includes(value),
  chip: value => number(value) && value > 0,
  action: value => ['hit', 'stand', 'double', 'split'].includes(value),
  phase: value => value === 'insurance', take: value => typeof value === 'boolean',
};

/** Return the sole input passed to coordinator.command(serverContext, input).
 * No coercion, trimming, default arguments or seat sorting: the coordinator's
 * O01 receipt fingerprints the entire input. A partial seatGens record is valid
 * because it need only identify boxes being newly claimed; ownership/generation,
 * configured chips, balances, limits, deadlines and legal actions stay in K03.
 */
export function parseSharedRoomCommand(roomId, body) {
  if (typeof roomId !== 'string' || !/^[a-z0-9_-]{1,128}$/.test(roomId)) fail(invalidInput);
  jsonRecord(body, invalidInput);
  const op = property(body, 'op', invalidInput), commandId = property(body, 'commandId', invalidInput);
  if (!operation(op) || typeof commandId !== 'string' || !commandId || commandId.length > 100) fail(invalidInput);
  const expected = ['op', 'commandId', ...fields[op]];
  if (Object.keys(body).length !== expected.length || !expected.every(key => Object.hasOwn(body, key))) fail(invalidInput);
  const result = { roomId, op, commandId };
  for (const key of fields[op]) {
    const value = body[key];
    if (key === 'seats') result[key] = seats(value, invalidInput);
    else if (key === 'seatGens') result[key] = generations(value, invalidInput);
    else { if (!accepts[key](value)) fail(invalidInput); result[key] = value; }
  }
  return Object.freeze(result);
}

/** Project result only, not {result,replay,snapshot}. Private fields are never
 * traversed or spread. In particular ready.ledger/startedSeq, refill.ledgerId,
 * insurance.resolved.ledger, waitingOn and pause.rooms do not cross this boundary.
 */
export function projectSharedRoomCommandResult(raw) {
  if (!record(raw)) fail(invalidResult);
  const get = key => property(raw, key, invalidResult);
  const op = get('op');
  if (!operation(op)) fail(invalidResult);
  const result = { op };
  if (op === 'pause') {
    const until = get('pausedUntil'); if (!safe(until)) fail(invalidResult);
    return Object.freeze({ op, pausedUntil: until });
  }
  const version = get('version'); if (!safe(version)) fail(invalidResult);
  result.version = version;
  if (op === 'join') {
    const memberGen = get('memberGen'); if (!safe(memberGen)) fail(invalidResult);
    result.memberGen = memberGen; result.seats = seats(get('seats'), invalidResult);
    result.seatGen = Object.freeze(list(get('seatGen'), 7, 7, safe, invalidResult));
  } else if (betting.has(op)) {
    const reserved = get('reserved'); if (!number(reserved) || reserved < 0) fail(invalidResult);
    result.reserved = reserved;
  } else if (op === 'ready') {
    const started = get('started'); if (typeof started !== 'boolean') fail(invalidResult);
    result.started = started;
    if (started) { const roundId = get('roundId'); if (!id(roundId)) fail(invalidResult); result.roundId = roundId; }
  } else if (op === 'act' && Object.hasOwn(raw, 'debits')) {
    const debits = list(get('debits'), 0, 28, record, invalidResult);
    result.debits = Object.freeze(debits.map(row => {
      const kind = property(row, 'kind', invalidResult), amount = property(row, 'amount', invalidResult);
      if (!['double', 'split'].includes(kind) || !number(amount) || amount <= 0) fail(invalidResult);
      return Object.freeze({ kind, amount });
    }));
  } else if (op === 'wait') {
    const waiting = get('waiting'); if (typeof waiting !== 'boolean') fail(invalidResult);
    result.waiting = waiting;
  }
  return Object.freeze(result);
}
