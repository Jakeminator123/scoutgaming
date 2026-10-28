import { isPresentationRoomReadQuery } from './studio-admin-contract.mjs';
import { isStudioRepliesReadQuery } from './studio-replies-query.mjs';
import { resolveWorkspaceSurfacePath } from '../../../packages/navigation/workspace-surfaces.mjs';
import { isDesignPreviewPage } from './design-preview-paths.mjs';

// Only fixed enums and booleans are exposed in transport diagnostics. Never
// return header values, URLs, queries, cookies, identities or credentials.
export function studioDocumentNavigationMetadata(request) {
  const headers = request.headers;
  const mode = headers.get('sec-fetch-mode'), destination = headers.get('sec-fetch-dest');
  return {
    controlDocument: resolveWorkspaceSurfacePath(new URL(request.url).pathname)?.surface === 'control'
      && request.method === 'GET' && request.body === null,
    mode: mode === null ? 'missing' : ['navigate','cors'].includes(mode) ? mode : 'other',
    destination: destination === null ? 'missing' : ['document','iframe'].includes(destination) ? destination : 'other',
    crossSite: headers.get('sec-fetch-site') === 'cross-site',
    originPresent: headers.has('origin'), actionPresent: headers.has('next-action'),
  };
}

// Apply the existing document-navigation exception at the middleware boundary.
// This is only a known staff or partner document;
// API/action/body requests and Origin retain their original protections.
export function studioDocumentNavigationHeaders(request) {
  const headers = new Headers(request.headers);
  const pathname = new URL(request.url).pathname;
  const surface = resolveWorkspaceSurfacePath(pathname);
  const publicPath = pathname.startsWith('/studio/') ? pathname.slice('/studio'.length) : pathname;
  const adminDocument = publicPath === '/admin' || publicPath === '/admin/lobby'
    || publicPath === '/admin/login' || publicPath === '/admin/set-password'
    || publicPath.startsWith('/admin/') && isDesignPreviewPage(publicPath.slice('/admin/'.length));
  // Vercel's fetch hop can replace navigate with cors before middleware too.
  // Accept that observed shape only without Origin and on known documents;
  // explicit Origin, API/action/body requests and frames keep their guards.
  const mode = headers.get('sec-fetch-mode');
  const documentMode = mode === 'navigate' || mode === 'cors' && !headers.has('origin');
  if ((surface?.surface === 'control' || surface?.surface === 'partner' || adminDocument) && request.method === 'GET' && request.body === null
    && documentMode && headers.get('sec-fetch-dest') === 'document'
    && !headers.has('next-action')) headers.delete('sec-fetch-site');
  return headers;
}

const reject = () => { throw Object.assign(new Error('studio_request_rejected'), { statusCode: 403 }); };

// Origins trusted by the assistant endpoints; the same rule as the native Admin
// configuration. Unified UI (www) trusts only CROUPIER_PUBLIC_ORIGIN and ignores
// CROUPIER_LAB_UI_ORIGIN, so a legacy alias host never becomes trusted there.
// The split Lab UI still needs both, distinct. Returns null when invalid (503).
export function assistantRequestConfiguration(env = process.env) {
  const unifiedUi = env.CROUPIER_VERCEL_UNIFIED_UI === '1';
  const origins = unifiedUi ? [env.CROUPIER_PUBLIC_ORIGIN] : [env.CROUPIER_PUBLIC_ORIGIN, env.CROUPIER_LAB_UI_ORIGIN];
  for (const value of origins) {
    let url; try { url = new URL(value); } catch { return null; }
    if (url.origin !== value || url.protocol !== 'https:' || url.username || url.password
      || ['localhost','127.0.0.1','[::1]'].includes(url.hostname)) return null;
  }
  if (new Set(origins).size !== origins.length) return null;
  const studio = env.CROUPIER_LAB_BASE_PATH === '/studio';
  return Object.freeze({ allowedOrigins: origins, ...(unifiedUi ? { unifiedUi: true } : {}),
    publicHosts: origins.map(origin => new URL(origin).host),
    apiBase: studio ? '/studio/api/admin' : '/api/admin', authBase: studio ? '/studio/api/auth' : '/api/auth' });
}

// Next's route Request may omit its configured basePath. Unified UI accepts
// only its public origin. Separate deployments can retain the Lab transport
// URL after a public frontend rewrite; only that configured pair is reconciled.
// No arbitrary forwarded URL, Origin, credential or authorization is substituted.
export function normalizeNativeStudioRequest(request, config) {
  if (!config) throw Object.assign(new Error('studio_native_unavailable'), { statusCode: 503 });
  const url = new URL(request.url), [publicOrigin, labOrigin] = config.allowedOrigins;
  const unifiedUi = config.unifiedUi === true;
  if (config.allowedOrigins.length !== (unifiedUi ? 1 : 2) || !config.allowedOrigins.includes(url.origin)
    || !config.publicHosts.includes(url.host) || url.username || url.password
    || url.pathname.includes('%') || url.search && !isPresentationRoomReadQuery(request.method, url) && !isStudioRepliesReadQuery(request.method, url) || url.hash) reject();
  const publicHost = new URL(publicOrigin).host;
  const forwarded = request.headers.get('x-forwarded-host');
  const host = request.headers.get('host');
  const rewrite = !unifiedUi && url.origin === labOrigin && forwarded === publicHost;
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
    && (/^\/api\/(?:admin|auth|videos|dealers|layer-assets|replies|forge)(?:\/|$)/.test(url.pathname)
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
  // The configured frontend can preserve cors/document through SSR. Reuse the
  // same known-document rule; this does not authorize a session or operator.
  const headers = studioDocumentNavigationHeaders(request);
  if (headers.get('sec-fetch-mode') === 'navigate' && headers.get('sec-fetch-dest') === 'document') {
    headers.delete('sec-fetch-site');
  }
  if (config.apiBase === '/studio/api/admin' && config.authBase === '/studio/api/auth'
    && url.pathname !== '/studio' && !url.pathname.startsWith('/studio/')) {
    url.pathname = '/studio' + (url.pathname === '/' ? '' : url.pathname);
  }
  try {
    return normalizeNativeStudioRequest(new Request(url, { method: 'GET', headers,
      signal: request.signal, redirect: request.redirect, cache: request.cache,
      credentials: request.credentials, mode: request.mode, referrerPolicy: request.referrerPolicy }), config);
  } catch (error) {
    const metadata = studioDocumentNavigationMetadata(request);
    if (error?.statusCode === 403 && metadata.crossSite)
      error.studioNavigation = { stage: 'ssr', ...metadata };
    throw error;
  }
}
