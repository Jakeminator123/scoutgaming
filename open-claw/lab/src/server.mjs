import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { timingSafeEqual, createHash } from 'node:crypto';
import { LAB_ROOT, readSettings, isLoopback } from './settings.mjs';
import { catalogStore } from './store.mjs';
import { normalizeInput, prepareDecision, finalizeDecision } from './engine.mjs';
import { askDirector, chatWithDirector, providerStatus, boundedJson, GatewayError } from './openclaw.mjs';
import { createDashboardProxy } from './dashboard-proxy.mjs';
import { normalizeSocialInput, socialChat, validateSocialReply } from './social.mjs';
import { createCompanionService, normalizeCompanionRequest } from './companion.mjs';
import { createProductSpeechService, PRODUCT_SPEECH_AGENT, PRODUCT_SPEECH_PATH } from './product-speech.mjs';
import { createProductProbeService, PRODUCT_PROBE_PATH } from './product-probe.mjs';
import { createStudioOpenClawAdmin, STUDIO_OPENCLAW_ADMIN_PATH } from './studio-admin.mjs';

const SOURCE_TYPES = ['speak', 'deal', 'reveal', 'settle', 'turn', 'idle'];
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const equal = (a, b) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
function respond(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}
async function bodyJson(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new GatewayError('application_json_required', 415);
  let bytes = 0; const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 256 * 1024) throw new GatewayError('request_too_large', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new GatewayError('invalid_json', 400); }
}
function guard(req, settings, { token = settings.apiToken, productSpeech = false } = {}) {
  const local = isLoopback(settings.host);
  let requestHost;
  try { requestHost = new URL(`http://${req.headers.host}`).hostname; } catch { throw new GatewayError('invalid_host', 403); }
  if (local && !isLoopback(requestHost)) throw new GatewayError('local_host_required', 403);
  if (req.headers.origin) {
    let origin;
    try { origin = new URL(req.headers.origin); } catch { throw new GatewayError('invalid_origin', 403); }
    if (origin.host !== req.headers.host || !['http:', 'https:'].includes(origin.protocol)) throw new GatewayError('foreign_origin', 403);
  }
  if (req.headers['sec-fetch-site'] === 'cross-site') throw new GatewayError('foreign_origin', 403);
  if (!local) {
    if (!token || (productSpeech && token === settings.apiToken)) throw new GatewayError(productSpeech ? 'product_speech_not_configured' : 'public_service_requires_lab_api_token', 503);
    if (!equal(req.headers.authorization || '', `Bearer ${token}`)) throw new GatewayError('unauthorized', 401);
  }
}

async function relay(path, method, body, settings, fetchImpl) {
  let base;
  try { base = new URL(settings.remoteUrl); } catch { throw new GatewayError('invalid_remote_url'); }
  if (base.username || base.password || base.search || base.hash || (base.protocol !== 'https:' && !(base.protocol === 'http:' && isLoopback(base.hostname)))) throw new GatewayError('remote_requires_https');
  if (!settings.remoteToken) throw new GatewayError('lab_remote_token_missing');
  try {
    const response = await fetchImpl(new URL(path, base), {
      method, redirect: 'error', signal: AbortSignal.timeout(35000),
      headers: { Authorization: `Bearer ${settings.remoteToken}`, 'Content-Type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    const data = await boundedJson(response);
    if (!response.ok) throw new GatewayError(`remote_http_${response.status}`, response.status >= 500 ? 503 : response.status);
    return data;
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    throw new GatewayError('remote_unreachable');
  }
}

export async function createLabServer({ settings: settingsProvider = readSettings, fetchImpl = fetch, root = LAB_ROOT, batchBudgetMs = 25000,
  onSpeechRouting = entry => console.info(JSON.stringify({ event: 'product_speech_route', ...entry })),
  studioAdmin = createStudioOpenClawAdmin(),
} = {}) {
  const initial = { ...settingsProvider() };
  if (!isLoopback(initial.host) && !initial.apiToken) throw new Error('LAB_API_TOKEN is required when HOST is not loopback.');
  // This is a native-auth transport, never a relay authenticated with our keys.
  // Snapshot at startup: editing .env cannot widen a running public listener.
  const dashboard = initial.dashboardOrigin && !initial.remoteUrl ? createDashboardProxy({
    baseUrl: initial.baseUrl, origin: initial.dashboardOrigin, allowLoopbackHttp: initial.dashboardAllowLoopback,
  }) : null;
  const store = await catalogStore(join(root, 'config/catalog.json'), initial.dataDir);
  const scenarios = JSON.parse(await readFile(join(root, 'fixtures/scenarios.json'), 'utf8'));
  const decisions = new Map();
  const rate = new Map();
  let activeAdvice = 0;
  let activeChat = 0;
  let activeSocialChat = 0;
  let companion;
  const productSpeech = createProductSpeechService({ settingsProvider, fetchImpl, onRouting: onSpeechRouting });
  const productProbe = createProductProbeService({ settingsProvider, fetchImpl });
  const decide = async (raw, settings, deadlineAt = Infinity) => {
    const input = normalizeInput(raw);
    const catalog = await store.load();
    const key = `${catalog.revision}:${input.requestId}`;
    const digest = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    if (decisions.has(key)) {
      const previous = decisions.get(key);
      if (previous.digest !== digest) throw new GatewayError('request_id_reused_with_different_input', 409);
      return previous.promise;
    }
    const promise = (async () => {
      const prepared = prepareDecision(catalog, input);
      let result = { advice: null, provider: { status: 'off' } };
      if (input.mode !== 'off') {
        if (performance.now() >= deadlineAt) result.provider.status = 'batch_deadline_baseline';
        else if (activeAdvice >= 4) result.provider.status = 'busy_baseline';
        else {
          activeAdvice++;
          const budget = Math.max(1, Math.ceil(Math.min(settings.adviceTimeoutMs, deadlineAt - performance.now())));
          try { result = await askDirector(prepared, { ...settings, adviceTimeoutMs: budget }, fetchImpl); } finally { activeAdvice--; }
        }
      }
      const current = await store.load();
      if (current.revision !== prepared.catalogRevision) {
        // Editor changes invalidate in-flight advice; choose the current catalog's safe lane.
        const refreshed = prepareDecision(current, input);
        const response = finalizeDecision(refreshed, null, 'off');
        return { ...response, provider: { status: 'catalog_changed_baseline' } };
      }
      const response = finalizeDecision(prepared, result.advice, input.mode);
      const adviceIndex = response.trace.findIndex(step => step.stage === 'advice');
      response.trace.splice(adviceIndex < 0 ? response.trace.length : adviceIndex, 0, { stage: 'openclaw', status: result.provider.status, detail: `OpenClaw: ${result.provider.status}` });
      return { ...response, provider: result.provider };
    })();
    decisions.set(key, { digest, promise });
    if (decisions.size > 1000) decisions.delete(decisions.keys().next().value);
    try { return await promise; } catch (error) { decisions.delete(key); throw error; }
  };
  const server = createServer(async (req, res) => {
    if (dashboard?.handles(req)) return dashboard.handleRequest(req, res);
    if (/^\/openclaw(?:[/?]|$)/.test(req.url || '')) return respond(res, 503, { error: 'dashboard_not_configured' });
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; media-src 'self' blob: https:; frame-ancestors 'none'; base-uri 'none'");
    try {
      const path = new URL(req.url, 'http://lab.invalid').pathname;
      if (path === '/healthz' && req.method === 'GET') return respond(res, 200, { ok: true, service: 'croupier-openclaw-lab' });
      // Auth follows the actual listener, even when .env changes before a restart.
      const settings = { ...settingsProvider(), host: initial.host };
      if (path === STUDIO_OPENCLAW_ADMIN_PATH) {
        // Ordinary runtime/catalog tokens must never inherit Gateway administration.
        if (typeof settings.gatewayKey !== 'string' || !settings.gatewayKey.trim() || /[\r\n]/.test(settings.gatewayKey)
          || equal(settings.gatewayKey.trim(), (settings.apiToken || '').trim())) throw new GatewayError('openclaw_admin_not_configured', 503);
        const password = settings.gatewayKey.trim();
        if (!equal(req.headers.authorization || '', `Bearer ${password}`)) throw new GatewayError('unauthorized', 401);
        guard(req, settings, { token:password });
      } else guard(req, settings, path === PRODUCT_SPEECH_PATH || path === PRODUCT_PROBE_PATH
        ? { token: settings.speechToken, productSpeech: true } : undefined);
      if (path.startsWith('/api/')) {
        const rateKey = req.socket.remoteAddress;
        const now = Date.now();
        let bucket = rate.get(rateKey);
        if (!bucket || now > bucket.until) { bucket = { until: now + 60000, count: 0 }; rate.set(rateKey, bucket); }
        if (++bucket.count > 240) throw new GatewayError('rate_limit', 429);
        if (rate.size > 1000) for (const [key, value] of rate) if (value.until < now) rate.delete(key);
        const allowed = {
          '/api/status': ['GET'], '/api/catalog': ['GET', 'PUT'], '/api/scenarios': ['GET'],
          '/api/decide': ['POST'], '/api/chat': ['POST'], '/api/presentation': ['POST'],
          '/api/studio/advice': ['POST'], '/api/studio/chat': ['POST'],
          '/api/studio/social-chat': ['POST'],
          '/api/studio/companion': ['POST'],
          [PRODUCT_SPEECH_PATH]: ['POST'],
          [PRODUCT_PROBE_PATH]: ['POST'], '/api/studio/probe': ['POST'],
          [STUDIO_OPENCLAW_ADMIN_PATH]: ['GET', 'PATCH', 'POST'],
        };
        if (!allowed[path]) throw new GatewayError('not_found', 404);
        if (!allowed[path].includes(req.method)) throw new GatewayError('method_not_allowed', 405);
        let body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await bodyJson(req) : undefined;
        if (path === STUDIO_OPENCLAW_ADMIN_PATH) {
          if (settings.remoteUrl) throw new GatewayError('openclaw_admin_not_configured', 503);
          return respond(res, 200, req.method === 'GET' ? await studioAdmin.get(settings) : req.method === 'POST' ? await studioAdmin.dashboard(body, settings) : await studioAdmin.patch(body, settings));
        }
        if (path === PRODUCT_PROBE_PATH || path === '/api/studio/probe') {
          if (settings.remoteUrl) throw new GatewayError('probe_relay_not_supported',503);
          return respond(res,200,await productProbe.handle(body));
        }
        if (path === PRODUCT_SPEECH_PATH) {
          if (settings.remoteUrl) throw new GatewayError('product_speech_relay_not_supported', 503);
          const controller = new AbortController();
          const disconnected = () => { if (!res.writableEnded) controller.abort(); };
          res.once('close', disconnected);
          try {
            if (res.destroyed || req.aborted) controller.abort();
            const choice = await productSpeech.handle(body, { signal: controller.signal });
            if (!res.destroyed) return respond(res, 200, choice);
            return;
          } finally { res.removeListener('close', disconnected); }
        }
        if (settings.remoteUrl && path !== '/api/scenarios') {
          if (path === '/api/studio/companion') body = normalizeCompanionRequest(body);
          else if (path === '/api/studio/social-chat') body = normalizeSocialInput(body);
          else if (path.startsWith('/api/studio/')) {
            const prepared = prepareDecision(body?.catalog, { ...body?.input, mode: 'active' });
            body = { catalog: body.catalog, input: { requestId: prepared.requestId, event: prepared.event, context: prepared.context, mode: 'active' }, message: body.message, conversationId: body.conversationId };
          }
          if (path === '/api/decide') body = normalizeInput(body);
          if (path === '/api/presentation') {
            if (!Array.isArray(body?.presentation) || body.presentation.length > 64) throw new GatewayError('presentation_array_required_max_64', 400);
            body = { presentation: body.presentation.map(event => normalizeInput({ event, context: body.context }).event), context: normalizeInput({ event: { type: 'idle' }, context: body.context }).context, mode: body.mode, requestId: body.requestId };
          }
          const data = await relay(path, req.method, body, settings, fetchImpl);
          if (path === '/api/studio/social-chat') return respond(res, 200, validateSocialReply(data, body));
          if (path === '/api/status') data.remote = { configured: true, status: 'connected' };
          return respond(res, 200, data);
        }
        if (path === '/api/status') return respond(res, 200, { service: 'croupier-openclaw-lab', provider: providerStatus(settings), remote: { configured: false }, catalogRevision: (await store.load()).revision, editable: true, sourceTypes: SOURCE_TYPES, capabilities: ['studio-advice-v1', 'studio-chat-v1', 'studio-social-chat-v1', ...(settings.companionEnabled !== false ? ['studio-companion-v1'] : []), ...(settings.speechToken && settings.speechToken !== settings.apiToken && settings.speechAgent === PRODUCT_SPEECH_AGENT ? ['product-speech-v1','product-probe-v1'] : [])] });
        if (path === '/api/studio/companion') {
          companion ??= createCompanionService({ directory: initial.dataDir, settings: settingsProvider, fetchImpl });
          return respond(res, 200, await companion.handle(body));
        }
        if (path === '/api/studio/social-chat') {
          const input = normalizeSocialInput(body);
          if (activeSocialChat >= 2) throw new GatewayError('social_chat_busy', 429);
          activeSocialChat++;
          try { return respond(res, 200, await socialChat(input, settings, fetchImpl)); }
          finally { activeSocialChat--; }
        }
        // A studio sends an ephemeral validated catalog; it never overwrites the
        // deployed catalog. Only projected input and eligible candidates reach AI.
        if (path === '/api/studio/advice' || path === '/api/studio/chat') {
          const prepared = prepareDecision(body?.catalog, { ...body?.input, mode: 'active' });
          if (path === '/api/studio/chat') {
            if (activeChat >= 2) throw new GatewayError('chat_busy', 429);
            activeChat++;
            try { return respond(res, 200, await chatWithDirector(body, settings, fetchImpl, body.catalog)); }
            finally { activeChat--; }
          }
          if (activeAdvice >= 4) return respond(res, 200, { advice: null, provider: { status: 'busy_baseline' } });
          activeAdvice++;
          try { return respond(res, 200, await askDirector(prepared, settings, fetchImpl)); }
          finally { activeAdvice--; }
        }
        if (path === '/api/catalog') return respond(res, 200, req.method === 'GET' ? await store.load() : await store.save(body?.catalog, body?.expectedRevision));
        if (path === '/api/scenarios') return respond(res, 200, scenarios);
        if (path === '/api/decide') return respond(res, 200, await decide(body, settings));
        if (path === '/api/presentation') {
          if (!Array.isArray(body?.presentation) || body.presentation.length < 1 || body.presentation.length > 64) throw new GatewayError('presentation_array_required_max_64', 400);
          const batch = body.presentation.map((event, index) => normalizeInput({ event, context: body.context, mode: body.mode, requestId: body.requestId ? `${body.requestId}-${index}` : undefined }));
          const results = [];
          const deadlineAt = performance.now() + batchBudgetMs;
          for (const input of batch) results.push(await decide(input, settings, deadlineAt));
          return respond(res, 200, { decisions: results });
        }
        if (path === '/api/chat') {
          if (activeChat >= 2) throw new GatewayError('chat_busy', 429);
          activeChat++;
          try { return respond(res, 200, await chatWithDirector(body, settings, fetchImpl, await store.load())); }
          finally { activeChat--; }
        }
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new GatewayError('method_not_allowed', 405);
      const files = { '/': 'index.html', '/index.html': 'index.html', '/styles.css': 'styles.css', '/app.mjs': 'app.mjs' };
      if (!files[path]) throw new GatewayError('not_found', 404);
      const contents = await readFile(join(root, 'public', files[path]));
      res.writeHead(200, { 'Content-Type': MIME[extname(files[path])], 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : contents);
    } catch (error) {
      if (res.destroyed) return;
      // Never return upstream bodies, exception messages, request headers, or environment values.
      const status = error.statusCode || 500;
      respond(res, status, { error: error.code || 'internal_error', ...(Array.isArray(error.errors) && { errors: error.errors }) });
    }
  });
  server.requestTimeout = 45000;
  server.headersTimeout = 10000;
  server.on('upgrade', (req, socket, head) => {
    if (!dashboard?.handleUpgrade(req, socket, head)) socket.destroy();
  });
  // Upgraded sockets are not covered by Node's closeAllConnections().
  const closeServer = server.close.bind(server);
  server.close = callback => { dashboard?.close(); return closeServer(callback); };
  server.on('close', () => companion?.close());
  return { server, store };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const settings = readSettings();
    const { server } = await createLabServer();
    server.listen(settings.port, settings.host, () => console.log(`Croupier lab: http://${isLoopback(settings.host) ? 'localhost' : settings.host}:${settings.port} — ${settings.remoteUrl ? 'Render relay' : 'local director'}`));
    server.on('error', error => { console.error(`Lab server could not start (${error.code || 'error'}).`); process.exitCode = 1; });
  } catch { console.error('Lab startup failed. Check config/catalog.json and lab environment settings.'); process.exitCode = 1; }
}
