import { studioLoginReturnTo } from './studio-login-client.mjs';

// Next applies its configured basePath when it emits an SSR redirect. Keep
// this destination relative to the app; returnTo is a separate public URL path.
// API Response redirects and window.location navigation use public paths.
export function nextStudioLoginRedirect(returnTo = '/studio') {
  return `/login?returnTo=${encodeURIComponent(studioLoginReturnTo(returnTo))}`;
}
