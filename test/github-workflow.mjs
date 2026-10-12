import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { redactSecrets, validatePush, verifyPushMaps } from '../tools/check-push-target.mjs';
import { deliver, parseDeliveryArgs, planGithubDelivery } from '../tools/push-github-work.mjs';

const policy = JSON.parse(await readFile(new URL('../tools/repository-policy.json', import.meta.url), 'utf8'));
const url = `git@github.com:${policy.repository}.git`;
const sha = char => char.repeat(40);
const update = `HEAD ${sha('a')} refs/heads/${policy.branch} ${sha('b')}`;
const feature = (name, local = sha('c'), remote = sha('d')) => `refs/heads/${name} ${local} refs/heads/${name} ${remote}`;

test('push verifies the transported commit once and blocks a failed map check', () => {
  const seen = [];
  verifyPushMaps(`${update}\n${update}`, (command, args) => { seen.push({command,args}); return {status:0}; });
  assert.deepEqual(seen,[{command:process.execPath,args:['docs/system-map/verify.mjs','--check','--ref',sha('a')]}]);
  assert.throws(() => verifyPushMaps(update, () => ({status:1})), /System map/);
  assert.throws(() => verifyPushMaps(update, () => ({error:Error('fixture')})), /System map/);
  assert.throws(() => verifyPushMaps(update.replace(sha('a'),'HEAD'), () => {throw Error('must not run');}), /Invalid push commit/);
});
test('only the approved GitHub branch can be pushed', () => {
  assert.equal(policy.repository, 'Jakeminator123/scoutgaming');
  assert.equal(policy.branch, 'main');
  assert.deepEqual(policy.featureBranches, ['jakob/*', 'codex/*', 'cursor/*']);
  assert.doesNotThrow(() => validatePush(url, update, policy, () => true));
  assert.throws(() => validatePush(url, update, policy, () => false), /force push/);
  assert.doesNotThrow(() => validatePush(url, update.replace(sha('b'), sha('0')), policy, () => false));
  assert.throws(() => validatePush('git@gitlab.com:scout-gg/croupier.git', update, policy), /approved GitHub/);
  assert.throws(() => validatePush(url, update.replace(`refs/heads/${policy.branch}`, 'refs/heads/jakemanator123-github-work'), policy), /feature branches/);
  assert.throws(() => validatePush(url, update.replace(sha('a'), sha('0')), policy), /deletion/);
  assert.throws(() => validatePush('git@github.com:someone/else.git', update, policy), /approved GitHub/);
});
test('feature branches can be created and fast-forwarded', () => {
  for (const name of ['jakob/repo-ordning', 'codex/example', 'cursor/a03-agent-rules-delivery-ff96', 'jakob/a/b']) {
    assert.doesNotThrow(() => validatePush(url, feature(name, sha('c'), sha('0')), policy, () => { throw new Error('new branch'); }));
    assert.doesNotThrow(() => validatePush(url, feature(name), policy, () => true));
    assert.throws(() => validatePush(url, feature(name), policy, () => false), /force push/);
  }
  const https = `https://github.com/${policy.repository}`;
  assert.doesNotThrow(() => validatePush(https, feature('cursor/example', sha('c'), sha('0')), policy, () => true));
  assert.doesNotThrow(() => validatePush(`https://github.com/${policy.repository}.git`, `${update}\n${feature('codex/example')}`, policy, () => true));
});
test('push rejects deletion, tags, other branches and other repositories', () => {
  assert.throws(() => validatePush(url, feature('cursor/example', sha('0'), sha('d')), policy), /deletion/);
  assert.throws(() => validatePush(url, feature('main', sha('0')), policy), /deletion/);
  assert.throws(() => validatePush(url, `refs/tags/Jakobs-v1 ${sha('c')} refs/tags/Jakobs-v1 ${sha('0')}`, policy), /Tag/);
  assert.throws(() => validatePush(url, `refs/tags/Jakobs-v1 ${sha('c')} refs/tags/Jakobs-v1 ${sha('d')}`, policy), /Tag/);
  for (const name of ['kevin', 'john', 'emil', 'jakob-export', 'jakob', 'cursor', 'cursor/', 'cursor/../main', 'cursor/name.lock']) {
    assert.throws(() => validatePush(url, feature(name, sha('c'), sha('0')), policy), /feature branches/);
  }
  assert.throws(() => validatePush(url, `refs/notes/commits ${sha('c')} refs/notes/commits ${sha('0')}`, policy), /feature branches/);
  assert.throws(() => validatePush('https://github.com/someone/else.git', update, policy), /approved GitHub/);
  assert.throws(() => validatePush('http://github.com/Jakeminator123/scoutgaming.git', update, policy), /approved GitHub/);
  const leaked = 'https://x-access-token:example-token@github.com/someone/else.git';
  assert.throws(() => validatePush(leaked, update, policy), error => {
    assert.match(error.message, /approved GitHub/);
    assert.equal(error.message.includes('example-token'), false);
    return true;
  });
  for (const credentialUrl of [
    'https://x-access-token:example-token@github.com/jakeminator123/scoutgaming',
    'https://example-token@github.com/jakeminator123/scoutgaming.git',
    'https://example-token:@github.com/Jakeminator123/scoutgaming',
  ]) {
    assert.throws(() => validatePush(credentialUrl, update, policy, () => true), error => {
      assert.match(error.message, /approved GitHub/);
      assert.equal(error.message.includes('example-token'), false);
      return true;
    }, credentialUrl);
  }
  for (const text of [
    'fatal: https://x-access-token:example-token@github.com/jakeminator123/scoutgaming/info/refs',
    "fatal: unable to access 'https://example-token@github.com/Jakeminator123/scoutgaming.git/': denied",
    'remote: https://user@github.com/x/y and ssh://example-token@github.com/x/y',
  ]) assert.equal(redactSecrets(text).includes('example-token') || redactSecrets(text).includes('user@'), false, text);
});
test('feature-branch pushes keep the system-map check', () => {
  const seen = [];
  verifyPushMaps(feature('cursor/example'), (command, args) => { seen.push({ command, args }); return { status: 0 }; });
  assert.deepEqual(seen, [{ command: process.execPath, args: ['docs/system-map/verify.mjs', '--check', '--ref', sha('c')] }]);
});
test('delivery plans a feature branch and an explicit main emergency path', () => {
  assert.deepEqual(parseDeliveryArgs(['--check']), { check: true, adminMain: false });
  assert.throws(() => parseDeliveryArgs(['--force']), /Usage/);
  const plan = planGithubDelivery({ branch: 'cursor/a03-example', policy });
  assert.equal(plan.ref, 'refs/heads/cursor/a03-example');
  assert.equal(plan.emergency, false);
  assert.equal(plan.pullRequest, 'gh pr create --repo Jakeminator123/scoutgaming --base main --head cursor/a03-example');
  assert.equal(planGithubDelivery({ branch: 'main', adminMain: true, policy }).emergency, true);
  assert.equal(planGithubDelivery({ branch: 'main', adminMain: true, policy }).pullRequest, null);
  assert.throws(() => planGithubDelivery({ branch: 'main', policy }), /admin emergency/);
  assert.throws(() => planGithubDelivery({ branch: 'kevin', policy }), /not a delivery branch/);
  assert.throws(() => planGithubDelivery({ branch: 'cursor/a03-example', adminMain: true, policy }), /only pushes main/);
  assert.throws(() => planGithubDelivery({ branch: 'cursor/example', policy: { ...policy, featureBranches: [] } }), /featureBranches/);
});

function fakeGit(responses) {
  const calls = [];
  const git = (...args) => {
    calls.push(args.join(' '));
    const key = args.join(' ');
    if (!Object.hasOwn(responses, key)) throw new Error(`unexpected git ${key}`);
    const value = responses[key];
    if (value instanceof Error) throw value;
    return value;
  };
  return { calls, git };
}

test('delivery helper pushes the feature branch and only prints the pull-request command', () => {
  const local = sha('c');
  const { calls, git } = fakeGit({
    'branch --show-current': 'cursor/a03-example',
    'remote get-url --push --all origin': 'https://github.com/Jakeminator123/scoutgaming',
    'rev-parse HEAD': local,
    'ls-remote --heads https://github.com/Jakeminator123/scoutgaming refs/heads/cursor/a03-example': '',
    [`push origin ${local}:refs/heads/cursor/a03-example`]: '',
    [`branch --set-upstream-to=origin/cursor/a03-example cursor/a03-example`]: '',
  });
  let remoteReads = 0;
  const wrapped = (...args) => {
    if (args[0] === 'ls-remote') {
      remoteReads += 1;
      if (remoteReads === 2) return local;
    }
    return git(...args);
  };
  const logs = [];
  const plan = deliver({ args: [], policy, git: wrapped, log: line => logs.push(line) });
  assert.equal(plan.pullRequest.includes('gh pr create'), true);
  assert.equal(calls.some(call => call.startsWith('push ')), true);
  assert.equal(logs.some(line => line.startsWith('Pull request command (not created by this tool): gh pr create ')), true);
  assert.equal(logs.join('\n').includes('gh pr create --repo Jakeminator123/scoutgaming --base main --head cursor/a03-example'), true);
  assert.equal(calls.some(call => call.split(' ')[0] === 'gh'), false);
});
test('delivery check does not push, and main requires the admin flag', () => {
  const local = sha('e');
  const checked = fakeGit({
    'branch --show-current': 'codex/example',
    'remote get-url --push --all origin': 'git@github.com:Jakeminator123/scoutgaming.git',
    'rev-parse HEAD': local,
    'ls-remote --heads git@github.com:Jakeminator123/scoutgaming.git refs/heads/codex/example': `${sha('d')}\trefs/heads/codex/example`,
    [`merge-base --is-ancestor ${sha('d')} ${local}`]: '',
  });
  const logs = [];
  deliver({ args: ['--check'], policy, git: checked.git, log: line => logs.push(line) });
  assert.equal(checked.calls.some(call => call.startsWith('push ')), false);
  assert.match(logs.at(-1), /gh pr create --repo Jakeminator123\/scoutgaming --base main --head codex\/example/);

  const blocked = fakeGit({ 'branch --show-current': 'main' });
  assert.throws(() => deliver({ args: [], policy, git: blocked.git, log() {} }), /admin emergency/);
  assert.equal(blocked.calls.some(call => call.startsWith('push ')), false);

  const emergency = fakeGit({
    'branch --show-current': 'main',
    'remote get-url --push --all origin': 'https://github.com/Jakeminator123/scoutgaming.git',
    'rev-parse HEAD': local,
    'ls-remote --heads https://github.com/Jakeminator123/scoutgaming.git refs/heads/main': '',
    [`push origin ${local}:refs/heads/main`]: '',
    'branch --set-upstream-to=origin/main main': '',
  });
  let reads = 0;
  const emergencyGit = (...args) => {
    if (args[0] === 'ls-remote') {
      reads += 1;
      return reads === 1 ? '' : local;
    }
    return emergency.git(...args);
  };
  const emergencyLogs = [];
  deliver({ args: ['--admin-main'], policy, git: emergencyGit, log: line => emergencyLogs.push(line) });
  assert.equal(emergencyLogs.some(line => line.includes('gh pr create')), false);
  assert.equal(JSON.parse(emergencyLogs[0]).emergency, true);

  const diverged = fakeGit({
    'branch --show-current': 'jakob/example',
    'remote get-url --push --all origin': 'https://github.com/Jakeminator123/scoutgaming',
    'rev-parse HEAD': local,
    'ls-remote --heads https://github.com/Jakeminator123/scoutgaming refs/heads/jakob/example': sha('b'),
    [`merge-base --is-ancestor ${sha('b')} ${local}`]: new Error('not ancestor'),
  });
  assert.throws(() => deliver({ args: [], policy, git: diverged.git, log() {} }), /No force push/);
  assert.equal(diverged.calls.some(call => call.startsWith('push ')), false);
  const wrong = fakeGit({
    'branch --show-current': 'cursor/example',
    'remote get-url --push --all origin': 'https://github.com/someone/else.git',
  });
  assert.throws(() => deliver({ args: ['--check'], policy, git: wrong.git, log() {} }), /approved GitHub/);
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
