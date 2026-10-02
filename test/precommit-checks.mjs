import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  parseStagedChanges, readStagedChanges, verificationMode, parseArgs, runChecks,
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
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
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

test('failed, unstartable or interrupted check stops subsequent checks', () => {
  for (const result of [{ status: 7 }, { error: Error('unavailable') }, { status: null, signal: 'SIGTERM' }]) {
    let calls = 0;
    const exit = runChecks([['one'], ['two']], { run: () => { calls++; return result; } });
    assert.ok(exit > 0);
    assert.equal(calls, 1);
  }
});
