import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BASELINE_FOREIGN_BRANCHES, PR_FIELDS, evaluateMerge, foreignBranchPatterns, main, matchesGlob, parseArgs, requiredCheckState, securityVerdict,
} from '../tools/merge-pr.mjs';

// tools/merge-pr.mjs is the orchestrator's only merge path. Every refusal rule has a case
// here, and gh/git/security-status are injected so the test never touches the network.
const HEAD = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const FREEZE = 'c'.repeat(40);
const people = { jakob: { github: 'Jakeminator123', branch: 'main' }, kevin: { github: 'invoicesolv', branch: 'kevin' },
  john: { github: 'Johncleochile', branch: 'john' }, emil: { github: 'EmaCodeHero', branch: 'emil' } };
const policy = JSON.parse(readFileSync(new URL('../tools/repository-policy.json', import.meta.url), 'utf8'));
const cleanSecurity = { status: 0, stdout: JSON.stringify({ purpose: 'gitguardian-combined-security-status-v1',
  attention: ['gitguardian_open_incidents'], incidentCounts: { open: 2 } }) };
const goodPr = (overrides = {}) => ({
  number: 42, author: { login: 'Jakeminator123' }, isCrossRepository: false, headRefName: 'jakob/claude-merge-guard',
  headRefOid: HEAD, isDraft: false, baseRefName: 'main', state: 'OPEN', mergeable: 'MERGEABLE', changedFiles: 2,
  files: [{ path: 'tools/merge-pr.mjs' }, { path: 'docs/README.md' }],
  statusCheckRollup: [{ __typename: 'CheckRun', name: 'changes', status: 'COMPLETED', conclusion: 'SUCCESS' },
    { __typename: 'CheckRun', name: 'CI', status: 'COMPLETED', conclusion: 'SUCCESS' }],
  ...overrides,
});
const decide = (pr, extra = {}) => evaluateMerge({ pr, head: HEAD, jakobLogin: 'Jakeminator123',
  foreignPatterns: foreignBranchPatterns({ policy, people }), security: cleanSecurity, ...extra });
const failed = verdict => verdict.checks.filter(entry => !entry.ok).map(entry => entry.name);

test('a verified Jakob PR with green CI on the exact head passes every check', () => {
  const verdict = decide(goodPr());
  assert.equal(verdict.ok, true, JSON.stringify(verdict.checks));
  assert.deepEqual(verdict.checks.map(entry => entry.name),
    ['pr', 'state', 'draft', 'base', 'source', 'head', 'branch', 'author', 'ci', 'mergeable', 'security']);
  assert.equal(decide(goodPr(), { freeze: FREEZE }).ok, true, 'non-runtime files pass the freeze');
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
      goodPr({ statusCheckRollup: [{ __typename: 'CheckRun', name: 'CI', status: 'IN_PROGRESS', conclusion: '' }] }),
      goodPr({ statusCheckRollup: [{ __typename: 'CheckRun', name: 'CI', status: 'COMPLETED', conclusion: 'FAILURE' }] }),
      goodPr({ statusCheckRollup: [{ __typename: 'CheckRun', name: 'CI', status: 'COMPLETED', conclusion: 'SKIPPED' }] }),
      goodPr({ statusCheckRollup: [{ __typename: 'CheckRun', name: 'CI', status: 'COMPLETED', conclusion: 'SUCCESS' },
        { __typename: 'StatusContext', context: 'CI', state: 'PENDING' }] })],
    mergeable: [goodPr({ mergeable: 'CONFLICTING' })],
  };
  for (const [rule, prs] of Object.entries(cases)) {
    for (const pr of prs) {
      const verdict = decide(pr);
      assert.equal(verdict.ok, false, rule);
      assert.deepEqual(failed(verdict), [rule], rule);
    }
  }
  assert.deepEqual(failed(decide(goodPr(), { head: 'not-a-sha' })), ['head']);
  assert.deepEqual(failed(decide(goodPr(), { jakobLogin: undefined })), ['author'], 'no trusted owner, no merge');
  assert.ok(failed(decide(null)).length >= 10, 'an unreadable PR refuses everything');
});

test('other people\'s branches are refused even when Jakob opened the PR', () => {
  const patterns = foreignBranchPatterns({ policy, people });
  for (const pattern of BASELINE_FOREIGN_BRANCHES) assert.ok(patterns.includes(pattern), pattern);
  for (const branch of ['kevin', 'kevin-ks', 'kevin/port', 'Kevin/Port', 'codex/kevin-fix', 'john', 'john/design', 'codex/john-x',
    'emil', 'emil-ui', 'codex/emil-y', 'roulette-on-kevin-staging']) {
    assert.deepEqual(failed(decide(goodPr({ headRefName: branch }))), ['branch'], branch);
  }
  for (const branch of ['jakob/claude-x', 'jakob/kevin-port', 'codex/jakob-x']) {
    assert.equal(decide(goodPr({ headRefName: branch })).ok, true, branch);
  }
  // A new person in people.json is protected without code changes.
  assert.ok(foreignBranchPatterns({ policy, people: { ...people, ada: { branch: 'ada' } } }).includes('codex/ada-*'));
  assert.equal(matchesGlob('kevin.x', 'kevin*'), true);
  assert.equal(matchesGlob('xkevin', 'kevin*'), false);
  assert.equal(matchesGlob('codex/kevinx', 'codex/kevin-*'), false);
});

test('--freeze refuses runtime files and an incomplete file list', () => {
  const runtime = goodPr({ files: [{ path: 'docs/README.md' }, { path: 'services/game/server.mjs' }] });
  assert.deepEqual(failed(decide(runtime, { freeze: FREEZE })), ['freeze']);
  assert.equal(decide(runtime).ok, true, 'without --freeze runtime files are allowed');
  for (const path of ['apps/studio/lib/x.mjs', 'packages/director/a.mjs', 'ops/neon-game/1.sql', 'apps/web/app/page.tsx']) {
    assert.deepEqual(failed(decide(goodPr({ files: [{ path }], changedFiles: 1 }), { freeze: FREEZE })), ['freeze'], path);
  }
  assert.deepEqual(failed(decide(goodPr({ changedFiles: 150 }), { freeze: FREEZE })), ['freeze'], 'over 100 files cannot be proven');
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
  assert.deepEqual(parseArgs(['42', '--head', HEAD]), { number: 42, head: HEAD, freeze: null, dryRun: false });
  assert.deepEqual(parseArgs(['--dry-run', '--freeze', FREEZE, '--head', HEAD, '7']), { number: 7, head: HEAD, freeze: FREEZE, dryRun: true });
  for (const args of [[], ['42'], ['42', '--head', HEAD.slice(0, 12)], ['42', '--head', HEAD.toUpperCase()], ['--head', HEAD],
    ['42', '--head', HEAD, '--admin'], ['42', '--head', HEAD, '--freeze'], ['42', '43', '--head', HEAD], ['-1', '--head', HEAD]]) {
    assert.throws(() => parseArgs(args), /Usage/, args.join(' '));
  }
});

function harness({ pr = goodPr(), view = null, merge = { status: 0, stdout: '' }, trusted = { 'inbox/people.json': people, 'tools/repository-policy.json': policy } } = {}) {
  const calls = { gh: [], git: [], security: 0 }, lines = [];
  return {
    calls, lines,
    run: args => main({
      args, log: line => lines.push(line),
      gh: argv => { calls.gh.push(argv); return argv[1] === 'view' ? view ?? { status: 0, stdout: JSON.stringify(pr) } : merge; },
      git: argv => { calls.git.push(argv); const path = argv[1].replace(/^origin\/main:/, '');
        return trusted[path] ? { status: 0, stdout: JSON.stringify(trusted[path]) } : { status: 128, stdout: '' }; },
      security: () => { calls.security++; return cleanSecurity; },
    }),
  };
}

test('main merges with gh, the exact head and no admin or auto flags', () => {
  const h = harness();
  assert.equal(h.run(['42', '--head', HEAD]), 0);
  assert.deepEqual(h.calls.git, [['show', 'origin/main:inbox/people.json'], ['show', 'origin/main:tools/repository-policy.json']],
    'owner and policy come from trusted main, not the working copy');
  assert.equal(h.calls.gh[0][1], 'view');
  assert.deepEqual(h.calls.gh[0].slice(-2), ['--json', PR_FIELDS]);
  assert.deepEqual(h.calls.gh[1], ['pr', 'merge', '42', '-R', 'Jakeminator123/scoutgaming', '--merge', '--match-head-commit', HEAD]);
  assert.ok(h.calls.gh.flat().every(arg => !['--admin', '--auto'].includes(arg)));
  assert.equal(h.calls.security, 1);
  assert.ok(h.lines.some(line => /^ok  ci: CI SUCCESS/.test(line)));
  assert.match(h.lines.at(-1), /^mergad: PR #42/);
});

test('main refuses without merging, and dry-run never merges', () => {
  const refused = harness({ pr: goodPr({ headRefName: 'kevin/port' }) });
  assert.equal(refused.run(['42', '--head', HEAD]), 1);
  assert.equal(refused.calls.gh.length, 1, 'no merge call');
  assert.ok(refused.lines.some(line => /^nej branch: kevin\/port matchar kevin\*/.test(line)));
  const dry = harness();
  assert.equal(dry.run(['42', '--head', HEAD, '--dry-run']), 0);
  assert.equal(dry.calls.gh.length, 1);
  assert.match(dry.lines.at(-1), /^dry-run/);
  const stale = harness({ pr: goodPr({ headRefOid: OTHER }) });
  assert.equal(stale.run(['42', '--head', HEAD]), 1);
  assert.equal(stale.calls.gh.length, 1);
  const unreadable = harness({ view: { status: 1, stdout: '' } });
  assert.equal(unreadable.run(['42', '--head', HEAD]), 1);
  assert.equal(unreadable.calls.security, 0);
  const failedMerge = harness({ merge: { status: 1, stdout: '' } });
  assert.equal(failedMerge.run(['42', '--head', HEAD]), 1);
  assert.match(failedMerge.lines.at(-1), /misslyckades/);
  assert.throws(() => harness({ trusted: {} }).run(['42', '--head', HEAD]), /origin\/main/);
  assert.equal(harness().run(['42']), 2);
});
