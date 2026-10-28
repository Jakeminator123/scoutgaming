import { redirect } from 'next/navigation';
import { assertLocalPageRequest } from './http-guard.mjs';
import { studioInitialData } from './studio-server.mjs';
import { remoteUiConfiguration, authorizeRemoteUi, remoteUiInitialData } from './remote-ui.mjs';
import { nativeStudioAdminEnabled, nativeStudioAdminConfiguration, assertNativeStudioRequest, studioNativeRuntime } from './studio-native-runtime.mjs';
import { normalizeNativeStudioPageRequest } from './studio-native-request.mjs';
import { nextStudioLoginRedirect } from './next-page-navigation.mjs';

async function nativeUi(request: Request) {
  const config = nativeStudioAdminConfiguration();
  if (!config) throw Object.assign(new Error('studio_native_unavailable'), {statusCode: 503});
  // Page query only restores navigation; it is never part of the auth request.
  const requested = new URL(request.url);
  const returnSearch = requested.search;
  requested.search = '';
  const normalized = normalizeNativeStudioPageRequest(new Request(requested, request), config);
  assertNativeStudioRequest(normalized, config);
  const native = await studioNativeRuntime();
  let session;
  try { session = await native.authorize(normalized); }
  catch (error) {
    if ((error as {statusCode?:number})?.statusCode === 401) {
      const url = new URL(normalized.url);
      const path = url.pathname;
      const returnTo = path === '/studio' || path.startsWith('/studio/') ? path : `/studio${path === '/' ? '' : path}`;
      redirect(nextStudioLoginRedirect(returnTo + returnSearch, config.allowedOrigins[0]));
    }
    throw error;
  }
  if (!['admin','superadmin'].includes(session.role)) throw Object.assign(new Error('studio_request_rejected'), {statusCode: 403});
  return native;
}

export async function authorizeUiPage(request: Request) {
  if (nativeStudioAdminEnabled()) { await nativeUi(request); return; }
  if (!remoteUiConfiguration()) { assertLocalPageRequest(request); return; }
  // The retired Lab login (/api/auth/lab/start) is gone; a missing session stays a 401.
  await authorizeRemoteUi(request);
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
  return await remoteUiInitialData(request);
}
