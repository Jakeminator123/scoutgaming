import test from 'node:test';
import assert from 'node:assert/strict';
import { RUNTIME_PREFIXES, evaluateFreeze, latestReceipts, openRuntimePrs, pickRun, receiptSha, touchesRuntime } from '../tools/o02-freeze-check.mjs';

// tools/o02-freeze-check.mjs decides the automatic freeze rules F1, F2 and F5 of
// docs/plans/O02-PLAN.md and picks the receipts that F8 compares with the candidate.
const sha = c => c.repeat(40);

test('the newest receipt per family wins by rerun number, then by date', () => {
  const picked = latestReceipts([
    'docs/2026-10-28-K04-BROWSER-RERUN-ACCEPTANCE.json', 'docs/2026-10-28-K04-BROWSER-RERUN-3-ACCEPTANCE.json',
    'docs/2026-10-28-K04-BROWSER-RERUN-2-ACCEPTANCE.json', 'docs/2026-10-29-K04-BROWSER-RERUN-4-ACCEPTANCE.json',
    'docs/2026-10-27-K04-BROWSER-ACCEPTANCE.json', 'docs/2026-10-28-K06-STAGING-RERUN-ACCEPTANCE.json',
    'docs/2026-10-27-K06-STAGING-ACCEPTANCE.json', 'docs/history/2026-10-30-K07-STAGING-RERUN-ACCEPTANCE.json',
  ]);
  assert.deepEqual(picked, { k04: 'docs/2026-10-29-K04-BROWSER-RERUN-4-ACCEPTANCE.json', k06: 'docs/2026-10-28-K06-STAGING-RERUN-ACCEPTANCE.json', k07: null });
  assert.equal(latestReceipts(['docs/2026-10-28-K07-STAGING-RERUN-ACCEPTANCE.json', 'docs/2026-10-30-K07-STAGING-RERUN-ACCEPTANCE.json']).k07,
    'docs/2026-10-30-K07-STAGING-RERUN-ACCEPTANCE.json');
});

test('receipt SHA follows each family\'s field and rejects anything but a full SHA', () => {
  assert.equal(receiptSha({ candidate: sha('a'), codeSha: sha('b') }), sha('a'));
  assert.equal(receiptSha({ codeShas: { allSteps: sha('c') } }), sha('c'));
  assert.equal(receiptSha({ codeSha: sha('d') }), sha('d'));
  assert.equal(receiptSha({ codeSha: 'd'.repeat(8) }), null);
  assert.equal(receiptSha(null), null);
});

test('runtime PRs: drafts are listed but only open non-drafts block F5', () => {
  assert.ok(RUNTIME_PREFIXES.every(p => p.endsWith('/')));
  assert.ok(touchesRuntime('services/game/server.mjs') && touchesRuntime('services/openclaw/lab/x.mjs'));
  assert.ok(!touchesRuntime('docs/plans/O02-PLAN.md') && !touchesRuntime('tools/o02-receipt.mjs') && !touchesRuntime('test/x.mjs'));
  const prs = openRuntimePrs([
    { number: 1, isDraft: true, author: { login: 'a' }, files: [{ path: 'packages/x.mjs' }] },
    { number: 2, isDraft: false, files: [{ path: 'docs/a.md' }] },
    { number: 3, isDraft: false, files: [{ path: 'apps/web/a.ts' }, { path: 'docs/b.md' }] },
  ]);
  assert.deepEqual(prs.map(p => [p.number, p.draft, p.runtimeFiles]), [[1, true, ['packages/x.mjs']], [3, false, ['apps/web/a.ts']]]);
  assert.deepEqual(evaluateFreeze({ onMain: true, ci: { status: 'completed', conclusion: 'success' }, prs: prs.slice(0, 1) }), { F1: true, F2: true, F5: true, pass: true });
  assert.equal(evaluateFreeze({ onMain: true, ci: { status: 'completed', conclusion: 'success' }, prs }).F5, false);
});

test('CI must be the newest push or dispatch run of the main workflow and completed green', () => {
  const runs = [
    { id: 1, name: 'Croupier GitHub checks', event: 'pull_request', status: 'completed', conclusion: 'success', created_at: '2026-10-28T03:00:00Z' },
    { id: 2, name: 'Croupier GitHub checks', event: 'push', status: 'completed', conclusion: 'failure', created_at: '2026-10-28T01:00:00Z' },
    { id: 3, name: 'Croupier GitHub checks', event: 'workflow_dispatch', status: 'completed', conclusion: 'success', created_at: '2026-10-28T02:00:00Z' },
  ];
  assert.equal(pickRun(runs, 'Croupier GitHub checks').id, 3);
  assert.equal(pickRun(runs, 'Render v3 container check'), null);
  assert.equal(evaluateFreeze({ onMain: true, ci: { status: 'in_progress', conclusion: null }, prs: [] }).F2, false);
  assert.equal(evaluateFreeze({ onMain: true, ci: null, prs: [] }).F2, false);
  assert.deepEqual(evaluateFreeze({ onMain: null, ci: undefined, prs: undefined }), { F1: null, F2: null, F5: null, pass: false });
});
