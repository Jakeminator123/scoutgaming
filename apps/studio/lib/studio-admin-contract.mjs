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
  ...['overview', 'config', 'clips', 'generations', 'gen-verdicts',
    'apikeys', 'users', 'players', 'transactions','emails','shoes', 'room-game-config', 'room-release', 'shared-table-proof', 'presentation-room', 'resource-lifecycle', 'moving-drift'].map(action => adminEndpoint('GET', action)),
  ...['tier', 'room', 'game-lane', 'game-lanes/create', 'game-lanes/remove', 'clip-landing',
    'clip-never', 'gen-landing', 'gen-verdict', 'players/create', 'players/status', 'players/password',
    'users/invite', 'users/resend', 'users/role', 'users/remove', 'apikeys/create',
    'apikeys/revoke', 'apikeys/rotate', 'apikeys/launch', 'apikeys/credit',
    'operator-package', 'room-game-config', 'presentation-room', 'operator-create', 'operator-role', 'operator-membership', 'operator-lifecycle', 'room-lifecycle', 'room-state', 'material-trash-check', 'material-trash', 'moving-drift']
    .map(action => adminEndpoint('POST', action)),
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
  if (isRoomGameConfigReadQuery(method,url) || isRoomReleaseReadQuery(method,url) || isSharedTableProofReadQuery(method,url)) return true;
  if (method !== 'GET' || !['/studio/api/admin/presentation-room', '/api/admin/presentation-room'].includes(url.pathname)) return false;
  const keys = [...url.searchParams.keys()];
  return (keys.length === 2 || keys.length === 3 && keys.includes('game') && ['blackjack','roulette'].includes(url.searchParams.get('game')))
    && keys.includes('operatorId') && keys.includes('presentationLaneId')
    && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(url.searchParams.get('operatorId'))
    && /^[a-z][a-z0-9-]{0,63}$/.test(url.searchParams.get('presentationLaneId'))
    && !['original', 'constructor', 'prototype'].includes(url.searchParams.get('presentationLaneId'));
}

const queryId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value) && !['__proto__','constructor','prototype'].includes(value);
export function isRoomGameConfigReadQuery(method,url) {
  const keys=[...url.searchParams.keys()];
  return method==='GET'&&['/studio/api/admin/room-game-config','/api/admin/room-game-config'].includes(url.pathname)
    &&keys.length===2&&new Set(keys).size===2&&keys.includes('operatorId')&&keys.includes('roomId')&&keys.every(key=>queryId(url.searchParams.get(key)));
}
// Rummets publicering (room-release.mjs): exakt operatorId och roomId, inget annat.
export function isRoomReleaseReadQuery(method,url) {
  const keys=[...url.searchParams.keys()];
  return method==='GET'&&['/studio/api/admin/room-release','/api/admin/room-release'].includes(url.pathname)
    &&keys.length===2&&new Set(keys).size===2&&keys.includes('operatorId')&&keys.includes('roomId')&&keys.every(key=>queryId(url.searchParams.get(key)));
}
export function isSharedTableProofReadQuery(method,url) {
  const keys=[...url.searchParams.keys()];
  return method==='GET'&&['/studio/api/admin/shared-table-proof','/api/admin/shared-table-proof'].includes(url.pathname)
    &&keys.length>=1&&keys.length<=2&&new Set(keys).size===keys.length&&keys.includes('roomId')&&keys.every(key=>['roomId','shoeId'].includes(key)&&queryId(url.searchParams.get(key)));
}
