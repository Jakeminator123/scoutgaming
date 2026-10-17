import { normalizeNativeStudioPageRequest } from './studio-native-request.mjs';
import { studioLoginReturnTo, studioPasswordToken } from './studio-login-client.mjs';

// Next applies its configured basePath when it emits an SSR redirect. Keep
// this destination relative to the app; returnTo is a separate public URL path.
// API Response redirects and window.location navigation use public paths.
export function nextStudioLoginRedirect(returnTo = '/studio') {
  return `/login?returnTo=${encodeURIComponent(studioLoginReturnTo(returnTo))}`;
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
  const target = new URL('/studio/' + mode, publicOrigin);
  if (mode === 'login') target.searchParams.set('returnTo', studioLoginReturnTo(returnTo));
  else {
    const bearer = studioPasswordToken(token);
    if (bearer) target.searchParams.set('t', bearer);
  }
  return target.href;
}
