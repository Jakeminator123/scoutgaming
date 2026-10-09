import { isPresentationRoomReadQuery } from './studio-admin-contract.mjs';

const reject = () => { throw Object.assign(new Error('studio_request_rejected'), { statusCode: 403 }); };

// Next's route Request may omit its configured basePath. The transport URL
// also remains the Lab URL when the public frontend rewrites a same-origin
// request. Only this server-configured public/Lab pair can be reconciled; no
// arbitrary forwarded URL, Origin, credential or authorization is substituted.
export function normalizeNativeStudioRequest(request, config) {
  if (!config) throw Object.assign(new Error('studio_native_unavailable'), { statusCode: 503 });
  const url = new URL(request.url), [publicOrigin, labOrigin] = config.allowedOrigins;
  if (config.allowedOrigins.length !== 2 || !config.allowedOrigins.includes(url.origin)
    || !config.publicHosts.includes(url.host) || url.username || url.password
    || url.pathname.includes('%') || url.search && !isPresentationRoomReadQuery(request.method, url) || url.hash) reject();
  const publicHost = new URL(publicOrigin).host;
  const forwarded = request.headers.get('x-forwarded-host');
  const host = request.headers.get('host');
  const rewrite = url.origin === labOrigin && forwarded === publicHost;
  if (forwarded !== null && forwarded !== url.host && !rewrite) reject();
  if (host !== null && host !== url.host && !(rewrite && host === publicHost)) reject();
  const proto = request.headers.get('x-forwarded-proto');
  if (proto !== null && proto !== 'https') reject();
  const logicalOrigin = rewrite ? publicOrigin : url.origin;
  const origin = request.headers.get('origin');
  if (origin !== null && origin !== logicalOrigin
    || request.headers.get('sec-fetch-site') === 'cross-site'
    || request.headers.has('next-action')) reject();
  const headers = new Headers(request.headers);
  if (rewrite) {
    url.host = publicHost;
    if (host !== null) headers.set('host', publicHost);
    headers.set('x-forwarded-host', publicHost);
  }
  // The prefix comes from the validated server configuration, never a caller
  // header. Only exact native endpoint namespaces are repaired; other routes keep
  // their path and remain subject to their own exact routing checks.
  if (config.apiBase === '/studio/api/admin' && config.authBase === '/studio/api/auth'
    && (/^\/api\/(?:admin|auth|videos|layer-assets)(?:\/|$)/.test(url.pathname)
      || /^\/api\/(?:project|social|clip-controls)$/.test(url.pathname))) {
    url.pathname = '/studio' + url.pathname;
  }
  if (url.href === request.url && !rewrite) return request;
  return new Request(url, { method: request.method, headers, body: request.body,
    ...(request.body ? { duplex: 'half' } : {}), signal: request.signal,
    redirect: request.redirect, cache: request.cache, credentials: request.credentials,
    mode: request.mode, referrerPolicy: request.referrerPolicy });
}

// Server-rendered pages construct their own GET Request from Next's headers.
// The internal http spelling is allowed only here, for an exact configured
// host. API requests always use the stricter HTTPS adapter above. Top-level
// document navigation keeps the existing page exception for Sec-Fetch-Site;
// it never removes Origin or applies to an API/action/body-bearing request.
export function normalizeNativeStudioPageRequest(request, config) {
  if (!config) throw Object.assign(new Error('studio_native_unavailable'), { statusCode: 503 });
  const url = new URL(request.url);
  if (request.method !== 'GET' || request.body !== null
    || /^\/(?:studio\/)?api(?:\/|$)/.test(url.pathname)) reject();
  const origin = config.allowedOrigins.find(value => new URL(value).host === url.host);
  if (!origin || !['http:', 'https:'].includes(url.protocol)) reject();
  url.protocol = 'https:';
  const headers = new Headers(request.headers);
  if (headers.get('sec-fetch-mode') === 'navigate' && headers.get('sec-fetch-dest') === 'document') {
    headers.delete('sec-fetch-site');
  }
  if (config.apiBase === '/studio/api/admin' && config.authBase === '/studio/api/auth'
    && url.pathname !== '/studio' && !url.pathname.startsWith('/studio/')) {
    url.pathname = '/studio' + (url.pathname === '/' ? '' : url.pathname);
  }
  return normalizeNativeStudioRequest(new Request(url, { method: 'GET', headers,
    signal: request.signal, redirect: request.redirect, cache: request.cache,
    credentials: request.credentials, mode: request.mode, referrerPolicy: request.referrerPolicy }), config);
}
