import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { redactSecrets, validatePush } from '../tools/check-push-target.mjs';
import { deliver, parseDeliveryArgs, planGithubDelivery } from '../tools/push-github-work.mjs';

const policy = JSON.parse(await readFile(new URL('../tools/repository-policy.json', import.meta.url), 'utf8'));
const url = `git@github.com:${policy.repository}.git`;
const sha = char => char.repeat(40);
const update = `HEAD ${sha('a')} refs/heads/${policy.branch} ${sha('b')}`;
const feature = (name, local = sha('c'), remote = sha('d')) => `refs/heads/${name} ${local} refs/heads/${name} ${remote}`;

test('only the approved GitHub branch can be pushed', () => {
  assert.equal(policy.repository, 'Jakeminator123/scoutgaming');
  assert.equal(policy.branch, 'main');
  assert.deepEqual(policy.featureBranches, ['jakob/*']);
  assert.doesNotThrow(() => validatePush(url, update, policy, () => true));
  assert.throws(() => validatePush(url, update, policy, () => false), /force push/);
  assert.doesNotThrow(() => validatePush(url, update.replace(sha('b'), sha('0')), policy, () => false));
  assert.throws(() => validatePush('git@gitlab.com:scout-gg/croupier.git', update, policy), /approved GitHub/);
  assert.throws(() => validatePush(url, update.replace(`refs/heads/${policy.branch}`, 'refs/heads/jakemanator123-github-work'), policy), /feature branches/);
  assert.throws(() => validatePush(url, update.replace(sha('a'), sha('0')), policy, () => true, () => sha('e')), /deletion is not allowed for main/);
  assert.throws(() => validatePush('git@github.com:someone/else.git', update, policy), /approved GitHub/);
});
test('feature branches can be created and fast-forwarded', () => {
  for (const name of ['jakob/repo-ordning', 'jakob/claude-example', 'jakob/a03-agent-rules-delivery-ff96', 'jakob/a/b']) {
    assert.doesNotThrow(() => validatePush(url, feature(name, sha('c'), sha('0')), policy, () => { throw new Error('new branch'); }));
    assert.doesNotThrow(() => validatePush(url, feature(name), policy, () => true));
    assert.throws(() => validatePush(url, feature(name), policy, () => false), /force push/);
  }
  const https = `https://github.com/${policy.repository}`;
  assert.doesNotThrow(() => validatePush(https, feature('jakob/example', sha('c'), sha('0')), policy, () => true));
  assert.doesNotThrow(() => validatePush(`https://github.com/${policy.repository}.git`, `${update}\n${feature('jakob/claude-example')}`, policy, () => true));
});
test('merged feature branches can be deleted; main, protected and unmerged branches cannot', () => {
  const main = () => sha('e');
  const deletion = name => `(delete) ${sha('0')} refs/heads/${name} ${sha('d')}`;
  const calls = [];
  const merged = (before, after) => { calls.push([before, after]); return true; };
  assert.doesNotThrow(() => validatePush(url, deletion('jakob/claude-old'), policy, merged, main));
  assert.deepEqual(calls, [[sha('d'), sha('e')]], 'the remote head is checked against origin/main');
  assert.throws(() => validatePush(url, deletion('jakob/claude-open'), policy, () => false, main), /jakob\/claude-open is not merged into main/);
  assert.throws(() => validatePush(url, deletion('jakob/claude-old'), policy, merged, () => null), /origin\/main is missing/);
  assert.throws(() => validatePush(url, `(delete) ${sha('0')} refs/heads/jakob/gone ${sha('0')}`, policy, merged, main), /does not exist/);
  assert.throws(() => validatePush(url, deletion('main'), policy, merged, main), /deletion is not allowed for main/);
  assert.deepEqual(policy.protectedBranches.includes('kevin*'), true);
  for (const name of ['kevin', 'kevin-staging', 'kevin/x', 'codex/kevin-fix', 'john', 'emil', 'jakob-export', 'jakob-gren', 'roulette-on-kevin-staging', 'codex/pr-automation']) {
    assert.throws(() => validatePush(url, deletion(name), policy, merged, main), /protected branch/, name);
  }
  assert.throws(() => validatePush(url, deletion('codex/example'), policy, merged, main), /feature branches/);
  assert.throws(() => validatePush(url, `(delete) ${sha('0')} refs/tags/Jakobs-v1 ${sha('d')}`, policy, merged, main), /Tag/);
  assert.throws(() => validatePush(url, `(delete) ${sha('0')} refs/notes/commits ${sha('d')}`, policy, merged, main), /feature branches/);
});
test('push rejects tags, other branches and other repositories', () => {
  assert.throws(() => validatePush(url, `refs/tags/Jakobs-v1 ${sha('c')} refs/tags/Jakobs-v1 ${sha('0')}`, policy), /Tag/);
  assert.throws(() => validatePush(url, `refs/tags/Jakobs-v1 ${sha('c')} refs/tags/Jakobs-v1 ${sha('d')}`, policy), /Tag/);
  for (const name of ['kevin', 'john', 'emil', 'jakob-export', 'jakob', 'codex/example', 'cursor/a03-example', 'jakob/', 'jakob/../main', 'jakob/name.lock']) {
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
test('delivery plans a feature branch and an explicit main emergency path', () => {
  assert.deepEqual(parseDeliveryArgs(['--check']), { check: true, adminMain: false });
  assert.throws(() => parseDeliveryArgs(['--force']), /Usage/);
  const plan = planGithubDelivery({ branch: 'jakob/claude-a03-example', policy });
  assert.equal(plan.ref, 'refs/heads/jakob/claude-a03-example');
  assert.equal(plan.emergency, false);
  assert.equal(plan.pullRequest, 'gh pr create --repo Jakeminator123/scoutgaming --base main --head jakob/claude-a03-example');
  assert.equal(planGithubDelivery({ branch: 'main', adminMain: true, policy }).emergency, true);
  assert.equal(planGithubDelivery({ branch: 'main', adminMain: true, policy }).pullRequest, null);
  assert.throws(() => planGithubDelivery({ branch: 'main', policy }), /admin emergency/);
  assert.throws(() => planGithubDelivery({ branch: 'kevin', policy }), /not a delivery branch/);
  assert.throws(() => planGithubDelivery({ branch: 'jakob/claude-a03-example', adminMain: true, policy }), /only pushes main/);
  assert.throws(() => planGithubDelivery({ branch: 'jakob/example', policy: { ...policy, featureBranches: [] } }), /featureBranches/);
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
    'branch --show-current': 'jakob/claude-a03-example',
    'remote get-url --push --all origin': 'https://github.com/Jakeminator123/scoutgaming',
    'rev-parse HEAD': local,
    'ls-remote --heads https://github.com/Jakeminator123/scoutgaming refs/heads/jakob/claude-a03-example': '',
    [`push origin ${local}:refs/heads/jakob/claude-a03-example`]: '',
    'fetch --no-tags https://github.com/Jakeminator123/scoutgaming refs/heads/jakob/claude-a03-example:refs/remotes/origin/jakob/claude-a03-example': '',
    'rev-parse refs/remotes/origin/jakob/claude-a03-example': local,
    'config --get-all remote.origin.fetch': '+refs/heads/*:refs/remotes/origin/*',
    [`branch --set-upstream-to=origin/jakob/claude-a03-example jakob/claude-a03-example`]: '',
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
  assert.equal(logs.join('\n').includes('gh pr create --repo Jakeminator123/scoutgaming --base main --head jakob/claude-a03-example'), true);
  assert.equal(calls.some(call => call.split(' ')[0] === 'gh'), false);
});
test('delivery check does not push, and main requires the admin flag', () => {
  const local = sha('e');
  const checked = fakeGit({
    'branch --show-current': 'jakob/claude-example',
    'remote get-url --push --all origin': 'git@github.com:Jakeminator123/scoutgaming.git',
    'rev-parse HEAD': local,
    'ls-remote --heads git@github.com:Jakeminator123/scoutgaming.git refs/heads/jakob/claude-example': `${sha('d')}\trefs/heads/jakob/claude-example`,
    [`merge-base --is-ancestor ${sha('d')} ${local}`]: '',
  });
  const logs = [];
  deliver({ args: ['--check'], policy, git: checked.git, log: line => logs.push(line) });
  assert.equal(checked.calls.some(call => call.startsWith('push ')), false);
  assert.match(logs.at(-1), /gh pr create --repo Jakeminator123\/scoutgaming --base main --head jakob\/claude-example/);

  const blocked = fakeGit({ 'branch --show-current': 'main' });
  assert.throws(() => deliver({ args: [], policy, git: blocked.git, log() {} }), /admin emergency/);
  assert.equal(blocked.calls.some(call => call.startsWith('push ')), false);

  const emergency = fakeGit({
    'branch --show-current': 'main',
    'remote get-url --push --all origin': 'https://github.com/Jakeminator123/scoutgaming.git',
    'rev-parse HEAD': local,
    'ls-remote --heads https://github.com/Jakeminator123/scoutgaming.git refs/heads/main': '',
    [`push origin ${local}:refs/heads/main`]: '',
    'fetch --no-tags https://github.com/Jakeminator123/scoutgaming.git refs/heads/main:refs/remotes/origin/main': '',
    'rev-parse refs/remotes/origin/main': local,
    'config --get-all remote.origin.fetch': '+refs/heads/*:refs/remotes/origin/*',
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
    'branch --show-current': 'jakob/example',
    'remote get-url --push --all origin': 'https://github.com/someone/else.git',
  });
  assert.throws(() => deliver({ args: ['--check'], policy, git: wrong.git, log() {} }), /approved GitHub/);
});


test('delivery with a narrow fetch mapping creates only its own tracking branch and is repeatable', async t => {
  const temp = await mkdtemp(join(tmpdir(), 'croupier-delivery-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const repository = join(temp, 'work'), remote = join(temp, 'remote.git');
  const approved = 'https://github.com/Jakeminator123/scoutgaming.git';
  const env = { ...process.env };
  for (const name of Object.keys(env)) if (name.startsWith('GIT_')) delete env[name];
  const run = (cwd, args) => {
    const result = spawnSync('git', args, { cwd, env, encoding: 'utf8', timeout: 10000, windowsHide: true });
    assert.ifError(result.error);
    if (result.status !== 0) throw new Error(result.stderr.trim());
    return result.stdout.trim();
  };
  run(temp, ['init', '--bare', '--initial-branch=main', remote]);
  run(temp, ['init', '--initial-branch=main', repository]);
  const git = (...args) => run(repository, args);
  git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-m','Initial fixture');
  git('remote','add','origin',approved);
  git('config','remote.origin.fetch','+refs/heads/main:refs/remotes/origin/main');
  git('switch','-c','jakob/narrow-fetch');
  const local = git('rev-parse','HEAD'), logs = [], calls = [];
  const deliveryGit = (...args) => {
    calls.push(args);
    // Keep the actual Git protocol, refs and config local to this test. Only
    // network commands redirect the validated GitHub URL to the owned bare repo.
    return ['push','fetch','ls-remote'].includes(args[0])
      ? git('-c', `url.${remote.replaceAll('\\','/')}.insteadOf=${approved}`, ...args)
      : git(...args);
  };
  for (let attempt=0; attempt<2; attempt++) deliver({ policy, git:deliveryGit, log:line=>logs.push(line) });
  assert.equal(git('rev-parse','@{upstream}'),local);
  assert.equal(run(remote,['rev-parse','refs/heads/jakob/narrow-fetch']),local);
  assert.equal(git('config','branch.jakob/narrow-fetch.remote'),'origin');
  assert.equal(git('config','branch.jakob/narrow-fetch.merge'),'refs/heads/jakob/narrow-fetch');
  assert.deepEqual(git('config','--get-all','remote.origin.fetch').split(/\r?\n/),[
    '+refs/heads/main:refs/remotes/origin/main',
    '+refs/heads/jakob/narrow-fetch:refs/remotes/origin/jakob/narrow-fetch',
  ]);
  assert.equal(calls.filter(args=>args[0]==='remote'&&args[1]==='set-branches').length,1);
  assert.equal(logs.filter(line=>line===`GitHub verified: ${local}`).length,2);
  assert.equal(calls.some(args=>args.includes('--force')||args.includes('--force-with-lease')),false);
});

test('delivery never configures upstream or reports success when remote verification changes', () => {
  for (const stage of ['after-push','after-fetch']) {
    const calls=[], logs=[], local=sha('c'); let reads=0;
    const git=(...args)=>{
      calls.push(args);
      if(args[0]==='branch'&&args[1]==='--show-current')return 'jakob/verification';
      if(args[0]==='remote'&&args[1]==='get-url')return 'https://github.com/Jakeminator123/scoutgaming.git';
      if(args[0]==='rev-parse')return args[1]==='HEAD'?local:sha('d');
      if(args[0]==='ls-remote')return ++reads===1?'':stage==='after-push'?sha('d'):local;
      if(['push','fetch'].includes(args[0]))return '';
      throw Error('Unexpected command');
    };
    assert.throws(()=>deliver({policy,git,log:line=>logs.push(line)}),stage==='after-push'?/does not match/:/changed while fetching/);
    assert.equal(calls.some(args=>args[0]==='config'||args[1]==='set-branches'||args[1]?.startsWith('--set-upstream-to')),false);
    assert.equal(logs.some(line=>line.startsWith('GitHub verified:')),false);
  }
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

test('the required CI gate waits for every job in the PR workflow and runs even when one fails', async () => {
  const yaml = (await readFile(new URL('../.github/workflows/croupier.yml', import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
  const jobs = [...yaml.split('\njobs:\n')[1].matchAll(/^  ([a-z][a-z0-9-]*):\n/gm)].map(match => match[1]);
  assert.ok(jobs.includes('ci') && jobs.includes('dealer-regression'));
  const gate = yaml.split('\n  ci:\n')[1];
  // The ruleset requires the check named CI; a draft run renames the gate so that check stays missing.
  assert.match(gate, /^    name: \$\{\{ needs\.changes\.outputs\.draft == 'true' && 'CI \(utkast\)' \|\| 'CI' \}\}\n/);
  assert.match(gate, /\n    if: always\(\)\n/);
  const needs = gate.match(/\n    needs: \[([^\]]+)\]\n/)?.[1].split(',').map(name => name.trim());
  assert.deepEqual([...needs].sort(), jobs.filter(name => name !== 'ci').sort(), 'a job the gate does not need could fail without blocking a merge');
  assert.ok(jobs.includes('targeted'), 'draft PRs run the targeted job');
  const header = yaml.split('\njobs:\n')[0];
  assert.match(header, /\non:\n  push:\n    branches: \[main, preview\]\n  pull_request:\n    branches: \[main, preview\]\n    types: \[opened, synchronize, reopened, ready_for_review\]\n/, 'main and preview share the gate; ready_for_review starts the full run');
  assert.match(header, /\n  cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}\n/, 'only PR runs are replaced by a newer push');
});
