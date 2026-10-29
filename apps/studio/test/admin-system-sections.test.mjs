import test from 'node:test';
import assert from 'node:assert/strict';
import { SYSTEM_GROUPS, SYSTEM_SECTIONS } from '../lib/admin-system-sections.mjs';
import { STUDIO_ADMIN_SECTIONS } from '../lib/studio-access-policy.mjs';

test('every system section has an administrator policy and sits in exactly one group', () => {
  assert.equal(new Set(SYSTEM_SECTIONS.map(section => section.id)).size, SYSTEM_SECTIONS.length);
  for (const section of SYSTEM_SECTIONS) assert.ok(STUDIO_ADMIN_SECTIONS.some(policy => policy.id === section.id), section.id);
  const ids = SYSTEM_GROUPS.flatMap(group => group.sections);
  assert.equal(ids.length, new Set(ids).size);
  assert.deepEqual([...ids].sort(), SYSTEM_SECTIONS.map(section => section.id).sort());
  for (const group of SYSTEM_GROUPS) {
    assert.ok(Object.isFrozen(group));
    assert.ok(Object.isFrozen(group.sections));
    assert.ok(['Drift', 'System'].includes(group.area), group.id);
  }
  assert.equal(SYSTEM_GROUPS.some(group => group.id === 'tables'), false, 'the retired room settings group is gone');
});
