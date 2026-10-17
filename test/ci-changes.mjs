import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ciScope, ciSelection, documentationOnly, parseDiff, migrationReadinessRequired } from '../tools/ci-changes.mjs';

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

test('client-only PRs avoid production reads; server, migration and uncertain changes retain readiness', () => {
  for (const path of ['lab/components/editor.tsx', 'apps/web/components/button.tsx',
    'lab/client/admin/lib/navigation.mjs', 'lab/test/editor.test.mjs', 'test/rooms.mjs']) {
    assert.equal(migrationReadinessRequired([change(path), change('docs/guide.md')]), false, path);
  }
  for (const path of ['ops/neon-studio/012-example.sql', 'lab/lib/studio-repository.mjs',
    'web/studio-repository.mjs', 'lab/app/api/rooms/route.ts', 'lab/package-lock.json',
    '.github/workflows/croupier.yml', 'unknown.mjs', 'lab/components/../lib/store.mjs']) {
    assert.equal(migrationReadinessRequired([change('lab/components/editor.tsx'), change(path)]), true, path);
  }
  assert.equal(migrationReadinessRequired([]), true);
  assert.equal(migrationReadinessRequired([change('lab/components/link.mjs', {after:'120000'})]), true);
  for (const event of ['push', 'workflow_dispatch']) {
    assert.deepEqual(ciSelection({env:{GITHUB_EVENT_NAME:event}}), {scope:'full',migration:true});
  }
});

test('client-directory dependencies, schemas and configuration cannot bypass migration readiness', () => {
  const sensitive = [
    'lab/client/package.json', 'lab/client/package-lock.json',
    'lab/client/pnpm-lock.yaml', 'lab/client/yarn.lock',
    'lab/client/bun.lockb', 'lab/client/.npmrc',
    'lab/client/tsconfig.json', 'lab/client/next.config.mjs',
    'lab/client/build.mjs', 'lab/client/.env.production',
    'lab/client/migrations/020-studio.sql', 'lab/client/admin/lib/studio.schema.json',
    'lab/client/admin/lib/schema.ts', 'lab/client/config/runtime.mjs',
    'lab/components/configuration.mjs', 'apps/web/components/schema.prisma',
  ];
  for (const path of sensitive) for (const extra of [
    {}, {status:'A', before:'000000'}, {status:'D', after:'000000'},
  ]) {
    assert.equal(migrationReadinessRequired([change('lab/client/admin/lib/navigation.mjs'), change(path, extra)]), true, path);
  }
  for (const path of ['lab/client/admin/components/editor.tsx',
    'lab/client/runtime/preview.css', 'lab/client/admin/lib/navigation.test.mjs',
    'lab/components/editor.tsx', 'apps/web/components/button.tsx',
    'test/fixtures/package.json', 'lab/test/fixtures/schema.sql']) {
    assert.equal(migrationReadinessRequired([change(path)]), false, path);
  }
});

test('CI uses one Studio discovery registry and retains blocking product checks', () => {
  const yaml = readFileSync(new URL('../.github/workflows/croupier.yml',import.meta.url),'utf8');
  const fullHook = readFileSync(new URL('../.githooks/pre-commit-full',import.meta.url),'utf8');
  const registered = fullHook.split('\n').filter(line => line.startsWith('run_node_tests '))
    .flatMap(line => line.trim().split(/\s+/).slice(3));
  for (const pattern of ['lab/test/*.test.mjs', 'lab/components/*.test.mjs']) {
    assert.equal(registered.filter(path => path === pattern).length, 1, `${pattern} runs once`);
  }
  const explicitStudio = registered.filter(path => /^lab\/(?:test|components)\/[^\s/*]+\.test\.mjs$/.test(path));
  assert.deepEqual(explicitStudio, []);
  assert.doesNotMatch(yaml, /npm --prefix lab test/);
  const suites = ['studio', 'admin', 'contracts', 'database', 'presentation', 'access', 'speech', 'gameplay'];
  const selected = [...yaml.matchAll(/run: sh \.githooks\/pre-commit-full ([a-z]+)/g)].map(match => match[1]);
  assert.deepEqual(selected, suites, 'CI must execute every full-regression suite exactly once');
  assert.match(yaml, /needs\.changes\.outputs\.migration == 'true'/);
  const steps = yaml.split('      - name: ');
  for (const step of steps.filter(step => /^Regression - /.test(step))) {
    assert.match(step, /if: \$\{\{ !cancelled\(\) \}\}/);
    assert.match(step, /timeout-minutes: 8/);
    assert.doesNotMatch(step, /continue-on-error: true/);
  }
  const isolated = steps.find(step => /^Existing isolated Studio SQL/.test(step));
  assert.match(isolated, /tools\/studio-isolated-qa\.mjs/);
  assert.doesNotMatch(isolated, /continue-on-error: true/);
  const timings = steps.find(step => /^Save regression group timings/.test(step));
  assert.match(timings, /if: always\(\)/);
  assert.match(timings, /continue-on-error: true/);
  assert.match(timings, /timeout-minutes: 2/);
  assert.match(yaml, /if: always\(\)[\s\S]*dealer-regression-timing\.jsonl/);
  assert.doesNotMatch(yaml, /system-map/);
  assert.doesNotMatch(fullHook, /system-map/);
  const push = readFileSync(new URL('../tools/check-push-target.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(push, /system-map/);
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
    git('checkout','-qb','ui'); mkdirSync(join(root,'lab','components'),{recursive:true});
    put('lab/components/editor.tsx','export const label = "Editor";\n'); commit('client-only edit');
    git('checkout','main'); git('merge','--no-ff','ui','-m','test UI merge');
    assert.deepEqual(ciSelection({cwd:root,env:prEnv()}),{scope:'full',migration:false});
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
  const yaml = readFileSync(new URL('../.github/workflows/croupier.yml',import.meta.url),'utf8').replaceAll('\r\n', '\n');
  const script = yaml.split('// Final gate script\n')[1]?.split('          NODE')[0]
    .split('\n').filter(line=>line.trim()).map(line=>line.slice(10)).join('\n');
  assert.ok(script,'workflow must expose its actual gate script');
  const run = needs => spawnSync(process.execPath,['--input-type=module','-e',script],{
    encoding:'utf8',env:{...process.env,CI_NEEDS:JSON.stringify(needs)},
  }).status;
  const full = { changes:{result:'success',outputs:{scope:'full'}}, documentation:{result:'skipped'},
    'dealer-regression':{result:'success'},'lipsync-worker':{result:'success'} };
  assert.equal(run(full),0);
  const docs = structuredClone(full); docs.changes.outputs.scope='documentation'; docs.documentation.result='success';
  for (const job of ['dealer-regression','lipsync-worker']) docs[job].result='skipped';
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
