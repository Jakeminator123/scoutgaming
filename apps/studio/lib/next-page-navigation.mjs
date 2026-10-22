import { normalizeNativeStudioPageRequest } from './studio-native-request.mjs';
import { studioLoginReturnTo, studioPasswordToken } from './studio-login-client.mjs';

// Admin documents use public paths. An absolute configured origin prevents
// Next from adding the technical /studio basePath to an SSR redirect.
export function nextStudioLoginRedirect(returnTo = '/admin', publicOrigin) {
  const path = `/admin/login?returnTo=${encodeURIComponent(studioLoginReturnTo(returnTo))}`;
  if (publicOrigin === undefined) return path;
  const origin = new URL(publicOrigin);
  if (origin.origin !== publicOrigin || origin.protocol !== 'https:') throw Object.assign(new Error('studio_request_rejected'), { statusCode: 403 });
  return new URL(path, origin).href;
}

// Authenticate on the public host before following its one-use handoff.
// A standalone Lab document must never mint a host-only BO cookie and then
// expect that cookie on the game host. Rewritten public requests already have
// the public logical origin and retain their current form and drafts.
export function nextStudioAuthEntryRedirect(request, config, { mode = 'login', returnTo, token } = {}) {
  if (!['login', 'set-password'].includes(mode)) throw Object.assign(new Error('studio_request_rejected'), { statusCode: 403 });
  const logical = normalizeNativeStudioPageRequest(request, config);
  const [publicOrigin] = config.allowedOrigins;
  if (new URL(logical.url).origin === publicOrigin) return null;
  const target = new URL('/admin/' + mode, publicOrigin);
  if (mode === 'login') target.searchParams.set('returnTo', studioLoginReturnTo(returnTo));
  else {
    const bearer = studioPasswordToken(token);
    if (bearer) target.searchParams.set('t', bearer);
  }
  return target.href;
}
