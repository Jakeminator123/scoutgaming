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
// verified buffer and startup. Buffer acquisition precedes the film deadline;
// arriving bytes renew its inactivity lease, so on a slow connection this frozen
// total, not one file's download time, is the absolute bound.
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

function readFrame(data, maxMessageBytes) {
  // Browser WebSocket delivers the server's JSON text. Binary frames are never
  // decoded or expanded, and both UTF-16 length and wire bytes are bounded.
  if (typeof data !== 'string' || data.length > maxMessageBytes
    || new TextEncoder().encode(data).byteLength > maxMessageBytes) invalid();
  return JSON.parse(data);
}
// Chat (PR 1): one line in the room's chat log; never game state.
function readChat(frame, roomId) {
  if (Object.keys(frame).length !== 8 || frame.roomId !== roomId || typeof frame.lineId !== 'string' || !/^[qa]-[0-9a-f]{24}$/.test(frame.lineId)
    || !id(frame.requestId) || !['you', 'player', 'dealer'].includes(frame.who)
    || !(frame.seat === null || (Number.isSafeInteger(frame.seat) && frame.seat >= 1 && frame.seat <= 7))
    || typeof frame.text !== 'string' || !frame.text.trim() || frame.text.length > 1000 || !integer(frame.at)) invalid();
  return Object.freeze({ lineId: frame.lineId, requestId: frame.requestId, who: frame.who, seat: frame.seat, text: frame.text, at: frame.at });
}
function readState(frame, roomId) {
  const s = frame?.snapshot, p = frame?.presentation;
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

// Renderer failures a fresh socket resolves: the room moved on during the binding read, or the binding read
// kept failing transiently after its own retries (shared-room-app.mjs).
const recoverable = new Set(['shared_room_presentation_stale', 'shared_room_presentation_binding_unavailable']);
// A partner session refused for its key's company (docs/plans/NYCKEL-BOLAG.md): the server names the
// reason in its 1008 close. No other socket changes that answer, so the client ends at once with it.
const partnerRefusals = new Set(['partner_operator_mismatch', 'partner_key_unbound']);
// A live room without published game settings (shared-room-access.mjs ROOM_CONFIG_MISSING). Admin can publish
// them at any moment, so one more socket is tried; a second refusal ends the client with this code.
export const ROOM_CONFIG_MISSING = 'room_config_missing';
// A page and its network are optional wake-up sources; anything else is refused.
const eventTarget = value => value && typeof value.addEventListener === 'function' && typeof value.removeEventListener === 'function';

/** Isolated read-only adapter. Nothing connects until start(); only stop() ends it.
 * Native WebSocket uses the browser's same-host sessions cookie. This API has no
 * credential, subprotocol, storage, command or game/wallet write port.
 *
 * Snapshots also receive their local WS receivedAt. Restores are serialized and one
 * presentation plays at a time; ports must honor abort before committing asynchronous
 * work. A presentation version is consumed BEFORE present is called: a disconnect or
 * renderer failure can never replay it on this instance.
 *
 * K04 B1 (external review 28 Oct 2026): states are replaceable. A newer state of the
 * same presentation replaces the pending one, and a state of the presentation that
 * plays is restored at once, beside its film. A newer committed presentation waits for
 * the playing one and tells it so through `superseded` (K04 R2b). More pending
 * presentations than maxPendingStates are dropped: the film is aborted and the room is
 * read again through a fresh socket, within the reconnect budget.
 *
 * K04 B2: every socket close this client did not ask for, the server's 1000 on release
 * or shutdown included, reconnects through a new authenticated socket. The wait doubles
 * from reconnectDelayMs up to maxReconnectDelayMs, within maxReconnectAttempts and
 * reconnectBudgetMs per outage; `online` and a page that becomes visible skip the wait.
 * A spent budget leaves the client offline until reconnect() (or online/visible).
 * A contract close (1002, 1003, 1007, 1009) ends the client at once. An authorization
 * close (1008) gets one fresh socket, in case the browser renewed its session cookie
 * (which this client cannot read); a second refusal, or that socket closing before it
 * delivered a state, ends the client. A 1008 naming a partner refusal (another company, or a
 * key without one) ends it at once and reports that code. A 1008 naming room_config_missing (the
 * room has no published game settings) gets one more socket; a second one ends the client with it.
 * Renderer failure or timeout is terminal, except the recognized stale room binding
 * conflict and a binding read that kept failing transiently, which reconnect within
 * the same outage budget.
 */
export function createSharedRoomClient({
  roomId, browserOrigin, WebSocket = globalThis.WebSocket,
  restoreSnapshot, present, onChat = () => {}, onError = () => {}, now = Date.now,
  maxMessageBytes = 256 * 1024, maxPendingStates = 4,
  maxReconnectAttempts = 20, reconnectDelayMs = 250, maxReconnectDelayMs = 5000, reconnectBudgetMs = 60000,
  connectTimeoutMs = 5000, callbackTimeoutMs = 10000,
  network = eventTarget(globalThis.window) ? globalThis.window : null,
  page = eventTarget(globalThis.document) ? globalThis.document : null,
} = {}) {
  let origin;
  try { origin = new URL(browserOrigin); } catch { throw new TypeError('shared_room_invalid_origin'); }
  if (!id(roomId) || origin.origin !== browserOrigin || !['http:', 'https:'].includes(origin.protocol)
    || (globalThis.location && globalThis.location.origin !== browserOrigin)
    || ![WebSocket, restoreSnapshot, present, onChat, onError, now].every(port => typeof port === 'function')
    || !Number.isSafeInteger(maxMessageBytes) || maxMessageBytes < 256 || maxMessageBytes > 1024 * 1024
    || !Number.isSafeInteger(maxPendingStates) || maxPendingStates < 1 || maxPendingStates > 32
    || !Number.isSafeInteger(maxReconnectAttempts) || maxReconnectAttempts < 0 || maxReconnectAttempts > 60
    || !Number.isSafeInteger(reconnectDelayMs) || reconnectDelayMs < 1 || reconnectDelayMs > 30000
    || !Number.isSafeInteger(maxReconnectDelayMs) || maxReconnectDelayMs < 1 || maxReconnectDelayMs > 30000
    || !Number.isSafeInteger(reconnectBudgetMs) || reconnectBudgetMs < 1 || reconnectBudgetMs > 600000
    || !Number.isSafeInteger(connectTimeoutMs) || connectTimeoutMs < 1 || connectTimeoutMs > 30000
    || !Number.isSafeInteger(callbackTimeoutMs) || callbackTimeoutMs < 1 || callbackTimeoutMs > 30000
    || ![network, page].every(value => value === null || eventTarget(value))) {
    throw new TypeError('shared_room_invalid_options');
  }
  const socketURL = `${origin.protocol === 'https:' ? 'wss:' : 'ws:'}//${origin.host}/shared-room/${roomId}`;
  let state = 'idle', connection, retryTimer, pumping = false, queue = [], playing = null;
  let retries = 0, outageAt, outage, reauthorizing = false, configRetried = false, snapshotVersion = -1, snapshotPresentationVer = -1, appliedVer = 0, actorId;
  const timers = new Set();
  const current = candidate => state === 'running' && connection === candidate && !candidate.controller.signal.aborted;
  const report = code => { try { onError(Object.freeze({ code })); } catch {} };
  // A rendered state renews the budget.
  const renewed = () => { retries = 0; outageAt = outage = undefined; };
  function detach(candidate) {
    clearTimeout(candidate.connectTimer); candidate.controller.abort();
    for (const [type, listener] of Object.entries(candidate.listeners)) candidate.socket.removeEventListener(type, listener);
    try { candidate.socket.close(1000, 'shared_room_closed'); } catch {}
  }
  function finish(code) {
    if (state === 'stopped' || state === 'failed') return;
    state = code ? 'failed' : 'stopped';
    clearTimeout(retryTimer); retryTimer = undefined;
    for (const timer of timers) clearTimeout(timer);
    timers.clear(); queue = []; unlisten();
    const old = connection; connection = undefined;
    if (old) detach(old);
    if (code) report(code);
  }
  function retry() {
    if (state !== 'running') return;
    outageAt ??= now();
    const wait = Math.min(maxReconnectDelayMs, reconnectDelayMs * 2 ** Math.min(retries, 16));
    if (retries >= maxReconnectAttempts || now() - outageAt + wait > reconnectBudgetMs) {
      // Offline: no socket and no timer of its own. A renderer still settling keeps its deadline.
      state = 'offline'; clearTimeout(retryTimer); retryTimer = undefined; queue = []; report(outage ?? 'shared_room_reconnect_exhausted'); return;
    }
    retries++;
    retryTimer = setTimeout(() => { retryTimer = undefined; if (state === 'running') connect(); }, wait);
  }
  function resume() {
    if (state !== 'offline') return false;
    state = 'running'; renewed(); connect(); return true;
  }
  // A network or page that comes back skips the remaining wait, and resumes an offline client with a fresh budget.
  function awake() {
    if (state === 'offline') resume();
    else if (state === 'running' && retryTimer !== undefined) { clearTimeout(retryTimer); retryTimer = undefined; connect(); }
  }
  const shown = () => { if (page?.visibilityState === 'visible') awake(); };
  function listen() { network?.addEventListener('online', awake); page?.addEventListener('visibilitychange', shown); }
  function unlisten() { network?.removeEventListener('online', awake); page?.removeEventListener('visibilitychange', shown); }
  function disconnected(candidate, cause) {
    if (!current(candidate)) return;
    connection = undefined; queue = []; detach(candidate);
    if (cause) outage = cause;
    retry();
  }
  // The socket closed, failed or never opened (code 1006 for the last two).
  function lost(candidate, code, reason) {
    if (!current(candidate)) return;
    if ([1002, 1003, 1007, 1009].includes(code)) { finish('shared_room_invalid_state'); return; }
    if (code === 1008 && partnerRefusals.has(reason)) { finish(reason); return; }
    if (code === 1008 && reason === ROOM_CONFIG_MISSING) {
      // Two attempts in all: this socket and one more. No minute of retries behind "Återansluter…".
      if (configRetried) { finish(ROOM_CONFIG_MISSING); return; }
      configRetried = true; disconnected(candidate); return;
    }
    if (reauthorizing || code === 1008) {
      // The one re-authenticating socket was refused again or closed before any state.
      if (reauthorizing) { finish('shared_room_unauthorized'); return; }
      reauthorizing = true;
    }
    disconnected(candidate);
  }
  async function render(port, value, candidate, timeoutMs, context) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error('shared_room_renderer_timeout'), { rendererTimeout: true })), timeoutMs);
      timers.add(timer);
    });
    const work = Promise.resolve().then(() => {
      if (!current(candidate)) throw new DOMException('Shared room disconnected', 'AbortError');
      return port(value, Object.freeze({ signal: candidate.controller.signal, roomId, ...context }));
    });
    // Do not race abort: an old async renderer must settle before a reconnect's
    // renderer begins. A stuck renderer terminates the entire instance on timeout.
    try { await Promise.race([work, timeout]); }
    finally { clearTimeout(timer); timers.delete(timer); }
  }
  function failed(candidate, error) {
    // The room can advance between its WS snapshot and the HTTP binding read.
    // Reread through a fresh authenticated socket, with the same bounded outage
    // budget. No failed binding authorizes controls.
    if (current(candidate) && recoverable.has(error?.code)) disconnected(candidate);
    else if (state === 'running' && (error?.rendererTimeout || current(candidate))) {
      finish(error?.rendererTimeout ? 'shared_room_renderer_timeout' : 'shared_room_renderer_failed');
    }
  }
  // A newer state of the playing presentation (same socket, presentation, window,
  // configuration and round) carries no card and no film of its own.
  const beside = (entry, run) => entry.candidate === run.candidate
    && ['presentationVer', 'windowId', 'configVersion', 'roundId'].every(key => entry.frame.snapshot[key] === run.snapshot[key]);
  function play(candidate, snapshot, presentation, budget) {
    const run = { candidate, snapshot, ver: presentation.ver, superseded: new AbortController() };
    playing = run;
    if (queue.some(entry => entry.frame.snapshot.presentationVer > run.ver)) run.superseded.abort();
    render(present, presentation, candidate, budget, { superseded: run.superseded.signal })
      // Renew the allowance per outage only after current state was fully rendered.
      // A retired socket completing late cannot renew this budget.
      .then(() => { if (current(candidate)) renewed(); }, error => failed(candidate, error))
      .finally(() => { if (playing === run) playing = null; void pump(); });
  }
  async function pump() {
    if (pumping) return; pumping = true;
    try {
      while (state === 'running' && queue.length) {
        const entry = queue[0];
        if (!current(entry.candidate)) { queue.shift(); continue; }
        // One presentation at a time: a newer one, and every renderer of a new socket, waits until it settles.
        if (playing && !beside(entry, playing)) break;
        queue.shift();
        const { candidate, frame, receivedAt } = entry, s = frame.snapshot, p = frame.presentation;
        if (s.version < snapshotVersion || s.presentationVer < snapshotPresentationVer || s.presentationVer < appliedVer) continue;
        const replay = reconnectPresentation(s, p, { appliedVer });
        const presentationBudget = presentationTimeout(p, callbackTimeoutMs);
        // Capture monotonic floors before handing mutable data to the renderer.
        snapshotVersion = s.version; snapshotPresentationVer = s.presentationVer;
        try { await render(restoreSnapshot, s, candidate, callbackTimeoutMs, { receivedAt }); }
        catch (error) { failed(candidate, error); continue; }
        if (!current(candidate)) continue;
        if (replay.apply) { appliedVer = p.ver; play(candidate, s, p, presentationBudget); }
        else if (!playing) renewed();
      }
    } finally { pumping = false; }
  }
  function receive(candidate, event) {
    if (!current(candidate)) return;
    const receivedAt = now();
    let frame;
    try {
      frame = readFrame(event.data, maxMessageBytes);
      if (object(frame) && frame.type === 'shared-room-chat') {
        const line = readChat(frame, roomId);
        try { onChat(line); } catch {}
        return;
      }
      frame = readState(frame, roomId);
      if (actorId !== undefined && frame.snapshot.me.id !== actorId) invalid();
    } catch { finish('shared_room_invalid_state'); return; }
    actorId ??= frame.snapshot.me.id;
    // The server authorized this socket: a later 1008 gets its own single re-authentication.
    reauthorizing = false; configRetried = false;
    const s = frame.snapshot, tail = queue.at(-1)?.frame.snapshot;
    // Never queue a state older than one already rendered or pending.
    if (s.version < snapshotVersion || s.presentationVer < snapshotPresentationVer || s.presentationVer < appliedVer
      || (tail && (s.version < tail.version || s.presentationVer < tail.presentationVer))) return;
    const entry = { candidate, frame, receivedAt };
    if (tail?.presentationVer === s.presentationVer) queue[queue.length - 1] = entry;
    else if (queue.length >= maxPendingStates) { disconnected(candidate, 'shared_room_backpressure'); return; }
    else {
      queue.push(entry);
      if (playing?.candidate === candidate && s.presentationVer > playing.ver) playing.superseded.abort();
    }
    void pump();
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
      close: event => lost(candidate, event.code, event.reason),
      error: () => lost(candidate, 1006),
    };
    connection = candidate;
    for (const [type, listener] of Object.entries(candidate.listeners)) socket.addEventListener(type, listener);
    if (socket.readyState !== 1) candidate.connectTimer = setTimeout(() => lost(candidate, 1006), connectTimeoutMs);
  }
  return Object.freeze({
    start() {
      if (state === 'running' || state === 'offline') return;
      if (state !== 'idle') throw new Error('shared_room_client_stopped');
      state = 'running'; listen(); connect();
    },
    /** Resumes an offline client with a fresh budget; true when a new socket was opened. */
    reconnect() { return resume(); },
    stop() { finish(); },
    status() { return Object.freeze({ state, connected: Boolean(connection?.socket.readyState === 1), reconnectAttempts: retries,
      snapshotVersion, presentationVer: appliedVer }); },
  });
}
