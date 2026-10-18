import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { auditOrphanTests } from '../tools/check-orphan-tests.mjs';

function fixture(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'croupier-orphan-audit-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(files)) {
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return () => auditOrphanTests({ root });
}

test('discovers uncovered domains without mistaking a direct glob or printed command for recursive coverage', t => {
  const audit = fixture(t, {
    '.githooks/pre-commit-full': 'run_node_tests studio components apps/studio/components/*.test.mjs\n',
    '.github/workflows/check.yml': 'steps:\n  - run: echo node --test tools/media/test-filter.mjs\n  - run: node --check services/openclaw/lab/deploy/config.test.mjs\n',
    'tools/precommit-checks.mjs': "const unrelated = 'ops/cloud/test/entry.test.mjs';\n",
    'apps/studio/components/view.test.mjs': '',
    'apps/studio/components/nested/access.test.mjs': '',
    'apps/studio/lib/scheduler.test.mjs': '',
    'apps/studio/client/admin/view.test.mjs': '',
    'tools/media/test-filter.mjs': '',
    'apps/frontend/test/login.mjs': '',
    'services/worker/gateway/test/relay.test.mjs': '',
    'services/openclaw/lab/deploy/config.test.mjs': '',
    'ops/cloud/test/entry.test.mjs': '',
    'packages/ui/view.test.mjs': '',
    'apps/frontend/.next/server/test/generated.mjs': '',
    'apps/frontend/node_modules/dependency/test/foreign.mjs': '',
    'apps/frontend/data/test/private.mjs': '',
    'services/worker/vendor/test/dependency.mjs': '',
    'test/fixtures/helper.mjs': '',
  });
  const result = audit();
  assert.equal(result.files.length, 10);
  assert.deepEqual(result.covered.map(item => item.file), ['apps/studio/components/view.test.mjs']);
  assert.equal(result.covered[0].kind, 'full-regression');
  assert.deepEqual(result.orphans, [
    'apps/frontend/test/login.mjs', 'apps/studio/client/admin/view.test.mjs', 'apps/studio/components/nested/access.test.mjs', 'apps/studio/lib/scheduler.test.mjs',
    'ops/cloud/test/entry.test.mjs', 'packages/ui/view.test.mjs', 'services/openclaw/lab/deploy/config.test.mjs',
    'services/worker/gateway/test/relay.test.mjs', 'tools/media/test-filter.mjs',
  ]);
});

test('follows the invoked package test in its own directory and keeps manual helpers explicit', t => {
  const audit = fixture(t, {
    '.github/workflows/check.yml': 'steps:\n  - run: npm --prefix services/worker/gateway test\n',
    'services/worker/gateway/package.json': JSON.stringify({ scripts: { test: 'node --test test/*.test.mjs' } }),
    'services/worker/gateway/test/relay.test.mjs': '',
    'services/worker/gateway/test/nested/access.test.mjs': '',
    'services/worker/gateway/test/browser-fixture.mjs': '',
    'test/manual.mjs': '',
    'tools/orphan-tests-exceptions.json': JSON.stringify([
      { path: 'services/worker/gateway/test/browser-fixture.mjs', kind: 'helper', reason: 'Manual fixture server.' },
      { path: 'test/manual.mjs', kind: 'opt-in', reason: 'Requires explicitly supplied authoring media.' },
    ]),
  });
  const result = audit();
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.orphans, ['services/worker/gateway/test/nested/access.test.mjs']);
  assert.equal(result.covered[0].file, 'services/worker/gateway/test/relay.test.mjs');
  assert.equal(result.covered[0].kind, 'ci');
  assert.deepEqual(result.exceptions.map(item => item.kind), ['helper', 'opt-in']);
});

test('unknown recursive globs and invalid or stale classifications cannot produce a clean audit', t => {
  const audit = fixture(t, {
    '.githooks/pre-commit-full': 'run_node_tests studio components lab/components/**/*.test.mjs\n',
    'apps/studio/components/view.test.mjs': '',
    'apps/studio/components/nested/access.test.mjs': '',
    'tools/orphan-tests-exceptions.json': JSON.stringify([
      { path: 'apps/studio/components/*.test.mjs', kind: 'opt-in', reason: 'Broad exclusions must fail.' },
      { path: 'test/deleted.mjs', kind: 'opt-in', reason: 'Stale entry must fail.' },
      { path: 'apps/studio/components/view.test.mjs', kind: 'covered', reason: 'Cannot assert runner coverage in an exception.' },
    ]),
  });
  const result = audit();
  assert.equal(result.covered.length, 0);
  assert.deepEqual(result.orphans, ['apps/studio/components/nested/access.test.mjs', 'apps/studio/components/view.test.mjs']);
  assert.ok(result.errors.some(error => error.includes('unsupported recursive glob')));
  assert.ok(result.errors.some(error => error.includes('invalid path')));
  assert.ok(result.errors.some(error => error.includes('is not a discovered test file')));
  assert.ok(result.errors.some(error => error.includes('needs kind helper or opt-in')));
});

test('reports Python separately without treating zero JavaScript orphans as Python coverage', t => {
  const audit = fixture(t, {
    'services/worker/tests/test_stream.py': '',
    'services/worker/tests/helper.py': '',
    'services/worker/.venv/tests/test_foreign.py': '',
    '.github/workflows/check.yml': 'steps:\n  - run: python -m unittest discover -s services/worker/tests -v\n',
  });
  const result = audit();
  assert.deepEqual(result.orphans, []);
  assert.deepEqual(result.python.files, ['services/worker/tests/test_stream.py']);
  assert.equal(result.python.coverage, 'not-evaluated');
});
