import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKOFFICE_SECTIONS } from '../lib/backoffice-navigation.mjs';
import {
  STUDIO_ROLES, STUDIO_ADMIN_SECTIONS, STUDIO_ADMIN_ACTIONS, normalizeStudioRole, isStudioRole,
  studioRoleMeetsMinimum, studioAdminSectionPolicy, studioAdminActionPolicy,
  meetsStudioAdminSectionRole, meetsStudioAdminActionRole,
} from '../lib/studio-access-policy.mjs';

test('administrator is the only Studio role and owns every existing section/action', () => {
  assert.deepEqual(STUDIO_ROLES, ['admin']);
  // Hidden historical sections keep their existing API permissions until retirement.
  assert.ok(BACKOFFICE_SECTIONS.every(section => STUDIO_ADMIN_SECTIONS.some(policy => policy.id === section.id)));
  assert.equal(STUDIO_ADMIN_SECTIONS.length, 15);
  assert.equal(STUDIO_ADMIN_ACTIONS.length, 43);
  assert.equal(new Set(STUDIO_ADMIN_ACTIONS.map(action => action.id)).size, 43);
  for (const role of ['admin','superadmin']) {
    assert.equal(normalizeStudioRole(role), 'admin');
    assert.equal(isStudioRole(role), true);
    for (const section of STUDIO_ADMIN_SECTIONS) {
      assert.equal(section.minimumRole, 'admin');
      assert.equal(meetsStudioAdminSectionRole(role, section.id), true);
      assert.equal(studioAdminSectionPolicy(section.id), section);
    }
    for (const action of STUDIO_ADMIN_ACTIONS) {
      assert.equal(action.minimumRole, 'admin');
      assert.equal(meetsStudioAdminActionRole(role, action.id), true);
    }
  }
});

test('game-only, unknown, inherited and coerced roles never acquire Studio access', () => {
  const invalid = [undefined, null, '', 'reader','staff','ADMIN', ' admin', 'player', 'partner', 'constructor',
    '__proto__', 'toString', 3, {}, [], new String('admin'), Symbol('admin')];
  for (const value of invalid) {
    assert.equal(normalizeStudioRole(value), null);
    assert.equal(isStudioRole(value), false);
    assert.equal(studioRoleMeetsMinimum(value, 'admin'), false);
    assert.equal(studioRoleMeetsMinimum('admin', value), false);
    for (const section of STUDIO_ADMIN_SECTIONS) assert.equal(meetsStudioAdminSectionRole(value, section.id), false);
    for (const action of STUDIO_ADMIN_ACTIONS) assert.equal(meetsStudioAdminActionRole(value, action.id), false);
  }
  for (const value of [...invalid, 'players?token=secret', '#players', '../users', '/users', 'users/unknown', 'clip-assign']) {
    assert.equal(studioAdminSectionPolicy(value), null);
    assert.equal(studioAdminActionPolicy(value), null);
    assert.equal(meetsStudioAdminSectionRole('admin', value), false);
    assert.equal(meetsStudioAdminActionRole('admin', value), false);
  }
});

test('administrator role preserves explicit lifecycle, owner and cancellation requirements', () => {
  assert.deepEqual(studioAdminActionPolicy('users/role').handlerRequirements,
    ['forbid-self-role-change', 'revoke-changed-identity']);
  assert.deepEqual(studioAdminActionPolicy('users/remove').handlerRequirements,
    ['forbid-self-removal', 'revoke-changed-identity']);
  assert.deepEqual(studioAdminActionPolicy('speech-qa').handlerRequirements, ['operator-speech-qa-gate']);
  assert.deepEqual(studioAdminActionPolicy('players/password').handlerRequirements,
    ['game-authority','player-lifecycle-and-ledger','cancel-player-runtime']);
  assert.deepEqual(studioAdminActionPolicy('players/status').handlerRequirements,
    ['player-lifecycle-and-ledger', 'cancel-player-runtime']);
});

test('exported policies and nested requirements remain immutable', () => {
  for (const list of [STUDIO_ROLES, STUDIO_ADMIN_SECTIONS, STUDIO_ADMIN_ACTIONS]) {
    assert.equal(Object.isFrozen(list), true);
    assert.throws(() => list.push('player'), TypeError);
  }
  for (const record of [...STUDIO_ADMIN_SECTIONS, ...STUDIO_ADMIN_ACTIONS]) {
    assert.equal(Object.isFrozen(record), true);
    assert.throws(() => { record.minimumRole = 'reader'; }, TypeError);
  }
  for (const action of STUDIO_ADMIN_ACTIONS) {
    assert.equal(Object.isFrozen(action.handlerRequirements), true);
    assert.throws(() => action.handlerRequirements.push('bypass'), TypeError);
  }
});
