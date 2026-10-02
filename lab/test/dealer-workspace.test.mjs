import test from 'node:test';
import assert from 'node:assert/strict';
import { DEALER_WORKSPACE_SECTIONS, workspaceLocation, selectedDealerClips, legacyPartInSection, supportsFamilyWorkspace } from '../lib/dealer-workspace.mjs';

test('five categories preserve existing hashes as local view aliases', () => {
  assert.equal(DEALER_WORKSPACE_SECTIONS.length, 5);
  for (const section of ['idle', 'deal', 'clips', 'probe']) assert.equal(workspaceLocation(`#${section}`).section, section);
  assert.deepEqual(workspaceLocation('#upload'), { section: 'idle', upload: true, observe: false });
  assert.deepEqual(workspaceLocation('#stream'), { section: 'idle', upload: false, observe: true });
  assert.equal(workspaceLocation('#unknown').section, 'idle');
});
test('classification scopes exact dealer and section, without guessing unmatched media', () => {
  const rows = ['astrid', 'vera', 'amira', 'mei'].flatMap(dealerId => [
    { id: `${dealerId}:idle`, dealerId, kind: 'engine', exactParts: ['idle'], lineId: null },
    { id: `${dealerId}:deal`, dealerId, kind: 'engine', exactParts: ['deal'], lineId: null },
    { id: `${dealerId}:speech`, dealerId, kind: 'recorded-speech', exactParts: [], lineId: 'goodluck' },
    { id: `${dealerId}:unknown`, dealerId, kind: 'performance', exactParts: [], lineId: null, duration: 3 },
  ]);
  const before = JSON.stringify(rows);
  for (const dealer of ['astrid', 'vera', 'amira', 'mei']) {
    for (const [section, suffix] of [['idle', 'idle'], ['deal', 'deal'], ['clips', 'speech']]) assert.deepEqual(selectedDealerClips(rows, dealer, section).map(row => row.id), [`${dealer}:${suffix}`]);
    assert.equal(supportsFamilyWorkspace(dealer), dealer === 'astrid');
  }
  assert.equal(legacyPartInSection('box2', 'deal'), true);
  assert.equal(legacyPartInSection('idle', 'clips'), false);
  assert.equal(JSON.stringify(rows), before);
});
