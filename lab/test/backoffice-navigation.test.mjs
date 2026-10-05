import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKOFFICE_GROUPS, BACKOFFICE_SECTIONS } from '../lib/backoffice-navigation.mjs';
import { studioAdminSectionPath } from '../lib/studio-admin-contract.mjs';

test('all Backoffice surfaces keep their native administration destination', () => {
  assert.deepEqual(BACKOFFICE_SECTIONS.map(section => section.id), ['ops','lanes','voice','apikeys','emails','users','rooms','dealers','players','pay','shoes']);
  for (const section of BACKOFFICE_SECTIONS) {
    assert.equal(studioAdminSectionPath(section.id), `/studio/administration/${section.id}`);
  }
});

test('six native Backoffice groups cover every active surface exactly once', () => {
  const ids = BACKOFFICE_GROUPS.flatMap(group => group.sections);
  assert.equal(BACKOFFICE_GROUPS.length, 6);
  assert.equal(ids.length, new Set(ids).size);
  assert.deepEqual([...ids].sort(), BACKOFFICE_SECTIONS.map(section => section.id).sort());
  for (const group of BACKOFFICE_GROUPS) {
    assert.ok(Object.isFrozen(group));
    assert.ok(Object.isFrozen(group.sections));
    for (const id of group.sections) assert.ok(BACKOFFICE_SECTIONS.some(section => section.id === id));
  }
});
