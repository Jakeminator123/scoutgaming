import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { createHash } from 'node:crypto';
import { Transform } from 'node:stream';

export const DASHBOARD_BASE_PATH = '/openclaw';
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const HOP_HEADERS = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);
const REQUEST_HEADERS = ['accept', 'accept-encoding', 'accept-language', 'authorization', 'cookie', 'user-agent', 'if-none-match', 'if-modified-since', 'range', 'if-range', 'x-openclaw-scopes'];
const FORBIDDEN_QUERY_KEYS = new Set(['gatewayurl', 'upstream', 'target', 'redirect', 'redirect_uri', 'returnto', 'next']);
const RESPONSE_SECURITY = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };
const STATUS_TEXT = { 400: 'Bad Request', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 413: 'Payload Too Large', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout' };
const isLoopback = hostname => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);

function isPrivateHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (isLoopback(host) || /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(host) || host.endsWith('.internal')) return true;
  if (isIP(host) === 4) {
    const [a, b] = host.split('.').map(Number);
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return isIP(host) === 6 && /^(?:fc|fd)[0-9a-f]{2}:/i.test(host);
}

function parseConfiguration({ baseUrl, origin, allowLoopbackHttp = false, requestTimeoutMs = 15000, maxConnections = 32, maxBodyBytes = 1024 * 1024, webSocketIdleTimeoutMs = 300000 }) {
  if (!baseUrl && !origin) return null;
  const invalid = () => { throw new Error('Invalid native OpenClaw dashboard proxy configuration.'); };
  if (typeof baseUrl !== 'string' || typeof origin !== 'string' || !baseUrl || !origin) return invalid();
  let upstream, publicUrl;
  try { upstream = new URL(baseUrl); publicUrl = new URL(origin); } catch { return invalid(); }
  for (const url of [upstream, publicUrl]) {
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') return invalid();
  }
  if (!isPrivateHost(upstream.hostname)) return invalid();
  if (publicUrl.protocol !== 'https:' && !(allowLoopbackHttp === true && isLoopback(publicUrl.hostname))) return invalid();
  if (![requestTimeoutMs, maxConnections, maxBodyBytes, webSocketIdleTimeoutMs].every(Number.isInteger) || requestTimeoutMs < 20 || requestTimeoutMs > 60000 || maxConnections < 1 || maxConnections > 128 || maxBodyBytes < 1 || maxBodyBytes > 16 * 1024 * 1024 || webSocketIdleTimeoutMs < 0 || webSocketIdleTimeoutMs > 3600000) return invalid();
  return { upstream, publicUrl, requestTimeoutMs, maxConnections, maxBodyBytes, webSocketIdleTimeoutMs };
}

function owns(raw) {
  return typeof raw === 'string' && /^\/openclaw(?:\/|\?|$)/.test(raw);
}

function requestRoute(req, config, websocket) {
  const raw = req.url;
  if (!owns(raw)) return { error: 404 };
  if (raw.length > 8192 || /[\u0000-\u0020\u007f\\#]/.test(raw)) return { error: 400 };
  const path = raw.split('?', 1)[0];
  let parsed, decoded;
  try { parsed = new URL(raw, config.publicUrl); decoded = decodeURIComponent(path); } catch { return { error: 400 }; }
  // Retain the mount path; never normalize traversal into an unrelated Gateway route.
  if (parsed.origin !== config.publicUrl.origin || parsed.pathname !== path || !owns(decoded) || /[\u0000-\u0020\u007f\\]/.test(decoded) || decoded.split('/').some(part => part === '.' || part === '..') || /%[0-9a-f]{2}/i.test(decoded)) return { error: 400 };
  for (const key of parsed.searchParams.keys()) if (FORBIDDEN_QUERY_KEYS.has(key.toLowerCase())) return { error: 400 };
  const host = req.headers.host;
  if (typeof host !== 'string' || host.toLowerCase() !== config.publicUrl.host) return { error: 403 };
  // Do not select one of two conflicting security headers according to Node's merge policy.
  const counts = new Map();
  for (let i = 0; i < (req.rawHeaders?.length ?? 0); i += 2) {
    const name = req.rawHeaders[i].toLowerCase();
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (['host', 'origin', 'authorization'].some(name => (counts.get(name) ?? 0) > 1)) return { error: 403 };
  const nominatedHopHeaders = String(req.headers.connection ?? '').toLowerCase().split(',').map(s => s.trim());
  if (['host', 'origin', 'authorization', 'cookie', 'x-openclaw-scopes'].some(name => nominatedHopHeaders.includes(name))) return { error: 403 };
  const origin = req.headers.origin;
  if ((origin !== undefined && origin !== config.publicUrl.origin) || (websocket && origin !== config.publicUrl.origin)) return { error: 403 };
  if (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])) return { error: 403 };
  const relative = decoded.slice(DASHBOARD_BASE_PATH.length);
  // Reserved Gateway APIs must never become aliases beneath the UI mount.
  if (/^\/(?:v1|hooks|oauth)(?:\/|$)/.test(relative) || /^\/tools\/invoke(?:\/|$)/.test(relative) || /^\/desktop\/(?:observe|attach)(?:\/|$)/.test(relative)) return { error: 404 };
  if (relative.startsWith('/api/') && !/^\/api\/users\/[^/]+\/avatar\/?$/.test(relative) && !/^\/api\/chat\/media\/outgoing\/[^/]+(?:\/[^/]+)*$/.test(relative)) return { error: 404 };
  if (relative.startsWith('/.well-known/') && relative !== '/.well-known/openclaw/browser-bootstrap') return { error: 404 };
  if (websocket) {
    if (!['', '/'].includes(relative) || parsed.search || req.method !== 'GET') return { error: 404 };
    const key = req.headers['sec-websocket-key'];
    if (String(req.headers.upgrade).toLowerCase() !== 'websocket' || !String(req.headers.connection).toLowerCase().split(',').map(s => s.trim()).includes('upgrade') || req.headers['sec-websocket-version'] !== '13' || typeof key !== 'string' || !/^[A-Za-z0-9+/]{22}==$/.test(key) || Buffer.from(key, 'base64').length !== 16 || req.headers['transfer-encoding'] || Number(req.headers['content-length'] ?? 0) !== 0) return { error: 400 };
  } else {
    const explicitMediaAllow = relative === '/__openclaw__/assistant-media' && req.method === 'POST';
    if (!['GET', 'HEAD'].includes(req.method) && !explicitMediaAllow) return { error: 405 };
    if (explicitMediaAllow && (origin !== config.publicUrl.origin || !String(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json'))) return { error: 403 };
    const declaredLength = req.headers['content-length'];
    if (declaredLength !== undefined && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > config.maxBodyBytes)) return { error: 413 };
    if (!explicitMediaAllow && (Number(declaredLength ?? 0) !== 0 || req.headers['transfer-encoding'])) return { error: 400 };
  }
  return { path: `${parsed.pathname}${parsed.search}` };
}

function forwardedRequestHeaders(req, config, websocket) {
  const forbidden = new Set([...HOP_HEADERS, ...String(req.headers.connection ?? '').toLowerCase().split(',').map(s => s.trim())]);
  const headers = { host: config.publicUrl.host };
  for (const name of REQUEST_HEADERS) {
    // Preserve a caller's scope restriction. Dropping it could restore Gateway defaults.
    if (!forbidden.has(name) && req.headers[name] !== undefined) headers[name] = req.headers[name];
  }
  if (req.headers.origin !== undefined) headers.origin = config.publicUrl.origin;
  if (req.method === 'POST') for (const name of ['content-type', 'content-length']) if (req.headers[name] !== undefined) headers[name] = req.headers[name];
  if (websocket) {
    headers.connection = 'Upgrade'; headers.upgrade = 'websocket';
    for (const name of ['sec-websocket-key', 'sec-websocket-version', 'sec-websocket-extensions', 'sec-websocket-protocol']) if (req.headers[name] !== undefined) headers[name] = req.headers[name];
  }
  return headers;
}

function responseHeaders(source, config) {
  const hop = new Set([...HOP_HEADERS, ...String(source.connection ?? '').toLowerCase().split(',').map(s => s.trim())]);
  const headers = {};
  for (const [name, value] of Object.entries(source)) if (!hop.has(name) && value !== undefined) headers[name] = value;
  if (headers.location !== undefined) {
    if (typeof headers.location !== 'string' || headers.location.startsWith('//') || /[\u0000-\u0020\\]/.test(headers.location)) return null;
    let location;
    try { location = new URL(headers.location, config.upstream); } catch { return null; }
    if (![config.upstream.origin, config.publicUrl.origin].includes(location.origin) || location.username || location.password || !owns(location.pathname)) return null;
    for (const key of location.searchParams.keys()) if (FORBIDDEN_QUERY_KEYS.has(key.toLowerCase())) return null;
    headers.location = `${location.pathname}${location.search}${location.hash}`;
  }
  // Cache credentials and responses nowhere; retain the native CSP and other policies.
  return { ...headers, ...RESPONSE_SECURITY };
}

function replyHttp(res, status) {
  if (res.destroyed || res.writableEnded) return;
  if (res.headersSent) { res.destroy(); return; }
  res.writeHead(status, { ...RESPONSE_SECURITY, 'content-type': 'text/plain; charset=utf-8' });
  res.end(`OpenClaw dashboard: ${STATUS_TEXT[status] ?? 'Unavailable'}\n`);
}

function replyUpgrade(socket, status) {
  if (socket.destroyed) return;
  const body = `OpenClaw dashboard: ${STATUS_TEXT[status] ?? 'Unavailable'}\n`;
  socket.end(`HTTP/1.1 ${status} ${STATUS_TEXT[status] ?? 'Unavailable'}\r\nConnection: close\r\nCache-Control: no-store\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}

/**
 * Native, credential-neutral UI transport; the private Gateway still authenticates
 * password/device-token connect frames and applies its normal remote pairing rules.
 * Verified against official openclaw/openclaw tag v2026.9.5:
 * - control-ui-routing.ts:122–131 retains controlUi.basePath for documents/assets.
 * - control-ui-shared.ts:23 constructs WS URLs with the same base path.
 * - server-http-upgrades.ts:419–431 admits the ordinary Gateway WS at that path.
 * - control-ui.ts:1056–1067 authenticates bootstrap reads; avatars/media have their
 *   own native read authorization. No /v1, /tools or root Gateway proxy is exposed.
 * Source: https://github.com/openclaw/openclaw/tree/v2026.9.5/src/gateway
 */
export function createDashboardProxy(options = {}) {
  const config = parseConfiguration(options);
  if (!config) return null;
  const request = config.upstream.protocol === 'https:' ? httpsRequest : httpRequest;
  const active = new Set();
  let closed = false;
  const makeRequest = (req, path, websocket) => request({
    protocol: config.upstream.protocol,
    hostname: config.upstream.hostname.replace(/^\[|\]$/g, ''),
    port: config.upstream.port || (config.upstream.protocol === 'https:' ? 443 : 80),
    method: req.method, path, headers: forwardedRequestHeaders(req, config, websocket),
    agent: false,
  });
  const handles = req => owns(req?.url);

  function handleRequest(req, res) {
    if (!handles(req)) return false;
    const route = requestRoute(req, config, false);
    if (route.error || closed || active.size >= config.maxConnections) { replyHttp(res, route.error || 503); req.resume(); return true; }
    let upstream, upstreamResponse, body, timer;
    let ended = false;
    const cleanup = () => { if (ended) return; ended = true; clearTimeout(timer); active.delete(task); };
    const abort = () => { cleanup(); body?.destroy(); upstreamResponse?.destroy(); upstream?.destroy(); if (!res.writableEnded) res.destroy(); };
    const fail = status => { if (ended) return; cleanup(); req.unpipe(body); body?.destroy(); upstreamResponse?.destroy(); upstream?.destroy(); replyHttp(res, status); req.resume(); };
    const task = { abort };
    active.add(task);
    res.once('finish', cleanup);
    res.once('close', () => { if (!res.writableFinished) abort(); });
    res.once('error', abort);
    req.once('aborted', abort);
    try {
      upstream = makeRequest(req, route.path, false);
      upstream.once('error', () => fail(502));
      upstream.once('response', response => {
        if (ended) { response.destroy(); return; }
        upstreamResponse = response;
        const headers = responseHeaders(response.headers, config);
        if (!headers) { fail(502); return; }
        response.once('aborted', () => fail(502));
        response.once('error', () => fail(502));
        res.writeHead(response.statusCode || 502, headers);
        response.pipe(res);
      });
      // A plain HTTP request cannot smuggle an upgraded stream into this path.
      upstream.once('upgrade', (_response, socket) => { socket.destroy(); fail(502); });
      timer = setTimeout(() => fail(504), config.requestTimeoutMs); timer.unref();
      if (req.method === 'POST') {
        let bytes = 0;
        body = new Transform({ transform(chunk, _encoding, done) {
          bytes += chunk.length;
          if (bytes > config.maxBodyBytes) { done(new Error('body_limit')); return; }
          done(null, chunk);
        } });
        body.once('error', () => fail(413));
        req.pipe(body).pipe(upstream);
      } else upstream.end();
    } catch { fail(502); }
    return true;
  }

  function handleUpgrade(req, socket, head = Buffer.alloc(0)) {
    if (!handles(req)) return false;
    socket.on('error', () => socket.destroy());
    const route = requestRoute(req, config, true);
    if (route.error || closed || active.size >= config.maxConnections) { replyUpgrade(socket, route.error || 503); return true; }
    socket.pause();
    let upstream, tunnel, timer;
    let ended = false, upgraded = false;
    const cleanup = () => { if (ended) return; ended = true; clearTimeout(timer); active.delete(task); };
    const abort = () => { cleanup(); upstream?.destroy(); tunnel?.destroy(); socket.destroy(); };
    const fail = status => { if (ended) return; cleanup(); upstream?.destroy(); tunnel?.destroy(); if (upgraded) socket.destroy(); else replyUpgrade(socket, status); };
    const task = { abort };
    active.add(task);
    socket.once('close', abort);
    try {
      upstream = makeRequest(req, route.path, true);
      upstream.once('error', () => fail(502));
      upstream.once('response', response => { response.destroy(); fail(response.statusCode === 401 || response.statusCode === 403 ? 403 : 502); });
      upstream.once('upgrade', (response, upstreamSocket, upstreamHead) => {
        if (ended) { upstreamSocket.destroy(); return; }
        tunnel = upstreamSocket;
        const expected = createHash('sha1').update(`${req.headers['sec-websocket-key']}${WS_GUID}`).digest('base64');
        const headers = responseHeaders(response.headers, config);
        if (!headers || response.statusCode !== 101 || String(response.headers.upgrade).toLowerCase() !== 'websocket' || response.headers['sec-websocket-accept'] !== expected) { fail(502); return; }
        const protocol = response.headers['sec-websocket-protocol'];
        if (protocol && !String(req.headers['sec-websocket-protocol'] ?? '').split(',').map(s => s.trim()).includes(protocol)) { fail(502); return; }
        clearTimeout(timer); upgraded = true;
        delete headers['content-length'];
        headers.connection = 'Upgrade'; headers.upgrade = 'websocket';
        const serialized = Object.entries(headers).flatMap(([name, values]) => (Array.isArray(values) ? values : [values]).map(value => `${name}: ${value}\r\n`)).join('');
        socket.write(`HTTP/1.1 101 Switching Protocols\r\n${serialized}\r\n`);
        // Preserve already-received frame bytes; neither auth frames nor RPCs are rewritten.
        if (upstreamHead.length) socket.write(upstreamHead);
        if (head.length) tunnel.write(head);
        tunnel.on('error', abort); tunnel.once('close', abort);
        if (config.webSocketIdleTimeoutMs) {
          socket.setTimeout(config.webSocketIdleTimeoutMs, abort);
          tunnel.setTimeout(config.webSocketIdleTimeoutMs, abort);
        }
        socket.pipe(tunnel); tunnel.pipe(socket); socket.resume();
      });
      timer = setTimeout(() => fail(504), config.requestTimeoutMs); timer.unref();
      upstream.end();
    } catch { fail(502); }
    return true;
  }

  return { handles, handleRequest, handleUpgrade, close() { closed = true; for (const task of [...active]) task.abort(); } };
}
