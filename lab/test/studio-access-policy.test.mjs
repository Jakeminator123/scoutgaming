import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKOFFICE_SECTIONS } from '../lib/backoffice-navigation.mjs';
import {
  STUDIO_ROLES, STUDIO_ADMIN_SECTIONS, STUDIO_ADMIN_ACTIONS, isStudioRole,
  studioRoleMeetsMinimum, studioAdminSectionPolicy, studioAdminActionPolicy,
  meetsStudioAdminSectionRole, meetsStudioAdminActionRole,
} from '../lib/studio-access-policy.mjs';

test('native Studio preserves the fourteen section IDs and section-specific read floors', () => {
  assert.deepEqual(STUDIO_ROLES, ['reader', 'staff', 'admin', 'superadmin']);
  assert.deepEqual(STUDIO_ADMIN_SECTIONS.map(section => section.id), BACKOFFICE_SECTIONS.map(section => section.id));
  assert.equal(STUDIO_ADMIN_SECTIONS.length, 14);
  for (const role of STUDIO_ROLES) {
    for (const section of STUDIO_ADMIN_SECTIONS) {
      assert.equal(meetsStudioAdminSectionRole(role, section.id), section.id !== 'users' || role === 'superadmin');
      assert.equal(studioAdminSectionPolicy(section.id), section);
    }
  }
});

test('known action role floors preserve staff/admin/superadmin boundaries', () => {
  const floors = {
    reader: ['overview', 'config', 'voicelines', 'clips', 'generations', 'gen-verdicts', 'apikeys', 'players', 'transactions'],
    staff: ['voiceline-review', 'tournament'],
    admin: ['pitboss', 'tier', 'room', 'clip-landing', 'clip-never', 'gen-landing', 'gen-verdict',
      'players/create', 'players/status', 'apikeys/launch', 'apikeys/credit', 'speech-qa'],
    superadmin: ['users', 'users/invite', 'users/resend', 'users/role', 'users/remove',
      'apikeys/create', 'apikeys/revoke', 'apikeys/rotate'],
  };
  assert.equal(STUDIO_ADMIN_ACTIONS.length, 31);
  assert.equal(new Set(STUDIO_ADMIN_ACTIONS.map(action => action.id)).size, 31);
  for (const [minimum, actions] of Object.entries(floors)) {
    for (const action of actions) {
      assert.equal(studioAdminActionPolicy(action).minimumRole, minimum);
      for (const role of STUDIO_ROLES) {
        assert.equal(meetsStudioAdminActionRole(role, action), STUDIO_ROLES.indexOf(role) >= STUDIO_ROLES.indexOf(minimum));
      }
    }
  }
  assert.deepEqual(Object.values(floors).flat().sort(), STUDIO_ADMIN_ACTIONS.map(action => action.id).sort());
});

test('unknown, inherited, coerced and player roles or identifiers always fail closed', () => {
  const invalid = [undefined, null, '', 'ADMIN', ' admin', 'player', 'partner', 'constructor',
    '__proto__', 'toString', 3, {}, [], new String('admin'), Symbol('admin')];
  for (const value of invalid) {
    assert.equal(isStudioRole(value), false);
    assert.equal(studioRoleMeetsMinimum(value, 'reader'), false);
    assert.equal(studioRoleMeetsMinimum('superadmin', value), false);
    assert.equal(meetsStudioAdminSectionRole(value, 'players'), false);
    assert.equal(meetsStudioAdminActionRole(value, 'players/create'), false);
  }
  for (const value of [...invalid, 'players?token=secret', '#players', '../users', '/users', 'users/unknown', 'clip-assign']) {
    assert.equal(studioAdminSectionPolicy(value), null);
    assert.equal(studioAdminActionPolicy(value), null);
    assert.equal(meetsStudioAdminSectionRole('superadmin', value), false);
    assert.equal(meetsStudioAdminActionRole('superadmin', value), false);
  }
});

test('special handler requirements remain explicit instead of pretending a role is authorization', () => {
  assert.deepEqual(studioAdminActionPolicy('users/role').handlerRequirements,
    ['forbid-self-role-change', 'revoke-changed-identity']);
  assert.deepEqual(studioAdminActionPolicy('users/remove').handlerRequirements,
    ['forbid-self-removal', 'revoke-changed-identity']);
  assert.deepEqual(studioAdminActionPolicy('speech-qa').handlerRequirements, ['operator-speech-qa-gate']);
  assert.deepEqual(studioAdminActionPolicy('players/status').handlerRequirements,
    ['player-lifecycle-and-ledger', 'cancel-player-runtime']);
  assert.deepEqual(studioAdminActionPolicy('apikeys/credit').handlerRequirements, ['game-authority']);
  assert.equal(meetsStudioAdminActionRole('staff', 'speech-qa'), false);
});

test('exported roles, sections, actions and nested requirements cannot be changed', () => {
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
