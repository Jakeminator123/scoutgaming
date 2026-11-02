import test from 'node:test';
import assert from 'node:assert/strict';
import { createNeonProjectStore } from '../../lib/neon-project-store.mjs';
import { createSeedProject } from '../../../../packages/presentation/contracts/studio-model.mjs';
import { createStudioRepository } from '../../../../packages/studio-registry/server/document-repository.mjs';
import { createStudioMemoryPool } from '../../../../test/fixtures/studio-memory-pool.mjs';
import { validateDocumentValue } from '../../../../packages/studio-registry/server/document-contract.mjs';

const scope = Object.freeze({ environment: 'test', workspaceId: 'studio-test' });
function fixture() {
  const pool = createStudioMemoryPool(), repository = createStudioRepository({ pool, scope });
  const store = createNeonProjectStore({ repository, scope, actor: 'Operator' });
  return { pool, repository, store };
}

test('a persisted social-policy survives generic read, export and restore without the retired chat runtime', async () => {
  const { repository } = fixture();
  const policy = { schemaVersion: 1, revision: 'historical-policy-1',
    trigger: { id: 'social.ledsen', label: 'Historical trigger', enabled: false, directive: 'Synthetic retained document.', threshold: 0.75 },
    response: { mode: 'free', fixedText: 'Synthetic response.' }, cooldownMs: 10000 };
  const saved = await repository.initializeDocument('social-policy', { value: policy, actor: 'migration' });
  assert.deepEqual((await repository.readDocument('social-policy')).value, saved.value);
  const snapshot = await repository.exportSnapshot();
  assert.deepEqual(snapshot.documents.map(row => row.kind), ['social-policy']);
  const restored = fixture().repository;
  assert.deepEqual(await restored.importSnapshot(snapshot, { actor: 'restore', expectedTargetEmpty: true }), { imported: 1, replayed: false });
  assert.deepEqual(await restored.exportSnapshot(), snapshot);
  for (const invalid of [ { ...policy, unexpected: true }, { ...policy, cooldownMs: -1 },
    { ...policy, trigger: { ...policy.trigger, id: 'unknown' } },
    { ...policy, response: { mode: 'fixed', fixedText: '\u0001' } } ]) {
    assert.throws(() => validateDocumentValue('social-policy', invalid, policy.revision), { code: 'studio_invalid_document' });
  }
});
test('missing and unavailable Neon documents fail closed, never initialize a default project', async () => {
  const { pool, store } = fixture();
  await assert.rejects(store.load(), error => error.code === 'studio_document_missing' && error.statusCode === 503);
  assert.equal(pool.snapshot().documents.size, 0); assert.equal(pool.snapshot().audits.length, 0);
  pool.failNext('read-document', new Error('private connection string'));
  await assert.rejects(store.load(), error => error.message === 'studio_storage_unavailable');
  assert.equal(pool.snapshot().documents.size, 0);
});
test('two independent editor instances share saved policy with one CAS winner and durable audit/history', async () => {
  const { pool, repository, store } = fixture();
  await repository.initializeDocument('project', { value: createSeedProject(), actor: 'migration' });
  const base = await store.load(), first = structuredClone(base), second = structuredClone(base);
  first.events[0].label = 'First'; second.events[0].label = 'Second';
  const other = createNeonProjectStore({ repository: createStudioRepository({ pool, scope }), scope, actor: 'Other operator' });
  const results = await Promise.allSettled([store.save(first, base.revision), other.save(second, base.revision)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected' && result.reason.statusCode === 409).length, 1);
  const saved = results.find(result => result.status === 'fulfilled').value;
  assert.equal(first.revision, base.revision); assert.equal(second.revision, base.revision);
  assert.deepEqual(await other.load(), saved); assert.deepEqual(await store.load(), saved);
  assert.equal(pool.snapshot().history.length, 1); assert.equal(pool.snapshot().audits.length, 2);
});
test('audit failure rolls back all policy state; a later successful save can still use the original revision', async () => {
  const { pool, repository, store } = fixture();
  await repository.initializeDocument('project', { value: createSeedProject(), actor: 'migration' });
  const base = await store.load(), before = pool.snapshot();
  pool.failNext('audit', new Error('private path'));
  await assert.rejects(store.save(base, base.revision), error => error.statusCode === 503);
  assert.deepEqual(pool.snapshot(), before); assert.deepEqual(await store.load(), base);
  assert.notEqual((await store.save(base, base.revision)).revision, base.revision);
});
test('server-owned scope and read-only Render consumers cannot cross scopes or write without an actor', async () => {
  const { repository, pool } = fixture();
  const wrong = { ...scope, workspaceId: 'another' };
  assert.throws(() => createNeonProjectStore({ repository, scope: wrong, actor: 'Operator' }), error => error.code === 'studio_scope_mismatch');
  assert.equal(pool.connects, 0);
  await repository.initializeDocument('project', { value: createSeedProject(), actor: 'migration' });
  const gameReader = createNeonProjectStore({ repository, scope });
  const saved = await gameReader.load();
  await assert.rejects(gameReader.save(saved, saved.revision), error => error.statusCode === 403);
  assert.equal(pool.snapshot().audits.length, 1);
});
