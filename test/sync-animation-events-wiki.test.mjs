import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const TOOL = fileURLToPath(new URL('../tools/sync-animation-events-wiki.mjs', import.meta.url));
const ACTIVE = 'docs/animation-events/v5-7-days-mvp';
const FILES = ['README.md', 'CANVAS.md', 'DECISIONS.md', 'RUNTIME-EVIDENCE.md', 's00-helheten.md', 's01-kartan.md', 's02-spraket.md', 's03-eventtradet.md', 's04-saker-presentation.md', 's05-ordlista.md', 's06-plan.md'];

function fixture(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'croupier-wiki-sync-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const source = path.join(temporary, 'source');
  const wiki = path.join(temporary, 'wiki');
  fs.mkdirSync(path.join(source, ACTIVE), { recursive: true });
  fs.mkdirSync(wiki);
  fs.writeFileSync(path.join(source, 'docs/animation-events/README.md'), '# Nav\n\n[Aktiv](v5-7-days-mvp/README.md)\n');
  for (const name of FILES) fs.writeFileSync(path.join(source, ACTIVE, name), `# ${name}\r\n\r\n[Nästa](s06-plan.md#klart)\r\n[Guide](../../../lab/docs/README.md)\r\n\`[Kodexempel](s06-plan.md)\`\r\n`);
  fs.writeFileSync(path.join(wiki, 'home.md'), '# Bevara mig\n');
  const git = (root, ...args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true });
  assert.equal(git(source, 'init', '--quiet').status, 0);
  assert.equal(git(source, 'add', '.').status, 0);
  assert.equal(git(source, '-c', 'user.name=Wiki test', '-c', 'user.email=wiki@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'Fixture').status, 0);
  assert.equal(git(wiki, 'init', '--quiet').status, 0);
  const run = (...args) => spawnSync(process.execPath, [TOOL, '--source', source, '--wiki', wiki, ...args], { encoding: 'utf8', windowsHide: true });
  return { source, wiki, run };
}

test('publishes current Markdown and aliases without a website checkout or build', t => {
  const f = fixture(t);
  const result = f.run('--write');
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.sourceFiles, 12);
  assert.equal(report.checkedFiles, 38);
  assert.equal(fs.readFileSync(path.join(f.wiki, 'home.md'), 'utf8'), '# Bevara mig\n');
  const page = fs.readFileSync(path.join(f.wiki, 'animation-events/v5-7-days-mvp/README.md'), 'utf8');
  assert.match(page, /wikis\/animation-events\/v5-7-days-mvp\/s06-plan#klart/);
  assert.match(page, /-\/blob\/[a-f0-9]{40}\/lab\/docs\/README\.md/);
  assert.match(page, /`\[Kodexempel\]\(s06-plan\.md\)`/);
  const alias = fs.readFileSync(path.join(f.wiki, 'animation-events/v5-8-days-mvp/README.md'), 'utf8');
  assert.match(alias, /Flyttad: V5 · sju arbetsdagar/);
  assert.ok(fs.existsSync(path.join(f.wiki, 'animation-events/SYNC-MANIFEST.md')));
  assert.equal(f.run().status, 0);
});

test('read-only mode reports drift and does not touch the wiki', t => {
  const f = fixture(t);
  const before = fs.readFileSync(path.join(f.wiki, 'home.md'), 'utf8');
  const result = f.run();
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).status, 'drift');
  assert.equal(fs.readFileSync(path.join(f.wiki, 'home.md'), 'utf8'), before);
  assert.equal(fs.existsSync(path.join(f.wiki, 'animation-events.md')), false);
});

test('changed canonical text is detected after a successful sync', t => {
  const f = fixture(t);
  assert.equal(f.run('--write').status, 0);
  fs.appendFileSync(path.join(f.source, ACTIVE, 's00-helheten.md'), '\nNy status.\n');
  const result = f.run();
  assert.equal(result.status, 1);
  const drift = JSON.parse(result.stdout).drift;
  assert.ok(drift.includes('animation-events/v5-7-days-mvp/s00-helheten.md'));
  assert.ok(drift.includes('animation-events/SYNC-MANIFEST.md'));
});

test('an unrelated repository commit does not invalidate the published source revision', t => {
  const f = fixture(t);
  const initial = f.run('--write');
  assert.equal(initial.status, 0, initial.stderr);
  const publishedCommit = JSON.parse(initial.stdout).sourceCommit;
  fs.writeFileSync(path.join(f.source, 'UNRELATED.md'), '# Not published\n');
  const git = (...args) => spawnSync('git', ['-C', f.source, ...args], { encoding: 'utf8', windowsHide: true });
  assert.equal(git('add', 'UNRELATED.md').status, 0);
  assert.equal(git('-c', 'user.name=Wiki test', '-c', 'user.email=wiki@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'Unrelated').status, 0);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).sourceCommit, publishedCommit);
});

test('write requires a separate Git wiki worktree', t => {
  const f = fixture(t);
  const noGit = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-no-git-'));
  t.after(() => fs.rmSync(noGit, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [TOOL, '--source', f.source, '--wiki', noGit, '--write'], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /expected an existing Git worktree root/);
  const same = spawnSync(process.execPath, [TOOL, '--source', f.source, '--wiki', f.source, '--write'], { encoding: 'utf8', windowsHide: true });
  assert.equal(same.status, 1);
  assert.match(same.stderr, /separate repository root/);
});
