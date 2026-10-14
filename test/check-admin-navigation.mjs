import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { adminNavigationPlan, main } from '../tools/check-admin-navigation.mjs';
import { runChecks } from '../tools/precommit-checks.mjs';

test('focus plan reuses tests covered by the mandatory suite with at most four workers', () => {
  const plan = adminNavigationPlan(), hook = readFileSync(new URL('../.githooks/pre-commit-full', import.meta.url), 'utf8');
  assert.equal(plan.completeDeliveryCheck, false);
  assert.match(plan.notice, /does not replace.*full.*CI/);
  assert.equal(plan.commands.length, 1);
  const [executable, mode, concurrency, ...files] = plan.commands[0];
  assert.equal(executable, process.execPath);
  assert.equal(mode, '--test');
  assert.equal(concurrency, '--test-concurrency=4');
  assert.ok(files.length > 0);
  assert.equal(files.length, new Set(files).size);
  const covered = new Set(hook.split(/\s+/));
  for (const file of files) {
    assert.ok(existsSync(new URL('../' + file, import.meta.url)), file);
    assert.ok(covered.has(file), 'Missing mandatory coverage: ' + file);
  }
});

test('plan display and invalid arguments never execute checks', () => {
  const output = [], options = { output: value => output.push(value), run: () => assert.fail('Plan must not run checks') };
  assert.equal(main(['--plan'], options), 0);
  assert.equal(JSON.parse(output[0]).scope, 'admin-partner-navigation');
  assert.equal(JSON.parse(output[0]).completeDeliveryCheck, false);
  assert.throws(() => main(['--unknown'], options), /Usage:/);
});

test('focus command propagates a failed test process exit code', () => {
  let attempts = 0;
  const code = main([], { output() {}, run: commands => runChecks(commands, { run() { attempts++; return { status: 7 }; } }) });
  assert.equal(code, 7);
  assert.equal(attempts, 1);
});
