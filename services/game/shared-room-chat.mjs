import { createHash, randomBytes } from 'node:crypto';
import { createChatResponseStream } from './chat-response-stream.mjs';
import { openClawChat } from './openclaw-chat.mjs';
import { unsafeChatText } from './shared-room-channel.mjs';

// Shared-room text chat (PR 1, no GPU): POST /api/shared-room/<roomId>/chat -> OpenClaw text.
// Same origin/host/JSON gate as shared-room-command.mjs. The question and the dealer's answer
// go to every socket in the room (shared-room-channel.mjs emitChat); the asker also gets NDJSON.
const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const statuses = Object.freeze({ shared_room_invalid_request: 400, shared_room_method_not_allowed: 405,
  shared_room_invalid_origin: 403, shared_room_json_required: 415, shared_room_body_too_large: 413,
  shared_room_chat_not_member: 403, stale_round_revision: 409, shared_room_chat_busy: 429, shared_room_chat_too_soon: 429,
  shared_room_chat_dealer_unavailable: 503, openclaw_not_configured: 503, product_speech_relay_not_configured: 503,
  shared_room_chat_cancelled: 503 });
const fail = code => { throw Object.assign(new Error(code), { code, statusCode: statuses[code] ?? 503 }); };
const digest = value => createHash('sha256').update(value).digest('hex').slice(0, 24);
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store',
  'CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

/** The round a question belongs to: stable for a whole round, unlike snapshot.version. */
export const sharedRoomChatRound = snapshot => snapshot?.roundId ?? 'window:' + snapshot?.windowId;

/** Mirrors openClawChat's transport choice; null when the environment can answer. */
export function openClawChatReadiness(settings) {
  if (settings?.speechUrl || settings?.speechToken) return settings.speechUrl && settings.speechToken ? null : 'product_speech_relay_not_configured';
  return settings?.baseUrl && settings?.gatewayKey ? null : 'openclaw_not_configured';
}

/** Explicit public status for OpenClaw, built from the client snapshot (already without the hole
 * card). Never spreads the snapshot; room/session ids reach the gateway only as digests. */
export function sharedRoomChatStatus({ dealerId, binding, snapshot }) {
  const round = snapshot.round ?? null, hole = round?.phase !== 'settled' ? round?.holeDraw : null;
  const card = value => ({ r: value?.r ?? null, s: value?.s ?? null });
  return {
    dealerId, sessionRevision: 's' + digest(binding.sessionId),
    roundRevision: 'r' + digest(binding.roomId + '\n' + sharedRoomChatRound(snapshot)),
    displayName: 'spelaren', roundPhase: snapshot.phase,
    round: round && { phase: round.phase ?? snapshot.phase,
      hands: (round.hands ?? []).map((hand, handIndex) => ({ box: hand.box, handIndex, cards: (hand.cards ?? []).map(card) })),
      dealer: (round.dealer ?? []).filter(value => hole == null || value?.shoeDraw !== hole).map(card) },
    occupiedBoxes: (snapshot.owners ?? []).flatMap((owner, box) => owner ? [box] : []),
    publishedEvents: [], policy: { recordedLines: [], generatedText: true, silence: true, mediaFamilies: [] },
  };
}

function parse(buffer) {
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer)); } catch { fail('shared_room_invalid_request'); }
  const keys = ['requestId', 'message', 'roundRevision', 'acceptsSpeechStream'];
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))
    || typeof value.requestId !== 'string' || !requestIdPattern.test(value.requestId) || typeof value.message !== 'string'
    || typeof value.roundRevision !== 'string' || !value.roundRevision || value.roundRevision.length > 200
    || (value.acceptsSpeechStream !== undefined && typeof value.acceptsSpeechStream !== 'boolean')) fail('shared_room_invalid_request');
  const message = value.message.trim().replace(/\r\n?/g, '\n');
  // Control, bidi override/isolate and zero-width characters never reach the room (review fix).
  if (!message || message.length > 1000 || unsafeChatText.test(message)) fail('shared_room_invalid_request');
  return { requestId: value.requestId, message, roundRevision: value.roundRevision };
}

function readBody(req, res, maxBytes) {
  const length = req.headers['content-length'];
  if (length !== undefined && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    res.shouldKeepAlive = false; req.resume();
    return Promise.reject(Object.assign(new Error('x'), { code: /^\d+$/.test(length) ? 'shared_room_body_too_large' : 'shared_room_invalid_request' }));
  }
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    const done = (settle, value) => { req.off('data', data); req.off('end', end); req.off('error', error); req.off('close', error); settle(value); };
    const data = chunk => {
      size += chunk.length; chunks.push(chunk);
      if (size > maxBytes) { res.shouldKeepAlive = false; req.resume(); done(reject, Object.assign(new Error('x'), { code: 'shared_room_body_too_large' })); }
    };
    const end = () => done(resolve, Buffer.concat(chunks));
    const error = () => done(reject, Object.assign(new Error('x'), { code: 'shared_room_invalid_request' }));
    // A client that disconnects mid-body ends with close, not end: never leave this read pending.
    req.on('data', data); req.once('end', end); req.once('error', error); req.once('close', error);
  });
}

function rejection(error, aborted) {
  if (aborted || error?.name === 'AbortError') return [503, 'shared_room_chat_cancelled'];
  if (Object.hasOwn(statuses, error?.code)) return [statuses[error.code], error.code];
  if (error?.statusCode === 401) return [401, 'shared_room_authentication_required'];
  if (error?.statusCode === 403) return [403, 'shared_room_forbidden'];
  // OpenClaw/Director codes (stale_openclaw_speech_choice, product_speech_timeout, ...) are already public.
  if (typeof error?.code === 'string' && /^(?:openclaw|product_speech|stale_openclaw|invalid_openclaw|disallowed_openclaw)_[a-z0-9_]{1,48}$/.test(error.code)
    && Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode < 600) return [error.statusCode, error.code];
  return [503, 'shared_room_chat_unavailable'];
}

export function createSharedRoomChat({ service, origin, engineOrigin = origin, settingsProvider = null, decide = openClawChat,
  fetchImpl = fetch, now = Date.now, cooldownMs = 10000, maxBodyBytes = 8192, historyChars = 8000 } = {}) {
  const exact = value => { try { return new URL(value).origin === value; } catch { return false; } };
  if (!exact(origin) || !exact(engineOrigin) || typeof service?.chatMember !== 'function' || typeof service?.chatContext !== 'function' || typeof service?.emitChat !== 'function'
    || typeof decide !== 'function' || (settingsProvider !== null && typeof settingsProvider !== 'function')) {
    throw new TypeError('Explicit shared room chat service and origins required');
  }
  const origins = new Set([origin, engineOrigin]), limits = new Map(), turns = new Map();
  let settings = settingsProvider;
  const remember = (map, key, value) => { map.delete(key); map.set(key, value); if (map.size > 4096) map.delete(map.keys().next().value); };
  return async function handle(req, res, { roomId, url } = {}) {
    const controller = new AbortController(), signal = controller.signal;
    const disconnected = () => { if (!res.writableEnded) controller.abort(); };
    res.once('close', disconnected);
    const stream = createChatResponseStream(res, { signal });
    let limit;
    try {
      if (req.method !== 'POST') fail('shared_room_method_not_allowed');
      const h = req.headers;
      if (!url || !origins.has(url.origin) || h.host !== url.host || h.origin !== origin
        || ['authorization', 'upgrade', 'sec-websocket-protocol', 'x-worker-id'].some(name => Object.hasOwn(h, name))) fail('shared_room_invalid_origin');
      if (!/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(h['content-type'] ?? '')
        || ![undefined, 'identity'].includes(h['content-encoding'])) fail('shared_room_json_required');
      const input = parse(await readBody(req, res, maxBodyBytes));
      // The access port reads only the session cookie, as for the room socket.
      const request = Object.freeze({ headers: new Headers(typeof h.cookie === 'string' ? { cookie: h.cookie } : {}), signal });
      // Review fix: authorization, membership, round, keys and the rate limit come first and take no
      // SQL lock; only an admitted question reaches the locked read (room, player row, audit lock).
      const member = await service.chatMember(request, { roomId, signal });
      const actorId = member.binding.actorId;
      if (member.snapshot.me?.active !== true) fail('shared_room_chat_not_member');
      if (input.roundRevision !== sharedRoomChatRound(member.snapshot)) fail('stale_round_revision');
      settings ??= (await import('./director-settings.mjs')).readSettings;
      const missing = openClawChatReadiness(settings());
      if (missing) fail(missing);
      // One open question per actor, and cooldownMs between questions.
      const at = now(), prior = limits.get(actorId);
      if (prior?.open) fail('shared_room_chat_busy');
      if (prior && at - prior.last < cooldownMs) fail('shared_room_chat_too_soon');
      limit = { open: true, last: at }; remember(limits, actorId, limit);
      const context = await service.chatContext(request, { roomId, signal });
      const { snapshot } = context;
      if (context.binding.actorId !== actorId || snapshot.me?.active !== true) fail('shared_room_chat_not_member');
      if (input.roundRevision !== sharedRoomChatRound(snapshot)) fail('stale_round_revision');
      if (typeof context.dealerId !== 'string' || !context.dealerId) fail('shared_room_chat_dealer_unavailable');
      // Line ids are the server's, never the client's requestId (not unique in a room): q-/a- of one
      // random thread id. The WS frame and the asker's NDJSON carry the same ids for deduplication.
      const thread = randomBytes(12).toString('hex'), questionLineId = 'q-' + thread, lineId = 'a-' + thread;
      const seat = Number.isSafeInteger(snapshot.me.seats?.[0]) ? snapshot.me.seats[0] + 1 : null;
      service.emitChat(roomId, { lineId: questionLineId, requestId: input.requestId, actorId, seat, text: input.message, at });
      stream.frame({ type: 'progress', stage: 'text', elapsedMs: 0 });
      const key = roomId + '\n' + actorId, history = turns.get(key) ?? [];
      const decision = await decide({ requestId: input.requestId, message: input.message, history: history.map(turn => ({ ...turn })) },
        sharedRoomChatStatus(context), { settingsProvider: settings,
          fetchImpl: (target, options = {}) => fetchImpl(target, { ...options, signal: options.signal ? AbortSignal.any([signal, options.signal]) : signal }) });
      // The answer is for this round and this member only: reread before anyone sees it.
      const after = await service.chatContext(request, { roomId, signal });
      if (after.binding.actorId !== actorId || after.snapshot.me?.active !== true || after.dealerId !== context.dealerId
        || sharedRoomChatRound(after.snapshot) !== input.roundRevision) fail('stale_round_revision');
      if (signal.aborted) fail('shared_room_chat_cancelled');
      const text = decision?.kind === 'generatedText' && typeof decision.exactText === 'string' ? decision.exactText : null;
      if (text) {
        stream.frame({ type: 'preview', exactText: text });
        service.emitChat(roomId, { lineId, requestId: input.requestId, actorId: null, seat: null, text, at: now() });
        const next = [...history, { role: 'user', text: input.message }, { role: 'assistant', text }];
        while (next.length > 30 || next.reduce((sum, turn) => sum + turn.text.length, 0) > historyChars) next.shift();
        remember(turns, key, next);
      }
      stream.frame({ type: 'result', decision: { kind: text ? 'generatedText' : 'silence', requestId: input.requestId,
        dealerId: context.dealerId, questionLineId, ...(text ? { exactText: text, lineId } : {}) } });
      res.end();
    } catch (error) {
      const [status, code] = rejection(error, signal.aborted);
      if (res.destroyed) return;
      if (res.headersSent) { stream.frame({ type: 'error', error: code }); res.end(); return; }
      res.writeHead(status, headers); res.end(JSON.stringify({ error: code }));
    } finally {
      if (limit) limit.open = false;
      stream.close(); res.removeListener('close', disconnected);
    }
  };
}
