import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validatePush, verifyPushMaps } from '../tools/check-push-target.mjs';

const policy = JSON.parse(await readFile(new URL('../tools/repository-policy.json', import.meta.url), 'utf8'));
const url = `git@github.com:${policy.repository}.git`;
const update = `HEAD ${'a'.repeat(40)} refs/heads/${policy.branch} ${'b'.repeat(40)}`;

test('push verifies the transported commit once and blocks a failed map check', () => {
  const seen = [];
  verifyPushMaps(`${update}\n${update}`, (command, args) => { seen.push({command,args}); return {status:0}; });
  assert.deepEqual(seen,[{command:process.execPath,args:['docs/system-map/verify.mjs','--check','--ref','a'.repeat(40)]}]);
  assert.throws(() => verifyPushMaps(update, () => ({status:1})), /System map/);
  assert.throws(() => verifyPushMaps(update, () => ({error:Error('fixture')})), /System map/);
  assert.throws(() => verifyPushMaps(update.replace('a'.repeat(40),'HEAD'), () => {throw Error('must not run');}), /Invalid push commit/);
});
test('only the approved GitHub branch can be pushed', () => {
  assert.equal(policy.repository, 'Jakeminator123/scoutgaming');
  assert.equal(policy.branch, 'main');
  assert.doesNotThrow(() => validatePush(url, update, policy, () => true));
  assert.throws(() => validatePush(url, update, policy, () => false), /rewrite history/);
  assert.doesNotThrow(() => validatePush(url, update.replace('b'.repeat(40), '0'.repeat(40)), policy, () => false));
  assert.throws(() => validatePush('git@gitlab.com:scout-gg/croupier.git', update, policy));
  assert.throws(() => validatePush(url, update.replace(`refs/heads/${policy.branch}`, 'refs/heads/jakemanator123-github-work'), policy));
  assert.throws(() => validatePush(url, update.replace('a'.repeat(40), '0'.repeat(40)), policy));
  assert.throws(() => validatePush('git@github.com:someone/else.git', update, policy));
});
