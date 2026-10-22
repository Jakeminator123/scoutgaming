import test from 'node:test';
import assert from 'node:assert/strict';
import { DEALER_WORKSPACE_SECTIONS, workspaceLocation, selectedDealerClips, legacyPartInSection, supportsFamilyWorkspace } from '../lib/dealer-workspace.mjs';

test('three categories keep their hashes; moved tabs send old bookmarks to their pages', () => {
  assert.deepEqual(DEALER_WORKSPACE_SECTIONS.map(row => row.id), ['idle', 'deal', 'clips']);
  for (const section of ['idle', 'deal', 'clips']) assert.deepEqual(workspaceLocation(`#${section}`), { section, upload: false, redirect: null });
  assert.deepEqual(workspaceLocation('#upload'), { section: 'idle', upload: true, redirect: null });
  for (const [hash, page] of [['probe', '/admin/openclaw?tab=probe'], ['background', '/admin/compositions'], ['stream', '/admin/rehearsal']]) assert.deepEqual(workspaceLocation(`#${hash}`), { section: 'idle', upload: false, redirect: page });
  assert.deepEqual(workspaceLocation('#unknown'), { section: 'idle', upload: false, redirect: null });
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
