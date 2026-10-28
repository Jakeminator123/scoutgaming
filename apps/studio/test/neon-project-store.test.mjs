import test from 'node:test';
import assert from 'node:assert/strict';
import { createNeonProjectStore, createNeonSocialStore } from '../lib/neon-project-store.mjs';
import { createSeedProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import { createSocialPolicy } from './fixtures/social-store.mjs';
import { createStudioRepository } from '../../../packages/studio-registry/server/document-repository.mjs';
import { createStudioMemoryPool } from '../../../test/fixtures/studio-memory-pool.mjs';

const scope = Object.freeze({ environment: 'test', workspaceId: 'studio-test' });
function fixture() {
  const pool = createStudioMemoryPool(), repository = createStudioRepository({ pool, scope });
  const store = createNeonProjectStore({ repository, scope, actor: 'Operator' });
  return { pool, repository, store };
}
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
test('social policy keeps an independent revision stream and never substitutes companion memory/profile state', async () => {
  const { pool, repository, store } = fixture();
  await repository.initializeDocument('project', { value: createSeedProject(), actor: 'migration' });
  await repository.initializeDocument('social-policy', { value: createSocialPolicy(), actor: 'migration' });
  const project = await store.load(), social = createNeonSocialStore({ repository, scope, actor: 'Operator' });
  const policy = await social.load(), next = structuredClone(policy); next.cooldownMs = 2000;
  const saved = await social.save(next, policy.revision);
  assert.notEqual(saved.revision, policy.revision); assert.deepEqual(await store.load(), project);
  assert.equal((await repository.listDocumentHistory('social-policy')).length, 1);
  assert.equal((await repository.listDocumentHistory('project')).length, 0);
  assert.equal(pool.snapshot().documents.size, 2);
});
