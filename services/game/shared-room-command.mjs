import { parseSharedRoomCommand, projectSharedRoomCommandResult } from './shared-room-command-contract.mjs';

const prefix = '/api/shared-room';
const route = /^\/api\/shared-room\/([a-z0-9_-]{1,128})\/command$/;
const object = value => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
const safe = value => Number.isSafeInteger(value) && value >= 0;
const fail = (statusCode, code) => { throw Object.assign(new Error(code), { statusCode, code }); };
const cancelled = () => Object.assign(new Error('shared_room_command_cancelled'), { statusCode: 503, code: 'shared_room_command_cancelled' });
const domainStatuses = Object.freeze({
  STALE_COMMAND: 409, REQUEST_REUSED: 409, ACTOR_REQUIRED: 401, AUTHORITY_REJECTED: 403,
  NOT_SEATED: 409, LEAVING: 409, PAUSED: 409, NOT_YOUR_TURN: 409, DEADLINE_PASSED: 409,
  INSURANCE_UNAVAILABLE: 409, INSURANCE_NOT_FUNDED: 409, BETTING_CLOSED: 409, READY: 409,
  NO_BETS: 409, NO_REPEAT: 409, LIMITS: 409, INSUFFICIENT_BALANCE: 409, SEAT_TAKEN: 409,
  CLEAR_FIRST: 409, NO_ROOM: 409, ILLEGAL_ACTION: 409, NO_ACTIVE_ROUND: 409, ROUND_IN_PROGRESS: 409, REFILL_REFUSED: 409,
  INVALID_CHIP: 400, INVALID_ROOM: 400, INVALID_SEATS: 400, REQUEST_ID_REQUIRED: 400,
  UNKNOWN_COMMAND: 400, NOT_YOUR_BOX: 403,
});
const ownStatuses = Object.freeze({ shared_room_command_cancelled: 503, shared_room_invalid_request: 400,
  shared_room_invalid_command: 400, shared_room_invalid_origin: 403, shared_room_method_not_allowed: 405,
  shared_room_body_too_large: 413, shared_room_json_required: 415 });
const respond = (status, body, headers = {}) => Response.json(body, { status, headers: {
  'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers,
} });
function rejection(error) {
  if (Object.hasOwn(domainStatuses, error?.code)) return respond(domainStatuses[error.code], { error: error.code });
  if (Object.hasOwn(ownStatuses, error?.code)) return respond(ownStatuses[error.code], { error: error.code },
    ownStatuses[error.code] === 405 ? { Allow: 'POST' } : {});
  if (error?.name === 'AbortError') return respond(503, { error: 'shared_room_command_cancelled' });
  if (error?.statusCode === 401) return respond(401, { error: 'shared_room_authentication_required' });
  if (error?.statusCode === 403) return respond(403, { error: 'shared_room_forbidden' });
  return respond(503, { error: 'shared_room_command_unavailable' });
}
function exactOrigin(value) {
  let url; try { url = new URL(value); } catch { throw new TypeError('Explicit canonical shared room origin required'); }
  if (typeof value !== 'string' || !['http:', 'https:'].includes(url.protocol) || url.origin !== value) {
    throw new TypeError('Explicit canonical shared room origin required');
  }
  return url.origin;
}
async function abortable(work, signal) {
  if (signal.aborted) throw cancelled();
  let stop;
  const aborted = new Promise((_, reject) => { stop = () => reject(cancelled()); signal.addEventListener('abort', stop, { once: true }); });
  try { return await Promise.race([Promise.resolve().then(() => { if (signal.aborted) throw cancelled(); return work(); }), aborted]); }
  finally { signal.removeEventListener('abort', stop); }
}
async function readJson(request, maxBodyBytes) {
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) fail(400, 'shared_room_invalid_request');
  if (length !== null && Number(length) > maxBodyBytes) { void request.body?.cancel().catch(() => {}); fail(413, 'shared_room_body_too_large'); }
  const reader = request.body?.getReader();
  if (!reader) fail(400, 'shared_room_invalid_request');
  const stop = () => { void reader.cancel().catch(() => {}); };
  request.signal.addEventListener('abort', stop, { once: true });
  let complete = false, bytes = 0, text = '';
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    return await abortable(async () => {
      for (;;) {
        const next = await reader.read();
        if (request.signal.aborted) throw cancelled();
        if (next.done) break;
        if (!(next.value instanceof Uint8Array)) fail(400, 'shared_room_invalid_request');
        bytes += next.value.byteLength;
        if (bytes > maxBodyBytes) fail(413, 'shared_room_body_too_large');
        text += decoder.decode(next.value, { stream: true });
      }
      text += decoder.decode();
      if (length !== null && Number(length) !== bytes) fail(400, 'shared_room_invalid_request');
      const value = JSON.parse(text); complete = true; return value;
    }, request.signal);
  } catch (error) {
    if (request.signal.aborted) throw cancelled();
    if (Object.hasOwn(ownStatuses, error?.code)) throw error;
    fail(400, 'shared_room_invalid_request');
  } finally {
    request.signal.removeEventListener('abort', stop);
    if (!complete) stop();
    try { reader.releaseLock(); } catch {}
  }
}

/** Installs no route. The existing Node wrapper must preserve Host and validate
 * raw request targets before constructing Request (URL parsing normalizes dot
 * segments). Only service.command owns authentication and same-SQL authority.
 * Its snapshot is already public; this boundary never serializes a raw table
 * response or implements a second snapshot projection. No automatic retries.
 */
export function createSharedRoomCommand({ service, origin, engineOrigin = origin, maxBodyBytes = 16384 } = {}) {
  origin = exactOrigin(origin); engineOrigin = exactOrigin(engineOrigin);
  if (typeof service?.command !== 'function' || !Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1 || maxBodyBytes > 1024 * 1024) {
    throw new TypeError('Explicit shared room command service and bounded body required');
  }
  const origins = new Set([origin, engineOrigin]);
  return async function handle(request) {
    let url;
    try { url = new URL(request.url); } catch { return respond(400, { error: 'shared_room_invalid_request' }); }
    if (url.pathname !== prefix && !url.pathname.startsWith(prefix + '/')) {
      if (/^https?:\/\/[^/?#]+\/api\/shared-room(?:[/?#]|$)/.test(request.url)) return respond(400, { error: 'shared_room_invalid_request' });
      return null;
    }
    try {
      const match = route.exec(url.pathname);
      if (!match || request.url !== url.origin + url.pathname || url.search || url.hash) fail(400, 'shared_room_invalid_request');
      if (request.method !== 'POST') fail(405, 'shared_room_method_not_allowed');
      if (!origins.has(url.origin) || request.headers.get('host') !== url.host || request.headers.get('origin') !== origin
        || ['authorization', 'upgrade', 'sec-websocket-protocol', 'x-worker-id'].some(name => request.headers.has(name))) {
        fail(403, 'shared_room_invalid_origin');
      }
      if (!/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(request.headers.get('content-type') ?? '')
        || ![null, 'identity'].includes(request.headers.get('content-encoding'))) fail(415, 'shared_room_json_required');
      if (request.signal.aborted) throw cancelled();
      const roomId = match[1], input = parseSharedRoomCommand(roomId, await readJson(request, maxBodyBytes));
      const out = await abortable(() => service.command(request, { roomId, input, signal: request.signal }), request.signal);
      if (request.signal.aborted) throw cancelled();
      if (!object(out) || Object.keys(out).length !== 3 || !['result', 'replay', 'snapshot'].every(key => Object.hasOwn(out, key))
        || typeof out.replay !== 'boolean' || out.result?.op !== input.op || (out.snapshot !== null && (!object(out.snapshot) || out.snapshot.roomId !== roomId
          || out.snapshot.contract !== 'blackjack-table/1' || !safe(out.snapshot.version) || !safe(out.snapshot.presentationVer)))) {
        fail(503, 'shared_room_command_unavailable');
      }
      return respond(200, { result: projectSharedRoomCommandResult(out.result), replay: out.replay, snapshot: out.snapshot });
    } catch (error) { return rejection(error); }
  };
}
