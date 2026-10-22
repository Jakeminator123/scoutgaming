import { reconnectPresentation } from '../../../packages/presentation/contracts/shared-room-replay.mjs';
import { MAX_RECORDED_SPEECH_SECONDS } from '../../../packages/presentation/contracts/recorded-speech.mjs';

const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const eventTypes = new Set(['speak', 'idle', 'deal', 'reveal', 'settle', 'turn']);
const invalid = () => { throw new TypeError('shared_room_invalid_state'); };

// Freeze the complete upper bound before any renderer can mutate the frame.
// playLocalFilm permits 120s plus 8s startup. Each film also gets two 30s
// inactivity-bounded phases: configuration/composition preparation, then the
// verified buffer and startup. Buffer acquisition precedes the film deadline.
// Shared selection returns either three filmed parts (before/main/after) or
// main+fallback. Speech conservatively permits that same two-attempt fallback.
// The wire contract already limits the event array to 128; legacy has no times.
function presentationTimeout(presentation, stallMs) {
  if (presentation?.status !== 'ready') return stallMs;
  let mediaBudget = 0;
  for (const event of presentation.events) {
    const parts = event.type === 'speak' ? 2 : ['deal', 'reveal'].includes(event.type) ? 3 : 0;
    if (parts) mediaBudget += 10000 + parts * ((MAX_RECORDED_SPEECH_SECONDS + 8) * 1000 + 2 * 30000);
  }
  if (!mediaBudget) return stallMs;
  const planned = Math.min(Math.max(0, presentation.endAt - presentation.startAt), (presentation.events.length + 1) * 60000);
  return Math.ceil(Math.max(planned, mediaBudget) + stallMs);
}

function readState(data, roomId, maxMessageBytes) {
  // Browser WebSocket delivers the server's JSON text. Binary frames are never
  // decoded or expanded, and both UTF-16 length and wire bytes are bounded.
  if (typeof data !== 'string' || data.length > maxMessageBytes
    || new TextEncoder().encode(data).byteLength > maxMessageBytes) invalid();
  const frame = JSON.parse(data), s = frame?.snapshot, p = frame?.presentation;
  if (!object(frame) || frame.type !== 'shared-room-state' || frame.roomId !== roomId
    || !object(s) || s.contract !== 'blackjack-table/1' || s.roomId !== roomId
    || !integer(s.version) || !integer(s.presentationVer) || !id(s.configVersion) || !id(s.windowId)
    || !object(s.me) || !id(s.me.id)) invalid();
  if (p === null) {
    if (s.presentationVer !== 0) invalid();
  } else {
    if (!object(p) || p.roomId !== roomId || !integer(p.ver) || p.ver !== s.presentationVer
      || !id(p.talkId) || !integer(p.auditSeq) || !Array.isArray(p.events) || p.events.length > 128
      || !p.events.every(event => object(event) && eventTypes.has(event.type))
      || !Array.isArray(p.lines) || p.lines.length > 128) invalid();
    if (p.status === 'legacy') {
      if (p.kind !== null || p.events.length || p.lines.length) invalid();
    } else if (p.status !== 'ready' || !['plan', 'collect', 'window'].includes(p.kind)
      || p.configVersion !== s.configVersion || p.windowId !== s.windowId
      || !['en', 'sv'].includes(p.language) || !Number.isFinite(p.startAt)
      || !Number.isFinite(p.endAt) || p.endAt < p.startAt) invalid();
    for (const line of p.lines) {
      if (!object(line) || !integer(line.index) || p.events[line.index]?.type !== 'speak'
        || typeof line.line !== 'string' || line.line.length > 256
        || p.events[line.index].line !== line.line || typeof line.lineId !== 'string' || !/^[a-f0-9]{32}$/.test(line.lineId)) invalid();
    }
  }
  return frame;
}

/** Isolated read-only adapter. Nothing connects until start(); stop is terminal.
 * Native WebSocket uses the browser's same-host sessions cookie. This API has no
 * credential, subprotocol, storage, command or game/wallet write port.
 *
 * Renderers are serialized and receive {signal, roomId}. They must honor abort
 * before committing asynchronous work. A presentation version is consumed BEFORE
 * present is called: a disconnect or renderer failure can never replay it on this
 * instance. Renderer failure/timeout is terminal; it is not an automatic retry.
 * No product entry point mounts this adapter until shared commands replace legacy
 * controls together with it.
 */
export function createSharedRoomClient({
  roomId, browserOrigin, WebSocket = globalThis.WebSocket,
  restoreSnapshot, present, onError = () => {},
  maxMessageBytes = 256 * 1024, maxPendingStates = 4,
  maxReconnectAttempts = 3, reconnectDelayMs = 250, connectTimeoutMs = 5000, callbackTimeoutMs = 10000,
} = {}) {
  let origin;
  try { origin = new URL(browserOrigin); } catch { throw new TypeError('shared_room_invalid_origin'); }
  if (!id(roomId) || origin.origin !== browserOrigin || !['http:', 'https:'].includes(origin.protocol)
    || (globalThis.location && globalThis.location.origin !== browserOrigin)
    || ![WebSocket, restoreSnapshot, present, onError].every(port => typeof port === 'function')
    || !Number.isSafeInteger(maxMessageBytes) || maxMessageBytes < 256 || maxMessageBytes > 1024 * 1024
    || !Number.isSafeInteger(maxPendingStates) || maxPendingStates < 1 || maxPendingStates > 32
    || !Number.isSafeInteger(maxReconnectAttempts) || maxReconnectAttempts < 0 || maxReconnectAttempts > 5
    || !Number.isSafeInteger(reconnectDelayMs) || reconnectDelayMs < 1 || reconnectDelayMs > 30000
    || !Number.isSafeInteger(connectTimeoutMs) || connectTimeoutMs < 1 || connectTimeoutMs > 30000
    || !Number.isSafeInteger(callbackTimeoutMs) || callbackTimeoutMs < 1 || callbackTimeoutMs > 30000) {
    throw new TypeError('shared_room_invalid_options');
  }
  const socketURL = `${origin.protocol === 'https:' ? 'wss:' : 'ws:'}//${origin.host}/shared-room/${roomId}`;
  let state = 'idle', connection, retryTimer, renderTimer, pumping = false, queue = [];
  let retries = 0, snapshotVersion = -1, snapshotPresentationVer = -1, appliedVer = 0, actorId;
  const current = candidate => state === 'running' && connection === candidate && !candidate.controller.signal.aborted;
  const report = code => { try { onError(Object.freeze({ code })); } catch {} };
  function detach(candidate) {
    clearTimeout(candidate.connectTimer); candidate.controller.abort();
    for (const [type, listener] of Object.entries(candidate.listeners)) candidate.socket.removeEventListener(type, listener);
    try { candidate.socket.close(1000, 'shared_room_closed'); } catch {}
  }
  function finish(code) {
    if (state === 'stopped' || state === 'failed') return;
    state = code ? 'failed' : 'stopped';
    clearTimeout(retryTimer); clearTimeout(renderTimer); retryTimer = renderTimer = undefined;
    queue = [];
    const old = connection; connection = undefined;
    if (old) detach(old);
    if (code) report(code);
  }
  function retry() {
    if (state !== 'running') return;
    if (retries >= maxReconnectAttempts) { finish('shared_room_reconnect_exhausted'); return; }
    retries++;
    retryTimer = setTimeout(() => { retryTimer = undefined; if (state === 'running') connect(); }, reconnectDelayMs);
  }
  function disconnected(candidate, code) {
    if (!current(candidate)) return;
    connection = undefined; queue = []; detach(candidate);
    if (code === 1000) finish();
    else if (code === 1008) finish('shared_room_unauthorized');
    else if ([1002, 1003, 1007, 1009].includes(code)) finish('shared_room_invalid_state');
    else retry();
  }
  async function render(port, value, candidate, timeoutMs = callbackTimeoutMs) {
    const timeout = new Promise((_, reject) => {
      renderTimer = setTimeout(() => reject(Object.assign(new Error('shared_room_renderer_timeout'), { rendererTimeout: true })), timeoutMs);
    });
    const work = Promise.resolve().then(() => {
      if (!current(candidate)) throw new DOMException('Shared room disconnected', 'AbortError');
      return port(value, Object.freeze({ signal: candidate.controller.signal, roomId }));
    });
    // Do not race abort: an old async renderer must settle before a reconnect's
    // renderer begins. A stuck renderer terminates the entire instance on timeout.
    try { await Promise.race([work, timeout]); }
    finally { clearTimeout(renderTimer); renderTimer = undefined; }
  }
  async function pump() {
    if (pumping) return; pumping = true;
    try {
      while (state === 'running' && queue.length) {
        const { candidate, frame } = queue.shift();
        if (!current(candidate)) continue;
        const s = frame.snapshot, p = frame.presentation;
        if (s.version < snapshotVersion || s.presentationVer < snapshotPresentationVer || s.presentationVer < appliedVer) continue;
        const replay = reconnectPresentation(s, p, { appliedVer });
        const presentationBudget = presentationTimeout(p, callbackTimeoutMs);
        // Capture monotonic floors before handing mutable data to the renderer.
        snapshotVersion = s.version; snapshotPresentationVer = s.presentationVer;
        try {
          await render(restoreSnapshot, s, candidate);
          if (!current(candidate)) continue;
          if (replay.apply) {
            appliedVer = p.ver;
            await render(present, p, candidate, presentationBudget);
          }
          // Renew the allowance per outage only after current state was fully
          // rendered. A retired socket completing late cannot renew this budget.
          if (current(candidate)) retries = 0;
        } catch (error) {
          if (state === 'running' && (error?.rendererTimeout || current(candidate))) {
            finish(error?.rendererTimeout ? 'shared_room_renderer_timeout' : 'shared_room_renderer_failed');
          }
        }
      }
    } finally { pumping = false; }
  }
  function receive(candidate, event) {
    if (!current(candidate)) return;
    let frame;
    try {
      frame = readState(event.data, roomId, maxMessageBytes);
      if (actorId !== undefined && frame.snapshot.me.id !== actorId) invalid();
    } catch { finish('shared_room_invalid_state'); return; }
    actorId ??= frame.snapshot.me.id;
    if (frame.snapshot.version < snapshotVersion || frame.snapshot.presentationVer < snapshotPresentationVer
      || frame.snapshot.presentationVer < appliedVer) return;
    if (queue.length >= maxPendingStates) { finish('shared_room_backpressure'); return; }
    queue.push({ candidate, frame }); void pump();
  }
  function connect() {
    let socket;
    try {
      // A single URL argument: no bearer, query capability or custom protocol.
      socket = new WebSocket(socketURL);
      if (!socket || !['addEventListener', 'removeEventListener', 'close'].every(key => typeof socket[key] === 'function')) {
        throw new TypeError('Invalid WebSocket');
      }
    } catch { try { socket?.close(); } catch {} retry(); return; }
    const candidate = { socket, controller: new AbortController(), listeners: {} };
    candidate.listeners = {
      open: () => { if (current(candidate)) clearTimeout(candidate.connectTimer); },
      message: event => receive(candidate, event),
      close: event => disconnected(candidate, event.code),
      error: () => disconnected(candidate, 1006),
    };
    connection = candidate;
    for (const [type, listener] of Object.entries(candidate.listeners)) socket.addEventListener(type, listener);
    if (socket.readyState !== 1) candidate.connectTimer = setTimeout(() => disconnected(candidate, 1006), connectTimeoutMs);
  }
  return Object.freeze({
    start() {
      if (state === 'running') return;
      if (state !== 'idle') throw new Error('shared_room_client_stopped');
      state = 'running'; connect();
    },
    stop() { finish(); },
    status() { return Object.freeze({ state, connected: Boolean(connection?.socket.readyState === 1), reconnectAttempts: retries,
      snapshotVersion, presentationVer: appliedVer }); },
  });
}
