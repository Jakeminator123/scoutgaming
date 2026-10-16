import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runGroup } from '../tools/regression-group.mjs';
import { isolatedGitEnvironment } from '../tools/precommit-checks.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const hook = readFileSync(join(root, '.githooks/pre-commit-full'), 'utf8');
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash';

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'regression-group-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = { ...isolatedGitEnvironment(), RUNNER_TEMP: dir, GITHUB_STEP_SUMMARY: join(dir, 'summary.md') };
  delete env.NODE_TEST_CONTEXT;
  return { dir, env, receipts: () => readFileSync(join(dir, 'dealer-regression-timing.jsonl'), 'utf8').trim().split('\n').map(JSON.parse) };
}

test('real child success and failure retain exact exit codes and durable timings', async t => {
  const f = fixture(t);
  for (const code of [0, 7]) {
    const logs = [];
    const result = await runGroup({ name: `fixture/exit-${code}`, seconds: 5, command: 'node',
      args: ['-e', `process.exit(${code})`], env: f.env, log: line => logs.push(line) });
    assert.equal(result.exitCode, code);
    assert.equal(result.status, code === 0 ? 'passed' : 'failed');
    assert.ok(result.durationMs >= 0);
    assert.match(logs[1], /START fixture\/exit-/);
    assert.equal(logs.at(-1), '::endgroup::');
  }
  assert.deepEqual(f.receipts().map(r => r.event), ['start', 'end', 'start', 'end']);
  assert.match(readFileSync(f.env.GITHUB_STEP_SUMMARY, 'utf8'), /failed/);
});

test('an unstartable command fails visibly', async t => {
  const f = fixture(t);
  const result = await runGroup({ name: 'fixture/missing', seconds: 5,
    command: join(f.dir, 'does-not-exist'), env: f.env, log: () => {} });
  assert.equal(result.status, 'start-failed');
  assert.equal(result.exitCode, 1);
});

test('unwritable reports cannot prevent product commands or change their exit codes', async t => {
  for (const code of [0, 7]) {
    const f = fixture(t), marker = join(f.dir, 'product-ran'), warnings = [];
    const result = await runGroup({ name: `fixture/report-error-${code}`, seconds: 5, command: 'node',
      args: ['-e', `require('node:fs').writeFileSync(process.argv[1],'ran');process.exit(${code})`, marker],
      env: { ...f.env, RUNNER_TEMP: join(f.dir, 'missing-directory'), GITHUB_STEP_SUMMARY: f.dir },
      log: () => {}, warn: line => warnings.push(line) });
    assert.equal(readFileSync(marker, 'utf8'), 'ran');
    assert.equal(result.exitCode, code);
    assert.equal(result.status, code === 0 ? 'passed' : 'failed');
    assert.equal(warnings.filter(line => line.includes('timing-report')).length, 1);
    assert.equal(warnings.filter(line => line.includes('step-summary')).length, 1);
  }
});

test('end-report failure and throwing log/warning sinks preserve the product result', async t => {
  for (const code of [0, 7]) {
    const f = fixture(t), report = join(f.dir, 'dealer-regression-timing.jsonl');
    // Start receipt succeeds; the product replaces that file with a directory
    // so only the end receipt fails. All paths belong to this temporary fixture.
    const result = await runGroup({ name: `fixture/end-report-error-${code}`, seconds: 5, command: 'node',
      args: ['-e', `const fs=require('node:fs');fs.unlinkSync(process.argv[1]);fs.mkdirSync(process.argv[1]);process.exit(${code})`, report],
      env: f.env, log: () => { throw Error('unavailable log'); }, warn: () => { throw Error('unavailable warning'); } });
    assert.equal(result.exitCode, code);
    assert.equal(result.status, code === 0 ? 'passed' : 'failed');
    assert.ok(readFileSync(f.env.GITHUB_STEP_SUMMARY, 'utf8').includes(`**${result.status}**`));
  }
});

test('a hung process tree times out, reports its group and stops its descendant', async t => {
  const f = fixture(t), marker = join(f.dir, 'descendant-survived');
  const logs = [];
  // The child outlives the group leader unless the timeout kills the whole tree.
  const childScript = `setTimeout(()=>require('node:fs').writeFileSync(${JSON.stringify(marker)},'unexpected'),1800)`;
  const script = `require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(childScript)}],{stdio:'inherit'});setInterval(()=>{},1000)`;
  const result = await runGroup({ name: 'fixture/hung', seconds: 0.8, command: 'node',
    args: ['-e', script], env: f.env, heartbeatMs: 100, graceMs: 50,
    log: line => { logs.push(line); if (/RUNNING|TIMED-OUT/.test(line)) throw Error('unavailable log'); }, warn: () => {} });
  assert.equal(result.status, 'timed-out');
  assert.equal(result.exitCode, 124);
  assert.ok(logs.some(line => /RUNNING fixture\/hung/.test(line)));
  assert.ok(logs.some(line => /TIMED-OUT fixture\/hung/.test(line)));
  await new Promise(resolveWait => setTimeout(resolveWait, 1500));
  assert.equal(existsSync(marker), false);
  assert.equal(f.receipts().at(-1).status, 'timed-out');
});

for (const code of [0, 7]) {
  for (const ignoreTerm of [false, true]) {
    test(`early exit ${code} cleans its POSIX descendants (ignore SIGTERM: ${ignoreTerm})`,
      { skip: process.platform === 'win32' }, async t => {
        const f = fixture(t), ready = join(f.dir, 'ready'), marker = join(f.dir, 'survived');
        const descendant = `
          const fs = require('node:fs');
          if (${ignoreTerm}) process.on('SIGTERM', () => {});
          fs.writeFileSync(process.argv[1], 'ready');
          setTimeout(() => { fs.writeFileSync(process.argv[2], 'unexpected'); process.exit(0); }, 700);
        `;
        // Wait for the descendant to be running before the leader exits. It is
        // an ordinary member of the owned group, not a detached background job.
        const leader = `
          const fs = require('node:fs');
          require('node:child_process').spawn(process.execPath,
            ['-e', ${JSON.stringify(descendant)}, process.argv[1], process.argv[2]], { stdio: 'inherit' });
          setInterval(() => { if (fs.existsSync(process.argv[1])) process.exit(${code}); }, 5);
        `;
        const result = await runGroup({ name: `fixture/early-${code}-${ignoreTerm}`, seconds: 5,
          command: 'node', args: ['-e', leader, ready, marker], env: f.env, graceMs: 50, log: () => {} });
        assert.equal(existsSync(ready), true, 'the descendant started before its leader exited');
        assert.equal(result.exitCode, code);
        assert.equal(result.status, code === 0 ? 'passed' : 'failed');
        await new Promise(resolveWait => setTimeout(resolveWait, 800));
        assert.equal(existsSync(marker), false, 'no descendant can write after the group completes');
        assert.equal(f.receipts().at(-1).exitCode, code);
      });
  }
}

test('SIGTERM records cancellation and returns failure', { skip: process.platform === 'win32' }, t => {
  const f = fixture(t);
  const script = `import {runGroup} from ${JSON.stringify(new URL('../tools/regression-group.mjs', import.meta.url).href)};
    setTimeout(()=>process.kill(process.pid,'SIGTERM'),400);
    process.exitCode=(await runGroup({name:'fixture/cancel',seconds:5,command:'node',args:['-e','setInterval(()=>{},1000)'],graceMs:50})).exitCode;`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { env: f.env, encoding: 'utf8', timeout: 10000 });
  assert.ifError(result.error);
  assert.equal(result.status, 130);
  assert.equal(f.receipts().at(-1).status, 'cancelled');
});

function invokeHook(suite, failure = '') {
  // Execute the real shell selector and fail-fast behavior with a command recorder.
  const driver = `node() { printf '%s\\n' "$2"; if [ "$2" = "$FAIL_GROUP" ]; then return 7; fi; }; set -- "$SUITE"; . .githooks/pre-commit-full`;
  return spawnSync(bash, ['-c', driver], { cwd: root, encoding: 'utf8', timeout: 10000,
    env: { ...process.env, SUITE: suite, FAIL_GROUP: failure } });
}

test('CI suite selection partitions the actual full hook without omission or duplication', () => {
  const all = invokeHook('all'); assert.equal(all.status, 0, all.stderr);
  const groups = all.stdout.trim().split(/\r?\n/);
  assert.ok(groups.length > 60);
  assert.equal(new Set(groups).size, groups.length);
  const suites = ['studio', 'admin', 'contracts', 'database', 'presentation', 'access', 'speech', 'gameplay'];
  const partitioned = suites.flatMap(suite => {
    const result = invokeHook(suite); assert.equal(result.status, 0, result.stderr);
    const names = result.stdout.trim().split(/\r?\n/);
    assert.ok(names.every(name => name.startsWith(`${suite}/`)));
    return names;
  });
  assert.deepEqual(partitioned, groups);
  const failed = invokeHook('admin', 'admin/dealer-import');
  assert.equal(failed.status, 7);
  assert.equal(failed.stdout.trim().split(/\r?\n/).at(-1), 'admin/dealer-import');
  const unknown = invokeHook('unknown'); assert.equal(unknown.status, 2); assert.equal(unknown.stdout, '');
});

test('product authority and media ownership checks remain mandatory, legacy map tests are opt-in', () => {
  for (const path of [
    'packages/design-preview/admin/lib/economy-journal.test.mjs', 'test/player-profile-api.mjs',
    'test/table-http.mjs', 'test/fuzz-blackjack.mjs', 'test/shoe-game.mjs', 'test/roulette.mjs',
    'test/partner-access-policy.mjs', 'test/game-entry-auth.mjs', 'test/operator-appearance-boundary.mjs',
    'test/studio-migrations.mjs', 'test/postgres-persistence.mjs', 'test/studio-game-authority.mjs',
    'test/check-migration-readiness.mjs', 'test/studio-postgres-integration.mjs', 'test/roulette-postgres.mjs',
    'test/studio-media-runtime.mjs', 'test/filmed-action-ownership.mjs', 'test/managed-media-contract.mjs',
    'test/neon-runtime-catalog.mjs', 'test/runtime-media-catalog.mjs', 'test/runtime-media-import.mjs',
    'test/speech-reply-repository.mjs', 'test/studio-cutover-integration.mjs', 'test/player-auth.mjs', 'test/bo-game-auth.mjs',
  ]) assert.ok(hook.includes(path), `Missing protection: ${path}`);
  assert.doesNotMatch(hook, /system-map/);
  assert.match(hook, /--test-concurrency=4/);
});

test('rejects invalid names and limits before starting a child', async () => {
  for (const options of [{ name: 'bad name', seconds: 1 }, { name: 'fine', seconds: 0 }, { name: 'fine', seconds: NaN }]) {
    await assert.rejects(runGroup({ ...options, command: 'node' }), /Expected a group name/);
  }
});
