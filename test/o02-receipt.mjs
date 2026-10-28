import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  NEGATIVE_CASE_IDS, SHARED_CHECK_IDS, checkReceiptsRef, evaluateDatabase, evaluateNegativeCases, evaluateSharedChecks, expectedStagingHead, k07ChecksOf,
} from '../tools/o02-receipt.mjs';

// tools/o02-receipt.mjs reads the reruns at --receipts-ref (they are merged as documentation after
// the freeze), takes D1's expectation from the K06 receipt and checks N1/S1 against fixed id lists.
const sha = c => c.repeat(40);

function tempRepo(t) {
  const dir = mkdtempSync(join(tmpdir(), 'o02-receipt-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...a) => execFileSync('git', ['-C', dir, '-c', 'user.name=o02-test', '-c', 'user.email=o02@example.invalid', '-c', 'commit.gpgsign=false', ...a],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = (files, message) => {
    for (const [path, text] of Object.entries(files)) { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); }
    git('add', '-A'); git('commit', '-q', '-m', message); return git('rev-parse', 'HEAD');
  };
  git('init', '-q', '-b', 'main');
  return { git, commit };
}

test('receipts ref: documentation merges after the candidate pass, runtime changes and unrelated refs fail', t => {
  const { git, commit } = tempRepo(t);
  const candidate = commit({ 'services/game/server.mjs': 'v1\n', 'docs/a.md': 'a\n' }, 'candidate');
  const docsOnly = commit({ 'docs/2026-10-29-K06-STAGING-RERUN-2-ACCEPTANCE.json': '{}\n', 'tools/x.mjs': 'x\n' }, 'docs merge after the freeze');
  const ok = checkReceiptsRef(git, candidate, 'main');
  assert.deepEqual(ok, { ref: 'main', sha: docsOnly, candidateIsAncestor: true, runtimeDiff: [], ok: true, reason: null });

  commit({ 'services/game/server.mjs': 'v2\n', 'packages/p/new.mjs': 'n\n' }, 'runtime change');
  const changed = checkReceiptsRef(git, candidate, 'main');
  assert.equal(changed.ok, false);
  assert.deepEqual(changed.runtimeDiff, ['packages/p/new.mjs', 'services/game/server.mjs']);
  assert.match(changed.reason, /ändrar runtime.*services\/game\/server\.mjs/);

  // A rename out of a runtime prefix still counts as a runtime change.
  git('checkout', '-q', '-b', 'moved', docsOnly); git('mv', 'services/game/server.mjs', 'docs/server.mjs'); git('commit', '-q', '-m', 'move');
  assert.deepEqual(checkReceiptsRef(git, candidate, 'moved').runtimeDiff, ['services/game/server.mjs']);

  git('checkout', '-q', '--orphan', 'other'); git('rm', '-rq', '--cached', '.');
  const unrelated = commit({ 'docs/b.md': 'b\n' }, 'unrelated');
  assert.deepEqual(checkReceiptsRef(git, candidate, 'other'), { ref: 'other', sha: unrelated, candidateIsAncestor: false, runtimeDiff: null, ok: false, reason: 'kandidaten är inte förfader till other' });
  assert.equal(checkReceiptsRef(git, candidate, 'no-such-ref').reason, 'okänd ref no-such-ref');
});

test('N1 needs exactly the planned cases, each pass or booked with a note', () => {
  const full = NEGATIVE_CASE_IDS.map(id => ({ id, result: id === 'L3' ? 'booked' : 'pass', note: `prov ${id}` }));
  assert.equal(NEGATIVE_CASE_IDS.length, 16);
  assert.equal(evaluateNegativeCases({ candidate: sha('a'), cases: full }, sha('a')).ok, true);
  assert.equal(evaluateNegativeCases({ candidate: sha('b'), cases: full }, sha('a')).candidateMatch, false);
  assert.equal(evaluateNegativeCases(null, sha('a')).ok, false);

  const broken = full.filter(c => !['K3c', 'L5'].includes(c.id)).map(c => c.id === 'K4' ? { ...c, result: 'fail' } : c.id === 'K8' ? { ...c, note: '  ' } : c);
  broken.push({ id: 'K9', result: 'pass', note: 'x' }, { id: 'K6', result: 'pass', note: 'igen' });
  const r = evaluateNegativeCases({ candidate: sha('a'), cases: broken }, sha('a'));
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ['K3c', 'L5']);
  assert.deepEqual(r.extra, ['K9']);
  assert.deepEqual(r.duplicates, ['K6']);
  assert.deepEqual(r.invalid, ['K4: result fail', 'K8: note saknas']);
});

test('S1 needs K07-g1, K07-g2 and K07-g2a and every K07 check pass', () => {
  const receipt = JSON.parse(readFileSync(new URL('../docs/2026-10-28-K07-STAGING-RERUN-ACCEPTANCE.json', import.meta.url), 'utf8'));
  const checks = k07ChecksOf(receipt);
  assert.ok(SHARED_CHECK_IDS.every(id => checks.some(c => c.id === id)), 'the K07 rerun names the required ids');
  assert.equal(evaluateSharedChecks(checks).ok, true);
  const withoutG2a = checks.filter(c => c.id !== 'K07-g2a');
  assert.deepEqual(evaluateSharedChecks(withoutG2a).missing, ['K07-g2a']);
  const g1Fails = checks.map(c => c.id === 'K07-g1' ? { ...c, result: 'fail' } : c);
  assert.deepEqual(evaluateSharedChecks(g1Fails).notPass, ['K07-g1']);
  assert.equal(evaluateSharedChecks(g1Fails).ok, false);
  assert.equal(evaluateSharedChecks([]).ok, false);
  assert.deepEqual(k07ChecksOf({ checks: [{ id: 'x', pass: true }, { id: 'y', pass: false }] }), [{ id: 'x', result: 'pass' }, { id: 'y', result: 'fail' }]);
});

test('D1 expects the K06 receipt\'s final state unless the flags override, and records the source', () => {
  const receipt = JSON.parse(readFileSync(new URL('../docs/2026-10-28-K06-STAGING-RERUN-ACCEPTANCE.json', import.meta.url), 'utf8'));
  const path = 'docs/2026-10-28-K06-STAGING-RERUN-ACCEPTANCE.json';
  const fromReceipt = expectedStagingHead(receipt, { k06Path: path });
  assert.deepEqual(fromReceipt, { publishedConfig: receipt.neon.finalState.head, packageRevision: receipt.neon.finalState.packageRevision,
    source: { publishedConfig: `${path}#neon.finalState.head`, packageRevision: `${path}#neon.finalState.packageRevision` } });
  const flagged = expectedStagingHead(receipt, { config: 'room-config-new', packageRevision: 17, k06Path: path });
  assert.deepEqual(flagged, { publishedConfig: 'room-config-new', packageRevision: 17, source: { publishedConfig: '--expect-config', packageRevision: '--expect-package' } });
  assert.deepEqual(expectedStagingHead({}, {}), { publishedConfig: null, packageRevision: null, source: { publishedConfig: null, packageRevision: null } });

  const role = 'croupier_staging_app';
  const neon = { who: { role }, sharedTables: 15, ledgerMismatch: 0, negativeBalances: 0, duplicateSourceKeys: 0, configHead: { version: fromReceipt.publishedConfig }, packageHead: fromReceipt.packageRevision };
  assert.equal(evaluateDatabase(neon, fromReceipt, role), true);
  assert.equal(evaluateDatabase(neon, flagged, role), false, 'a newer publication is a fail against the old head');
  assert.equal(evaluateDatabase({ ...neon, configHead: { version: 'room-config-new' }, packageHead: 17 }, flagged, role), true);
  assert.equal(evaluateDatabase({ ...neon, ledgerMismatch: 1 }, fromReceipt, role), false);
  assert.equal(evaluateDatabase(neon, expectedStagingHead({}, {}), role), null, 'no expectation stays missing');
  assert.equal(evaluateDatabase(null, fromReceipt, role), null);
});
