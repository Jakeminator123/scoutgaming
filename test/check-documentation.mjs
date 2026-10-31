import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkDocumentation, anchors } from '../tools/check-documentation.mjs';
import { isolatedGitEnvironment } from '../tools/precommit-checks.mjs';

function check(source, targets = {}) {
  const content = { 'docs/guide.md': source, ...targets };
  const reads = [];
  const errors = checkDocumentation({ files: Object.keys(content), sources: ['docs/guide.md'], read: path => {
    reads.push(path);
    return content[path];
  } });
  return { errors, reads };
}

test('missing tracked targets and renamed headings report exact source line', () => {
  const { errors } = check('Intro\n[missing](lost.md)\n[renamed](other.md#old)', { 'docs/other.md': '# New' });
  assert.deepEqual(errors.map(error => [error.file, error.line, error.reason]), [
    ['docs/guide.md', 2, 'Target is not a tracked file or directory'],
    ['docs/guide.md', 3, 'Markdown heading or explicit id does not exist'],
  ]);
});

test('Unicode, inline code, duplicate headings, setext and explicit ids', () => {
  const source = '# Återställ `rum`!\n# Återställ `rum`!\n# Återställ rum-1\nNamnet\n===\n<a id="special.id"></a>';
  assert.deepEqual([...anchors(source)], ['återställ-rum', 'återställ-rum-1', 'återställ-rum-1-1', 'namnet', 'special.id']);
  assert.equal(check('[x](other.md#%C3%A5terst%C3%A4ll-rum-1)\n[x](other.md#special.id)', { 'docs/other.md': source }).errors.length, 0);
});

test('encoded and escaped paths, titles, references and tracked directories', () => {
  const source = '[x](my%20file.md#hello)\n[x](my\\ file.md "title")\n[x][target]\n[target]: <my file.md> "title"\n[short]\n[short]: my%20file.md\n[target][]\n[dir](sub/)\n[route](../apps/[[...path]]/route.ts)';
  assert.deepEqual(check(source, { 'docs/my file.md': '# Hello', 'docs/sub/one.txt': '', 'apps/[[...path]]/route.ts': '' }).errors, []);
});

test('comments, fenced and indented examples, inline code and external URLs are ignored', () => {
  const source = '<!-- [x](lost.md) -->\n```md\n[x](lost.md)\n```\n~~~\n[x](lost.md)\n~~~\n    [x](lost.md)\n`[x](lost.md)`\n[x](https://example.com)\n[x](mailto:x@example.com)\n[x](/admin)';
  assert.deepEqual(check(source).errors, []);
});

test('unsafe and private targets never cause reads, including encoded traversal', () => {
  const source = '[x](../../outside.md#x)\n[x](../arkiv/private.md#x)\n[x](../random-stuff-jakob/jakob-docs/arkiv/a.md#x)\n[x](../.env.local#x)\n[x](%2E%2E/%2E%2E/out.md#x)\n[x](bad%ZZ.md)\n[x](../.aws/private.md#x)';
  const result = check(source, { 'arkiv/private.md': '# x', '.env.local': 'secret', '.aws/private.md': '# x' });
  assert.equal(result.errors.length, 7);
  assert.deepEqual(result.reads, ['docs/guide.md']);
});

test('cached check reads the invoking index, never unstaged repairs or untracked targets', t => {
  const root = mkdtempSync(join(tmpdir(), 'documentation-check-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = isolatedGitEnvironment();
  const git = args => execFileSync('git', args, { cwd: root, env, encoding: 'utf8' });
  git(['init', '-q']);
  mkdirSync(join(root, 'docs'));
  writeFileSync(join(root, 'docs/guide.md'), '[bad](target.md#old)');
  writeFileSync(join(root, 'docs/target.md'), '# New');
  git(['add', '.']);
  const script = fileURLToPath(new URL('../tools/check-documentation.mjs', import.meta.url));
  const run = (args, selectedEnv = env) => spawnSync(process.execPath, [script, '--json', ...args], { cwd: root, env: selectedEnv, encoding: 'utf8' });
  writeFileSync(join(root, 'docs/target.md'), '# Old');
  assert.equal(run([]).status, 0);
  assert.equal(run(['--cached']).status, 1);
  const index = join(root, 'temporary-index');
  const alternateEnv = { ...env, GIT_INDEX_FILE: index };
  execFileSync('git', ['add', '.'], { cwd: root, env: alternateEnv });
  assert.equal(run(['--cached'], alternateEnv).status, 0);
  writeFileSync(join(root, 'docs/guide.md'), '[bad](untracked.md)');
  writeFileSync(join(root, 'docs/untracked.md'), '# Untracked');
  assert.equal(run([]).status, 1);
});
