import test from 'node:test';
import assert from 'node:assert/strict';
import { planMediaRetirement, removeRetiredLocalFiles, deleteRetiredBlobs } from '../tools/lane-media-audit.mjs';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture() {
  const file = path => ({ path, legacyPath: 'old/' + path, size: 4, sha256: hash('film') });
  const files = [file('game/source/old.mp4'), file('game/runtime/shared.mp4')];
  const pointer = row => ({ logicalPath: row.path, size: row.size, sha256: row.sha256,
    storage: { pathname: 'croupier/media/' + row.path, size: row.size, sha256: row.sha256 } });
  const index = { schemaVersion: 1, files: files.map(pointer) };
  return { layout: { schemaVersion: 1, roots: {}, files }, index, candidates: [files[0].path], protectedPaths: [files[1].path],
    references: [{ complete: true, references: [] }], inventory: { complete: true, blobs: index.files.map(row => ({ pathname: row.storage.pathname, size: row.size })) } };
}
test('protects shared object keys and live references; rejects incomplete enumeration', () => {
  const f = fixture();
  assert.equal(planMediaRetirement(f).blobDeletes.length, 1);
  assert.throws(() => planMediaRetirement({ ...f, references: [{ complete: false, references: [] }] }));
  assert.throws(() => planMediaRetirement({ ...f, inventory: { ...f.inventory, complete: false } }));
  assert.throws(() => planMediaRetirement({ ...f, candidates: ['../outside'] }));
  for (const ref of [f.layout.files[0].sha256, 'media/' + f.candidates[0], f.index.files[0].storage.pathname]) {
    assert.equal(planMediaRetirement({ ...f, references: [{ complete: true, references: [ref] }] }).removed.length, 0);
  }
  f.index.files[1].storage = f.index.files[0].storage;
  assert.equal(planMediaRetirement(f).blobDeletes.length, 0);
});
test('changed local bytes prevent all deletion; valid exact files are removed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lane-retirement-')), f = fixture(), plan = planMediaRetirement(f);
  try {
    const file = join(root, 'media', f.candidates[0]); await mkdir(join(root, 'media/game/source'), { recursive: true });
    await writeFile(file, 'edit');
    await assert.rejects(removeRetiredLocalFiles(plan, { root, ...f }));
    assert.equal(await readFile(file, 'utf8'), 'edit');
    await writeFile(file, 'film');
    assert.equal((await removeRetiredLocalFiles(plan, { root, ...f })).files, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('Blob purge requires deployed index identity and unchanged fresh deletion set', async () => {
  const plan = planMediaRetirement(fixture()), calls = [], options = { expectedPlan: plan, token: 'fixture', del: async (...args) => calls.push(args) };
  await assert.rejects(deleteRetiredBlobs(plan, { ...options, deployedIndexSha256: 'old' }));
  assert.equal(calls.length, 0);
  await deleteRetiredBlobs(plan, { ...options, deployedIndexSha256: hash(JSON.stringify(plan.nextIndex)) });
  assert.deepEqual(calls[0][0], plan.blobDeletes.map(row => row.pathname));
});
