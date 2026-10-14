import { studioAdminSectionPolicy, studioAdminActionPolicy } from './studio-access-policy.mjs';

// Future-only addresses, not active routes or an automatic proxy/redirect.
// Descriptors never perform session, Origin/CSRF, input or revision/CAS checks.
export const STUDIO_ROUTES = Object.freeze({
  home: '/studio', login: '/studio/login', administration: '/studio/administration',
  authApi: '/studio/api/auth', adminApi: '/studio/api/admin',
  blackjack: '/blackjack', game: '/game',
});

export function studioAdminSectionPath(section) {
  const policy = studioAdminSectionPolicy(section);
  return policy ? `${STUDIO_ROUTES.administration}/${policy.id}` : null;
}

function adminEndpoint(method, action) {
  const policy = studioAdminActionPolicy(action);
  if (!policy) throw new Error(`Unknown Studio admin action: ${action}`);
  return Object.freeze({
    method, action, path: `${STUDIO_ROUTES.adminApi}/${action}`,
    minimumRole: policy.minimumRole, handlerRequirements: policy.handlerRequirements,
  });
}

export const STUDIO_ADMIN_ENDPOINTS = Object.freeze([
  ...['overview', 'config', 'voicelines', 'clips', 'generations', 'gen-verdicts',
    'apikeys', 'users', 'players', 'transactions','emails','shoes', 'presentation-room', 'resource-lifecycle'].map(action => adminEndpoint('GET', action)),
  ...['voiceline-review', 'tournament', 'pitboss', 'tier', 'room', 'game-lane', 'game-lanes/create', 'game-lanes/remove', 'clip-landing',
    'clip-never', 'gen-landing', 'gen-verdict', 'players/create', 'players/status', 'players/password',
    'users/invite', 'users/resend', 'users/role', 'users/remove', 'apikeys/create',
    'apikeys/revoke', 'apikeys/rotate', 'apikeys/launch', 'apikeys/credit',
    'operator-package', 'presentation-room', 'operator-create-demo', 'operator-create', 'operator-role', 'operator-membership', 'operator-lifecycle', 'room-lifecycle', 'room-state', 'material-trash-check', 'material-trash']
    .map(action => adminEndpoint('POST', action)),
  // These methods still require the existing opt-in operator gate, owner/budget
  // checks and paid-work authority. A matching descriptor grants none of them.
  ...['GET', 'POST', 'DELETE'].map(method => adminEndpoint(method, 'speech-qa')),
]);

export const STUDIO_AUTH_ENDPOINTS = Object.freeze([
  ['GET', 'session', ['live-session-validation']],
  ['POST', 'login', ['existing-identity-password', 'shared-login-rate-limit']],
  ['POST', 'logout', ['session-revocation']],
  ['POST', 'reset-request', ['no-user-enumeration']],
  ['POST', 'set-password', ['single-use-password-token', 'session-revocation']],
].map(([method, action, requirements]) => Object.freeze({
  method, action, path: `${STUDIO_ROUTES.authApi}/${action}`,
  handlerRequirements: Object.freeze(requirements),
})));

const adminEndpoints = new Map(STUDIO_ADMIN_ENDPOINTS.map(endpoint => [`${endpoint.method} ${endpoint.path}`, endpoint]));
const authEndpoints = new Map(STUDIO_AUTH_ENDPOINTS.map(endpoint => [`${endpoint.method} ${endpoint.path}`, endpoint]));

// Lookups take exact, already separated pathnames; they do not normalize user
// URLs, decode escapes, accept query strings, or treat an unknown verb as GET.
export function studioAdminEndpoint(method, pathname) {
  return typeof method === 'string' && typeof pathname === 'string'
    ? adminEndpoints.get(`${method} ${pathname}`) ?? null : null;
}

export function studioAuthEndpoint(method, pathname) {
  return typeof method === 'string' && typeof pathname === 'string'
    ? authEndpoints.get(`${method} ${pathname}`) ?? null : null;
}


// A narrowly read-only preparation query. Other endpoints keep exact paths
// and no query parameters; this helper grants no role or Origin exception.
export function isPresentationRoomReadQuery(method, url) {
  if (method !== 'GET' || !['/studio/api/admin/presentation-room', '/api/admin/presentation-room'].includes(url.pathname)) return false;
  const keys = [...url.searchParams.keys()];
  return (keys.length === 2 || keys.length === 3 && keys.includes('game') && ['blackjack','roulette'].includes(url.searchParams.get('game')))
    && keys.includes('operatorId') && keys.includes('presentationLaneId')
    && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(url.searchParams.get('operatorId'))
    && /^[a-z][a-z0-9-]{0,63}$/.test(url.searchParams.get('presentationLaneId'))
    && !['original', 'constructor', 'prototype'].includes(url.searchParams.get('presentationLaneId'));
}
