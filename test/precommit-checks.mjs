import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  parseStagedChanges, readStagedChanges, verificationMode, parseArgs, runChecks, isolatedGitEnvironment,
} from '../tools/precommit-checks.mjs';

const change = (path, status = 'M') => ({ path, status });
const mode = changes => verificationMode(changes, { env: {} });

test('documentation and indexing-only changes use quick checks', () => {
  assert.equal(mode([
    change('docs/JOHN-HANDOFF.md'), change('README.md'),
    change('.ignore'), change('.cursorindexingignore'),
    change('docs/obsolete.md', 'D'),
  ]), 'documentation');
});

test('reviewed folder guides use quick checks without exempting sibling code or arbitrary README files', () => {
  const guides = [
    'apps/croupier-frontend/README.md',
    'packages/presentation/README.md', 'packages/design-preview/README.md',
    'packages/presentation/docs/INTEGRATION.md',
    'pipeline/README.md', 'ops/cloud/CONTAINER-CONTEXT.md',
    'services/astrid-gpu-worker/README.md', 'services/astrid-gpu-worker/SOURCE.md',
    'services/astrid-gpu-worker/gateway/README.md',
    'web/README.md', 'web/public/README.md', 'web/storage/README.md',
  ];
  for (const status of ['A', 'M', 'D']) {
    assert.equal(mode(guides.map(path => change(path, status))), 'documentation', status);
  }
  for (const path of [
    'pipeline/encode.sh', 'packages/design-preview/build.mjs',
    'services/astrid-gpu-worker/.github/workflows/checks.yml',
    'services/astrid-gpu-worker/gateway/auth.mjs', 'web/storage/package.json',
    'pipeline/runtime-bundle/README.md', 'web/public/lab/README.md',
    'web/../pipeline/README.md', 'web\\README.md',
  ]) {
    assert.equal(mode([...guides.map(path => change(path)), change(path)]), 'full', path);
  }
  assert.equal(mode([change('web/README.md', 'T')]), 'full', 'guide symlink/type changes');
});

test('code, deletion, runtime prompts and machine metadata retain full regression', () => {
  for (const path of [
    'web/public/app.mjs', 'test/player-auth.mjs', 'docs/dealer-sync-baseline.json',
    'open-claw/lab/deploy/runtime-bundle/knowledge/croupier-model.md',
    'content/staging/REVIEW.md', '.dockerignore', '.gitignore',
    'lab/.env.example', '.githooks/pre-commit', 'tools/precommit-checks.mjs',
    '.agents/skills/ping-croupier/SKILL.md', 'package.json',
    'docs/../web/player.md', 'docs\\guide.md',
  ]) {
    assert.equal(mode([change('docs/JOHN-HANDOFF.md'), change(path, 'D')]), 'full', path);
  }
  assert.equal(mode([change('docs/README.md', 'T')]), 'full', 'symlink/type changes');
  assert.equal(mode([]), 'full', 'empty index is not a docs commit');
});

test('CI and explicit --full cannot take the quick path', () => {
  const changes = [change('docs/JOHN-HANDOFF.md')];
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

test('real Git index chooses docs, then full when a test is staged', async () => {
  await fixture(async root => {
    await mkdir(join(root, 'docs'));
    await writeFile(join(root, 'docs', 'kort guide.md'), 'guide\n');
    git(root, ['add', '--', 'docs/kort guide.md']);
    assert.equal(mode(readStagedChanges(root)), 'documentation');
    await mkdir(join(root, 'test'));
    await writeFile(join(root, 'test', 'account.mjs'), 'export {};\n');
    git(root, ['add', '--', 'test/account.mjs']);
    assert.equal(mode(readStagedChanges(root)), 'full');
  });
});

test('real Git rename from code to documentation still requires full regression', async () => {
  await fixture(async root => {
    await mkdir(join(root, 'web'));
    await mkdir(join(root, 'docs'));
    await writeFile(join(root, 'web', 'player.mjs'), 'export {};\n');
    git(root, ['add', '--', 'web/player.mjs']);
    git(root, ['-c', 'user.name=Hook Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture']);
    git(root, ['mv', '--', 'web/player.mjs', 'docs/player.md']);
    const changes = readStagedChanges(root);
    assert.ok(changes.some(entry => entry.path === 'web/player.mjs' && entry.status === 'D'));
    assert.equal(mode(changes), 'full');
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
    const staged = spawnSync('git', ['add', '--', 'code.mjs'], { cwd: root, env, encoding: 'utf8' });
    assert.equal(staged.status, 0, staged.stderr);
    await mkdir(join(root, 'tools'));
    const script = join(root, 'tools', 'precommit-checks.mjs');
    await writeFile(script, await readFile(new URL('../tools/precommit-checks.mjs', import.meta.url)));
    const plan = spawnSync(process.execPath, [script, '--plan'], { cwd: root, env, encoding: 'utf8' });
    assert.equal(plan.status, 0, plan.stderr);
    assert.equal(JSON.parse(plan.stdout).mode, 'full');
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
