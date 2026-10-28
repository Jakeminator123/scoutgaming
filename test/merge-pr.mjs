import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BASELINE_FOREIGN_BRANCHES, PR_FIELDS, changedPaths, evaluateMerge, foreignBranchPatterns, main, matchesGlob, parseArgs,
  readPrFiles, securityVerdict, SECURITY_RETRY_MS,
} from '../tools/merge-pr.mjs';
import { featurePatterns } from '../tools/check-push-target.mjs';

// tools/merge-pr.mjs is the orchestrator's only merge path. Every refusal rule has a case
// here, and gh/git/security-status are injected so the test never touches the network.
const HEAD = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const FREEZE = 'c'.repeat(40);
const WORKFLOW = 'Croupier GitHub checks';
const people = { jakob: { github: 'Jakeminator123', branch: 'main' }, kevin: { github: 'invoicesolv', branch: 'kevin' },
  john: { github: 'Johncleochile', branch: 'john' }, emil: { github: 'EmaCodeHero', branch: 'emil' } };
const policy = JSON.parse(readFileSync(new URL('../tools/repository-policy.json', import.meta.url), 'utf8'));
const cleanSecurity = { status: 0, stdout: JSON.stringify({ purpose: 'gitguardian-combined-security-status-v1',
  attention: ['gitguardian_open_incidents'], incidentCounts: { open: 2 } }) };
const ciRun = (overrides = {}) => ({ __typename: 'CheckRun', name: 'CI', status: 'COMPLETED', conclusion: 'SUCCESS', workflowName: WORKFLOW, ...overrides });
const goodFiles = [{ filename: 'tools/merge-pr.mjs', status: 'added', previous_filename: null },
  { filename: 'docs/README.md', status: 'modified', previous_filename: null }];
const goodPr = (overrides = {}) => ({
  number: 42, author: { login: 'Jakeminator123' }, isCrossRepository: false, headRefName: 'jakob/claude-merge-guard',
  headRefOid: HEAD, isDraft: false, baseRefName: 'main', state: 'OPEN', mergeable: 'MERGEABLE', changedFiles: 2,
  statusCheckRollup: [{ __typename: 'CheckRun', name: 'changes', status: 'COMPLETED', conclusion: 'SUCCESS', workflowName: WORKFLOW }, ciRun()],
  ...overrides,
});
const decide = (pr, extra = {}) => evaluateMerge({ pr, files: goodFiles, head: HEAD, jakobLogin: 'Jakeminator123',
  featureBranches: featurePatterns(policy), foreignPatterns: foreignBranchPatterns({ policy, people }), security: cleanSecurity, ...extra });
const failed = verdict => verdict.checks.filter(entry => !entry.ok).map(entry => entry.name);
const withFiles = (files, extra = {}) => decide(goodPr({ changedFiles: files.length }), { files, ...extra });

test('a verified Jakob PR with green CI on the exact head passes every check', () => {
  const verdict = decide(goodPr());
  assert.equal(verdict.ok, true, JSON.stringify(verdict.checks));
  assert.deepEqual(verdict.checks.map(entry => entry.name),
    ['pr', 'state', 'draft', 'base', 'source', 'head', 'branch', 'author', 'ci', 'mergeable', 'files', 'workflow', 'security']);
  assert.equal(decide(goodPr(), { freeze: FREEZE, freezeOnMain: true }).ok, true, 'non-runtime files pass the freeze');
  assert.equal(decide(goodPr({ mergeable: 'UNKNOWN' })).ok, true, 'GitHub decides UNKNOWN at merge time');
});

test('each refusal rule refuses on its own', () => {
  const cases = {
    state: [goodPr({ state: 'MERGED' }), goodPr({ state: 'CLOSED' })],
    draft: [goodPr({ isDraft: true }), goodPr({ isDraft: undefined })],
    base: [goodPr({ baseRefName: 'kevin' })],
    source: [goodPr({ isCrossRepository: true })],
    head: [goodPr({ headRefOid: OTHER }), goodPr({ headRefOid: HEAD.slice(0, 12) })],
    author: [goodPr({ author: { login: 'invoicesolv' } }), goodPr({ author: null })],
    ci: [goodPr({ statusCheckRollup: [] }),
      goodPr({ statusCheckRollup: [ciRun({ status: 'IN_PROGRESS', conclusion: '' })] }),
      goodPr({ statusCheckRollup: [ciRun({ conclusion: 'FAILURE' })] }),
      goodPr({ statusCheckRollup: [ciRun({ conclusion: 'SKIPPED' })] }),
      // A job named CI in another workflow, or a commit status named CI, is not the repository CI.
      goodPr({ statusCheckRollup: [ciRun({ workflowName: 'My own checks' })] }),
      goodPr({ statusCheckRollup: [ciRun({ workflowName: undefined })] }),
      goodPr({ statusCheckRollup: [ciRun(), ciRun({ workflowName: 'Shadow CI' })] }),
      goodPr({ statusCheckRollup: [ciRun(), { __typename: 'StatusContext', context: 'CI', state: 'SUCCESS' }] })],
    mergeable: [goodPr({ mergeable: 'CONFLICTING' })],
  };
  // An incomplete file list also leaves the CI-file rule unproven.
  for (const pr of [goodPr({ changedFiles: 3 }), goodPr({ changedFiles: undefined })]) assert.deepEqual(failed(decide(pr)), ['files', 'workflow']);
  for (const [rule, prs] of Object.entries(cases)) {
    for (const pr of prs) {
      const verdict = decide(pr);
      assert.equal(verdict.ok, false, rule);
      assert.deepEqual(failed(verdict), [rule], `${rule}: ${JSON.stringify(verdict.checks.filter(entry => !entry.ok))}`);
    }
  }
  assert.deepEqual(failed(decide(goodPr(), { head: 'not-a-sha' })), ['head']);
  assert.deepEqual(failed(decide(goodPr(), { jakobLogin: undefined })), ['author'], 'no trusted owner, no merge');
  assert.deepEqual(failed(decide(goodPr(), { files: null })), ['files', 'workflow'], 'an unreadable file list proves nothing');
  assert.ok(failed(decide(null)).length >= 11, 'an unreadable PR refuses everything');
});

test('only Jakob\'s delivery branches pass, and other people\'s branches never do', () => {
  const patterns = foreignBranchPatterns({ policy, people });
  for (const pattern of BASELINE_FOREIGN_BRANCHES) assert.ok(patterns.includes(pattern), pattern);
  for (const branch of ['kevin', 'kevin-ks', 'kevin/port', 'Kevin/Port', 'codex/kevin-fix', 'john', 'john/design', 'codex/john-x',
    'emil', 'emil-ui', 'codex/emil-y', 'roulette-on-kevin-staging',
    // Not a featureBranches pattern even though Jakob opened it.
    'codex/fix-foo', 'feature/x', 'codex/jakob-x', 'main', 'jakob', 'jakob/', 'jakob-export']) {
    assert.deepEqual(failed(decide(goodPr({ headRefName: branch }))), ['branch'], branch);
  }
  for (const branch of ['jakob/claude-x', 'jakob/kevin-port', 'jakob/par-admin']) {
    assert.equal(decide(goodPr({ headRefName: branch })).ok, true, branch);
  }
  assert.deepEqual(failed(decide(goodPr(), { featureBranches: [] })), ['branch'], 'no policy patterns, no merge');
  // A new person in people.json is protected without code changes.
  assert.ok(foreignBranchPatterns({ policy, people: { ...people, ada: { branch: 'ada' } } }).includes('codex/ada-*'));
  assert.equal(matchesGlob('kevin.x', 'kevin*'), true);
  assert.equal(matchesGlob('xkevin', 'kevin*'), false);
  assert.equal(matchesGlob('codex/kevinx', 'codex/kevin-*'), false);
});

test('a PR that changes the CI that judges it needs --allow-workflow-change', () => {
  for (const files of [[{ filename: '.github/workflows/croupier.yml', status: 'modified' }],
    [{ filename: '.github/workflows/new.yml', status: 'added' }],
    [{ filename: 'docs/old.yml', status: 'renamed', previous_filename: '.github/workflows/croupier.yml' }],
    [{ filename: '.github/actions/setup/action.yml', status: 'modified' }]]) {
    assert.deepEqual(failed(withFiles(files)), ['workflow'], files[0].filename);
    assert.equal(withFiles(files, { allowWorkflowChange: true }).ok, true, files[0].filename);
  }
  assert.equal(withFiles([{ filename: '.github/CODEOWNERS', status: 'modified' }]).ok, true);
});

test('--freeze refuses runtime paths, moves out of runtime and a candidate off main', () => {
  const runtime = [{ filename: 'docs/README.md', status: 'modified' }, { filename: 'services/game/server.mjs', status: 'modified' }];
  assert.deepEqual(failed(withFiles(runtime, { freeze: FREEZE, freezeOnMain: true })), ['freeze']);
  assert.equal(withFiles(runtime).ok, true, 'without --freeze runtime files are allowed');
  for (const filename of ['apps/studio/lib/x.mjs', 'packages/director/a.mjs', 'ops/neon-game/1.sql', 'apps/web/app/page.tsx']) {
    assert.deepEqual(failed(withFiles([{ filename, status: 'modified' }], { freeze: FREEZE, freezeOnMain: true })), ['freeze'], filename);
  }
  // gh pr view only shows docs/x.ts for apps/web/x.ts -> docs/x.ts; the REST list names the old path.
  for (const status of ['renamed', 'copied']) {
    const moved = [{ filename: 'docs/x.ts', status, previous_filename: 'apps/web/x.ts' }];
    assert.deepEqual(failed(withFiles(moved, { freeze: FREEZE, freezeOnMain: true })), ['freeze'], status);
    assert.deepEqual(failed(withFiles([{ filename: 'docs/x.ts', status }], { freeze: FREEZE, freezeOnMain: true })), ['files', 'workflow', 'freeze'],
      `${status} without its old path proves nothing`);
  }
  assert.equal(withFiles([{ filename: 'docs/b.md', status: 'renamed', previous_filename: 'docs/a.md' }], { freeze: FREEZE, freezeOnMain: true }).ok, true);
  assert.deepEqual(failed(decide(goodPr(), { freeze: FREEZE, freezeOnMain: false })), ['freeze'], 'the candidate must be on origin/main');
  assert.deepEqual(failed(decide(goodPr({ changedFiles: 150 }), { freeze: FREEZE, freezeOnMain: true })), ['files', 'workflow', 'freeze'],
    'an incomplete list cannot prove the freeze');
  assert.deepEqual(changedPaths([{ filename: 'b', status: 'renamed', previous_filename: 'a' }]), ['b', 'a']);
});

test('security-status refuses failures and reports only safe counts', () => {
  assert.equal(securityVerdict(cleanSecurity).ok, true);
  assert.match(securityVerdict(cleanSecurity).reason, /öppna incidenter 2/);
  for (const result of [null, { status: 2, stdout: '{}' }, { status: 0, stdout: 'not json' },
    { status: 0, stdout: JSON.stringify({ purpose: 'gitguardian-safe-status-unavailable', attention: [] }) },
    { status: 0, stdout: JSON.stringify({ attention: ['gitguardian_check_requires_attention'], incidentCounts: { open: 0 } }) },
    { status: 0, stdout: JSON.stringify({ attention: ['github_security_status_unavailable'] }) }]) {
    assert.equal(securityVerdict(result).ok, false, JSON.stringify(result));
  }
  const leaky = { status: 0, stdout: JSON.stringify({ attention: ['gitguardian_check_requires_attention'], openIncidents: [{ incidentURL: 'secret-ish' }] }) };
  assert.doesNotMatch(securityVerdict(leaky).reason, /secret-ish/);
  assert.deepEqual(failed(decide(goodPr(), { security: { status: 1, stdout: '' } })), ['security']);
});

test('arguments require a PR number and a full head SHA', () => {
  assert.deepEqual(parseArgs(['42', '--head', HEAD]), { number: 42, head: HEAD, freeze: null, allowWorkflowChange: false, dryRun: false });
  assert.deepEqual(parseArgs(['--dry-run', '--freeze', FREEZE, '--head', HEAD, '7', '--allow-workflow-change']),
    { number: 7, head: HEAD, freeze: FREEZE, allowWorkflowChange: true, dryRun: true });
  for (const args of [[], ['42'], ['42', '--head', HEAD.slice(0, 12)], ['42', '--head', HEAD.toUpperCase()], ['--head', HEAD],
    ['42', '--head', HEAD, '--admin'], ['42', '--head', HEAD, '--freeze'], ['42', '43', '--head', HEAD], ['-1', '--head', HEAD]]) {
    assert.throws(() => parseArgs(args), /Usage/, args.join(' '));
  }
});

test('the REST file list is read as JSON lines and fails closed', () => {
  const lines = goodFiles.map(file => JSON.stringify(file)).join('\n') + '\n';
  let argv;
  assert.deepEqual(readPrFiles(args => { argv = args; return { status: 0, stdout: lines }; }, 42), goodFiles);
  assert.deepEqual(argv.slice(0, 3), ['api', 'repos/Jakeminator123/scoutgaming/pulls/42/files?per_page=100', '--paginate']);
  assert.equal(readPrFiles(() => ({ status: 1, stdout: '' }), 42), null);
  assert.equal(readPrFiles(() => ({ status: 0, stdout: '{broken\n' }), 42), null);
});

function harness({ pr = goodPr(), view = null, files = goodFiles, merge = { status: 0, stdout: '' }, fetch = { status: 0, stdout: '' },
  onMain = true, trusted = { 'inbox/people.json': people, 'tools/repository-policy.json': policy },
  securityResults = [cleanSecurity] } = {}) {
  const calls = { gh: [], git: [], security: 0, sleeps: [] }, lines = [];
  return {
    calls, lines,
    run: args => main({
      args, log: line => lines.push(line),
      gh: argv => {
        calls.gh.push(argv);
        if (argv[1] === 'view') return view ?? { status: 0, stdout: JSON.stringify(pr) };
        if (argv[0] === 'api') return { status: 0, stdout: files.map(file => JSON.stringify(file)).join('\n') };
        return merge;
      },
      git: argv => {
        calls.git.push(argv);
        if (argv[0] === 'fetch') return fetch;
        if (argv[0] === 'merge-base') return { status: onMain ? 0 : 1, stdout: '' };
        const path = argv[1].replace(/^origin\/main:/, '');
        return trusted[path] ? { status: 0, stdout: JSON.stringify(trusted[path]) } : { status: 128, stdout: '' };
      },
      security: () => securityResults[Math.min(calls.security++, securityResults.length - 1)],
      sleep: ms => { calls.sleeps.push(ms); },
    }),
  };
}

test('main fetches main, then merges with gh, the exact head and no admin or auto flags', () => {
  const h = harness();
  assert.equal(h.run(['42', '--head', HEAD]), 0);
  assert.deepEqual(h.calls.git, [['fetch', '-q', 'origin', 'main'], ['show', 'origin/main:inbox/people.json'],
    ['show', 'origin/main:tools/repository-policy.json']], 'owner and policy come from freshly fetched main, not the working copy');
  assert.deepEqual(h.calls.gh[0].slice(-2), ['--json', PR_FIELDS]);
  assert.equal(h.calls.gh[1][0], 'api');
  assert.deepEqual(h.calls.gh[2], ['pr', 'merge', '42', '-R', 'Jakeminator123/scoutgaming', '--merge', '--match-head-commit', HEAD]);
  assert.ok(h.calls.gh.flat().every(arg => !['--admin', '--auto'].includes(arg)));
  assert.equal(h.calls.security, 1);
  assert.ok(h.lines.some(line => /^ok  ci: CI SUCCESS/.test(line)));
  assert.match(h.lines.at(-1), /^mergad: PR #42/);
  const frozen = harness();
  assert.equal(frozen.run(['42', '--head', HEAD, '--freeze', FREEZE, '--dry-run']), 0);
  assert.deepEqual(frozen.calls.git.at(-1), ['merge-base', '--is-ancestor', FREEZE, 'origin/main']);
});

test('main refuses without merging, and dry-run never merges', () => {
  const merges = h => h.calls.gh.filter(argv => argv[1] === 'merge').length;
  const refused = harness({ pr: goodPr({ headRefName: 'kevin/port' }) });
  assert.equal(refused.run(['42', '--head', HEAD]), 1);
  assert.equal(merges(refused), 0);
  assert.ok(refused.lines.some(line => /^nej branch: kevin\/port matchar kevin\*/.test(line)));
  const dry = harness();
  assert.equal(dry.run(['42', '--head', HEAD, '--dry-run']), 0);
  assert.equal(merges(dry), 0);
  assert.match(dry.lines.at(-1), /^dry-run/);
  const stale = harness({ pr: goodPr({ headRefOid: OTHER }) });
  assert.equal(stale.run(['42', '--head', HEAD]), 1);
  assert.equal(merges(stale), 0);
  const offMain = harness({ onMain: false });
  assert.equal(offMain.run(['42', '--head', HEAD, '--freeze', FREEZE]), 1);
  assert.equal(merges(offMain), 0);
  const workflow = harness({ files: [{ filename: '.github/workflows/croupier.yml', status: 'modified' }], pr: goodPr({ changedFiles: 1 }) });
  assert.equal(workflow.run(['42', '--head', HEAD]), 1);
  assert.equal(merges(workflow), 0);
  const unreadable = harness({ view: { status: 1, stdout: '' } });
  assert.equal(unreadable.run(['42', '--head', HEAD]), 1);
  assert.equal(unreadable.calls.security, 0);
  const failedMerge = harness({ merge: { status: 1, stdout: '' } });
  assert.equal(failedMerge.run(['42', '--head', HEAD]), 1);
  assert.match(failedMerge.lines.at(-1), /misslyckades/);
  assert.throws(() => harness({ fetch: { status: 128, stdout: '' } }).run(['42', '--head', HEAD]), /fetch/);
  assert.throws(() => harness({ trusted: {} }).run(['42', '--head', HEAD]), /origin\/main/);
  assert.equal(harness().run(['42']), 2);
});

test('an unreadable security-status is retried once after ~10 s; attention codes are never retried', () => {
  const merges = h => h.calls.gh.filter(argv => argv[1] === 'merge').length;
  const broken = { status: 1, stdout: '' };
  const recovered = harness({ securityResults: [broken, cleanSecurity] });
  assert.equal(recovered.run(['42', '--head', HEAD]), 0);
  assert.equal(recovered.calls.security, 2);
  assert.deepEqual(recovered.calls.sleeps, [SECURITY_RETRY_MS]);
  assert.ok(SECURITY_RETRY_MS >= 10000);
  assert.ok(recovered.lines.some(line => /^omförsök security: security-status kunde inte läsas/.test(line)));
  assert.ok(recovered.lines.some(line => /^ok  security: .*efter ett omförsök/.test(line)));
  assert.equal(merges(recovered), 1);
  const garbled = harness({ securityResults: [{ status: 0, stdout: 'not json' }, cleanSecurity] });
  assert.equal(garbled.run(['42', '--head', HEAD]), 0);
  assert.equal(garbled.calls.security, 2);
  const twice = harness({ securityResults: [broken, broken] });
  assert.equal(twice.run(['42', '--head', HEAD]), 1);
  assert.equal(twice.calls.security, 2);
  assert.equal(merges(twice), 0);
  assert.ok(twice.lines.some(line => /^nej security: .*efter ett omförsök/.test(line)));
  const attention = harness({ securityResults: [{ status: 0, stdout: JSON.stringify({ attention: ['gitguardian_check_requires_attention'] }) }, cleanSecurity] });
  assert.equal(attention.run(['42', '--head', HEAD]), 1);
  assert.equal(attention.calls.security, 1);
  assert.deepEqual(attention.calls.sleeps, []);
  assert.equal(merges(attention), 0);
  const clean = harness();
  assert.equal(clean.run(['42', '--head', HEAD]), 0);
  assert.deepEqual(clean.calls.sleeps, []);
  assert.ok(clean.lines.every(line => !/omförsök/.test(line)));
});
