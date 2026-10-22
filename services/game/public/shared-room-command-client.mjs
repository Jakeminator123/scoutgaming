// HTTP writes only. The WebSocket client owns snapshots and presentation.
const fields = {
  join: ['memberGen', 'seats', 'seatGens'], leave: ['memberGen'],
  bet: ['windowId', 'seat', 'field', 'chip'], undo: ['windowId'], clear: ['windowId'],
  doubleBets: ['windowId'], allSeats: ['windowId', 'chip'], repeat: ['windowId'], ready: ['windowId'],
  act: ['roundId', 'turnSeq', 'box', 'handIndex', 'action'],
  insurance: ['roundId', 'phase', 'take'], next: ['roundId'], pause: [], refill: [],
};
const betting = new Set(['bet', 'undo', 'clear', 'doubleBets', 'allSeats', 'repeat']);
const errorStatuses = {
  STALE_COMMAND: 409, REQUEST_REUSED: 409, ACTOR_REQUIRED: 401, AUTHORITY_REJECTED: 403,
  NOT_SEATED: 409, LEAVING: 409, PAUSED: 409, NOT_YOUR_TURN: 409, DEADLINE_PASSED: 409,
  INSURANCE_UNAVAILABLE: 409, INSURANCE_NOT_FUNDED: 409, BETTING_CLOSED: 409, READY: 409,
  NO_BETS: 409, NO_REPEAT: 409, LIMITS: 409, INSUFFICIENT_BALANCE: 409, SEAT_TAKEN: 409,
  CLEAR_FIRST: 409, NO_ROOM: 409, ILLEGAL_ACTION: 409, NO_ACTIVE_ROUND: 409, ROUND_IN_PROGRESS: 409, REFILL_REFUSED: 409,
  INVALID_CHIP: 400, INVALID_ROOM: 400, INVALID_SEATS: 400, REQUEST_ID_REQUIRED: 400,
  UNKNOWN_COMMAND: 400, NOT_YOUR_BOX: 403,
  shared_room_invalid_request: 400, shared_room_invalid_command: 400, shared_room_invalid_path: 400,
  shared_room_invalid_origin: 403, shared_room_method_not_allowed: 405, shared_room_body_too_large: 413,
  shared_room_json_required: 415, shared_room_authentication_required: 401, shared_room_forbidden: 403,
};
const safe = value => Number.isSafeInteger(value) && value >= 0;
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const seat = value => Number.isInteger(value) && value >= 0 && value < 7;
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const error = code => Object.assign(new TypeError(code), { code });
function record(value) {
  return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype
    && Reflect.ownKeys(value).every(key => typeof key === 'string' && Object.getOwnPropertyDescriptor(value, key)?.enumerable
      && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'));
}
const exact = (value, keys) => record(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
function list(value, min, max, accepts) {
  return Array.isArray(value) && value.length >= min && value.length <= max && Reflect.ownKeys(value).length === value.length + 1
    && Array.from({ length: value.length }, (_, i) => Object.getOwnPropertyDescriptor(value, String(i)))
      .every(desc => desc?.enumerable && Object.hasOwn(desc, 'value') && accepts(desc.value));
}
const seats = value => list(value, 1, 7, seat) && new Set(value).size === value.length;
const accepts = {
  memberGen: safe, windowId: id, roundId: id, seat, box: seat, turnSeq: safe,
  handIndex: value => Number.isInteger(value) && value >= 0 && value < 28,
  field: value => ['main', 'pp', 'tp'].includes(value), chip: positive,
  action: value => ['hit', 'stand', 'double', 'split'].includes(value),
  phase: value => value === 'insurance', take: value => typeof value === 'boolean',
  seats, seatGens: value => record(value) && Object.keys(value).every(key => /^[0-6]$/.test(key) && safe(value[key])),
};
function freeze(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
function intentCopy(value) {
  if (!record(value) || typeof value.op !== 'string' || !Object.hasOwn(fields, value.op) || !exact(value, ['op', ...fields[value.op]])
    || !fields[value.op].every(key => accepts[key](value[key]))) throw error('shared_room_invalid_command');
  return JSON.parse(JSON.stringify(value));
}
function validResult(value, op) {
  if (!record(value) || value.op !== op) return false;
  if (op === 'pause') return exact(value, ['op', 'pausedUntil']) && safe(value.pausedUntil);
  if (!safe(value.version)) return false;
  if (op === 'join') return exact(value, ['op', 'version', 'memberGen', 'seats', 'seatGen']) && safe(value.memberGen)
    && seats(value.seats) && list(value.seatGen, 7, 7, safe);
  if (betting.has(op)) return exact(value, ['op', 'version', 'reserved']) && typeof value.reserved === 'number'
    && Number.isFinite(value.reserved) && value.reserved >= 0;
  if (op === 'ready') return typeof value.started === 'boolean'
    && exact(value, value.started ? ['op', 'version', 'started', 'roundId'] : ['op', 'version', 'started'])
    && (!value.started || id(value.roundId));
  if (op === 'act' && Object.hasOwn(value, 'debits')) return exact(value, ['op', 'version', 'debits'])
    && list(value.debits, 0, 28, debit => exact(debit, ['kind', 'amount']) && ['double', 'split'].includes(debit.kind) && positive(debit.amount));
  return exact(value, ['op', 'version']);
}
function validEnvelope(value, intent, roomId) {
  if (!exact(value, ['result', 'replay', 'snapshot']) || typeof value.replay !== 'boolean' || !validResult(value.result, intent.op)) return false;
  const snapshot = value.snapshot;
  if (snapshot === null) return intent.op === 'pause';
  return record(snapshot) && snapshot.contract === 'blackjack-table/1' && snapshot.roomId === roomId
    && safe(snapshot.version) && safe(snapshot.presentationVer) && id(snapshot.configVersion) && id(snapshot.windowId)
    && record(snapshot.me) && id(snapshot.me.id);
}
const cancel = body => { try { void body?.cancel().catch(() => {}); } catch {} };
function requestSignal(options = {}) {
  if (!record(options) || !exact(options, Object.hasOwn(options, 'signal') ? ['signal'] : [])
    || options.signal !== undefined && !(options.signal instanceof AbortSignal)) throw error('shared_room_client_invalid_options');
  return options.signal;
}
async function readJson(response, operation, maxBytes) {
  if (!/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(response.headers.get('content-type') ?? '')) throw error('invalid_response');
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) > maxBytes)) throw error('invalid_response');
  const reader = response.body?.getReader();
  if (!reader) throw error('invalid_response');
  operation.reader = reader;
  let bytes = 0, text = '';
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    for (;;) {
      const next = await reader.read();
      if (operation.controller.signal.aborted) throw error('aborted');
      if (next.done) break;
      if (!(next.value instanceof Uint8Array)) throw error('invalid_response');
      bytes += next.value.byteLength;
      if (bytes > maxBytes) throw error('invalid_response');
      text += decoder.decode(next.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    cancel(reader); try { reader.releaseLock(); } catch {}
    if (operation.reader === reader) operation.reader = null;
  }
}

/** send(intent,{signal?}) creates one ID; uncertain permits only explicit retry.
 * Replies expose result/replay, never the validated snapshot. stop is terminal.
 * Injected fetch/UUID ports are for tests; request targets/options are fixed here.
 */
export function createSharedRoomCommandClient({ roomId, fetchImpl = globalThis.fetch?.bind(globalThis),
  randomUUID = () => globalThis.crypto.randomUUID(), timeoutMs = 10000, maxResponseBytes = 256 * 1024 } = {}) {
  if (typeof roomId !== 'string' || !/^[a-z0-9_-]{1,128}$/.test(roomId) || typeof fetchImpl !== 'function' || typeof randomUUID !== 'function'
    || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000
    || !Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1 || maxResponseBytes > 1024 * 1024) throw error('shared_room_client_invalid_options');
  const url = `/api/shared-room/${roomId}/command`;
  let state = 'idle', pending = null, operation = null;
  async function attempt(signal) {
    const selected = pending, active = { controller: new AbortController(), reader: null };
    operation = active; state = 'sending';
    let timer, stopped;
    const interrupted = new Promise((_, reject) => {
      stopped = () => { cancel(active.reader); reject(error('aborted')); };
      active.controller.signal.addEventListener('abort', stopped, { once: true });
    });
    const abort = () => active.controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(abort, timeoutMs);
    if (signal?.aborted) abort();
    let reply;
    try {
      reply = await Promise.race([interrupted, (async () => {
        if (active.controller.signal.aborted) throw error('aborted');
        const response = await fetchImpl(url, Object.freeze({ method: 'POST', credentials: 'same-origin', mode: 'same-origin',
          redirect: 'error', cache: 'no-store', headers: Object.freeze({ 'Content-Type': 'application/json' }), body: selected.bytes,
          signal: active.controller.signal }));
        try {
          if (active.controller.signal.aborted || response.redirected || response.status !== 200 && !(response.status >= 400 && response.status < 500)) throw error('invalid_response');
          const value = await readJson(response, active, maxResponseBytes);
          if (active.controller.signal.aborted) throw error('aborted');
          if (response.status === 200) {
            if (!validEnvelope(value, selected.payload, roomId)) throw error('invalid_response');
            return freeze({ status: 'ok', commandId: selected.payload.commandId, result: value.result, replay: value.replay });
          }
          if (!exact(value, ['error']) || typeof value.error !== 'string' || !Object.hasOwn(errorStatuses, value.error)
            || errorStatuses[value.error] !== response.status) throw error('invalid_response');
          return freeze({ status: 'rejected', commandId: selected.payload.commandId, httpStatus: response.status, code: value.error });
        } finally { cancel(response.body); }
      })()]);
    } catch { reply = freeze({ status: 'uncertain', commandId: selected.payload.commandId, code: 'shared_room_command_uncertain' }); }
    finally {
      clearTimeout(timer); signal?.removeEventListener('abort', abort);
      active.controller.signal.removeEventListener('abort', stopped);
      if (operation === active) operation = null;
    }
    if (state === 'stopped') return freeze({ status: 'stopped', commandId: selected.payload.commandId, code: 'shared_room_client_stopped' });
    if (reply.status === 'uncertain') state = 'uncertain';
    else { pending = null; state = 'idle'; }
    return reply;
  }
  return Object.freeze({
    get state() { return state; },
    async send(intent, options) {
      if (state === 'stopped') throw error('shared_room_client_stopped');
      if (state !== 'idle') throw error('shared_room_command_busy');
      const signal = requestSignal(options);
      const copy = intentCopy(intent), commandId = randomUUID();
      if (typeof commandId !== 'string' || !id(commandId) || commandId.length > 100) throw error('shared_room_client_invalid_id');
      const payload = freeze({ ...copy, commandId }), bytes = JSON.stringify(payload);
      pending = Object.freeze({ payload, bytes });
      return attempt(signal);
    },
    async retry(options) {
      if (state === 'stopped') throw error('shared_room_client_stopped');
      if (state === 'sending') throw error('shared_room_command_busy');
      if (state !== 'uncertain') throw error('shared_room_no_pending_command');
      return attempt(requestSignal(options));
    },
    stop() { if (state !== 'stopped') { state = 'stopped'; operation?.controller.abort(); } },
  });
}
