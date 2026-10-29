import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { ciScope, ciSelection, ciOutputs, documentationOnly, parseDiff, migrationReadinessRequired, movingWorkerRequired,
  gatewayContainerRequired, openClawDeployOnly, scopeOf, regressionLegs, draftPullRequest, REGRESSION_LEGS, SCOPE_LEGS, LIPSYNC_LEG,
  BROWSER_MODES, BROWSER_CLIENT_PREFIXES, browserAcceptanceRequired } from '../tools/ci-changes.mjs';

const change = (path, extra = {}) => ({ path, before: '100644', after: '100644', status: 'M', ...extra });
// Nightly/manual/preview selection: the complete product, never a draft; Chrome is required.
const complete = Object.freeze({ scope: 'full', migration: true, moving: true, gateway: true, draft: false, browser: 'required' });
// Push main: integration checks only; the PR's own ready CI ran the regression.
const integration = Object.freeze({ scope: 'integration', migration: true, moving: false, gateway: true, draft: false, browser: 'none' });
const DEPLOY_LEGS = ['studio-admin-contracts', 'access-presentation'];

test('scope matrix: documentation, integration, openclaw-deploy and full select legs; shared paths and uncertain input stay full', () => {
  assert.deepEqual(SCOPE_LEGS.full, REGRESSION_LEGS.map(({ leg }) => leg));
  assert.deepEqual(SCOPE_LEGS.documentation, []);
  assert.deepEqual(SCOPE_LEGS.integration, [], 'push main runs no regression leg');
  assert.deepEqual(BROWSER_MODES, ['required', 'advisory', 'none']);
  // deploy/ is read only by the access and contracts suites; their legs also carry studio and presentation.
  assert.deepEqual(SCOPE_LEGS['openclaw-deploy'], DEPLOY_LEGS);
  for (const leg of DEPLOY_LEGS) assert.ok(REGRESSION_LEGS.some(item => item.leg === leg), leg);
  assert.ok(REGRESSION_LEGS.find(({ leg }) => leg === DEPLOY_LEGS[0]).suites.split(' ').includes('contracts'));
  assert.ok(REGRESSION_LEGS.find(({ leg }) => leg === DEPLOY_LEGS[1]).suites.split(' ').includes('access'));
  assert.ok(SCOPE_LEGS.full.includes(LIPSYNC_LEG));
  for (const path of ['services/openclaw/lab/deploy/Dockerfile.gateway', 'services/openclaw/lab/deploy/gateway-config.mjs',
    'services/openclaw/lab/deploy/runtime-bundle/roles/croupier-speech.md', 'services/openclaw/lab/deploy/container/gateway-container.test.mjs']) {
    for (const extra of [{}, {status:'A', before:'000000'}, {status:'D', after:'000000'}]) {
      assert.equal(openClawDeployOnly([change(path, extra)]), true, path);
      assert.equal(scopeOf([change(path, extra)]), 'openclaw-deploy', path);
      assert.equal(gatewayContainerRequired([change(path, extra)]), true, path);
    }
  }
  assert.deepEqual(regressionLegs('openclaw-deploy').map(({ leg }) => leg), DEPLOY_LEGS);
  assert.deepEqual(regressionLegs('full'), [...REGRESSION_LEGS]);
  assert.deepEqual(regressionLegs('documentation'), []);
  assert.deepEqual(regressionLegs('integration'), []);
  assert.deepEqual(regressionLegs('unknown'), [...REGRESSION_LEGS], 'an unknown scope runs everything');
  // lab/src is copied into Postgres fixtures and imported by Studio tests; shared roots and plumbing run everything.
  for (const path of ['services/openclaw/lab/src/server.mjs', 'services/openclaw/lab/package.json', 'services/openclaw/README.md',
    'packages/director/openclaw.mjs', 'test/fixtures/copy-openclaw-runtime.mjs', '.githooks/pre-commit-full', 'tools/ci-changes.mjs',
    'services/openclaw/lab/deploy/../src/server.mjs', 'services/openclaw/lab/deploy\\x.mjs']) {
    assert.equal(openClawDeployOnly([change('services/openclaw/lab/deploy/start-gateway.mjs'), change(path)]), false, path);
    assert.equal(scopeOf([change('services/openclaw/lab/deploy/start-gateway.mjs'), change(path)]), 'full', path);
  }
  for (const extra of [{after:'120000'}, {before:'120000'}, {after:'100755'}, {status:'T'}]) {
    assert.equal(openClawDeployOnly([change('services/openclaw/lab/deploy/start-gateway.mjs', extra)]), false);
  }
  assert.equal(openClawDeployOnly([]), false);
  assert.equal(scopeOf([change('docs/guide.md')]), 'documentation');
  assert.equal(scopeOf([change('docs/guide.md'), change('services/openclaw/lab/deploy/start-gateway.mjs')]), 'full', 'mixed prose and deploy stays full');
});

test('the Gateway container builds only when its image inputs, the hook registry or CI plumbing change', () => {
  for (const path of ['services/openclaw/lab/deploy/runtime-bundle/knowledge/croupier-model.md', 'services/openclaw/lab/Dockerfile.dockerignore',
    'services/openclaw/lab/package.json', '.github/workflows/croupier.yml', '.github/actions/setup-ffmpeg/action.yml', '.githooks/pre-commit-full',
    'tools/regression-group.mjs', '../unknown', 'docs\\guide.md']) {
    for (const extra of [{}, {status:'D', after:'000000'}]) assert.equal(gatewayContainerRequired([change('README.md'), change(path, extra)]), true, path);
  }
  for (const path of ['services/openclaw/lab/src/server.mjs', 'services/openclaw/lab/test/server.test.mjs', 'services/game/server.mjs',
    'packages/director/openclaw.mjs', 'apps/studio/app/page.tsx', 'docs/NEXT-AGENT.md', 'tools/ci-changes.mjs', 'test/backup-render-state.mjs']) {
    assert.equal(gatewayContainerRequired([change(path)]), false, path);
  }
  assert.equal(gatewayContainerRequired([]), true);
});

test('draft detection reads only the pull_request payload and treats anything unreadable as ready', () => {
  const root = mkdtempSync(join(tmpdir(), 'croupier-ci-draft-'));
  try {
    const eventPath = join(root, 'event.json');
    const env = (payload, extra = {}) => { writeFileSync(eventPath, payload); return { GITHUB_EVENT_NAME: 'pull_request', GITHUB_EVENT_PATH: eventPath, ...extra }; };
    assert.equal(draftPullRequest({ env: env(JSON.stringify({ pull_request: { draft: true } })) }), true);
    assert.equal(draftPullRequest({ env: env(JSON.stringify({ pull_request: { draft: false } })) }), false);
    for (const payload of ['not JSON', '{}', JSON.stringify({ pull_request: { draft: 'true' } }), JSON.stringify({ pull_request: {} })]) {
      assert.equal(draftPullRequest({ env: env(payload) }), false, payload);
    }
    assert.equal(draftPullRequest({ env: env(JSON.stringify({ pull_request: { draft: true } }), { GITHUB_EVENT_NAME: 'push' }) }), false, 'push payloads are not drafts');
    assert.equal(draftPullRequest({ env: { GITHUB_EVENT_NAME: 'pull_request', GITHUB_EVENT_PATH: join(root, 'absent') } }), false);
    assert.equal(draftPullRequest({ env: { GITHUB_EVENT_NAME: 'pull_request' } }), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('workflow outputs carry the leg list and a fromJSON matrix for every scope', () => {
  const outputs = ciOutputs({ ...complete });
  assert.deepEqual(Object.keys(outputs), ['scope', 'migration', 'moving', 'gateway', 'draft', 'browser', 'legs', 'matrix']);
  assert.deepEqual(JSON.parse(outputs.legs), SCOPE_LEGS.full);
  assert.deepEqual(JSON.parse(outputs.matrix), { include: [...REGRESSION_LEGS] });
  assert.equal(outputs.browser, 'required');
  for (const value of Object.values(outputs)) assert.doesNotMatch(value, /\n/, 'GITHUB_OUTPUT lines are single-line');
  const deploy = ciOutputs({ scope: 'openclaw-deploy', migration: true, moving: false, gateway: true, draft: false, browser: 'none' });
  assert.deepEqual(JSON.parse(deploy.legs), DEPLOY_LEGS);
  assert.deepEqual(JSON.parse(deploy.matrix).include.map(({ leg }) => leg), DEPLOY_LEGS);
  assert.deepEqual(deploy, { ...deploy, migration: 'true', moving: 'false', gateway: 'true', draft: 'false', browser: 'none' });
  const docs = ciOutputs({ scope: 'documentation', migration: false, moving: false, gateway: false, draft: true, browser: 'none' });
  assert.equal(docs.legs, '[]');
  assert.equal(docs.draft, 'true');
  const main = ciOutputs({ ...integration, gateway: false });
  assert.deepEqual(main, { scope: 'integration', migration: 'true', moving: 'false', gateway: 'false', draft: 'false', browser: 'none', legs: '[]', matrix: '{"include":[]}' });
  const yaml = readFileSync(new URL('../.github/workflows/croupier.yml', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  const changes = yaml.split('  changes:\n')[1]?.split('  documentation:\n')[0];
  for (const key of Object.keys(outputs)) assert.ok(changes.includes(`      ${key}: $` + `{{ steps.scope.outputs.${key} }}`), `changes exports ${key}`);
});
test('only ordinary prose qualifies; runtime, config, mixed changes and file types run full CI', () => {
  assert.equal(documentationOnly([change('docs/history/JOHN-HANDOFF-2026-10.md'), change('apps/studio/docs/TERMINOLOGI.md')]), true);
  for (const path of ['.github/workflows/croupier.yml', 'docs/environment-variables.json',
    'services/openclaw/lab/deploy/runtime-bundle/knowledge/croupier-model.md', 'services/game/public/docs/partner-api.md',
    'docs/../web/app.md', 'docs\\guide.md', '.githooks/pre-commit-full', 'apps/studio/app/page.tsx']) {
    assert.equal(documentationOnly([change('README.md'), change(path)]), false, path);
  }
  for (const extra of [{after:'120000'}, {before:'120000'}, {after:'100755'}, {status:'T'}]) {
    assert.equal(documentationOnly([change('docs/example.md', extra)]), false);
  }
  assert.equal(documentationOnly([]), false);
  assert.equal(documentationOnly([change('docs/removed.md', {status:'D',after:'000000'})]), true);
});

test('Chrome acceptance is required for browser client changes, including deletion and uncertain paths', () => {
  assert.deepEqual(BROWSER_CLIENT_PREFIXES, ['services/game/public/', 'apps/studio/client/']);
  for (const path of ['services/game/public/js/table.js', 'services/game/public/index.html', 'services/game/public/css/game.css',
    'apps/studio/client/admin/router.tsx', 'apps/studio/client/package.json', 'apps/studio/client/build.mjs', '../unknown', 'a//b', '']) {
    for (const extra of [{}, {status:'D',after:'000000'}]) {
      assert.equal(browserAcceptanceRequired([change(path, extra)]), true, path);
      assert.equal(browserAcceptanceRequired([change('services/game/server.mjs'), change(path, extra)]), true, 'mixed with ' + path);
    }
  }
  // Server, Next pages and other Studio code keep Chrome advisory; so do look-alike prefixes.
  for (const path of ['services/game/server.mjs', 'services/game/publication.mjs', 'services/game/public-api.mjs',
    'apps/studio/components/editor.tsx', 'apps/studio/clients/x.mjs', 'apps/studio/lib/store.mjs', 'apps/web/app/page.tsx',
    'test/card-view.mjs', '.github/workflows/croupier.yml', 'tools/ci-changes.mjs', 'docs/NEXT-AGENT.md']) {
    assert.equal(browserAcceptanceRequired([change(path)]), false, path);
  }
  assert.equal(browserAcceptanceRequired([]), true);
});

test('Moving image verification follows worker and its workflow changes, including deletion and uncertain paths', () => {
  for (const path of ['services/moving-gpu-worker/serverless.py', 'services/moving-gpu-worker/Dockerfile',
    'services/moving-gpu-worker/tests/test_bank_http.py', '.github/workflows/moving-gpu-build.yml', '../unknown']) {
    for (const extra of [{}, {status:'D',after:'000000'}]) {
      assert.equal(movingWorkerRequired([change(path, extra)]), true, path);
    }
  }
  // CI plumbing edits do not rebuild the GPU image; Actions validates the workflow_call.
  for (const path of ['.github/workflows/croupier.yml', 'tools/ci-changes.mjs', '.githooks/pre-commit-full',
    'docs/NEXT-AGENT.md', 'apps/studio/components/editor.tsx', 'test/rooms.mjs']) {
    assert.equal(movingWorkerRequired([change(path)]), false, path);
  }
  assert.equal(movingWorkerRequired([]), true);
});

test('local and CI prose selection share reviewed guides and prose folders while other Markdown and JSON stay strict', async () => {
  const { verificationMode, focusedTests } = await import('../tools/precommit-checks.mjs');
  for (const path of ['apps/web/README.md', 'apps/studio/AGENTS.md', 'apps/studio/docs/new-guide.md',
    'ops/cloud/CONTAINER-CONTEXT.md',
    'migrering/MASTERPLAN.md', 'migrering/STATUS.md', 'migrering/status.json',
    'migrering/jakob-main-migrering/AKTIVITETER.md', 'migrering/kevin-ks-migrering/AKTIVITETER.md',
    'migrering/kevin-ks-migrering/K05/MAPPNINGSSYSTEM.md', 'migrering/SAMARBETE-OCH-ATKOMST.md', 'migrering/new-runtime.md',
    'START-HERE.md', 'inbox/README.md', 'ops/cloud/README.md', 'ops/cloud/RENDER-V3.md',
    'docs/2026-10-27-j08-staging-acceptance.md']) {
    assert.equal(documentationOnly([change(path)]), true, path);
    assert.equal(migrationReadinessRequired([change(path)]), false, path);
    assert.equal(verificationMode([change(path)], { env: {} }), 'documentation', path);
  }
  for (const path of ['packages/presentation/docs/runtime.md', 'services/game/public/docs/partner-api.md',
    'services/openclaw/lab/deploy/runtime-bundle/README.md', 'docs/config.json', 'docs/../runtime.md',
    'migrering/status.mjs', 'migrering/config.json', 'ops/cloud/config.mjs', 'ops/cloud/deploy/README.md', 'inbox/people.json',
    'docs/history/run.mjs', 'docs/history/receipt.sh', 'docs/2026-10-27-receipt.json', 'docs/2026-10-19-note.txt']) {
    assert.equal(documentationOnly([change(path)]), false, path);
    assert.equal(verificationMode([change(path)], { env: {} }), 'focused', path);
  }
  assert.ok(focusedTests([change('tools/documentation-paths.mjs')]).includes('test/ci-changes.mjs'));
  assert.ok(focusedTests([change('tools/documentation-paths.mjs')]).includes('test/precommit-checks.mjs'));
});


test('local, documentation CI and full regression execute migration validation once and reject invalid or stale reports', async () => {
  const { checkPlan, runChecks } = await import('../tools/precommit-checks.mjs');
  const root = mkdtempSync(join(tmpdir(), 'croupier-migration-check-'));
  try {
    for (const directory of ['migrering', '.githooks', 'test']) mkdirSync(join(root, directory));
    for (const path of ['migrering/status.mjs', 'migrering/status.json', 'migrering/STATUS.md', '.githooks/pre-commit-full']) {
      writeFileSync(join(root, path), readFileSync(new URL('../' + path, import.meta.url)));
    }
    const validData = readFileSync(join(root, 'migrering/status.json'), 'utf8');
    const validReport = readFileSync(join(root, 'migrering/STATUS.md'), 'utf8');
    const paths = ['migrering/status.json', 'migrering/STATUS.md', 'migrering/status.mjs'];
    for (const path of paths) for (const status of ['A', 'M', 'D']) {
      const commands = checkPlan('focused', { root, changes: [change(path, { status })] });
      assert.equal(commands.filter(command => command[1] === 'migrering/status.mjs' && command[2] === '--check').length, 1);
    }
    const changes = paths.slice(0, 2).map(path => change(path));
    const local = checkPlan('documentation', { root, changes });
    assert.equal(local.filter(command => command[1] === 'migrering/status.mjs').length, 1);
    assert.equal(checkPlan('documentation', { root, changes: [change('docs/guide.md')] })
      .some(command => command.includes('migrering/status.mjs')), false, 'unrelated local prose needs no status check');
    const yaml = readFileSync(new URL('../.github/workflows/croupier.yml', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
    const job = yaml.split('\n  documentation:\n')[1]?.split('\n  dealer-regression:')[0];
    const body = job?.match(/\n        run: \|\n((?:          .*(?:\n|$))+)/)?.[1]
      .split('\n').map(line => line.slice(10)).join('\n');
    assert.ok(body, 'execute the actual documentation check block');
    // Keep unrelated suites isolated, but execute the real validator from the
    // actual CI block and shell registry, including normal shell failure rules.
    const wrapper = ['set -eu', 'node() {',
      '  if [ "$1" = tools/regression-group.mjs ]; then',
      '    shift 3; if [ "$1" != node ]; then return 0; fi; shift', '  fi',
      '  if [ "$1" = migrering/status.mjs ]; then',
      '    printf "check\\n" >> "$MIGRATION_TEST_LOG"',
      '    "$MIGRATION_TEST_NODE" "$@"', '  fi', '}', 'git() { :; }', ''].join('\n');
    const log = join(root, 'checks.log');
    const shell = script => {
      writeFileSync(log, '');
      const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash';
      const result = spawnSync(bash, ['-c', wrapper + script], { cwd: root, encoding: 'utf8',
        env: { ...process.env, MIGRATION_TEST_NODE: process.execPath, MIGRATION_TEST_LOG: log } });
      assert.ifError(result.error);
      assert.equal(readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).length, 1, 'validator must execute exactly once');
      return result;
    };
    const full = checkPlan('full', { root, changes: [...changes, change('services/game/server.mjs')] });
    assert.equal(full.length, 1);
    const fullScript = full[0].slice(1).join(' ');
    for (const state of ['valid', 'invalid', 'stale']) {
      const data = JSON.parse(validData);
      if (state === 'invalid') data.activities[0].weight = 4;
      writeFileSync(join(root, 'migrering/status.json'), JSON.stringify(data));
      writeFileSync(join(root, 'migrering/STATUS.md'), state === 'stale' ? 'outdated report\n' : validReport);
      let calls = 0, diagnostics = '';
      const localCode = runChecks(local, { cwd: root, run(command, args, options) {
        if (command === 'git') return { status: 0 };
        if (args[0] === 'migrering/status.mjs') calls++;
        const result = spawnSync(command, args, { ...options, stdio: 'pipe', encoding: 'utf8' });
        diagnostics += result.stderr || ''; return result;
      } });
      assert.equal(calls, 1);
      assert.equal(localCode === 0, state === 'valid', diagnostics);
      for (const script of [body, 'set -- contracts\n. ./' + fullScript, 'set --\n. ./' + fullScript]) {
        const result = shell(script);
        assert.equal(result.status === 0, state === 'valid', result.stderr);
        if (state !== 'valid') assert.match(result.stderr, state === 'invalid' ? /Ogiltig etapp\/status\/vikt/ : /STATUS.md är inaktuell/);
      }
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('NUL parser preserves unusual names and fails on truncated/rename records', () => {
  const record = `:100644 100644 ${'a'.repeat(40)} ${'b'.repeat(40)} M\0docs/åäö\ntext.md\0`;
  assert.equal(parseDiff(record)[0].path, 'docs/åäö\ntext.md');
  for (const raw of [record.slice(0,-1), 'M\0docs/a.md\0', record.replace(' M\0',' R100\0')]) assert.throws(() => parseDiff(raw));
});

test('client-only PRs avoid production reads; server, migration and uncertain changes retain readiness', () => {
  for (const path of ['apps/studio/components/editor.tsx', 'apps/web/components/button.tsx',
    'apps/studio/client/admin/lib/navigation.mjs', 'apps/studio/test/editor.test.mjs', 'test/rooms.mjs']) {
    assert.equal(migrationReadinessRequired([change(path), change('docs/guide.md')]), false, path);
  }
  for (const path of ['ops/neon-studio/012-example.sql', 'apps/studio/lib/studio-repository.mjs',
    'services/game/studio-repository.mjs', 'apps/studio/app/api/rooms/route.ts', 'apps/studio/package-lock.json',
    '.github/workflows/croupier.yml', 'unknown.mjs', 'apps/studio/components/../lib/store.mjs']) {
    assert.equal(migrationReadinessRequired([change('apps/studio/components/editor.tsx'), change(path)]), true, path);
  }
  assert.equal(migrationReadinessRequired([]), true);
  assert.equal(migrationReadinessRequired([change('apps/studio/components/link.mjs', {after:'120000'})]), true);
  for (const event of ['push', 'workflow_dispatch', 'schedule']) {
    assert.deepEqual(ciSelection({env:{GITHUB_EVENT_NAME:event}}), complete);
  }
});

test('client-directory dependencies, schemas and configuration cannot bypass migration readiness', () => {
  const sensitive = [
    'apps/studio/client/package.json', 'apps/studio/client/package-lock.json',
    'apps/studio/client/pnpm-lock.yaml', 'apps/studio/client/yarn.lock',
    'apps/studio/client/bun.lockb', 'apps/studio/client/.npmrc',
    'apps/studio/client/tsconfig.json', 'apps/studio/client/next.config.mjs',
    'apps/studio/client/build.mjs', 'apps/studio/client/.env.production',
    'apps/studio/client/migrations/020-studio.sql', 'apps/studio/client/admin/lib/studio.schema.json',
    'apps/studio/client/admin/lib/schema.ts', 'apps/studio/client/config/runtime.mjs',
    'apps/studio/components/configuration.mjs', 'apps/web/components/schema.prisma',
  ];
  for (const path of sensitive) for (const extra of [
    {}, {status:'A', before:'000000'}, {status:'D', after:'000000'},
  ]) {
    assert.equal(migrationReadinessRequired([change('apps/studio/client/admin/lib/navigation.mjs'), change(path, extra)]), true, path);
  }
  for (const path of ['apps/studio/client/admin/components/editor.tsx',
    'apps/studio/client/runtime/preview.css', 'apps/studio/client/admin/lib/navigation.test.mjs',
    'apps/studio/components/editor.tsx', 'apps/web/components/button.tsx',
    'test/fixtures/package.json', 'apps/studio/test/fixtures/schema.sql']) {
    assert.equal(migrationReadinessRequired([change(path)]), false, path);
  }
});

test('CI runs every full-regression suite exactly once across its parallel legs and keeps blocking product checks', () => {
  const yaml = readFileSync(new URL('../.github/workflows/croupier.yml',import.meta.url),'utf8').replaceAll('\r\n', '\n');
  const fullHook = readFileSync(new URL('../.githooks/pre-commit-full',import.meta.url),'utf8');
  const registered = fullHook.split('\n').filter(line => line.startsWith('run_node_tests '))
    .flatMap(line => line.trim().split(/\s+/).slice(3));
  for (const pattern of ['apps/studio/test/*.test.mjs', 'apps/studio/components/*.test.mjs']) {
    assert.equal(registered.filter(path => path === pattern).length, 1, `${pattern} runs once`);
  }
  const explicitStudio = registered.filter(path => /^apps\/studio\/(?:test|components)\/[^\s/*]+\.test\.mjs$/.test(path));
  assert.deepEqual(explicitStudio, []);
  assert.doesNotMatch(yaml, /npm --prefix apps\/studio test/);
  // The hook's own suite list is the registry; CI may neither drop nor repeat a suite.
  const hookSuites = fullHook.match(/^  all\|([a-z|]+)\) ;;$/m)?.[1].split('|');
  assert.ok(hookSuites?.includes('engine') && hookSuites.includes('container'));
  const dealer = yaml.split('\n  dealer-regression:\n')[1]?.split('\n  browser-regression:\n')[0];
  assert.ok(dealer, 'the regression job must exist');
  const browser = yaml.split('\n  browser-regression:\n')[1]?.split('\n  gateway-container:\n')[0];
  assert.ok(browser, 'the Chrome acceptance job must exist');
  assert.match(dealer, /strategy:\n      fail-fast: false\n      matrix: \$\{\{ fromJSON\(needs\.changes\.outputs\.matrix\) \}\}\n/, 'one failing leg must not cancel the others; the classifier selects the legs');
  assert.match(dealer, /\n    if: needs\.changes\.outputs\.draft != 'true' && needs\.changes\.outputs\.legs != '\[\]'\n/, 'drafts and leg-less scopes run no regression leg');
  // The leg table is the classifier's; each leg names its suites and boolean step selectors.
  const legs = REGRESSION_LEGS.map(({ leg, suites, ...flags }) => ({ leg, suites: suites.split(' ').filter(Boolean),
    flags: Object.entries(flags).filter(([, value]) => value === true).map(([name]) => name) }));
  assert.ok(legs.length >= 2, 'regression runs in parallel legs');
  // Each leg pays the toolchain setup once, so the leg count stays small; every leg runs suites.
  assert.ok(legs.length <= 4, 'at most four regression legs');
  for (const { leg, suites } of legs) assert.ok(suites.length > 0, `${leg} runs at least one suite`);
  assert.equal(new Set(legs.map(({ leg }) => leg)).size, legs.length);
  for (const { leg, flags } of legs) {
    assert.match(leg, /^[a-z][a-z0-9-]*$/);
    for (const flag of flags) assert.ok(dealer.includes(`matrix.${flag}`), `${leg}: selector ${flag} is read by a step`);
  }
  for (const selector of [...new Set(dealer.match(/matrix\.([a-z_]+)/g))].map(name => name.slice('matrix.'.length))) {
    assert.ok(['leg', 'suites'].includes(selector) || legs.some(({ flags }) => flags.includes(selector)), `step selector ${selector} exists in a leg`);
  }
  const matrixSuites = legs.flatMap(leg => leg.suites);
  const container = yaml.split('\n  gateway-container:\n')[1]?.split('\n  migration-readiness:\n')[0];
  assert.match(container, /run: sh \.githooks\/pre-commit-full container\n/);
  // engine skips without PostgreSQL; CI runs exactly its list through the TLS harness.
  assert.deepEqual([...matrixSuites, 'container', 'engine'].sort(), [...hookSuites].sort(), 'every suite runs exactly once');
  assert.equal(new Set(matrixSuites).size, matrixSuites.length);
  assert.match(fullHook, /^run_node_tests engine engine-http test\//m);
  const suitesStep = dealer.split('      - name: Regression suites\n')[1]?.split('\n      - name: ')[0];
  assert.match(suitesStep, /sh \.githooks\/pre-commit-full "\$suite" \|\| failed=1/);
  assert.match(suitesStep, /exit "\$failed"/);
  const steps = dealer.split('      - name: ');
  const postgresLeg = legs.filter(leg => leg.flags.includes('postgres'));
  assert.equal(postgresLeg.length, 1, 'one leg owns the isolated PostgreSQL acceptance');
  for (const name of ['Existing isolated Studio SQL', 'Real engine over HTTP on isolated PostgreSQL']) {
    const step = steps.find(step => step.startsWith(name));
    assert.match(step, /if: \$\{\{ !cancelled\(\) && matrix\.postgres \}\}/, name);
  }
  assert.match(steps.find(step => step.startsWith('Existing isolated Studio SQL')), /tools\/studio-isolated-qa\.mjs/);
  assert.match(steps.find(step => step.startsWith('Real engine over HTTP')), /node tools\/regression-group\.mjs engine\/http-postgres \d+ node tools\/run-engine-qa\.mjs/);
  // One job runs every browser test; its own if is the classifier's browser mode, and its steps never skip.
  assert.doesNotMatch(dealer, /CROUPIER_BROWSER_FIXTURE_MODULE=/, 'the regression legs leave the browser fixture unset');
  assert.match(browser, /^    name: Regression \(browser\)\n    needs: changes\n    if: needs\.changes\.outputs\.draft != 'true' && needs\.changes\.outputs\.browser != 'none'\n/);
  const browserSteps = browser.split('      - name: ');
  const chrome = browserSteps.find(step => step.startsWith('Real browser acceptance'));
  assert.match(chrome, /git grep -l -F -e process\.env\.CROUPIER_BROWSER_FIXTURE_MODULE /, 'discovery matches files that read the variable, not files that mention it');
  assert.match(chrome, /CROUPIER_BROWSER_FIXTURE_CHANNEL=chrome/);
  assert.match(chrome, /node tools\/regression-group\.mjs browser\/chrome \d+ node --test /);
  assert.doesNotMatch(browser.split('\n    steps:\n')[1], /^\s+if: (?!always\(\))/m, 'browser steps run whenever the job runs');
  assert.equal(legs.filter(leg => leg.flags.includes('build')).length, 1, 'the real Studio build runs once');
  // Every job that runs suites installs the toolchain once: ffmpeg and the package trees from the shared cache.
  for (const [name, job] of [['dealer-regression', dealer], ['browser-regression', browser],
    ['targeted', yaml.split('\n  targeted:\n')[1]?.split('\n  dealer-regression:\n')[0]]]) {
    assert.equal(job.match(/uses: \.\/\.github\/actions\/setup-ffmpeg/g)?.length, 1, `${name}: ffmpeg once`);
    assert.equal(job.match(/uses: \.\/\.github\/actions\/install-dependencies/g)?.length, 1, `${name}: package trees once`);
    assert.doesNotMatch(job, /npm --prefix \S+ ci|pnpm --dir apps\/web install|pnpm\/action-setup/, `${name}: no second install outside the shared action`);
  }
  // Each soft step is a timing receipt or main's cache upkeep; checks themselves never fail softly.
  const soft = yaml.split('\n      - ').filter(step => /\n\s+continue-on-error: true/.test(step));
  assert.equal(yaml.match(/continue-on-error:/g)?.length, soft.length);
  assert.deepEqual(soft.map(step => step.split('\n')[0]), ['name: Keep the shared package-tree cache current on main',
    'name: Save regression group timings', 'name: Save regression group timings'], 'only the timing receipts and cache upkeep may fail softly');
  const upkeep = soft[0];
  assert.match(upkeep, /\n\s+if: needs\.changes\.outputs\.scope == 'integration'\n/, 'cache upkeep runs on push main only');
  assert.match(upkeep, /uses: \.\/\.github\/actions\/install-dependencies\n\s+with:\n\s+warm: 'true'/);
  // The SQLite ban exempts documentation, so a documentation-only PR cannot violate it; the full regression runs it.
  assert.match(fullHook, /^run_check contracts no-sqlite \d+ node tools\/check-no-sqlite\.mjs$/m);
  const timings = steps.find(step => /^Save regression group timings/.test(step));
  assert.match(timings, /if: always\(\)/);
  assert.match(timings, /continue-on-error: true/);
  assert.match(timings, /name: dealer-regression-timing-\$\{\{ matrix\.leg \}\}-/, 'each leg keeps its own timing receipt');
  assert.match(browserSteps.find(step => /^Save regression group timings/.test(step)), /name: dealer-regression-timing-browser-/);
  assert.match(yaml, /if: always\(\)[\s\S]*dealer-regression-timing\.jsonl/);
  assert.doesNotMatch(yaml, /system-map/);
  assert.doesNotMatch(fullHook, /system-map/);
  const push = readFileSync(new URL('../tools/check-push-target.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(push, /system-map/);
});

test('the shared package-tree cache is keyed on every installed lockfile and manifest and saves only a clean install', () => {
  const action = readFileSync(new URL('../.github/actions/install-dependencies/action.yml', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  const installs = [...action.matchAll(/npm --prefix (\S+) ci\b/g)].map(match => ({ dir: match[1], lock: 'package-lock.json' }))
    .concat([...action.matchAll(/pnpm --dir (\S+) install --frozen-lockfile/g)].map(match => ({ dir: match[1], lock: 'pnpm-lock.yaml' })));
  assert.deepEqual(installs.map(({ dir }) => dir).sort(), ['apps/speech', 'apps/studio', 'apps/studio/client', 'apps/web',
    'services/astrid-gpu-worker/gateway', 'services/game']);
  const key = action.match(/\n        key: (.+)\n/)?.[1];
  assert.match(key, /runner\.os.*runner\.arch.*steps\.node\.outputs\.abi.*hashFiles\(/, 'OS, architecture and Node ABI are part of the key');
  const hashed = [...key.matchAll(/'([^']+)'/g)].map(match => match[1]);
  const paths = action.split('path: |\n').slice(1).map(block => block.split('\n').filter(line => /^ {10}\S/.test(line)).map(line => line.trim()));
  assert.equal(paths.length, 2);
  assert.deepEqual(paths[0], paths[1], 'restore and save cover the same trees');
  for (const { dir, lock } of installs) {
    for (const file of [`${dir}/${lock}`, `${dir}/package.json`]) assert.ok(hashed.includes(file), `key hashes ${file}`);
    assert.ok(paths[0].includes(`${dir}/node_modules`), `cache holds ${dir}/node_modules`);
  }
  assert.doesNotMatch(action, /restore-keys/, 'only an exact key skips the install');
  const steps = action.split('\n    - ').slice(1);
  const installSteps = steps.filter(step => /npm --prefix|pnpm\/action-setup|pnpm --dir|actions\/cache\/save/.test(step));
  assert.equal(installSteps.length, 4, 'npm trees, pnpm setup, pnpm tree, save');
  for (const step of installSteps) {
    assert.match(step, /\n\s+if: steps\.cache\.outputs\.cache-hit != 'true'\n/, 'install and save run only on a miss');
  }
  assert.match(action, /lookup-only: \$\{\{ inputs\.warm == 'true' \}\}/);
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
    git('checkout','-qb','migration-docs');
    mkdirSync(join(root,'migrering','jakob-main-migrering'),{recursive:true}); mkdirSync(join(root,'docs','history'));
    for (const path of ['docs/history/JOHN-HANDOFF-2026-10.md','docs/NEXT-AGENT.md','migrering/MASTERPLAN.md',
      'migrering/STATUS.md','migrering/jakob-main-migrering/AKTIVITETER.md']) put(path,'reviewed report\n');
    put('migrering/status.json','{}\n'); commit('six migration report files');
    git('checkout','main'); git('merge','--no-ff','migration-docs','-m','test report merge');
    assert.deepEqual(ciSelection({cwd:root,env:prEnv()}),{scope:'documentation',migration:false,moving:false,gateway:false,draft:false,browser:'none'});
    // The draft flag comes from the event payload; a draft never changes the scope itself.
    const eventPath=join(root,'.git','pr-event.json');
    writeFileSync(eventPath,JSON.stringify({pull_request:{draft:true}}));
    assert.deepEqual(ciSelection({cwd:root,env:{...prEnv(),GITHUB_EVENT_PATH:eventPath}}),{scope:'documentation',migration:false,moving:false,gateway:false,draft:true,browser:'none'});
    git('checkout','-qb','ui'); mkdirSync(join(root,'apps', 'studio','components'),{recursive:true});
    put('apps/studio/components/editor.tsx','export const label = "Editor";\n'); commit('client-only edit');
    git('checkout','main'); git('merge','--no-ff','ui','-m','test UI merge');
    // A ready full-scope PR runs Chrome as advisory; a draft runs none.
    assert.deepEqual(ciSelection({cwd:root,env:prEnv()}),{scope:'full',migration:false,moving:false,gateway:false,draft:false,browser:'advisory'});
    assert.deepEqual(ciSelection({cwd:root,env:{...prEnv(),GITHUB_EVENT_PATH:eventPath}}),{scope:'full',migration:false,moving:false,gateway:false,draft:true,browser:'none'});
    // Browser client code makes Chrome required on a ready PR; a draft still runs none.
    for (const [branch, path] of [['admin-client','apps/studio/client/admin/router.tsx'],['game-client','services/game/public/js/table.js']]) {
      git('checkout','-qb',branch); mkdirSync(join(root,...path.split('/').slice(0,-1)),{recursive:true});
      put(path,'export const view = 1;\n'); commit(branch+' edit');
      git('checkout','main'); git('merge','--no-ff',branch,'-m','test '+branch+' merge');
      const ready = ciSelection({cwd:root,env:prEnv()});
      assert.equal(ready.scope,'full',path); assert.equal(ready.draft,false); assert.equal(ready.browser,'required',path);
      assert.equal(ciSelection({cwd:root,env:{...prEnv(),GITHUB_EVENT_PATH:eventPath}}).browser,'none','a draft runs no Chrome: '+path);
    }
    git('checkout','-qb','deploy'); mkdirSync(join(root,'services','openclaw','lab','deploy'),{recursive:true});
    put('services/openclaw/lab/deploy/start-gateway.mjs','export const gateway = 1;\n'); commit('gateway deploy edit');
    git('checkout','main'); git('merge','--no-ff','deploy','-m','test deploy merge');
    assert.deepEqual(ciSelection({cwd:root,env:prEnv()}),{scope:'openclaw-deploy',migration:true,moving:false,gateway:true,draft:false,browser:'none'});
    git('checkout','-qb','moving'); mkdirSync(join(root,'services','moving-gpu-worker'),{recursive:true});
    put('services/moving-gpu-worker/serverless.py','fixture = True\n'); commit('worker edit');
    git('checkout','main'); git('merge','--no-ff','moving','-m','test worker merge');
    assert.equal(ciSelection({cwd:root,env:prEnv()}).moving,true);
    git('checkout','-qb','code'); put('app.mjs','export const version = 3;\n'); commit('code');
    put('docs/guide.md','last push is just prose\n'); put('migrering/status.json','{"updatedAt":"fixture"}\n'); commit('docs followup');
    git('checkout','main'); git('merge','--no-ff','code','-m','test mixed merge');
    assert.equal(ciScope({cwd:root,env:prEnv()}),'full');
    assert.equal(ciScope({cwd:root,env:{...prEnv(),GITHUB_SHA:'0'.repeat(40)}}),'full');
    for (const event of ['push','workflow_dispatch','schedule']) assert.equal(ciScope({cwd:root,env:{GITHUB_EVENT_NAME:event}}),'full');
    git('checkout','-qb','rename'); git('mv','app.mjs','docs/renamed.md'); commit('move code under docs');
    git('checkout','main'); git('merge','--no-ff','rename','-m','test rename merge');
    assert.equal(ciScope({cwd:root,env:prEnv()}),'full','deleted runtime side of a rename must be checked');
  } finally { rmSync(root,{recursive:true,force:true}); }
});

test('push main runs integration checks only; preview uses its complete push range only for worker selection', () => {
  const root = mkdtempSync(join(tmpdir(),'croupier-main-worker-'));
  const env = {...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null'};
  for(const key of Object.keys(env))if(/^GIT_(?:DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES)$/.test(key))delete env[key];
  const git=(...args)=>execFileSync('git',args,{cwd:root,env,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const put=(path,text)=>{mkdirSync(join(root,...path.split('/').slice(0,-1)),{recursive:true});writeFileSync(join(root,path),text);};
  const commit=message=>{git('add','.');git('commit','-qm',message);};
  try{
    git('init','-q','-b','main');git('config','user.name','CI fixture');git('config','user.email','ci@example.invalid');git('config','core.hooksPath',join(root,'no-hooks'));
    put('services/moving-gpu-worker/serverless.py','worker = 1\n');put('services/openclaw/lab/deploy/start-gateway.mjs','export const gateway=1;\n');
    put('app.mjs','export const version=1;\n');put('README.md','base\n');commit('base');const base=git('rev-parse','HEAD');
    const eventPath=join(root,'.git','push-event.json');
    const push=(before=base,ref='refs/heads/preview')=>{const head=git('rev-parse','HEAD');writeFileSync(eventPath,JSON.stringify({before,after:head}));
      return {GITHUB_EVENT_NAME:'push',GITHUB_REF:ref,GITHUB_SHA:head,GITHUB_EVENT_PATH:eventPath};};
    put('app.mjs','export const version=2;\n');commit('unrelated product edit');
    assert.deepEqual(ciSelection({cwd:root,env:push()}),{...complete,moving:false},'preview verifies the complete product, Chrome required');
    // Main: no regression leg, no worker image, no Chrome; readiness always; the Gateway image follows the push range.
    assert.deepEqual(ciSelection({cwd:root,env:push(base,'refs/heads/main')}),{...integration,gateway:false});
    put('README.md','followup prose\n');commit('docs after code');
    assert.deepEqual(ciSelection({cwd:root,env:push()}),{...complete,moving:false},'preview regression and migration readiness remain full');
    const shallow=join(root,'shallow');git('clone','-q','--depth=2',pathToFileURL(root).href,shallow);
    assert.deepEqual(ciSelection({cwd:shallow,env:push()}),complete,'an unavailable batch base cannot skip the image');
    assert.deepEqual(ciSelection({cwd:shallow,env:push(base,'refs/heads/main')}),integration,'an unavailable main range builds the Gateway image');
    rmSync(shallow,{recursive:true,force:true});
    git('checkout','-qb','side',base);put('README.md','side branch\n');commit('unrelated history');const side=git('rev-parse','HEAD');git('checkout','main');
    assert.deepEqual(ciSelection({cwd:root,env:push(side)}),complete,'a non-ancestor is not a push range');
    assert.deepEqual(ciSelection({cwd:root,env:push(side,'refs/heads/main')}),integration);
    for (const ref of ['refs/heads/preview','refs/heads/main']) {
      const valid=push(base,ref), uncertain=ref==='refs/heads/main'?integration:complete;
      for(const changes of [{GITHUB_SHA:'f'.repeat(40)},{GITHUB_EVENT_PATH:join(root,'absent')}])
        assert.deepEqual(ciSelection({cwd:root,env:{...valid,...changes}}),uncertain,ref);
      for(const payload of ['not JSON',JSON.stringify({before:'0'.repeat(40),after:valid.GITHUB_SHA}),JSON.stringify({before:base,after:'f'.repeat(40)}),JSON.stringify({before:valid.GITHUB_SHA,after:valid.GITHUB_SHA})]){
        writeFileSync(eventPath,payload);assert.deepEqual(ciSelection({cwd:root,env:valid}),uncertain,ref+' '+payload);
      }
    }
    const valid=push();
    for(const changes of [{GITHUB_REF:'refs/heads/feature'},{GITHUB_EVENT_NAME:'workflow_dispatch'},{GITHUB_EVENT_NAME:'schedule',GITHUB_REF:'refs/heads/main'}])
      assert.deepEqual(ciSelection({cwd:root,env:{...valid,...changes}}),complete,'feature pushes, manual and nightly runs verify the complete product');
    const previous=git('rev-parse','HEAD');put('services/moving-gpu-worker/serverless.py','worker = 2\n');commit('worker change');put('README.md','last commit is only prose\n');commit('docs after worker');
    assert.deepEqual(ciSelection({cwd:root,env:push(previous)}),complete,'earlier worker changes in a batch cannot be hidden by its last commit');
    assert.deepEqual(ciSelection({cwd:root,env:push(previous,'refs/heads/main')}),{...integration,gateway:false},'main leaves the worker image to its PR and the nightly run');
    git('rm','-q','services/moving-gpu-worker/serverless.py');commit('remove worker source');
    assert.deepEqual(ciSelection({cwd:root,env:push(previous)}),complete,'worker removals also require its image check');
    const beforeGateway=git('rev-parse','HEAD');put('services/openclaw/lab/deploy/start-gateway.mjs','export const gateway=2;\n');commit('gateway edit');put('README.md','prose after the gateway\n');commit('docs after gateway');
    assert.deepEqual(ciSelection({cwd:root,env:push(beforeGateway,'refs/heads/main')}),integration,'an earlier Gateway input change in the range builds its image on main');
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('final CI gate fails for missing, failed, cancelled or unexpectedly skipped work', () => {
  const yaml = readFileSync(new URL('../.github/workflows/croupier.yml',import.meta.url),'utf8').replaceAll('\r\n', '\n');
  const script = yaml.split('// Final gate script\n')[1]?.split('          NODE')[0]
    .split('\n').filter(line=>line.trim()).map(line=>line.slice(10)).join('\n');
  assert.ok(script,'workflow must expose its actual gate script');
  const run = needs => spawnSync(process.execPath,['--input-type=module','-e',script],{
    encoding:'utf8',env:{...process.env,CI_NEEDS:JSON.stringify(needs)},
  }).status;
  const allLegs = JSON.stringify(SCOPE_LEGS.full);
  // A ready full-scope PR: every leg, Chrome advisory.
  const full = { changes:{result:'success',outputs:{scope:'full',migration:'true',moving:'false',gateway:'true',draft:'false',browser:'advisory',legs:allLegs}},
    documentation:{result:'skipped'}, targeted:{result:'skipped'},
    'dealer-regression':{result:'success',outputs:{lipsync_verified:'true'}}, 'browser-regression':{result:'success'}, 'gateway-container':{result:'success'},
    'migration-readiness':{result:'success'}, 'moving-worker':{result:'skipped'} };
  assert.equal(run(full),0);
  const docs = structuredClone(full); docs.changes.outputs.scope='documentation'; docs.changes.outputs.migration='false'; docs.changes.outputs.gateway='false'; docs.changes.outputs.legs='[]'; docs.documentation.result='success';
  docs.changes.outputs.browser='none'; docs['browser-regression'].result='skipped';
  docs['dealer-regression'].result='skipped'; delete docs['dealer-regression'].outputs;
  docs['gateway-container'].result='skipped'; docs['migration-readiness'].result='skipped';
  assert.equal(run(docs),0);
  // Chrome on a ready PR is advisory: any result passes the gate; malformed or contradictory selection does not.
  for (const result of ['failure','cancelled','skipped',undefined]) {
    const advisory=structuredClone(full); advisory['browser-regression'].result=result; assert.equal(run(advisory),0,'advisory Chrome does not block: '+result);
  }
  for (const value of ['',undefined,'unknown',true,'false']) {
    const broken=structuredClone(full); broken.changes.outputs.browser=value; assert.notEqual(run(broken),0,'unreported browser selection is rejected: '+value);
  }
  for (const mode of ['required','advisory']) {
    const contradictory=structuredClone(docs); contradictory.changes.outputs.browser=mode; contradictory['browser-regression'].result='success';
    assert.notEqual(run(contradictory),0,'documentation runs no Chrome acceptance: '+mode);
  }
  // Nightly, manual and preview runs require Chrome.
  const nightly = structuredClone(full); nightly.changes.outputs.browser='required'; nightly.changes.outputs.moving='true'; nightly['moving-worker'].result='success';
  assert.equal(run(nightly),0);
  for (const result of ['failure','cancelled','skipped',undefined]) {
    const broken=structuredClone(nightly); broken['browser-regression'].result=result; assert.notEqual(run(broken),0,'required Chrome: '+result);
  }
  const noBrowserJob=structuredClone(nightly); delete noBrowserJob['browser-regression']; assert.notEqual(run(noBrowserJob),0);
  // Selection none: the job must not have run at all.
  for (const result of ['success','failure']) {
    const broken=structuredClone(full); broken.changes.outputs.browser='none'; broken['browser-regression'].result=result; assert.notEqual(run(broken),0,'browser ran against the classification: '+result);
  }
  // Push main (integration): documentation, readiness and the gateway as classified; no regression job.
  const main = structuredClone(docs); main.changes.outputs.scope='integration'; main.changes.outputs.migration='true'; main['migration-readiness'].result='success';
  assert.equal(run(main),0,'push main passes on its integration checks');
  const mainGateway = structuredClone(main); mainGateway.changes.outputs.gateway='true'; mainGateway['gateway-container'].result='success';
  assert.equal(run(mainGateway),0,'push main builds the Gateway image when its inputs changed');
  for (const result of ['skipped','failure','cancelled',undefined]) {
    const broken=structuredClone(mainGateway); broken['gateway-container'].result=result; assert.notEqual(run(broken),0,'main gateway: '+result);
  }
  for (const job of ['documentation','migration-readiness']) for (const result of ['skipped','failure','cancelled',undefined]) {
    const broken=structuredClone(main); broken[job].result=result; assert.notEqual(run(broken),0,`main ${job}: ${result}`);
  }
  for (const [job, outputs] of [['dealer-regression',{lipsync_verified:'true'}],['browser-regression',undefined]]) {
    const broken=structuredClone(main); broken[job]={result:'success',...(outputs ? {outputs} : {})}; assert.notEqual(run(broken),0,`main must not run ${job}`);
  }
  const mainWithLegs=structuredClone(main); mainWithLegs.changes.outputs.legs=allLegs; mainWithLegs['dealer-regression']={result:'success',outputs:{lipsync_verified:'true'}};
  assert.notEqual(run(mainWithLegs),0,'integration scope and a leg list contradict each other');
  const mainDraft=structuredClone(main); mainDraft.changes.outputs.draft='true'; assert.notEqual(run(mainDraft),0,'a push is never a draft');
  const mainNoReadiness=structuredClone(main); mainNoReadiness.changes.outputs.migration='false'; mainNoReadiness['migration-readiness'].result='skipped';
  assert.notEqual(run(mainNoReadiness),0,'every push to main checks the live migration ledger');
  const client = structuredClone(full); client.changes.outputs.migration='false';
  client['migration-readiness'].result='skipped';
  assert.equal(run(client),0,'client-only changes need no production access');
  // Gateway container: required exactly when the classifier asked for it.
  const noGateway = structuredClone(full); noGateway.changes.outputs.gateway='false'; noGateway['gateway-container'].result='skipped';
  assert.equal(run(noGateway),0,'an unchanged Gateway image needs no build');
  for (const result of ['success','failure','cancelled',undefined]) {
    const broken=structuredClone(noGateway); broken['gateway-container'].result=result; assert.notEqual(run(broken),0,'gateway ran against the classification: '+result);
  }
  for (const value of ['',undefined,'unknown',true]) {
    const broken=structuredClone(full); broken.changes.outputs.gateway=value; assert.notEqual(run(broken),0,'unreported gateway selection is rejected');
  }
  // Narrow scope: only its legs ran, the lipsync receipt is not required when its leg did not run.
  const deploy = structuredClone(full); deploy.changes.outputs.scope='openclaw-deploy'; deploy.changes.outputs.legs=JSON.stringify(SCOPE_LEGS['openclaw-deploy']);
  deploy.changes.outputs.browser='none'; deploy['browser-regression'].result='skipped';
  delete deploy['dealer-regression'].outputs;
  assert.equal(run(deploy),0,'openclaw-deploy requires its legs and the Gateway container');
  const deployNoGateway = structuredClone(deploy); deployNoGateway.changes.outputs.gateway='false'; deployNoGateway['gateway-container'].result='skipped';
  assert.equal(run(deployNoGateway),0);
  for (const result of ['failure','cancelled','skipped',undefined]) {
    const broken=structuredClone(deploy); broken['dealer-regression'].result=result; assert.notEqual(run(broken),0,'narrow scope still needs its legs: '+result);
  }
  const lipsyncLegOnly = structuredClone(full); lipsyncLegOnly.changes.outputs.legs=JSON.stringify([LIPSYNC_LEG]); delete lipsyncLegOnly['dealer-regression'].outputs;
  assert.notEqual(run(lipsyncLegOnly),0,'the lipsync leg must attest whenever it runs');
  for (const legs of ['','not json','{}','[1]','[""]',undefined]) {
    const broken=structuredClone(full); broken.changes.outputs.legs=legs; assert.notEqual(run(broken),0,'malformed leg list: '+legs);
  }
  const emptyFull = structuredClone(full); emptyFull.changes.outputs.legs='[]'; emptyFull['dealer-regression'].result='skipped'; delete emptyFull['dealer-regression'].outputs;
  assert.notEqual(run(emptyFull),0,'a full scope without legs verifies nothing');
  // Draft runs: only the targeted job (or documentation) may run; the gate is not named CI there.
  const draft = structuredClone(full); draft.changes.outputs.draft='true'; draft.changes.outputs.browser='none'; draft.targeted.result='success';
  for (const job of ['dealer-regression','browser-regression','gateway-container','migration-readiness']) { draft[job].result='skipped'; delete draft[job].outputs; }
  assert.equal(run(draft),0,'a draft passes on the targeted job alone');
  const draftDocs = structuredClone(docs); draftDocs.changes.outputs.draft='true';
  assert.equal(run(draftDocs),0,'a documentation draft passes on the documentation job');
  for (const result of ['failure','cancelled','skipped',undefined]) {
    const broken=structuredClone(draft); broken.targeted.result=result; assert.notEqual(run(broken),0,'draft targeted: '+result);
    const brokenDocs=structuredClone(draftDocs); brokenDocs.documentation.result=result; assert.notEqual(run(brokenDocs),0,'draft documentation: '+result);
  }
  for (const job of ['dealer-regression','browser-regression','gateway-container','migration-readiness','moving-worker','documentation']) {
    for (const result of ['success','failure']) {
      const broken=structuredClone(draft); broken[job].result=result; assert.notEqual(run(broken),0,`a draft must not run ${job} (${result})`);
    }
  }
  const draftAdvisory=structuredClone(draft); draftAdvisory.changes.outputs.browser='advisory'; assert.notEqual(run(draftAdvisory),0,'a draft selects no Chrome acceptance');
  for (const value of ['',undefined,'unknown',true,'yes']) {
    const broken=structuredClone(full); broken.changes.outputs.draft=value; assert.notEqual(run(broken),0,'unreported draft selection is rejected');
  }
  // A ready run never accepts the targeted job in place of regression.
  const readyTargeted = structuredClone(full); readyTargeted.targeted.result='success';
  assert.notEqual(run(readyTargeted),0);
  const readyNoRegression = structuredClone(full); readyNoRegression.targeted.result='success'; readyNoRegression['dealer-regression'].result='skipped'; delete readyNoRegression['dealer-regression'].outputs;
  assert.notEqual(run(readyNoRegression),0);
  for (const result of [undefined,'','skipped','failure','cancelled']) {
    const broken=structuredClone(full); broken['migration-readiness'].result=result;
    assert.notEqual(run(broken),0,'required readiness must have a successful job: '+result);
  }
  const unreportedReadiness=structuredClone(full); delete unreportedReadiness['migration-readiness'];
  assert.notEqual(run(unreportedReadiness),0);
  for (const value of [undefined,'','unknown',true,false]) {
    const broken=structuredClone(full); broken.changes.outputs.migration=value;
    assert.notEqual(run(broken),0,'unreported or malformed migration selection is rejected');
  }
  const inconsistentDocs=structuredClone(docs); inconsistentDocs.changes.outputs.migration='true';
  assert.notEqual(run(inconsistentDocs),0,'documentation cannot claim to have run required readiness');
  const docsWithLegs=structuredClone(docs); docsWithLegs.changes.outputs.legs=allLegs;
  assert.notEqual(run(docsWithLegs),0,'documentation scope and a leg list contradict each other');
  const readiness = yaml.split('\n  migration-readiness:\n')[1]?.split('\n  moving-worker:')[0];
  assert.ok(readiness?.includes('run: node tools/check-migration-readiness.mjs'));
  assert.ok(readiness.includes('CROUPIER_GAME_DATABASE_URL: $'+'{{ secrets.CROUPIER_GAME_DATABASE_URL }}'));
  assert.doesNotMatch(readiness,/continue-on-error:/);
  assert.equal(yaml.match(/secrets\.CROUPIER_GAME_DATABASE_URL/g)?.length,1,'only the readiness job receives production access');
  const condition=readiness.match(/\n    if: \$\{\{ (.+) \}\}\n/)?.[1];
  assert.ok(condition,'readiness retains an explicit production-access guard on its job');
  const repository='Jakeminator123/scoutgaming';
  const contexts=[
    {event_name:'pull_request',repository,event:{pull_request:{head:{repo:{full_name:repository}}}},allowed:true},
    {event_name:'pull_request',repository,event:{pull_request:{head:{repo:{full_name:'contributor/scoutgaming'}}}},allowed:false},
    {event_name:'push',ref:'refs/heads/main',repository,allowed:true},
    {event_name:'push',ref:'refs/heads/preview',repository,allowed:true},
    {event_name:'push',ref:'refs/heads/feature',repository,allowed:false},
    {event_name:'workflow_dispatch',repository,allowed:true},
    {event_name:'schedule',ref:'refs/heads/main',repository,allowed:true},
    {event_name:'unknown',repository,allowed:false},
  ];
  for (const context of contexts) for (const migration of ['true','false']) for (const draftFlag of ['true','false']) {
    const allowed=runInNewContext(condition,{needs:{changes:{outputs:{migration,draft:draftFlag}}},github:context});
    assert.equal(allowed,migration==='true' && draftFlag==='false' && context.allowed,'production access: '+JSON.stringify({event:context.event_name,migration,draft:draftFlag,allowed:context.allowed}));
    if (draftFlag==='true') continue;
    const result=structuredClone(full); result.changes.outputs.migration=migration;
    result['migration-readiness'].result=allowed?'success':'skipped';
    assert.equal(run(result)===0,migration==='false' || context.allowed,'fork readiness must block without exposing production access');
  }
  for (const receipt of [undefined,'','false',false]) {
    const broken=structuredClone(full); broken['dealer-regression'].outputs.lipsync_verified=receipt; assert.notEqual(run(broken),0);
  }
  const missingOutputs=structuredClone(full); delete missingOutputs['dealer-regression'].outputs; assert.notEqual(run(missingOutputs),0);
  for (const job of ['dealer-regression','gateway-container']) {
    const missing=structuredClone(full); delete missing[job]; assert.notEqual(run(missing),0,job);
    for (const result of ['failure','cancelled','skipped']) {
      const broken=structuredClone(full); broken[job].result=result; assert.notEqual(run(broken),0,job+' '+result);
    }
  }
  for (const result of ['failure','cancelled','skipped']) {
    const missingDocs=structuredClone(docs); missingDocs.documentation.result=result; assert.notEqual(run(missingDocs),0);
    const broken=structuredClone(docs); broken.changes.result=result; assert.notEqual(run(broken),0);
  }
  const moving = structuredClone(full); moving.changes.outputs.moving='true'; moving['moving-worker'].result='success';
  assert.equal(run(moving),0);
  for (const result of ['failure','cancelled','skipped',undefined]) {
    const broken=structuredClone(moving); broken['moving-worker'].result=result; assert.notEqual(run(broken),0);
  }
  for (const value of ['',undefined,'unknown']) {
    const broken=structuredClone(full); broken.changes.outputs.moving=value; assert.notEqual(run(broken),0);
  }
  const unreported=structuredClone(full); delete unreported['moving-worker']; assert.notEqual(run(unreported),0);
  assert.notEqual(run({}),0);
  // Draft runs are not the required check: the gate job is renamed, so CI stays missing on that head.
  const gate = yaml.split('\n  ci:\n')[1];
  assert.match(gate, /^    name: \$\{\{ needs\.changes\.outputs\.draft == 'true' && 'CI \(utkast\)' \|\| 'CI' \}\}\n/, 'only ready runs report the check named CI');
  for (const [draftFlag, expected] of [['true','CI (utkast)'],['false','CI'],['','CI'],[undefined,'CI']]) {
    const name = runInNewContext("draft == 'true' && 'CI (utkast)' || 'CI'", { draft: draftFlag });
    assert.equal(name, expected);
  }
});

test('lipsync worker checks run in one regression leg with isolated Python and only attest after every command passes', () => {
  const yaml = readFileSync(new URL('../.github/workflows/croupier.yml',import.meta.url),'utf8').replaceAll('\r\n', '\n');
  const dealer = yaml.split('  dealer-regression:\n')[1]?.split('  browser-regression:\n')[0];
  assert.ok(dealer, 'the full regression job must exist');
  assert.doesNotMatch(yaml, /^  lipsync-worker:/m, 'the worker checks stay a leg of the regression job');
  assert.equal(REGRESSION_LEGS.filter(leg => leg.lipsync === true).length, 1, 'exactly one leg runs and attests the worker checks');
  assert.equal(REGRESSION_LEGS.find(leg => leg.lipsync === true).leg, LIPSYNC_LEG, 'the gate requires the receipt from that leg');
  assert.ok(dealer.includes('lipsync_verified: $' + '{{ steps.lipsync_contracts.outputs.verified }}'));
  const python = dealer.split('      - name: Select the worker Python without changing other checks\n')[1]?.split('      - name:')[0];
  assert.ok(python?.includes('id: lipsync_python'));
  assert.ok(python.includes('uses: actions/setup-python@v6'));
  assert.ok(python.includes("python-version: '3.11'"));
  assert.ok(python.includes('update-environment: false'), 'worker setup must not replace other checks\' Python');
  const step = dealer.split('      - name: Verify lipsync worker contracts in the prepared regression VM\n')[1]?.split('\n      - ')[0];
  assert.ok(step?.includes('id: lipsync_contracts'));
  assert.ok(step.includes('shell: bash'));
  assert.ok(step.includes('LIPSYNC_PYTHON: $' + "{{ steps.lipsync_python.outputs['python-path'] }}"));
  // The only condition is the leg selector; a missing receipt fails the final gate.
  for (const part of [python, step]) {
    assert.deepEqual(part.match(/^\s+if: .*$/gm), ['        if: $' + '{{ matrix.lipsync }}'], 'worker checks cannot silently skip');
    assert.doesNotMatch(part, /^\s+continue-on-error:/m, 'worker checks cannot ignore failure');
  }
  const script = step.split('        run: |\n')[1]?.split('\n').filter(line=>line.trim()).map(line=>line.slice(10)).join('\n');
  assert.ok(script);
  const expected = [
    'npm --prefix services/astrid-gpu-worker/gateway test',
    'python -m unittest discover -s services/astrid-gpu-worker/tests -v',
    'python -m compileall -q services/astrid-gpu-worker/workers services/astrid-gpu-worker/handler.py',
    'bash -n services/astrid-gpu-worker/fetch/fetch-musetalk.sh',
  ];
  const root = mkdtempSync(join(tmpdir(),'ci-lipsync-step-'));
  const output = join(root,'output'), calls = join(root,'calls');
  const shell = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash';
  const driver = [
    'calls=0',
    'record() { calls=$((calls+1)); printf \'%s\\n\' "$*" >> "$WORKER_CALLS"; if [ "$calls" = "$FAIL_CALL" ]; then return 23; fi; }',
    'npm() { record "npm $*"; }',
    'worker_python() { record "python $*"; }',
    'bash() { record "bash $*"; }',
    script,
  ].join('\n');
  try {
    for (const fail of [0,1,2,3,4]) {
      writeFileSync(output,''); writeFileSync(calls,'');
      const run = spawnSync(shell,['--noprofile','--norc','-e','-o','pipefail','-c',driver],{
        encoding:'utf8',env:{...process.env,LIPSYNC_PYTHON:'worker_python',GITHUB_OUTPUT:output.replaceAll('\\','/'),WORKER_CALLS:calls.replaceAll('\\','/'),FAIL_CALL:String(fail)},
      });
      assert.ifError(run.error);
      assert.equal(run.status,fail === 0 ? 0 : 23,run.stderr);
      assert.deepEqual(readFileSync(calls,'utf8').trim().split('\n'),expected.slice(0,fail || 4));
      assert.equal(readFileSync(output,'utf8'),fail === 0 ? 'verified=true\n' : '', 'a failed command must not produce a success receipt');
    }
  } finally { rmSync(root,{recursive:true,force:true}); }
});


test('classifier rejects an unavailable or incompatible preinstalled Node runtime', () => {
  const yaml = readFileSync(new URL('../.github/workflows/croupier.yml',import.meta.url),'utf8').replaceAll('\r\n','\n');
  const changes = yaml.split('  changes:\n')[1]?.split('  documentation:\n')[0];
  assert.ok(changes);
  assert.doesNotMatch(changes,/actions\/setup-node/);
  assert.doesNotMatch(changes,/^\s+(?:if|continue-on-error):/m,'classifier and runtime checks must remain mandatory');
  const guard = changes.match(/- name: Verify preinstalled Node 24\n\s+run: node -e "([^"\n]+)"/)?.[1];
  assert.ok(guard,'the installed runtime must be checked before running policy code');
  assert.ok(changes.indexOf('Verify preinstalled Node 24') < changes.indexOf('Verify CI selection and final gate'));
  for (const version of ['24.21.0','24.22.0']) runInNewContext(guard,{process:{versions:{node:version}}});
  for (const version of ['','22.23.1','25.0.0']) {
    assert.throws(()=>runInNewContext(guard,{process:{versions:{node:version}}}),/Preinstalled Node 24 is required/);
  }
  const shell = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash';
  const unavailable = spawnSync(shell,['--noprofile','--norc','-e','-o','pipefail','-c',
    'node() { return 127; }\nnode -e "' + guard + '"\necho classifier-continued'],{encoding:'utf8'});
  assert.ifError(unavailable.error);
  assert.equal(unavailable.status,127);
  assert.equal(unavailable.stdout,'','an unavailable runtime must not continue classification');
});

test('sparse checkout retains the full commit diff and every policy dependency', () => {
  const yaml = readFileSync(new URL('../.github/workflows/croupier.yml',import.meta.url),'utf8').replaceAll('\r\n','\n');
  const changes = yaml.split('  changes:\n')[1]?.split('  documentation:\n')[0];
  assert.match(changes,/runs-on: ubuntu-slim/);
  assert.match(changes,/fetch-depth: 2/);
  assert.match(changes,/sparse-checkout-cone-mode: false/);
  assert.doesNotMatch(changes,/^\s+filter:/m,'filter overrides checkout sparse patterns');
  assert.doesNotMatch(changes,/^\s+(?:ref|repository):/m,'checkout must retain the event repository and commit');
  const files = changes.match(/sparse-checkout: \|\n((?:            [^\n]+\n)+)/)?.[1].trim().split('\n').map(line=>line.trim());
  assert.ok(files?.length, 'sparse checkout must declare its policy inputs');
  // The classifier job itself runs every policy test in this sparse checkout, so a
  // missing policy input fails CI there; this fixture proves selection and fail-closed
  // classification without re-running the whole file inside it.
  const root = mkdtempSync(join(tmpdir(),'ci-sparse-policy-'));
  const env = {...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null'};
  for (const key of Object.keys(env)) if (/^GIT_(?:DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES)$/.test(key)) delete env[key];
  const git = (...args)=>execFileSync('git',args,{cwd:root,env,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const put = (path,text)=>{mkdirSync(join(root,...path.split('/').slice(0,-1)),{recursive:true});writeFileSync(join(root,path),text);};
  const commit = message=>{git('add','.');git('commit','-qm',message);};
  // PR cases: a product edit outside the Gateway inputs needs no container build; uncertain identity runs everything.
  const full = moving=>({...complete,moving,gateway:false,browser:'advisory'});
  try {
    git('init','-q','-b','main');git('config','user.name','CI fixture');git('config','user.email','ci@example.invalid');git('config','core.hooksPath',join(root,'no-hooks'));
    for (const path of files) put(path,readFileSync(new URL('../'+path,import.meta.url),'utf8'));
    put('services/moving-gpu-worker/serverless.py','worker = 1\n');
    put('services/game/server.mjs','export const version=1;\n');
    put('outside/runtime.mjs','export const version=1;\n');
    put('README.md','base\n');
    commit('base');const base=git('rev-parse','HEAD');
    const cases = [
      {path:'services/moving-gpu-worker/serverless.py',expected:full(true)},
      {path:'services/game/server.mjs',expected:full(false)},
      {path:'outside/runtime.mjs',expected:full(false)},
      {path:'services/moving-gpu-worker/serverless.py',remove:true,expected:full(true)},
      {path:'outside/runtime.mjs',rename:true,expected:full(false)},
      {path:'README.md',expected:{scope:'documentation',migration:false,moving:false,gateway:false,draft:false,browser:'none'}},
    ];
    for (const [index,item] of cases.entries()) {
      const branch='case-'+index;git('checkout','-qb',branch,base);
      if (item.remove) git('rm',item.path);
      else if (item.rename) {mkdirSync(join(root,'docs'));git('mv',item.path,'docs/runtime.md');}
      else put(item.path,'changed\n');
      commit(branch);git('checkout','-B','main',base);git('merge','--no-ff',branch,'-m','fixture merge');
      item.head=git('rev-parse','HEAD');
    }
    git('sparse-checkout','set','--no-cone',...files.map(path=>'/'+path));
    for (const item of cases) {
      git('checkout','--detach',item.head);
      assert.throws(()=>readFileSync(join(root,item.path)),{code:'ENOENT'},'changed product/prose files must actually be absent');
      const pr={GITHUB_EVENT_NAME:'pull_request',GITHUB_REF:'refs/pull/1/merge',GITHUB_SHA:item.head};
      assert.deepEqual(ciSelection({cwd:root,env:pr}),item.expected,item.path);
      for (const invalid of [{GITHUB_REF:'refs/heads/main'},{GITHUB_SHA:'0'.repeat(40)},{GITHUB_EVENT_NAME:'unknown'}]) {
        assert.deepEqual(ciSelection({cwd:root,env:{...pr,...invalid}}),complete,'uncertain identity must never become documentation-only');
      }
    }
    rmSync(join(root,'tools','documentation-paths.mjs'));
    const missing = spawnSync(process.execPath,['tools/ci-changes.mjs'],{
      cwd:root,env:{...env,GITHUB_EVENT_NAME:'pull_request',GITHUB_REF:'refs/pull/1/merge',GITHUB_SHA:git('rev-parse','HEAD')},encoding:'utf8',
    });
    assert.ifError(missing.error);
    assert.notEqual(missing.status,0,'a missing transitive dependency must fail the classifier');
    assert.match(missing.stderr,/ERR_MODULE_NOT_FOUND|Cannot find module/);
  } finally { rmSync(root,{recursive:true,force:true}); }
});
