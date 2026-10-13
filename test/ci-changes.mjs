import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ciScope, documentationOnly, parseDiff } from '../tools/ci-changes.mjs';

const change = (path, extra = {}) => ({ path, before: '100644', after: '100644', status: 'M', ...extra });
test('only ordinary prose qualifies; runtime, config, mixed changes and file types run full CI', () => {
  assert.equal(documentationOnly([change('docs/JOHN-HANDOFF.md'), change('lab/docs/TERMINOLOGI.md')]), true);
  for (const path of ['.github/workflows/croupier.yml', 'docs/environment-variables.json',
    'open-claw/lab/deploy/runtime-bundle/knowledge/croupier-model.md', 'web/public/docs/partner-api.md',
    'docs/../web/app.md', 'docs\\guide.md', '.githooks/pre-commit-full', 'lab/app/page.tsx']) {
    assert.equal(documentationOnly([change('README.md'), change(path)]), false, path);
  }
  for (const extra of [{after:'120000'}, {before:'120000'}, {after:'100755'}, {status:'T'}]) {
    assert.equal(documentationOnly([change('docs/example.md', extra)]), false);
  }
  assert.equal(documentationOnly([]), false);
  assert.equal(documentationOnly([change('docs/removed.md', {status:'D',after:'000000'})]), true);
});

test('NUL parser preserves unusual names and fails on truncated/rename records', () => {
  const record = `:100644 100644 ${'a'.repeat(40)} ${'b'.repeat(40)} M\0docs/åäö\ntext.md\0`;
  assert.equal(parseDiff(record)[0].path, 'docs/åäö\ntext.md');
  for (const raw of [record.slice(0,-1), 'M\0docs/a.md\0', record.replace(' M\0',' R100\0')]) assert.throws(() => parseDiff(raw));
});

test('real PR merge diff detects an earlier code commit even when the final commit is documentation', () => {
  const root = mkdtempSync(join(tmpdir(), 'croupier-ci-scope-'));
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM:'1', GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null' };
  for (const key of Object.keys(env)) if (/^GIT_(?:DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES)$/.test(key)) delete env[key];
  const git = (...args) => execFileSync('git', args, { cwd:root, env, encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  const put = (path,text) => writeFileSync(join(root,path),text);
  const commit = message => { git('add','.'); git('commit','-qm',message); };
  try {
    git('init','-q','-b','main'); git('config','user.name','CI fixture'); git('config','user.email','ci@example.invalid');
    git('config','core.hooksPath',join(root,'no-hooks'));
    mkdirSync(join(root,'docs')); put('README.md','base\n'); put('app.mjs','export const version = 1;\n'); commit('base');
    git('checkout','-qb','docs'); put('docs/guide.md','guide\n'); commit('docs');
    git('checkout','main'); put('app.mjs','export const version = 2;\n'); commit('main advanced');
    git('merge','--no-ff','docs','-m','test merge');
    const prEnv = () => ({ GITHUB_EVENT_NAME:'pull_request',GITHUB_REF:'refs/pull/1/merge',GITHUB_SHA:git('rev-parse','HEAD') });
    assert.equal(ciScope({cwd:root,env:prEnv()}),'documentation','main-only code is excluded');
    // Match the actual checkout depth, including both merge parents.
    const shallow = join(root,'shallow'); git('clone','-q','--depth=2',pathToFileURL(root).href,shallow);
    assert.equal(ciScope({cwd:shallow,env:prEnv()}),'documentation');
    rmSync(shallow,{recursive:true,force:true});
    git('checkout','-qb','code'); put('app.mjs','export const version = 3;\n'); commit('code');
    put('docs/guide.md','last push is just prose\n'); commit('docs followup');
    git('checkout','main'); git('merge','--no-ff','code','-m','test mixed merge');
    assert.equal(ciScope({cwd:root,env:prEnv()}),'full');
    assert.equal(ciScope({cwd:root,env:{...prEnv(),GITHUB_SHA:'0'.repeat(40)}}),'full');
    for (const event of ['push','workflow_dispatch']) assert.equal(ciScope({cwd:root,env:{GITHUB_EVENT_NAME:event}}),'full');
    git('checkout','-qb','rename'); git('mv','app.mjs','docs/renamed.md'); commit('move code under docs');
    git('checkout','main'); git('merge','--no-ff','rename','-m','test rename merge');
    assert.equal(ciScope({cwd:root,env:prEnv()}),'full','deleted runtime side of a rename must be checked');
  } finally { rmSync(root,{recursive:true,force:true}); }
});

test('final CI gate fails for missing, failed, cancelled or unexpectedly skipped work', () => {
  const yaml = readFileSync(new URL('../.github/workflows/croupier.yml',import.meta.url),'utf8');
  const script = yaml.split('// Final gate script\n')[1]?.split('          NODE')[0]
    .split('\n').filter(line=>line.trim()).map(line=>line.slice(10)).join('\n');
  assert.ok(script,'workflow must expose its actual gate script');
  const run = needs => spawnSync(process.execPath,['--input-type=module','-e',script],{
    encoding:'utf8',env:{...process.env,CI_NEEDS:JSON.stringify(needs)},
  }).status;
  const full = { changes:{result:'success',outputs:{scope:'full'}}, documentation:{result:'skipped'},
    'presentation-studio':{result:'success'},'dealer-regression':{result:'success'},'lipsync-worker':{result:'success'} };
  assert.equal(run(full),0);
  const docs = structuredClone(full); docs.changes.outputs.scope='documentation'; docs.documentation.result='success';
  for (const job of ['presentation-studio','dealer-regression','lipsync-worker']) docs[job].result='skipped';
  assert.equal(run(docs),0);
  for (const result of ['failure','cancelled','skipped']) {
    const broken=structuredClone(full); broken['dealer-regression'].result=result; assert.notEqual(run(broken),0);
    const missingDocs=structuredClone(docs); missingDocs.documentation.result=result; assert.notEqual(run(missingDocs),0);
  }
  for (const result of ['failure','cancelled','skipped']) {
    const broken=structuredClone(docs); broken.changes.result=result; assert.notEqual(run(broken),0);
  }
  assert.notEqual(run({}),0);
});
