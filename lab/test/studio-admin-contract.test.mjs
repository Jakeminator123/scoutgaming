import test from 'node:test';
import assert from 'node:assert/strict';
import { STUDIO_ADMIN_SECTIONS, STUDIO_ADMIN_ACTIONS, studioAdminActionPolicy } from '../lib/studio-access-policy.mjs';
import {
  STUDIO_ROUTES, STUDIO_ADMIN_ENDPOINTS, STUDIO_AUTH_ENDPOINTS,
  studioAdminSectionPath, studioAdminEndpoint, studioAuthEndpoint,
} from '../lib/studio-admin-contract.mjs';

test('proposed native addresses contain one Studio and one actual game address', () => {
  assert.deepEqual(STUDIO_ROUTES, {
    home: '/studio', login: '/studio/login', administration: '/studio/administration',
    authApi: '/studio/api/auth', adminApi: '/studio/api/admin', blackjack: '/blackjack', game: '/game',
  });
  for (const section of STUDIO_ADMIN_SECTIONS) {
    assert.equal(studioAdminSectionPath(section.id), `/studio/administration/${section.id}`);
  }
  for (const value of [undefined, null, {}, [], 'unknown', '#players', '../users', 'players?token=x', 'constructor']) {
    assert.equal(studioAdminSectionPath(value), null);
  }
});

test('admin method/path pairs explicitly cover the action policy without a catch-all', () => {
  assert.equal(STUDIO_ADMIN_ENDPOINTS.length, 36);
  const keys = STUDIO_ADMIN_ENDPOINTS.map(endpoint => `${endpoint.method} ${endpoint.path}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual([...new Set(STUDIO_ADMIN_ENDPOINTS.map(endpoint => endpoint.action))].sort(),
    STUDIO_ADMIN_ACTIONS.map(action => action.id).sort());
  for (const endpoint of STUDIO_ADMIN_ENDPOINTS) {
    const policy = studioAdminActionPolicy(endpoint.action);
    assert.equal(endpoint.path, `/studio/api/admin/${endpoint.action}`);
    assert.equal(endpoint.minimumRole, policy.minimumRole);
    assert.equal(endpoint.handlerRequirements, policy.handlerRequirements);
    assert.equal(studioAdminEndpoint(endpoint.method, endpoint.path), endpoint);
  }
  assert.equal(studioAdminEndpoint('GET', '/studio/api/admin/users').minimumRole, 'admin');
  assert.equal(studioAdminEndpoint('POST', '/studio/api/admin/players/create').minimumRole, 'admin');
});

test('auth contracts have exactly the planned verbs and retain non-role handler gates', () => {
  assert.deepEqual(STUDIO_AUTH_ENDPOINTS.map(endpoint => [endpoint.method, endpoint.action]), [
    ['GET', 'session'], ['POST', 'login'], ['POST', 'logout'],
    ['POST', 'reset-request'], ['POST', 'set-password'],
  ]);
  for (const endpoint of STUDIO_AUTH_ENDPOINTS) {
    assert.equal(endpoint.path, `/studio/api/auth/${endpoint.action}`);
    assert.equal(studioAuthEndpoint(endpoint.method, endpoint.path), endpoint);
    assert.equal(studioAdminEndpoint(endpoint.method, endpoint.path), null);
    assert.equal('minimumRole' in endpoint, false, 'a login descriptor is not a role grant');
  }
  assert.deepEqual(studioAuthEndpoint('POST', '/studio/api/auth/login').handlerRequirements,
    ['existing-identity-password', 'shared-login-rate-limit']);
  assert.deepEqual(studioAuthEndpoint('POST', '/studio/api/auth/set-password').handlerRequirements,
    ['single-use-password-token', 'session-revocation']);
});

test('unknown verbs, coercions, old routes and noncanonical paths fail closed', () => {
  for (const method of [undefined, null, {}, [], Symbol('GET'), new String('GET'), 'get', ' GET', 'GET ', 'HEAD', 'PUT', 'PATCH', 'OPTIONS']) {
    assert.equal(studioAdminEndpoint(method, '/studio/api/admin/players'), null);
    assert.equal(studioAuthEndpoint(method, '/studio/api/auth/session'), null);
  }
  for (const path of [undefined, null, {}, [], Symbol('players'), new String('/studio/api/admin/players'), '/api/bo/players',
    '/studio/api/admin/players/', '/studio/api/admin/players?x=1', '/studio/api/admin/players#users',
    '/studio/api/admin/%70layers', '/studio/api/admin/../admin/players', '//studio/api/admin/players',
    'https://scout.example/studio/api/admin/players', '/studio/api/admin/clip-assign',
    '/studio/api/admin/constructor', '/studio/api/admin/__proto__', '/studio/api/admin/players/remove', '/api/table', '/lipsync-worker']) {
    assert.equal(studioAdminEndpoint('GET', path), null);
    assert.equal(studioAdminEndpoint('POST', path), null);
  }
  assert.equal(studioAdminEndpoint('POST', '/studio/api/admin/players'), null);
  assert.equal(studioAdminEndpoint('GET', '/studio/api/admin/players/create'), null);
  assert.equal(studioAuthEndpoint('GET', '/studio/api/auth/login'), null);
  assert.equal(studioAuthEndpoint('POST', '/studio/api/auth/session'), null);
  assert.equal(studioAuthEndpoint('POST', '/api/bo/login'), null);
  for (const path of [null, {}, [], Symbol('login'), '/studio/api/auth/login/',
    '/studio/api/auth/login?returnTo=/studio', 'https://scout.example/studio/api/auth/login',
    '/studio/api/auth/constructor', '/studio/api/auth/__proto__']) {
    assert.equal(studioAuthEndpoint('POST', path), null);
  }
});

test('speech-QA method descriptors retain the operator gate without launching a job', () => {
  for (const method of ['GET', 'POST', 'DELETE']) {
    const endpoint = studioAdminEndpoint(method, '/studio/api/admin/speech-qa');
    assert.equal(endpoint.minimumRole, 'admin');
    assert.deepEqual(endpoint.handlerRequirements, ['operator-speech-qa-gate']);
  }
  assert.equal(studioAdminEndpoint('DELETE', '/studio/api/admin/users/remove'), null);
  assert.deepEqual(studioAdminEndpoint('POST', '/studio/api/admin/users/remove').handlerRequirements,
    ['forbid-self-removal', 'revoke-changed-identity']);
});

test('route and endpoint descriptors are immutable and cannot become public aliases', () => {
  assert.equal(Object.isFrozen(STUDIO_ROUTES), true);
  assert.throws(() => { STUDIO_ROUTES.login = '/bo/login.html'; }, TypeError);
  for (const list of [STUDIO_ADMIN_ENDPOINTS, STUDIO_AUTH_ENDPOINTS]) {
    assert.equal(Object.isFrozen(list), true);
    assert.throws(() => list.push({}), TypeError);
    for (const endpoint of list) {
      assert.equal(Object.isFrozen(endpoint), true);
      assert.throws(() => { endpoint.path = '/api/bo/users'; }, TypeError);
      assert.equal(Object.isFrozen(endpoint.handlerRequirements), true);
      assert.throws(() => endpoint.handlerRequirements.push('bypass'), TypeError);
    }
  }
});
