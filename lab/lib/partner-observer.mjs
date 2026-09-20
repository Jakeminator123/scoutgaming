import { createHmac, randomUUID } from 'node:crypto';
import { assertLocalRequest, errorResponse, jsonResponse } from './http-guard.mjs';
import { StudioError } from './project-store.mjs';

const REQUIRED = ['BETTALOTTO_PARTNER_KEY_ID', 'BETTALOTTO_PARTNER_SECRET', 'BETTALOTTO_PARTNER_PLAYER_ID'];
// Match the credentials minted by web/partner-api.mjs. Shape is only a local
// check; Bettalotto must still authenticate the pair and authorize the scope.
const CREDENTIAL_FORMATS = {
  BETTALOTTO_PARTNER_KEY_ID: /^ck_live_[A-Za-z0-9_-]{24}$/,
  BETTALOTTO_PARTNER_SECRET: /^cs_[A-Za-z0-9_-]{43}$/,
};
const MAX_FRAME_BYTES = 64 * 1024;
const MAX_CONNECTION_BYTES = 16 * 1024 * 1024;
const encoder = new TextEncoder();

export function partnerEnvironment(env) {
  return Object.fromEntries([...REQUIRED, 'BETTALOTTO_PARTNER_BASE_URL'].map(name => [name,
    // A present canonical value wins even when blank: never silently replace an
    // intentional empty/invalid setting with credentials from another namespace.
    env[name] !== undefined ? env[name] : env[name.replace('BETTALOTTO_PARTNER_', 'LAB_PARTNER_')],
  ]));
}

// This is an operator-configured observer, never a client-selected HTTP proxy.
// Loopback is allowed only for deliberately configured, isolated local servers.
function approvedOrigin(value) {
  try {
    const url = new URL(value || 'https://bettalotto.se');
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    if (url.origin === 'https://bettalotto.se') return url.origin;
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && ['http:', 'https:'].includes(url.protocol)) return url.origin;
  } catch { /* Never return an invalid URL: it may contain credentials. */ }
  return null;
}

function configuration(env) {
  const missing = REQUIRED.filter(name => typeof env[name] !== 'string' || !env[name].trim());
  const invalid = REQUIRED.filter(name => !missing.includes(name) &&
    (env[name].length > 512 || /[\r\n\0]/.test(env[name]) ||
      CREDENTIAL_FORMATS[name] && !CREDENTIAL_FORMATS[name].test(env[name])));
  const origin = approvedOrigin(env.BETTALOTTO_PARTNER_BASE_URL);
  if (!origin) invalid.push('BETTALOTTO_PARTNER_BASE_URL');
  return { configured: missing.length === 0 && invalid.length === 0, missing, invalid,
    endpoint: origin ? `${origin}/api/v1/events` : null, scope: 'events or play',
    channel: 'api-key + partner-player', replay: false, readOnly: true };
}

function signedUrl(env, endpoint, now) {
  const timestamp = String(Math.floor(now() / 1000));
  const signature = createHmac('sha256', env.BETTALOTTO_PARTNER_SECRET)
    .update(`${timestamp}.GET./api/v1/events.${env.BETTALOTTO_PARTNER_PLAYER_ID}`).digest('hex');
  const url = new URL(endpoint);
  // Despite the env name, KEY_ID is the public ck_live_* key, not the BO row UUID.
  url.searchParams.set('key', env.BETTALOTTO_PARTNER_KEY_ID);
  url.searchParams.set('ts', timestamp);
  url.searchParams.set('sig', signature);
  url.searchParams.set('playerId', env.BETTALOTTO_PARTNER_PLAYER_ID);
  return url;
}

function publicRound(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.type !== 'round'
    || !Array.isArray(value.events) || value.events.length > 256
    || !value.events.every(event => event && typeof event === 'object' && !Array.isArray(event) && typeof event.type === 'string')) return null;
  // No auth/query data is forwarded. Keep the existing public round contract,
  // including the complete presentation payload; do not invent player context.
  return Object.fromEntries(['type', 'op', 'requestId', 'version', 'phase', 'balance', 'events']
    .filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]]));
}

function parseFrame(text) {
  let event = 'message'; let id; const data = [];
  for (const line of text.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const key = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (key === 'event') event = value;
    if (key === 'data') data.push(value);
    if (key === 'id' && !value.includes('\0')) id = value.slice(0, 128);
  }
  return { event, id, data: data.join('\n') };
}

export function createPartnerObserver({ env = () => process.env, fetchImpl = fetch, now = Date.now,
  connectTimeoutMs = 10000, idleTimeoutMs = 65000, maxDurationMs = 30 * 60 * 1000, maxConnections = 4 } = {}) {
  let active = 0;
  const environment = () => partnerEnvironment(typeof env === 'function' ? env() : env);
  function status() { return configuration(environment()); }

  function stream(request) {
    const currentEnv = environment();
    const configEnv = Object.fromEntries([...REQUIRED, 'BETTALOTTO_PARTNER_BASE_URL'].map(name => [name, currentEnv[name]]));
    const config = configuration(configEnv);
    if (!config.configured) return jsonResponse({ ...config, error: 'Partner-observatören är inte konfigurerad på labbservern.' }, 503);
    if (active >= maxConnections) return jsonResponse({ error: 'För många eventobservatörer är öppna. Stäng en anslutning först.' }, 429);
    const abort = new AbortController();
    let reader; let output; let closed = false; let stopped = false; let idleTimer; let connectTimer; let durationTimer;
    let stopReason = 'cancelled';
    const connectionId = randomUUID(); let sequence = 0;
    active++;
    const cleanup = () => {
      clearTimeout(idleTimer); clearTimeout(connectTimer); clearTimeout(durationTimer);
      request.signal.removeEventListener('abort', onAbort);
      if (!stopped) { stopped = true; active--; }
      abort.abort();
      void reader?.cancel().catch(() => {});
    };
    const stop = reason => { stopReason = reason; abort.abort(); void reader?.cancel().catch(() => {}); };
    const onAbort = () => { if (!closed) { closed = true; output.close(); } stop('cancelled'); cleanup(); };
    function emit(event, data, upstreamId) {
      if (closed) return false;
      if (output.desiredSize <= 0) { stop('slow-consumer'); return false; }
      const envelope = { id: `${connectionId}:${++sequence}`, time: new Date(now()).toISOString(), source: 'partner', kind: event === 'input' ? 'round' : 'status', data,
        ...(upstreamId ? { upstreamId } : {}) };
      output.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(envelope)}\n\n`));
      return true;
    }
    const signalStatus = (state, reason, extra = {}) => emit('status', { state, reason, gap: true, replay: false, readOnly: true, ...extra });
    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => stop('upstream-timeout'), idleTimeoutMs);
      idleTimer.unref?.();
    };
    async function observe() {
      signalStatus('connecting', 'observation-starts-now');
      if (request.signal.aborted) { onAbort(); return; }
      request.signal.addEventListener('abort', onAbort, { once: true });
      connectTimer = setTimeout(() => stop('connect-timeout'), connectTimeoutMs); connectTimer.unref?.();
      durationTimer = setTimeout(() => stop('session-limit'), maxDurationMs); durationTimer.unref?.();
      try {
        const response = await fetchImpl(signedUrl(configEnv, config.endpoint, now), {
          method: 'GET', headers: { Accept: 'text/event-stream' }, redirect: 'error',
          cache: 'no-store', credentials: 'omit', signal: abort.signal,
        });
        clearTimeout(connectTimer);
        if (!response.ok) {
          await response.body?.cancel();
          signalStatus('error', 'upstream-rejected', { httpStatus: response.status });
          return;
        }
        if (response.redirected || response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'text/event-stream' || !response.body) {
          await response.body?.cancel(); signalStatus('error', 'invalid-upstream-stream'); return;
        }
        reader = response.body.getReader();
        signalStatus('connected', 'no-replay'); resetIdle();
        const decoder = new TextDecoder(); let buffer = ''; let frame = ''; let totalBytes = 0;
        while (!abort.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          resetIdle(); totalBytes += value.byteLength;
          if (totalBytes > MAX_CONNECTION_BYTES || value.byteLength > 512 * 1024) { stop('payload-limit'); break; }
          buffer += decoder.decode(value, { stream: true });
          // Normalize CRLF and CR while preserving a CR split across chunks.
          let lineEnd;
          while (!abort.signal.aborted && (lineEnd = buffer.search(/[\r\n]/)) >= 0) {
            if (buffer[lineEnd] === '\r' && lineEnd === buffer.length - 1) break;
            const line = buffer.slice(0, lineEnd);
            buffer = buffer.slice(lineEnd + (buffer[lineEnd] === '\r' && buffer[lineEnd + 1] === '\n' ? 2 : 1));
            if (Buffer.byteLength(frame) + Buffer.byteLength(line) > MAX_FRAME_BYTES) { stop('payload-limit'); break; }
            if (line) { frame += `${line}\n`; continue; }
            const message = parseFrame(frame); frame = '';
            if (!message.data || message.event === 'hello') continue;
            if (message.event !== 'round') { signalStatus('error', 'unsupported-upstream-event'); continue; }
            let round;
            try { round = publicRound(JSON.parse(message.data)); } catch { /* bounded malformed input */ }
            if (!round) { signalStatus('error', 'invalid-round'); continue; }
            if (!emit('input', round, message.id)) break;
          }
          if (Buffer.byteLength(buffer) + Buffer.byteLength(frame) > MAX_FRAME_BYTES) { stop('payload-limit'); break; }
        }
        if (!closed) signalStatus('disconnected', abort.signal.aborted ? stopReason : 'upstream-closed');
      } catch {
        // Fetch errors often contain the signed URL; none are exposed or logged.
        if (!closed) signalStatus('error', abort.signal.aborted ? stopReason : 'connection-failed');
      } finally {
        cleanup();
        if (!closed) { closed = true; output.close(); }
      }
    }
    const body = new ReadableStream({
      start(controller) { output = controller; void observe(); },
      cancel() { closed = true; stop('cancelled'); cleanup(); },
    }, { highWaterMark: 256 * 1024, size: chunk => chunk.byteLength });
    return new Response(body, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Content-Type-Options': 'nosniff', 'X-Accel-Buffering': 'no' } });
  }

  async function endpoint(request) {
    try {
      assertLocalRequest(request);
      if (request.method !== 'GET') return jsonResponse({ error: 'Endast läsning är tillåten.' }, 405);
      const url = new URL(request.url);
      if (url.search) throw new StudioError('Partnerinställningar anges endast på labbservern.');
      if (url.pathname === '/api/inputs') return jsonResponse(status());
      if (url.pathname === '/api/inputs/events') return stream(request);
      return jsonResponse({ error: 'Okänd eventobservatör.' }, 404);
    } catch (error) { return errorResponse(error); }
  }
  return { status, endpoint };
}

// Lazy creation: imports/builds/status checks never open a network connection.
let observer;
export function partnerInputEndpoint(request) { return (observer ??= createPartnerObserver()).endpoint(request); }
