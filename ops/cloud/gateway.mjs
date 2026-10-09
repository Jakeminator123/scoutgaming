import { createServer, request as httpRequest } from 'node:http';
import { posix } from 'node:path';
import { createHash, timingSafeEqual } from 'node:crypto';
import { LAB_PORT, WEB_PORT, NATIVE_P6_QA } from './config.mjs';
import { checkLabSession } from './lab-session-check.mjs';
import { vercelIngressRequest } from './vercel-ingress.mjs';

const HOP_HEADERS = new Set(['connection', 'keep-alive', 'proxy-authenticate',
  'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);

export function upstreamForHost(host, config) {
  if (host === new URL(config.gameOrigin).host) return WEB_PORT;
  if (host === new URL(config.boOrigin).host) return WEB_PORT;
  if (host === new URL(config.labOrigin).host) return LAB_PORT;
  return null;
}

function routePath(target, config) {
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//') || target.includes('#')) return null;
  try {
    const url = new URL(target, config.gameOrigin);
    if (url.origin !== config.gameOrigin) return null;
    // Web decodes and normalizes static paths. Classify the same aliases before
    // deciding whether a game-host request may reach a BO file or endpoint.
    const decoded = decodeURIComponent(url.pathname).replaceAll('\\', '/');
    return posix.normalize(decoded).split('/').map(part => part.replace(/[ .]+$/g, '').toLowerCase()).join('/');
  } catch { return null; }
}

const boPath = path => path === '/bo' || path.startsWith('/bo/')
  || path === '/api/bo' || path.startsWith('/api/bo/');
const LAB_START = '/api/auth/lab/start';
const LAB_CALLBACK = '/api/auth/lab/callback';
const LAB_CHECK = '/api/auth/lab/check';
const STUDIO_ALIASES = new Set(['/lab', '/lab/', '/studio-astrid', '/studio-astrid/', '/studio-lissabon', '/studio-lissabon/']);

// Old product aliases select staff control; they never become another API mount.
// Keep the original query, but only accept exact read-only document paths.
export function studioAliasRedirect({ headers, method, url }, config) {
  if (!config.singleOrigin || headers?.host !== new URL(config.gameOrigin).host
    || !['GET', 'HEAD'].includes(method) || typeof url !== 'string'
    || /[\u0000-\u0020\u007f#]/.test(url)) return null;
  const queryAt = url.indexOf('?');
  const path = queryAt < 0 ? url : url.slice(0, queryAt);
  return STUDIO_ALIASES.has(path) ? `/control${queryAt < 0 ? '' : url.slice(queryAt)}` : null;
}

export function upstreamForRequest({ headers, method, url }, config) {
  const host = headers?.host;
  const path = routePath(url, config);
  if (!path) return null;
  if (host === new URL(config.gameOrigin).host) {
    if (path === LAB_CHECK) return null; // The identity check is gateway-internal only.
    if (config.singleOrigin) {
      // Reject noncanonical aliases at the mount boundary rather than allowing
      // Web and Next to interpret encoded/dot/case variants differently.
      if (path === '/studio' || path.startsWith('/studio/')) {
        const raw = new URL(url, config.gameOrigin).pathname;
        if (!(raw === '/studio' || raw.startsWith('/studio/')) || /%|\\|\/\//.test(raw)) return null;
        return LAB_PORT;
      }
      return WEB_PORT;
    }
    if (boPath(path) && !(method === 'GET' && url === '/api/bo/config')) return null;
    return WEB_PORT;
  }
  if (host === new URL(config.boOrigin).host) return boPath(path) ? WEB_PORT : null;
  if (host === new URL(config.labOrigin).host) {
    if (path === LAB_CHECK) return null;
    if (path === LAB_START || path === LAB_CALLBACK) {
      // Only the canonical public paths are routed to Web for the handoff.
      return new URL(url, config.labOrigin).pathname === path ? WEB_PORT : null;
    }
    return LAB_PORT;
  }
  return null;
}

function headersWithoutHops(headers) {
  return Object.fromEntries(Object.entries(headers).filter(([key]) => !HOP_HEADERS.has(key.toLowerCase())));
}

export function proxyHeaders(headers, host) {
  const kept = Object.fromEntries(Object.entries(headers).filter(([key]) => {
    const name = key.toLowerCase();
    return !HOP_HEADERS.has(name) && name !== 'forwarded' && !name.startsWith('x-forwarded-')
      && name !== 'x-croupier-lab-authorized';
  }).map(([key, value]) => [key.toLowerCase(), value]));
  // The Lab authorization header remains absent until a gateway-side identity
  // check authorizes the request. It must never be supplied by the browser.
  return { ...kept, host, 'x-forwarded-host': host, 'x-forwarded-port': '443', 'x-forwarded-proto': 'https' };
}

const nativeP6Routes=new Map([['/api/product/speech',{method:'POST',token:'speech'}],
  ['/api/studio/advice',{method:'POST',token:'director'}],['/internal/p6/qa-routing',{method:'GET',token:'readback'}]]);
export function nativeP6QaRouterRequest(incoming, qa) {
  if (!qa) return null;
  const target=typeof incoming.url==='string'?incoming.url.split(/[?#]/,1)[0]:'';
  if (!nativeP6Routes.has(target)) return null;
  const deny=status=>({accepted:false,status});
  if (qa.serviceId!==NATIVE_P6_QA.serviceId || qa.origin!==NATIVE_P6_QA.origin || qa.dataRoot!==NATIVE_P6_QA.dataRoot
    || qa.environmentId!==NATIVE_P6_QA.environmentId || qa.workspaceId!==NATIVE_P6_QA.workspaceId || qa.database!==NATIVE_P6_QA.database
    || incoming.headers?.host!==new URL(NATIVE_P6_QA.origin).host) return deny(421);
  if (incoming.url!==target) return deny(404);
  const route=nativeP6Routes.get(target);
  if (incoming.method!==route.method) return deny(405);
  if (['origin','cookie','sec-fetch-site','x-croupier-vercel-secret','x-croupier-p6-stage-ticket','x-croupier-p6-stage']
    .some(k=>Object.hasOwn(incoming.headers,k))) return deny(403);
  const supplied=incoming.headers.authorization,expected=qa.tokens?.[route.token];
  if (typeof supplied!=='string'||!/^Bearer [^\s]+$/.test(supplied)||supplied.length>4096||typeof expected!=='string') return deny(401);
  const sha=value=>createHash('sha256').update(value).digest();
  if (!timingSafeEqual(sha(supplied.slice(7)),sha(expected))) return deny(401);
  return {accepted:true,port:WEB_PORT};
}

// One platform port, three exact public hostnames. The original Host and Origin
// reach the child; rewriting them to loopback would defeat application checks.
export function createCloudGateway(config, { labInternalSecret, sessionCheck = checkLabSession,
  webPort = WEB_PORT, labPort = LAB_PORT, vercelIngress = config.vercelIngress, renderGitCommit } = {}) {
  if (typeof labInternalSecret !== 'string' || Buffer.byteLength(labInternalSecret) < 32) {
    throw new Error('The cloud Lab gateway requires an internal secret.');
  }
  const labHost = new URL(config.labOrigin).host;
  // Snapshot only Render's parent-process deployment metadata, never request data.
  const commitSha = typeof renderGitCommit === 'string' && renderGitCommit.length === 40 && /^[a-fA-F0-9]{40}$/.test(renderGitCommit)
    ? renderGitCommit.toLowerCase() : null;
  const versionBody = JSON.stringify(commitSha
    ? { schemaVersion: 1, provider: 'render', commitSha }
    : { error: 'render_version_unavailable' });
  if (vercelIngress && (!config.singleOrigin || vercelIngress.publicOrigin !== config.gameOrigin)) {
    throw new Error('Vercel ingress requires the canonical single-origin layout.');
  }
  const server = createServer(async (incoming, outgoing) => {
    // Own-QA service credentials are a separate boundary from the public
    // Vercel transport. Only these exact three paths can bypass that ingress.
    const nativeP6=nativeP6QaRouterRequest(incoming,config.nativeP6QaRouter);
    if (nativeP6) {
      if (!nativeP6.accepted) { outgoing.writeHead(nativeP6.status,{'Cache-Control':'no-store'});outgoing.end();return; }
      const upstream=httpRequest({hostname:'127.0.0.1',port:webPort,method:incoming.method,path:incoming.url,
        headers:proxyHeaders(incoming.headers,incoming.headers.host),timeout:35000},reply=>{
        outgoing.writeHead(reply.statusCode??502,headersWithoutHops(reply.headers));reply.pipe(outgoing);
      });
      upstream.on('timeout',()=>upstream.destroy());
      upstream.on('error',()=>{if(!outgoing.headersSent)outgoing.writeHead(502,{'Cache-Control':'no-store'});outgoing.end();});
      incoming.on('aborted',()=>upstream.destroy());outgoing.on('close',()=>upstream.destroy());incoming.pipe(upstream);return;
    }
    const ingress = vercelIngressRequest(incoming, vercelIngress);
    if (!ingress.accepted) { outgoing.writeHead(421, { 'Cache-Control': 'no-store' }); outgoing.end(); return; }
    if (ingress.health) { outgoing.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); outgoing.end('ok'); return; }
    if (ingress.version || (incoming.url === '/__cloud/version' && ['GET', 'HEAD'].includes(incoming.method)
      && !incoming.headers.upgrade && upstreamForHost(incoming.headers.host, config))) {
      outgoing.writeHead(commitSha ? 200 : 503, { 'Content-Type': 'application/json',
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      outgoing.end(incoming.method === 'HEAD' ? undefined : versionBody); return;
    }
    const versionPath = routePath(incoming.url, config);
    if (versionPath === '/__cloud/version' || versionPath?.startsWith('/__cloud/version/')) {
      outgoing.writeHead(421, { 'Cache-Control': 'no-store' }); outgoing.end(); return;
    }
    if (ingress.redirect) { outgoing.writeHead(307, {Location:ingress.redirect,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}); outgoing.end(); return; }
    if (ingress.transported) incoming.headers = ingress.headers;
    if (ingress.session) {
      let session;
      try { session = await sessionCheck(incoming.headers.cookie, labHost, { port: webPort }); }
      catch { session = { authorized: false, available: false }; }
      outgoing.writeHead(!session.available ? 503 : session.authorized ? 200 : 401, {
        'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
      });
      outgoing.end(JSON.stringify({ authorized: session.available && session.authorized }));
      return;
    }
    const studioLocation = studioAliasRedirect(incoming, config);
    if (studioLocation) {
      outgoing.writeHead(307, { Location: studioLocation, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
      outgoing.end();
      return;
    }
    if (incoming.method === 'GET' && incoming.url === '/__cloud/health'
      && upstreamForHost(incoming.headers.host, config)) {
      outgoing.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
      outgoing.end('ok');
      return;
    }
    const routePort = upstreamForRequest(incoming, config);
    if (!routePort) {
      outgoing.writeHead(421, { 'Cache-Control': 'no-store' });
      outgoing.end();
      return;
    }
    if (incoming.headers.host === labHost && routePort === LAB_PORT) {
      let session;
      try { session = await sessionCheck(incoming.headers.cookie, labHost, { port: webPort }); }
      catch { session = { authorized: false, available: false }; }
      if (outgoing.destroyed) return;
      if (!session.available) {
        outgoing.writeHead(503, { 'Cache-Control': 'no-store' });
        outgoing.end();
        return;
      }
      if (!session.authorized) {
        const document = incoming.method === 'GET'
          && incoming.headers['sec-fetch-mode'] === 'navigate'
          && incoming.headers['sec-fetch-dest'] === 'document';
        if (document) outgoing.writeHead(303, { Location: `/api/auth/lab/start?next=${encodeURIComponent(incoming.url)}`,
          'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
        else outgoing.writeHead(401, { 'Cache-Control': 'no-store' });
        outgoing.end();
        return;
      }
    }
    const headers = proxyHeaders(incoming.headers, incoming.headers.host);
    if (incoming.headers.host === labHost && routePort === LAB_PORT) {
      headers['x-croupier-lab-authorized'] = labInternalSecret;
    }
    const targetPort = routePort === WEB_PORT ? webPort : labPort;
    const upstream = httpRequest({ hostname: '127.0.0.1', port: targetPort,
      method: incoming.method, path: incoming.url, headers }, response => {
      outgoing.writeHead(response.statusCode ?? 502, headersWithoutHops(response.headers));
      response.pipe(outgoing);
    });
    upstream.on('error', () => {
      if (!outgoing.headersSent) outgoing.writeHead(502, { 'Cache-Control': 'no-store' });
      outgoing.end();
    });
    incoming.on('aborted', () => upstream.destroy());
    outgoing.on('close', () => upstream.destroy());
    incoming.pipe(upstream);
  });
  server.on('upgrade', (incoming, socket, head) => {
    const reject = status => {
      if (!socket.destroyed) socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    };
    const ingress = vercelIngressRequest(incoming, vercelIngress);
    if (!ingress.accepted) { reject(421); return; }
    if (ingress.transported) incoming.headers = ingress.headers;
    // Only Web's two authenticated speech endpoints may cross this boundary.
    // The relay still verifies the worker bearer token or the client's signed
    // ticket, session cookie and current owner before any paid work begins.
    if (!config.streaming || incoming.method !== 'GET'
      || incoming.headers.host !== new URL(config.gameOrigin).host
      || !['/speech-stream', '/lipsync-worker'].includes(incoming.url)
      || incoming.headers.upgrade?.toLowerCase() !== 'websocket'
      || (incoming.url === '/speech-stream' && incoming.headers.origin !== config.gameOrigin)
      || (incoming.url === '/lipsync-worker' && incoming.headers.origin
        && incoming.headers.origin !== config.gameOrigin)) {
      reject(421); return;
    }
    const headers = { ...proxyHeaders(incoming.headers, incoming.headers.host),
      connection: 'Upgrade', upgrade: 'websocket' };
    const upstream = httpRequest({ hostname: '127.0.0.1', port: webPort,
      method: 'GET', path: incoming.url, headers });
    const admission = setTimeout(() => upstream.destroy(), 10000);
    admission.unref?.();
    upstream.on('upgrade', (response, peer, peerHead) => {
      clearTimeout(admission);
      if (socket.destroyed) { peer.destroy(); return; }
      const lines = [`HTTP/${response.httpVersion} ${response.statusCode} ${response.statusMessage}`];
      for (let i = 0; i < response.rawHeaders.length; i += 2) {
        lines.push(`${response.rawHeaders[i]}: ${response.rawHeaders[i + 1]}`);
      }
      socket.write(`${lines.join('\r\n')}\r\n\r\n`);
      if (peerHead.length) socket.write(peerHead);
      if (head.length) peer.write(head);
      socket.on('error', () => peer.destroy());
      peer.on('error', () => socket.destroy());
      socket.on('close', () => peer.destroy());
      peer.on('close', () => socket.destroy());
      peer.pipe(socket); socket.pipe(peer);
    });
    upstream.on('response', response => {
      clearTimeout(admission);
      // Preserve the relay's 401/403/409/503 admission decision without
      // exposing any upstream body or credential in the gateway response.
      reject(response.statusCode >= 400 && response.statusCode <= 599 ? response.statusCode : 502);
      response.resume();
    });
    upstream.on('error', () => { clearTimeout(admission); reject(502); });
    socket.on('close', () => upstream.destroy());
    upstream.end();
  });
  server.on('connect', (_request, socket) => {
    socket.end('HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\n\r\n');
  });
  server.requestTimeout = 0; // SSE is a long-lived response.
  return server;
}
