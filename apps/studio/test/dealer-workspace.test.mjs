import test from 'node:test';
import assert from 'node:assert/strict';
import { DEALER_WORKSPACE_SECTIONS, workspaceLocation } from '../lib/dealer-workspace.mjs';

test('three categories keep their hashes; moved tabs send old bookmarks to their pages', () => {
  assert.deepEqual(DEALER_WORKSPACE_SECTIONS.map(row => row.id), ['idle', 'deal', 'clips']);
  for (const section of ['idle', 'deal', 'clips']) assert.deepEqual(workspaceLocation(`#${section}`), { section, upload: false, redirect: null });
  assert.deepEqual(workspaceLocation('#upload'), { section: 'idle', upload: true, redirect: null });
  for (const [hash, page] of [['probe', '/admin/probe'], ['background', '/admin/compositions'], ['stream', '/admin/rehearsal']]) assert.deepEqual(workspaceLocation(`#${hash}`), { section: 'idle', upload: false, redirect: page });
  assert.deepEqual(workspaceLocation('#unknown'), { section: 'idle', upload: false, redirect: null });
});
