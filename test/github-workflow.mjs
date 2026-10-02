import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validatePush } from '../tools/check-push-target.mjs';
import { main as inbox } from '../tools/croupier-inbox.mjs';

const policy = JSON.parse(await readFile(new URL('../tools/repository-policy.json', import.meta.url), 'utf8'));
const url = `git@github.com:${policy.repository}.git`;
const update = `HEAD ${'a'.repeat(40)} refs/heads/${policy.branch} ${'b'.repeat(40)}`;
test('only the approved GitHub branch can be pushed', () => {
  assert.equal(policy.repository, 'Jakeminator123/github-work');
  assert.equal(policy.branch, 'main');
  assert.doesNotThrow(() => validatePush(url, update, policy, () => true));
  assert.throws(() => validatePush(url, update, policy, () => false), /rewrite history/);
  assert.doesNotThrow(() => validatePush(url, update.replace('b'.repeat(40), '0'.repeat(40)), policy, () => false));
  assert.throws(() => validatePush('git@gitlab.com:scout-gg/croupier.git', update, policy));
  assert.throws(() => validatePush(url, update.replace(`refs/heads/${policy.branch}`, 'refs/heads/jakemanator123-github-work'), policy));
  assert.throws(() => validatePush(url, update.replace('a'.repeat(40), '0'.repeat(40)), policy));
  assert.throws(() => validatePush('git@github.com:someone/else.git', update, policy));
});
test('paused inbox check/send never reads credentials or calls the network', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'croupier-policy-'));
  const previousExitCode = process.exitCode;
  try {
    await mkdir(path.join(root, 'tools'));
    await writeFile(path.join(root, 'tools/repository-policy.json'), JSON.stringify({ gitlabPaused: true }));
    const options = { root, env: {}, fetchImpl: () => { throw new Error('Network must not run'); } };
    await inbox(['check'], options);
    await inbox(['send', '--file', 'does-not-exist'], options);
    assert.equal(process.exitCode, 2);
  } finally {
    process.exitCode = previousExitCode;
    await rm(root, { recursive: true, force: true });
  }
});
