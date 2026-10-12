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
  const review = update.replace(`refs/heads/${policy.branch}`, 'refs/heads/cursor/speech-audio-overlap');
  assert.doesNotThrow(() => validatePush(url, review.replace('b'.repeat(40), '0'.repeat(40)), policy, () => false));
  assert.throws(() => validatePush(url, review, policy, () => false), /rewrite history/);
  assert.throws(() => validatePush(url, update.replace(`refs/heads/${policy.branch}`, 'refs/heads/cursor/Not_Allowed'), policy));
  assert.throws(() => validatePush(url, update.replace('a'.repeat(40), '0'.repeat(40)), policy));
  assert.throws(() => validatePush('git@github.com:someone/else.git', update, policy));
});


import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

for (const scenario of ['warm', 'cold', 'incomplete', 'missing-tool']) {
  test(`FFmpeg installer: ${scenario} cache and tool readiness`, async () => {
    const temp = await mkdtemp(join(tmpdir(), 'croupier-ffmpeg-'));
    const slash = value => value.replaceAll('\\', '/');
    const cache = slash(join(temp, 'cache'));
    const output = join(temp, 'outputs');
    const calls = join(temp, 'apt-calls');
    const copy = join(temp, 'install.sh');
    const source = await readFile(new URL('../tools/ci-install-ffmpeg.sh', import.meta.url), 'utf8');
    // Only relocate the protected cache into this fixture; execute the actual installer.
    await writeFile(copy, source.replaceAll('/home/runner/apt-cache/ffmpeg', cache));
    await writeFile(output, '');
    await writeFile(calls, '');
    const driver = `
      installed=0
      tried_cache=0
      command() {
        if [[ "$1" == -v && ( "$2" == ffmpeg || "$2" == ffprobe || "$2" == jq ) ]]; then
          [[ "$installed" == 1 ]] || return 1
          [[ "$SCENARIO" != missing-tool || "$2" != ffprobe ]] || return 1
          return 0
        fi
        builtin command "$@"
      }
      sudo() { if [[ "$1" == chown ]]; then return 0; fi; "$@"; }
      apt-get() {
        printf '%s\\n' "$*" >> "$APT_CALLS"
        if [[ " $* " == *" --no-download "* ]]; then
          # APT refuses uncached archives when downloads are disabled.
          [[ " $* " == *"Dir::Cache::archives=\${FFMPEG_CACHE_DIR}/"* ]] || return 1
          if [[ "$SCENARIO" == incomplete && "$tried_cache" == 0 ]]; then
            tried_cache=1
            return 1
          fi
          installed=1
        elif [[ " $* " == *" --download-only "* ]]; then
          touch "$FFMPEG_CACHE_DIR/ffmpeg.deb"
        fi
      }
      ffmpeg() { echo 'ffmpeg fixture'; }
      jq() { echo 'jq fixture'; }
      mkdir -p "$FFMPEG_CACHE_DIR"
      if [[ "$SCENARIO" == warm || "$SCENARIO" == incomplete ]]; then
        touch "$FFMPEG_CACHE_DIR/ffmpeg.deb"
      fi
      source "$1"
    `;
    try {
      const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash';
      const run = spawnSync(bash, ['-c', driver, '--', slash(copy)], {
        encoding: 'utf8', timeout: 15000,
        env: { ...process.env, USER: process.env.USER || "fixture", SCENARIO: scenario, FFMPEG_CACHE_DIR: cache,
          GITHUB_OUTPUT: output, APT_CALLS: slash(calls) },
      });
      assert.ifError(run.error);
      const apt = await readFile(calls, 'utf8');
      const outputs = await readFile(output, 'utf8');
      if (scenario === 'missing-tool') {
        assert.notEqual(run.status, 0);
        assert.doesNotMatch(outputs, /save=true/);
      } else {
        assert.equal(run.status, 0, run.stderr);
        if (scenario === 'warm') {
          assert.match(apt, /--no-download install/);
          assert.doesNotMatch(apt, /update|--download-only/);
          assert.match(outputs, /save=false/);
        } else {
          assert.match(apt, /update/);
          assert.match(apt, /--download-only/);
          assert.match(apt, /--no-download install/);
          assert.match(outputs, /save=true/);
        }
      }
    } finally { await rm(temp, { recursive: true, force: true }); }
  });
}
