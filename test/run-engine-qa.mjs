import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertCompleteRun, engineSuiteFiles, runEngineQa, tapSummary } from '../tools/run-engine-qa.mjs';
import { SQLITE_PATTERN } from '../tools/check-no-sqlite.mjs';
import { ENGINE_QA_SKIP } from './fixtures/engine-qa.mjs';

test('the engine suite is the hook registry and every file runs only through the harness fixture', async () => {
  const files = await engineSuiteFiles();
  assert.ok(files.length >= 9);
  assert.equal(new Set(files).size, files.length);
  for (const file of files) {
    const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    assert.match(source, /from '\.\/fixtures\/engine-qa\.mjs'/, file);
    assert.match(source, /skip: ?ENGINE_QA_SKIP/, file);
    assert.doesNotMatch(source, /CROUPIER_DATA_DIR|craig\.db|croupier\.db/, file);
    assert.doesNotMatch(source, new RegExp(SQLITE_PATTERN), file);
  }
});

test('a harness run counts only complete, unskipped TAP results', () => {
  const tap = '# tests 4\n# suites 0\n# pass 4\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 5\n';
  assert.deepEqual(assertCompleteRun(tapSummary(tap)), { tests: 4, pass: 4, fail: 0, cancelled: 0, skipped: 0, todo: 0 });
  for (const broken of [tap.replace('# skipped 0', '# skipped 1').replace('# pass 4', '# pass 3'),
    tap.replace('# fail 0', '# fail 1').replace('# pass 4', '# pass 3'), tap.replace('# tests 4', '# tests 0').replace('# pass 4', '# pass 0'),
    tap.replace('# cancelled 0\n', ''), ''])
    assert.throws(() => assertCompleteRun(tapSummary(broken)), /engine_qa_incomplete/);
});

test('the harness refuses implicit binaries and mixed sources before creating anything', async () => {
  await assert.rejects(runEngineQa({}), /explicit_postgres_bin_required|engine_qa_requires_nonroot_linux_or_windows/);
  await assert.rejects(runEngineQa({ postgresBin: 'relative/bin' }), /explicit_postgres_bin_required|engine_qa_requires_nonroot_linux_or_windows/);
  await assert.rejects(runEngineQa({ postgresBin: '/usr/lib/postgresql/16/bin', downloadPostgres: true }), /choose_download|engine_qa_requires_nonroot_linux_or_windows/);
});

test('without the harness descriptor engine tests skip with a reason instead of failing', { skip: !ENGINE_QA_SKIP && 'running inside the harness' }, () => {
  assert.match(ENGINE_QA_SKIP, /needs PostgreSQL: CI runs it through `node tools\/run-engine-qa\.mjs`/);
});
