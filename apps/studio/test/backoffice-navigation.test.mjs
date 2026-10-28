import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKOFFICE_GROUPS, BACKOFFICE_SECTIONS, backofficeGroupId } from '../lib/backoffice-navigation.mjs';
import { studioAdminSectionPath } from '../lib/studio-admin-contract.mjs';

test('all Backoffice surfaces keep their native administration destination', () => {
  assert.ok(BACKOFFICE_SECTIONS.length > 0);
  assert.equal(new Set(BACKOFFICE_SECTIONS.map(section => section.id)).size, BACKOFFICE_SECTIONS.length);
  for (const section of BACKOFFICE_SECTIONS) {
    assert.equal(studioAdminSectionPath(section.id), `/studio/administration/${section.id}`);
  }
});

test('native Backoffice groups cover every active surface exactly once', () => {
  const ids = BACKOFFICE_GROUPS.flatMap(group => group.sections);
  assert.ok(BACKOFFICE_GROUPS.length > 0);
  assert.equal(ids.length, new Set(ids).size);
  assert.deepEqual([...ids].sort(), BACKOFFICE_SECTIONS.map(section => section.id).sort());
  assert.equal(backofficeGroupId('accounts'), 'accounts');
  assert.equal(backofficeGroupId('media-review'), 'operations', 'the retired speech review opens the default group');
  assert.equal(backofficeGroupId('missing'), 'operations');
  assert.equal(backofficeGroupId(undefined), 'operations');
  for (const group of BACKOFFICE_GROUPS) {
    assert.ok(Object.isFrozen(group));
    assert.ok(Object.isFrozen(group.sections));
    for (const id of group.sections) assert.ok(BACKOFFICE_SECTIONS.some(section => section.id === id));
  }
});
