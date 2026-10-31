import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ALLOWLIST, MAX_DOC_BYTES, MAX_FILE_BYTES, allowlistErrors, checkRepoLimits, inspectChanges, inspectPush, inspectTree, lineCount, parseArgs,
} from '../tools/check-repo-limits.mjs';

const entry = (path, maxBytes, reason = 'fixture') => ({ path, maxBytes, reason });
const big = MAX_FILE_BYTES + 10;
const errorsFor = (files, allowlist = [], complete = false) => checkRepoLimits({ files, allowlist, complete }).join('\n');

test('files over 1 MB need an exact, shrinking allowlist entry', () => {
  assert.equal(errorsFor([{ path: 'a.bin', bytes: big }], [entry('a.bin', big)], true), '');
  assert.match(errorsFor([{ path: 'tools/data.json', bytes: big }]), /tools\/data\.json: 1\.00 MB, över gränsen 1 MB och utan undantag\. Dela upp filen/);
  assert.match(errorsFor([{ path: 'apps/web/public/hero.png', bytes: big }]), /Lägg mediet i Blob via Admin; Git lagrar inte media/);
  assert.match(errorsFor([{ path: 'a.bin', bytes: big + 1 }], [entry('a.bin', big)]), /a\.bin: växer från \d+ till \d+ byte/);
  assert.match(errorsFor([{ path: 'a.bin', bytes: big - 1 }], [entry('a.bin', big)]), /har krympt till \d+ byte; sänk maxBytes/);
  assert.match(errorsFor([{ path: 'a.bin', bytes: 10 }], [entry('a.bin', big)]), /under gränsen 1 MB; ta bort posten/);
  assert.match(errorsFor([{ path: 'a.bin', bytes: null }], [entry('a.bin', big)]), /a\.bin: finns inte längre; ta bort posten/);
  assert.match(errorsFor([], [entry('a.bin', big)], true), /a\.bin: finns inte i trädet; ta bort posten/);
  assert.equal(errorsFor([], [entry('a.bin', big)], false), '', 'a partial diff only judges the entries it inspected');
  assert.equal(errorsFor([{ path: 'small.bin', bytes: MAX_FILE_BYTES }]), '', 'exactly 1 MB is allowed');
});

test('allowlist must be sorted, unique, exact and above the limit', () => {
  assert.deepEqual(allowlistErrors([entry('a', big), entry('b', big)]), []);
  assert.match(allowlistErrors([entry('b', big), entry('a', big)]).join('\n'), /sorterade/);
  assert.match(allowlistErrors([entry('a', big), entry('a', big)]).join('\n'), /bara finnas en gång/);
  assert.match(allowlistErrors([entry('a', MAX_FILE_BYTES)]).join('\n'), /inte är över gränsen/);
  for (const bad of [{ path: 'a', maxBytes: big }, { ...entry('a', big), extra: 1 }, entry('a', '2000000'), entry('a', big, ' '), entry('../a', big), entry('/a', big), null])
    assert.match(allowlistErrors([bad]).join('\n'), /post 0 ska ha exakt path, maxBytes/);
  assert.match(allowlistErrors({}).join('\n'), /ska vara en lista/);
});

test('media binaries: no additions, no growth, moves and shrinking allowed', () => {
  assert.match(errorsFor([{ path: 'media/dealers/x/clip.png', bytes: 100, added: true }]), /ny binär under media\/\. Lägg mediet i Blob via Admin; Git lagrar inte media\./);
  assert.match(errorsFor([{ path: 'media/x/data.bin', bytes: 100, added: true, binary: true }]), /ny binär under media/);
  for (const ext of ['jpg', 'JPEG', 'webp', 'gif', 'mp4', 'mov', 'webm', 'wav', 'mp3', 'm4a', 'ogg', 'flac'])
    assert.match(errorsFor([{ path: `media/x/a.${ext}`, bytes: 1, added: true }]), /ny binär/, ext);
  assert.equal(errorsFor([{ path: 'media/layout.json', bytes: 100, added: true }]), '', 'text under media/ is not media');
  assert.equal(errorsFor([{ path: 'media/x/clip.mp4', bytes: 100, added: true, moved: true }]), '', 'an existing blob may move');
  assert.match(errorsFor([{ path: 'media/x/clip.mp4', bytes: 101, baseBytes: 100 }]), /växer från 100 till 101 byte/);
  assert.equal(errorsFor([{ path: 'media/x/clip.mp4', bytes: 99, baseBytes: 100 }]), '');
  assert.equal(errorsFor([{ path: 'apps/web/public/new.png', bytes: 100, added: true, binary: true }]), '', 'the media rule is limited to media/');
});

test('living documents have a line and size limit, with no history folder exempt', () => {
  assert.equal(lineCount(''), 0); assert.equal(lineCount('a\nb\n'), 2); assert.equal(lineCount('a\nb'), 2);
  assert.equal(errorsFor([{ path: 'docs/NEXT-AGENT.md', bytes: 10, lines: 150 }]), '');
  assert.match(errorsFor([{ path: 'docs/NEXT-AGENT.md', bytes: 10, lines: 151 }]), /151 rader, över taket 150\. Radera avklarat; Git har det/);
  assert.match(errorsFor([{ path: 'docs/plans/BIG.md', bytes: MAX_DOC_BYTES + 1 }]), /över taket 100 kB för levande dokument\. Radera äldre avsnitt; Git har dem/);
  assert.match(errorsFor([{ path: 'docs/history/OLD.md', bytes: MAX_DOC_BYTES * 3 }]), /över taket 100 kB/);
});

test('arguments accept only the documented modes', () => {
  assert.deepEqual(parseArgs([]), { tree: 'HEAD' });
  assert.deepEqual(parseArgs(['--cached']), { cached: true });
  assert.deepEqual(parseArgs(['--push', 'origin', 'https://github.com/fixture/repo.git']), { push: true, remote: 'https://github.com/fixture/repo.git' });
  assert.deepEqual(parseArgs(['--tree', 'HEAD', '--changed-since', 'HEAD^1']), { tree: 'HEAD', since: 'HEAD^1' });
  for (const bad of [['--tree'], ['--tree', '--cached'], ['--cached', '--tree', 'HEAD'], ['--tree', 'HEAD', '--changed-since'], ['x']]) assert.equal(parseArgs(bad), null);
});

function repository(run) {
  const root = mkdtempSync(join(tmpdir(), 'repo-limits-'));
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null' };
  for (const key of Object.keys(env)) if (/^GIT_(?:DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|PREFIX)$/.test(key)) delete env[key];
  const git = (...args) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const put = (path, content) => { mkdirSync(join(root, ...path.split('/').slice(0, -1)), { recursive: true }); writeFileSync(join(root, path), content); };
  const commit = message => { git('add', '-A'); git('commit', '-qm', message); return git('rev-parse', 'HEAD'); };
  const saved = Object.fromEntries(['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE'].map(name => [name, process.env[name]]));
  for (const name of Object.keys(saved)) delete process.env[name];
  try {
    git('init', '-q', '-b', 'main'); git('config', 'user.name', 'CI fixture'); git('config', 'user.email', 'ci@example.invalid');
    git('config', 'core.hooksPath', join(root, 'no-hooks')); git('config', 'core.autocrlf', 'false');
    run({ root, git, put, commit, env });
  } finally {
    for (const [name, value] of Object.entries(saved)) if (value !== undefined) process.env[name] = value;
    rmSync(root, { recursive: true, force: true });
  }
}

const binary = bytes => { const data = Buffer.alloc(bytes, 7); data[0] = 0; return data; };
const check = result => checkRepoLimits(result).join('\n');

test('Git modes: whole tree, staged index and a sparse commit diff all read objects, not the file system', () => {
  repository(({ root, git, put, commit, env }) => {
    put('media/old.mp4', binary(2000)); put('assets/big.bin', binary(big)); put('docs/NEXT-AGENT.md', 'a\n'.repeat(150));
    put(ALLOWLIST, JSON.stringify([entry('assets/big.bin', big)]));
    // A copy of the guard, so the CLI below judges this fixture (it always checks its own repository).
    put('tools/check-repo-limits.mjs', readFileSync(new URL('../tools/check-repo-limits.mjs', import.meta.url)));
    const base = commit('base');
    assert.equal(check(inspectTree({ cwd: root })), '');

    // Staged: a 2 MB file and a new media image are stopped; unstaged edits are not part of the commit.
    put('tmp/two-mb.bin', binary(2 * MAX_FILE_BYTES)); put('media/new.png', binary(50));
    git('add', 'tmp/two-mb.bin', 'media/new.png');
    put('docs/NEXT-AGENT.md', 'a\n'.repeat(200));
    const staged = check(inspectChanges({ cwd: root }));
    assert.match(staged, /tmp\/two-mb\.bin: 2\.00 MB, över gränsen 1 MB/);
    assert.match(staged, /media\/new\.png: ny binär under media\//);
    assert.doesNotMatch(staged, /NEXT-AGENT/);
    git('add', 'docs/NEXT-AGENT.md');
    assert.match(check(inspectChanges({ cwd: root })), /NEXT-AGENT\.md: 200 rader/);
    git('reset', '-q');
    put('docs/NEXT-AGENT.md', 'a\n'.repeat(150)); rmSync(join(root, 'tmp'), { recursive: true }); rmSync(join(root, 'media', 'new.png'));

    // The CLI exits non-zero with the Swedish explanation, and passes a clean index.
    const cli = () => spawnSync(process.execPath, ['tools/check-repo-limits.mjs', '--cached'], { cwd: root, env, encoding: 'utf8' });
    assert.equal(cli().status, 0, cli().stderr);
    put('media/new.webm', binary(10)); git('add', 'media/new.webm');
    const refused = cli();
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /media\/new\.webm: ny binär under media\/\. Lägg mediet i Blob via Admin; Git lagrar inte media\.\r?\n/);
    assert.equal(spawnSync(process.execPath, ['tools/check-repo-limits.mjs', '--tree'], { cwd: root, env, encoding: 'utf8' }).status, 2);
    git('reset', '-q'); rmSync(join(root, 'media', 'new.webm'));

    // Moves keep media; growth and stale entries are caught in the diff.
    mkdirSync(join(root, 'media', 'moved')); git('mv', 'media/old.mp4', 'media/moved/old.mp4');
    assert.equal(check(inspectChanges({ cwd: root })), '');
    commit('move');
    put('media/moved/old.mp4', binary(2001)); put('assets/big.bin', binary(big + 5));
    git('add', '-A');
    const grown = check(inspectChanges({ cwd: root }));
    assert.match(grown, /media\/moved\/old\.mp4: binären under media\/ växer från 2000 till 2001 byte/);
    assert.match(grown, /assets\/big\.bin: växer från/);
    git('reset', '-q', '--hard');

    // An allowlist edit is checked even when its file is not in the diff.
    put(ALLOWLIST, JSON.stringify([entry('assets/big.bin', big + 100)]));
    git('add', '-A');
    assert.match(check(inspectChanges({ cwd: root })), /assets\/big\.bin: har krympt till \d+ byte; sänk maxBytes/);
    put(ALLOWLIST, '[]'); git('add', '-A');
    assert.match(check(inspectChanges({ cwd: root })), /assets\/big\.bin: 1\.00 MB, över gränsen 1 MB och utan undantag/);
    git('reset', '-q', '--hard');

    // CI: a sparse checkout without the changed files still sees the merge diff.
    git('checkout', '-qb', 'feature'); put('media/added.jpg', binary(20)); put('docs/plans/BIG.md', 'x'.repeat(MAX_DOC_BYTES + 1)); commit('feature');
    git('checkout', '-q', 'main'); git('merge', '-q', '--no-ff', 'feature', '-m', 'fixture merge');
    git('sparse-checkout', 'set', '--no-cone', `/${ALLOWLIST}`);
    assert.throws(() => readFileSync(join(root, 'media', 'added.jpg')), { code: 'ENOENT' });
    const ci = check(inspectChanges({ cwd: root, tree: 'HEAD', base: 'HEAD^1' }));
    assert.match(ci, /media\/added\.jpg: ny binär under media\//);
    assert.match(ci, /docs\/plans\/BIG\.md: 101 kB, över taket 100 kB/);
    assert.doesNotMatch(ci, /assets\/big\.bin/, 'unchanged allowlisted files are not fetched or judged');
    assert.equal(check(inspectChanges({ cwd: root, tree: 'HEAD^1', base: base })), '', 'the move-only range is clean');
    assert.match(check(inspectTree({ cwd: root, tree: 'HEAD' })), /BIG\.md/);
  });
});

test('the classifier job runs the guard on the merge diff with its files in the sparse checkout', () => {
  const yaml = readFileSync(new URL('../.github/workflows/croupier.yml', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  const changes = yaml.split('  changes:\n')[1]?.split('  documentation:\n')[0];
  assert.ok(changes);
  const sparse = changes.match(/sparse-checkout: \|\n((?:            [^\n]+\n)+)/)?.[1].split('\n').map(line => line.trim());
  for (const file of ['tools/check-repo-limits.mjs', ALLOWLIST, 'test/check-repo-limits.mjs']) assert.ok(sparse.includes(file), file);
  assert.match(changes, /node --test test\/check-repo-limits\.mjs\n\s+node tools\/check-repo-limits\.mjs --tree HEAD --changed-since HEAD\^1/);
  const hook = readFileSync(new URL('../.githooks/pre-commit-full', import.meta.url), 'utf8');
  assert.match(hook, /^run_check contracts repo-limits \d+ node tools\/check-repo-limits\.mjs$/m);
  assert.match(hook, /^run_node_tests contracts precommit-checks .*test\/check-repo-limits\.mjs/m);
  // The committed allowlist itself is well-formed (sizes are judged by the Git modes above).
  assert.deepEqual(allowlistErrors(JSON.parse(readFileSync(new URL('../' + ALLOWLIST, import.meta.url), 'utf8'))), []);
});


const zeroOid = '0'.repeat(40);
const pushLine = (head, base, name = 'one', local = `refs/heads/jakob/${name}`) => `${local} ${head} refs/heads/jakob/${name} ${base}\n`;
const pushCheck = (root, head, base, remote) => inspectPush({ cwd: root, updates: pushLine(head, base), remote });
const pushErrors = result => result.errors.join('\n');
const localRemote = ({ root, git }) => {
  const remote = join(root, '.git', 'fixture-remote.git');
  git('init', '-q', '--bare', remote);
  git('push', '-q', remote, 'main');
  return remote;
};

test('pre-push sees an oversized add then delete, and accepts ordinary small commits', () => {
  repository(({ root, put, commit }) => {
    put(ALLOWLIST, '[]'); const base = commit('base');
    put('small.txt', 'small'); const small = commit('small');
    assert.deepEqual(pushCheck(root, small, base).errors, []);
    put('assets/transient.bin', binary(big)); const middle = commit('large intermediate object');
    rmSync(join(root, 'assets', 'transient.bin')); const head = commit('delete large file');
    assert.equal(check(inspectChanges({ cwd: root, tree: head, base })), '', 'a final-tree diff misses the deleted blob');
    const result = pushCheck(root, head, base);
    assert.equal(result.commits, 3);
    assert.match(pushErrors(result), new RegExp(middle));
    assert.match(pushErrors(result), /assets\/transient\.bin: 1\.00 MB, över gränsen/);
  });
});

test('pre-push follows merge parents and ignores local replace objects hiding a large commit', () => {
  repository(({ root, git, put, commit }) => {
    put(ALLOWLIST, '[]'); const base = commit('base');
    git('checkout', '-qb', 'side'); put('side.bin', binary(big)); const middle = commit('large side commit');
    rmSync(join(root, 'side.bin')); commit('delete on side');
    git('checkout', '-q', 'main'); put('small.txt', 'small'); commit('main change');
    git('merge', '-q', '--no-ff', 'side', '-m', 'merge side'); const head = git('rev-parse', 'HEAD');
    assert.match(pushErrors(pushCheck(root, head, base)), /side\.bin: 1\.00 MB/);
    const replacement = git('commit-tree', `${base}^{tree}`, '-p', base, '-m', 'hide large tree');
    git('replace', middle, replacement);
    assert.match(pushErrors(pushCheck(root, head, base)), /side\.bin: 1\.00 MB/, 'a local replacement cannot hide objects that Git will push');
  });
});

test('pre-push checks all ref updates and refuses malformed or unavailable bases', () => {
  repository(({ root, put, commit }) => {
    put(ALLOWLIST, '[]'); const base = commit('base');
    put('small.txt', 'small'); const small = commit('small');
    put('second.bin', binary(big)); const large = commit('large on second ref');
    const result = inspectPush({ cwd: root, updates: pushLine(small, base) + pushLine(large, small, 'two') });
    assert.equal(result.refs, 2);
    assert.match(pushErrors(result), /second\.bin: 1\.00 MB/);
    assert.throws(() => pushCheck(root, small, '1'.repeat(40)), /saknade basen/);
    assert.throws(() => inspectPush({ cwd: root, updates: 'incomplete' }), /ogiltiga pushreferenser/);
    assert.equal(inspectPush({ cwd: root, updates: pushLine(zeroOid, base) }).commits, 0, 'deletion is left to the ownership guard');
  });
});

test('first push uses advertised reachable main, without scanning its old oversized history', () => {
  repository(fixture => {
    const { root, git, put, commit } = fixture;
    // An intentionally unallowlisted OLD blob is outside the new-object range.
    put('old.bin', binary(big)); put(ALLOWLIST, '[]'); commit('old history');
    rmSync(join(root, 'old.bin')); commit('remote main');
    const remote = localRemote(fixture);
    put('small.txt', 'new small'); const small = commit('first feature push');
    assert.deepEqual(pushCheck(root, small, zeroOid, remote).errors, []);
    assert.throws(() => pushCheck(root, small, zeroOid), /verifierbar fjärrbas/);
    put('new.bin', binary(big)); commit('new intermediate large blob');
    rmSync(join(root, 'new.bin')); const head = commit('delete new blob');
    assert.match(pushErrors(pushCheck(root, head, zeroOid, remote)), /new\.bin: 1\.00 MB/);
    git('update-ref', 'refs/remotes/origin/main', small);
    // A stale tracking ref cannot stand in for an unavailable advertised main.
    const other = join(root, '.git', 'other');
    git('init', '-q', '-b', 'main', other);
    git('-C', other, 'config', 'user.name', 'fixture'); git('-C', other, 'config', 'user.email', 'fixture@example.invalid');
    git('-C', other, 'config', 'core.hooksPath', join(other, 'no-hooks'));
    git('-C', other, 'commit', '-q', '--allow-empty', '-m', 'unrelated remote');
    assert.throws(() => pushCheck(root, head, zeroOid, other), /saknade basen/);
  });
});

test('shallow history and missing new objects stop the push instead of skipping unseen commits', () => {
  repository(fixture => {
    const { root, git, put, commit, env } = fixture;
    put(ALLOWLIST, '[]'); const base = commit('base');
    put('small.txt', 'small'); const head = commit('head');
    const remote = localRemote(fixture), shallow = join(root, '.git', 'shallow-fixture');
    execFileSync('git', ['clone', '-q', '--branch', 'main', '--depth', '1', pathToFileURL(remote).href, shallow], { env, stdio: 'pipe' });
    assert.throws(() => pushCheck(shallow, head, zeroOid, remote), /shallow-historik/);
    const blob = git('rev-parse', `${head}:small.txt`);
    rmSync(join(root, '.git', 'objects', blob.slice(0, 2), blob.slice(2)));
    assert.throws(() => pushCheck(root, head, base), /metadata|objektlista/);
  });
});

test('partial-clone-style missing old media is not read to check a new small commit', () => {
  repository(({ root, git, put, commit }) => {
    put('old.bin', binary(big)); put(ALLOWLIST, JSON.stringify([entry('old.bin', big)])); const base = commit('base');
    const oldBlob = git('rev-parse', `${base}:old.bin`);
    put('small.txt', 'small'); const head = commit('small');
    rmSync(join(root, '.git', 'objects', oldBlob.slice(0, 2), oldBlob.slice(2)));
    assert.deepEqual(pushCheck(root, head, base).errors, []);
  });
});

test('pre-push preserves persistent exact allowances and rejects transient or stale allowances', () => {
  repository(({ root, put, commit }) => {
    put(ALLOWLIST, '[]'); const base = commit('base');
    put('large.bin', binary(big)); put(ALLOWLIST, JSON.stringify([entry('large.bin', big)])); const allowed = commit('explicit exception');
    assert.deepEqual(pushCheck(root, allowed, base).errors, [], 'a visible exact exception remains reviewable');
    put('small.txt', 'small'); const small = commit('small');
    assert.deepEqual(pushCheck(root, small, allowed).errors, [], 'existing allowances remain valid');
    put(ALLOWLIST, JSON.stringify([entry('large.bin', big + 1)])); const stale = commit('stale allowance');
    assert.match(pushErrors(pushCheck(root, stale, allowed)), /har krympt/);
    rmSync(join(root, 'large.bin')); put(ALLOWLIST, '[]'); const hidden = commit('hide exception and file');
    assert.match(pushErrors(pushCheck(root, hidden, base)), /Tillfälliga undantag/);
  });
  repository(({ root, put, commit }) => {
    put('large.bin', binary(big)); put(ALLOWLIST, JSON.stringify([entry('large.bin', big)])); const base = commit('base');
    put(ALLOWLIST, '[]'); commit('remove allowance while retaining blob');
    put(ALLOWLIST, JSON.stringify([entry('large.bin', big)])); const head = commit('restore allowance');
    assert.match(pushErrors(pushCheck(root, head, base)), /large\.bin: 1\.00 MB, över gränsen/);
  });
});

// The classifier uses a sparse checkout; load only these two named current hook
// sources from HEAD if they are absent on disk. Never inspect historical content.
function hookSource(path) {
  try { return readFileSync(new URL('../' + path, import.meta.url)); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return execFileSync('git', ['show', `HEAD:${path}`], { cwd: new URL('..', import.meta.url), stdio: ['ignore', 'pipe', 'pipe'] });
  }
}

test('real pre-push hook feeds both guards the full batch and retains ownership refusal', () => {
  repository(({ root, git, put, commit, env }) => {
    put('tools/check-repo-limits.mjs', readFileSync(new URL('../tools/check-repo-limits.mjs', import.meta.url)));
    put('tools/check-push-target.mjs', hookSource('tools/check-push-target.mjs'));
    put('tools/repository-policy.json', JSON.stringify({ repository: 'fixture/repo', branch: 'main', featureBranches: ['jakob/*'], protectedBranches: ['kevin*'] }));
    put(ALLOWLIST, '[]'); const base = commit('base');
    put('small.txt', 'small'); const small = commit('small');
    put('large.bin', binary(big)); const large = commit('large');
    const hook = join(root, '.git', 'fixture-pre-push'); writeFileSync(hook, hookSource('.githooks/pre-push'));
    const shell = process.platform === 'win32' ? join(git('--exec-path'), '..', '..', '..', 'bin', 'sh.exe') : 'sh';
    const run = input => spawnSync(shell, [hook, 'origin', 'https://github.com/fixture/repo.git'], { cwd: root, env, input, encoding: 'utf8' });
    const clean = run(pushLine(small, base) + pushLine(small, base, 'two'));
    assert.equal(clean.status, 0, clean.stderr || clean.error?.message);
    assert.match(clean.stdout, /2 referenser kontrollerade/);
    const refused = run(pushLine(small, base) + pushLine(large, small, 'two'));
    assert.equal(refused.status, 1, refused.stderr);
    assert.match(refused.stderr, /large\.bin: 1\.00 MB/);
    const foreign = run(pushLine(small, base, 'one', 'refs/heads/kevin-test'));
    assert.equal(foreign.status, 1);
    assert.match(foreign.stderr, /protected branch/);
    assert.doesNotMatch(foreign.stdout, /Pushgränser/);
  });
});
