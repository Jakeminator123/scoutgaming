import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const text = path => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

test('partner HTML is generated from Markdown with intact operation cells and Copy-for-LLM text', t => {
  const parent = resolve(tmpdir());
  const fixture = mkdtempSync(join(parent, 'partner-docs-test-'));
  t.after(() => {
    assert.equal(dirname(fixture), parent);
    assert.ok(fixture.startsWith(join(parent, 'partner-docs-test-')));
    rmSync(fixture, { recursive: true, force: true });
  });
  mkdirSync(join(fixture, 'public', 'docs'), { recursive: true });
  copyFileSync(join(root, 'web', 'build-docs.py'), join(fixture, 'build-docs.py'));
  copyFileSync(join(root, 'web', 'public', 'docs', 'partner-api.md'), join(fixture, 'public', 'docs', 'partner-api.md'));
  const result = spawnSync(process.platform === 'win32' ? 'python' : 'python3', [join(fixture, 'build-docs.py')], { encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const html = text(join(fixture, 'public', 'docs', 'partner-api.html'));
  assert.equal(html, text(join(root, 'web', 'public', 'docs', 'partner-api.html')), 'regenerate with python web/build-docs.py');
  for (const operation of ['act', 'insurance']) {
    const row = html.match(new RegExp('<tr><td><code>' + operation + '</code><\\/td>(.*?)<\\/tr>', 's'))?.[0];
    assert.ok(row, operation);
    assert.equal((row.match(/<td>/g) ?? []).length, 3, operation);
    assert.doesNotMatch(row, /\\\|/);
    assert.match(row, operation === 'act' ? /&quot;hit&quot;\|&quot;stand&quot;\|&quot;double&quot;\|&quot;split&quot;/ : /true\|false/);
  }
  const copyText = JSON.parse(html.match(/const MD=(\[.*?\]);\n/s)[1]).join('\n');
  assert.equal(copyText, text(join(root, 'web', 'public', 'docs', 'partner-api.md')));
});
