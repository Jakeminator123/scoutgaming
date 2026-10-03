import { redirect } from 'next/navigation';
import { assertLocalPageRequest } from './http-guard.mjs';
import { studioInitialData } from './studio-server.mjs';
import { remoteUiConfiguration, authorizeRemoteUi, remoteUiInitialData } from './remote-ui.mjs';
import { nativeStudioAdminEnabled, nativeStudioAdminConfiguration, assertNativeStudioRequest, studioNativeRuntime } from './studio-native-runtime.mjs';

async function nativeUi(request: Request) {
  const config = nativeStudioAdminConfiguration();
  if (!config) throw Object.assign(new Error('studio_native_unavailable'), {statusCode: 503});
  // Next pages construct an internal http Request; exact public headers and
  // the configured origins still determine the authenticated HTTPS boundary.
  const url = new URL(request.url), origin = config.allowedOrigins.find(value => new URL(value).host === url.host);
  if (!origin) throw Object.assign(new Error('studio_request_rejected'), {statusCode: 403});
  const headers = new Headers(request.headers);
  if (headers.get('sec-fetch-mode') === 'navigate' && headers.get('sec-fetch-dest') === 'document') headers.delete('sec-fetch-site');
  const normalized = new Request(new URL(url.pathname + url.search, origin), { method: request.method, headers });
  assertNativeStudioRequest(normalized, config);
  const native = await studioNativeRuntime();
  let session;
  try { session = await native.authorize(normalized); }
  catch (error) {
    if ((error as {statusCode?:number})?.statusCode === 401) {
      const base = native.config.authBase === '/studio/api/auth' ? '/studio' : '';
      redirect(`${base}/login?returnTo=%2Fstudio`);
    }
    throw error;
  }
  if (!['admin','superadmin'].includes(session.role)) throw Object.assign(new Error('studio_request_rejected'), {statusCode: 403});
  return native;
}

function login(error: unknown, request: Request) {
  if ((error as {statusCode?: number})?.statusCode !== 401) throw error;
  const config = remoteUiConfiguration();
  const path = new URL(request.url).pathname;
  const next = path.startsWith('/studio') ? path : `/studio${path === '/' ? '' : path}`;
  redirect(`${config!.publicOrigin}/api/auth/lab/start?next=${encodeURIComponent(next)}`);
}

export async function authorizeUiPage(request: Request) {
  if (nativeStudioAdminEnabled()) { await nativeUi(request); return; }
  if (!remoteUiConfiguration()) { assertLocalPageRequest(request); return; }
  try { await authorizeRemoteUi(request); } catch (error) { login(error, request); }
}

export async function studioUiInitialData(request: Request) {
  if (nativeStudioAdminEnabled()) {
    const native = await nativeUi(request);
    if (typeof native.videoRegistry !== 'function' || typeof native.gamePolicy?.readSaved !== 'function') throw Object.assign(new Error('studio_media_registry_unavailable'), {statusCode: 503});
    const [saved, videos] = await Promise.all([
      native.gamePolicy.readSaved(), native.videoRegistry(),
    ]);
    return {project: saved.project, videos, status: {configured: true, provider: 'neon', message: 'Sparad Studio-policy läses från Neon.'}};
  }
  if (!remoteUiConfiguration()) { assertLocalPageRequest(request); return studioInitialData(); }
  try { return await remoteUiInitialData(request); } catch (error) { return login(error, request); }
}
