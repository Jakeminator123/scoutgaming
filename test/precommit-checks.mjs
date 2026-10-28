import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  parseStagedChanges, readStagedChanges, readMergeHead, verificationMode, parseArgs, runChecks, isolatedGitEnvironment, checkPlan, focusedTests,
} from '../tools/precommit-checks.mjs';

const change = (path, status = 'M') => ({ path, status });
const mode = changes => verificationMode(changes, { env: {} });

test('documentation and indexing-only changes use quick checks', () => {
  assert.equal(mode([
    change('docs/history/JOHN-HANDOFF-2026-10.md'), change('README.md'),
    change('.ignore'), change('.cursorignore'),
    change('docs/obsolete.md', 'D'),
  ]), 'documentation');
});

test('reviewed folder guides use quick checks without exempting sibling code or arbitrary README files', () => {
  const guides = [
    'apps/web/README.md', 'apps/studio/README.md', 'apps/studio/AGENTS.md',
    'apps/studio/docs/new-guide.md',
    'migrering/MASTERPLAN.md', 'migrering/STATUS.md', 'migrering/status.json',
    'migrering/jakob-main-migrering/AKTIVITETER.md', 'migrering/kevin-ks-migrering/AKTIVITETER.md',
    'migrering/kevin-ks-migrering/K05/MAPPNINGSSYSTEM.md', 'migrering/new-runtime.md',
    'packages/presentation/README.md', 'apps/studio/client/README.md',
    'tools/media/README.md', 'ops/cloud/CONTAINER-CONTEXT.md', 'ops/cloud/README.md',
    'START-HERE.md', 'inbox/README.md', 'docs/history/2026-10-27-receipt.json',
    'services/astrid-gpu-worker/README.md', 'services/astrid-gpu-worker/SOURCE.md',
    'services/astrid-gpu-worker/gateway/README.md',
    'services/game/README.md', 'services/game/public/README.md', 'services/game/storage/README.md',
  ];
  for (const status of ['A', 'M', 'D']) {
    assert.equal(mode(guides.map(path => change(path, status))), 'documentation', status);
  }
  for (const path of [
    'tools/media/encode.sh', 'apps/studio/client/build.mjs',
    'migrering/status.mjs', 'migrering/config.json', 'inbox/people.json', 'ops/cloud/deploy/README.md', 'docs/history/run.mjs',
    'services/astrid-gpu-worker/.github/workflows/checks.yml',
    'services/astrid-gpu-worker/gateway/auth.mjs', 'services/game/storage/package.json',
    'tools/media/runtime-bundle/README.md', 'services/game/public/lab/README.md',
    'web/../tools/media/README.md', 'web\\README.md',
  ]) {
    assert.equal(mode([...guides.map(path => change(path)), change(path)]), 'focused', path);
  }
  assert.equal(mode([change('services/game/README.md', 'T')]), 'focused', 'guide symlink/type changes');
});

test('local code and deletions use focused checks; only CI or explicit full runs the complete product', () => {
  for (const path of [
    'services/game/public/app.mjs', 'test/player-auth.mjs', 'docs/dealer-sync-baseline.json',
    'services/openclaw/lab/deploy/runtime-bundle/knowledge/croupier-model.md',
    'content/staging/REVIEW.md', '.dockerignore', '.gitignore',
    'apps/studio/.env.example', '.githooks/pre-commit', 'tools/precommit-checks.mjs',
    '.agents/skills/ping-croupier/SKILL.md', 'package.json',
    'docs/../web/player.md', 'docs\\guide.md',
  ]) {
    assert.equal(mode([change('docs/NEXT-AGENT.md'), change(path, 'D')]), 'focused', path);
  }
  assert.equal(mode([change('docs/README.md', 'T')]), 'focused', 'symlink/type changes');
  assert.deepEqual(checkPlan(mode([])), [['git', 'diff', '--cached', '--check']], 'empty index needs no full build');
});

test('CI and explicit --full cannot take the quick path', () => {
  const changes = [change('docs/NEXT-AGENT.md')];
  for (const options of [{ env: { CI: 'true' } }, { env: { GITHUB_ACTIONS: 'true' } }, { forceFull: true, env: {} }]) {
    assert.equal(verificationMode(changes, options), 'full');
  }
  assert.deepEqual(parseArgs(['--full', '--plan']), { forceFull: true, planOnly: true });
  assert.throws(() => parseArgs(['--skip']), /Usage/);
});

test('staged parser preserves unusual filenames and rejects malformed output', () => {
  assert.deepEqual(parseStagedChanges('A\0docs/åäö with space\nname.md\0'), [change('docs/åäö with space\nname.md', 'A')]);
  assert.deepEqual(parseStagedChanges(''), []);
  for (const output of ['M\0docs/x.md', 'M\0', 'R100\0a\0b\0']) {
    assert.throws(() => parseStagedChanges(output));
  }
});

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', env: isolatedGitEnvironment() });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'croupier-hook-'));
  try {
    git(root, ['init', '-q']);
    git(root, ['config', 'core.hooksPath', join(root, 'no-hooks')]);
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('real Git index chooses docs, then focused when a test is staged', async () => {
  await fixture(async root => {
    await mkdir(join(root, 'docs'));
    await writeFile(join(root, 'docs', 'kort guide.md'), 'guide\n');
    git(root, ['add', '--', 'docs/kort guide.md']);
    assert.equal(mode(readStagedChanges(root)), 'documentation');
    await mkdir(join(root, 'test'));
    await writeFile(join(root, 'test', 'account.mjs'), 'export {};\n');
    git(root, ['add', '--', 'test/account.mjs']);
    assert.equal(mode(readStagedChanges(root)), 'focused');
  });
});

test('real Git rename from code to documentation still selects code checks', async () => {
  await fixture(async root => {
    await mkdir(join(root, 'services', 'game'), {recursive:true});
    await mkdir(join(root, 'docs'));
    await writeFile(join(root, 'services', 'game', 'player.mjs'), 'export {};\n');
    git(root, ['add', '--', 'services/game/player.mjs']);
    git(root, ['-c', 'user.name=Hook Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture']);
    git(root, ['mv', '--', 'services/game/player.mjs', 'docs/player.md']);
    const changes = readStagedChanges(root);
    assert.ok(changes.some(entry => entry.path === 'services/game/player.mjs' && entry.status === 'D'));
    assert.equal(mode(changes), 'focused');
  });
});

test('failed Git inspection cannot silently select quick checks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'croupier-hook-invalid-'));
  try { assert.throws(() => readStagedChanges(root), /Cannot inspect staged changes/); }
  finally { await rm(root, { recursive: true, force: true }); }
});

test('hook Git environment cannot redirect fixtures or staged reads into the invoking repository', async () => {
  await fixture(async parent => {
    await writeFile(join(parent, 'parent.md'), 'parent\n');
    git(parent, ['add', '--', 'parent.md']);
    const before = readStagedChanges(parent);
    const hooks = git(parent, ['config', 'core.hooksPath']);
    const names = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR', 'GIT_PREFIX'];
    const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
    Object.assign(process.env, { GIT_DIR: join(parent, '.git'), GIT_WORK_TREE: parent,
      GIT_INDEX_FILE: join(parent, '.git', 'index'), GIT_COMMON_DIR: join(parent, '.git'), GIT_PREFIX: 'wrong/' });
    try {
      await fixture(async root => {
        await writeFile(join(root, 'owned.md'), 'fixture\n');
        git(root, ['add', '--', 'owned.md']);
        assert.deepEqual(readStagedChanges(root), [change('owned.md', 'A')]);
        const child = "const {spawnSync}=require('node:child_process');const r=spawnSync('git',['diff','--cached','--name-only'],{encoding:'utf8'});process.exit(r.status===0&&r.stdout.trim()==='owned.md'?0:1);";
        assert.equal(runChecks([[process.execPath, '-e', child]], { cwd: root }), 0);
        // A non-repository cwd must not inherit the parent's staged files.
        const invalid = await mkdtemp(join(tmpdir(), 'croupier-hook-poisoned-'));
        try { assert.throws(() => readStagedChanges(invalid), /Cannot inspect staged changes/); }
        finally { await rm(invalid, { recursive: true, force: true }); }
      });
      assert.deepEqual(readStagedChanges(parent), before);
      assert.equal(git(parent, ['config', 'core.hooksPath']), hooks);
      assert.equal(git(parent, ['config', 'core.bare']).trim(), 'false');
    } finally {
      for (const name of names) {
        if (previous[name] === undefined) delete process.env[name];
        else process.env[name] = previous[name];
      }
    }
  });
});

test('the hook inspects its own commit index while child checks remain isolated', async () => {
  await fixture(async root => {
    await mkdir(join(root, 'docs'));
    await writeFile(join(root, 'docs', 'guide.md'), 'guide\n');
    git(root, ['add', '--', 'docs/guide.md']);
    assert.equal(mode(readStagedChanges(root)), 'documentation');
    await writeFile(join(root, 'code.mjs'), 'export {};\n');
    const env = { ...isolatedGitEnvironment(), GIT_INDEX_FILE: join(root, '.git', 'commit-index') };
    // Exercise a local commit even when the parent test runner is GitHub CI.
    delete env.CI;
    delete env.GITHUB_ACTIONS;
    const staged = spawnSync('git', ['add', '--', 'code.mjs'], { cwd: root, env, encoding: 'utf8' });
    assert.equal(staged.status, 0, staged.stderr);
    await mkdir(join(root, 'tools'));
    const script = join(root, 'tools', 'precommit-checks.mjs');
    await writeFile(script, await readFile(new URL('../tools/precommit-checks.mjs', import.meta.url)));
    await writeFile(join(root, 'tools', 'documentation-paths.mjs'), await readFile(new URL('../tools/documentation-paths.mjs', import.meta.url)));
    await mkdir(join(root,'test'));
    await writeFile(join(root,'test','code.mjs'),'import "node:test";\n');
    delete env.CROUPIER_PRECOMMIT_TEST_WORKERS;
    const plan = spawnSync(process.execPath, [script, '--plan'], { cwd: root, env, encoding: 'utf8' });
    assert.equal(plan.status, 0, plan.stderr);
    assert.equal(JSON.parse(plan.stdout).mode, 'focused');
    const baseline=JSON.parse(plan.stdout).commands;
    assert.ok(baseline.some(command=>command.includes('--test-concurrency=4')));
    for(const workers of ['1','2','3','4']){
      const limited=spawnSync(process.execPath,[script,'--plan'],{cwd:root,env:{...env,CROUPIER_PRECOMMIT_TEST_WORKERS:workers},encoding:'utf8'});
      assert.equal(limited.status,0,limited.stderr);
      assert.deepEqual(JSON.parse(limited.stdout).commands,baseline.map(command=>command.map(arg=>arg==='--test-concurrency=4'?`--test-concurrency=${workers}`:arg)),
        'worker selection must not remove or replace any check');
    }
    for(const workers of ['0','5','-1','2.0','02',' 2','1\n','1\r','','unbounded']){
      const invalid=spawnSync(process.execPath,[script,'--plan'],{cwd:root,env:{...env,CROUPIER_PRECOMMIT_TEST_WORKERS:workers},encoding:'utf8'});
      assert.notEqual(invalid.status,0);assert.match(invalid.stderr,/CROUPIER_PRECOMMIT_TEST_WORKERS/);
    }
    for (const flags of [{ CI: 'true' }, { GITHUB_ACTIONS: 'true' }]) {
      const ciPlan = spawnSync(process.execPath, [script, '--plan'], { cwd: root, env: { ...env, ...flags,CROUPIER_PRECOMMIT_TEST_WORKERS:'invalid' }, encoding: 'utf8' });
      assert.equal(ciPlan.status, 0, ciPlan.stderr);
      assert.equal(JSON.parse(ciPlan.stdout).mode, 'full');
      assert.deepEqual(JSON.parse(ciPlan.stdout).commands,[['sh','.githooks/pre-commit-full']]);
    }
    const full=spawnSync(process.execPath,[script,'--full','--plan'],{cwd:root,env:{...env,CROUPIER_PRECOMMIT_TEST_WORKERS:'1'},encoding:'utf8'});
    assert.equal(full.status,0,full.stderr);assert.deepEqual(JSON.parse(full.stdout).commands,[['sh','.githooks/pre-commit-full']]);
    assert.equal(mode(readStagedChanges(root)), 'documentation', 'the default index remains unchanged');
  });
});

test('failed, unstartable or interrupted check stops subsequent checks', () => {
  for (const result of [{ status: 7 }, { error: Error('unavailable') }, { status: null, signal: 'SIGTERM' }]) {
    let calls = 0;
    const exit = runChecks([['one'], ['two']], { run: () => { calls++; return result; } });
    assert.ok(exit > 0);
    assert.equal(calls, 1);
  }
});

test('focused selection follows changed and deleted sources without running unrelated tests', async () => {
  await fixture(async root => {
    await mkdir(join(root, 'apps', 'studio', 'lib'), {recursive: true});
    await mkdir(join(root, 'apps', 'studio', 'test'));
    await writeFile(join(root, 'apps', 'studio', 'lib', 'room.mjs'), 'export {};\n');
    await writeFile(join(root, 'apps', 'studio', 'test', 'room.test.mjs'), 'import "node:test";\n');
    await writeFile(join(root, 'apps', 'studio', 'test', 'unrelated.test.mjs'), 'throw Error("must not run");\n');
    const changes = [change('apps/studio/lib/room.mjs')];
    assert.deepEqual(focusedTests(changes, root), ['apps/studio/test/room.test.mjs']);
    const plan = checkPlan('focused', {changes, root});
    assert.ok(plan.some(args => args.includes('--check') && args.includes('apps/studio/lib/room.mjs')));
    assert.ok(plan.some(args => args.includes('--test-concurrency=4') && args.includes('apps/studio/test/room.test.mjs')));
    assert.ok(plan.every(args => !args.includes('.githooks/pre-commit-full')));
    assert.equal(runChecks(plan, {cwd: root}), 0);
    for(const testWorkers of [0,5,-1,1.5,'2',null])assert.throws(()=>checkPlan('focused',{changes,root,testWorkers}),/integer from 1 to 4/);
    await rm(join(root, 'apps', 'studio', 'lib', 'room.mjs'));
    const deleted = checkPlan('focused', {changes: [change('apps/studio/lib/room.mjs', 'D')], root});
    assert.ok(deleted.some(args => args.includes('apps/studio/test/room.test.mjs')));
    assert.ok(deleted.every(args => !args.includes('apps/studio/lib/room.mjs')));
    assert.deepEqual(focusedTests([change('apps/studio/test/room.test.mjs', 'A')], root), ['apps/studio/test/room.test.mjs']);
    await rm(join(root, 'apps', 'studio', 'test', 'room.test.mjs'));
    assert.deepEqual(focusedTests([change('apps/studio/test/room.test.mjs', 'D')], root), []);
  });
});

test('focused selection rejects traversal and option-like paths', () => {
  for (const path of ['../outside.mjs', 'web/../outside.mjs', '/outside.mjs', '--help', 'web\\outside.mjs']) {
    assert.throws(() => checkPlan('focused', {changes: [change(path)]}), /Invalid changed path/);
  }
});

test('focused selection follows static fixture imports, including cycles and deleted targets, without executing helpers', async () => {
  await fixture(async root => {
    await mkdir(join(root, 'test', 'fixtures'), { recursive: true });
    const files = {
      'test/direct.mjs': "import './fixtures/shared.mjs';\n",
      'test/transitive.mjs': "import { helper } from './fixtures/wrapper.mjs';\n",
      'test/fixtures/wrapper.mjs': "export { helper } from './shared.mjs';\n",
      'test/fixtures/shared.mjs': "import './wrapper.mjs';\nimport '../../services/widget.mjs';\nthrow Error('fixture must only be read');\nexport const helper = 1;\n",
      'test/unrelated.mjs': "// import './fixtures/shared.mjs';\nconst example = `import './fixtures/shared.mjs';`;\nimport './fixtures/other.mjs';\n",
      'test/fixtures/other.mjs': 'export {};\n',
    };
    for (const [path, content] of Object.entries(files)) await writeFile(join(root, path), content);
    const expected = ['test/direct.mjs', 'test/transitive.mjs'];
    for (const changed of ['test/fixtures/shared.mjs', 'services/widget.mjs']) {
      assert.deepEqual(focusedTests([change(changed)], root), expected);
    }
    await rm(join(root, 'test', 'fixtures', 'shared.mjs'));
    assert.deepEqual(focusedTests([change('test/fixtures/shared.mjs', 'D')], root), expected);
    const commands = checkPlan('focused', { changes: [change('test/fixtures/shared.mjs', 'D')], root });
    assert.deepEqual(commands.find(args => args.includes('--test')), [process.execPath, '--test', '--test-concurrency=4', ...expected]);
    assert.ok(commands.every(args => !args.includes('.githooks/pre-commit-full')));
  });
});

test('fixture discovery does not follow linked directories, linked files or production imports', async () => {
  await fixture(async root => {
    const outside = await mkdtemp(join(tmpdir(), 'croupier-hook-outside-'));
    try {
      await mkdir(join(root, 'test', 'fixtures'), { recursive: true });
      await mkdir(join(root, 'services'));
      await writeFile(join(root, 'test', 'linked.mjs'), "import './fixtures/linked/helper.mjs';\nimport './fixtures/file.mjs';\n");
      await writeFile(join(root, 'test', 'production.mjs'), "import '../services/widget.mjs';\n");
      await writeFile(join(root, 'services', 'widget.mjs'), "import '../test/fixtures/target.mjs';\n");
      await writeFile(join(outside, 'helper.mjs'), "import '../../../target.mjs';\n");
      await symlink(outside, join(root, 'test', 'fixtures', 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
      // A directory link at a module filename catches file-path traversal too,
      // and works on Windows without the privilege required for file symlinks.
      await symlink(outside, join(root, 'test', 'fixtures', 'file.mjs'), process.platform === 'win32' ? 'junction' : 'dir');
      assert.deepEqual(focusedTests([change('test/fixtures/linked/helper.mjs')], root), []);
      assert.deepEqual(focusedTests([change('test/fixtures/file.mjs')], root), []);
      assert.deepEqual(focusedTests([change('test/fixtures/target.mjs')], root), []);
      assert.deepEqual(focusedTests([change('services/widget.mjs')], root), []);
    } finally {
      await rm(join(root, 'test', 'fixtures', 'linked'), { force: true, recursive: true });
      await rm(join(root, 'test', 'fixtures', 'file.mjs'), { force: true, recursive: true });
      await rm(outside, { force: true, recursive: true });
    }
  });
});

test('focused selection includes the microphone consumer for fixture and camera changes', () => {
  for (const path of ['test/fixtures/microphone-control.mjs', 'services/game/public/astrid-camera-control.mjs']) {
    assert.ok(focusedTests([change(path)]).includes('test/microphone-openclaw-integration.mjs'), path);
  }
});

test('documentation and focused commits both run the repo-limit guard on the staged diff', () => {
  const guard = [process.execPath, 'tools/check-repo-limits.mjs', '--cached'];
  for (const changes of [[change('docs/NEXT-AGENT.md')], [change('media/new.png', 'A')], [change('tools/precommit-checks.mjs')]]) {
    const plan = checkPlan(mode(changes), { changes });
    assert.deepEqual(plan.slice(0, 2), [['git', 'diff', '--cached', '--check'], guard], changes[0].path);
  }
  assert.equal(mode([change('docs/NEXT-AGENT.md')]), 'documentation');
  assert.ok(checkPlan('documentation', { changes: [] }).every(command => !command.includes('tools/check-repo-limits.mjs')));
});

test('cached checks keep the commit index while test subprocesses lose repository overrides', () => {
  const saved = process.env.GIT_INDEX_FILE;
  process.env.GIT_INDEX_FILE = 'temporary-commit-index';
  const seen = [];
  try {
    assert.equal(runChecks([['git', 'diff', '--cached', '--check'], [process.execPath, '--test', 'fixture.mjs'],
      [process.execPath, 'tools/check-repo-limits.mjs', '--cached'], [process.execPath, 'other.mjs', '--cached']], {
      run(command, args, options) { seen.push(options.env); return {status: 0}; },
    }), 0);
    assert.equal(seen[0].GIT_INDEX_FILE, 'temporary-commit-index');
    assert.equal(seen[1].GIT_INDEX_FILE, undefined);
    assert.equal(seen[2].GIT_INDEX_FILE, 'temporary-commit-index', 'the repo-limit guard judges the commit index');
    assert.equal(seen[3].GIT_INDEX_FILE, undefined);
  } finally {
    if (saved === undefined) delete process.env.GIT_INDEX_FILE;
    else process.env.GIT_INDEX_FILE = saved;
  }
});

async function mergeFixture(run) {
  await fixture(async root => {
    const commit = message => git(root, ['-c', 'user.name=Hook Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', message]);
    const write = async (path, content) => { await mkdir(join(root, path, '..'), { recursive: true }); await writeFile(join(root, path), content); };
    for (const [path, content] of Object.entries({ 'shared.mjs': 'export const v = 0;\n', 'gone.mjs': 'export {};\n',
      'docs/guide.md': 'guide\n', 'kept.mjs': 'export const k = 0;\n' })) await write(path, content);
    git(root, ['add', '-A']);
    commit('base');
    git(root, ['branch', '-M', 'trunk']);
    git(root, ['checkout', '-qb', 'feature']);
    await write('feature.mjs', 'export const f = 1;\n');
    git(root, ['add', '-A']);
    commit('feature');
    git(root, ['checkout', '-q', 'trunk']);
    await write('apps/studio/client/lobby/main.mjs', 'export const lobby = 1;\n');
    await write('kept.mjs', 'export const k = 1;\n');
    await rm(join(root, 'gone.mjs'));
    git(root, ['add', '-A']);
    commit('trunk');
    await run({ root, write, commit });
  });
}

test('a clean merge stages only own edits, not the merged branch', async () => {
  await mergeFixture(async ({ root, write }) => {
    git(root, ['checkout', '-q', 'feature']);
    git(root, ['update-ref', 'refs/remotes/origin/main', 'trunk']);
    git(root, ['-c', 'user.name=Hook Fixture', '-c', 'user.email=fixture@example.invalid', 'merge', '-q', '--no-ff', '--no-commit', 'trunk']);
    assert.match(git(root, ['rev-parse', '-q', '--verify', 'MERGE_HEAD']), /^[a-f0-9]{40}/);
    assert.deepEqual(readStagedChanges(root), [], 'added, modified and deleted files from trunk are not this commit');
    assert.equal(mode(readStagedChanges(root)), 'documentation');
    // An edit made during the merge differs from both sides and is checked.
    await write('kept.mjs', 'export const k = 2;\n');
    await write('docs/guide.md', 'own guide\n');
    git(root, ['add', '--', 'kept.mjs', 'docs/guide.md']);
    assert.deepEqual(readStagedChanges(root), [change('docs/guide.md'), change('kept.mjs')]);
    // Deleting a file the merged branch still has is own work too.
    git(root, ['rm', '-q', '--', 'shared.mjs']);
    assert.deepEqual(readStagedChanges(root), [change('docs/guide.md'), change('kept.mjs'), change('shared.mjs', 'D')]);
    git(root, ['merge', '--abort']);
    assert.deepEqual(readStagedChanges(root), [], 'no merge, nothing staged');
  });
});

test('a conflicted merge checks resolutions that differ from both sides', async () => {
  await mergeFixture(async ({ root, write, commit }) => {
    await write('shared.mjs', 'export const v = 1;\n');
    git(root, ['add', '-A']);
    commit('trunk shared');
    git(root, ['checkout', '-q', 'feature']);
    git(root, ['update-ref', 'refs/remotes/origin/main', 'trunk']);
    await write('shared.mjs', 'export const v = 2;\n');
    git(root, ['add', '-A']);
    commit('feature shared');
    const merge = spawnSync('git', ['-c', 'user.name=Hook Fixture', '-c', 'user.email=fixture@example.invalid', 'merge', '-q', '--no-ff', 'trunk'],
      { cwd: root, encoding: 'utf8', env: isolatedGitEnvironment() });
    assert.notEqual(merge.status, 0, 'the fixture must conflict');
    assert.deepEqual(readStagedChanges(root), [change('shared.mjs', 'U')], 'an unresolved path is never dropped');
    await write('shared.mjs', 'export const v = 3;\n');
    git(root, ['add', '--', 'shared.mjs']);
    const own = readStagedChanges(root);
    assert.deepEqual(own, [change('shared.mjs')]);
    assert.equal(mode(own), 'focused');
    assert.ok(checkPlan('focused', { changes: own, root }).every(args => !args.includes('apps/studio/client/lobby/main.mjs')));
    // Taking the merged side's version, or keeping our own, adds nothing new.
    git(root, ['checkout', '-q', 'trunk', '--', 'shared.mjs']);
    assert.deepEqual(readStagedChanges(root), []);
    git(root, ['checkout', '-q', 'HEAD', '--', 'shared.mjs']);
    assert.deepEqual(readStagedChanges(root), []);
  });
});

test('merge-state inspection fails closed outside a repository', async () => {
  const root = await mkdtemp(join(tmpdir(), 'croupier-hook-nomerge-'));
  try {
    assert.equal(readMergeHead(root), null);
    assert.throws(() => readStagedChanges(root), /Cannot inspect staged changes/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a merge of anything but main keeps every staged path', async () => {
  await mergeFixture(async ({ root }) => {
    git(root, ['checkout', '-q', 'feature']);
    const merge = () => git(root, ['-c', 'user.name=Hook Fixture', '-c', 'user.email=fixture@example.invalid', 'merge', '-q', '--no-ff', '--no-commit', 'trunk']);
    const all = [change('apps/studio/client/lobby/main.mjs', 'A'), change('gone.mjs', 'D'), change('kept.mjs')];
    // No origin/main at all: nothing is known to be checked.
    merge();
    assert.deepEqual(readStagedChanges(root), all);
    git(root, ['merge', '--abort']);
    // origin/main behind the merged branch: trunk's newest commit was never checked on main.
    git(root, ['update-ref', 'refs/remotes/origin/main', 'trunk~1']);
    merge();
    assert.deepEqual(readStagedChanges(root), all);
    assert.equal(mode(readStagedChanges(root)), 'focused');
    git(root, ['merge', '--abort']);
    // Once origin/main contains it, the merged files are filtered again.
    git(root, ['update-ref', 'refs/remotes/origin/main', 'trunk']);
    merge();
    assert.deepEqual(readStagedChanges(root), []);
  });
});
